from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import cv2
import numpy as np
from services.face_recognition import FaceRecognitionService
import io
from PIL import Image
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Face Recognition Model Server", version="1.0.0")

# CORS configuration - Allow Django server to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8000", "http://127.0.0.1:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize face recognition service
# Update DB_PATH to your actual face database location
DB_PATH = r"C:\Users\youne\OneDrive\Desktop\test_photos"

face_service = FaceRecognitionService(
    db_path=DB_PATH,
    model_name="Facenet512"
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
        "model": "Facenet512",
        "db_path": DB_PATH
    }

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
        
        # Read image
        image_bytes = await file.read()
        image = Image.open(io.BytesIO(image_bytes))
        image_array = np.array(image)
        
        # Convert RGB to BGR if needed (OpenCV uses BGR)
        if len(image_array.shape) == 3 and image_array.shape[2] == 3:
            image_array = cv2.cvtColor(image_array, cv2.COLOR_RGB2BGR)
        
        # Perform recognition
        result = face_service.recognize_face(image_array)
        
        logger.info(f"Recognition result: {result}")
        return result
        
    except Exception as e:
        logger.error(f"Recognition error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/recognize/batch")
async def recognize_faces_batch(files: list[UploadFile] = File(...)):
    """
    Recognize multiple faces in batch
    
    Returns:
        {
            "results": [...]
        }
    """
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
    """
    Register a new face to the database
    
    Args:
        person_id: Unique identifier for the person
        file: Image file containing the face
    
    Returns:
        {
            "success": bool,
            "message": str,
            "path": str (if successful)
        }
    """
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
    
    logger.info("Starting Face Recognition Model Server...")
    logger.info(f"Database path: {DB_PATH}")
    
    # Run on localhost only (not exposed to network)
    uvicorn.run(
        app,
        host="127.0.0.1",  # localhost only for security
        port=5000,
        log_level="info"
    )
