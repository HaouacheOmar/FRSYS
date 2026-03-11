# Client-Server Architecture Guide for Face Recognition System

## Overview

This guide explains how to convert your current monolithic application into a distributed client-server architecture with:

1. **Client Application** (React Frontend) - Runs on **Surveillance Post PCs**
2. **Application Server** (Django API Server) - Runs on **Administration Post PC**
3. **Database Server** (PostgreSQL/MySQL) - Hosted on **Administration Post PC**
4. **Model Server** (Face Recognition Model Hosting) - Runs on **Administration Post PC**

---

## Deployment Scenario

### Physical Setup

```
┌─────────────────────────────────────────────────────────────┐
│                    SURVEILLANCE POSTS                        │
│  (Multiple PCs - Video Streaming Stations)                  │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Surveillance │  │ Surveillance │  │ Surveillance │     │
│  │   Post #1    │  │   Post #2    │  │   Post #3    │     │
│  │              │  │              │  │              │     │
│  │ React Client │  │ React Client │  │ React Client │     │
│  │   + Camera   │  │   + Camera   │  │   + Camera   │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│         │                  │                  │              │
└─────────┼──────────────────┼──────────────────┼──────────────┘
          │                  │                  │
          │    Local Network (LAN)              │
          │                  │                  │
┌─────────┼──────────────────┼──────────────────┼──────────────┐
│         ▼                  ▼                  ▼              │
│                 ADMINISTRATION POST PC                       │
│         (Central Server - All Backend Services)              │
│                                                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │  Django Application Server (Port 8000)             │     │
│  │  - REST API                                        │     │
│  │  - WebSocket Handler                               │     │
│  │  - Business Logic                                  │     │
│  └─────────────┬──────────────────────┬───────────────┘     │
│                │                      │                      │
│                ▼                      ▼                      │
│  ┌─────────────────────┐  ┌──────────────────────┐         │
│  │  PostgreSQL/MySQL   │  │  Model Server        │         │
│  │  Database           │  │  (Face Recognition)  │         │
│  │  (Port 5432/3306)   │  │  (Port 5000)         │         │
│  └─────────────────────┘  └──────────────────────┘         │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## Architecture Components

```
SURVEILLANCE POST PCs:
┌─────────────────┐
│  React Client   │  (Port 3000 or Built Static)
│  (FRSYS_FRONT)  │  - Video Stream Display
│                 │  - Face Recognition Results
│                 │  - Camera Interface
└────────┬────────┘
         │ HTTP/WebSocket (Over LAN)
         ▼
ADMINISTRATION POST PC:
┌─────────────────┐
│  Django API     │  (Port 8000)
│  Application    │  - REST API
│  Server         │  - WebSocket
└────┬────────────┘  - Business Logic
     │
     │ localhost SQL         │ localhost HTTP
     ▼                       ▼
┌─────────────┐      ┌──────────────────┐
│  Database   │      │  Model Server    │
│  Server     │      │  (Face Recog)    │
│  PostgreSQL │      │  (Port 5000)     │
└─────────────┘      └──────────────────┘
```

---

## Implementation Steps

### 1. Database Server Setup

#### Option A: PostgreSQL (Recommended for Production)

**Install PostgreSQL:**
```powershell
# Download from https://www.postgresql.org/download/windows/
# Or use Docker:
docker run --name frsys-db -e POSTGRES_PASSWORD=yourpassword -p 5432:5432 -d postgres
```

**Update Django settings.py:**
```python
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': 'frsys_db',
        'USER': 'frsys_user',
        'PASSWORD': 'your_secure_password',
        'HOST': 'localhost',  # Database on same PC (Administration Post)
        'PORT': '5432',
    }
}
```

**Install PostgreSQL adapter:**
```powershell
pip install psycopg2-binary
```

#### Option B: MySQL/MariaDB

**Update Django settings.py:**
```python
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.mysql',
        'NAME': 'frsys_db',
        'USER': 'frsys_user',
        'PASSWORD': 'your_secure_password',
        'HOST': 'localhost',  # Database on same PC (Administration Post)
        'PORT': '3306',
    }
}
```

**Install MySQL adapter:**
```powershell
pip install mysqlclient
```

---

### 2. Model Server Setup (Face Recognition)

Create a separate FastAPI/Flask server to host the face recognition model.

#### Create Model Server Directory

```
FRv1.0.1/
├── MODEL_SERVER/
│   ├── app.py
│   ├── requirements.txt
│   ├── services/
│   │   └── face_recognition.py
│   └── models/
│       └── (model weights)
```

#### MODEL_SERVER/app.py

```python
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import cv2
import numpy as np
from services.face_recognition import FaceRecognitionService
import io
from PIL import Image

