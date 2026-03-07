import json
import cv2
import numpy as np
import base64
from channels.generic.websocket import AsyncWebsocketConsumer
from asgiref.sync import sync_to_async
from .models import Camera
from .services import recognition, spectacle, notifications


# this consumer receives camera frames over websocket
class CameraConsumer(AsyncWebsocketConsumer):
    # called when websocket client connects
    async def connect(self):
        await self.accept()
        # get first camera from database
        self.camera = await sync_to_async(Camera.objects.first)()
        if not self.camera:
            # close connection if no camera exists
            await self.close()

    # called when websocket client disconnects
    async def disconnect(self, close_code):
        pass

    # called every time a frame is received
    async def receive(self, text_data=None, bytes_data=None):
        # read json payload and get frame field
        data = json.loads(text_data)
        frame_b64 = data.get("frame")
        if not frame_b64:
            # send error when frame is missing
            await self.send(text_data=json.dumps({"status": "ERROR", "message": "No frame"}))
            return

        # decode base64 text to image frame
        frame_bytes = base64.b64decode(frame_b64)
        nparr = np.frombuffer(frame_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        try:
            # create face embedding and search closest person
            embedding = await sync_to_async(recognition.get_embedding)(frame)
            person_data = await sync_to_async(recognition.find_closest_person)(embedding)
        except Exception as e:
            # send error if face processing fails
            await self.send(text_data=json.dumps({"status": "ERROR", "message": str(e)}))
            return

        # default response when no person is matched
        response = {"status": "NOT_FOUND"}
        if person_data and person_data["distance"] <= 0.6:
            # build success response when distance is good
            response = {
                "status": "MATCH",
                "nom": person_data["nom"],
                "prenom": person_data["prenom"],
                "matricule": person_data["mat"],
                "compagnie": person_data["compagnie__label"],
                "distance": person_data["distance"],
            }
            # update attendance status for this person
            est_retard = await sync_to_async(spectacle.update_spectacle_and_rentree)(
                person=person_data, camera=self.camera
            )
            if est_retard:
                # send late notification if needed
                await sync_to_async(notifications.notify_retard)(person=person_data)

        # send final result to websocket client
        await self.send(text_data=json.dumps(response))