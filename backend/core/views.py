import re

from django.db import OperationalError, ProgrammingError
from django.db.models import Q
from rest_framework import mixins, permissions, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from .dataset import DatasetError, ensure_seeded, export_dataset, import_dataset
from .models import Club, Lineup, Match, MediaAsset, Player, SimulationSave
from .serializers import (
    ClubSerializer, LineupSerializer, MatchSerializer, MediaAssetSerializer, PlayerSerializer, SimulationSaveSerializer,
)

DISCLAIMER = (
    'Caspian Match Simulator is an independent, unofficial football simulation project. It is not affiliated with, '
    'sponsored by, or endorsed by any football league, federation, club, or game publisher. Simulated results and '
    'player ratings are fictional.'
)


GUEST_RE = re.compile(r'^[0-9a-f]{32}$')
MAX_SAVES_PER_GUEST = 100
MAX_MATCHES_PER_GUEST = 1000


def guest_id(request):
    """Anonymous visitor key sent by the frontend (X-AzPFL-Guest). No registration needed."""
    g = (request.headers.get('X-AzPFL-Guest') or '').strip().lower()
    return g if GUEST_RE.match(g) else None


class HasGuestId(permissions.BasePermission):
    message = 'missing visitor id'

    def has_permission(self, request, view):
        return guest_id(request) is not None


class IsAdminOrReadOnly(permissions.BasePermission):
    """Real football data and media: anyone can read, only staff can write."""

    def has_permission(self, request, view):
        return request.method in permissions.SAFE_METHODS or bool(request.user and request.user.is_staff)


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def health(request):
    return Response({'ok': True, 'disclaimer': DISCLAIMER, 'staff': bool(request.user and request.user.is_staff)})


