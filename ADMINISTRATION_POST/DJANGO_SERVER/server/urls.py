"""
URL configuration for server app.
"""
from django.urls import path
from . import views
from .auth_views import (
    CSRFTokenView,
    CreateGrantTokenView,
    GuestAccountDetailView,
    GuestAccountsView,
    GrantRoleView,
    LoginView,
    LogoutView,
    MeView,
    RefreshTokenView,
    RegisterWithGrantTokenView,
)

app_name = 'server'

urlpatterns = [
    # Auth endpoints
    path('api/auth/csrf/', CSRFTokenView.as_view(), name='auth-csrf'),
    path('api/auth/login/', LoginView.as_view(), name='auth-login'),
    path('api/auth/logout/', LogoutView.as_view(), name='auth-logout'),
    path('api/auth/refresh/', RefreshTokenView.as_view(), name='auth-refresh'),
    path('api/auth/me/', MeView.as_view(), name='auth-me'),
    path('api/auth/grant-token/', CreateGrantTokenView.as_view(), name='auth-grant-token'),
    path('api/auth/register-with-token/', RegisterWithGrantTokenView.as_view(), name='auth-register-with-token'),
    path('api/auth/grant-role/', GrantRoleView.as_view(), name='auth-grant-role'),
    path('api/auth/guests/', GuestAccountsView.as_view(), name='auth-guests'),
    path('api/auth/guests/<int:user_id>/', GuestAccountDetailView.as_view(), name='auth-guests-detail'),

    # Traditional views
    path('video-stream/', views.video_stream_view, name='video_stream'),
    path('api/status/', views.api_status, name='api_status'),
    
    # Compagnie endpoints
    path('api/compagnies/', views.CompagnieViewSet.as_view({'get': 'list', 'post': 'create'}), name='compagnie-list'),
    path('api/compagnies/<int:pk>/', views.CompagnieViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'}), name='compagnie-detail'),
    path('api/compagnies/<int:pk>/persons/', views.CompagnieViewSet.as_view({'get': 'persons'}), name='compagnie-persons'),
    
    # Person endpoints
    path('api/persons/', views.PersonViewSet.as_view({'get': 'list', 'post': 'create'}), name='person-list'),
    path('api/persons/<int:pk>/', views.PersonViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'}), name='person-detail'),
    path('api/persons/<int:pk>/spectacles/', views.PersonViewSet.as_view({'get': 'spectacles'}), name='person-spectacles'),
    path('api/persons/<int:pk>/rentrees/', views.PersonViewSet.as_view({'get': 'rentrees'}), name='person-rentrees'),
    path('api/persons/<int:pk>/main-photo/', views.PersonViewSet.as_view({'get': 'main_photo'}), name='person-main-photo'),
    
    # Camera endpoints
    path('api/cameras/', views.CameraViewSet.as_view({'get': 'list', 'post': 'create'}), name='camera-list'),
    path('api/cameras/<int:pk>/', views.CameraViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'}), name='camera-detail'),
    path('api/cameras/<int:pk>/activate/', views.CameraViewSet.as_view({'post': 'activate'}), name='camera-activate'),
    path('api/cameras/<int:pk>/deactivate/', views.CameraViewSet.as_view({'post': 'deactivate'}), name='camera-deactivate'),
    path('api/cameras/<int:pk>/ping/', views.CameraViewSet.as_view({'get': 'ping'}), name='camera-ping'),
    path('api/cameras/ping_all/', views.CameraViewSet.as_view({'get': 'ping_all'}), name='camera-ping-all'),
    
    # Spectacle endpoints
    path('api/spectacles/', views.SpectacleViewSet.as_view({'get': 'list', 'post': 'create'}), name='spectacle-list'),
    path('api/spectacles/pending/', views.SpectacleViewSet.as_view({'get': 'pending'}), name='spectacle-pending'),
    path('api/spectacles/completed/', views.SpectacleViewSet.as_view({'get': 'completed'}), name='spectacle-completed'),
    path('api/spectacles/<int:pk>/', views.SpectacleViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'}), name='spectacle-detail'),
    path('api/spectacles/<int:pk>/mark_return/', views.SpectacleViewSet.as_view({'post': 'mark_return'}), name='spectacle-mark-return'),
    
    # Rentree endpoints
    path('api/rentrees/', views.RentreeViewSet.as_view({'get': 'list', 'post': 'create'}), name='rentree-list'),
    path('api/rentrees/late_returns/', views.RentreeViewSet.as_view({'get': 'late_returns'}), name='rentree-late-returns'),
    path('api/rentrees/<int:pk>/', views.RentreeViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'}), name='rentree-detail'),
]
