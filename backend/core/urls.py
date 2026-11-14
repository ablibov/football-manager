from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register('clubs', views.ClubViewSet, basename='club')
router.register('players', views.PlayerViewSet, basename='player')
router.register('lineups', views.LineupViewSet, basename='lineup')
router.register('matches', views.MatchViewSet, basename='match')
router.register('saves', views.SimulationSaveViewSet, basename='save')
router.register('media', views.MediaAssetViewSet, basename='media')

urlpatterns = [
    path('health/', views.health),
    path('bootstrap/', views.bootstrap),
    path('export/', views.export_view),
    path('import/', views.import_view),
    path('me/', views.delete_my_data),
    path('', include(router.urls)),
]
