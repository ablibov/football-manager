# Caspian Match Simulator

An independent football match simulation platform featuring Azerbaijani football clubs, customizable lineups, tactical formations, and realistic match simulations.

> **Caspian Match Simulator is an independent, unofficial football simulation project. It is not affiliated with, sponsored by, or endorsed by any football league, federation, club, or game publisher. Simulated results and player ratings are fictional.**

Status: early public release (v0.1). The application is functional and tested, but it has not yet been operated as a public website — see [Known limitations](#known-limitations) and [Before launch](#before-launch).

## Features
- **Quick Match** — pick any two of the 12 clubs of the 2026/27 Azerbaijani top flight, home/away swap, neutral venue, weather; *Instant*, *Live* (pause, speed, live substitutions and tactics) or *Manual score*. No registration.
- **Squad Builder** — drag-and-drop line-ups on a pitch (tap-to-swap on phones), 9 formations, bench, captain and set-piece takers, line-up validation, automatic saving.
- **Match Center** — scoreboard, minute-by-minute events (goals, assists, cards, substitutions, injuries, penalties, VAR, added time), timeline and full match statistics.
- **League Season** — triple round-robin (33 rounds) with the published tiebreaker order, table, fixtures, top scorers/assists/goalkeepers.
- **Cup Tournament** — configurable knockout: draw, byes, one- or two-legged ties, extra time, penalty shoot-outs, winners history.
- **Statistics**, **real results table** (kept separate from simulations), three languages (Azərbaycan dili, Русский, English), dark/light theme, responsive layout.
- Progress is saved automatically per browser (anonymous visitor id) and kept on the device when the server is unreachable.

## Screenshots
_Screenshots will be added after the first public deployment._

## Technology
- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS 4, Framer Motion, Lucide icons, Vitest.
- **Backend:** Python 3.12+, Django 5.2, Django REST Framework, SQLite (default) or PostgreSQL, gunicorn.
- **Match engine:** framework-independent TypeScript (`frontend/src/engine`) with a seeded RNG — reproducible matches.

## Architecture
```
frontend/            React app (served by Django in production)
  src/engine/        match engine: ratings, formations, line-ups, minute-by-minute match, standings, calendar, cup
  src/pages/         Dashboard, Quick Match, Clubs, Squad Builder, Match Center, League, Cup, Statistics, Settings, About, Privacy
backend/             Django project (`backend/`) + `core` app: models, REST API, dataset import/export, media registry
shared/seed/         bundled dataset (clubs, squads, real results, rules, sources)
shared/scripts/      build-seed.mjs + squads-2026-27.txt (source of the dataset)
deploy/start.sh      container entrypoint (migrate → seed --auto → collectstatic → gunicorn)
docs/                API.md, DEPLOY.md, RATINGS.md, LEGAL.md
```
The browser talks to `/api/*` on the same origin. Real data (clubs, players, real results) is read-only for visitors; simulated matches, line-ups and saves are stored per anonymous visitor id. Internal identifiers keep the historical `azpfl` prefix (storage keys, `X-AzPFL-Guest` header, `AZPFL_*` environment variables, dataset schema) so existing data keeps working.

## Local development
Requirements: Python 3.12+, Node 20+.
```bash
cd backend
pip install -r requirements.txt
DJANGO_DEBUG=1 python manage.py migrate
DJANGO_DEBUG=1 python manage.py runserver        # http://127.0.0.1:8000 (data is seeded automatically)

cd frontend
npm install
npm run dev                                      # http://localhost:5173, proxies /api to :8000
```
Checks:
```bash
cd backend  && python manage.py test core && python manage.py check
cd frontend && npx tsc -b && npm run lint && npx vitest run && npm run build
```

## Deployment
One Docker image serves the website and the API from one URL; on start it migrates the database and loads the bundled data automatically.
```bash
cp .env.example .env      # set POSTGRES_PASSWORD, DJANGO_ALLOWED_HOSTS, ...
docker compose up -d --build
```
Requirements: a container host with a persistent volume (or PostgreSQL), HTTPS termination, and the environment variables in [docs/DEPLOY.md](docs/DEPLOY.md). A GitHub repository is not a hosted website — the app must be deployed to a server or platform to be publicly reachable.

## Data sources
| Data | Source | Status |
|---|---|---|
| Clubs, cities, stadiums, capacities, coach changes, tiebreakers | Wikipedia, 2026–27 Azerbaijan Premier League (CC BY-SA 4.0) | facts with attribution |
| First-team squads (name, number, GK/DF/MF/FW, nationality) | each club's English Wikipedia article (CC BY-SA 4.0), with the article's "as of" date | 8 of 12 lists read via an automated summary — spot-check before launch |
| Real results rounds 1–11 (2026/27) | RSSSF | facts, credited |
| Player/team ratings, detailed positions, colours, badges | generated by this project | **estimates — not real data** |

No proprietary football databases, paid game ratings or scraped commercial data are used. Details and the asset register: [docs/LEGAL.md](docs/LEGAL.md).

## Known limitations
- Squads are snapshots (July–November 2026); later transfers are missing until the data file is updated.
- Wikipedia gives only GK/DF/MF/FW, so detailed roles are estimated and all players of a club share one club-level rating.
- Coaches of Sabah, Araz-Naxçıvan and İmişli are shown as "not confirmed" (conflicting sources); birth dates, heights and preferred foot are not available.
- Official club crests, kits and player photos are not included (no permission); neutral badges are shown instead.
- The cup format is a configurable simulation format, not the official Azerbaijan Cup regulation.
- Not yet tested on a real hosting platform; the Docker image was not built in the development environment.
- Visitor progress is tied to the browser's random id; clearing browser data starts a new profile (backup/restore is available in Settings).

## Licensing
No open-source licence has been chosen yet, so by default **all rights are reserved** for the code. Options:
- **Code:** a permissive licence (MIT / Apache-2.0) or a copyleft one (AGPL-3.0, which also covers hosted use).
- **Data:** `shared/scripts/squads-2026-27.txt` and `shared/seed/*.json` contain facts taken from Wikipedia and must stay under **CC BY-SA 4.0** with attribution, whatever licence is chosen for the code.
- Third-party npm/PyPI dependencies keep their own licences.
Choose a licence before inviting contributions.

## Contact and rights holders
If you represent a club, league, player or another rights holder, or you find incorrect information, please open an issue in this repository. A dedicated contact e-mail will be published on the website's About page before launch.

## Before launch
1. Set the contact e-mail and operator name in `frontend/src/config/site.ts` and complete the bracketed items on the Privacy page.
2. Spot-check the 8 squad lists marked "summary" in `shared/scripts/squads-2026-27.txt`.
3. Run a trademark search for "Caspian Match Simulator" in the target markets (see docs/LEGAL.md).
4. Deploy with HTTPS, set `DJANGO_ALLOWED_HOSTS`, `DJANGO_CSRF_TRUSTED_ORIGINS`, then enable HSTS.
