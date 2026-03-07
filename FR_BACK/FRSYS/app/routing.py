from django.urls import re_path
from .consumers import CameraConsumer

# websocket url routing for camera stream
websocket_urlpatterns = [
    # route ws/camera/ to camera consumer handler
    re_path(r"ws/camera/$", CameraConsumer.as_asgi()),
]