import cv2
import os
import sys
import numpy as np
from pathlib import Path
from django.db import transaction
from django.utils import timezone
import insightface
from insightface.app import FaceAnalysis

# Add Django path for model imports
BASE_DIR = Path(__file__).resolve().parent.parent.parent
sys.path.append(str(BASE_DIR))

# Setup Django
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'FRSYS.settings')
django.setup()

from server.models import Person, Spectacle, Rentree, Config
# Recognition configuration
from django.conf import settings

DEBUG = False
THRESHOLD = 0.45  # Cosine similarity threshold


def get_face_db_path():

    try:
        cfg = Config.objects.first()
        if cfg and cfg.dir_path_photo:
            path = cfg.dir_path_photo.strip()
            if path:
                return os.path.abspath(os.path.expanduser(path))
    except Exception:
        # If DB isn't available yet, ignore and fallback to settings/env
        pass

    # Fallback to settings or environment
    path = getattr(settings, 'FACE_DB_PATH', None) or os.environ.get('FACE_DB_PATH')
    if path:
        return os.path.abspath(os.path.expanduser(path))
    return None

PERSON_LOOKUP_FIELDS = (
    'id', 'mat', 'nom', 'prenom', 'compagnie_id', 'compagnie__label',
)

print("[INFO] Loading InsightFace for Stream Processor...")
app = FaceAnalysis(name='buffalo_l')
app.prepare(ctx_id=0, det_size=(640, 640)) # ctx_id=0 for GPU, -1 for CPU

KNOWN_FACES = {}

def load_face_database():
    """extract and cache embeddings from the image directory.

    Uses DB-configured path (`Config.dir_path_photo`) if present, otherwise falls
    back to settings/env.
    """
    path = get_face_db_path()
    print(f"[INFO] Loading faces from {path} into memory...")
    if not path or not os.path.exists(path):
        print(f"[WARNING] Database path not found or unset: {path}")
        return

    # Walk the database directory recursively. If images are placed in
    # subfolders, use the first-level subfolder name as the identity. If
    # images are directly in the DB root, use the filename stem as identity.
    for root, _, files in os.walk(path):
        for filename in files:
            if not filename.lower().endswith(('.jpg', '.jpeg', '.png')):
                continue

            img_path = os.path.join(root, filename)
            img = cv2.imread(img_path)
            if img is None:
                continue

            faces = app.get(img)
            if not faces:
                continue

            # Determine identity: top-level subfolder name if present, else filename stem
            rel = os.path.relpath(root, path)
            if rel in ('.', ''):
                person_id = os.path.splitext(filename)[0]
            else:
                person_id = Path(rel).parts[0]

            KNOWN_FACES[person_id] = faces[0].normed_embedding

    print(f"[INFO] Loaded {len(KNOWN_FACES)} identities.")

# Load database into memory on startup
load_face_database()



def normalize_mat(value):
    if value is None: return ""
    return "".join(ch for ch in str(value).strip().upper() if ch.isalnum())

def mat_candidates(value):
    norm = normalize_mat(value)
    if not norm: return set()
    candidates = {norm}
    if norm.startswith("PMG") and len(norm) > 3:
        candidates.add(norm[3:])
    else:
        candidates.add(f"PMG{norm}")
    return candidates

def mats_match(left, right):
    left_candidates = mat_candidates(left)
    right_candidates = mat_candidates(right)
    if left_candidates and right_candidates and left_candidates.intersection(right_candidates):
        return True
    def to_int_candidates(candidates):
        numbers = set()
        for candidate in candidates:
            digits = "".join(ch for ch in candidate if ch.isdigit())
            if digits:
                try: numbers.add(int(digits))
                except ValueError: continue
        return numbers
    left_numbers = to_int_candidates(left_candidates)
    right_numbers = to_int_candidates(right_candidates)
    return bool(left_numbers and right_numbers and left_numbers.intersection(right_numbers))

def extract_mat_from_identity(identity):
    try:
        filename = os.path.splitext(os.path.basename(identity))[0]
        mat = filename.split('_')[0].strip()
        return mat if mat else None
    except Exception as e:
        print(f"[ERROR] Failed to extract mat from '{identity}': {e}")
        return None

