from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from rest_framework import serializers

from .dataset import club_to_json, media_to_json, player_to_json
from .models import Club, Formation, Lineup, MediaAsset, Match, MatchEvent, MatchStatistics, Player, SimulationSave, Stadium

ALLOWED_MEDIA = {'image/png': 'png', 'image/webp': 'webp', 'image/svg+xml': 'svg'}
MAX_MEDIA_BYTES = 2 * 1024 * 1024


class ClubSerializer(serializers.ModelSerializer):
    """Read/write in the frontend's camelCase shape."""

    class Meta:
        model = Club
        fields = ['id']

    def to_representation(self, instance):
        return club_to_json(instance)

    def to_internal_value(self, data):
        out = {}
        mapping = {'name': 'name', 'shortName': 'short_name', 'code': 'code', 'city': 'city', 'coach': 'coach', 'coachSince': 'coach_since'}
        for k, f in mapping.items():
            if k in data:
                out[f] = data[k] or None if f in ('coach', 'coach_since') else data[k]
        if 'id' in data and not self.instance:
            out['id'] = data['id']
        colors = data.get('colors')
        if isinstance(colors, dict):
            if 'primary' in colors:
                out['primary_color'] = colors['primary']
            if 'secondary' in colors:
                out['secondary_color'] = colors['secondary']
            if 'verified' in colors:
                out['colors_verified'] = bool(colors['verified'])
        st = data.get('stadium')
        if isinstance(st, dict) and st.get('name'):
            stadium, _ = Stadium.objects.get_or_create(name=st['name'], city=data.get('city', getattr(self.instance, 'city', '')))
            if st.get('capacity') is not None:
                stadium.capacity = st['capacity']
                stadium.save()
            out['stadium'] = stadium
        for f in ('code',):
            if f in out and len(out[f]) != 3:
                raise serializers.ValidationError({'code': 'must be 3 characters'})
        return out

    def create(self, validated):
        return Club.objects.create(**validated)

    def update(self, instance, validated):
        for k, v in validated.items():
            setattr(instance, k, v)
        instance.save()
        return instance


class PlayerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Player
        fields = ['id']

    def to_representation(self, instance):
        return player_to_json(instance)

    def to_internal_value(self, data):
        out = {}
        mapping = {
            'clubId': 'club_id', 'fullName': 'full_name', 'shortName': 'short_name', 'number': 'number', 'birthDate': 'birth_date',
            'nationality': 'nationality', 'position': 'position', 'secondary': 'secondary', 'heightCm': 'height_cm', 'foot': 'foot',
            'status': 'status', 'gk': 'gk', 'isPlaceholder': 'is_placeholder', 'sourceId': 'source_id',
        }
        for k, f in mapping.items():
            if k in data:
                out[f] = data[k]
        if 'id' in data and not self.instance:
            out['id'] = data['id']
        attrs = data.get('attrs')
        if isinstance(attrs, dict):
            for k in ['pac', 'sho', 'pas', 'dri', 'def', 'phy']:
                if k in attrs:
                    v = attrs[k]
                    if not isinstance(v, int) or not 1 <= v <= 99:
                        raise serializers.ValidationError({'attrs': f'{k} must be an integer 1..99'})
                    out['defe' if k == 'def' else k] = v
        if out.get('club_id') and not Club.objects.filter(pk=out['club_id']).exists():
            raise serializers.ValidationError({'clubId': 'unknown club'})
        if not self.instance:
            for req in ['id', 'full_name', 'number', 'position']:
                if req not in out:
                    raise serializers.ValidationError({req: 'required'})
            out.setdefault('short_name', out['full_name'].split(' ')[-1])
        return out

    def _save(self, instance):
        try:
            instance.full_clean(exclude=['source', 'club'])
        except DjangoValidationError as e:
            raise serializers.ValidationError(e.message_dict)
        instance.save()
        return instance

    def create(self, validated):
        return self._save(Player(**validated))

    def update(self, instance, validated):
        for k, v in validated.items():
            setattr(instance, k, v)
        return self._save(instance)


