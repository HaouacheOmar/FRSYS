
import cv2
import os
import re
from pathlib import Path
import logging
import numpy as np
from insightface.app import FaceAnalysis

logger = logging.getLogger(__name__)

# Folder Django creates for each photos zip uploaded from the admin page (views.config_photo_path_view).
UPLOAD_FOLDER = re.compile(r'photos_\d{14}')

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

    def _identity(self, folder, filename):
        """Identity (= matricule) of a photo: the folder that directly contains it, e.g.
        <db>/<mat>/main.jpg, or <db>/photos_<timestamp>/<mat>/main.jpg for a zip uploaded from
        the admin page. Photos lying loose in the root or in an upload folder are named by
        file: <db>/<mat>.jpg.
        """
        parent = Path(folder)
        if parent == Path(self.db_path) or UPLOAD_FOLDER.fullmatch(parent.name):
            return Path(filename).stem
        return parent.name

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

                self.known_faces.setdefault(self._identity(root, filename), []).append(embedding)

        total_images = sum(len(v) for v in self.known_faces.values())
        logger.info(f"Loaded {len(self.known_faces)} identities and {total_images} images into memory.")

    def detect_and_match(self, image_array):
        """Every face in the image: its box and the best-matching identity above threshold.

        Returns [{"bbox": [x1, y1, x2, y2], "person_id": str | None, "similarity": float}].
        Used by Django's live stream, which needs all faces with positions, not just the first.
        """
        results = []
        for face in self.app.get(image_array):
            best_match, best_sim = None, -1.0
            for person_id, db_embeddings in self.known_faces.items():
                sim = max(float(np.dot(face.normed_embedding, e)) for e in db_embeddings)
                if sim > best_sim:
                    best_match, best_sim = person_id, sim
            results.append({
                "bbox": [int(v) for v in face.bbox],
                "person_id": best_match if best_sim >= self.threshold else None,
                "similarity": best_sim,
            })
        return results
