
import asyncio
import json
import base64
import time

import cv2
import numpy as np
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async

from .services.Stream import VideoStreamProcessor, PROCESS_SCALE, DISPLAY_FPS, IDLE_SLEEP_SEC
from .models import Camera, mask_url_password
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
    
    stream_processor = None
    streaming_task = None
    connected_clients = set()
    frame_counter = 0
    # Serializes processor start/stop: without it two simultaneous connects each build a
    # processor (one leaks), and a refresh (disconnect + connect) can end with no stream.
    lifecycle_lock = asyncio.Lock()
    
    @staticmethod
    def create_json_response(msg_type, **kwargs):
        return json.dumps({'type': msg_type, **kwargs})
    
    async def send_json(self, msg_type, **kwargs):
        await self.send(text_data=self.create_json_response(msg_type, **kwargs))
    
    async def connect(self):
        role = await database_sync_to_async(get_user_role)(self.scope.get('user'))
        if role not in {UserRole.ROLE_ADMIN, UserRole.ROLE_GUEST}:
            await self.close(code=4403)
            return

        await self.accept()
        # Register before taking the lock, so a concurrent last-client disconnect sees us
        # and skips its cleanup.
        VideoStreamConsumer.connected_clients.add(self)

        async with VideoStreamConsumer.lifecycle_lock:
            if not VideoStreamConsumer.stream_processor:
                if not await self._initialize_stream_processor():
                    # Don't linger as a client with no stream; that blocks cleanup for everyone.
                    VideoStreamConsumer.connected_clients.discard(self)
                    await self.close(code=4500)
                    return

            if not VideoStreamConsumer.streaming_task or VideoStreamConsumer.streaming_task.done():
                VideoStreamConsumer.streaming_task = asyncio.create_task(self.stream_video())
        
        await self.send_json('connection', message='Connected to video stream')
    
    async def _initialize_stream_processor(self):
        """Initialize the video stream processor. Returns True on success."""
        try:
            # pick the first active camera from the database
            camera = await database_sync_to_async(lambda: Camera.objects.filter(is_active=True).first())()
            if not camera:
                await self.send_json('error', message='no active camera configured')
                return False

            rtsp_url = camera.rtsp_url()

            processor = VideoStreamProcessor(
                rtsp_url=rtsp_url,
                process_scale=PROCESS_SCALE,
                display_fps=DISPLAY_FPS,
                idle_sleep_sec=IDLE_SLEEP_SEC
            )
            await asyncio.to_thread(processor.start)
            # Only publish once started, so a failed start doesn't leave a dead processor behind.
            VideoStreamConsumer.stream_processor = processor
            print(f"VideoStreamProcessor started with source: {mask_url_password(rtsp_url)} (camera id={camera.id})")
            return True
        except Exception as e:
            print(f"Error starting VideoStreamProcessor: {e}")
            await self.send_json('error', message=f'Failed to start video stream: {str(e)}')
            return False
    
    @staticmethod
    def _sync_recognition_mode():
        """One camera, one processor, many pages: stay in 'return' while any connected page
        (a Rentrees station) asked for it, so a CheckIns page or a Stop elsewhere can't
        silently switch return marking off. Returns the effective mode."""
        wants_return = any(getattr(c, 'mode', 'checkin') == 'return' for c in VideoStreamConsumer.connected_clients)
        mode = 'return' if wants_return else 'checkin'
        if VideoStreamConsumer.stream_processor:
            VideoStreamConsumer.stream_processor.set_recognition_mode(mode)
        return mode

    async def disconnect(self, close_code):
        """Handle WebSocket disconnection."""
        VideoStreamConsumer.connected_clients.discard(self)
        self._sync_recognition_mode()

        # Stop stream processor when last client disconnects (re-checked under the lock:
        # a client may have connected while we waited).
        async with VideoStreamConsumer.lifecycle_lock:
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
                if message_type in ('start', 'stop'):
                    # Each page asks for its own mode (Rentrees: 'return', CheckIns: 'checkin');
                    # the shared processor follows all of them, see _sync_recognition_mode.
                    self.mode = 'return' if message_type == 'start' and data.get('mode') == 'return' else 'checkin'
                    mode = self._sync_recognition_mode()
                    if message_type == 'start' and VideoStreamConsumer.stream_processor:
                        await self.send_json('status', message=f"Streaming started ({mode})")
                        return
                msg_type, message = responses[message_type]
                await self.send_json(msg_type, **({"message": message} if message else {}))
            
        except json.JSONDecodeError:
            await self.send_json('error', message='Invalid message format')
    
    async def stream_video(self):
        """Main streaming loop - retrieves and broadcasts processed frames."""
        last_seq = -1
        try:
            while VideoStreamConsumer.connected_clients:
                # Only new renders: re-sending the same frame wasted CPU on the event loop.
                frame_data = await self._get_frame_from_processor(last_seq)
                if not frame_data:
                    await asyncio.sleep(1 / DISPLAY_FPS)
                    continue

                rendered_frame, boxes, error, last_seq = frame_data
                VideoStreamConsumer.frame_counter += 1

                # Skip frames to reduce bandwidth
                if VideoStreamConsumer.frame_counter % self.SEND_EVERY_N_FRAMES != 0:
                    continue
                
                # Encode and broadcast frame
                await self._encode_and_broadcast(rendered_frame, boxes, error)
                
        except asyncio.CancelledError:
            pass
        except Exception as e:
            print(f"Streaming error: {str(e)}")
            await self.broadcast_to_all({'type': 'error', 'message': f'Streaming error: {str(e)}'})
    
    async def _get_frame_from_processor(self, last_seq):
        """Newest rendered frame if it is newer than last_seq: (frame, boxes, error, seq), else None."""
        processor = VideoStreamConsumer.stream_processor
        if not processor:
            await asyncio.sleep(0.1)
            return None

        with processor.state_lock:
            if processor.rendered_frame is None or processor.rendered_seq == last_seq:
                return None
            return (
                processor.rendered_frame.copy(),
                list(processor.latest_boxes),
                processor.latest_error,
                processor.rendered_seq,
            )
    
    async def _encode_and_broadcast(self, rendered_frame, boxes, error):
        """Encode frame as JPEG and broadcast to all clients."""
        try:
            # Resize + JPEG + base64 is CPU work: keep it off the event loop.
            frame_base64 = await asyncio.to_thread(self._encode_frame, rendered_frame)
            
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
    
    def _encode_frame(self, rendered_frame):
        transfer_frame = self._resize_frame_if_needed(rendered_frame)
        _, buffer = cv2.imencode('.jpg', transfer_frame, [cv2.IMWRITE_JPEG_QUALITY, self.JPEG_QUALITY])
        return base64.b64encode(buffer).decode('utf-8')

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
                try:
                    await client.close(code=4000)
                except Exception:
                    pass


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

        self.last_ping_time = time.time()
        
        await self.accept()
        await database_sync_to_async(mark_guest_connected)(self.scope['user'])
        await self.send(text_data=json.dumps({'type': 'presence', 'status': 'connected'}))
        
        self.watchdog_task = asyncio.create_task(self._watchdog())

    async def _watchdog(self):
        """Monitors client pings and force-closes connection if timed out."""
        try:
            while True:
                await asyncio.sleep(15)
                # Client sends ping every 15s. If > 40s passes, it's crashed.
                if time.time() - getattr(self, 'last_ping_time', 0) > 40.0:
                    print("Guest heartbeat timeout, closing websocket.")
                    await self.close(code=4000)
                    break
        except asyncio.CancelledError:
            pass

    async def disconnect(self, close_code):
        if hasattr(self, 'watchdog_task'):
            self.watchdog_task.cancel()
            
        user = self.scope.get('user')
        role = await database_sync_to_async(get_user_role)(user)
        if role == UserRole.ROLE_GUEST:
            await database_sync_to_async(mark_guest_disconnected)(user)

    async def receive(self, text_data):
        self.last_ping_time = time.time()
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
