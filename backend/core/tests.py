import json
import tempfile

from django.conf import settings
from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from .dataset import DatasetError, import_dataset
from .models import Club, Fixture, Match, MediaAsset, Player, Season, SimulationSave
from .ratings import overall_rating


def load_seed():
    return json.loads(settings.SEED_DATASET.read_text(encoding='utf-8'))


class SeedMixin:
    @classmethod
    def setUpTestData(cls):
        import_dataset(load_seed())

    GUEST = 'a' * 32

    def setUp(self):
        self.client = APIClient()
        self.client.credentials(HTTP_X_AZPFL_GUEST=self.GUEST)
        self.admin = User.objects.create_user('admin', password='x', is_staff=True)
        self.token = Token.objects.create(user=self.admin)

    def as_admin(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token.key}', HTTP_X_AZPFL_GUEST=self.GUEST)

    def as_guest(self, guest):
        self.client.credentials(HTTP_X_AZPFL_GUEST=guest)

    @staticmethod
    def pid(club, position=None):
        qs = Player.objects.filter(club_id=club)
        if position:
            qs = qs.filter(position=position)
        return qs.order_by('number').first().id


class DatasetTests(SeedMixin, TestCase):
    def test_seed_imported_with_azerbaijani_names_intact(self):
        self.assertEqual(Club.objects.count(), 12)
        self.assertEqual(Club.objects.get(pk='qarabag').name, 'Qarabağ FK')
        self.assertEqual(Club.objects.get(pk='kapaz').name, 'Kəpəz PFK')
        self.assertEqual(Match.objects.filter(kind='real', status='played').count(), 64)
        # real squads from the clubs' Wikipedia articles, no placeholders
        self.assertEqual(Player.objects.filter(is_placeholder=True).count(), 0)
        self.assertTrue(Player.objects.filter(club_id='qarabag', full_name='Badavi Guseynov', number=55).exists())
        for club in Club.objects.all():
            self.assertGreaterEqual(club.players.filter(position='GK').count(), 2)

    def test_export_import_roundtrip(self):
        before = Season.objects.get(pk='2026-27').data_version
        data = self.client.get('/api/export/').json()
        self.assertEqual(data['schema'], 'azpfl.dataset/1')
        self.assertEqual(len(data['clubs']), 12)
        self.assertEqual(len(data['players']), 307)
        self.as_admin()
        data['players'][0]['fullName'] = 'Edited Name'
        r = self.client.post('/api/import/', data, format='json')
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.json()['dataVersion'], before + 1)  # every import is a new data version
        self.assertEqual(Player.objects.get(pk=data['players'][0]['id']).full_name, 'Edited Name')

    def test_bootstrap_seeds_an_empty_database_automatically(self):
        Fixture.objects.all().delete()
        Match.objects.all().delete()
        Player.objects.all().delete()
        Club.objects.all().delete()
        data = self.client.get('/api/bootstrap/').json()
        self.assertEqual(len(data['clubs']), 12)
        self.assertEqual(len(data['players']), 307)

    def test_bootstrap_includes_engine_calibration(self):
        cal = self.client.get('/api/bootstrap/').json()['calibration']
        self.assertEqual(cal['matches'], 64)
        self.assertAlmostEqual(cal['goalsPerMatch'], 2.563, places=3)

    def test_import_rejects_invalid_dataset_atomically(self):
        data = load_seed()
        data['clubs'][0]['players'][0]['attrs']['pac'] = 150
        with self.assertRaises(DatasetError):
            import_dataset(data)
        self.assertNotEqual(Player.objects.get(pk=data['clubs'][0]['players'][0]['id']).pac, 150)

    def test_import_requires_admin(self):
        r = self.client.post('/api/import/', load_seed(), format='json')
        self.assertIn(r.status_code, (401, 403))

    def test_rating_methodology_matches_frontend_rounding(self):
        self.assertEqual(overall_rating('ST', dict(pac=70, sho=80, pas=60, dri=70, phy=70, **{'def': 30})), 73)


