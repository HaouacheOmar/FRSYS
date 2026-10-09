"""HTTP client for MODEL_SERVER, which owns the InsightFace model and the face embeddings."""
import logging

import cv2
import numpy as np
import requests
from django.conf import settings

logger = logging.getLogger(__name__)

# One kept-alive connection: the stream calls detect() for every processed frame.
_session = requests.Session()
DETECT_TIMEOUT_SEC = 5


class ModelServerError(RuntimeError):
    pass


def _base_url():
    return settings.MODEL_SERVER_URL.rstrip('/')


def health_check() -> bool:
    try:
        return _session.get(f"{_base_url()}/health", timeout=5).status_code == 200
    except requests.RequestException as e:
        logger.warning(f"Model server health check failed: {e}")
        return False


def detect(image: np.ndarray) -> list:
    """All faces in a BGR frame: [{"bbox": [x1, y1, x2, y2], "person_id": str | None, "similarity": float}].

    Raises ModelServerError when the model server is down or answers with an error, so the
    stream can show it instead of silently reporting "no faces".
    """
    ok, jpeg = cv2.imencode('.jpg', image)
    if not ok:
        raise ModelServerError("Could not encode frame")
    try:
        response = _session.post(
            f"{_base_url()}/api/detect",
            files={'file': ('frame.jpg', jpeg.tobytes(), 'image/jpeg')},
            headers={'X-Model-Token': settings.MODEL_SERVER_TOKEN},
            timeout=DETECT_TIMEOUT_SEC,
        )
        response.raise_for_status()
        return response.json()['faces']
    except (requests.RequestException, ValueError, KeyError) as e:
        raise ModelServerError(f"Model server unavailable: {e}") from e
