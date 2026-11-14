from django.contrib import admin
from django.utils.html import format_html

from .models import (
    Club, Competition, CompetitionRule, DataSource, Fixture, Formation, Lineup, Match, MatchEvent, MatchStatistics, MediaAsset,
    Player, Season, SimulationSave, Squad, Stadium, Standing,
)

admin.site.site_header = 'Caspian Match Simulator administration'


@admin.register(Club)
class ClubAdmin(admin.ModelAdmin):
    list_display = ['name', 'code', 'city', 'stadium', 'coach', 'rating_base', 'updated_at']
    search_fields = ['name', 'short_name']


@admin.register(Player)
class PlayerAdmin(admin.ModelAdmin):
    list_display = ['full_name', 'club', 'number', 'position', 'status', 'overall', 'is_placeholder', 'updated_at']
    list_filter = ['club', 'position', 'status', 'is_placeholder']
    search_fields = ['full_name', 'short_name']


@admin.register(MediaAsset)
class MediaAssetAdmin(admin.ModelAdmin):
    list_display = ['kind', 'club', 'player', 'preview', 'permission_status', 'enabled', 'rights_holder', 'license']
    list_filter = ['kind', 'permission_status', 'enabled']
    list_editable = ['enabled']
    readonly_fields = ['mime', 'width', 'height']

    def preview(self, obj):
        return format_html('<img src="{}" style="height:32px;object-fit:contain"/>', obj.file.url) if obj.file else '-'


class EventInline(admin.TabularInline):
    model = MatchEvent
    extra = 0


class StatsInline(admin.TabularInline):
    model = MatchStatistics
    extra = 0


@admin.register(Match)
class MatchAdmin(admin.ModelAdmin):
    list_display = ['id', 'kind', 'round', 'date', 'home', 'home_goals', 'away_goals', 'away', 'status', 'mode']
    list_filter = ['kind', 'status', 'mode', 'season']
    inlines = [StatsInline, EventInline]


for m in [DataSource, Season, Stadium, Squad, CompetitionRule, Competition, Formation, Lineup, SimulationSave, Fixture, Standing]:
    admin.site.register(m)
