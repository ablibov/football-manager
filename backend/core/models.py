"""Caspian Match Simulator data model.

Real football data (clubs, players, real results, official standings) is kept strictly apart
from simulation data (Match.kind == 'simulated', SimulationSave). Every factual record can point
to a DataSource and carries an `updated_at` timestamp.
"""
import uuid

from django.core.exceptions import ValidationError
from django.db import models

from .ratings import overall_rating

def new_id():
    return uuid.uuid4().hex


POSITIONS = [(p, p) for p in ['GK', 'RB', 'LB', 'CB', 'RWB', 'LWB', 'DM', 'CM', 'AM', 'RM', 'LM', 'RW', 'LW', 'ST']]


class DataSource(models.Model):
    id = models.SlugField(primary_key=True, max_length=80)
    name = models.CharField(max_length=200)
    url = models.URLField(blank=True, null=True)
    license = models.CharField(max_length=200, blank=True)
    terms_checked = models.BooleanField(default=False)
    accessed_at = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)

    def __str__(self):
        return self.name


class Season(models.Model):
    id = models.SlugField(primary_key=True, max_length=20)  # e.g. 2026-27
    name = models.CharField(max_length=20)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    data_version = models.PositiveIntegerField(default=1)
    seed_version = models.PositiveIntegerField(default=0, help_text='dataVersion of the bundled seed last applied automatically')
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name


class Stadium(models.Model):
    name = models.CharField(max_length=200)
    city = models.CharField(max_length=120, blank=True)
    capacity = models.PositiveIntegerField(null=True, blank=True)
    source = models.ForeignKey(DataSource, null=True, blank=True, on_delete=models.SET_NULL)

    class Meta:
        unique_together = [('name', 'city')]

    def __str__(self):
        return self.name


class Club(models.Model):
    id = models.SlugField(primary_key=True, max_length=60)
    name = models.CharField(max_length=120)
    short_name = models.CharField(max_length=60)
    code = models.CharField(max_length=3)
    city = models.CharField(max_length=120, blank=True)
    stadium = models.ForeignKey(Stadium, null=True, blank=True, on_delete=models.SET_NULL, related_name='clubs')
    primary_color = models.CharField(max_length=9, default='#10b981')
    secondary_color = models.CharField(max_length=9, default='#f8fafc')
    colors_verified = models.BooleanField(default=False, help_text='False = Caspian Match Simulator UI palette, not an official colour claim')
    coach = models.CharField(max_length=120, blank=True, null=True)
    coach_since = models.DateField(null=True, blank=True)
    rating_prior = models.FloatField(default=65, help_text='Caspian Match Simulator game estimate')
    rating_power = models.FloatField(default=0)
    rating_base = models.FloatField(default=65)
    source = models.ForeignKey(DataSource, null=True, blank=True, on_delete=models.SET_NULL)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class Player(models.Model):
    STATUS = [('available', 'available'), ('injured', 'injured'), ('suspended', 'suspended')]
    FOOT = [('left', 'left'), ('right', 'right'), ('both', 'both')]

    id = models.SlugField(primary_key=True, max_length=80)
    club = models.ForeignKey(Club, null=True, blank=True, on_delete=models.SET_NULL, related_name='players')
    full_name = models.CharField(max_length=160)
    short_name = models.CharField(max_length=60)
    number = models.PositiveSmallIntegerField()
    birth_date = models.DateField(null=True, blank=True)
    nationality = models.CharField(max_length=80, null=True, blank=True)
    position = models.CharField(max_length=3, choices=POSITIONS)
    secondary = models.JSONField(default=list, blank=True)
    height_cm = models.PositiveSmallIntegerField(null=True, blank=True)
    foot = models.CharField(max_length=5, choices=FOOT, null=True, blank=True)
    status = models.CharField(max_length=10, choices=STATUS, default='available')
    pac = models.PositiveSmallIntegerField(default=50)
    sho = models.PositiveSmallIntegerField(default=50)
    pas = models.PositiveSmallIntegerField(default=50)
    dri = models.PositiveSmallIntegerField(default=50)
    defe = models.PositiveSmallIntegerField(default=50, db_column='def')
    phy = models.PositiveSmallIntegerField(default=50)
    gk = models.JSONField(null=True, blank=True, help_text='{div, han, kic, ref, spd, pos} for goalkeepers')
    is_placeholder = models.BooleanField(default=False, help_text='True = not a real, confirmed player')
    source = models.ForeignKey(DataSource, null=True, blank=True, on_delete=models.SET_NULL)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['club_id', 'number']

    def clean(self):
        for f in ['pac', 'sho', 'pas', 'dri', 'defe', 'phy']:
            v = getattr(self, f)
            if not 1 <= v <= 99:
                raise ValidationError({f: 'must be between 1 and 99'})
        if self.position == 'GK' and self.gk:
            for k in ['div', 'han', 'kic', 'ref', 'spd', 'pos']:
                if not 1 <= int(self.gk.get(k, 0)) <= 99:
                    raise ValidationError({'gk': f'{k} must be between 1 and 99'})
        if self.club_id:
            clash = Player.objects.filter(club_id=self.club_id, number=self.number).exclude(pk=self.pk)
            if clash.exists():
                raise ValidationError({'number': 'number already used in this club'})

    @property
    def overall(self):
        return overall_rating(self.position, self.attrs, self.gk)

    @property
    def attrs(self):
        return {'pac': self.pac, 'sho': self.sho, 'pas': self.pas, 'dri': self.dri, 'def': self.defe, 'phy': self.phy}

    def __str__(self):
        return f'{self.full_name} ({self.club_id})'


