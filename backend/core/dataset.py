"""Conversion between the database and the Caspian Match Simulator dataset JSON (schema `azpfl.dataset/1`).

The same JSON shape is produced by shared/scripts/build-seed.mjs, served by /api/bootstrap/,
downloaded by /api/export/ and accepted by /api/import/ and `manage.py seed`.
"""
import json
from datetime import date

from django.conf import settings

from django.db import transaction

from .models import (
    Club, Competition, CompetitionRule, DataSource, Fixture, Formation, MediaAsset, Match, Player, Season, Squad, Stadium,
)

SCHEMA = 'azpfl.dataset/1'
FORMATION_CODES = ['4-3-3', '4-2-3-1', '4-4-2', '4-1-4-1', '4-3-2-1', '3-4-3', '3-5-2', '5-3-2', '5-4-1']
VALID_POSITIONS = {'GK', 'RB', 'LB', 'CB', 'RWB', 'LWB', 'DM', 'CM', 'AM', 'RM', 'LM', 'RW', 'LW', 'ST'}


class DatasetError(ValueError):
    pass


def _d(v):
    return v.isoformat() if v else None


def _date(v):
    return date.fromisoformat(v) if v else None


def club_to_json(c: Club):
    return {
        'id': c.id,
        'name': c.name,
        'shortName': c.short_name,
        'code': c.code,
        'city': c.city,
        'stadium': {'name': c.stadium.name if c.stadium else None, 'capacity': c.stadium.capacity if c.stadium else None},
        'colors': {'primary': c.primary_color, 'secondary': c.secondary_color, 'verified': c.colors_verified},
        'coach': c.coach,
        'coachSince': _d(c.coach_since),
        'gameRating': {'prior': c.rating_prior, 'fittedPower': c.rating_power, 'base': c.rating_base},
        'sourceId': c.source_id,
        'updatedAt': c.updated_at.date().isoformat() if c.updated_at else None,
    }


def player_to_json(p: Player):
    out = {
        'id': p.id,
        'clubId': p.club_id,
        'fullName': p.full_name,
        'shortName': p.short_name,
        'number': p.number,
        'birthDate': _d(p.birth_date),
        'nationality': p.nationality,
        'position': p.position,
        'secondary': p.secondary or [],
        'heightCm': p.height_cm,
        'foot': p.foot,
        'status': p.status,
        'attrs': p.attrs,
        'isPlaceholder': p.is_placeholder,
        'overall': p.overall,
        'sourceId': p.source_id,
        'updatedAt': p.updated_at.date().isoformat() if p.updated_at else None,
    }
    if p.gk:
        out['gk'] = p.gk
    return out


def media_to_json(m: MediaAsset, request=None):
    url = m.file.url if m.file else None
    if request is not None and url:
        url = request.build_absolute_uri(url)
    return {
        'id': str(m.id), 'kind': m.kind, 'clubId': m.club_id, 'playerId': m.player_id, 'url': url, 'mime': m.mime,
        'width': m.width, 'height': m.height, 'rightsHolder': m.rights_holder, 'license': m.license,
        'permissionStatus': m.permission_status, 'sourceUrl': m.source_url, 'enabled': m.enabled,
    }


def match_to_json(m: Match):
    return {
        'id': m.id, 'season': m.season_id, 'competition': m.competition.kind if m.competition else None,
        'round': m.round, 'date': _d(m.date), 'homeId': m.home_id, 'awayId': m.away_id,
        'homeGoals': m.home_goals, 'awayGoals': m.away_goals, 'status': m.status, 'sourceId': m.source_id,
    }


def seed_calibration():
    """Engine calibration targets (computed from real results by build-seed.mjs)."""
    try:
        return json.loads(settings.SEED_DATASET.read_text(encoding='utf-8')).get('calibration', {})
    except (OSError, ValueError):
        return {}


