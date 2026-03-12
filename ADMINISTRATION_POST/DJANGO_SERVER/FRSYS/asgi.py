"""
ASGI config for FRSYS project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/6.0/howto/deployment/asgi/
"""

import os
from django.core.asgi import get_asgi_application

# Set Django settings before importing routing
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'FRSYS.settings')

# Import the routing application which handles both HTTP and WebSocket
from FRSYS.routing import application

# application is already configured in routing.py with ProtocolTypeRouter
