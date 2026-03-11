from deepface import DeepFace as dp
import cv2
import os
import queue
import threading
import time


DB_PATH = r"C:\Users\youne\OneDrive\Desktop\test_photos"
RTSP_URL = "rtsp://admin:admin123@192.168.1.108:554/cam/realmonitor?channel=1&subtype=0"
PROCESS_SCALE = 1.0
IDLE_SLEEP_SEC = 0.005
DISPLAY_FPS = 30
FACE_PADDING_RATIO = 0.25
FIND_MODEL_NAME = "Facenet512"
FIND_DISTANCE_METRIC = "cosine"


def iou(box_a, box_b):
    ax1, ay1, aw, ah = box_a
    bx1, by1, bw, bh = box_b
    ax2, ay2 = ax1 + aw, ay1 + ah
    bx2, by2 = bx1 + bw, by1 + bh

    inter_x1 = max(ax1, bx1)
    inter_y1 = max(ay1, by1)
    inter_x2 = min(ax2, bx2)
    inter_y2 = min(ay2, by2)

    inter_w = max(0, inter_x2 - inter_x1)
    inter_h = max(0, inter_y2 - inter_y1)
    inter_area = inter_w * inter_h

    area_a = aw * ah
    area_b = bw * bh
    union = area_a + area_b - inter_area
    return inter_area / union if union > 0 else 0.0


def process_frame(frame, scale_x=1.0, scale_y=1.0):
    boxes = []

    # Step 1: detect all faces first; default each to red (mismatch)
    faces = dp.extract_faces(
        img_path=frame,
        enforce_detection=False,
        detector_backend="opencv",
    )

    frame_h, frame_w = frame.shape[:2]

    for face in faces:
        area = face.get("facial_area", {})
        sx = int(area.get("x", 0))
        sy = int(area.get("y", 0))
        sw = int(area.get("w", 0))
        sh = int(area.get("h", 0))

        if sw <= 0 or sh <= 0:
            continue

        # Add context around face crop for better embeddings, then clamp to bounds.
        pad_w = int(sw * FACE_PADDING_RATIO)
        pad_h = int(sh * FACE_PADDING_RATIO)
        x1 = max(0, sx - pad_w)
        y1 = max(0, sy - pad_h)
        x2 = min(frame_w, sx + sw + pad_w)
        y2 = min(frame_h, sy + sh + pad_h)
        if x2 <= x1 or y2 <= y1:
            continue

        # Default each detected face to red (mismatch).
        draw_x = int(x1 * scale_x)
        draw_y = int(y1 * scale_y)
        draw_w = int((x2 - x1) * scale_x)
        draw_h = int((y2 - y1) * scale_y)
        box_info = {
            "box": (draw_x, draw_y, draw_w, draw_h),
            "color": (0, 0, 255),  # Red in BGR
            "label": "No match",
        }

        face_roi = frame[y1:y2, x1:x2]
        if face_roi.size == 0:
            boxes.append(box_info)
            continue

        # Step 2: match only this face crop against the DB.
        results = dp.find(
            img_path=face_roi,
            db_path=DB_PATH,
            model_name=FIND_MODEL_NAME,
            distance_metric=FIND_DISTANCE_METRIC,
            enforce_detection=False,
            silent=True,
        )

        for df in results:
            if df.empty:
                continue

            best = df.iloc[0]
            identity = os.path.basename(str(best.get("identity", "Match")))
            label = identity
            if "distance" in best:
                label = f"{identity} ({best['distance']:.2f})"

            box_info["color"] = (0, 255, 0)  # Green in BGR
            box_info["label"] = label
            break

        boxes.append(box_info)

    return boxes


cap = cv2.VideoCapture(RTSP_URL)
if not cap.isOpened():
    print("Error: Could not open video stream")
    raise SystemExit(1)

# Hint OpenCV/FFmpeg to keep stream latency low.
cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

frame_queue = queue.Queue(maxsize=1)
stop_event = threading.Event()
state_lock = threading.Lock()
latest_boxes = []
latest_error = ""
latest_frame = None
rendered_frame = None
new_frame_event = threading.Event()


def enqueue_latest_processing_frame(frame):
    # Keep only the newest frame so recognition doesn't lag behind live video.
    try:
        if frame_queue.full():
            frame_queue.get_nowait()
        frame_queue.put_nowait(frame)
    except queue.Empty:
        frame_queue.put_nowait(frame)


def worker():
    global latest_boxes, latest_error
    while not stop_event.is_set():
        try:
            frame, scale_x, scale_y = frame_queue.get(timeout=0.1)
        except queue.Empty:
            continue

        try:
            boxes = process_frame(frame, scale_x=scale_x, scale_y=scale_y)
            with state_lock:
                latest_boxes = boxes
                latest_error = ""
        except Exception as err:
            with state_lock:
                latest_error = str(err)


def capture_worker():
    global latest_frame
    while not stop_event.is_set():
        ret, frame = cap.read()
        if not ret:
            with state_lock:
                latest_error = "Failed to grab frame"
            stop_event.set()
            break

        with state_lock:
            latest_frame = frame

        new_frame_event.set()

        if 0.0 < PROCESS_SCALE < 1.0:
            proc_frame = cv2.resize(frame, None, fx=PROCESS_SCALE, fy=PROCESS_SCALE, interpolation=cv2.INTER_LINEAR)
            scale_x = 1.0 / PROCESS_SCALE
            scale_y = 1.0 / PROCESS_SCALE
        else:
            proc_frame = frame
            scale_x = 1.0
            scale_y = 1.0

        enqueue_latest_processing_frame((proc_frame, scale_x, scale_y))


def draw_worker():
    global rendered_frame
    while not stop_event.is_set():
        has_new_frame = new_frame_event.wait(timeout=0.05)
        if has_new_frame:
            new_frame_event.clear()

        with state_lock:
            frame_src = None if latest_frame is None else latest_frame.copy()
            draw_boxes = list(latest_boxes)
            draw_error = latest_error

        if frame_src is None:
            time.sleep(IDLE_SLEEP_SEC)
            continue

        for item in draw_boxes:
            x, y, w, h = item["box"]
            color = item["color"]
            label = item["label"]
            cv2.rectangle(frame_src, (x, y), (x + w, y + h), color, 2)
            cv2.putText(
                frame_src,
                label,
                (x, max(0, y - 10)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.5,
                color,
                2,
            )

        if draw_error:
            cv2.putText(
                frame_src,
                f"DeepFace error: {draw_error}",
                (10, 30),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                (0, 0, 255),
                2,
            )

        with state_lock:
            rendered_frame = frame_src

        if not has_new_frame:
            time.sleep(IDLE_SLEEP_SEC)


process_thread = threading.Thread(target=worker, daemon=True)
capture_thread = threading.Thread(target=capture_worker, daemon=True)
drawer_thread = threading.Thread(target=draw_worker, daemon=True)

process_thread.start()
capture_thread.start()
drawer_thread.start()

print("Press 'q' to quit")

try:
    wait_key_ms = max(1, int(1000 / DISPLAY_FPS))
    while not stop_event.is_set():
        with state_lock:
            show_frame = rendered_frame

        if show_frame is not None:
            cv2.imshow("Video Stream", show_frame)
        else:
            time.sleep(IDLE_SLEEP_SEC)

        if cv2.waitKey(wait_key_ms) & 0xFF == ord("q"):
            break
finally:
    stop_event.set()
    capture_thread.join(timeout=1.0)
    process_thread.join(timeout=1.0)
    drawer_thread.join(timeout=1.0)
    cap.release()
    cv2.destroyAllWindows()
    print("Released resources and exited")