from rest_framework.permissions import BasePermission, SAFE_METHODS

from .auth_utils import get_user_role
from .models import UserRole


class IsAdminRole(BasePermission):
    def has_permission(self, request, view):
        role = get_user_role(request.user)
        return role == UserRole.ROLE_ADMIN


class IsAdminOrGuestReadOnly(BasePermission):
    def has_permission(self, request, view):
        role = get_user_role(request.user)
        if role == UserRole.ROLE_ADMIN:
            return True
        if role == UserRole.ROLE_GUEST and request.method in SAFE_METHODS:
            return True
        return False
