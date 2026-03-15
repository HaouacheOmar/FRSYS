from django.contrib import admin
from .models import AccessGrantToken, GuestPresence, UserRole


@admin.register(UserRole)
class UserRoleAdmin(admin.ModelAdmin):
	list_display = ('user', 'role', 'updated_at')
	list_filter = ('role',)
	search_fields = ('user__username',)


@admin.register(AccessGrantToken)
class AccessGrantTokenAdmin(admin.ModelAdmin):
	list_display = ('label', 'role_to_grant', 'is_active', 'uses_count', 'max_uses', 'expires_at', 'created_by')
	list_filter = ('role_to_grant', 'is_active')
	search_fields = ('label', 'created_by__username')


@admin.register(GuestPresence)
class GuestPresenceAdmin(admin.ModelAdmin):
	list_display = ('user', 'is_online', 'connection_count', 'last_seen', 'updated_at')
	list_filter = ('is_online',)
	search_fields = ('user__username',)
