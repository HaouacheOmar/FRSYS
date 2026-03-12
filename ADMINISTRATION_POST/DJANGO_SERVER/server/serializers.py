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
        fields = ["id", "ip_address", "model_name", "username", "password", "is_active", "rtsp_port", "rtsp_path"]

# serializer for outing records
class SpectacleSerializer(serializers.ModelSerializer):
    # show full person info when reading
    person = PersonSerializer(read_only=True)
    # accept person id when creating or updating
    person_id = serializers.PrimaryKeyRelatedField(queryset=Person.objects.all(), source='person', write_only=True)

    class Meta:
        model = Spectacle
        fields = ["id", "person", "person_id", "date_sortie", "date_rentree", "date_limite_retour"]

# serializer for return event records
class RentreeSerializer(serializers.ModelSerializer):
    # show full nested objects when reading
    person = PersonSerializer(read_only=True)
    spectacle = SpectacleSerializer(read_only=True)
    # accept ids when creating or updating
    person_id = serializers.PrimaryKeyRelatedField(queryset=Person.objects.all(), source='person', write_only=True)
    spectacle_id = serializers.PrimaryKeyRelatedField(queryset=Spectacle.objects.all(), source='spectacle', write_only=True)

    def validate(self, attrs):
        spectacle = attrs.get('spectacle')
        provided_person = attrs.get('person')
        date_rentree = attrs.get('date_rentree')

        if spectacle and provided_person and spectacle.person_id != provided_person.id:
            raise serializers.ValidationError({
                'person_id': 'person_id must match spectacle.person.'
            })

        if date_rentree and spectacle and spectacle.date_sortie and date_rentree < spectacle.date_sortie:
            raise serializers.ValidationError({
                'date_rentree': 'date_rentree must be after or equal to spectacle.date_sortie.'
            })

        # Normalize person from spectacle to prevent mismatch in writes.
        if spectacle:
            attrs['person'] = spectacle.person

        # Auto-compute late flag from spectacle deadline if present.
        limite = spectacle.date_limite_retour if spectacle else None
        attrs['est_retard'] = bool(limite and date_rentree and date_rentree > limite)
        return attrs

    class Meta:
        model = Rentree
        fields = ["id", "person", "person_id", "spectacle", "spectacle_id", "date_rentree", "est_retard"]