class LineupSerializer(serializers.ModelSerializer):
    clubId = serializers.PrimaryKeyRelatedField(source='club', queryset=Club.objects.all())
    formation = serializers.PrimaryKeyRelatedField(queryset=Formation.objects.all())
    customPos = serializers.JSONField(source='custom_pos', required=False, allow_null=True)
    captainId = serializers.PrimaryKeyRelatedField(source='captain', queryset=Player.objects.all(), allow_null=True, required=False)
    penaltyTakerId = serializers.PrimaryKeyRelatedField(source='penalty_taker', queryset=Player.objects.all(), allow_null=True, required=False)
    freeKickTakerId = serializers.PrimaryKeyRelatedField(source='free_kick_taker', queryset=Player.objects.all(), allow_null=True, required=False)
    cornerTakerId = serializers.PrimaryKeyRelatedField(source='corner_taker', queryset=Player.objects.all(), allow_null=True, required=False)
    updatedAt = serializers.DateTimeField(source='updated_at', read_only=True)

    class Meta:
        model = Lineup
        fields = ['id', 'clubId', 'name', 'formation', 'slots', 'customPos', 'bench', 'captainId', 'penaltyTakerId',
                  'freeKickTakerId', 'cornerTakerId', 'tactics', 'updatedAt']
        validators = []  # (club, name) upsert handled in the view

    def validate(self, attrs):
        club = attrs.get('club') or getattr(self.instance, 'club', None)
        slots = attrs.get('slots', getattr(self.instance, 'slots', {}))
        bench = attrs.get('bench', getattr(self.instance, 'bench', []))
        if not isinstance(slots, dict) or not isinstance(bench, list):
            raise serializers.ValidationError('slots must be an object and bench a list')
        xi = list(slots.values())
        if len(xi) != 11:
            raise serializers.ValidationError({'slots': f'starting XI must have exactly 11 players (got {len(xi)})'})
        everyone = xi + bench
        if len(set(everyone)) != len(everyone):
            raise serializers.ValidationError({'slots': 'a player can appear only once in a line-up'})
        if len(bench) > 9:
            raise serializers.ValidationError({'bench': 'at most 9 substitutes'})
        players = {p.id: p for p in Player.objects.filter(id__in=everyone)}
        for pid in everyone:
            p = players.get(pid)
            if not p:
                raise serializers.ValidationError({'slots': f'unknown player {pid}'})
            if p.club_id != club.id:
                raise serializers.ValidationError({'slots': f'{pid} does not belong to {club.id}'})
            if p.status != 'available':
                raise serializers.ValidationError({'slots': f'{pid} is {p.status}'})
        for f in ['captain', 'penalty_taker', 'free_kick_taker', 'corner_taker']:
            p = attrs.get(f)
            if p and p.id not in xi:
                raise serializers.ValidationError({f: 'must be in the starting XI'})
        return attrs


class MatchEventSerializer(serializers.ModelSerializer):
    playerId = serializers.CharField(source='player_id', required=False, allow_blank=True, default='')
    secondaryPlayerId = serializers.CharField(source='secondary_player_id', required=False, allow_blank=True, default='')
    id = serializers.IntegerField(source='seq')

    class Meta:
        model = MatchEvent
        fields = ['id', 'minute', 'added', 'type', 'side', 'playerId', 'secondaryPlayerId', 'xg', 'detail', 'score']
        extra_kwargs = {'side': {'required': False, 'allow_blank': True}, 'detail': {'required': False, 'allow_blank': True}}


class StatsSerializer(serializers.ModelSerializer):
    shotsOnTarget = serializers.IntegerField(source='shots_on_target')
    passesCompleted = serializers.IntegerField(source='passes_completed')
    passAccuracy = serializers.IntegerField(source='pass_accuracy')

    class Meta:
        model = MatchStatistics
        fields = ['possession', 'shots', 'shotsOnTarget', 'xg', 'passes', 'passesCompleted', 'passAccuracy', 'corners', 'fouls',
                  'yellow', 'red', 'saves', 'offsides']


class MatchSerializer(serializers.ModelSerializer):
    homeId = serializers.PrimaryKeyRelatedField(source='home', queryset=Club.objects.all())
    awayId = serializers.PrimaryKeyRelatedField(source='away', queryset=Club.objects.all())
    homeGoals = serializers.IntegerField(source='home_goals', min_value=0, max_value=99)
    awayGoals = serializers.IntegerField(source='away_goals', min_value=0, max_value=99)
    halfTime = serializers.ListField(child=serializers.IntegerField(min_value=0), required=False, allow_null=True, write_only=True)
    extraTime = serializers.BooleanField(source='extra_time', required=False)
    stadiumName = serializers.CharField(source='stadium_name', required=False, allow_blank=True)
    playerLines = serializers.JSONField(source='player_lines', required=False, allow_null=True)
    events = MatchEventSerializer(many=True, required=False)
    stats = serializers.DictField(child=StatsSerializer(), required=False, write_only=True)
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)

    class Meta:
        model = Match
        fields = ['id', 'kind', 'round', 'date', 'homeId', 'awayId', 'homeGoals', 'awayGoals', 'halfTime', 'extraTime', 'penalties',
                  'status', 'mode', 'seed', 'neutral', 'weather', 'stadiumName', 'lineups', 'playerLines', 'events', 'stats', 'createdAt']
        read_only_fields = ['id']
        extra_kwargs = {'kind': {'required': False, 'default': 'simulated'}}

    def validate(self, attrs):
        if attrs.get('home') == attrs.get('away'):
            raise serializers.ValidationError('home and away must be different clubs')
        events = attrs.get('events') or []
        if events:
            # the score must agree with the goal events
            hg = sum(1 for e in events if e.get('side') == 'home' and e['type'] in ('goal', 'penalty_goal', 'own_goal'))
            ag = sum(1 for e in events if e.get('side') == 'away' and e['type'] in ('goal', 'penalty_goal', 'own_goal'))
            if (hg, ag) != (attrs['home_goals'], attrs['away_goals']):
                raise serializers.ValidationError('score does not match goal events')
        pens = attrs.get('penalties')
        if pens is not None and (not isinstance(pens, list) or len(pens) != 2 or pens[0] == pens[1]):
            raise serializers.ValidationError({'penalties': 'must be [home, away] with a winner'})
        return attrs

    @transaction.atomic
    def create(self, validated):
        events = validated.pop('events', [])
        stats = validated.pop('stats', {})
        ht = validated.pop('halfTime', None)
        if ht:
            validated['ht_home'], validated['ht_away'] = ht[0], ht[1]
        match = Match.objects.create(**validated)
        MatchEvent.objects.bulk_create([MatchEvent(match=match, **e) for e in events])
        for side, s in stats.items():
            if side in ('home', 'away'):
                MatchStatistics.objects.create(match=match, side=side, **s)
        return match

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['halfTime'] = [instance.ht_home, instance.ht_away] if instance.ht_home is not None else None
        data['stats'] = {s.side: StatsSerializer(s).data for s in instance.statistics.all()}
        return data


