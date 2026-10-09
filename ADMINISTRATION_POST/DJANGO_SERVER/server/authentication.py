from rest_framework import exceptions
from rest_framework.authentication import CSRFCheck
from rest_framework_simplejwt.authentication import JWTAuthentication


class CookieJWTAuthentication(JWTAuthentication):
    """Read access JWT from Authorization header first, then from HttpOnly cookie."""

    def authenticate(self, request):
        header = self.get_header(request)
        if header is not None:
            raw_token = self.get_raw_token(header)
            if raw_token is not None:
                validated_token = self.get_validated_token(raw_token)
                return self.get_user(validated_token), validated_token

        raw_token = request.COOKIES.get("access_token")
        if not raw_token:
            return None

        validated_token = self.get_validated_token(raw_token)
        # The browser attaches the cookie to requests other sites trigger too, so cookie auth
        # needs the CSRF check (the Authorization header can't be forged that way).
        self.enforce_csrf(request)
        return self.get_user(validated_token), validated_token

    @staticmethod
    def enforce_csrf(request):
        """Same check DRF's SessionAuthentication runs (safe methods pass)."""
        check = CSRFCheck(lambda req: None)
        check.process_request(request)
        reason = check.process_view(request, None, (), {})
        if reason:
            raise exceptions.PermissionDenied(f"CSRF Failed: {reason}")
