import os

from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'FRSYS.settings')

# Must run before importing anything that touches models (consumers, ws_auth).
django_asgi_app = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter  # noqa: E402
from channels.security.websocket import OriginValidator  # noqa: E402
from django.conf import settings  # noqa: E402

from server.routing import websocket_urlpatterns  # noqa: E402
from server.ws_auth import JWTAuthMiddleware  # noqa: E402

# WebSockets authenticate with the auth cookie, which the browser also sends when a page
# on another site opens the socket. Only accept the frontend's own origins: the same list
# that may call the API with credentials (CORS_ALLOWED_ORIGINS).
WEBSOCKET_ALLOWED_ORIGINS = list(settings.CORS_ALLOWED_ORIGINS)
if settings.DEBUG:
    WEBSOCKET_ALLOWED_ORIGINS += ['http://localhost:3000', 'http://127.0.0.1:3000']

application = ProtocolTypeRouter({
    'http': django_asgi_app,
    'websocket': OriginValidator(
        JWTAuthMiddleware(URLRouter(websocket_urlpatterns)),
        WEBSOCKET_ALLOWED_ORIGINS,
    ),
})
