from rest_framework import serializers
from .models import Person, Compagnie, Camera, Spectacle, Rentree

# serializer for company data
class CompagnieSerializer(serializers.ModelSerializer):
    class Meta:
        model = Compagnie
        fields = ["id", "label"]

# serializer for person data
class PersonSerializer(serializers.ModelSerializer):
    # show full company info when reading
    compagnie = CompagnieSerializer(read_only=True)
    # accept company id when creating or updating
    compagnie_id = serializers.PrimaryKeyRelatedField(queryset=Compagnie.objects.all(), source='compagnie', write_only=True)

    class Meta:
        model = Person
        fields = ["id", "mat", "nom", "prenom", "path_dir_photo", "compagnie", "compagnie_id", "embedding"]

# serializer for camera data
class CameraSerializer(serializers.ModelSerializer):
    class Meta:
        model = Camera
        fields = ["id", "ip_address", "model_name", "location", "is_active"]

# serializer for outing records
class SpectacleSerializer(serializers.ModelSerializer):
    # show full person info when reading
    person = PersonSerializer(read_only=True)
    # accept person id when creating or updating
    person_id = serializers.PrimaryKeyRelatedField(queryset=Person.objects.all(), source='person', write_only=True)

    class Meta:
        model = Spectacle
        fields = ["id", "person", "person_id", "date_sortie", "date_rentree", "est_retard", "date_limite_retour"]

# serializer for return event records
class RentreeSerializer(serializers.ModelSerializer):
    # show full nested objects when reading
    person = PersonSerializer(read_only=True)
    spectacle = SpectacleSerializer(read_only=True)
    camera = CameraSerializer(read_only=True)

    class Meta:
        model = Rentree
        fields = ["id", "person", "spectacle", "camera", "date_sortie", "date_rentree", "est_retard"]