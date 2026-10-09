from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import cv2
import numpy as np
from services.face_recognition import FaceRecognitionService
import io
from PIL import Image
import logging
import os
import requests
from dotenv import load_dotenv


load_dotenv()


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Face Recognition Model Server", version="1.0.0")

allowed_origins_str = os.environ.get("CORS_ALLOWED_ORIGINS", "*")
allowed_origins = [orig.strip() for orig in allowed_origins_str.split(',')] if allowed_origins_str != "*" else ["*"]


app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DEFAULT_DB_PATH = os.environ.get("FACE_DB_PATH", "/data/faces")  # same default as Django's PHOTOS_BASE_DIR

def resolve_db_path():
    django_url = os.environ.get("DJANGO_SERVER_URL", "http://localhost:8000").rstrip("/")
    endpoint = f"{django_url}/api/config/photo-path/"
    try:
        resp = requests.get(endpoint, timeout=2.0)
        if resp.status_code == 200:
            data = resp.json()
            if isinstance(data, dict):
                path = data.get("dir_path_photo")
                if path:
                    return path
    except Exception as exc:
        logger.debug(f"Could not fetch DB path from Django ({endpoint}): {exc}")
    return DEFAULT_DB_PATH


DB_PATH = resolve_db_path()

logger.info(f"Resolved DB_PATH: {DB_PATH}")


face_service = FaceRecognitionService(
    db_path=DB_PATH,
    model_name="buffalo_l"
)

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "Face Recognition Model Server",
        "version": "1.0.0",
        "status": "running",
        "endpoints": ["/health", "/api/recognize", "/api/register"]
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "Face Recognition Model Server",
        "model": "InsightFace (buffalo_l)", # Updated label
        "db_path": DB_PATH
    }

@app.post("/api/detect")
def detect_faces(file: UploadFile = File(...)):
    """All faces in a frame with boxes and matches (Django's live stream calls this).

    Plain `def`: FastAPI runs it in a worker thread, so the model doesn't block the event loop.
    """
    image = cv2.imdecode(np.frombuffer(file.file.read(), np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(status_code=400, detail="Invalid image")
    return {"faces": face_service.detect_and_match(image)}


@app.post("/api/recognize")
async def recognize_face(file: UploadFile = File(...)):
    """
    Recognize face from uploaded image
    
    Returns:
        {
            "success": bool,
            "person_id": str,
            "confidence": float,
            "message": str
        }
    """
    try:
        logger.info(f"Received recognition request for file: {file.filename}")
        
       
        image_bytes = await file.read()
        image = Image.open(io.BytesIO(image_bytes))
        image_array = np.array(image)
        
      
        if len(image_array.shape) == 3 and image_array.shape[2] == 3:
            image_array = cv2.cvtColor(image_array, cv2.COLOR_RGB2BGR)
        
   
        result = face_service.recognize_face(image_array)
        
        logger.info(f"Recognition result: {result}")
        return result
        
    except Exception as e:
        logger.error(f"Recognition error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/recognize/batch")
async def recognize_faces_batch(files: list[UploadFile] = File(...)):

    results = []
    
    for file in files:
        try:
            image_bytes = await file.read()
            image = Image.open(io.BytesIO(image_bytes))
            image_array = np.array(image)
            
            if len(image_array.shape) == 3 and image_array.shape[2] == 3:
                image_array = cv2.cvtColor(image_array, cv2.COLOR_RGB2BGR)
            
            result = face_service.recognize_face(image_array)
            results.append(result)
            
        except Exception as e:
            logger.error(f"Batch recognition error for {file.filename}: {str(e)}")
            results.append({
                "success": False,
                "message": str(e),
                "filename": file.filename
            })
    
    return {"results": results, "total": len(results)}

@app.post("/api/register")
async def register_face(person_id: str, file: UploadFile = File(...)):

    try:
        logger.info(f"Registering face for person_id: {person_id}")
        
        image_bytes = await file.read()
        image = Image.open(io.BytesIO(image_bytes))
        image_array = np.array(image)
        
        if len(image_array.shape) == 3 and image_array.shape[2] == 3:
            image_array = cv2.cvtColor(image_array, cv2.COLOR_RGB2BGR)
        
        result = face_service.register_face(person_id, image_array)
        
        logger.info(f"Registration result: {result}")
        return result
        
    except Exception as e:
        logger.error(f"Registration error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=5000, log_level="info")
