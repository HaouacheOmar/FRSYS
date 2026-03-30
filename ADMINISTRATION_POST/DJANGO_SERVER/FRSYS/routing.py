
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator
from django.core.asgi import get_asgi_application
import server.routing
from server.ws_auth import JWTAuthMiddleware

asgi_application = get_asgi_application()

application = ProtocolTypeRouter({
    # HTTP requests
    "http": asgi_application,
    
    # WebSocket requests
    "websocket": AllowedHostsOriginValidator(
        JWTAuthMiddleware(URLRouter(server.routing.websocket_urlpatterns))
    ),
})
