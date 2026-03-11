from django.shortcuts import render
from django.http import JsonResponse
from django.db import transaction
from django.utils import timezone
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
import pandas as pd
from .models import Person, Compagnie, Camera, Spectacle, Rentree
from .serializers import (
    PersonSerializer, 
    CompagnieSerializer, 
    CameraSerializer, 
    SpectacleSerializer, 
    RentreeSerializer
)


def video_stream_view(request):
    """Render the video stream viewer page."""
    return render(request, 'video_stream.html')


def api_status(request):
    """API endpoint to check service status."""
    return JsonResponse({
        'status': 'online',
        'service': 'Face Recognition System',
        'endpoints': {
            'video_stream': '/video-stream/',
            'ws_stream': 'ws://localhost:8000/ws/video/stream/',
            'ws_recognize': 'ws://localhost:8000/ws/face/recognize/',
            'api': {
                'compagnies': '/api/compagnies/',
                'persons': '/api/persons/',
                'cameras': '/api/cameras/',
                'spectacles': '/api/spectacles/',
                'rentrees': '/api/rentrees/',
            }
        }
    })




class CompagnieViewSet(viewsets.ModelViewSet):
    """
    API endpoint for managing companies.
    
    Provides CRUD operations:
    - GET /api/compagnies/ - List all companies
    - POST /api/compagnies/ - Create new company
    - GET /api/compagnies/{id}/ - Retrieve specific company
    - PUT /api/compagnies/{id}/ - Update company
    - PATCH /api/compagnies/{id}/ - Partial update
    - DELETE /api/compagnies/{id}/ - Delete company
    """
    queryset = Compagnie.objects.all()
    serializer_class = CompagnieSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['label']
    ordering_fields = ['id', 'label']
    ordering = ['id']

    def get_queryset(self):
        """Optimize queryset based on action."""
        queryset = super().get_queryset()
        # Prefetch persons for list view to avoid N+1 queries
        if self.action == 'list':
            queryset = queryset.prefetch_related('persons')
        return queryset

    @action(detail=True, methods=['get'])
    def persons(self, request, pk=None):
        """Get all persons belonging to this company."""
        compagnie = self.get_object()
        # Optimize: eager load compagnie relation to avoid duplicate queries
        persons = compagnie.persons.select_related('compagnie').all()
        serializer = PersonSerializer(persons, many=True)
        return Response(serializer.data)


