import os
import sys
from datetime import timedelta
from pathlib import Path
from django.db import connection, transaction
from django.utils import timezone

# Add Django path for model imports
BASE_DIR = Path(__file__).resolve().parent.parent.parent
sys.path.append(str(BASE_DIR))

# Setup Django
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'FRSYS.settings')
django.setup()

from server.models import Person, Spectacle, Rentree
from server.services import model_client

# Detection, embeddings and matching live in MODEL_SERVER (POST /api/detect). This module
# only maps a matched identity (the face folder name = matricule) to spectacle status.

# After a return is marked the spectacle is closed; keep showing RETURNED for this long
# instead of flipping to "NOT ON SPECTACLE" while the person is still in front of the camera.
RECENT_RETURN_SEC = 60

PERSON_LOOKUP_FIELDS = (
    'id', 'mat', 'nom', 'prenom', 'compagnie_id', 'compagnie__label',
)


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

        now_dt = timezone.now()
        # Only outings that have started; a future-dated one must not be closed on sight.
        spectacle_record = (
            Spectacle.objects.filter(person_id=person.id, date_rentree__isnull=True, date_sortie__lte=now_dt)
            .order_by('-date_sortie').first()
        )

        if spectacle_record:
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

        recent = (
            Rentree.objects.filter(person_id=person.id, date_rentree__gte=now_dt - timedelta(seconds=RECENT_RETURN_SEC))
            .select_related('spectacle').order_by('-date_rentree').first()
        )
        if recent:
            status = 'RETURNED - LATE' if recent.est_retard else 'RETURNED - ON TIME'
            person_info = {
                'matricule': person.mat, 'nom': person.nom, 'prenom': person.prenom,
                'compagnie': person.compagnie.label if person.compagnie else 'N/A',
                'spectacle_id': recent.spectacle_id, 'date_sortie': recent.spectacle.date_sortie,
                'date_limite_retour': recent.spectacle.date_limite_retour,
                'date_rentree': recent.date_rentree, 'est_retard': recent.est_retard, 'status': status,
            }
            return True, person_info, f"{person.nom} {person.prenom} - {status}"

        person_info = {
            'matricule': person.mat, 'nom': person.nom, 'prenom': person.prenom,
            'compagnie': person.compagnie.label if person.compagnie else 'N/A',
            'status': 'NOT ON SPECTACLE',
        }
        label = f"{person.nom} {person.prenom} - NOT ON SPECTACLE"
        return False, person_info, label
    except Exception as e:
        print(f"[ERROR] Failed to check person '{mat}': {e}")
        # The stream worker thread keeps one DB connection for its whole life. After a DB
        # restart/idle timeout it is dead; drop it so the next lookup reconnects.
        connection.close()
        return False, None, f"{mat} - ERROR"




def process_frame(frame, scale_x=1.0, scale_y=1.0, recognition_mode='checkin'):
    """Boxes for every face in the frame, labelled with spectacle status.

    Raises model_client.ModelServerError if the model server is down; the stream worker
    shows that as the frame error.
    """
    boxes = []
    should_mark_return = str(recognition_mode).lower() == 'return'

    for face in model_client.detect(frame):
        x1, y1, x2, y2 = face["bbox"]
        w, h = x2 - x1, y2 - y1
        if w <= 0 or h <= 0:
            continue

        # Create box info scaling back to original frame size
        box_info = {
            "box": (int(x1 * scale_x), int(y1 * scale_y), int(w * scale_x), int(h * scale_y)),
            "color": (0, 0, 255),  # Red default
            "label": "No match",
        }

        identity = face.get("person_id")
        if identity:
            is_eligible, person_info, label = check_spectacle_eligibility(identity, mark_return=should_mark_return)

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
                box_info["label"] = f"{identity} ({face.get('similarity', 0):.2f})"

        boxes.append(box_info)

    return boxes
