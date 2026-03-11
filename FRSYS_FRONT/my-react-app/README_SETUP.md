# Face Recognition System - React Frontend

This is the React frontend for the Face Recognition System, matching the Django backend URL patterns.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

The frontend will run at http://localhost:3000

## Available Routes

Matching Django backend URL patterns:

- `/` - Home page
- `/video-stream/` - Real-time face recognition video stream
- `/api/compagnies/` - Companies management
- `/api/persons/` - Persons management
- `/api/cameras/` - Cameras configuration
- `/api/spectacles/` - Spectacles tracking
- `/api/rentrees/` - Returns management

## Backend Configuration

The frontend is configured to proxy API requests to the Django backend at:
- API: http://localhost:8000/api
- WebSocket: ws://localhost:8000/ws

Make sure the Django backend is running on port 8000 before starting the frontend.

## Start Django Backend

In the FRSYS directory:
```bash
cd FRSYS
daphne -b 0.0.0.0 -p 8000 FRSYS.asgi:application
```

## Features

- **Video Stream**: Real-time face recognition with WebSocket streaming
- **CRUD Operations**: Full create, read, update, delete functionality for all models
- **Filter & Search**: Filter spectacles by status, rentrees by late returns
- **Responsive UI**: Clean, user-friendly interface matching the Django templates
- **Navigation**: Sticky navigation bar with all routes

## Technology Stack

- React 19.2
- React Router DOM 6.22
- Vite 7.3
- CSS3 (no external CSS frameworks)
