from insightface.app import FaceAnalysis
import cv2, os
app = FaceAnalysis(name='buffalo_l'); app.prepare(ctx_id=-1, det_size=(640,640))
base = r"C:\Users\youne\OneDrive\Desktop\test_photos"
for root,_,files in os.walk(base):
    for f in files:
        if f.lower().endswith(('.jpg','.jpeg','.png')):
            p = os.path.join(root,f)
            img = cv2.imread(p)
            if img is None:
                print(p, "-> unreadable")
                continue
            faces = app.get(img)
            print(p, "=> faces:", len(faces))