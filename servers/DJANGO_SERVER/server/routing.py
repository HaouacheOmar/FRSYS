"""
WebSocket URL routing for the server app.
Defines WebSocket endpoints for video streaming and face recognition.
"""
from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    # Live video stream with face recognition
    re_path(r'ws/video/stream/$', consumers.VideoStreamConsumer.as_asgi()),
    
    # On-demand face recognition for uploaded frames
    re_path(r'ws/face/recognize/$', consumers.FaceRecognitionConsumer.as_asgi()),

    # Guest presence heartbeat and status
    re_path(r'ws/presence/guest/$', consumers.GuestPresenceConsumer.as_asgi()),

    # Admin live guest notifications
    re_path(r'ws/admin/notifications/$', consumers.AdminNotificationConsumer.as_asgi()),
]
