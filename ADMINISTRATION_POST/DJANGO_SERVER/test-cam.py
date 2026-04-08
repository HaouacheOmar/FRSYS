import cv2
url = "rtsp://admin:admin123@192.168.1.108:554/cam/realmonitor?channel=1&subtype=0"
cap = cv2.VideoCapture(url, cv2.CAP_FFMPEG)
print("opened:", cap.isOpened())
ret, _ = cap.read()
print("read frame:", ret)
cap.release()