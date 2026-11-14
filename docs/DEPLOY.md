# Deploying Caspian Match Simulator

Caspian Match Simulator ships as one Docker image (see `Dockerfile`). Django + gunicorn serve the API **and** the built
React app from the same origin, so the site works from any normal URL without extra web servers.

## Start sequence (`deploy/start.sh`)
1. `migrate` — creates/updates the database schema.
2. `seed --auto` — loads the bundled dataset (`shared/seed/azpfl-2026-27.json`) if the DB is empty
   or the bundled `dataVersion` is newer than the one applied. Real player edits made by admins on
   the server are only overwritten when a newer dataset is shipped.
3. `collectstatic` — Django admin assets.
4. Optional admin: set `DJANGO_SUPERUSER_USERNAME` + `DJANGO_SUPERUSER_PASSWORD`.
5. gunicorn on `$PORT` (default 8000).

`/api/bootstrap/` also seeds an empty database on first use as a safety net.

## Environment
| Variable | Default | Purpose |
|---|---|---|
| `PORT` | 8000 | listen port (most PaaS set this) |
| `AZPFL_DATA_DIR` | `/data` | SQLite DB, uploaded media, generated secret key — mount a volume |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_HOST`, `POSTGRES_PORT` | — | use PostgreSQL instead of SQLite |
| `DJANGO_SECRET_KEY` | generated once into the data dir | session/crypto secret |
| `DJANGO_ALLOWED_HOSTS` | `127.0.0.1,localhost` | comma-separated host names — **must** include your domain |
| `DJANGO_DEBUG` | `0` | `1` only for local development |
| `DJANGO_HSTS_SECONDS` | `0` | enable HSTS (e.g. `31536000`) once HTTPS works on the final domain |
| `DJANGO_SSL_REDIRECT` | `0` | `1` if the platform does not already redirect HTTP to HTTPS |
| `DJANGO_CSRF_TRUSTED_ORIGINS` | — | e.g. `https://azpfl.example` (needed for Django admin login over HTTPS) |
| `AZPFL_HTTPS` | 1 | secure cookies; set 0 when serving plain HTTP |
| `WEB_CONCURRENCY` | 3 | gunicorn workers |

Copy `.env.example` to `.env` for docker compose (never commit `.env`). Put the container behind any HTTPS-terminating proxy or platform (Render, Fly.io, Railway, a VPS with
Caddy/Nginx). Health check: `GET /api/health/`.

## Visitor data
No accounts. The browser creates a random visitor id (`X-AzPFL-Guest` header); line-ups, simulated
matches and saves are stored per id on the server. Clearing browser data starts a fresh profile; the
in-app "Download backup" / "Restore backup" moves progress between devices. Anonymous API use is
rate-limited (600 requests/min per IP) and capped at 100 saves / 1000 matches per visitor.
