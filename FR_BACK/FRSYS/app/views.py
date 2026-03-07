from django.shortcuts import render
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from .models import Person, Compagnie, Camera, Spectacle, Rentree
from .serializers import PersonSerializer, CompagnieSerializer, CameraSerializer, SpectacleSerializer, RentreeSerializer
import pandas as pd

# api viewset for person crud operations
class PersonViewSet(viewsets.ModelViewSet):
    queryset = Person.objects.all()
    serializer_class = PersonSerializer

# api viewset for company crud operations
class CompagnieViewSet(viewsets.ModelViewSet):
    queryset = Compagnie.objects.all()
    serializer_class = CompagnieSerializer

# api viewset for camera crud operations
class CameraViewSet(viewsets.ModelViewSet):
    queryset = Camera.objects.all()
    serializer_class = CameraSerializer

# api viewset for outing records with excel import
class SpectacleViewSet(viewsets.ModelViewSet):
    queryset = Spectacle.objects.all()
    serializer_class = SpectacleSerializer

    # custom action to import spectacle data from excel file
    @action(detail=False, methods=["post"])
    def import_excel(self, request):
        # get uploaded file from request
        file = request.FILES.get("file")
        if not file:
            return Response({"error": "No file provided"}, status=status.HTTP_400_BAD_REQUEST)

        # read excel file into dataframe
        df = pd.read_excel(file)
        errors = []
        created = 0

        # loop through each row in excel file
        for idx, row in df.iterrows():
            try:
                # find person by matricule
                person = Person.objects.get(mat=row["matricule"])
                # create new spectacle record
                Spectacle.objects.create(
                    person=person,
                    date_sortie=row["date_sortie"],
                    date_limite_retour=row.get("date_limite_retour")
                )
                created += 1
            except Person.DoesNotExist:
                # track rows with missing person
                errors.append({"row": idx, "matricule": row["matricule"], "error": "Person not found"})

        # return summary of import results
        return Response({"created": created, "errors": errors})

# read-only api viewset for return event records
class RentreeViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Rentree.objects.all()
    serializer_class = RentreeSerializer