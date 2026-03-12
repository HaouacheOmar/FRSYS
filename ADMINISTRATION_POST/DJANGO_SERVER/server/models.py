from django.db import models
from django.db.models import F, Q

# Create your models here.

# models for people, cameras, and attendance records

# company table
class Compagnie(models.Model):
    # company name
    label = models.CharField(max_length=150, db_index=True)

    class Meta:
        ordering = ["label"]

    def __str__(self):
        return self.label

# person table
class Person(models.Model):
    # unique matricule
    mat = models.CharField(max_length=50, unique=True)
    nom = models.CharField(max_length=150)
    prenom = models.CharField(max_length=150)
    # folder path containing person's face photos for recognition
    path_dir_photo = models.CharField(max_length=500, null=True, blank=True)
    # link person to a company
    compagnie = models.ForeignKey(Compagnie, on_delete=models.CASCADE, related_name="persons")
   
    embedding = models.TextField(null=True, blank=True)

    def __str__(self):
        return f"{self.nom} {self.prenom} ({self.mat})"

    class Meta:
        ordering = ["nom", "prenom", "mat"]
        indexes = [
            models.Index(fields=["compagnie", "nom", "prenom"], name="idx_person_comp_nom_pre"),
            models.Index(fields=["nom", "prenom"], name="idx_person_nom_pre"),
        ]

# camera table
class Camera(models.Model):
    # camera ip must be unique
    ip_address = models.GenericIPAddressField(unique=True)
    model_name = models.CharField(max_length=150)
    # tells if this camera is enabled
    is_active = models.BooleanField(default=True, db_index=True)
    username = models.CharField(max_length=150, null=True, blank=True)
    password = models.CharField(max_length=150, null=True, blank=True)
    # RTSP stream port (default 554) and stream path
    rtsp_port = models.PositiveIntegerField(default=554)
    rtsp_path = models.CharField(max_length=500, default='/stream', blank=True)

    def __str__(self):
        return f"{self.model_name} - {self.ip_address}"

# outing record table
class Spectacle(models.Model):
    person = models.ForeignKey(Person, on_delete=models.CASCADE, related_name="spectacles")
    # time when person goes out
    date_sortie = models.DateTimeField()
    # time when person comes back
    date_rentree = models.DateTimeField(null=True, blank=True)
    # return deadline used to detect late status
    date_limite_retour = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.person} - {self.date_sortie.date()}"

    class Meta:
        ordering = ["-date_sortie"]
        indexes = [
            models.Index(fields=["person", "date_rentree"], name="idx_spec_person_open"),
            models.Index(fields=["date_sortie"], name="idx_spec_sortie"),
            models.Index(fields=["date_rentree"], name="idx_spec_rentree"),
            models.Index(fields=["date_limite_retour"], name="idx_spec_limite"),
        ]
        constraints = [
            models.CheckConstraint(
                condition=Q(date_rentree__isnull=True) | Q(date_rentree__gte=F("date_sortie")),
                name="chk_spec_rentree_after_sortie",
            ),
            models.CheckConstraint(
                condition=Q(date_limite_retour__isnull=True) | Q(date_limite_retour__gte=F("date_sortie")),
                name="chk_spec_limite_after_sortie",
            ),
        ]

# return event table with camera and outing details
class Rentree(models.Model):
    person = models.ForeignKey(Person, on_delete=models.CASCADE)
    # One return event per spectacle (same spectacle_id)
    spectacle = models.OneToOneField(Spectacle, on_delete=models.CASCADE, related_name="rentree")
    # Actual return timestamp for this spectacle
    date_rentree = models.DateTimeField()
    est_retard = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.person} rentree {self.date_rentree}"

    class Meta:
        ordering = ["-date_rentree"]
        indexes = [
            models.Index(fields=["est_retard", "date_rentree"], name="idx_rent_late_date"),
            models.Index(fields=["person", "date_rentree"], name="idx_rent_person_date"),
        ]