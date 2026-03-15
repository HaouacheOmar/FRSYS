from django.contrib.auth import get_user_model

from .models import UserRole


def get_user_role(user):
    if not user or not getattr(user, "is_authenticated", False):
        return None
    if user.is_superuser or user.is_staff:
        return UserRole.ROLE_ADMIN

    try:
        return user.user_role.role
    except UserRole.DoesNotExist:
        return UserRole.ROLE_GUEST


def ensure_user_role(user, default_role=UserRole.ROLE_GUEST):
    role_obj, _ = UserRole.objects.get_or_create(user=user, defaults={"role": default_role})
    return role_obj


def set_user_role(user, role):
    role_obj = ensure_user_role(user, default_role=role)
    if role_obj.role != role:
        role_obj.role = role
        role_obj.save(update_fields=["role", "updated_at"])

    if role == UserRole.ROLE_ADMIN:
        if not user.is_staff:
            user.is_staff = True
            user.save(update_fields=["is_staff"])
    elif user.is_staff and not user.is_superuser:
        user.is_staff = False
        user.save(update_fields=["is_staff"])

    return role_obj


def get_user_by_id(user_id):
    User = get_user_model()
    try:
        return User.objects.get(id=user_id)
    except User.DoesNotExist:
        return None
