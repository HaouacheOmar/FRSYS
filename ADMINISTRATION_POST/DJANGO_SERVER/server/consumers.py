"""
WebSocket consumers for streaming video frames with face recognition.
This module handles real-time streaming of processed video frames to clients.
Uses VideoStreamProcessor from Stream.py for core video processing logic.
"""
import asyncio
import json
import base64

import cv2
import numpy as np
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async

from .services.Stream import VideoStreamProcessor, RTSP_URL, PROCESS_SCALE, DISPLAY_FPS, IDLE_SLEEP_SEC
from .auth_utils import get_user_role
from .models import UserRole
from .presence import (
    ADMIN_NOTIFICATIONS_GROUP,
    list_online_guests,
    mark_guest_connected,
    mark_guest_disconnected,
)


class VideoStreamConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for streaming video frames with face recognition.
    Leverages VideoStreamProcessor for threaded video processing.
    """
    
    # WebSocket-specific streaming configuration
    SEND_EVERY_N_FRAMES = 2
    MAX_TRANSFER_WIDTH = 640
    JPEG_QUALITY = 70
    SEND_TIMEOUT_SEC = 0.2
    
    # Class-level shared resources
    stream_processor = None
    streaming_task = None
    connected_clients = set()
    frame_counter = 0
    
    @staticmethod
    def create_json_response(msg_type, **kwargs):
        """Helper to create standardized JSON responses."""
        return json.dumps({'type': msg_type, **kwargs})
    
    async def send_json(self, msg_type, **kwargs):
        """Helper to send JSON responses."""
        await self.send(text_data=self.create_json_response(msg_type, **kwargs))
    
    async def connect(self):
        """Handle new WebSocket connection."""
        role = await database_sync_to_async(get_user_role)(self.scope.get('user'))
        if role not in {UserRole.ROLE_ADMIN, UserRole.ROLE_GUEST}:
            await self.close(code=4403)
            return

        await self.accept()
        VideoStreamConsumer.connected_clients.add(self)
        
        # Initialize VideoStreamProcessor if needed
        if not VideoStreamConsumer.stream_processor:
            if not await self._initialize_stream_processor():
                return
        
        # Start streaming task if needed
        if not VideoStreamConsumer.streaming_task or VideoStreamConsumer.streaming_task.done():
            VideoStreamConsumer.streaming_task = asyncio.create_task(self.stream_video())
        
        await self.send_json('connection', message='Connected to video stream')
    
    async def _initialize_stream_processor(self):
        """Initialize the video stream processor. Returns True on success."""
        try:
            VideoStreamConsumer.stream_processor = VideoStreamProcessor(
                rtsp_url=RTSP_URL,
                process_scale=PROCESS_SCALE,
                display_fps=DISPLAY_FPS,
                idle_sleep_sec=IDLE_SLEEP_SEC
            )
            await asyncio.to_thread(VideoStreamConsumer.stream_processor.start)
            print(f"VideoStreamProcessor started with source: {RTSP_URL}")
            return True
        except Exception as e:
            print(f"Error starting VideoStreamProcessor: {e}")
            await self.send_json('error', message=f'Failed to start video stream: {str(e)}')
            return False
    
    async def disconnect(self, close_code):
        """Handle WebSocket disconnection."""
        VideoStreamConsumer.connected_clients.discard(self)
        
        # Stop stream processor when last client disconnects
        if not VideoStreamConsumer.connected_clients:
            await self._cleanup_stream_processor()
    
    async def _cleanup_stream_processor(self):
        """Stop and cleanup the stream processor."""
        if VideoStreamConsumer.streaming_task and not VideoStreamConsumer.streaming_task.done():
            VideoStreamConsumer.streaming_task.cancel()
        
        if VideoStreamConsumer.stream_processor:
            await asyncio.to_thread(VideoStreamConsumer.stream_processor.stop)
            VideoStreamConsumer.stream_processor = None
        
        VideoStreamConsumer.frame_counter = 0
        print("All clients disconnected, VideoStreamProcessor stopped")
    
    async def receive(self, text_data):
        """Handle incoming WebSocket messages from client."""
        try:
            data = json.loads(text_data)
            message_type = data.get('type')
            
            responses = {
                'start': ('status', 'Streaming started'),
                'stop': ('status', 'Streaming stopped'),
                'ping': ('pong', None)
            }
            
            if message_type in responses:
                if message_type == 'start' and VideoStreamConsumer.stream_processor:
                    mode = data.get('mode', 'checkin')
                    await asyncio.to_thread(VideoStreamConsumer.stream_processor.set_recognition_mode, mode)
                    await self.send_json('status', message=f"Streaming started ({mode})")
                    return
                msg_type, message = responses[message_type]
                await self.send_json(msg_type, **({"message": message} if message else {}))
            
        except json.JSONDecodeError:
            await self.send_json('error', message='Invalid message format')
    
    async def stream_video(self):
        """Main streaming loop - retrieves and broadcasts processed frames."""
        try:
            while VideoStreamConsumer.connected_clients:
                # Get rendered frame from processor
                frame_data = await self._get_frame_from_processor()
                if not frame_data:
                    await asyncio.sleep(0.01)
                    continue
                
                rendered_frame, boxes, error = frame_data
                VideoStreamConsumer.frame_counter += 1

                # Skip frames to reduce bandwidth
                if VideoStreamConsumer.frame_counter % self.SEND_EVERY_N_FRAMES != 0:
                    await asyncio.sleep(0.001)
                    continue
                
                # Encode and broadcast frame
                await self._encode_and_broadcast(rendered_frame, boxes, error)
                
        except asyncio.CancelledError:
            pass
        except Exception as e:
            print(f"Streaming error: {str(e)}")
            await self.broadcast_to_all({'type': 'error', 'message': f'Streaming error: {str(e)}'})
    
    async def _get_frame_from_processor(self):
        """Get the current rendered frame from the processor. Returns (frame, boxes, error) or None."""
        processor = VideoStreamConsumer.stream_processor
        if not processor:
            await asyncio.sleep(0.1)
            return None
        
        with processor.state_lock:
            if processor.rendered_frame is None:
                return None
            return (
                processor.rendered_frame.copy(),
                list(processor.latest_boxes),
                processor.latest_error
            )
    
    async def _encode_and_broadcast(self, rendered_frame, boxes, error):
        """Encode frame as JPEG and broadcast to all clients."""
        try:
            # Resize if needed to reduce transfer size
            transfer_frame = self._resize_frame_if_needed(rendered_frame)
            
            # Encode as JPEG
            _, buffer = cv2.imencode('.jpg', transfer_frame, [cv2.IMWRITE_JPEG_QUALITY, self.JPEG_QUALITY])
            frame_base64 = base64.b64encode(buffer).decode('utf-8')
            
            # Extract person details for frontend display (without IDs)
            detections = await self._format_detections(boxes)
            
            # Prepare frame data
            frame_data = {
                'type': 'frame',
                'image': frame_base64,
                'detections': detections
            }
            
            if error:
                frame_data['error'] = error
            
            await self.broadcast_to_all(frame_data)
            
        except Exception as e:
            await self.broadcast_to_all({'type': 'error', 'message': f'Processing error: {str(e)}'})
    
    def _resize_frame_if_needed(self, frame):
        """Resize frame if it exceeds MAX_TRANSFER_WIDTH."""
        h, w = frame.shape[:2]
        if w <= self.MAX_TRANSFER_WIDTH:
            return frame
        
        scale = self.MAX_TRANSFER_WIDTH / float(w)
        return cv2.resize(frame, (self.MAX_TRANSFER_WIDTH, int(h * scale)), interpolation=cv2.INTER_AREA)
    
    def _parse_label(self, label, box):
        """Parse label string and extract structured detection info.
        
        Handles formats like:
        - "Doe John - NOT ON SPECTACLE (0.20)"
        - "Doe John - ELIGIBLE (0.95)"
        - "Unknown"
        """
        import re
        label_text = str(label or "").strip() or "UNKNOWN"
        
        # Try to match pattern: "LastName FirstName - STATUS (confidence)"
        match = re.match(r'(.+?)\s+(.+?)\s*-\s*(.+?)\s*\(([0-9.]+)\)', label_text)
        
        if match:
            nom = match.group(1).strip()
            prenom = match.group(2).strip()
            status_text = match.group(3).strip()
            
            return {
                'nom': nom,
                'prenom': prenom,
                'status': status_text,
                'box_data': box.get('box', None)
            }
        
        # Fallback if pattern doesn't match
        return {
            'status': label_text
        }

    def _normalize_detection(self, detection, fallback_status='UNKNOWN'):
        """Ensure detection payload has a stable shape for all clients."""
        if not isinstance(detection, dict):
            return {'status': str(fallback_status or 'UNKNOWN')}

        status_value = detection.get('status')
        status_text = str(status_value).strip() if status_value is not None else ''
        if not status_text:
            status_text = str(fallback_status or 'UNKNOWN')

        normalized = dict(detection)
        normalized['status'] = status_text
        return normalized
    
    async def _lookup_person_by_name(self, nom, prenom):
        """Look up person in database by nome and prenom. Returns person info or None."""
        from server.models import Person
        
        try:
            person = await asyncio.to_thread(
                Person.objects.select_related('compagnie').get, 
                nom=nom, 
                prenom=prenom
            )
            return {
                'matricule': person.mat,
                'nom': person.nom,
                'prenom': person.prenom,
                'compagnie': person.compagnie.label if person.compagnie else 'N/A'
            }
        except Person.DoesNotExist:
            return None
        except Exception as e:
            return None
    
    async def _format_detections(self, boxes):
        """Format detection data with full person info from database (without IDs)."""
        from server.models import Person
        
        detections = []
        # Ensure boxes is iterable
        if not boxes or not isinstance(boxes, (list, tuple)):
            return detections
            
        for box in boxes:
            person_info = box.get('person_info')
            
            if person_info:
                # Person recognized and has full info from check_spectacle_eligibility
                detection = {
                    'track_id': box.get('track_id'),
                    'matricule': person_info.get('matricule'),
                    'nom': person_info.get('nom'),
                    'prenom': person_info.get('prenom'),
                    'compagnie': person_info.get('compagnie'),
                    'status': person_info.get('status')
                }
                
                # Add spectacle dates if available (for eligible persons)
                if person_info.get('date_sortie'):
                    try:
                        detection['date_sortie'] = person_info['date_sortie'].strftime('%Y-%m-%d %H:%M')
                    except:
                        detection['date_sortie'] = str(person_info['date_sortie'])
                        
                if person_info.get('date_limite_retour'):
                    try:
                        detection['date_limite_retour'] = person_info['date_limite_retour'].strftime('%Y-%m-%d %H:%M')
                    except:
                        detection['date_limite_retour'] = str(person_info['date_limite_retour'])

                if person_info.get('date_rentree'):
                    try:
                        detection['date_rentree'] = person_info['date_rentree'].strftime('%Y-%m-%d %H:%M')
                    except:
                        detection['date_rentree'] = str(person_info['date_rentree'])

                if person_info.get('est_retard') is not None:
                    detection['est_retard'] = bool(person_info.get('est_retard'))
                
                detections.append(self._normalize_detection(detection))
            else:
                # Face detected but not recognized or not eligible
                label = str(box.get('label') or 'Unknown')
                if 'No match' in label:
                    detections.append({'track_id': box.get('track_id'), 'status': 'Face detected - No match'})
                else:
                    # Try to parse label and lookup person in database
                    parsed = self._parse_label(label, box)
                    if parsed.get('nom') and parsed.get('prenom'):
                        # Try to find person in database
                        person_data = await self._lookup_person_by_name(parsed['nom'], parsed['prenom'])
                        if person_data:
                            # Add status to person data
                            person_data['track_id'] = box.get('track_id')
                            person_data['status'] = parsed.get('status', 'UNKNOWN')
                            detections.append(self._normalize_detection(person_data, fallback_status=label))
                        else:
                            # Couldn't find in database, return parsed data
                            parsed['track_id'] = box.get('track_id')
                            detections.append(self._normalize_detection(parsed, fallback_status=label))
                    else:
                        parsed['track_id'] = box.get('track_id')
                        detections.append(self._normalize_detection(parsed, fallback_status=label))
        
        return detections
    
    async def broadcast_to_all(self, data):
        """Broadcast data to all connected WebSocket clients."""
        clients = list(VideoStreamConsumer.connected_clients)
        if not clients:
            return

        payload = json.dumps(data)
        tasks = [asyncio.wait_for(client.send(text_data=payload), timeout=self.SEND_TIMEOUT_SEC) for client in clients]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Remove clients that failed to receive
        for client, result in zip(clients, results):
            if isinstance(result, Exception):
                VideoStreamConsumer.connected_clients.discard(client)


class FaceRecognitionConsumer(AsyncWebsocketConsumer):
    """WebSocket consumer for on-demand face recognition."""
    
    async def connect(self):
        """Handle new WebSocket connection."""
        role = await database_sync_to_async(get_user_role)(self.scope.get('user'))
        if role not in {UserRole.ROLE_ADMIN, UserRole.ROLE_GUEST}:
            await self.close(code=4403)
            return

        await self.accept()
        await self._send_json('connection', message='Connected to face recognition service')
    
    async def disconnect(self, close_code):
        """Handle WebSocket disconnection."""
        pass
    
    async def receive(self, text_data):
        """Handle incoming frames for recognition. Expects base64-encoded image data."""
        try:
            data = json.loads(text_data)
            message_type = data.get('type')
            
            if message_type == 'recognize':
                await self._handle_recognition(data.get('image'))
            elif message_type == 'ping':
                await self._send_json('pong')
                
        except json.JSONDecodeError:
            await self._send_json('error', message='Invalid JSON format')
        except Exception as e:
            await self._send_json('error', message=f'Processing error: {str(e)}')
    
    async def _handle_recognition(self, image_data):
        """Process image and return recognition results."""
        if not image_data:
            await self._send_json('error', message='No image data provided')
            return
        
        # Decode base64 image
        frame = self._decode_image(image_data)
        if frame is None:
            await self._send_json('error', message='Invalid image data')
            return
        
        # Process frame for face recognition (import locally to avoid unused import)
        from .services.recongnition import process_frame
        boxes = await asyncio.to_thread(process_frame, frame, 1.0, 1.0)
        
        # Send recognition results
        await self._send_json(
            'recognition_result',
            detections=[{'box': box['box'], 'label': box['label'], 'color': box['color']} for box in boxes],
            face_count=len(boxes)
        )
    
    @staticmethod
    def _decode_image(image_data):
        """Decode base64 image to OpenCV format."""
        try:
            image_bytes = base64.b64decode(image_data)
            nparr = np.frombuffer(image_bytes, np.uint8)
            return cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        except Exception:
            return None
    
    async def _send_json(self, msg_type, **kwargs):
        """Helper to send JSON responses."""
        await self.send(text_data=json.dumps({'type': msg_type, **kwargs}))


class GuestPresenceConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        role = await database_sync_to_async(get_user_role)(self.scope.get('user'))
        if role != UserRole.ROLE_GUEST:
            await self.close(code=4403)
            return

        await self.accept()
        await database_sync_to_async(mark_guest_connected)(self.scope['user'])
        await self.send(text_data=json.dumps({'type': 'presence', 'status': 'connected'}))

    async def disconnect(self, close_code):
        user = self.scope.get('user')
        role = await database_sync_to_async(get_user_role)(user)
        if role == UserRole.ROLE_GUEST:
            await database_sync_to_async(mark_guest_disconnected)(user)

    async def receive(self, text_data):
        try:
            payload = json.loads(text_data)
        except Exception:
            return

        if payload.get('type') == 'ping':
            await self.send(text_data=json.dumps({'type': 'pong'}))


class AdminNotificationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        role = await database_sync_to_async(get_user_role)(self.scope.get('user'))
        if role != UserRole.ROLE_ADMIN:
            await self.close(code=4403)
            return

        await self.accept()
        await self.channel_layer.group_add(ADMIN_NOTIFICATIONS_GROUP, self.channel_name)

        online_guests = await database_sync_to_async(list_online_guests)()
        await self.send(
            text_data=json.dumps(
                {
                    'type': 'admin_notification',
                    'event': 'guest_snapshot',
                    'payload': {'online_guests': online_guests},
                }
            )
        )

    async def disconnect(self, close_code):
        try:
            await self.channel_layer.group_discard(ADMIN_NOTIFICATIONS_GROUP, self.channel_name)
        except Exception:
            pass

    async def receive(self, text_data):
        try:
            payload = json.loads(text_data)
        except Exception:
            return

        if payload.get('type') == 'ping':
            await self.send(text_data=json.dumps({'type': 'pong'}))

    async def admin_notification(self, event):
        await self.send(
            text_data=json.dumps(
                {
                    'type': 'admin_notification',
                    'event': event.get('event'),
                    'payload': event.get('payload', {}),
                }
            )
        )
