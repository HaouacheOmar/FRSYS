"""
ASGI routing configuration for FRSYS project.
Handles both HTTP and WebSocket protocols.
"""
from channels.auth import AuthMiddlewareStack
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator
from django.core.asgi import get_asgi_application
import server.routing

asgi_application = get_asgi_application()

application = ProtocolTypeRouter({
    # HTTP requests
    "http": asgi_application,
    
    # WebSocket requests
    "websocket": AllowedHostsOriginValidator(
        AuthMiddlewareStack(
            URLRouter(
                server.routing.websocket_urlpatterns
            )
        )
    ),
})
