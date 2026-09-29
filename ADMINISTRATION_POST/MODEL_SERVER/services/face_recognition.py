
import cv2
import os
from pathlib import Path
import logging
import numpy as np
import time
import insightface
from insightface.app import FaceAnalysis

logger = logging.getLogger(__name__)

class FaceRecognitionService:
    """Service for face recognition using InsightFace"""
    
    def __init__(self, db_path, model_name="buffalo_l", threshold=0.45):
        """
        Initialize face recognition service
        """
        self.db_path = db_path
        self.model_name = model_name
        self.threshold = threshold
        self.known_faces = {}
        print('dbpqth : ',db_path)
        
        if not os.path.exists(db_path):
            logger.warning(f"Database path does not exist: {db_path}")
            logger.info(f"Creating database directory: {db_path}")
            os.makedirs(db_path, exist_ok=True)
            
        # Initialize InsightFace
        logger.info(f"Initializing InsightFace model: {model_name}")
        self.app = FaceAnalysis(name=model_name)
        # ctx_id=0 uses GPU. Set to -1 to force CPU.
        self.app.prepare(ctx_id=-1, det_size=(640, 640))
        
        self._load_database()
        
        logger.info(f"Face Recognition Service initialized with model: {model_name}")
        logger.info(f"Database path: {db_path}")

    def _load_database(self):
        """Extract and cache embeddings from the image directory 

        """
        logger.info("Loading face database into memory...")
        for root, dirs, files in os.walk(self.db_path):
            for filename in files:
                if not filename.lower().endswith(('.jpg', '.jpeg', '.png')):
                    continue

                img_path = os.path.join(root, filename)
                img = cv2.imread(img_path)
                if img is None:
                    continue

                faces = self.app.get(img)
                if not faces:
                    continue

                embedding = faces[0].normed_embedding

                rel = os.path.relpath(root, self.db_path)
                if rel == '.' or rel == '':
                    person_id = Path(filename).stem
                else:
                    person_id = Path(rel).parts[0]

                self.known_faces.setdefault(person_id, []).append(embedding)

        total_images = sum(len(v) for v in self.known_faces.values())
        logger.info(f"Loaded {len(self.known_faces)} identities and {total_images} images into memory.")

    def recognize_face(self, image_array):
        """Recognize face in image"""
        try:
            logger.info("Starting face recognition...")
            
            faces = self.app.get(image_array)
            
            if not faces:
                logger.info("No face match found in database")
                return {
                    "success": False,
                    "message": "No face detected in image"
                }
            
            target_embedding = faces[0].normed_embedding
            best_match = None
            best_sim = -1.0

            for person_id, db_embeddings in self.known_faces.items():
                for db_embedding in db_embeddings:
                    sim = np.dot(target_embedding, db_embedding)
                    if sim > best_sim:
                        best_sim = sim
                        best_match = person_id
            
            if best_match and best_sim >= self.threshold:
                logger.info(f"Face recognized: {best_match} (confidence: {best_sim:.2f})")
                return {
                    "success": True,
                    "person_id": best_match,
                    "confidence": float(best_sim),
                    "distance": float(1.0 - best_sim), 
                    "message": f"Face recognized as {best_match}"
                }
            else:
                logger.info("No face match found above threshold")
                return {
                    "success": False,
                    "message": "No matching face found in database"
                }
                
        except Exception as e:
            logger.error(f"Recognition error: {str(e)}")
            return {
                "success": False,
                "message": f"Recognition error: {str(e)}"
            }
    
    def register_face(self, person_id, image_array):
        try:
            logger.info(f"Registering face for: {person_id}")
      
            faces = self.app.get(image_array)
            if not faces:
                logger.warning(f"No face detected in registration image")
                return {
                    "success": False,
                    "message": "No face detected in image. Please provide a clear photo."
                }
            
     
            person_dir = os.path.join(self.db_path, person_id)
            os.makedirs(person_dir, exist_ok=True)
            save_path = os.path.join(person_dir, f"{person_id}_{int(time.time())}.jpg")
            cv2.imwrite(save_path, image_array)

            self.known_faces.setdefault(person_id, []).append(faces[0].normed_embedding)
            
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
        try:
            person_dir = os.path.join(self.db_path, person_id)
            if os.path.exists(person_dir) and os.path.isdir(person_dir):
                for f in os.listdir(person_dir):
                    try:
                        os.remove(os.path.join(person_dir, f))
                    except Exception:
                        pass
                try:
                    os.rmdir(person_dir)
                except Exception:
                    pass
            else:
                file_path = os.path.join(self.db_path, f"{person_id}.jpg")
                if os.path.exists(file_path):
                    try:
                        os.remove(file_path)
                    except Exception:
                        pass

            if person_id in self.known_faces:
                del self.known_faces[person_id]
                
            logger.info(f"Deleted face for: {person_id}")
            return {
                "success": True,
                "message": f"Face deleted for {person_id}"
            }
                
        except Exception as e:
            logger.error(f"Deletion error: {str(e)}")
            return {
                "success": False,
                "message": f"Deletion error: {str(e)}"
            }