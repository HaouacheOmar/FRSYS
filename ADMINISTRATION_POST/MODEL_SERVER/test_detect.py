"""Check /api/detect with a fake InsightFace model. Run: python test_detect.py (from MODEL_SERVER)."""
import io
import sys
import tempfile
import types
import unittest
from unittest import mock

import cv2
import numpy as np


def unit(v):
    v = np.asarray(v, dtype=np.float32)
    return v / np.linalg.norm(v)


class FakeFaceAnalysis:
    """Two faces in every image: one looks like person A, one like nobody."""

    def __init__(self, **kwargs):
        pass

    def prepare(self, **kwargs):
        pass

    def get(self, img):
        return [
            types.SimpleNamespace(bbox=np.array([10.4, 20.6, 50.0, 80.0]), normed_embedding=unit([1, 0.05, 0])),
            types.SimpleNamespace(bbox=np.array([100, 20, 140, 80]), normed_embedding=unit([0, 0, 1])),
        ]


class DetectEndpointTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        stub = types.ModuleType("insightface.app")
        stub.FaceAnalysis = FakeFaceAnalysis
        cls.patcher = mock.patch.dict(sys.modules, {"insightface": types.ModuleType("insightface"), "insightface.app": stub})
        cls.patcher.start()
        cls.tmp = tempfile.TemporaryDirectory()  # empty face DB; embeddings are injected below
        with mock.patch.dict("os.environ", {"FACE_DB_PATH": cls.tmp.name, "DJANGO_SERVER_URL": "http://127.0.0.1:9"}):
            import app as app_module
        cls.app = app_module
        cls.app.face_service.known_faces = {"A": [unit([0, 1, 0]), unit([1, 0, 0])], "B": [unit([0, 1, 0])]}

    @classmethod
    def tearDownClass(cls):
        cls.patcher.stop()
        cls.tmp.cleanup()

    def test_returns_every_face_with_box_and_best_match(self):
        _, jpeg = cv2.imencode(".jpg", np.zeros((120, 160, 3), np.uint8))
        upload = types.SimpleNamespace(file=io.BytesIO(jpeg.tobytes()))

        faces = self.app.detect_faces(upload)["faces"]

        self.assertEqual(len(faces), 2)
        self.assertEqual(faces[0]["bbox"], [10, 20, 50, 80])
        self.assertEqual(faces[0]["person_id"], "A")  # matched on A's second photo
        self.assertIsNone(faces[1]["person_id"])  # below threshold for everyone

    def test_invalid_image_is_400(self):
        from fastapi import HTTPException

        with self.assertRaises(HTTPException) as ctx:
            self.app.detect_faces(types.SimpleNamespace(file=io.BytesIO(b"not an image")))
        self.assertEqual(ctx.exception.status_code, 400)


if __name__ == "__main__":
    unittest.main()