app = FastAPI(title="Face Recognition Model Server")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure based on your Django server IP
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize face recognition service
face_service = FaceRecognitionService(
    db_path="path/to/face/database",
    model_name="Facenet512"
)

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "Face Recognition Model Server"}

@app.post("/api/recognize")
async def recognize_face(file: UploadFile = File(...)):
    """
    Recognize face from uploaded image
    Returns: {
        "success": bool,
        "person_id": str,
        "confidence": float,
        "bbox": [x, y, w, h]
    }
    """
    try:
        # Read image
        image_bytes = await file.read()
        image = Image.open(io.BytesIO(image_bytes))
        image_array = np.array(image)
        
        # Perform recognition
        result = face_service.recognize_face(image_array)
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/recognize/batch")
async def recognize_faces_batch(files: list[UploadFile] = File(...)):
    """Recognize multiple faces in batch"""
    results = []
    for file in files:
        image_bytes = await file.read()
        image = Image.open(io.BytesIO(image_bytes))
        image_array = np.array(image)
        result = face_service.recognize_face(image_array)
        results.append(result)
    return {"results": results}

@app.post("/api/register")
async def register_face(person_id: str, file: UploadFile = File(...)):
    """Register a new face to the database"""
    try:
        image_bytes = await file.read()
        image = Image.open(io.BytesIO(image_bytes))
        image_array = np.array(image)
        
        result = face_service.register_face(person_id, image_array)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)
```

#### MODEL_SERVER/services/face_recognition.py

```python
from deepface import DeepFace as dp
import cv2
import os
from pathlib import Path

class FaceRecognitionService:
    def __init__(self, db_path, model_name="Facenet512"):
        self.db_path = db_path
        self.model_name = model_name
        self.distance_metric = "cosine"
        
    def recognize_face(self, image_array):
        """
        Recognize face in image
        Returns: {
            "success": bool,
            "person_id": str,
            "confidence": float,
            "bbox": [x, y, w, h]
        }
        """
        try:
            # Find face in database
            result = dp.find(
                img_path=image_array,
                db_path=self.db_path,
                model_name=self.model_name,
                distance_metric=self.distance_metric,
                enforce_detection=True
            )
            
            if len(result) > 0 and len(result[0]) > 0:
                best_match = result[0].iloc[0]
                person_id = Path(best_match['identity']).stem
                confidence = 1 - best_match['distance']  # Convert distance to confidence
                
                return {
                    "success": True,
                    "person_id": person_id,
                    "confidence": float(confidence),
                    "identity_path": best_match['identity']
                }
            else:
                return {
                    "success": False,
                    "message": "No face found"
                }
        except Exception as e:
            return {
                "success": False,
                "message": str(e)
            }
    
    def register_face(self, person_id, image_array):
        """Register a new face to the database"""
        try:
            # Save image to database path
            save_path = os.path.join(self.db_path, f"{person_id}.jpg")
            cv2.imwrite(save_path, cv2.cvtColor(image_array, cv2.COLOR_RGB2BGR))
            
            return {
                "success": True,
                "message": f"Face registered for {person_id}",
                "path": save_path
            }
        except Exception as e:
            return {
                "success": False,
                "message": str(e)
            }
```

#### MODEL_SERVER/requirements.txt

```
fastapi==0.104.1
uvicorn[standard]==0.24.0
python-multipart==0.0.6
deepface==0.0.99
opencv-python==4.8.1.78
pillow==10.1.0
numpy==1.24.3
```

---

### 3. Update Django Application Server

Modify your Django backend to communicate with the Model Server instead of running recognition locally.

#### FRSYS/server/services/model_client.py (NEW FILE)

```python
import requests
import cv2
import numpy as np
from typing import Dict, Optional
import logging

logger = logging.getLogger(__name__)

