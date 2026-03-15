import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.db import transaction
from django.middleware.csrf import get_token
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken, TokenError

from .auth_utils import ensure_user_role, get_user_role, set_user_role
from .models import AccessGrantToken, UserRole
from .permissions import IsAdminRole
from .security import check_login_locked, clear_login_failures, record_login_failure


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(max_length=255)


class GrantTokenCreateSerializer(serializers.Serializer):
    label = serializers.CharField(max_length=120)
    role_to_grant = serializers.ChoiceField(choices=UserRole.ROLE_CHOICES, default=UserRole.ROLE_GUEST)
    max_uses = serializers.IntegerField(min_value=1, max_value=1000, default=1)
    expires_in_hours = serializers.IntegerField(min_value=1, max_value=24 * 30, default=24)


class RegisterWithGrantTokenSerializer(serializers.Serializer):
    token = serializers.CharField(max_length=256)
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(max_length=255, min_length=8)


class RoleGrantSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    role = serializers.ChoiceField(choices=UserRole.ROLE_CHOICES)


class GuestCreateSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(max_length=255, min_length=8)


class GuestUpdateSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150, required=False)
    password = serializers.CharField(max_length=255, min_length=8, required=False)
    is_active = serializers.BooleanField(required=False)


class _CookieTokenMixin:
    def _cookie_config(self):
        return {
            "secure": bool(getattr(settings, "AUTH_COOKIE_SECURE", False)),
            "samesite": getattr(settings, "AUTH_COOKIE_SAMESITE", "Lax"),
            "domain": getattr(settings, "AUTH_COOKIE_DOMAIN", None),
            "path": "/",
            "httponly": True,
        }

    def _set_access_cookie(self, response, access_token):
        cfg = self._cookie_config()
        response.set_cookie(
            key="access_token",
            value=str(access_token),
            max_age=int(getattr(settings, "AUTH_ACCESS_COOKIE_AGE", 900)),
            **cfg,
        )

    def _set_refresh_cookie(self, response, refresh_token):
        cfg = self._cookie_config()
        response.set_cookie(
            key="refresh_token",
            value=str(refresh_token),
            max_age=int(getattr(settings, "AUTH_REFRESH_COOKIE_AGE", 604800)),
            **cfg,
        )

    def _clear_cookies(self, response):
        cfg = self._cookie_config()
        response.delete_cookie("access_token", path=cfg["path"], domain=cfg["domain"], samesite=cfg["samesite"])
        response.delete_cookie("refresh_token", path=cfg["path"], domain=cfg["domain"], samesite=cfg["samesite"])


@method_decorator(ensure_csrf_cookie, name='dispatch')
class CSRFTokenView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = 'auth_refresh'

    def get(self, request):
        return Response({"csrfToken": get_token(request)})


