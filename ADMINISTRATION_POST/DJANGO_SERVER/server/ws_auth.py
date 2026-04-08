import logging

from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.tokens import AccessToken, TokenError

from .auth_utils import get_user_by_id


logger = logging.getLogger(__name__)


def _parse_cookie_header(headers):
    for key, value in headers:
        if key == b"cookie":
            return value.decode("utf-8")
    return ""


def _extract_cookie_value(cookie_header, name):
    if not cookie_header:
        return None
    for part in cookie_header.split(";"):
        chunk = part.strip()
        if chunk.startswith(f"{name}="):
            return chunk.split("=", 1)[1]
    return None


class JWTAuthMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        scope["user"] = AnonymousUser()

        cookie_header = _parse_cookie_header(scope.get("headers", []))
        token = _extract_cookie_value(cookie_header, "access_token")
        debug_ws_auth = bool(getattr(settings, "DEBUG", False))

        if debug_ws_auth:
            path = scope.get("path", "")
            logger.info(
                "WS auth handshake path=%s has_cookie=%s has_access_token=%s",
                path,
                bool(cookie_header),
                bool(token),
            )

        if token:
            try:
                validated = AccessToken(token)
                user_id = validated.get("user_id")
                if user_id is not None:
                    user = await database_sync_to_async(get_user_by_id)(user_id)
                    if user:
                        scope["user"] = user
                        if debug_ws_auth:
                            logger.info(
                                "WS auth success path=%s user_id=%s username=%s",
                                scope.get("path", ""),
                                getattr(user, "id", None),
                                getattr(user, "username", ""),
                            )
            except TokenError:
                if debug_ws_auth:
                    logger.warning(
                        "WS auth token invalid path=%s",
                        scope.get("path", ""),
                    )

        if debug_ws_auth and isinstance(scope.get("user"), AnonymousUser):
            logger.warning("WS auth unresolved anonymous path=%s", scope.get("path", ""))

        return await super().__call__(scope, receive, send)
