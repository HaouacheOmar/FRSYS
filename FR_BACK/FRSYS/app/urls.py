from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PersonViewSet, CompagnieViewSet, CameraViewSet, SpectacleViewSet, RentreeViewSet

router = DefaultRouter()
router.register(r"persons", PersonViewSet)
router.register(r"compagnies", CompagnieViewSet)
router.register(r"cameras", CameraViewSet)
router.register(r"spectacles", SpectacleViewSet)
router.register(r"rentrees", RentreeViewSet)

urlpatterns = [
    path("api/", include(router.urls)),
]