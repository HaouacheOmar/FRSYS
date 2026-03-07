from django.db import models
from pgvector.django import VectorField

# models for people, cameras, and attendance records

# company table
class Compagnie(models.Model):
    # company name
    label = models.CharField(max_length=150)

    def __str__(self):
        return self.label

# person table
class Person(models.Model):
    # unique matricule
    mat = models.CharField(max_length=50, unique=True)
    nom = models.CharField(max_length=150)
    prenom = models.CharField(max_length=150)
    # folder path for person photos
    path_dir_photo = models.CharField(max_length=500, null=True, blank=True)
    # link person to a company
    compagnie = models.ForeignKey(Compagnie, on_delete=models.CASCADE, related_name="persons")
    # face embedding vector stored with pgvector
    embedding = VectorField(dimensions=512, null=True, blank=True)

    def __str__(self):
        return f"{self.nom} {self.prenom} ({self.mat})"

# camera table
class Camera(models.Model):
    # camera ip must be unique
    ip_address = models.GenericIPAddressField(unique=True)
    model_name = models.CharField(max_length=150)
    location = models.CharField(max_length=150, null=True, blank=True)
    # tells if this camera is enabled
    is_active = models.BooleanField(default=True)
    # created date is set once on insert
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.model_name} - {self.ip_address}"

# outing record table
class Spectacle(models.Model):
    person = models.ForeignKey(Person, on_delete=models.CASCADE)
    # time when person goes out
    date_sortie = models.DateTimeField()
    # time when person comes back
    date_rentree = models.DateTimeField(null=True, blank=True)
    # true if person is late
    est_retard = models.BooleanField(default=False)
    # return deadline used to detect late status
    date_limite_retour = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.person} - {self.date_sortie.date()}"

# return event table with camera and outing details
class Rentree(models.Model):
    person = models.ForeignKey(Person, on_delete=models.CASCADE)
    spectacle = models.ForeignKey(Spectacle, on_delete=models.CASCADE)
    camera = models.ForeignKey(Camera, on_delete=models.CASCADE)
    date_sortie = models.DateTimeField()
    date_rentree = models.DateTimeField()
    est_retard = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.person} rentree {self.date_rentree}"