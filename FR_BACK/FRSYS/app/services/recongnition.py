from deepface import DeepFace
from pgvector.django import L2Distance
from ..models import Person


# this function gets a face embedding from one image frame
def get_embedding(frame):
    # use arcface model and return only the embedding vector
    return DeepFace.represent(frame, model_name="ArcFace", enforce_detection=False)[0]["embedding"]


# this function finds the closest person in database using vector distance
def find_closest_person(embedding):
    # compute distance between saved embedding and input embedding
    # sort by smallest distance and return first match with person data
    return Person.objects.annotate(
        distance=L2Distance("embedding", embedding)
    ).order_by("distance").select_related("compagnie").values(
        "id", "nom", "prenom", "mat", "compagnie__label", "distance"
    ).first()