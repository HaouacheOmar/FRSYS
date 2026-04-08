"""
Configuration instructions for Django Channels WebSocket support.

To enable WebSocket functionality in your FRSYS project, follow these steps:

1. Install Django Channels and dependencies:
   pip install channels channels-redis daphne

2. Update FRSYS/settings.py:
   
   Add 'channels' and 'server' to INSTALLED_APPS:
   INSTALLED_APPS = [
       'daphne',  # Add this at the TOP
       'django.contrib.admin',
       'django.contrib.auth',
       'django.contrib.contenttypes',
       'django.contrib.sessions',
       'django.contrib.messages',
       'django.contrib.staticfiles',
       'channels',
       'server',
   ]
   
   Add channel layers configuration:
   CHANNEL_LAYERS = {
       'default': {
           'BACKEND': 'channels.layers.InMemoryChannelLayer'
       }
   }
   
   # For production, use Redis:
   # CHANNEL_LAYERS = {
   #     'default': {
   #         'BACKEND': 'channels_redis.core.RedisChannelLayer',
   #         'CONFIG': {
   #             'hosts': [('127.0.0.1', 6379)],
   #         },
   #     },
   # }
   
   Set ASGI application:
   ASGI_APPLICATION = 'FRSYS.routing.application'

3. Update FRSYS/asgi.py to use the routing configuration:
   """
   ASGI config for FRSYS project.
   """
   import os
   from django.core.asgi import get_asgi_application
   
   os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'FRSYS.settings')
   
   # Import routing after setting environment
   from FRSYS.routing import application
   
   # Use the application from routing
   # application is already defined in routing.py

4. Run the development server with Daphne:
   python manage.py runserver
   # or specifically with daphne:
   # daphne -b 0.0.0.0 -p 8000 FRSYS.asgi:application

5. WebSocket Endpoints:
   - Live video stream: ws://localhost:8000/ws/video/stream/
   - Face recognition: ws://localhost:8000/ws/face/recognize/

6. Client-side JavaScript example:
   const ws = new WebSocket('ws://localhost:8000/ws/video/stream/');
   
   ws.onopen = () => {
       console.log('Connected to video stream');
       ws.send(JSON.stringify({type: 'start'}));
   };
   
   ws.onmessage = (event) => {
       const data = JSON.parse(event.data);
       if (data.type === 'frame') {
           // Display the base64 image
           document.getElementById('video').src = 'data:image/jpeg;base64,' + data.image;
       }
   };

Usage Notes:
- VideoStreamConsumer: Continuously streams frames from RTSP camera with face recognition
- FaceRecognitionConsumer: Processes individual frames sent by clients for recognition
- Both consumers use the recognition logic from recongnition.py
- Frames are captured by Stream.py logic integrated into the WebSocket consumer
"""
