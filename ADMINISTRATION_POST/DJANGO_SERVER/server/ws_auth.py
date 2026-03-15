from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.tokens import AccessToken, TokenError

from .auth_utils import get_user_by_id


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

        if token:
            try:
                validated = AccessToken(token)
                user_id = validated.get("user_id")
                if user_id is not None:
                    user = await database_sync_to_async(get_user_by_id)(user_id)
                    if user:
                        scope["user"] = user
            except TokenError:
                pass

        return await super().__call__(scope, receive, send)