def export_dataset(season_id='2026-27', request=None, include_private_media=False):
    season = Season.objects.filter(pk=season_id).first()
    media = MediaAsset.objects.all()
    if not include_private_media:
        media = [m for m in media if m.is_public]
    return {
        'schema': SCHEMA,
        'season': {
            'id': season.id, 'name': season.name, 'dataVersion': season.data_version,
            'startDate': _d(season.start_date), 'endDate': _d(season.end_date),
            'updatedAt': season.updated_at.date().isoformat(),
        } if season else None,
        'competitionRules': [
            {'id': r.id, 'competition': r.competition, 'season': r.season_id, 'name': r.name, 'format': r.format,
             **r.config, 'verified': r.verified, 'sourceId': r.source_id, 'notes': r.notes}
            for r in CompetitionRule.objects.filter(season_id=season_id)
        ],
        'calibration': seed_calibration(),
        'dataSources': [
            {'id': s.id, 'name': s.name, 'url': s.url, 'license': s.license, 'termsChecked': s.terms_checked,
             'accessedAt': _d(s.accessed_at), 'notes': s.notes}
            for s in DataSource.objects.all()
        ],
        'clubs': [club_to_json(c) for c in Club.objects.select_related('stadium')],
        'players': [player_to_json(p) for p in Player.objects.all()],
        'realMatches': [match_to_json(m) for m in Match.objects.filter(kind='real', season_id=season_id).select_related('competition').order_by('round', 'date', 'id')],
        'media': [media_to_json(m, request) for m in media],
    }


def _validate(data):
    if not isinstance(data, dict):
        raise DatasetError('dataset must be a JSON object')
    if data.get('schema') != SCHEMA:
        raise DatasetError(f'unsupported schema {data.get("schema")!r}, expected {SCHEMA}')
    clubs = data.get('clubs')
    if not isinstance(clubs, list) or not clubs:
        raise DatasetError('clubs must be a non-empty list')
    ids = [c.get('id') for c in clubs]
    if len(set(ids)) != len(ids) or not all(ids):
        raise DatasetError('club ids must be unique and non-empty')
    players = list(data.get('players') or [])
    for c in clubs:
        for p in c.get('players') or []:
            players.append({**p, 'clubId': p.get('clubId', c['id'])})
    pids = [p.get('id') for p in players]
    if len(set(pids)) != len(pids) or not all(pids):
        raise DatasetError('player ids must be unique and non-empty')
    numbers = set()
    for p in players:
        if p.get('position') not in VALID_POSITIONS:
            raise DatasetError(f'player {p.get("id")}: invalid position {p.get("position")!r}')
        for k in ['pac', 'sho', 'pas', 'dri', 'def', 'phy']:
            v = (p.get('attrs') or {}).get(k)
            if not isinstance(v, (int, float)) or not 1 <= v <= 99:
                raise DatasetError(f'player {p["id"]}: attribute {k} must be 1..99')
        key = (p.get('clubId'), p.get('number'))
        if p.get('clubId') and key in numbers:
            raise DatasetError(f'player {p["id"]}: number {p.get("number")} duplicated in {p.get("clubId")}')
        numbers.add(key)
    return clubs, players


