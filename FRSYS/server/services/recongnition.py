from deepface import DeepFace as dp
import cv2
import os
import sys
from pathlib import Path

# Add Django path for model imports
BASE_DIR = Path(__file__).resolve().parent.parent.parent
sys.path.append(str(BASE_DIR))

# Setup Django
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'FRSYS.settings')
django.setup()

from django.conf import settings
from server.models import Person, Spectacle

# Recognition configuration
# Expected dataset structure: <DB_PATH>/<matricule>/<photo files>
DB_PATH = getattr(settings, "PHOTO_DATASET_ROOT", r"C:\Users\youne\OneDrive\Desktop\test_photos")
FACE_PADDING_RATIO = 0.25
FIND_MODEL_NAME = "Facenet512"
FIND_DISTANCE_METRIC = "cosine"
DEBUG = False  # Set to True for debug output


def normalize_mat(value):
    """Normalize matricule for tolerant comparisons (case/format insensitive)."""
    if value is None:
        return ""
    return "".join(ch for ch in str(value).strip().upper() if ch.isalnum())


def mat_candidates(value):
    """Return candidate forms to handle optional PMG prefix in filenames/DB values."""
    norm = normalize_mat(value)
    if not norm:
        return set()

    candidates = {norm}
    if norm.startswith("PMG") and len(norm) > 3:
        candidates.add(norm[3:])
    else:
        candidates.add(f"PMG{norm}")
    return candidates


def mats_match(left, right):
    """Compare two matricules allowing PMG/no-PMG variants."""
    left_candidates = mat_candidates(left)
    right_candidates = mat_candidates(right)
    if left_candidates and right_candidates and left_candidates.intersection(right_candidates):
        return True

    # Numeric fallback: handles int MATs and leading-zero formatting differences.
    def to_int_candidates(candidates):
        numbers = set()
        for candidate in candidates:
            digits = "".join(ch for ch in candidate if ch.isdigit())
            if digits:
                try:
                    numbers.add(int(digits))
                except ValueError:
                    continue
        return numbers

    left_numbers = to_int_candidates(left_candidates)
    right_numbers = to_int_candidates(right_candidates)
    return bool(left_numbers and right_numbers and left_numbers.intersection(right_numbers))


def extract_mat_from_identity(identity):
    """
    Extract matricule from a DeepFace identity path.

    Supports both structures:
    - New: <db_path>/<matricule>/<photo>.jpg (preferred)
    - Legacy: filename starts with matricule, e.g. MAT001_photo.jpg
    
    Args:
        identity: Photo filename or full path
    
    Returns:
        str: Extracted matricule or None
    """
    try:
        identity_path = Path(str(identity))

        # Preferred mode: matricule is the direct parent folder name.
        parent_name = identity_path.parent.name.strip()
        if parent_name and parent_name not in (".", ""):
            return parent_name

        # Backward-compatible fallback to legacy filename format.
        filename = identity_path.stem
        mat = filename.split('_')[0].strip()
        return mat if mat else None
    except Exception as e:
        print(f"[ERROR] Failed to extract mat from '{identity}': {e}")
        return None


