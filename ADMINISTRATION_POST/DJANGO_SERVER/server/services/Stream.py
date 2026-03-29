import cv2
import queue
import threading
import time

try:
    from deep_sort_realtime.deepsort_tracker import DeepSort
except Exception:
    DeepSort = None

from .recongnition import process_frame


# Stream configuration
# rtsp url can be provided explicitly or resolved from the database at runtime
RTSP_URL = None
PROCESS_SCALE = 1.0
IDLE_SLEEP_SEC = 0.005
DISPLAY_FPS = 30
PROCESS_EVERY_N_FRAMES = 5
USE_DEEPSORT = True


class VideoStreamProcessor:
    """
    Handles video stream capture, face recognition processing, and display rendering.
    Uses multi-threading to separate capture, processing, and drawing operations.
    """
    
    def __init__(self, rtsp_url=None, process_scale=PROCESS_SCALE,
                 display_fps=DISPLAY_FPS, idle_sleep_sec=IDLE_SLEEP_SEC,
                 process_every_n_frames=PROCESS_EVERY_N_FRAMES):
        """
        Initialize the video stream processor.
        
        Args:
            rtsp_url: URL of the RTSP video stream
            process_scale: Scale factor for processing frames (lower = faster but less accurate)
            display_fps: Target frames per second for display
            idle_sleep_sec: Sleep duration when idle
            process_every_n_frames: Only run recognition every N frames to reduce load
        """
        # determine runtime rtsp url:
        # - prefer explicit rtsp_url argument when provided and truthy
        # - otherwise attempt to resolve from Camera DB
        def _build_from_camera(camera):
            user = camera.username or ''
            pwd = camera.get_camera_password() or ''
            ip = camera.ip_address or ''
            port = camera.rtsp_port or 554
            path = camera.rtsp_path or '/stream'
            if not path.startswith('/'):
                path = '/' + path
            if user and pwd:
                creds = f'{user}:{pwd}@'
            elif user:
                creds = f'{user}@'
            else:
                creds = ''
            return f'rtsp://{creds}{ip}:{port}{path}'

        def _resolve_rtsp_from_db(camera_id=None):
            try:
                # import here to avoid circular imports at module load
                from server.models import Camera
                if camera_id:
                    cam = Camera.objects.filter(pk=camera_id).first()
                else:
                    cam = Camera.objects.filter(is_active=True).first()
                if not cam:
                    return ''
                return _build_from_camera(cam)
            except Exception as e:
                print(f"[Stream] failed to resolve rtsp url from db: {e}")
                return ''

        # accept common falsy defaults (None, 0, empty string)
        if rtsp_url is None or rtsp_url == 0 or (isinstance(rtsp_url, str) and not rtsp_url.strip()):
            resolved = _resolve_rtsp_from_db()
            self.rtsp_url = resolved or rtsp_url
        else:
            self.rtsp_url = rtsp_url
        self.process_scale = process_scale
        self.display_fps = display_fps
        self.idle_sleep_sec = idle_sleep_sec
        self.process_every_n_frames = max(1, int(process_every_n_frames))
        
        # Video capture
        self.cap = None
        
        # Threading components
        self.frame_queue = queue.Queue(maxsize=1)
        self.stop_event = threading.Event()
        self.state_lock = threading.Lock()
        self.new_frame_event = threading.Event()
        
        # Shared state
        self.latest_boxes = []
        self.latest_error = ""
        self.latest_frame = None
        self.rendered_frame = None
        self.recognition_mode = "checkin"
        self.capture_frame_index = 0

        # Optional DeepSORT tracker for stable IDs between processed frames.
        self.tracker = None
        self.tracking_enabled = bool(USE_DEEPSORT and DeepSort is not None)
        if self.tracking_enabled:
            try:
                self.tracker = DeepSort(max_age=15, n_init=2, max_cosine_distance=0.2)
            except Exception as e:
                print(f"[Stream] DeepSORT init failed ({e}), tracking disabled.")
                self.tracking_enabled = False
                self.tracker = None
        
        # Thread references
        self.process_thread = None
        self.capture_thread = None
        self.drawer_thread = None
    
    def enqueue_latest_processing_frame(self, frame):
        """Keep only the newest frame so recognition doesn't lag behind live video."""
        try:
            if self.frame_queue.full():
                self.frame_queue.get_nowait()
            self.frame_queue.put_nowait(frame)
        except queue.Empty:
            self.frame_queue.put_nowait(frame)
    
    def worker(self):
        """Worker thread for processing frames and performing face recognition."""
        while not self.stop_event.is_set():
            try:
                frame, scale_x, scale_y = self.frame_queue.get(timeout=0.1)
            except queue.Empty:
                continue

            try:
                boxes = process_frame(
                    frame,
                    scale_x=scale_x,
                    scale_y=scale_y,
                    recognition_mode=self.recognition_mode,
                )
                boxes = self.apply_tracking(boxes)
                with self.state_lock:
                    self.latest_boxes = boxes
                    self.latest_error = ""
            except Exception as err:
                with self.state_lock:
                    self.latest_error = str(err)

    def set_recognition_mode(self, mode):
        """Update recognition mode used by worker thread."""
        normalized = str(mode or "").strip().lower()
        self.recognition_mode = "return" if normalized == "return" else "checkin"

    @staticmethod
    def _iou_xywh(box_a, box_b):
        ax, ay, aw, ah = box_a
        bx, by, bw, bh = box_b
        ax2, ay2 = ax + aw, ay + ah
        bx2, by2 = bx + bw, by + bh

        inter_x1 = max(ax, bx)
        inter_y1 = max(ay, by)
        inter_x2 = min(ax2, bx2)
        inter_y2 = min(ay2, by2)
        inter_w = max(0, inter_x2 - inter_x1)
        inter_h = max(0, inter_y2 - inter_y1)
        inter_area = inter_w * inter_h

        area_a = max(0, aw) * max(0, ah)
        area_b = max(0, bw) * max(0, bh)
        union = area_a + area_b - inter_area
        return (inter_area / union) if union > 0 else 0.0

    def apply_tracking(self, boxes):
        """Attach DeepSORT track ids to face boxes when available."""
        if not self.tracking_enabled or self.tracker is None or not boxes:
            return boxes

        detections = []
        for item in boxes:
            x, y, w, h = item.get("box", (0, 0, 0, 0))
            if w <= 0 or h <= 0:
                continue
            confidence = 0.99 if item.get("label", "") != "No match" else 0.5
            detections.append(([float(x), float(y), float(w), float(h)], float(confidence), "face"))

        if not detections:
            return boxes

        tracks = self.tracker.update_tracks(detections, frame=None)
        used_box_indexes = set()

        for track in tracks:
            if not track.is_confirmed() or track.time_since_update > 1:
                continue

            tx1, ty1, tx2, ty2 = track.to_ltrb()
            track_box = (int(tx1), int(ty1), int(max(0, tx2 - tx1)), int(max(0, ty2 - ty1)))

            best_index = -1
            best_iou = 0.0
            for idx, item in enumerate(boxes):
                if idx in used_box_indexes:
                    continue
                iou = self._iou_xywh(item.get("box", (0, 0, 0, 0)), track_box)
                if iou > best_iou:
                    best_iou = iou
                    best_index = idx

            if best_index >= 0 and best_iou >= 0.1:
                boxes[best_index]["track_id"] = int(track.track_id)
                used_box_indexes.add(best_index)

        return boxes
    
    def capture_worker(self):
        """Worker thread for capturing frames from the video stream."""
        while not self.stop_event.is_set():
            ret, frame = self.cap.read()
            if not ret:
                with self.state_lock:
                    self.latest_error = "Failed to grab frame"
                self.stop_event.set()
                break

            self.capture_frame_index += 1

            with self.state_lock:
                self.latest_frame = frame

            self.new_frame_event.set()

            # Process every Nth frame only to reduce DeepFace load.
            if self.capture_frame_index % self.process_every_n_frames != 0:
                continue

            if 0.0 < self.process_scale < 1.0:
                proc_frame = cv2.resize(frame, None, fx=self.process_scale,
                                       fy=self.process_scale, interpolation=cv2.INTER_LINEAR)
                scale_x = 1.0 / self.process_scale
                scale_y = 1.0 / self.process_scale
            else:
                proc_frame = frame
                scale_x = 1.0
                scale_y = 1.0

            self.enqueue_latest_processing_frame((proc_frame, scale_x, scale_y))
    
    def draw_worker(self):
        """Worker thread for rendering frames with bounding boxes and labels."""
        while not self.stop_event.is_set():
            has_new_frame = self.new_frame_event.wait(timeout=0.05)
            if has_new_frame:
                self.new_frame_event.clear()

            with self.state_lock:
                frame_src = None if self.latest_frame is None else self.latest_frame.copy()
                draw_boxes = list(self.latest_boxes)
                draw_error = self.latest_error

            if frame_src is None:
                time.sleep(self.idle_sleep_sec)
                continue

            # Draw bounding boxes and labels
            for item in draw_boxes:
                x, y, w, h = item["box"]
                color = item["color"]
                # Draw only the rectangle, no label text
                cv2.rectangle(frame_src, (x, y), (x + w, y + h), color, 2)
                if item.get("track_id") is not None:
                    cv2.putText(
                        frame_src,
                        f"ID:{item['track_id']}",
                        (x, max(20, y - 8)),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.5,
                        color,
                        2,
                    )

            # Draw error message if any
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

            with self.state_lock:
                self.rendered_frame = frame_src

            if not has_new_frame:
                time.sleep(self.idle_sleep_sec)
    
    def start(self):
        """Initialize video capture and start all worker threads."""
        # Initialize video capture
        # self.cap = cv2.VideoCapture(0)
        self.cap = cv2.VideoCapture(self.rtsp_url)
        print("===" * 10)
        print("rtsp_url = ", self.rtsp_url, " | self.cap = ", self.cap)
        print("===" * 10)
        if not self.cap.isOpened():
            print("Error: Could not open video stream")
            raise SystemExit(1)

        # Hint OpenCV/FFmpeg to keep stream latency low.
        self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        
        # Start worker threads
        self.process_thread = threading.Thread(target=self.worker, daemon=True)
        self.capture_thread = threading.Thread(target=self.capture_worker, daemon=True)
        self.drawer_thread = threading.Thread(target=self.draw_worker, daemon=True)

        self.process_thread.start()
        self.capture_thread.start()
        self.drawer_thread.start()
        
        print("Video stream processor started. Press 'q' to quit")
    
    def run(self):
        """Main loop for displaying the video stream."""
        try:
            wait_key_ms = max(1, int(1000 / self.display_fps))
            while not self.stop_event.is_set():
                with self.state_lock:
                    show_frame = self.rendered_frame

                if show_frame is not None:
                    cv2.imshow("Video Stream", show_frame)
                else:
                    time.sleep(self.idle_sleep_sec)

                if cv2.waitKey(wait_key_ms) & 0xFF == ord("q"):
                    break
        finally:
            self.stop()
    
    def stop(self):
        """Stop all threads and release resources."""
        self.stop_event.set()
        if self.capture_thread:
            self.capture_thread.join(timeout=1.0)
        if self.process_thread:
            self.process_thread.join(timeout=1.0)
        if self.drawer_thread:
            self.drawer_thread.join(timeout=1.0)
        if self.cap:
            self.cap.release()
        try:
            cv2.destroyAllWindows()
        except Exception:
            pass
        print("Released resources and exited")


def main():
    """Main entry point for running the video stream processor."""
    processor = VideoStreamProcessor()
    processor.start()
    processor.run()


if __name__ == "__main__":
    main()