class PermissionTests(SeedMixin, TestCase):
    def test_public_cannot_edit_real_data(self):
        r = self.client.patch(f'/api/players/{self.pid("qarabag", "ST")}/', {'fullName': 'X'}, format='json')
        self.assertIn(r.status_code, (401, 403))
        r = self.client.post('/api/matches/', {'kind': 'real', 'homeId': 'sabah', 'awayId': 'neftci', 'homeGoals': 1, 'awayGoals': 0}, format='json')
        self.assertEqual(r.status_code, 403)

    def test_admin_edits_player_and_transfers(self):
        self.as_admin()
        a, b = Player.objects.filter(club_id='qarabag').order_by('number').values_list('id', flat=True)[:2]
        r = self.client.patch(f'/api/players/{a}/', {'fullName': 'Edited Name', 'attrs': {'sho': 88}}, format='json')
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.json()['attrs']['sho'], 88)
        r = self.client.post(f'/api/players/{a}/transfer/', {'club': 'sabah', 'number': 98}, format='json')
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(Player.objects.get(pk=a).club_id, 'sabah')
        # duplicate shirt number rejected
        r = self.client.post(f'/api/players/{b}/transfer/', {'club': 'sabah', 'number': 98}, format='json')
        self.assertEqual(r.status_code, 400)


class LineupTests(SeedMixin, TestCase):
    def lineup(self, **over):
        ids = list(Player.objects.filter(club_id='neftci').values_list('id', flat=True))
        slots = dict(zip(['GK', 'LB', 'LCB', 'RCB', 'RB', 'LCM', 'CDM', 'RCM', 'LW', 'ST', 'RW'], ids[:11]))
        body = {'clubId': 'neftci', 'name': 'default', 'formation': '4-3-3', 'slots': slots, 'bench': ids[11:18],
                'captainId': ids[0], 'tactics': {'mentality': 'balanced'}}
        body.update(over)
        return body, ids

    def test_valid_lineup_saved_and_upserted(self):
        body, _ = self.lineup()
        self.assertEqual(self.client.post('/api/lineups/', body, format='json').status_code, 201)
        self.assertEqual(self.client.post('/api/lineups/', body, format='json').status_code, 200)
        self.assertEqual(self.client.get('/api/lineups/?club=neftci').json().__len__(), 1)

    def test_rejects_duplicate_player(self):
        body, ids = self.lineup()
        body['bench'] = [ids[0]]
        r = self.client.post('/api/lineups/', body, format='json')
        self.assertEqual(r.status_code, 400)

    def test_rejects_ten_players_and_foreign_players(self):
        body, ids = self.lineup()
        body['slots'].pop('ST')
        self.assertEqual(self.client.post('/api/lineups/', body, format='json').status_code, 400)
        body, ids = self.lineup()
        body['slots']['ST'] = self.pid('sabah')
        self.assertEqual(self.client.post('/api/lineups/', body, format='json').status_code, 400)


