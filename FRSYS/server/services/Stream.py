import cv2
import queue
import threading
import time
from .recongnition import process_frame


# Stream configuration
RTSP_URL = 'rtsp://admin:admin123@192.168.1.108:554'  # Use 0 for webcam, or replace with actual RTSP URL for network stream
PROCESS_SCALE = 1.0
IDLE_SLEEP_SEC = 0.005
DISPLAY_FPS = 30


class VideoStreamProcessor:
    """
    Handles video stream capture, face recognition processing, and display rendering.
    Uses multi-threading to separate capture, processing, and drawing operations.
    """
    
    def __init__(self, rtsp_url=RTSP_URL, process_scale=PROCESS_SCALE, 
                 display_fps=DISPLAY_FPS, idle_sleep_sec=IDLE_SLEEP_SEC):
        """
        Initialize the video stream processor.
        
        Args:
            rtsp_url: URL of the RTSP video stream
            process_scale: Scale factor for processing frames (lower = faster but less accurate)
            display_fps: Target frames per second for display
            idle_sleep_sec: Sleep duration when idle
        """
        self.rtsp_url = rtsp_url
        self.process_scale = process_scale
        self.display_fps = display_fps
        self.idle_sleep_sec = idle_sleep_sec
        
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
                boxes = process_frame(frame, scale_x=scale_x, scale_y=scale_y)
                with self.state_lock:
                    self.latest_boxes = boxes
                    self.latest_error = ""
            except Exception as err:
                with self.state_lock:
                    self.latest_error = str(err)
    
    def capture_worker(self):
        """Worker thread for capturing frames from the video stream."""
        while not self.stop_event.is_set():
            ret, frame = self.cap.read()
            if not ret:
                with self.state_lock:
                    self.latest_error = "Failed to grab frame"
                self.stop_event.set()
                break

            with self.state_lock:
                self.latest_frame = frame

            self.new_frame_event.set()

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
        cv2.destroyAllWindows()
        print("Released resources and exited")


def main():
    """Main entry point for running the video stream processor."""
    processor = VideoStreamProcessor()
    processor.start()
    processor.run()


if __name__ == "__main__":
    main()
