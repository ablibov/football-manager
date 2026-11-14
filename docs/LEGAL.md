# Legal & IP register

_Last reviewed: 2026-11-15. This is a working record, not legal advice._

## Brand
- Public name: **Caspian Match Simulator**. Logo: original text mark with two wave lines (`frontend/public/favicon.svg`, `Layout.tsx`), made for this project; no third-party logo elements.
- Web searches (2026-11-15) found no product with this name. **No formal trademark search was done** — check USPTO, EUIPO/WIPO Global Brand Database and the Azerbaijani trademark register (Classes 9 and 41) before launch. "Caspian" is a geographic term also used by unrelated companies and football clubs (e.g. Caspian Babol, FC Caspiy).
- No PFL, UEFA, FIFA, EA SPORTS, Sports Interactive or club branding is used in the product identity. Real competition names appear only as facts (e.g. "format of the 2026/27 Azerbaijan Premier League").

## Media asset register
| Asset | Origin | Licence / permission | Status |
|---|---|---|---|
| `frontend/public/favicon.svg`, logo mark | created for this project | project's own | used |
| Club badges and kits | generated SVG in club UI colours (`Crest.tsx`) | project's own; not official designs | used |
| Official club crests, kits, player photos | — | none obtained | **not included** |
| Vite/React template logos, hero image | Vite template | belonged to the template | removed |
| Fonts | system fonts | n/a (no web fonts loaded) | used |

Adding licensed media later: an admin uploads PNG/WebP/SVG in the media registry (`/#/admin` or Django admin) with rights holder, licence/permission and source URL. Assets are public only when **enabled** and marked **rights confirmed**; SVGs with scripts are rejected and media are served with a sandboxing Content-Security-Policy.

## Data
| Data | Source | Terms | Notes |
|---|---|---|---|
| Club facts, coach changes, tiebreakers | Wikipedia (2026–27 APL article) | CC BY-SA 4.0 | attribution in app (About) and repo |
| Squads | Wikipedia club articles (URLs in `squads-2026-27.txt`) | CC BY-SA 4.0 | the derived data files are offered under CC BY-SA 4.0 |
| Real results | RSSSF (`rsssf.org/tablesa/azer2027.html`) | factual results, credited | RSSSF's reuse terms were not formally confirmed — keep the credit; replace with official PFL data if permission is obtained |
| Ratings, positions, colours | generated | project's own | clearly labelled as estimates |

No proprietary databases, paid game ratings, protected datasets or copyrighted descriptions are used.

## Open questions
1. Trademark clearance for the new name (not done).
2. RSSSF reuse terms (assumed acceptable for factual results with credit; not confirmed).
3. Personality rights: real player names are used in a simulation with fictional ratings — common practice for factual reference, but not legally reviewed for Azerbaijan or the EU.
4. Code licence not chosen (see README).