class ModelServerClient:
    """Client for communicating with the Model Server"""
    
    def __init__(self, model_server_url: str = "http://localhost:5000"):
        self.base_url = model_server_url.rstrip('/')
        
    def health_check(self) -> bool:
        """Check if model server is available"""
        try:
            response = requests.get(f"{self.base_url}/health", timeout=5)
            return response.status_code == 200
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
                "person_id": str,
                "confidence": float
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
                return response.json()
            else:
                return {
                    "success": False,
                    "message": f"Model server error: {response.status_code}"
                }
        except Exception as e:
            logger.error(f"Face recognition request failed: {e}")
            return {
                "success": False,
                "message": str(e)
            }
    
    def register_face(self, person_id: str, image: np.ndarray) -> Dict:
        """Register a new face in the model database"""
        try:
            _, img_encoded = cv2.imencode('.jpg', image)
            files = {'file': ('image.jpg', img_encoded.tobytes(), 'image/jpeg')}
            data = {'person_id': person_id}
            
            response = requests.post(
                f"{self.base_url}/api/register",
                files=files,
                params=data,
                timeout=30
            )
            
            return response.json()
        except Exception as e:
            logger.error(f"Face registration failed: {e}")
            return {
                "success": False,
                "message": str(e)
            }
```

#### Update FRSYS/FRSYS/settings.py

Add model server configuration:

```python
# Model Server Configuration
MODEL_SERVER_URL = os.getenv('MODEL_SERVER_URL', 'http://localhost:5000')

# Database configuration (example for PostgreSQL)
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.getenv('DB_NAME', 'frsys_db'),
        'USER': os.getenv('DB_USER', 'frsys_user'),
        'PASSWORD': os.getenv('DB_PASSWORD', 'password'),
        'HOST': os.getenv('DB_HOST', 'localhost'),
        'PORT': os.getenv('DB_PORT', '5432'),
    }
}
```

#### Update FRSYS/server/consumers.py

Replace direct face recognition calls with model server client:

```python
from .services.model_client import ModelServerClient

# In your consumer class
def __init__(self):
    super().__init__()
    self.model_client = ModelServerClient(settings.MODEL_SERVER_URL)

# Replace recognition calls
def process_frame(self, frame):
    # ... your existing code ...
    
    # Instead of calling DeepFace directly:
    # result = DeepFace.find(...)
    
    # Use model server:
    result = self.model_client.recognize_face(frame)
    
    if result['success']:
        person_id = result['person_id']
        confidence = result['confidence']
        # ... handle result ...
```

---

### 4. Environment Configuration

Create `.env` files for different servers:

#### FRSYS/.env (Django Application Server)

```env
# Django Settings
DEBUG=False
SECRET_KEY=your-secret-key-here

# IMPORTANT: Allow surveillance post PCs to connect
# Add all surveillance post IPs and the administration PC IP
ALLOWED_HOSTS=localhost,127.0.0.1,192.168.1.100,192.168.1.10,192.168.1.11,192.168.1.12

# Database Configuration (Local on Administration PC)
DB_ENGINE=postgresql
DB_NAME=frsys_db
DB_USER=frsys_user
DB_PASSWORD=your_secure_password
DB_HOST=localhost  # Database on same machine
DB_PORT=5432

# Model Server (Local on Administration PC)
MODEL_SERVER_URL=http://localhost:5000

# CORS - Allow surveillance post PCs to connect
CORS_ALLOWED_ORIGINS=http://192.168.1.10:3000,http://192.168.1.11:3000,http://192.168.1.12:3000,http://localhost:3000
```

#### MODEL_SERVER/.env

```env
# Model Server Settings
MODEL_NAME=Facenet512
DISTANCE_METRIC=cosine
DB_PATH=/path/to/face/database
PORT=5000
HOST=0.0.0.0
```

---

## Deployment Architecture

### Production Setup (Your Specific Configuration)

```
┌────────────────────────────────────────────────────────────┐
│  SURVEILLANCE POST PCs (Multiple Stations)                 │
├────────────────────────────────────────────────────────────┤
│  IP: 192.168.1.10, 192.168.1.11, 192.168.1.12, etc.       │
│  - React Frontend (Built & Served Locally)                 │
│  - Camera Hardware Connection                              │
│  - Connects to: http://192.168.1.100:8000 (Admin PC)       │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│  ADMINISTRATION POST PC (Central Server)                   │
├────────────────────────────────────────────────────────────┤
│  IP: 192.168.1.100 (Example)                               │
│                                                             │
│  Services Running:                                          │
│  ├─ Django Application Server                              │
│  │  └─ Port 8000 (Accessible from surveillance PCs)        │
│  │                                                          │
│  ├─ PostgreSQL Database                                     │
│  │  └─ Port 5432 (localhost only - not exposed to network) │
│  │                                                          │
│  └─ Model Server (Face Recognition)                        │
│     └─ Port 5000 (localhost only - not exposed to network) │
└────────────────────────────────────────────────────────────┘