class PersonViewSet(viewsets.ModelViewSet):
    """
    API endpoint for managing persons.
    
    Provides CRUD operations:
    - GET /api/persons/ - List all persons
    - POST /api/persons/ - Create new person
    - GET /api/persons/{id}/ - Retrieve specific person
    - PUT /api/persons/{id}/ - Update person
    - PATCH /api/persons/{id}/ - Partial update
    - DELETE /api/persons/{id}/ - Delete person
    
    Filters:
    - ?compagnie={id} - Filter by company
    - ?mat={matricule} - Filter by matricule
    - ?search={query} - Search in nom, prenom, mat
    """
    queryset = Person.objects.select_related('compagnie')
    serializer_class = PersonSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['compagnie', 'mat']
    search_fields = ['nom', 'prenom', 'mat']
    ordering_fields = ['id', 'nom', 'prenom', 'mat']
    ordering = ['id']

    def get_queryset(self):
        """Optimize queryset - always select_related compagnie."""
        return super().get_queryset().select_related('compagnie')

    @action(detail=True, methods=['get'])
    def spectacles(self, request, pk=None):
        """Get all outings for this person."""
        person = self.get_object()
        # Optimize: eager load person and compagnie to avoid N+1
        spectacles = Spectacle.objects.filter(person=person).select_related('person__compagnie')
        serializer = SpectacleSerializer(spectacles, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def rentrees(self, request, pk=None):
        """Get all return events for this person."""
        person = self.get_object()
        # Optimize: eager load all related data
        rentrees = Rentree.objects.filter(person=person).select_related(
            'person__compagnie',
            'spectacle__person__compagnie'
        )
        serializer = RentreeSerializer(rentrees, many=True)
        return Response(serializer.data)


class CameraViewSet(viewsets.ModelViewSet):
    """
    API endpoint for managing cameras.
    
    Provides CRUD operations:
    - GET /api/cameras/ - List all cameras
    - POST /api/cameras/ - Create new camera
    - GET /api/cameras/{id}/ - Retrieve specific camera
    - PUT /api/cameras/{id}/ - Update camera
    - PATCH /api/cameras/{id}/ - Partial update
    - DELETE /api/cameras/{id}/ - Delete camera
    
    Filters:
    - ?is_active={true/false} - Filter by active status
    - ?search={query} - Search in model_name, ip_address
    """
    queryset = Camera.objects.all()
    serializer_class = CameraSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['is_active']
    search_fields = ['model_name', 'ip_address']
    ordering_fields = ['id', 'model_name', 'ip_address', 'is_active']
    ordering = ['id']

    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        """Activate a camera."""
        camera = self.get_object()
        camera.is_active = True
        camera.save()
        serializer = self.get_serializer(camera)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def deactivate(self, request, pk=None):
        """Deactivate a camera."""
        camera = self.get_object()
        camera.is_active = False
        camera.save()
        serializer = self.get_serializer(camera)
        return Response(serializer.data)


class SpectacleViewSet(viewsets.ModelViewSet):
    """
    API endpoint for managing outing records (spectacles).
    
    Provides CRUD operations:
    - GET /api/spectacles/ - List all outings
    - POST /api/spectacles/ - Create new outing
    - GET /api/spectacles/{id}/ - Retrieve specific outing
    - PUT /api/spectacles/{id}/ - Update outing
    - PATCH /api/spectacles/{id}/ - Partial update
    - DELETE /api/spectacles/{id}/ - Delete outing
    
    Filters:
    - ?person={id} - Filter by person
    - ?date_sortie={date} - Filter by exit date
    """
    queryset = Spectacle.objects.select_related('person__compagnie')
    serializer_class = SpectacleSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['person', 'date_sortie']
    ordering_fields = ['id', 'date_sortie', 'date_rentree', 'date_limite_retour']
    ordering = ['-date_sortie']

    def _normalize_columns(self, df):
        df.columns = [str(col).strip().lower() for col in df.columns]
        return df

    def _parse_datetime_value(self, value):
        if pd.isna(value) or value == "":
            return None

        parsed = pd.to_datetime(value, errors="coerce")
        if pd.isna(parsed):
            return None

        dt = parsed.to_pydatetime()
        if timezone.is_naive(dt):
            dt = timezone.make_aware(dt, timezone.get_current_timezone())
        return dt

    def create(self, request, *args, **kwargs):
        """
        Supports 2 modes:
        1) Default JSON create (existing behavior)
        2) Excel bulk import when a file is sent in request.FILES["file"] or ["excel"]
        """
        excel_file = request.FILES.get("file") or request.FILES.get("excel")
        if not excel_file:
            return super().create(request, *args, **kwargs)

        try:
            df = pd.read_excel(excel_file)
        except Exception as exc:
            return Response(
                {"detail": f"Invalid Excel file: {exc}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if df.empty:
            return Response(
                {"detail": "Excel file is empty."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        df = self._normalize_columns(df)

        mat_col = None
        for candidate in ["mat", "person_mat", "person_matricule", "matricule"]:
            if candidate in df.columns:
                mat_col = candidate
                break

        if not mat_col:
            return Response(
                {
                    "detail": "Missing matricule column. Use one of: mat, person_mat, person_matricule, matricule."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if "date_sortie" not in df.columns:
            return Response(
                {"detail": "Missing required column: date_sortie."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        mats = [str(m).strip() for m in df[mat_col].tolist() if not pd.isna(m) and str(m).strip()]
        persons_by_mat = {
            p.mat: p
            for p in Person.objects.filter(mat__in=set(mats)).only("id", "mat")
        }

        to_create = []
        errors = []

        for idx, row in df.iterrows():
            line_no = idx + 2
            mat = str(row.get(mat_col, "")).strip()
            if not mat or mat.lower() == "nan":
                errors.append(f"Row {line_no}: missing mat value")
                continue

            person = persons_by_mat.get(mat)
            if not person:
                errors.append(f"Row {line_no}: person with mat '{mat}' not found")
                continue

            date_sortie = self._parse_datetime_value(row.get("date_sortie"))
            if not date_sortie:
                errors.append(f"Row {line_no}: invalid date_sortie")
                continue

            date_rentree = self._parse_datetime_value(row.get("date_rentree"))
            date_limite_retour = self._parse_datetime_value(row.get("date_limite_retour"))

            to_create.append(
                Spectacle(
                    person=person,
                    date_sortie=date_sortie,
                    date_rentree=date_rentree,
                    date_limite_retour=date_limite_retour,
                )
            )

        if not to_create:
            return Response(
                {"detail": "No valid rows to insert.", "errors": errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            created = Spectacle.objects.bulk_create(to_create)

        created_ids = [obj.id for obj in created if obj.id is not None]
        created_qs = self.get_queryset().filter(id__in=created_ids)
        serializer = self.get_serializer(created_qs, many=True)

        return Response(
            {
                "message": "Spectacles imported successfully.",
                "created_count": len(created_ids),
                "error_count": len(errors),
                "errors": errors,
                "data": serializer.data,
            },
            status=status.HTTP_201_CREATED,
        )

    def get_queryset(self):
        """Optimize queryset - always eager load person and compagnie."""
        return super().get_queryset().select_related('person__compagnie')

    @action(detail=False, methods=['get'])
    def pending(self, request):
        """Get all outings without a return time."""
        # Use get_queryset() to maintain optimization
        pending_spectacles = self.get_queryset().filter(date_rentree__isnull=True)
        serializer = self.get_serializer(pending_spectacles, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def completed(self, request):
        """Get all outings with a return time."""
        # Use get_queryset() to maintain optimization
        completed_spectacles = self.get_queryset().filter(date_rentree__isnull=False)
        serializer = self.get_serializer(completed_spectacles, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def mark_return(self, request, pk=None):
        """Mark the return time for an outing."""
        spectacle = self.get_object()
        raw_date_rentree = request.data.get('date_rentree')
        date_rentree = self._parse_datetime_value(raw_date_rentree) if raw_date_rentree else timezone.now()

        if date_rentree is None:
            return Response(
                {'detail': 'Invalid date_rentree format.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        est_retard = bool(
            spectacle.date_limite_retour and date_rentree > spectacle.date_limite_retour
        )

        with transaction.atomic():
            spectacle.date_rentree = date_rentree
            spectacle.save(update_fields=['date_rentree'])

            Rentree.objects.update_or_create(
                spectacle=spectacle,
                defaults={
                    'person': spectacle.person,
                    'date_rentree': date_rentree,
                    'est_retard': est_retard,
                },
            )

        serializer = self.get_serializer(spectacle)
        return Response(serializer.data)


class RentreeViewSet(viewsets.ModelViewSet):
    """
    API endpoint for managing return events.
    
    Provides CRUD operations:
    - GET /api/rentrees/ - List all return events
    - POST /api/rentrees/ - Create new return event
    - GET /api/rentrees/{id}/ - Retrieve specific return event
    - PUT /api/rentrees/{id}/ - Update return event
    - PATCH /api/rentrees/{id}/ - Partial update
    - DELETE /api/rentrees/{id}/ - Delete return event
    
    Filters:
    - ?person={id} - Filter by person
    - ?spectacle={id} - Filter by outing
    - ?est_retard={true/false} - Filter by late status
    """
    queryset = Rentree.objects.select_related(
        'person__compagnie',
        'spectacle__person__compagnie'
    )
    serializer_class = RentreeSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['person', 'spectacle', 'est_retard']
    ordering_fields = ['id', 'date_rentree', 'est_retard']
    ordering = ['-date_rentree']

    def get_queryset(self):
        """Optimize queryset - eager load all nested relations."""
        return super().get_queryset().select_related(
            'person__compagnie',
            'spectacle__person__compagnie'
        )

    @action(detail=False, methods=['get'])
    def late_returns(self, request):
        """Get all late return events."""
        # Use get_queryset() to maintain optimization
        late_rentrees = self.get_queryset().filter(est_retard=True)
        serializer = self.get_serializer(late_rentrees, many=True)
        return Response(serializer.data)

    def perform_create(self, serializer):
        """Create rentree and synchronize corresponding spectacle return date."""
        with transaction.atomic():
            rentree = serializer.save()
            spectacle = rentree.spectacle
            if spectacle.date_rentree != rentree.date_rentree:
                spectacle.date_rentree = rentree.date_rentree
                spectacle.save(update_fields=['date_rentree'])

    def perform_update(self, serializer):
        """Update rentree and keep spectacle return date in sync."""
        with transaction.atomic():
            rentree = serializer.save()
            spectacle = rentree.spectacle
            if spectacle.date_rentree != rentree.date_rentree:
                spectacle.date_rentree = rentree.date_rentree
                spectacle.save(update_fields=['date_rentree'])
