from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.utils import timezone

from .models import GuestPresence, UserRole


ADMIN_NOTIFICATIONS_GROUP = "admin_notifications"


def _send_admin_event(event_type, payload):
    channel_layer = get_channel_layer()
    if not channel_layer:
        return

    async_to_sync(channel_layer.group_send)(
        ADMIN_NOTIFICATIONS_GROUP,
        {
            "type": "admin.notification",
            "event": event_type,
            "payload": payload,
        },
    )


def list_online_guests():
    rows = (
        GuestPresence.objects.select_related("user")
        .filter(is_online=True, user__user_role__role=UserRole.ROLE_GUEST)
        .order_by("user__username")
    )
    return [
        {
            "user_id": row.user_id,
            "username": row.user.username,
            "is_online": row.is_online,
            "last_seen": row.last_seen.isoformat() if row.last_seen else None,
        }
        for row in rows
    ]


def mark_guest_connected(user):
    if not user or not user.is_authenticated:
        return

    presence, _ = GuestPresence.objects.get_or_create(user=user)
    was_online = presence.is_online
    presence.connection_count += 1
    presence.is_online = True
    presence.last_seen = timezone.now()
    presence.save(update_fields=["connection_count", "is_online", "last_seen"])

    # Notify only when transitioning from offline to online.
    if not was_online:
        _send_admin_event(
            "guest_online",
            {
                "user_id": user.id,
                "username": user.username,
                "is_online": True,
                "last_seen": presence.last_seen.isoformat(),
            },
        )


def mark_guest_disconnected(user):
    if not user or not user.is_authenticated:
        return

    presence, _ = GuestPresence.objects.get_or_create(user=user)
    if presence.connection_count > 0:
        presence.connection_count -= 1
    presence.is_online = presence.connection_count > 0
    presence.last_seen = timezone.now()
    presence.save(update_fields=["connection_count", "is_online", "last_seen"])

    if not presence.is_online:
        _send_admin_event(
            "guest_offline",
            {
                "user_id": user.id,
                "username": user.username,
                "is_online": False,
                "last_seen": presence.last_seen.isoformat(),
            },
        )


def send_guest_snapshot_to_admin():
    _send_admin_event(
        "guest_snapshot",
        {
            "online_guests": list_online_guests(),
        },
    )
