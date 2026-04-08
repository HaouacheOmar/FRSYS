# # from deepface import DeepFace as dp
# # import cv2
# # import os
# # from pathlib import Path
# # import logging

# # logger = logging.getLogger(__name__)

# # class FaceRecognitionService:
# #     """Service for face recognition using DeepFace"""
    
# #     def __init__(self, db_path, model_name="Facenet512"):
# #         """
# #         Initialize face recognition service
        
# #         Args:
# #             db_path: Path to face database directory
# #             model_name: DeepFace model name (Facenet512, VGG-Face, etc.)
# #         """
# #         self.db_path = db_path
# #         self.model_name = model_name
# #         self.distance_metric = "cosine"
        
# #         # Verify database path exists
# #         if not os.path.exists(db_path):
# #             logger.warning(f"Database path does not exist: {db_path}")
# #             logger.info(f"Creating database directory: {db_path}")
# #             os.makedirs(db_path, exist_ok=True)
        
# #         logger.info(f"Face Recognition Service initialized with model: {model_name}")
# #         logger.info(f"Database path: {db_path}")
        
# #     def recognize_face(self, image_array):
# #         """
# #         Recognize face in image
        
# #         Args:
# #             image_array: numpy array (BGR format from OpenCV)
        
# #         Returns:
# #             {
# #                 "success": bool,
# #                 "person_id": str (if found),
# #                 "confidence": float (if found),
# #                 "message": str
# #             }
# #         """
# #         try:
# #             logger.info("Starting face recognition...")
            
# #             # Find face in database
# #             result = dp.find(
# #                 img_path=image_array,
# #                 db_path=self.db_path,
# #                 model_name=self.model_name,
# #                 distance_metric=self.distance_metric,
# #                 enforce_detection=True,
# #                 silent=True
# #             )
            
# #             if len(result) > 0 and len(result[0]) > 0:
# #                 best_match = result[0].iloc[0]
# #                 person_id = Path(best_match['identity']).stem
                
# #                 # Convert distance to confidence (0-1 scale)
# #                 # Lower distance = higher confidence
# #                 distance = best_match['distance']
# #                 confidence = 1 - distance if distance < 1 else 0
                
# #                 logger.info(f"Face recognized: {person_id} (confidence: {confidence:.2f})")
                
# #                 return {
# #                     "success": True,
# #                     "person_id": person_id,
# #                     "confidence": float(confidence),
# #                     "distance": float(distance),
# #                     "message": f"Face recognized as {person_id}"
# #                 }
# #             else:
# #                 logger.info("No face match found in database")
# #                 return {
# #                     "success": False,
# #                     "message": "No matching face found in database"
# #                 }
                
# #         except ValueError as e:
# #             # No face detected in image
# #             logger.warning(f"No face detected: {str(e)}")
# #             return {
# #                 "success": False,
# #                 "message": "No face detected in image"
# #             }
            
# #         except Exception as e:
# #             logger.error(f"Recognition error: {str(e)}")
# #             return {
# #                 "success": False,
# #                 "message": f"Recognition error: {str(e)}"
# #             }
    
# #     def register_face(self, person_id, image_array):
# #         """
# #         Register a new face to the database
        
# #         Args:
# #             person_id: Unique identifier for the person
# #             image_array: numpy array (BGR format from OpenCV)
        
# #         Returns:
# #             {
# #                 "success": bool,
# #                 "message": str,
# #                 "path": str (if successful)
# #             }
# #         """
# #         try:
# #             logger.info(f"Registering face for: {person_id}")
            
# #             # Verify face is detectable in image
# #             try:
# #                 dp.extract_faces(
# #                     img_path=image_array,
# #                     enforce_detection=True
# #                 )
# #             except Exception as e:
# #                 logger.warning(f"No face detected in registration image: {str(e)}")
# #                 return {
# #                     "success": False,
# #                     "message": "No face detected in image. Please provide a clear photo with a visible face."
# #                 }
            
# #             # Save image to database path
# #             save_path = os.path.join(self.db_path, f"{person_id}.jpg")
            
# #             # Check if person already exists
# #             if os.path.exists(save_path):
# #                 logger.warning(f"Person {person_id} already exists, overwriting...")
            
# #             cv2.imwrite(save_path, image_array)
            
# #             logger.info(f"Face registered successfully at: {save_path}")
            
# #             return {
# #                 "success": True,
# #                 "message": f"Face registered successfully for {person_id}",
# #                 "path": save_path
# #             }
            
# #         except Exception as e:
# #             logger.error(f"Registration error: {str(e)}")
# #             return {
# #                 "success": False,
# #                 "message": f"Registration error: {str(e)}"
# #             }
    
# #     def delete_face(self, person_id):
# #         """
# #         Delete a face from the database
        
# #         Args:
# #             person_id: Unique identifier for the person
        
# #         Returns:
# #             {
# #                 "success": bool,
# #                 "message": str
# #             }
# #         """
# #         try:
# #             file_path = os.path.join(self.db_path, f"{person_id}.jpg")
            
# #             if os.path.exists(file_path):
# #                 os.remove(file_path)
# #                 logger.info(f"Deleted face for: {person_id}")
# #                 return {
# #                     "success": True,
# #                     "message": f"Face deleted for {person_id}"
# #                 }
# #             else:
# #                 logger.warning(f"Face not found for: {person_id}")
# #                 return {
# #                     "success": False,
# #                     "message": f"No face found for {person_id}"
# #                 }
                