def check_spectacle_eligibility(identity):
    """
    Resolve matched identity to a Person, then join Spectacle by person_id.

    State rules for read-only recognition:
    - IN SPECTACLE: person has an open Spectacle and is eligible to be processed by return flow
    - NOT ON SPECTACLE: person exists but has no open Spectacle

    Returns:
        tuple: (is_in_spectacle, person_info_dict, label_string)
    """
    mat = extract_mat_from_identity(identity)
    if not mat:
        return False, None, "Invalid MAT"

    try:
        person = None

        # Find person by MAT with tolerant matching (string/int/prefix variants)
        for candidate in mat_candidates(mat):
            try:
                person = Person.objects.select_related('compagnie').get(mat__iexact=str(candidate))
                break
            except Person.DoesNotExist:
                continue

        # Final fallback: compare MATs in Python using normalized rules
        if person is None:
            for p in Person.objects.select_related('compagnie').all():
                if mats_match(p.mat, mat):
                    person = p
                    break

        if person is None:
            return False, None, f"{mat} - UNKNOWN PERSON"

        # Find open spectacle for this person.
        spectacle_record = (
            Spectacle.objects
            .filter(person_id=person.id, date_rentree__isnull=True)
            .order_by('-date_sortie')
            .first()
        )

        if spectacle_record:
            person_info = {
                'matricule': person.mat,
                'nom': person.nom,
                'prenom': person.prenom,
                'compagnie': person.compagnie.label if person.compagnie else 'N/A',
                'spectacle_id': spectacle_record.id,
                'date_sortie': spectacle_record.date_sortie,
                'date_limite_retour': spectacle_record.date_limite_retour,
                'status': 'IN SPECTACLE',
            }
            label = f"{person.nom} {person.prenom} - IN SPECTACLE"
            return True, person_info, label

        person_info = {
            'matricule': person.mat,
            'nom': person.nom,
            'prenom': person.prenom,
            'compagnie': person.compagnie.label if person.compagnie else 'N/A',
            'status': 'NOT ON SPECTACLE',
        }
        label = f"{person.nom} {person.prenom} - NOT ON SPECTACLE"
        return False, person_info, label
    except Exception as e:
        print(f"[ERROR] Failed to check person '{mat}': {e}")
        return False, None, f"{mat} - ERROR"



def process_frame(frame, scale_x=1.0, scale_y=1.0):
    """
    Detect and recognize faces in a frame.
    
    Args:
        frame: Input image to process
        scale_x: Horizontal scaling factor for bounding boxes
        scale_y: Vertical scaling factor for bounding boxes
    
    Returns:
        list: Box info dicts with coordinates, color, and label
    """
    boxes = []
    
    try:
        faces = dp.extract_faces(
            img_path=frame,
            enforce_detection=False,
            detector_backend="opencv",
        )
    except Exception as e:
        print(f"[ERROR] Face extraction failed: {e}")
        return boxes
    
    frame_h, frame_w = frame.shape[:2]
    
    for face in faces:
        area = face.get("facial_area", {})
        sx, sy, sw, sh = (
            int(area.get("x", 0)),
            int(area.get("y", 0)),
            int(area.get("w", 0)),
            int(area.get("h", 0)),
        )
        
        if sw <= 0 or sh <= 0:
            continue
        
        # Add padding and clamp to frame bounds
        pad_w = int(sw * FACE_PADDING_RATIO)
        pad_h = int(sh * FACE_PADDING_RATIO)
        x1 = max(0, sx - pad_w)
        y1 = max(0, sy - pad_h)
        x2 = min(frame_w, sx + sw + pad_w)
        y2 = min(frame_h, sy + sh + pad_h)
        
        if x2 <= x1 or y2 <= y1:
            continue
        
        # Create box info with scaled coordinates
        box_info = {
            "box": (int(x1 * scale_x), int(y1 * scale_y), int((x2 - x1) * scale_x), int((y2 - y1) * scale_y)),
            "color": (0, 0, 255),  # Red - default no match
            "label": "No match",
        }
        
        # Try to match face against database
        face_roi = frame[y1:y2, x1:x2]
        if face_roi.size == 0:
            boxes.append(box_info)
            continue
        
        try:
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
                identity = str(best.get("identity", "Match"))
                distance = best.get("distance", 0)
                
                # Check spectacle eligibility and get full person info
                is_eligible, person_info, label = check_spectacle_eligibility(identity)
                
                if is_eligible:
                    box_info["color"] = (0, 255, 0)  # Green - eligible
                    box_info["eligible"] = True
                    box_info["person_info"] = person_info
                    box_info["label"] = label
                elif person_info:
                    box_info["color"] = (255, 165, 0)  # Orange - not on spectacle
                    box_info["eligible"] = False
                    box_info["person_info"] = person_info
                    box_info["label"] = label
                else:
                    # Person not in database, just show filename
                    identity_name = Path(identity).name
                    box_info["color"] = (0, 255, 0)  # Green - match found
                    box_info["label"] = f"{identity_name} ({distance:.2f})"
                
                break
        except Exception as e:
            if DEBUG:
                print(f"[DEBUG] Face matching error: {e}")
        
        boxes.append(box_info)
    
    return boxes