def check_spectacle_eligibility(identity, mark_return=False):
    mat = extract_mat_from_identity(identity)
    if not mat: return False, None, "Invalid MAT"

    try:
        person = None
        for candidate in mat_candidates(mat):
            try:
                person = Person.objects.select_related('compagnie').only(*PERSON_LOOKUP_FIELDS).get(mat__iexact=str(candidate))
                break
            except Person.DoesNotExist: continue

        if person is None:
            for p in Person.objects.select_related('compagnie').only(*PERSON_LOOKUP_FIELDS):
                if mats_match(p.mat, mat):
                    person = p
                    break

        if person is None: return False, None, f"{mat} - UNKNOWN PERSON"

        spectacle_record = Spectacle.objects.filter(person_id=person.id, date_rentree__isnull=True).order_by('-date_sortie').first()

        if spectacle_record:
            now_dt = timezone.now()
            est_retard = bool(spectacle_record.date_limite_retour and now_dt > spectacle_record.date_limite_retour)

            if mark_return:
                with transaction.atomic():
                    updated = Spectacle.objects.filter(id=spectacle_record.id, date_rentree__isnull=True).update(date_rentree=now_dt)
                    if updated: spectacle_record.date_rentree = now_dt
                    Rentree.objects.update_or_create(
                        spectacle=spectacle_record,
                        defaults={
                            'person': person,
                            'date_rentree': spectacle_record.date_rentree or now_dt,
                            'est_retard': est_retard,
                        },
                    )
                status = 'RETURNED - LATE' if est_retard else 'RETURNED - ON TIME'
            else:
                status = 'IN SPECTACLE'

            person_info = {
                'matricule': person.mat, 'nom': person.nom, 'prenom': person.prenom,
                'compagnie': person.compagnie.label if person.compagnie else 'N/A',
                'spectacle_id': spectacle_record.id, 'date_sortie': spectacle_record.date_sortie,
                'date_limite_retour': spectacle_record.date_limite_retour,
                'date_rentree': (spectacle_record.date_rentree or now_dt) if mark_return else None,
                'est_retard': est_retard, 'status': status,
            }
            label = f"{person.nom} {person.prenom} - {status}"
            return True, person_info, label

        person_info = {
            'matricule': person.mat, 'nom': person.nom, 'prenom': person.prenom,
            'compagnie': person.compagnie.label if person.compagnie else 'N/A',
            'status': 'NOT ON SPECTACLE',
        }
        label = f"{person.nom} {person.prenom} - NOT ON SPECTACLE"
        return False, person_info, label
    except Exception as e:
        print(f"[ERROR] Failed to check person '{mat}': {e}")
        return False, None, f"{mat} - ERROR"




def process_frame(frame, scale_x=1.0, scale_y=1.0, recognition_mode='checkin'):
    boxes = []
    
    try:
        # One-shot detection + embedding extraction
        faces = app.get(frame)
    except Exception as e:
        print(f"[ERROR] Face extraction failed: {e}")
        return boxes
    
    frame_h, frame_w = frame.shape[:2]
    
    for face in faces:
        # Get bounding box and calculate width/height
        x1, y1, x2, y2 = face.bbox.astype(int)
        w, h = x2 - x1, y2 - y1
        
        if w <= 0 or h <= 0:
            continue
            
        # Create box info scaling back to original frame size
        box_info = {
            "box": (int(x1 * scale_x), int(y1 * scale_y), int(w * scale_x), int(h * scale_y)),
            "color": (0, 0, 255),  # Red default
            "label": "No match",
        }
        
        # Match against database in memory
        target_embedding = face.normed_embedding
        best_match_identity = None
        best_similarity = -1.0
        
        if KNOWN_FACES:
            for identity, db_embedding in KNOWN_FACES.items():
                similarity = np.dot(target_embedding, db_embedding)
                if similarity > best_similarity:
                    best_similarity = similarity
                    best_match_identity = identity
                    
        if best_match_identity and best_similarity >= THRESHOLD:
            
            should_mark_return = str(recognition_mode).lower() == 'return'
            is_eligible, person_info, label = check_spectacle_eligibility(
                best_match_identity,
                mark_return=should_mark_return,
            )
            
            if is_eligible:
                box_info["color"] = (0, 255, 0)
                box_info["eligible"] = True
                box_info["person_info"] = person_info
                box_info["label"] = label
            elif person_info:
                box_info["color"] = (255, 165, 0)
                box_info["eligible"] = False
                box_info["person_info"] = person_info
                box_info["label"] = label
            else:
                box_info["color"] = (0, 255, 0)
                box_info["label"] = f"{best_match_identity} ({best_similarity:.2f})"
        
        boxes.append(box_info)
    
    return boxes