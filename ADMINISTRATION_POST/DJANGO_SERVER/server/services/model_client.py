import requests
import cv2
import numpy as np
from typing import Dict, Optional
import logging
from django.conf import settings

logger = logging.getLogger(__name__)

class ModelServerClient:
    """Client for communicating with the Model Server"""
    
    def __init__(self, model_server_url: str = None):
        """
        Initialize Model Server client
        
        Args:
            model_server_url: URL of the model server (default from settings)
        """
        self.base_url = (model_server_url or 
                        getattr(settings, 'MODEL_SERVER_URL', 'http://localhost:5000')).rstrip('/')
        logger.info(f"Model Server Client initialized: {self.base_url}")
        
    def health_check(self) -> bool:
        """
        Check if model server is available
        
        Returns:
            True if server is healthy, False otherwise
        """
        try:
            response = requests.get(f"{self.base_url}/health", timeout=5)
            if response.status_code == 200:
                logger.info("Model server health check: OK")
                return True
            else:
                logger.warning(f"Model server health check failed: {response.status_code}")
                return False
        except Exception as e:
            logger.error(f"Model server health check failed: {e}")
            return False
    
    def recognize_face(self, image: np.ndarray) -> Dict:
        """
        Send image to model server for recognition
        
        Args:
            image: numpy array (BGR format from OpenCV)
            
        Returns:
            {
                "success": bool,
                "person_id": str (if found),
                "confidence": float (if found),
                "message": str
            }
        """
        try:
            # Convert image to bytes
            _, img_encoded = cv2.imencode('.jpg', image)
            
            # Send to model server
            files = {'file': ('image.jpg', img_encoded.tobytes(), 'image/jpeg')}
            response = requests.post(
                f"{self.base_url}/api/recognize",
                files=files,
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json()
                if result.get('success'):
                    logger.info(f"Face recognized: {result.get('person_id')}")
                return result
            else:
                logger.error(f"Model server error: {response.status_code}")
                return {
                    "success": False,
                    "message": f"Model server error: {response.status_code}"
                }
                
        except Exception as e:
            logger.error(f"Face recognition request failed: {e}")
            return {
                "success": False,
                "message": f"Request failed: {str(e)}"
            }
    
    def register_face(self, person_id: str, image: np.ndarray) -> Dict:
        """
        Register a new face in the model database
        
        Args:
            person_id: Unique identifier for the person
            image: numpy array (BGR format from OpenCV)
            
        Returns:
            {
                "success": bool,
                "message": str,
                "path": str (if successful)
            }
        """
        try:
            # Convert image to bytes
            _, img_encoded = cv2.imencode('.jpg', image)
            
            files = {'file': ('image.jpg', img_encoded.tobytes(), 'image/jpeg')}
            params = {'person_id': person_id}
            
            response = requests.post(
                f"{self.base_url}/api/register",
                files=files,
                params=params,
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json()
                if result.get('success'):
                    logger.info(f"Face registered: {person_id}")
                return result
            else:
                logger.error(f"Registration failed: {response.status_code}")
                return {
                    "success": False,
                    "message": f"Registration failed: {response.status_code}"
                }
                
        except Exception as e:
            logger.error(f"Face registration failed: {e}")
            return {
                "success": False,
                "message": f"Request failed: {str(e)}"
            }
    
    def recognize_batch(self, images: list) -> Dict:
        """
        Recognize multiple faces in batch
        
        Args:
            images: List of numpy arrays (BGR format)
            
        Returns:
            {
                "results": [...],
                "total": int
            }
        """
        try:
            files = []
            for i, image in enumerate(images):
                _, img_encoded = cv2.imencode('.jpg', image)
                files.append(
                    ('files', (f'image_{i}.jpg', img_encoded.tobytes(), 'image/jpeg'))
                )
            
            response = requests.post(
                f"{self.base_url}/api/recognize/batch",
                files=files,
                timeout=60
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                return {
                    "success": False,
                    "message": f"Batch recognition failed: {response.status_code}"
                }
                
        except Exception as e:
            logger.error(f"Batch recognition failed: {e}")
            return {
                "success": False,
                "message": f"Request failed: {str(e)}"
            }