class LoginView(_CookieTokenMixin, APIView):
    permission_classes = [AllowAny]
    throttle_scope = 'auth_login'

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        username = serializer.validated_data["username"]
        ip_address = request.META.get("REMOTE_ADDR", "unknown")

        is_locked, remaining_seconds = check_login_locked(username, ip_address)
        if is_locked:
            return Response(
                {"detail": f"Too many failed login attempts. Try again in {remaining_seconds} seconds."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        user = authenticate(
            request,
            username=username,
            password=serializer.validated_data["password"],
        )
        if not user:
            record_login_failure(
                username,
                ip_address,
                int(getattr(settings, "AUTH_LOGIN_MAX_ATTEMPTS", 5)),
                int(getattr(settings, "AUTH_LOGIN_LOCK_MINUTES", 15)),
            )
            return Response({"detail": "Invalid credentials."}, status=status.HTTP_401_UNAUTHORIZED)

        clear_login_failures(username, ip_address)

        ensure_user_role(user)
        role = get_user_role(user)

        refresh = RefreshToken.for_user(user)
        response = Response(
            {
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "role": role,
                }
            },
            status=status.HTTP_200_OK,
        )
        self._set_access_cookie(response, refresh.access_token)
        self._set_refresh_cookie(response, refresh)
        return response


class RefreshTokenView(_CookieTokenMixin, APIView):
    permission_classes = [AllowAny]
    throttle_scope = 'auth_refresh'

    def post(self, request):
        refresh_raw = request.COOKIES.get("refresh_token")
        if not refresh_raw:
            return Response({"detail": "Refresh token missing."}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            old_refresh = RefreshToken(refresh_raw)
        except TokenError:
            return Response({"detail": "Invalid refresh token."}, status=status.HTTP_401_UNAUTHORIZED)

        response = Response({"detail": "Token refreshed."}, status=status.HTTP_200_OK)
        self._set_access_cookie(response, old_refresh.access_token)

        if getattr(settings, "SIMPLE_JWT", {}).get("ROTATE_REFRESH_TOKENS", True):
            try:
                old_refresh.blacklist()
            except Exception:
                pass
            user_id = old_refresh.get("user_id")
            user = get_user_model().objects.filter(id=user_id).first()
            if not user:
                self._clear_cookies(response)
                return Response({"detail": "User not found."}, status=status.HTTP_401_UNAUTHORIZED)

            new_refresh = RefreshToken.for_user(user)
            self._set_refresh_cookie(response, new_refresh)

        return response


class LogoutView(_CookieTokenMixin, APIView):
    permission_classes = [IsAuthenticated]
    throttle_scope = 'auth_refresh'

    def post(self, request):
        refresh_raw = request.COOKIES.get("refresh_token")
        if refresh_raw:
            try:
                RefreshToken(refresh_raw).blacklist()
            except Exception:
                pass

        response = Response({"detail": "Logged out."}, status=status.HTTP_200_OK)
        self._clear_cookies(response)
        return response


class MeView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_scope = 'auth_refresh'

    def get(self, request):
        ensure_user_role(request.user)
        return Response(
            {
                "user": {
                    "id": request.user.id,
                    "username": request.user.username,
                    "role": get_user_role(request.user),
                }
            }
        )


class CreateGrantTokenView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]
    throttle_scope = 'auth_grant_token'

    def post(self, request):
        serializer = GrantTokenCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        raw_token = secrets.token_urlsafe(32)
        expires_at = timezone.now() + timedelta(hours=serializer.validated_data["expires_in_hours"])

        AccessGrantToken.objects.create(
            label=serializer.validated_data["label"],
            role_to_grant=serializer.validated_data["role_to_grant"],
            max_uses=serializer.validated_data["max_uses"],
            expires_at=expires_at,
            created_by=request.user,
            token_hash=AccessGrantToken.hash_token(raw_token),
        )

        return Response(
            {
                "token": raw_token,
                "expires_at": expires_at,
                "max_uses": serializer.validated_data["max_uses"],
                "role_to_grant": serializer.validated_data["role_to_grant"],
            },
            status=status.HTTP_201_CREATED,
        )


class RegisterWithGrantTokenView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = 'auth_register'

    @transaction.atomic
    def post(self, request):
        serializer = RegisterWithGrantTokenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        token_hash = AccessGrantToken.hash_token(serializer.validated_data["token"])
        grant = (
            AccessGrantToken.objects.select_for_update()
            .filter(token_hash=token_hash, is_active=True)
            .first()
        )
        if not grant or not grant.is_usable:
            return Response({"detail": "Invalid or expired grant token."}, status=status.HTTP_400_BAD_REQUEST)

        User = get_user_model()
        username = serializer.validated_data["username"]
        if User.objects.filter(username=username).exists():
            return Response({"detail": "Username already exists."}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.create_user(
            username=username,
            password=serializer.validated_data["password"],
        )
        set_user_role(user, grant.role_to_grant)

        grant.uses_count += 1
        if grant.uses_count >= grant.max_uses:
            grant.is_active = False
        grant.save(update_fields=["uses_count", "is_active"])

        return Response(
            {
                "detail": "Account created successfully.",
                "username": user.username,
                "role": grant.role_to_grant,
            },
            status=status.HTTP_201_CREATED,
        )


class GrantRoleView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]
    throttle_scope = 'auth_role_grant'

    def post(self, request):
        serializer = RoleGrantSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        User = get_user_model()
        user = User.objects.filter(username=serializer.validated_data["username"]).first()
        if not user:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        role_obj = set_user_role(user, serializer.validated_data["role"])
        return Response({"username": user.username, "role": role_obj.role})


class GuestAccountsView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]
    throttle_scope = 'auth_guest_manage'

    def get(self, request):
        User = get_user_model()
        guests = User.objects.filter(user_role__role=UserRole.ROLE_GUEST).select_related("guest_presence").order_by("username")
        data = []
        for guest in guests:
            presence = getattr(guest, "guest_presence", None)
            data.append(
                {
                    "id": guest.id,
                    "username": guest.username,
                    "is_active": guest.is_active,
                    "last_login": guest.last_login,
                    "is_online": bool(presence and presence.is_online),
                    "last_seen": presence.last_seen if presence else None,
                }
            )
        return Response({"results": data})

    def post(self, request):
        serializer = GuestCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        User = get_user_model()
        username = serializer.validated_data["username"]
        if User.objects.filter(username=username).exists():
            return Response({"detail": "Username already exists."}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.create_user(
            username=username,
            password=serializer.validated_data["password"],
        )
        set_user_role(user, UserRole.ROLE_GUEST)
        return Response({"id": user.id, "username": user.username, "role": UserRole.ROLE_GUEST}, status=status.HTTP_201_CREATED)


class GuestAccountDetailView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]
    throttle_scope = 'auth_guest_manage'

    def _find_guest(self, user_id):
        User = get_user_model()
        return User.objects.filter(id=user_id, user_role__role=UserRole.ROLE_GUEST).first()

    def patch(self, request, user_id):
        guest = self._find_guest(user_id)
        if not guest:
            return Response({"detail": "Guest not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = GuestUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data

        update_fields = []

        username = payload.get("username")
        if username and username != guest.username:
            User = get_user_model()
            if User.objects.filter(username=username).exclude(id=guest.id).exists():
                return Response({"detail": "Username already exists."}, status=status.HTTP_400_BAD_REQUEST)
            guest.username = username
            update_fields.append("username")

        if "is_active" in payload:
            guest.is_active = payload["is_active"]
            update_fields.append("is_active")

        if payload.get("password"):
            guest.set_password(payload["password"])
            update_fields.append("password")

        if update_fields:
            guest.save(update_fields=update_fields)
        return Response({"id": guest.id, "username": guest.username, "is_active": guest.is_active})

    def delete(self, request, user_id):
        guest = self._find_guest(user_id)
        if not guest:
            return Response({"detail": "Guest not found."}, status=status.HTTP_404_NOT_FOUND)
        guest.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
