# Caspian Match Simulator REST API

Base URL: `/api/` (Vite proxies `/api` and `/media` to `http://127.0.0.1:8000` in development).
Browsable API: open any endpoint in a browser while `runserver` is running.

**Auth**: `POST /api/auth/token/ {username, password}` → `{token}`; send `Authorization: Token <token>`.
"Staff" = Django user with `is_staff`. Real football data and media are writable by staff only.

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/health/` | public | `{ok, staff, disclaimer}` |
| GET | `/bootstrap/?season=2026-27` | public | Full dataset (clubs, players, real matches, rules, sources, public media) |
| GET | `/export/?season=` | public (staff also get non-public media) | Dataset JSON download (`azpfl.dataset/1`) |
| POST | `/import/?replace=1` | staff | Upsert a dataset; atomic; bumps `season.dataVersion`; snapshots squads |
| GET/POST | `/clubs/` · GET/PUT/PATCH/DELETE `/clubs/{id}/` | read public · write staff | Clubs (camelCase shape) |
| GET/POST | `/players/?club=&q=` · `/players/{id}/` | read public · write staff | Players; validation 1..99, unique shirt numbers |
| POST | `/players/{id}/transfer/ {club, number}` | staff | Transfer / release (`club: null`) |
| GET/POST | `/lineups/?club=` · `/lineups/{id}/` | public (user data) | POST with existing (club, name) replaces it. Validates 11 unique available players of the club, ≤ 9 subs, duties in XI |
| GET/POST/DELETE | `/matches/?kind=simulated|real&club=` | public; `kind=real` staff only | Matches with nested `events` and `stats`; score must equal goal events |
| GET/POST/PUT/PATCH/DELETE | `/saves/?kind=league|cup` | public (user data) | Simulation saves (JSON `data`), `version` increments on update |
| GET/POST/PATCH/DELETE | `/media/?club=` | read public (only enabled + confirmed) · write staff | Media registry. Multipart upload: `kind, clubId|playerId, file, rightsHolder, license, permissionStatus, sourceUrl, enabled`. PNG/WebP/SVG ≤ 2 MB; SVG with scripts/external refs rejected; enabling requires `permissionStatus=confirmed` |

Real results (`kind=real`) and simulated results (`kind=simulated`, `SimulationSave`) are stored separately.
Admin UI: `/admin/` (Django admin, incl. media preview and enable toggles).