class MatchTests(SeedMixin, TestCase):
    def test_store_simulated_match_with_events_and_stats(self):
        stats = {'possession': 55, 'shots': 12, 'shotsOnTarget': 5, 'xg': 1.4, 'passes': 450, 'passesCompleted': 380, 'passAccuracy': 84,
                 'corners': 6, 'fouls': 11, 'yellow': 2, 'red': 0, 'saves': 3, 'offsides': 1}
        body = {'homeId': 'qarabag', 'awayId': 'sabah', 'homeGoals': 1, 'awayGoals': 0, 'halfTime': [0, 0], 'mode': 'instant', 'seed': 'abc',
                'events': [{'id': 1, 'minute': 67, 'type': 'goal', 'side': 'home', 'playerId': self.pid('qarabag', 'ST'), 'score': [1, 0]}],
                'stats': {'home': stats, 'away': {**stats, 'possession': 45}}}
        r = self.client.post('/api/matches/', body, format='json')
        self.assertEqual(r.status_code, 201, r.content)
        m = Match.objects.get(pk=r.json()['id'])
        self.assertEqual(m.kind, 'simulated')
        self.assertEqual(m.events.count(), 1)
        self.assertEqual(r.json()['stats']['home']['possession'], 55)
        # simulated results never mix with real ones
        self.assertEqual(self.client.get('/api/matches/?kind=real').json().__len__(), 66)

    def test_score_must_match_events(self):
        body = {'homeId': 'qarabag', 'awayId': 'sabah', 'homeGoals': 2, 'awayGoals': 0,
                'events': [{'id': 1, 'minute': 5, 'type': 'goal', 'side': 'home'}]}
        self.assertEqual(self.client.post('/api/matches/', body, format='json').status_code, 400)

    def test_saves_roundtrip_and_version(self):
        r = self.client.post('/api/saves/', {'kind': 'league', 'name': 'My season', 'season': '2026-27', 'data': {'round': 1}}, format='json')
        self.assertEqual(r.status_code, 201, r.content)
        sid = r.json()['id']
        r = self.client.patch(f'/api/saves/{sid}/', {'data': {'round': 2}}, format='json')
        self.assertEqual(r.json()['version'], 2)
        self.assertEqual(self.client.get(f'/api/saves/{sid}/').json()['data'], {'round': 2})

    def test_delete_my_data_removes_only_this_visitors_data(self):
        self.client.post('/api/saves/', {'kind': 'league', 'name': 'A', 'data': {}}, format='json')
        self.client.post('/api/matches/', {'homeId': 'qarabag', 'awayId': 'sabah', 'homeGoals': 1, 'awayGoals': 1}, format='json')
        self.as_guest('e' * 32)
        self.client.post('/api/saves/', {'kind': 'league', 'name': 'B', 'data': {}}, format='json')
        self.as_guest(self.GUEST)
        r = self.client.delete('/api/me/')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()['deleted']['saves'], 1)
        self.assertEqual(self.client.get('/api/saves/').json(), [])
        self.assertEqual(SimulationSave.objects.filter(owner='e' * 32).count(), 1)
        self.assertEqual(Match.objects.filter(kind='real').count(), 66)

    def test_guests_never_see_each_others_data(self):
        r = self.client.post('/api/saves/', {'kind': 'cup', 'name': 'Mine', 'data': {}}, format='json')
        sid = r.json()['id']
        body = {'homeId': 'qarabag', 'awayId': 'sabah', 'homeGoals': 0, 'awayGoals': 0}
        mid = self.client.post('/api/matches/', body, format='json').json()['id']
        self.as_guest('b' * 32)
        self.assertEqual(self.client.get('/api/saves/').json(), [])
        self.assertEqual(self.client.get(f'/api/saves/{sid}/').status_code, 404)
        self.assertEqual(self.client.delete(f'/api/saves/{sid}/').status_code, 404)
        self.assertEqual(self.client.get('/api/matches/?kind=simulated').json(), [])
        self.assertEqual(self.client.delete(f'/api/matches/{mid}/').status_code, 404)
        # real results stay public
        self.assertEqual(len(self.client.get('/api/matches/?kind=real').json()), 66)
        # without a visitor id, user data endpoints refuse politely
        self.client.credentials()
        self.assertIn(self.client.get('/api/saves/').status_code, (401, 403))


@override_settings(MEDIA_ROOT=tempfile.mkdtemp(prefix='azpfl-test-media-'))
class MediaTests(SeedMixin, TestCase):
    PNG = (b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89'
           b'\x00\x00\x00\rIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82')

    def upload(self, name, content, ctype, **extra):
        f = SimpleUploadedFile(name, content, content_type=ctype)
        data = {'kind': 'crest', 'clubId': 'zira', 'file': f, 'rightsHolder': 'Test', 'license': 'test permission', 'permissionStatus': 'pending', **extra}
        return self.client.post('/api/media/', data, format='multipart')

    def test_upload_requires_admin_and_hides_unconfirmed(self):
        self.assertIn(self.upload('c.png', self.PNG, 'image/png').status_code, (401, 403))
        self.as_admin()
        r = self.upload('c.png', self.PNG, 'image/png')
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(r.json()['width'], 1)
        self.client.credentials()
        self.assertEqual(self.client.get('/api/media/').json(), [])  # pending → not public

    def test_cannot_enable_without_confirmed_rights(self):
        self.as_admin()
        r = self.upload('c.png', self.PNG, 'image/png', enabled='true')
        self.assertEqual(r.status_code, 400)
        r = self.upload('c.png', self.PNG, 'image/png', enabled='true', permissionStatus='confirmed')
        self.assertEqual(r.status_code, 201)
        self.client.credentials()
        self.assertEqual(len(self.client.get('/api/media/').json()), 1)

    def test_rejects_scripted_svg_and_wrong_types(self):
        self.as_admin()
        bad = b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
        self.assertEqual(self.upload('c.svg', bad, 'image/svg+xml').status_code, 400)
        self.assertEqual(self.upload('c.jpg', b'\xff\xd8\xff', 'image/jpeg').status_code, 400)
        good = b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>'
        self.assertEqual(self.upload('c.svg', good, 'image/svg+xml').status_code, 201)
        self.assertEqual(MediaAsset.objects.count(), 1)
        # served with a sandboxing policy so an opened SVG cannot run scripts on the site's origin
        url = MediaAsset.objects.get().file.url
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, 200)
        self.assertIn('sandbox', resp['Content-Security-Policy'])
