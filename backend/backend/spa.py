"""Serves the built React app (frontend/dist) so the whole site runs from one URL.

Hashed files under /assets/ are cached for a year; index.html is never cached, so a new deploy
is picked up immediately. Any unknown path returns index.html (client-side routing).
"""
import mimetypes
from pathlib import Path

from django.conf import settings
from django.http import FileResponse, Http404, HttpResponse

FALLBACK = """<!doctype html><html lang="az"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Caspian Match Simulator</title><style>body{font-family:system-ui,sans-serif;background:#060b0a;color:#e6f2ee;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center;padding:16px}</style></head>
<body><div><h1>Caspian Match Simulator</h1><p>Sayt yenilənir. Bir neçə dəqiqədən sonra yenidən cəhd edin.</p><p>The site is being updated. Please try again in a few minutes.</p><p>Сайт обновляется. Попробуйте снова через несколько минут.</p></div></body></html>"""


def spa(request, path=''):
    root = Path(settings.FRONTEND_DIST).resolve()
    index = root / 'index.html'
    if not index.exists():
        return HttpResponse(FALLBACK, status=503)
    target = (root / path).resolve() if path else index
    if root not in target.parents and target != index:
        raise Http404()
    if not target.is_file():
        target = index
    ctype, _ = mimetypes.guess_type(target.name)
    resp = FileResponse(open(target, 'rb'), content_type=ctype or 'application/octet-stream')
    if target == index:
        resp['Cache-Control'] = 'no-cache'
    elif 'assets' in target.parts:
        resp['Cache-Control'] = 'public, max-age=31536000, immutable'
    else:
        resp['Cache-Control'] = 'public, max-age=3600'
    return resp
