# Face Recognition WebSocket System - Quick Start Guide

## Overview
The system has been split into modular components with WebSocket support for real-time video streaming with face recognition.

## File Structure

### Core Modules
- **`recongnition.py`** - Face recognition logic using DeepFace
  - `process_frame()` - Detects and recognizes faces in frames
  - `iou()` - Calculates bounding box overlap
  
- **`Stream.py`** - Video streaming class (standalone mode)
  - `VideoStreamProcessor` - Handles RTSP capture and processing
  
- **`consumers.py`** - WebSocket consumers for Django Channels
  - `VideoStreamConsumer` - Streams processed frames via WebSocket
  - `FaceRecognitionConsumer` - Processes individual frames on-demand

### Configuration Files
- **`routing.py`** - WebSocket URL routing for server app
- **`FRSYS/routing.py`** - Main ASGI routing configuration
- **`urls.py`** - HTTP URL routing for views

### Templates & Views
- **`templates/video_stream.html`** - Web client for viewing stream
- **`views.py`** - Django views for serving pages

## Installation

### 1. Install Dependencies
```bash
pip install channels channels-redis daphne
```

### 2. Update settings.py
Add to INSTALLED_APPS:
```python
INSTALLED_APPS = [
    'daphne',  # Add at the TOP
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'channels',
    'server',
]
```

Add channel layers:
```python
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels.layers.InMemoryChannelLayer'
    }
}
```

Add ASGI application:
```python
ASGI_APPLICATION = 'FRSYS.routing.application'
```

Add server to template directories:
```python
TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'server' / 'templates'],
        'APP_DIRS': True,
        ...
    },
]
```

### 3. Update asgi.py
```python
import os
from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'FRSYS.settings')

from FRSYS.routing import application
```

## Running the System

### Start Django Server
```bash
cd FRSYS
python manage.py runserver
```

### Access the Web Interface
Open browser to: http://localhost:8000/video-stream/

### WebSocket Endpoints

#### 1. Video Stream (Live Feed)
- **URL**: `ws://localhost:8000/ws/video/stream/`
- **Purpose**: Continuous video stream with face recognition
- **Messages**:
  - Send: `{type: 'start'}` - Start streaming
  - Send: `{type: 'stop'}` - Stop streaming
  - Send: `{type: 'ping'}` - Keepalive
  - Receive: `{type: 'frame', image: 'base64...', detections: [...]}`
  - Receive: `{type: 'error', message: '...'}`

#### 2. Face Recognition (On-Demand)
- **URL**: `ws://localhost:8000/ws/face/recognize/`
- **Purpose**: Process individual frames
- **Messages**:
  - Send: `{type: 'recognize', image: 'base64...'}`
  - Receive: `{type: 'recognition_result', detections: [...], face_count: N}`

## Architecture

### Data Flow
```
RTSP Camera → VideoStreamConsumer → process_frame() → WebSocket → Browser
                     ↓
              capture_worker() 
                     ↓
              recognition logic
                     ↓
              draw annotations
                     ↓
              encode as JPEG
                     ↓
              broadcast to clients
```

### Threading Model
- **Capture Thread**: Reads frames from RTSP stream
- **Processing Thread**: Runs face recognition in async thread pool
- **Main Event Loop**: Handles WebSocket connections and broadcasts

## Configuration

### Stream Settings (in consumers.py)
```python
RTSP_URL = "rtsp://admin:admin123@192.168.1.108:554/cam/realmonitor?channel=1&subtype=0"
PROCESS_SCALE = 1.0  # Frame scaling (0.5 = 50% size, faster)
DISPLAY_FPS = 30     # Target frames per second
```

### Recognition Settings (in recongnition.py)
```python
DB_PATH = r"C:\Users\youne\OneDrive\Desktop\test_photos"
FACE_PADDING_RATIO = 0.25
FIND_MODEL_NAME = "Facenet512"
FIND_DISTANCE_METRIC = "cosine"
```

## Usage Examples

### JavaScript Client
```javascript
const ws = new WebSocket('ws://localhost:8000/ws/video/stream/');

ws.onopen = () => {
    ws.send(JSON.stringify({type: 'start'}));
};

ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'frame') {
        document.getElementById('video').src = 
            'data:image/jpeg;base64,' + data.image;
    }
};
```

### Python Client
```python
import asyncio
import websockets
import json

async def watch_stream():
    uri = "ws://localhost:8000/ws/video/stream/"
    async with websockets.connect(uri) as websocket:
        await websocket.send(json.dumps({"type": "start"}))
        
        while True:
            message = await websocket.recv()
            data = json.loads(message)
            if data['type'] == 'frame':
                print(f"Received frame with {len(data['detections'])} faces")

asyncio.run(watch_stream())
```

## Testing

### Check API Status
```bash
curl http://localhost:8000/api/status/
```

### Test WebSocket Connection
Use the web interface at http://localhost:8000/video-stream/ and click "Connect"

## Troubleshooting

### WebSocket Connection Failed
- Ensure Django Channels is installed
- Check ASGI_APPLICATION setting
- Verify routing.py is properly configured

### No Video Feed
- Check RTSP_URL is correct and camera is accessible
- Verify network connectivity to camera
- Check camera credentials

### Low FPS
- Reduce PROCESS_SCALE (e.g., 0.5 for 50% size)
- Lower DISPLAY_FPS target
- Use Redis for CHANNEL_LAYERS in production

## Notes
- The system uses in-memory channel layers (suitable for development)
- For production, use Redis with channels-redis
- main.py remains as reference - the Django app uses the WebSocket system
- Multiple clients can connect simultaneously and receive the same stream