Network Configuration:
- Surveillance PCs → Administration PC: Port 8000 (HTTP/WebSocket)
- Administration PC Internal: 
  * On ADMINISTRATION POST PC (Start Services in This Order)

#### 1. Start Database Server

```powershell
# PostgreSQL - Start Windows service
Start-Service postgresql-x64-14  # Adjust version number

# Or using Docker (bind to localhost only for security)
docker run --name frsys-db -e POSTGRES_PASSWORD=yourpassword -p 127.0.0.1:5432:5432 -d postgres

# Verify database is running
Test-NetConnection -ComputerName localhost -Port 5432
```

#### 2. Start Model Server

```powershell
# Navigate to model server directory
cd C:\path\to\MODEL_SERVER

# Install dependencies (first time only)
pip install -r requirements.txt

# Start model server (binds to localhost only for security)
python app.py
# Server will run on http://127.0.0.1:5000 (not accessible from network)
```

**Keep this terminal running!**

#### 3. Start Django Application Server

Open a new PowerShell terminal:

```powershell
# Navigate to Django project
cd C:\Users\youne\OneDrive\Desktop\FRv1.0.1\FRSYS

# Activate virtual environment
..\nvenv\Scripts\Activate.ps1

# Run migrations (first time only)
python manage.py migrate

# Start Django server (exposed to LAN for surveillance PCs)
daphne -b 0.0.0.0 -p 8000 FRSYS.asgi:application

# IMPORTANT: -b 0.0.0.0 allows surveillance post PCs to connect
# The server will be accessible at http://192.168.1.100:8000
```

**Keep this terminal running!**

#### 4. Get Administration PC IP Address

```powershell
# Find your IP address on the local network
ipconfig

# Look for "IPv4 Address" under your network adapter
# Example: 192.168.1.100
# Note this IP - surveillance posts will use it
```

### On SURVEILLANCE POST PCs (Each Station)

#### Option A: Development Mode (npm start)

```powershell
cd C:\path\to\FRSYS_FRONT\my-react-app

# Update API endpoint to point to administration PC
# Edit src/services/api.js or .env file:
# REACT_APP_API_URL=http://192.168.1.100:8000

npm install  # First time only
npm start
# Opens browser at http://localhost:3000
```

#### Option B: Production Build (Recommended)

```powershell
cd C:\path\to\FRSYS_FRONT\my-react-app

# Build the React app
npm run build

# Serve the built files using a simple HTTP server
# Option 1: Using Python
cd build
python -m http.server 3000

# Option 2: Using Node serve package
npx serve -s build -l 3000

# Option 3: Copy build folder to Nginx/Apache web server
```

**Update React Configuration for Production:**

Before building, update `FRSYS_FRONT/my-react-app/.env`:

```env
# Replace with your Administration PC's IP address
REACT_APP_API_URL=http://192.168.1.100:8000
REACT_APP_WS_URL=ws://192.168.1.100:8000
# Runs on http://0.0.0.0:5000
```

### 3. Start Django Application Server

```powershell
cd FRSYS
python manage.py migrate  # Run migrations to database
python manage.py runserver 0.0.0.0:8000
# Or for production:
# daphne -b 0.0.0.0 -p 8000 FRSYS.asgi:application
```

### 4. Start React Client

```powershell
cd FRSYS_FRONT/my-react-app
npm run build  # For production
npm start      # For development
```

---

## Security Considerations

### 1. Network Security

```python
# Django settings.py
ALLOWED_HOSTS = ['your-domain.com', 'api.your-domain.com']

# Use environment variables for sensitive data
import os
from dotenv import load_dotenv
load_dotenv()

SECRET_KEY = os.getenv('SECRET_KEY')
```

### 2. Database Security

- Use strong passwords
- Restrict database access by IP
- Enable SSL/TLS connections
```python
DATABASES = {
    'default': {
        # ...
        'OPTIONS': {
            'sslmode': 'require',
        },
    }
}
```

### 3. API Security

```python
# Install
pip install djangorestframework-simplejwt

# Add JWT authentication
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
}
```

### 4. Model Server Security

