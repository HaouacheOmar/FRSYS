from deepface import DeepFace as dp
import cv2
import os
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

class FaceRecognitionService:
    """Service for face recognition using DeepFace"""
    
    def __init__(self, db_path, model_name="Facenet512"):
        """
        Initialize face recognition service
        
        Args:
            db_path: Path to face database directory
            model_name: DeepFace model name (Facenet512, VGG-Face, etc.)
        """
        self.db_path = db_path
        self.model_name = model_name
        self.distance_metric = "cosine"
        
        # Verify database path exists
        if not os.path.exists(db_path):
            logger.warning(f"Database path does not exist: {db_path}")
            logger.info(f"Creating database directory: {db_path}")
            os.makedirs(db_path, exist_ok=True)
        
        logger.info(f"Face Recognition Service initialized with model: {model_name}")
        logger.info(f"Database path: {db_path}")
        
    def recognize_face(self, image_array):
        """
        Recognize face in image
        
        Args:
            image_array: numpy array (BGR format from OpenCV)
        
        Returns:
            {
                "success": bool,
                "person_id": str (if found),
                "confidence": float (if found),
                "message": str
            }
        """
        try:
            logger.info("Starting face recognition...")
            
            # Find face in database
            result = dp.find(
                img_path=image_array,
                db_path=self.db_path,
                model_name=self.model_name,
                distance_metric=self.distance_metric,
                enforce_detection=True,
                silent=True
            )
            
            if len(result) > 0 and len(result[0]) > 0:
                best_match = result[0].iloc[0]
                person_id = Path(best_match['identity']).stem
                
                # Convert distance to confidence (0-1 scale)
                # Lower distance = higher confidence
                distance = best_match['distance']
                confidence = 1 - distance if distance < 1 else 0
                
                logger.info(f"Face recognized: {person_id} (confidence: {confidence:.2f})")
                
                return {
                    "success": True,
                    "person_id": person_id,
                    "confidence": float(confidence),
                    "distance": float(distance),
                    "message": f"Face recognized as {person_id}"
                }
            else:
                logger.info("No face match found in database")
                return {
                    "success": False,
                    "message": "No matching face found in database"
                }
                
        except ValueError as e:
            # No face detected in image
            logger.warning(f"No face detected: {str(e)}")
            return {
                "success": False,
                "message": "No face detected in image"
            }
            
        except Exception as e:
            logger.error(f"Recognition error: {str(e)}")
            return {
                "success": False,
                "message": f"Recognition error: {str(e)}"
            }
    
    def register_face(self, person_id, image_array):
        """
        Register a new face to the database
        
        Args:
            person_id: Unique identifier for the person
            image_array: numpy array (BGR format from OpenCV)
        
        Returns:
            {
                "success": bool,
                "message": str,
                "path": str (if successful)
            }
        """
        try:
            logger.info(f"Registering face for: {person_id}")
            
            # Verify face is detectable in image
            try:
                dp.extract_faces(
                    img_path=image_array,
                    enforce_detection=True
                )
            except Exception as e:
                logger.warning(f"No face detected in registration image: {str(e)}")
                return {
                    "success": False,
                    "message": "No face detected in image. Please provide a clear photo with a visible face."
                }
            
            # Save image to database path
            save_path = os.path.join(self.db_path, f"{person_id}.jpg")
            
            # Check if person already exists
            if os.path.exists(save_path):
                logger.warning(f"Person {person_id} already exists, overwriting...")
            
            cv2.imwrite(save_path, image_array)
            
            logger.info(f"Face registered successfully at: {save_path}")
            
            return {
                "success": True,
                "message": f"Face registered successfully for {person_id}",
                "path": save_path
            }
            
        except Exception as e:
            logger.error(f"Registration error: {str(e)}")
            return {
                "success": False,
                "message": f"Registration error: {str(e)}"
            }
    
    def delete_face(self, person_id):
        """
        Delete a face from the database
        
        Args:
            person_id: Unique identifier for the person
        
        Returns:
            {
                "success": bool,
                "message": str
            }
        """
        try:
            file_path = os.path.join(self.db_path, f"{person_id}.jpg")
            
            if os.path.exists(file_path):
                os.remove(file_path)
                logger.info(f"Deleted face for: {person_id}")
                return {
                    "success": True,
                    "message": f"Face deleted for {person_id}"
                }
            else:
                logger.warning(f"Face not found for: {person_id}")
                return {
                    "success": False,
                    "message": f"No face found for {person_id}"
                }
                
        except Exception as e:
            logger.error(f"Deletion error: {str(e)}")
            return {
                "success": False,
                "message": f"Deletion error: {str(e)}"
            }
