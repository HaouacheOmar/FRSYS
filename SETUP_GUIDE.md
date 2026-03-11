# Face Recognition System - Full Stack Setup Guide

## Project Structure

```
FRv1.0.1/
├── FRSYS/              # Django Backend (WebSocket + Face Recognition)
│   ├── manage.py
│   ├── FRSYS/
│   │   ├── settings.py
│   │   ├── routing.py
│   │   └── asgi.py
│   └── server/
│       ├── consumers.py
│       ├── routing.py
│       ├── views.py
│       └── services/
│           ├── recongnition.py
│           └── Stream.py
│
└── FRSYS_FRONT/        # React Frontend
    ├── package.json
    ├── public/
    └── src/
        └── components/
            └── VideoStream.js
```

## Backend Setup (Django + Daphne)

### 1. Install Python Dependencies

```powershell
cd FRSYS
pip install django-cors-headers
```

### 2. Start Backend Server

```powershell
daphne -b 0.0.0.0 -p 8000 FRSYS.asgi:application
```

Backend will run at: `http://localhost:8000`

## Frontend Setup (React)

### 1. Install Node Dependencies

```powershell
cd ..\FRSYS_FRONT
npm install
```

### 2. Start React Development Server

```powershell
npm start
```

Frontend will open at: `http://localhost:3000`

## Running the Full System

### Option 1: Two Terminals

**Terminal 1 (Backend):**
```powershell
cd C:\Users\youne\OneDrive\Desktop\FRv1.0.1\FRSYS
daphne -b 0.0.0.0 -p 8000 FRSYS.asgi:application
```

**Terminal 2 (Frontend):**
```powershell
cd C:\Users\youne\OneDrive\Desktop\FRv1.0.1\FRSYS_FRONT
npm start
```

### Option 2: Create Startup Scripts

**start_backend.ps1:**
```powershell
cd C:\Users\youne\OneDrive\Desktop\FRv1.0.1\FRSYS
Write-Host "Starting FRSYS Backend..." -ForegroundColor Green
daphne -b 0.0.0.0 -p 8000 FRSYS.asgi:application
```

**start_frontend.ps1:**
```powershell
cd C:\Users\youne\OneDrive\Desktop\FRv1.0.1\FRSYS_FRONT
Write-Host "Starting React Frontend..." -ForegroundColor Green
npm start
```

## Usage

1. Start backend first (Terminal 1)
2. Start frontend (Terminal 2)
3. Browser will auto-open to `http://localhost:3000`
4. Click "Connect" button to start video stream
5. Webcam will activate and face recognition will run

## Configuration

### Change Video Source

Edit `FRSYS/server/consumers.py`:
```python
# For webcam
VIDEO_SOURCE = os.getenv("VIDEO_SOURCE", "0")

# For RTSP camera
VIDEO_SOURCE = "rtsp://admin:admin123@192.168.1.108:554/..."
```

Or set environment variable:
```powershell
$env:VIDEO_SOURCE="0"
daphne -b 0.0.0.0 -p 8000 FRSYS.asgi:application
```

### Change Backend URL (for deployment)

Edit `FRSYS_FRONT/src/components/VideoStream.js`:
```javascript
const wsUrlRef = useRef('ws://your-server-ip:8000/ws/video/stream/');
```

## Performance Tuning

Current optimized settings in `FRSYS/server/consumers.py`:
- `PROCESS_SCALE = 0.5` - Frame processing scale
- `RECOGNITION_EVERY_N_FRAMES = 4` - Recognition frequency
- `SEND_EVERY_N_FRAMES = 2` - Send every 2nd frame
- `MAX_TRANSFER_WIDTH = 640` - Max frame width
- `JPEG_QUALITY = 70` - JPEG compression quality

For smoother stream (lower quality):
```python
PROCESS_SCALE = 0.4
SEND_EVERY_N_FRAMES = 3
JPEG_QUALITY = 60
```

For better quality (slower):
```python
PROCESS_SCALE = 0.7
SEND_EVERY_N_FRAMES = 1
JPEG_QUALITY = 85
```

## Building for Production

### Backend
No build needed, just deploy with Daphne or ASGI server

### Frontend
```powershell
cd FRSYS_FRONT
npm run build
```

The `build/` folder contains production files. Serve with:
- Nginx
- Apache
- Or any static file server

## Troubleshooting

### Backend Issues
- **Port 8000 in use**: Change port: `daphne -p 8001 FRSYS.asgi:application`
- **Import errors**: Install dependencies: `pip install channels daphne django-cors-headers`
- **Camera not opening**: Check device index or RTSP URL

### Frontend Issues
- **Can't connect to backend**: Verify backend is running on port 8000
- **CORS errors**: Check `FRSYS/settings.py` CORS settings
- **npm install fails**: Delete `node_modules` and `package-lock.json`, retry

### WebSocket Issues
- **Connection pending**: Backend not started or firewall blocking
- **Connection refused**: Check WebSocket URL in VideoStream.js
- **Slow stream**: Adjust performance settings in consumers.py

## Architecture

```
Browser (React) <--WebSocket--> Daphne <--> Django Channels
                                              |
                                              v
                                        VideoStreamConsumer
                                              |
                                    +---------+---------+
                                    |                   |
                            Capture Thread      Recognition Thread
                                    |                   |
                                Webcam          DeepFace (FaceNet)
```

## API Endpoints

### HTTP
- `http://localhost:8000/video-stream/` - HTML viewer (legacy)
- `http://localhost:8000/api/status/` - API status check

### WebSocket
- `ws://localhost:8000/ws/video/stream/` - Live video feed
- `ws://localhost:8000/ws/face/recognize/` - On-demand recognition

## Next Steps

- Add authentication
- Create user management
- Store recognition history
- Add multiple camera support
- Deploy to production server