@api_view(['DELETE'])
@permission_classes([HasGuestId])
def delete_my_data(request):
    """Removes everything stored for this visitor id (line-ups, simulated matches, saves)."""
    owner = guest_id(request)
    counts = {
        'lineups': Lineup.objects.filter(owner=owner).delete()[0],
        'matches': Match.objects.filter(kind='simulated', owner=owner).delete()[0],
        'saves': SimulationSave.objects.filter(owner=owner).delete()[0],
    }
    return Response({'deleted': counts})


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def bootstrap(request):
    """Everything the frontend needs at start-up, in the dataset JSON shape."""
    season = request.query_params.get('season', '2026-27')
    try:
        # safety net for fresh deployments: seed automatically if the database is empty
        if not Club.objects.exists():
            ensure_seeded()
    except (OperationalError, ProgrammingError):
        return Response({'error': 'database_unavailable'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
    return Response(export_dataset(season, request=request))


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def export_view(request):
    season = request.query_params.get('season', '2026-27')
    resp = Response(export_dataset(season, request=request, include_private_media=bool(request.user and request.user.is_staff)))
    resp['Content-Disposition'] = f'attachment; filename="azpfl-dataset-{season}.json"'
    return resp


@api_view(['POST'])
@permission_classes([permissions.IsAdminUser])
def import_view(request):
    try:
        summary = import_dataset(request.data, replace_players=request.query_params.get('replace', '1') != '0')
    except DatasetError as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    except (KeyError, TypeError, ValueError) as e:
        return Response({'error': f'invalid dataset: {e}'}, status=status.HTTP_400_BAD_REQUEST)
    return Response(summary)


class ClubViewSet(viewsets.ModelViewSet):
    queryset = Club.objects.select_related('stadium')
    serializer_class = ClubSerializer
    permission_classes = [IsAdminOrReadOnly]


class PlayerViewSet(viewsets.ModelViewSet):
    serializer_class = PlayerSerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        qs = Player.objects.all()
        club = self.request.query_params.get('club')
        if club:
            qs = qs.filter(club_id=club)
        q = self.request.query_params.get('q')
        if q:
            qs = qs.filter(Q(full_name__icontains=q) | Q(short_name__icontains=q))
        return qs

    @action(detail=True, methods=['post'])
    def transfer(self, request, pk=None):
        """Move a player to another club (or release with club = null)."""
        player = self.get_object()
        club_id = request.data.get('club')
        if club_id and not Club.objects.filter(pk=club_id).exists():
            return Response({'error': 'unknown club'}, status=400)
        number = request.data.get('number', player.number)
        if club_id and Player.objects.filter(club_id=club_id, number=number).exclude(pk=player.pk).exists():
            return Response({'error': f'number {number} already used in {club_id}'}, status=400)
        player.club_id = club_id or None
        player.number = number
        player.save()
        Lineup.objects.filter(captain=player).update(captain=None)
        return Response(PlayerSerializer(player).data)


class LineupViewSet(viewsets.ModelViewSet):
    """User line-ups. Saving a line-up with an existing (club, name) replaces it."""
    serializer_class = LineupSerializer
    permission_classes = [HasGuestId]

    def get_queryset(self):
        qs = Lineup.objects.filter(owner=guest_id(self.request))
        club = self.request.query_params.get('club')
        return qs.filter(club_id=club) if club else qs

    def create(self, request, *args, **kwargs):
        owner = guest_id(request)
        existing = Lineup.objects.filter(owner=owner, club_id=request.data.get('clubId'), name=request.data.get('name', 'default')).first()
        ser = self.get_serializer(existing, data=request.data) if existing else self.get_serializer(data=request.data)
        ser.is_valid(raise_exception=True)
        ser.save(owner=owner)
        return Response(ser.data, status=status.HTTP_200_OK if existing else status.HTTP_201_CREATED)


class MatchViewSet(mixins.CreateModelMixin, mixins.RetrieveModelMixin, mixins.ListModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet):
    """Simulated matches can be stored by anyone; real results only by staff (kind='real')."""
    serializer_class = MatchSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        # real results are public; simulated matches belong to the visitor who played them
        qs = Match.objects.prefetch_related('events', 'statistics').filter(Q(kind='real') | Q(kind='simulated', owner=guest_id(self.request) or '-'))
        kind = self.request.query_params.get('kind')
        if kind:
            qs = qs.filter(kind=kind)
        club = self.request.query_params.get('club')
        if club:
            qs = qs.filter(Q(home_id=club) | Q(away_id=club))
        return qs.filter(save_ref__isnull=True)

    def create(self, request, *args, **kwargs):
        if request.data.get('kind', 'simulated') == 'real' and not request.user.is_staff:
            return Response({'error': 'only staff can record real results'}, status=403)
        owner = guest_id(request)
        if request.data.get('kind', 'simulated') != 'real':
            if not owner:
                return Response({'error': 'missing visitor id'}, status=400)
            if Match.objects.filter(owner=owner).count() >= MAX_MATCHES_PER_GUEST:
                Match.objects.filter(pk__in=Match.objects.filter(owner=owner).order_by('created_at').values('pk')[:50]).delete()
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        kind = serializer.validated_data.get('kind', 'simulated')
        serializer.save(kind=kind, owner='' if kind == 'real' else guest_id(self.request))

    def destroy(self, request, *args, **kwargs):
        obj = self.get_object()
        if obj.kind == 'real' and not request.user.is_staff:
            return Response({'error': 'only staff can delete real results'}, status=403)
        return super().destroy(request, *args, **kwargs)


class SimulationSaveViewSet(viewsets.ModelViewSet):
    serializer_class = SimulationSaveSerializer
    permission_classes = [HasGuestId]

    def get_queryset(self):
        qs = SimulationSave.objects.filter(owner=guest_id(self.request))
        kind = self.request.query_params.get('kind')
        return qs.filter(kind=kind) if kind else qs

    def create(self, request, *args, **kwargs):
        if SimulationSave.objects.filter(owner=guest_id(request)).count() >= MAX_SAVES_PER_GUEST:
            return Response({'error': 'too_many_saves'}, status=400)
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        serializer.save(owner=guest_id(self.request))


class MediaAssetViewSet(viewsets.ModelViewSet):
    """Media registry. Public users only see enabled assets with confirmed rights."""
    serializer_class = MediaAssetSerializer
    permission_classes = [IsAdminOrReadOnly]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        qs = MediaAsset.objects.all()
        if not (self.request.user and self.request.user.is_staff):
            qs = qs.filter(enabled=True, permission_status='confirmed')
        club = self.request.query_params.get('club')
        return qs.filter(club_id=club) if club else qs