class Squad(models.Model):
    """Versioned roster of a club for a season (snapshot taken on import / transfers)."""
    club = models.ForeignKey(Club, on_delete=models.CASCADE, related_name='squads')
    season = models.ForeignKey(Season, on_delete=models.CASCADE)
    version = models.PositiveIntegerField(default=1)
    players = models.ManyToManyField(Player, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [('club', 'season', 'version')]
        ordering = ['-version']


class CompetitionRule(models.Model):
    id = models.SlugField(primary_key=True, max_length=60)
    competition = models.CharField(max_length=10, choices=[('apl', 'Premier League'), ('cup', 'Cup')])
    season = models.ForeignKey(Season, on_delete=models.CASCADE, related_name='rules')
    name = models.CharField(max_length=200)
    format = models.CharField(max_length=20, choices=[('round_robin', 'round robin'), ('knockout', 'knockout')])
    config = models.JSONField(default=dict, help_text='cycles, points, tiebreakers, legs, extraTime, penalties …')
    verified = models.BooleanField(default=False, help_text='True only when checked against a published regulation/source')
    source = models.ForeignKey(DataSource, null=True, blank=True, on_delete=models.SET_NULL)
    notes = models.TextField(blank=True)


class Competition(models.Model):
    id = models.SlugField(primary_key=True, max_length=60)
    season = models.ForeignKey(Season, on_delete=models.CASCADE, related_name='competitions')
    kind = models.CharField(max_length=10, choices=[('apl', 'Premier League'), ('cup', 'Cup')])
    name = models.CharField(max_length=200)
    rule = models.ForeignKey(CompetitionRule, null=True, blank=True, on_delete=models.SET_NULL, related_name='competitions')


class Formation(models.Model):
    code = models.CharField(primary_key=True, max_length=10)
    slots = models.JSONField(default=list, blank=True, help_text='[{id, role, x, y}] — canonical copy lives in the frontend engine')

    def __str__(self):
        return self.code


OWNER_HELP = 'Anonymous guest key (random id kept in the visitor\'s browser); scopes user data per visitor'


class Lineup(models.Model):
    """A saved user line-up (user data, not real data)."""
    owner = models.CharField(max_length=32, db_index=True, default='', help_text=OWNER_HELP)
    club = models.ForeignKey(Club, on_delete=models.CASCADE, related_name='lineups')
    name = models.CharField(max_length=80, default='default')
    formation = models.ForeignKey(Formation, on_delete=models.PROTECT)
    slots = models.JSONField(default=dict)
    custom_pos = models.JSONField(null=True, blank=True)
    bench = models.JSONField(default=list)
    captain = models.ForeignKey(Player, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    penalty_taker = models.ForeignKey(Player, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    free_kick_taker = models.ForeignKey(Player, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    corner_taker = models.ForeignKey(Player, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    tactics = models.JSONField(default=dict)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [('owner', 'club', 'name')]


class SimulationSave(models.Model):
    KIND = [('league', 'league'), ('cup', 'cup'), ('quick', 'quick')]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.CharField(max_length=32, db_index=True, default='', help_text=OWNER_HELP)
    kind = models.CharField(max_length=10, choices=KIND)
    name = models.CharField(max_length=120)
    season = models.ForeignKey(Season, null=True, blank=True, on_delete=models.SET_NULL)
    data = models.JSONField(default=dict)
    version = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']


class Match(models.Model):
    KIND = [('real', 'real'), ('simulated', 'simulated')]
    STATUS = [('scheduled', 'scheduled'), ('played', 'played'), ('postponed', 'postponed')]
    MODE = [('instant', 'instant'), ('live', 'live'), ('manual', 'manual'), ('real', 'real')]

    id = models.CharField(primary_key=True, max_length=80, default=new_id)
    owner = models.CharField(max_length=32, db_index=True, blank=True, default='', help_text='Guest key for simulated matches; empty for real results')
    kind = models.CharField(max_length=10, choices=KIND)
    competition = models.ForeignKey(Competition, null=True, blank=True, on_delete=models.SET_NULL)
    season = models.ForeignKey(Season, null=True, blank=True, on_delete=models.SET_NULL)
    save_ref = models.ForeignKey(SimulationSave, null=True, blank=True, on_delete=models.CASCADE, related_name='matches')
    round = models.PositiveSmallIntegerField(null=True, blank=True)
    date = models.DateField(null=True, blank=True)
    home = models.ForeignKey(Club, on_delete=models.PROTECT, related_name='home_matches')
    away = models.ForeignKey(Club, on_delete=models.PROTECT, related_name='away_matches')
    home_goals = models.PositiveSmallIntegerField(null=True, blank=True)
    away_goals = models.PositiveSmallIntegerField(null=True, blank=True)
    ht_home = models.PositiveSmallIntegerField(null=True, blank=True)
    ht_away = models.PositiveSmallIntegerField(null=True, blank=True)
    extra_time = models.BooleanField(default=False)
    penalties = models.JSONField(null=True, blank=True)
    status = models.CharField(max_length=10, choices=STATUS, default='played')
    mode = models.CharField(max_length=10, choices=MODE, default='instant')
    seed = models.CharField(max_length=80, blank=True)
    neutral = models.BooleanField(default=False)
    weather = models.CharField(max_length=10, default='clear')
    stadium_name = models.CharField(max_length=200, blank=True)
    lineups = models.JSONField(null=True, blank=True)
    player_lines = models.JSONField(null=True, blank=True)
    source = models.ForeignKey(DataSource, null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name_plural = 'matches'

    def clean(self):
        if self.home_id == self.away_id:
            raise ValidationError('home and away must be different clubs')


class MatchEvent(models.Model):
    match = models.ForeignKey(Match, on_delete=models.CASCADE, related_name='events')
    seq = models.PositiveIntegerField()
    minute = models.PositiveSmallIntegerField()
    added = models.PositiveSmallIntegerField(null=True, blank=True)
    type = models.CharField(max_length=20)
    side = models.CharField(max_length=4, blank=True)
    player_id = models.CharField(max_length=80, blank=True)  # not an FK: history survives roster edits
    secondary_player_id = models.CharField(max_length=80, blank=True)
    xg = models.FloatField(null=True, blank=True)
    detail = models.CharField(max_length=40, blank=True)
    score = models.JSONField(null=True, blank=True)

    class Meta:
        ordering = ['seq']


class MatchStatistics(models.Model):
    match = models.ForeignKey(Match, on_delete=models.CASCADE, related_name='statistics')
    side = models.CharField(max_length=4)
    possession = models.PositiveSmallIntegerField()
    shots = models.PositiveSmallIntegerField()
    shots_on_target = models.PositiveSmallIntegerField()
    xg = models.FloatField()
    passes = models.PositiveIntegerField()
    passes_completed = models.PositiveIntegerField()
    pass_accuracy = models.PositiveSmallIntegerField()
    corners = models.PositiveSmallIntegerField()
    fouls = models.PositiveSmallIntegerField()
    yellow = models.PositiveSmallIntegerField()
    red = models.PositiveSmallIntegerField()
    saves = models.PositiveSmallIntegerField()
    offsides = models.PositiveSmallIntegerField(default=0)

    class Meta:
        unique_together = [('match', 'side')]


class Fixture(models.Model):
    """Real fixture of an official competition."""
    competition = models.ForeignKey(Competition, on_delete=models.CASCADE, related_name='fixtures')
    round = models.PositiveSmallIntegerField()
    home = models.ForeignKey(Club, on_delete=models.PROTECT, related_name='+')
    away = models.ForeignKey(Club, on_delete=models.PROTECT, related_name='+')
    date = models.DateField(null=True, blank=True)
    match = models.OneToOneField(Match, null=True, blank=True, on_delete=models.SET_NULL)

    class Meta:
        ordering = ['round', 'date']


class Standing(models.Model):
    """Official (real) standings snapshot — never written by the simulator."""
    competition = models.ForeignKey(Competition, on_delete=models.CASCADE, related_name='standings')
    club = models.ForeignKey(Club, on_delete=models.CASCADE)
    as_of = models.DateField()
    position = models.PositiveSmallIntegerField()
    played = models.PositiveSmallIntegerField()
    won = models.PositiveSmallIntegerField()
    drawn = models.PositiveSmallIntegerField()
    lost = models.PositiveSmallIntegerField()
    goals_for = models.PositiveSmallIntegerField()
    goals_against = models.PositiveSmallIntegerField()
    points = models.SmallIntegerField()
    source = models.ForeignKey(DataSource, null=True, blank=True, on_delete=models.SET_NULL)

    class Meta:
        unique_together = [('competition', 'club', 'as_of')]
        ordering = ['as_of', 'position']


def media_path(instance, filename):
    return f'media-assets/{instance.kind}/{uuid.uuid4().hex}-{filename}'


class MediaAsset(models.Model):
    KIND = [('crest', 'crest'), ('kit_home', 'home kit'), ('kit_away', 'away kit'), ('photo', 'player photo')]
    PERMISSION = [
        ('confirmed', 'rights confirmed'),
        ('pending', 'pending confirmation'),
        ('unknown', 'unknown'),
        ('denied', 'denied'),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    kind = models.CharField(max_length=10, choices=KIND)
    club = models.ForeignKey(Club, null=True, blank=True, on_delete=models.CASCADE, related_name='media')
    player = models.ForeignKey(Player, null=True, blank=True, on_delete=models.CASCADE, related_name='media')
    file = models.FileField(upload_to=media_path)
    mime = models.CharField(max_length=40, blank=True)
    width = models.PositiveIntegerField(null=True, blank=True)
    height = models.PositiveIntegerField(null=True, blank=True)
    rights_holder = models.CharField(max_length=200)
    license = models.CharField(max_length=200, help_text='licence name or description of the permission')
    permission_status = models.CharField(max_length=10, choices=PERMISSION, default='unknown')
    source_url = models.URLField(blank=True)
    enabled = models.BooleanField(default=False, help_text='Disable an asset without code changes')
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    @property
    def is_public(self):
        return self.enabled and self.permission_status == 'confirmed'

    def clean(self):
        if not self.club_id and not self.player_id:
            raise ValidationError('asset must belong to a club or a player')
        if self.kind == 'photo' and not self.player_id:
            raise ValidationError({'player': 'photos must reference a player'})