# #         except Exception as e:
# #             logger.error(f"Deletion error: {str(e)}")
# #             return {
# #                 "success": False,
# #                 "message": f"Deletion error: {str(e)}"
# #             }



# import cv2
# import os
# import numpy as np
# from pathlib import Path
# import logging
# import insightface
# from insightface.app import FaceAnalysis

# logger = logging.getLogger(__name__)

# # Initialize single global InsightFace instance to avoid loading model multiple times
# app = FaceAnalysis(name='buffalo_l', providers=['CUDAExecutionProvider', 'CPUExecutionProvider'])
# app.prepare(ctx_id=0, det_size=(640, 640))

# class FaceRecognitionService:
#     def __init__(self, db_path):
#         self.db_path = db_path
#         self.known_faces = {}
#         self.similarity_threshold = 0.45
        
#         if not os.path.exists(db_path):
#             os.makedirs(db_path, exist_ok=True)
            
#         self._load_database()
        
#     def _load_database(self):
#         """Pre-calculate embeddings for faster matching"""
#         for filename in os.listdir(self.db_path):
#             if filename.lower().endswith(('.jpg', '.png', '.jpeg')):
#                 img_path = os.path.join(self.db_path, filename)
#                 img = cv2.imread(img_path)
#                 if img is not None:
#                     faces = app.get(img)
#                     if faces:
#                         person_id = Path(filename).stem
#                         self.known_faces[person_id] = faces[0].normed_embedding

#     def recognize_face(self, image_array):
#         try:
#             faces = app.get(image_array)
#             if not faces:
#                 return {"success": False, "message": "No face detected in image"}
            
#             # Take the most prominent face
#             target_embedding = faces[0].normed_embedding
            
#             best_match = None
#             best_sim = -1
            
#             for person_id, db_embedding in self.known_faces.items():
#                 sim = np.dot(target_embedding, db_embedding)
#                 if sim > best_sim:
#                     best_sim = sim
#                     best_match = person_id
            
#             if best_match and best_sim >= self.similarity_threshold:
#                 # Convert similarity back to a confidence percentage
#                 confidence = float(best_sim) 
#                 return {
#                     "success": True,
#                     "person_id": best_match,
#                     "confidence": confidence,
#                     "message": f"Face recognized as {best_match}"
#                 }
#             else:
#                 return {"success": False, "message": "No matching face found"}
                
#         except Exception as e:
#             logger.error(f"Recognition error: {str(e)}")
#             return {"success": False, "message": f"Error: {str(e)}"}
    
#     def register_face(self, person_id, image_array):
#         try:
#             faces = app.get(image_array)
#             if not faces:
#                 return {"success": False, "message": "No clear face detected."}
                
#             # Save the image physically
#             save_path = os.path.join(self.db_path, f"{person_id}.jpg")
#             cv2.imwrite(save_path, image_array)
            
#             # Add to live memory cache immediately!
#             self.known_faces[person_id] = faces[0].normed_embedding
            
#             return {
#                 "success": True,
#                 "message": f"Face registered successfully for {person_id}",
#                 "path": save_path
#             }
            
#         except Exception as e:
#             return {"success": False, "message": f"Registration error: {str(e)}"}
            
#     def delete_face(self, person_id):
#         try:
#             file_path = os.path.join(self.db_path, f"{person_id}.jpg")
#             if os.path.exists(file_path):
#                 os.remove(file_path)
            
#             # Remove from live memory cache
#             if person_id in self.known_faces:
#                 del self.known_faces[person_id]
                
#             return {"success": True, "message": f"Face deleted for {person_id}"}
#         except Exception as e:
#             return {"success": False, "message": str(e)}








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
        
        # Verify database path exists
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

                # Determine identity: use top-level subfolder name if present,
                # otherwise use the filename stem.
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
            
            # Extract faces from input image
            faces = self.app.get(image_array)
            
            if not faces:
                logger.info("No face match found in database")
                return {
                    "success": False,
                    "message": "No face detected in image"
                }
            
            # Assume the most prominent face is the target
            target_embedding = faces[0].normed_embedding
            best_match = None
            best_sim = -1.0
            
            # Compare against known faces using dot product (cosine similarity
            # for normalized vectors). Each identity may have multiple
            # reference embeddings; take the best match across all of them.
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
                    "distance": float(1.0 - best_sim), # Included to prevent breaking old client code
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
        """Register a new face to the database"""
        try:
            logger.info(f"Registering face for: {person_id}")
            
            # Verify face is detectable and get embedding
            faces = self.app.get(image_array)
            if not faces:
                logger.warning(f"No face detected in registration image")
                return {
                    "success": False,
                    "message": "No face detected in image. Please provide a clear photo."
                }
            
            # Save image to database path under a subfolder named after person_id
            person_dir = os.path.join(self.db_path, person_id)
            os.makedirs(person_dir, exist_ok=True)
            save_path = os.path.join(person_dir, f"{person_id}_{int(time.time())}.jpg")
            cv2.imwrite(save_path, image_array)

            # Update live memory cache immediately (append embedding)
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
        """Delete a face from the database"""
        try:
            # Try removing a person directory first (for multi-image identities)
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
                # Fallback: single-file identity in DB root
                file_path = os.path.join(self.db_path, f"{person_id}.jpg")
                if os.path.exists(file_path):
                    try:
                        os.remove(file_path)
                    except Exception:
                        pass

            # Remove from live memory cache
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