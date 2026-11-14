# Caspian Match Simulator rating & engine methodology

All ratings in Caspian Match Simulator are **game estimates**, not official characteristics of real players or clubs.

## Player overall rating (1–99)
Weighted mean of the six attributes, with weights depending on the primary position
(`frontend/src/engine/ratings.ts`, mirrored in `backend/core/ratings.py`):

| Pos | PAC | SHO | PAS | DRI | DEF | PHY |
|---|---|---|---|---|---|---|
| ST | .18 | .38 | .08 | .18 | 0 | .18 |
| LW/RW | .26 | .20 | .14 | .30 | 0 | .10 |
| AM | .10 | .18 | .32 | .32 | 0 | .08 |
| CM | .08 | .08 | .36 | .22 | .14 | .12 |
| DM | .06 | .02 | .26 | .10 | .34 | .22 |
| LM/RM | .24 | .10 | .24 | .24 | .08 | .10 |
| CB | .12 | 0 | .10 | .04 | .46 | .28 |
| LB/RB | .24 | 0 | .16 | .12 | .30 | .18 |
| LWB/RWB | .26 | .02 | .18 | .16 | .22 | .16 |

Goalkeepers: DIV .21 · HAN .20 · KIC .08 · REF .23 · SPD .08 · POS .20.

Playing out of position multiplies the rating by `0.55 + 0.45 × fit`, where fit = 1 (natural),
0.95 (listed secondary position), 0.86 (adjacent role), 0.74 (neighbouring line), 0.6 (other).

## Club strength (seed data)
`shared/scripts/build-seed.mjs`:
1. **Prior**: editorial estimate per club (previous season finish, European record, squad tier).
2. **Poisson fit**: attack/defence parameters fitted (ridge-regularised, λ = 2.5) on the 64 real
   2026/27 results of rounds 1–11 (RSSSF).
3. **Base** = 0.65 × prior + 0.35 × (68 + 14 × (attack + defence)).
4. Real squads come from the clubs' Wikipedia articles, which give only GK/DF/MF/FW. Caspian Match Simulator maps
   them to GK / CB (+RB, LB, RWB, LWB) / CM (+DM, AM, RM, LM) / ST (+LW, RW, AM) and gives every
   player of a club the same club-level estimate (position profile, ±1.5 jitter). There is no
   per-player quality data, so Caspian Match Simulator does not pretend to know who is better than whom.

## Match engine (frontend/src/engine/match.ts)
- Per side, an expected-goals rate λ (per 90') is computed from the players **currently on the pitch**:
  `log λ = base ± home/2 + 0.22·(ATT − oppDEF)/10 + 0.09·(MID − oppMID)/10 − 0.08·(oppGK − 68)/10
  + formation + tactics + 0.06·form + weather + red-card terms + game-state terms`.
- Units ATT/MID/DEF/GK are weighted attribute averages, scaled by position fit and stamina.
- λ is converted into a per-minute shot rate; each shot gets an xG draw and is converted with a
  probability ∝ xG × shooter finishing (normalised so the expectation is preserved). Penalties,
  own goals and VAR-disallowed goals are accounted for so the total expectation stays λ.
- Fouls → cards → second yellows/reds; injuries; AI substitution windows; fatigue; added time;
  extra time and shoot-outs for knockout games. One seeded RNG drives everything → reproducible.
- Statistics are accumulated from the same event stream (shots on target = goals + opponent saves).

## Calibration (`frontend/src/engine/calibration.ts`)
Targets from the real 2026/27 APL (64 matches): **2.56 goals/match, home 43.8 % / draw 29.7 % / away 26.6 %**.
`calibration.test.ts` simulates 792 matches; current output: 2.55 goals/match, 44.9 % / 26.9 % / 28.2 %.
Strongest vs weakest club: ≈75 % wins for the favourite, ≈9 % upsets.
Shot, foul, card and corner rates use typical European top-flight magnitudes (no public per-match APL event data was found).
