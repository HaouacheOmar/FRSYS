import asyncio
import websockets
import json
import cv2
import base64


# this async function reads camera frames and sends them to websocket server
async def stream_camera(uri):
    # open default camera (0 means first camera)
    cap = cv2.VideoCapture(0)  

    # connect to websocket server
    async with websockets.connect(uri) as ws:
        while True:
            # read one frame from camera
            ret, frame = cap.read()
            if not ret:
                # stop loop if frame is not available
                break

            # convert frame to jpg bytes
            _, buffer = cv2.imencode(".jpg", frame)
            # convert bytes to base64 text so it can be sent in json
            frame_b64 = base64.b64encode(buffer).decode("utf-8")

            # send frame to server and print server response
            await ws.send(json.dumps({"frame": frame_b64}))
            response = await ws.recv()
            print(response)

# start the async camera stream with local websocket url
asyncio.run(stream_camera("ws://127.0.0.1:8000/ws/camera/"))