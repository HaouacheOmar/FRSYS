from django.utils import timezone
from ..models import Spectacle, Rentree

# update spectacle when person returns and create rentree record
def update_spectacle_and_rentree(person, camera):
    # find active outing for this person
    spectacle = Spectacle.objects.filter(person=person, date_rentree__isnull=True).first()
    if not spectacle:
        return False

    now = timezone.now()
    est_retard = now > spectacle.date_limite_retour

    # update spectacle with return time and late status
    spectacle.date_rentree = now
    spectacle.est_retard = est_retard
    spectacle.save()

    # create rentree history record
    Rentree.objects.create(
        person=person,
        spectacle=spectacle,
        camera=camera,
        date_sortie=spectacle.date_sortie,
        date_rentree=now,
        est_retard=est_retard
    )
    return est_retard