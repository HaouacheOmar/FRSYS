import hmac
import logging
import os

import cv2
import numpy as np
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile

from services.face_recognition import FaceRecognitionService

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Only Django calls this server (server to server), so there is no CORS: browsers have no
# business here. Keep it on localhost/an internal network.
app = FastAPI(title="Face Recognition Model Server", version="1.0.0")

# Same folder as Django's PHOTOS_BASE_DIR: <FACE_DB_PATH>/<mat>/main.jpg
DB_PATH = os.environ.get("FACE_DB_PATH", "/data/faces")
logger.info(f"Face DB path: {DB_PATH}")

# Optional shared secret with Django (MODEL_SERVER_TOKEN in both .env files).
MODEL_SERVER_TOKEN = os.environ.get("MODEL_SERVER_TOKEN", "").strip()


def require_token(x_model_token: str = Header(default="")):
    if MODEL_SERVER_TOKEN and not hmac.compare_digest(x_model_token, MODEL_SERVER_TOKEN):
        raise HTTPException(status_code=401, detail="Invalid model server token")


face_service = FaceRecognitionService(
    db_path=DB_PATH,
    model_name="buffalo_l"
)


@app.get("/health")
async def health_check():
    return {"status": "healthy", "model": "InsightFace (buffalo_l)", "identities": len(face_service.known_faces)}


@app.post("/api/detect", dependencies=[Depends(require_token)])
def detect_faces(file: UploadFile = File(...)):
    """All faces in a frame with boxes and matches (Django's live stream calls this).

    Plain `def`: FastAPI runs it in a worker thread, so the model doesn't block the event loop.
    """
    image = cv2.imdecode(np.frombuffer(file.file.read(), np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(status_code=400, detail="Invalid image")
    return {"faces": face_service.detect_and_match(image)}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=os.environ.get("MODEL_SERVER_HOST", "127.0.0.1"), port=5000, log_level="info")