```python
# FastAPI app.py
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer()

@app.post("/api/recognize")
async def recognize_face(
    credentials: HTTPAuthorizationCredentials = Security(security),
    file: UploadFile = File(...)
):
    # Verify token from Django server
    # ...
```

---

## Performance Optimization

### 1. Model Server Scaling

Use multiple model server instances with load balancing:

```python
# Django settings.py
MODEL_SERVERS = [
    'http://192.168.1.101:5000',
    'http://192.168.1.102:5000',
### Administration Post PC Setup
- [ ] Install PostgreSQL/MySQL on administration PC
- [ ] Configure database to bind to localhost only (security)
- [ ] Create and test database connection from Django
- [ ] Run migrations: `python manage.py migrate`
- [ ] Create MODEL_SERVER directory structure
- [ ] Move face recognition logic to Model Server
- [ ] Implement Model Server API
- [ ] Create Model Server client in Django
- [ ] Update Django consumers/views to use Model Server
- [ ] Configure .env file with localhost settings
- [ ] Test Model Server (localhost:5000)
- [ ] Test Django Server with 0.0.0.0 binding (port 8000)
- [ ] Configure Windows Firewall to allow port 8000
- [ ] Note administration PC's LAN IP address

### Surveillance Post PC Setup (Each Station)
- [ ] Install Node.js (if using npm start)
- [ ] Copy FRSYS_FRONT React app to each PC
- [ ] Update .env with administration PC IP address
- [ ] Build React app: `npm run build`
- [ ] Test connection to administration PC (http://ADMIN_IP:8000)
- [ ] Set up camera hardware connections
- [ ] Configure camera permissions in browser
- [ ] Test video streaming to administration server

### Network Configuration
- [ ] Verify all PCs are on same LAN
- [ ] Configure static IP for administration PC (recommended)
- [ ] Open port 8000 on administration PC firewall
- [ ] Test connectivity between surveillance and administration PCs
- [ ] Configure router/switch if needed

### Testing
- [ ] Test database operations from Django
- [ ] Test Model Server responses
- [ ] Test API endpoints from surveillance PC
- [ ] Test WebSocket connections
- [ ] Test face recognition end-to-end
- [ ] Test multiple surveillance posts simultaneously

### Production Readiness
- [ ] Set DEBUG=False in Django
- [ ] Use strong SECRET_KEY
- [ ] Secure database passwords
- [ ] Set up monitoring and logging
- [ ] Configure automatic service startup
- [ ] Create backup strategy for database
- [ ] Document IP addresses and configur
}
```

### 3. Caching

```python
# Install Redis
pip install django-redis

# Configure cache
CACHES = {
    'default': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': 'redis://127.0.0.1:6379/1',
    }
}
```

---

## Monitoring and Logging

### 1. Application Metrics

```python
# Install
pip install prometheus-client django-prometheus

# Add to Django middleware
MIDDLEWARE = [
    'django_prometheus.middleware.PrometheusBeforeMiddleware',
    # ... other middleware ...
    'django_prometheus.middleware.PrometheusAfterMiddleware',
]
```

### 2. Centralized Logging

```python
# settings.py
LOGGING = {
    'version': 1,
    'handlers': {
        'file': {
            'class': 'logging.FileHandler',
            'filename': '/var/log/frsys/app.log',
        },
    },
    'loggers': {
        'django': {
            'handlers': ['file'],
            'level': 'INFO',
        },
    },
}
```

---

## Migration Checklist

- [ ] Set up PostgreSQL/MySQL database server
- [ ] Create and test database connection from Django
- [ ] Run migrations: `python manage.py migrate`
- [ ] Create Model Server project structure
- [ ] Move face recognition logic to Model Server
- [ ] Implement Model Server API
- [ ] Create Model Server client in Django
- [ ] Update Django consumers/views to use Model Server
- [ ] Configure environment variables
- [ ] Test all services individually
- [ ] Test integrated system
- [ ] Set up monitoring and logging
- [ ] Configure production web servers (Nginx/Gunicorn)
- [ ] Implement security measures
- [ ] Performance testing and optimization

---

## Next Steps

1. **Start with Database Migration**: Set up PostgreSQL and migrate your existing SQLite data
2. **Create Model Server**: Build the FastAPI model server with face recognition
3. **Update Django Backend**: Modify to use external database and model server
4. **Test Components**: Test each component individually before integration
5. **Deploy**: Follow production deployment guide for your infrastructure

Would you like detailed implementation of any specific component?
