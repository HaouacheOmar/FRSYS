from rest_framework import serializers
from .models import Person, Compagnie, Camera, Spectacle, Rentree, spectacle_date_errors

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
        # No "embedding": biometric data, unused by the app, and nested into every Spectacle/Rentree response.
        fields = ["id", "mat", "nom", "prenom", "path_dir_photo", "compagnie", "compagnie_id"]

# serializer for camera data
class CameraSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    has_password = serializers.SerializerMethodField(read_only=True)
    rtsp_url = serializers.SerializerMethodField(read_only=True)

    def get_has_password(self, obj):
        return bool(obj.password)

    def get_rtsp_url(self, obj):
        return obj.rtsp_url(mask=True)  # never send the camera password to clients

    def create(self, validated_data):
        raw_password = validated_data.pop('password', None)
        camera = Camera(**validated_data)
        if raw_password is not None:
            camera.set_camera_password(raw_password)
        camera.save()
        return camera

    def update(self, instance, validated_data):
        raw_password = validated_data.pop('password', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if raw_password is not None:
            instance.set_camera_password(raw_password)

        instance.save()
        return instance

    class Meta:
        model = Camera
        fields = ["id", "ip_address", "model_name", "username", "password", "has_password", "rtsp_url", "is_active", "rtsp_port", "rtsp_path"]

# serializer for outing records
class SpectacleSerializer(serializers.ModelSerializer):
    # show full person info when reading
    person = PersonSerializer(read_only=True)
    # accept person id when creating or updating
    person_id = serializers.PrimaryKeyRelatedField(queryset=Person.objects.all(), source='person', write_only=True)

    def validate(self, attrs):
        # On PATCH, fields not sent keep their stored value.
        def current(field):
            return attrs.get(field, getattr(self.instance, field, None))

        errors = spectacle_date_errors(current('date_sortie'), current('date_rentree'), current('date_limite_retour'))
        if errors:
            raise serializers.ValidationError(errors)
        return attrs

    class Meta:
        model = Spectacle
        fields = ["id", "person", "person_id", "title", "date_sortie", "date_rentree", "date_limite_retour"]

# serializer for return event records
class RentreeSerializer(serializers.ModelSerializer):
    # show full nested objects when reading
    person = PersonSerializer(read_only=True)
    spectacle = SpectacleSerializer(read_only=True)
    # accept ids when creating or updating
    person_id = serializers.PrimaryKeyRelatedField(queryset=Person.objects.all(), source='person', write_only=True)
    spectacle_id = serializers.PrimaryKeyRelatedField(queryset=Spectacle.objects.all(), source='spectacle', write_only=True)

    def validate(self, attrs):
        # On PATCH, fields not sent keep their stored value (otherwise est_retard gets reset).
        spectacle = attrs.get('spectacle', getattr(self.instance, 'spectacle', None))
        provided_person = attrs.get('person')
        date_rentree = attrs.get('date_rentree', getattr(self.instance, 'date_rentree', None))

        if spectacle and provided_person and spectacle.person_id != provided_person.id:
            raise serializers.ValidationError({
                'person_id': 'person_id must match spectacle.person.'
            })

        # spectacle is a OneToOne: a second return for it would be an IntegrityError (500).
        if spectacle and Rentree.objects.filter(spectacle=spectacle).exclude(pk=getattr(self.instance, 'pk', None)).exists():
            raise serializers.ValidationError({
                'spectacle_id': 'This spectacle already has a return.'
            })

        date_errors = spectacle_date_errors(spectacle.date_sortie if spectacle else None, date_rentree)
        if date_errors:
            raise serializers.ValidationError(date_errors)

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