class SimulationSaveSerializer(serializers.ModelSerializer):
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    updatedAt = serializers.DateTimeField(source='updated_at', read_only=True)

    class Meta:
        model = SimulationSave
        fields = ['id', 'kind', 'name', 'season', 'data', 'version', 'createdAt', 'updatedAt']
        read_only_fields = ['id', 'version']

    def update(self, instance, validated):
        instance.version += 1
        return super().update(instance, validated)


class MediaAssetSerializer(serializers.ModelSerializer):
    clubId = serializers.PrimaryKeyRelatedField(source='club', queryset=Club.objects.all(), required=False, allow_null=True)
    playerId = serializers.PrimaryKeyRelatedField(source='player', queryset=Player.objects.all(), required=False, allow_null=True)
    rightsHolder = serializers.CharField(source='rights_holder')
    permissionStatus = serializers.ChoiceField(source='permission_status', choices=MediaAsset.PERMISSION)
    sourceUrl = serializers.URLField(source='source_url', required=False, allow_blank=True)

    class Meta:
        model = MediaAsset
        fields = ['id', 'kind', 'clubId', 'playerId', 'file', 'rightsHolder', 'license', 'permissionStatus', 'sourceUrl', 'enabled', 'notes']
        read_only_fields = ['id']

    def validate_file(self, f):
        if f.size > MAX_MEDIA_BYTES:
            raise serializers.ValidationError('file too large (max 2 MB)')
        ctype = getattr(f, 'content_type', '')
        ext = f.name.rsplit('.', 1)[-1].lower()
        if ctype not in ALLOWED_MEDIA or ALLOWED_MEDIA[ctype] != ext:
            raise serializers.ValidationError('only PNG, WebP and SVG files are accepted')
        head = f.read(4096)
        f.seek(0)
        if ext == 'svg':
            text = f.read().decode('utf-8', errors='replace').lower()
            f.seek(0)
            if '<svg' not in text or any(bad in text for bad in ('<script', 'javascript:', ' onload', ' onerror', ' onclick', '<foreignobject', 'xlink:href="http')):
                raise serializers.ValidationError('SVG contains scripts or external references')
        elif ext == 'png' and not head.startswith(b'\x89PNG'):
            raise serializers.ValidationError('not a PNG file')
        elif ext == 'webp' and not (head[:4] == b'RIFF' and head[8:12] == b'WEBP'):
            raise serializers.ValidationError('not a WebP file')
        return f

    def validate(self, attrs):
        club = attrs.get('club', getattr(self.instance, 'club', None))
        player = attrs.get('player', getattr(self.instance, 'player', None))
        kind = attrs.get('kind', getattr(self.instance, 'kind', None))
        if not club and not player:
            raise serializers.ValidationError('asset must reference a club or a player')
        if kind == 'photo' and not player:
            raise serializers.ValidationError({'playerId': 'photos must reference a player'})
        if attrs.get('enabled') and attrs.get('permission_status', getattr(self.instance, 'permission_status', 'unknown')) != 'confirmed':
            raise serializers.ValidationError({'enabled': 'only assets with confirmed rights can be enabled'})
        return attrs

    def _measure(self, asset):
        f = asset.file
        asset.mime = {'png': 'image/png', 'webp': 'image/webp', 'svg': 'image/svg+xml'}.get(f.name.rsplit('.', 1)[-1].lower(), '')
        if asset.mime != 'image/svg+xml':
            from PIL import Image
            f.open()
            with Image.open(f) as im:
                asset.width, asset.height = im.size
        asset.save()
        return asset

    def create(self, validated):
        return self._measure(super().create(validated))

    def update(self, instance, validated):
        asset = super().update(instance, validated)
        return self._measure(asset) if 'file' in validated else asset

    def to_representation(self, instance):
        return media_to_json(instance, self.context.get('request'))
