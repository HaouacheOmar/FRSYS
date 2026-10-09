import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings


ENCRYPTED_PREFIX = "enc::"


def _get_fernet_key():
    raw = getattr(settings, "CAMERA_CREDENTIALS_KEY", "") or ""
    raw = raw.strip()
    if raw:
        return raw.encode("utf-8")

    secret = (getattr(settings, "SECRET_KEY", "") or "").encode("utf-8")
    digest = hashlib.sha256(secret).digest()
    return base64.urlsafe_b64encode(digest)


def _fernet():
    return Fernet(_get_fernet_key())


def encrypt_text(value):
    if value in (None, ""):
        return ""
    token = _fernet().encrypt(str(value).encode("utf-8")).decode("utf-8")
    return f"{ENCRYPTED_PREFIX}{token}"


def decrypt_text(value):
    if value in (None, ""):
        return ""
    if not str(value).startswith(ENCRYPTED_PREFIX):
        return str(value)

    token = str(value)[len(ENCRYPTED_PREFIX):]
    try:
        return _fernet().decrypt(token.encode("utf-8")).decode("utf-8")
    except InvalidToken:
        # Keep service usable if key rotated without migration; caller can still inspect value.
        return ""