@transaction.atomic
def import_dataset(data, replace_players=True, seed_version=None):
    """Upsert a dataset. Returns a summary dict. Raises DatasetError on invalid input (nothing is written)."""
    clubs, players = _validate(data)
    for s in data.get('dataSources') or []:
        DataSource.objects.update_or_create(id=s['id'], defaults={
            'name': s.get('name', s['id']), 'url': s.get('url'), 'license': s.get('license', ''),
            'terms_checked': bool(s.get('termsChecked')), 'accessed_at': _date(s.get('accessedAt')), 'notes': s.get('notes', ''),
        })
    src = lambda sid: sid if sid and DataSource.objects.filter(pk=sid).exists() else None  # noqa: E731

    season = None
    sd = data.get('season')
    if sd:
        season, created = Season.objects.get_or_create(id=sd['id'], defaults={'name': sd.get('name', sd['id'])})
        season.name = sd.get('name', season.name)
        season.start_date = _date(sd.get('startDate'))
        season.end_date = _date(sd.get('endDate'))
        if not created:
            season.data_version += 1  # every import creates a new data version
        else:
            season.data_version = sd.get('dataVersion', 1)
        if seed_version is not None:
            season.seed_version = seed_version
        season.save()

    for code in FORMATION_CODES:
        Formation.objects.get_or_create(code=code)

    for r in data.get('competitionRules') or []:
        if not season:
            break
        known = {'id', 'competition', 'season', 'name', 'format', 'verified', 'sourceId', 'notes'}
        CompetitionRule.objects.update_or_create(id=r['id'], defaults={
            'competition': r['competition'], 'season': season, 'name': r.get('name', r['id']), 'format': r['format'],
            'config': {k: v for k, v in r.items() if k not in known}, 'verified': bool(r.get('verified')),
            'source_id': src(r.get('sourceId')), 'notes': r.get('notes', ''),
        })
        Competition.objects.update_or_create(id=f'{r["competition"]}-{season.id}', defaults={
            'season': season, 'kind': r['competition'], 'name': r.get('name', ''), 'rule_id': r['id'],
        })

    for c in clubs:
        st = c.get('stadium') or {}
        stadium = None
        if st.get('name'):
            stadium, _ = Stadium.objects.update_or_create(name=st['name'], city=c.get('city', ''), defaults={'capacity': st.get('capacity')})
        colors = c.get('colors') or {}
        gr = c.get('gameRating') or {}
        Club.objects.update_or_create(id=c['id'], defaults={
            'name': c['name'], 'short_name': c.get('shortName', c['name']), 'code': c.get('code', c['id'][:3].upper()),
            'city': c.get('city', ''), 'stadium': stadium,
            'primary_color': colors.get('primary', '#10b981'), 'secondary_color': colors.get('secondary', '#f8fafc'),
            'colors_verified': bool(colors.get('verified')), 'coach': c.get('coach'), 'coach_since': _date(c.get('coachSince')),
            'rating_prior': gr.get('prior', 65), 'rating_power': gr.get('fittedPower', 0), 'rating_base': gr.get('base', 65),
            'source_id': src(c.get('sourceId')),
        })

    club_ids = {c['id'] for c in clubs}
    if replace_players:
        # players of imported clubs not present in the dataset leave the club (kept as free agents,
        # history intact); placeholder players are simply removed
        gone = Player.objects.filter(club_id__in=club_ids).exclude(id__in=[p['id'] for p in players])
        gone.filter(is_placeholder=True).delete()
        gone.update(club=None)
    for p in players:
        a = p['attrs']
        Player.objects.update_or_create(id=p['id'], defaults={
            'club_id': p.get('clubId') if p.get('clubId') in club_ids or Club.objects.filter(pk=p.get('clubId')).exists() else None,
            'full_name': p['fullName'], 'short_name': p.get('shortName') or p['fullName'].split(' ')[-1],
            'number': p.get('number', 0), 'birth_date': _date(p.get('birthDate')), 'nationality': p.get('nationality'),
            'position': p['position'], 'secondary': p.get('secondary') or [], 'height_cm': p.get('heightCm'),
            'foot': p.get('foot'), 'status': p.get('status', 'available'),
            'pac': a['pac'], 'sho': a['sho'], 'pas': a['pas'], 'dri': a['dri'], 'defe': a['def'], 'phy': a['phy'],
            'gk': p.get('gk'), 'is_placeholder': bool(p.get('isPlaceholder')), 'source_id': src(p.get('sourceId')),
        })

    real = 0
    if season:
        comp = Competition.objects.filter(id=f'apl-{season.id}').first()
        for m in data.get('realMatches') or []:
            match, _ = Match.objects.update_or_create(id=m['id'], defaults={
                'kind': 'real', 'competition': comp, 'season': season, 'round': m.get('round'), 'date': _date(m.get('date')),
                'home_id': m['homeId'], 'away_id': m['awayId'], 'home_goals': m.get('homeGoals'), 'away_goals': m.get('awayGoals'),
                'status': m.get('status', 'played'), 'mode': 'real', 'source_id': src(m.get('sourceId')),
            })
            if comp:
                Fixture.objects.update_or_create(match=match, defaults={
                    'competition': comp, 'round': m.get('round') or 0, 'home_id': m['homeId'], 'away_id': m['awayId'], 'date': _date(m.get('date')),
                })
            real += 1
        # roster snapshot per club for this data version
        for cid in club_ids:
            squad, _ = Squad.objects.get_or_create(club_id=cid, season=season, version=season.data_version)
            squad.players.set(Player.objects.filter(club_id=cid))

    return {'clubs': len(clubs), 'players': len(players), 'realMatches': real, 'dataVersion': season.data_version if season else None}


def load_seed():
    return json.loads(settings.SEED_DATASET.read_text(encoding='utf-8'))


def ensure_seeded(force=False):
    """Apply the bundled dataset when the database is empty or the bundled seed is newer.

    Called on every deployment start (`manage.py seed --auto`) and, as a safety net, by
    /api/bootstrap/ when no clubs exist — visitors never have to run anything.
    Returns the import summary, or None when nothing had to be done.
    """
    data = load_seed()
    version = int((data.get('season') or {}).get('dataVersion', 1))
    season = Season.objects.filter(pk=(data.get('season') or {}).get('id')).first()
    if not force and Club.objects.exists() and season and season.seed_version >= version:
        return None
    return import_dataset(data, seed_version=version)
