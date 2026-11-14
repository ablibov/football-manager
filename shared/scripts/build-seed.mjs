#!/usr/bin/env node
/**
 * Builds shared/seed/azpfl-2026-27.json — the single source dataset used by both
 * the Django backend (`manage.py seed`) and the frontend offline fallback.
 *
 * - Club facts (city, stadium, capacity, coach changes, format, tiebreakers) come from
 *   Wikipedia (CC BY-SA 4.0) and RSSSF, accessed 2026-11-15. See `dataSources`.
 * - Real results: rounds 1–11 of 2026/27 as listed by RSSSF (last updated 2026-11-10).
 * - Club strength = Caspian Match Simulator game estimate: prior (my editorial estimate, documented) blended
 *   with a Poisson attack/defence fit on the real 2026/27 results (see docs/RATINGS.md).
 * - Players: first-team squads from the clubs' Wikipedia articles (squads-2026-27.txt, with the
 *   as-of date per club). Ratings are club-level Caspian Match Simulator estimates, not per-player assessments.
 * - Coaches: only where the sources agree; Sabah, Araz-Naxçıvan and İmişli had conflicting
 *   information and are left unconfirmed.
 *
 * Usage: node shared/scripts/build-seed.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ACCESSED = '2026-11-15'
const here = dirname(fileURLToPath(import.meta.url))

const dataSources = [
  {
    id: 'wikipedia-apl-2026-27',
    name: 'Wikipedia — 2026–27 Azerbaijan Premier League',
    url: 'https://en.wikipedia.org/wiki/2026%E2%80%9327_Azerbaijan_Premier_League',
    license: 'CC BY-SA 4.0 (text); facts used with attribution',
    termsChecked: true,
    accessedAt: ACCESSED,
    notes: 'Stadia, capacities, managerial changes, tiebreaker order. Standings updated to 2026-11-08.',
  },
  {
    id: 'rsssf-azer2027',
    name: 'RSSSF — Azerbaijan 2026/27',
    url: 'https://rsssf.org/tablesa/azer2027.html',
    license: 'Factual match results; credit RSSSF',
    termsChecked: true,
    accessedAt: ACCESSED,
    notes: 'Results rounds 1–11 (page last updated 2026-11-10). 33 rounds listed → triple round-robin.',
  },
  {
    id: 'azpfl-estimates',
    name: 'Caspian Match Simulator game estimates',
    url: null,
    license: 'Caspian Match Simulator project',
    termsChecked: true,
    accessedAt: ACCESSED,
    notes: 'Simulator ratings. Not official characteristics of any club or player.',
  },
]

// prior = editorial strength estimate (2025/26 finish, European record, budget tier) — a game estimate.
const clubs = [
  { id: 'qarabag', name: 'Qarabağ FK', shortName: 'Qarabağ', code: 'QAR', city: 'Ağdam / Bakı', stadium: 'Tofiq Bəhramov adına Respublika Stadionu', capacity: 31200, coach: 'Qurban Qurbanov', coachSince: null, colors: ['#111827', '#f8fafc'], prior: 78 },
  { id: 'sabah', name: 'Sabah FK', shortName: 'Sabah', code: 'SAB', city: 'Abşeron', stadium: 'Bank Respublika Arena', capacity: 8969, coach: null, coachSince: null, colors: ['#1d4ed8', '#f59e0b'], prior: 76 },
  { id: 'neftci', name: 'Neftçi PFK', shortName: 'Neftçi', code: 'NEF', city: 'Bakı', stadium: 'Neftçi Arena', capacity: 10289, coach: 'Yuriy Vernydub', coachSince: null, colors: ['#f8fafc', '#0f172a'], prior: 73 },
  { id: 'turan-tovuz', name: 'Turan Tovuz', shortName: 'Turan', code: 'TUR', city: 'Tovuz', stadium: 'Tovuz Şəhər Stadionu', capacity: 6500, coach: 'Kurban Berdyev', coachSince: null, colors: ['#dc2626', '#f8fafc'], prior: 70 },
  { id: 'zira', name: 'Zirə FK', shortName: 'Zirə', code: 'ZIR', city: 'Zirə / Bakı', stadium: 'Zirə Olimpiya İdman Kompleksi', capacity: 1256, coach: 'Rashad Sadygov', coachSince: null, colors: ['#0f766e', '#facc15'], prior: 70 },
  { id: 'sumqayit', name: 'Sumqayıt FK', shortName: 'Sumqayıt', code: 'SUM', city: 'Sumqayıt', stadium: 'Mehdi Hüseynzadə adına Stadion', capacity: 9502, coach: 'Filipe Cândido', coachSince: '2026-07-09', colors: ['#0284c7', '#f8fafc'], prior: 66 },
  { id: 'samaxi', name: 'Şamaxı FK', shortName: 'Şamaxı', code: 'SAM', city: 'Şamaxı', stadium: 'Şamaxı Şəhər Stadionu', capacity: 2176, coach: 'Azer Bağırov', coachSince: '2026-06-02', colors: ['#7c3aed', '#f8fafc'], prior: 65 },
  { id: 'kapaz', name: 'Kəpəz PFK', shortName: 'Kəpəz', code: 'KEP', city: 'Gəncə', stadium: 'Gəncə Şəhər Stadionu', capacity: 15343, coach: 'Azər Məmmədov', coachSince: '2026-06-23', colors: ['#2563eb', '#f8fafc'], prior: 65 },
  { id: 'qabala', name: 'Qəbələ İK', shortName: 'Qəbələ', code: 'QEB', city: 'Qəbələ', stadium: 'Qəbələ Şəhər Stadionu', capacity: 3748, coach: 'Jeton Beqiri', coachSince: '2026-09-16', colors: ['#ea580c', '#111827'], prior: 64 },
  { id: 'araz-naxcivan', name: 'Araz-Naxçıvan', shortName: 'Araz', code: 'ARZ', city: 'Naxçıvan / Bakı', stadium: 'Dalğa Arena', capacity: 6502, coach: null, coachSince: null, colors: ['#b91c1c', '#facc15'], prior: 63 },
  { id: 'imisli', name: 'İmişli FK', shortName: 'İmişli', code: 'IMI', city: 'İmişli', stadium: 'Heydər Əliyev adına Stadion (İmişli)', capacity: 8500, coach: null, coachSince: null, colors: ['#15803d', '#f8fafc'], prior: 62 },
  { id: 'safa', name: 'Şəfa FK', shortName: 'Şəfa', code: 'SEF', city: 'Bakı', stadium: null, capacity: null, coach: 'Zaur Həşimov', coachSince: '2026-06-27', colors: ['#0e7490', '#f8fafc'], prior: 62 },
]

const nameToId = {
  'Qarabağ': 'qarabag', Sabah: 'sabah', 'Neftçi': 'neftci', 'Turan Tovuz': 'turan-tovuz', Zira: 'zira',
  Sumgayit: 'sumqayit', 'Şamaxı': 'samaxi', Kapaz: 'kapaz', Qabala: 'qabala',
  'Araz-Naxçıvan': 'araz-naxcivan', 'İmişli': 'imisli', 'Şəfa': 'safa',
}

const rawResults = `
1|08-14|Turan Tovuz|1-0|Qabala
1|08-15|Sabah|2-0|Kapaz
1|08-15|Araz-Naxçıvan|0-0|İmişli
1|08-16|Sumgayit|1-3|Neftçi
1|08-16|Zira|2-0|Şəfa
1|08-17|Qarabağ|3-1|Şamaxı
2|08-22|Zira|3-1|İmişli
2|08-22|Qabala|0-1|Şəfa
2|08-23|Neftçi|5-0|Araz-Naxçıvan
2|08-23|Turan Tovuz|0-0|Şamaxı
2||Sabah|P|Sumgayit
2||Qarabağ|P|Kapaz
3|08-29|Şəfa|0-1|İmişli
3|08-29|Qabala|0-0|Şamaxı
3|08-30|Zira|1-0|Neftçi
3|08-30|Kapaz|1-0|Turan Tovuz
3|08-31|Sumgayit|0-1|Qarabağ
3|08-31|Araz-Naxçıvan|0-1|Sabah
4|09-04|Qabala|2-1|İmişli
4|09-04|Kapaz|1-4|Şamaxı
4|09-05|Sabah|5-0|Zira
4|09-05|Neftçi|4-1|Şəfa
4|09-06|Qarabağ|3-2|Araz-Naxçıvan
4|09-06|Turan Tovuz|2-1|Sumgayit
5|09-11|İmişli|2-3|Neftçi
5|09-12|Sumgayit|1-1|Şamaxı
5|09-12|Kapaz|1-0|Qabala
5|09-13|Zira|1-1|Qarabağ
5|09-13|Araz-Naxçıvan|2-2|Turan Tovuz
5|09-14|Şəfa|0-3|Sabah
6|09-18|Qabala|0-3|Neftçi
6|09-18|Qarabağ|1-0|Şəfa
6|09-19|Sabah|3-1|İmişli
6|09-19|Turan Tovuz|1-0|Zira
6|09-20|Şamaxı|2-1|Araz-Naxçıvan
6|09-20|Kapaz|1-1|Sumgayit
7|10-09|Neftçi|0-0|Sabah
7|10-09|Araz-Naxçıvan|0-2|Kapaz
7|10-10|Zira|1-1|Şamaxı
7|10-10|Sumgayit|4-1|Qabala
7|10-11|İmişli|0-2|Qarabağ
7|10-11|Şəfa|0-1|Turan Tovuz
8|10-16|Şamaxı|3-2|Şəfa
8|10-16|Sumgayit|2-1|Araz-Naxçıvan
8|10-17|Qabala|0-4|Sabah
8|10-17|Qarabağ|3-3|Neftçi
8|10-18|İmişli|1-0|Turan Tovuz
8|10-18|Kapaz|1-1|Zira
9|10-23|Zira|3-2|Sumgayit
9|10-23|Araz-Naxçıvan|1-2|Qabala
9|10-24|Neftçi|1-1|Turan Tovuz
9|10-24|Şəfa|1-2|Kapaz
9|10-25|Sabah|0-0|Qarabağ
9|10-25|İmişli|2-1|Şamaxı
10|10-30|Turan Tovuz|3-2|Sabah
10|10-31|Qabala|0-0|Qarabağ
10|10-31|Araz-Naxçıvan|2-2|Zira
10|11-01|Şamaxı|2-3|Neftçi
10|11-01|Kapaz|1-0|İmişli
10|11-02|Sumgayit|1-1|Şəfa
11|11-06|Neftçi|1-0|Kapaz
11|11-06|Qarabağ|0-1|Turan Tovuz
11|11-07|Zira|2-1|Qabala
11|11-07|Şəfa|2-2|Araz-Naxçıvan
11|11-08|Sabah|2-2|Şamaxı
11|11-08|İmişli|0-0|Sumgayit
`

const realMatches = rawResults.trim().split('\n').map((line, i) => {
  const [round, date, home, score, away] = line.split('|')
  const homeId = nameToId[home]
  const awayId = nameToId[away]
  if (!homeId || !awayId) throw new Error(`Unknown club in: ${line}`)
  const postponed = score === 'P'
  const [hg, ag] = postponed ? [null, null] : score.split('-').map(Number)
  return {
    id: `real-2026-27-r${round}-${i + 1}`,
    season: '2026-27',
    competition: 'apl',
    round: Number(round),
    date: date ? `2026-${date}` : null,
    homeId,
    awayId,
    homeGoals: hg,
    awayGoals: ag,
    status: postponed ? 'postponed' : 'played',
    sourceId: 'rsssf-azer2027',
  }
})

// ---- Poisson attack/defence fit on the real results (ridge-regularised) ----
function fitPoisson(matches, ids) {
  const att = Object.fromEntries(ids.map((id) => [id, 0]))
  const def = Object.fromEntries(ids.map((id) => [id, 0]))
  let mu = Math.log(1.2)
  let home = 0.1
  const lambda = 2.5 // ridge strength — heavy shrinkage, only 64 matches
  const lr = 0.01
  for (let iter = 0; iter < 4000; iter++) {
    const gA = Object.fromEntries(ids.map((id) => [id, -lambda * att[id]]))
    const gD = Object.fromEntries(ids.map((id) => [id, -lambda * def[id]]))
    let gMu = 0
    let gH = 0
    for (const m of matches) {
      const lh = Math.exp(mu + home + att[m.homeId] - def[m.awayId])
      const la = Math.exp(mu + att[m.awayId] - def[m.homeId])
      const rh = m.homeGoals - lh
      const ra = m.awayGoals - la
      gMu += rh + ra
      gH += rh
      gA[m.homeId] += rh
      gD[m.awayId] -= rh
      gA[m.awayId] += ra
      gD[m.homeId] -= ra
    }
    mu += lr * gMu / matches.length * 10
    home += lr * gH / matches.length * 10
    for (const id of ids) {
      att[id] += lr * gA[id]
      def[id] += lr * gD[id]
    }
  }
  return { mu, home, att, def }
}

const played = realMatches.filter((m) => m.status === 'played')
const fit = fitPoisson(played, clubs.map((c) => c.id))
const totalGoals = played.reduce((s, m) => s + m.homeGoals + m.awayGoals, 0)
const calibration = {
  matches: played.length,
  goalsPerMatch: +(totalGoals / played.length).toFixed(3),
  homeWinPct: +(played.filter((m) => m.homeGoals > m.awayGoals).length / played.length).toFixed(3),
  drawPct: +(played.filter((m) => m.homeGoals === m.awayGoals).length / played.length).toFixed(3),
  awayWinPct: +(played.filter((m) => m.homeGoals < m.awayGoals).length / played.length).toFixed(3),
  fittedHomeAdvantageLog: +fit.home.toFixed(3),
  fittedBaseGoalsLog: +fit.mu.toFixed(3),
  sourceId: 'rsssf-azer2027',
}

// ---- deterministic RNG for placeholder attributes ----
function hash(str) {
  let h = 1779033703 ^ str.length
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return h >>> 0
}
function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}


const profiles = {
  ST: { pac: 2, sho: 7, pas: -7, dri: 1, def: -32, phy: 3 },
  RW: { pac: 8, sho: 1, pas: -2, dri: 6, def: -28, phy: -7 },
  LW: { pac: 8, sho: 1, pas: -2, dri: 6, def: -28, phy: -7 },
  AM: { pac: 0, sho: 2, pas: 6, dri: 6, def: -22, phy: -8 },
  CM: { pac: -3, sho: -4, pas: 5, dri: 2, def: -4, phy: 0 },
  DM: { pac: -5, sho: -10, pas: 2, dri: -4, def: 5, phy: 4 },
  RM: { pac: 5, sho: -3, pas: 2, dri: 3, def: -12, phy: -3 },
  LM: { pac: 5, sho: -3, pas: 2, dri: 3, def: -12, phy: -3 },
  CB: { pac: -6, sho: -26, pas: -8, dri: -14, def: 6, phy: 6 },
  RB: { pac: 5, sho: -18, pas: -3, dri: -4, def: 1, phy: -1 },
  LB: { pac: 5, sho: -18, pas: -3, dri: -4, def: 1, phy: -1 },
}


// ---- real squads (Wikipedia club articles) ----
const BROAD = {
  GK: { position: 'GK', secondary: [] },
  DF: { position: 'CB', secondary: ['RB', 'LB', 'RWB', 'LWB'] },
  MF: { position: 'CM', secondary: ['DM', 'AM', 'RM', 'LM'] },
  FW: { position: 'ST', secondary: ['LW', 'RW', 'AM'] },
}
const COUNTRIES = {
  AZE: 'Azerbaijan', BRA: 'Brazil', HUN: 'Hungary', MOZ: 'Mozambique', FRA: 'France', MNE: 'Montenegro', SWE: 'Sweden', ESP: 'Spain',
  LBN: 'Lebanon', NGR: 'Nigeria', UKR: 'Ukraine', BIH: 'Bosnia and Herzegovina', LVA: 'Latvia', JAM: 'Jamaica', POR: 'Portugal',
  GLP: 'Guadeloupe', RSA: 'South Africa', UZB: 'Uzbekistan', CRO: 'Croatia', RWA: 'Rwanda', SRB: 'Serbia', POL: 'Poland', CUW: 'Curaçao',
  ALG: 'Algeria', KAZ: 'Kazakhstan', GAB: 'Gabon', BEN: 'Benin', VEN: 'Venezuela', SUR: 'Suriname', SVK: 'Slovakia', MLI: 'Mali',
  SEN: 'Senegal', TJK: 'Tajikistan', PAN: 'Panama', CPV: 'Cape Verde', TOG: 'Togo', MDA: 'Moldova', COL: 'Colombia', RUS: 'Russia',
  CIV: 'Ivory Coast', TUR: 'Turkey', GEO: 'Georgia', NIG: 'Niger', MAR: 'Morocco', BLR: 'Belarus', PAK: 'Pakistan', DOM: 'Dominican Republic',
  BFA: 'Burkina Faso', ISR: 'Israel', BDI: 'Burundi', JPN: 'Japan', ZAM: 'Zambia', BEL: 'Belgium', KOS: 'Kosovo', COD: 'DR Congo',
  ALB: 'Albania', SUI: 'Switzerland', GHA: 'Ghana', GUI: 'Guinea', ANG: 'Angola', GAM: 'Gambia', CAN: 'Canada', ROU: 'Romania', NED: 'Netherlands',
}
const FOLD = { ə: 'e', ı: 'i', ğ: 'g', ş: 's', ç: 'c', ö: 'o', ü: 'u', İ: 'i', Ə: 'e', Ş: 's', Ç: 'c', Ö: 'o', Ü: 'u', Ğ: 'g' }
const slug = (s) => s.replace(/[əığşçöüİƏŞÇÖÜĞ]/g, (ch) => FOLD[ch] ?? ch).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

function readSquads(file) {
  const out = {}
  let cur = null
  for (const raw of readFileSync(file, 'utf8').split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const f = line.split('|')
    if (f[0] === 'CLUB') {
      cur = { clubId: f[1], url: f[2], asOf: f[3], extraction: f[4], players: [] }
      out[cur.clubId] = cur
      continue
    }
    const [num, broad, nat, name] = f
    if (!BROAD[broad]) throw new Error(`bad position in: ${line}`)
    cur.players.push({ number: Number(num), broad, nat, name: name.trim() })
  }
  for (const sq of Object.values(out)) {
    const nums = sq.players.map((p) => p.number)
    if (new Set(nums).size !== nums.length) throw new Error(`duplicate shirt number in ${sq.clubId}`)
    if (sq.players.filter((p) => p.broad === 'GK').length < 2) throw new Error(`${sq.clubId}: fewer than 2 goalkeepers`)
  }
  return out
}
const squads = readSquads(join(here, 'squads-2026-27.txt'))
for (const sq of Object.values(squads)) {
  dataSources.push({
    id: `wikipedia-squad-${sq.clubId}`,
    name: `Wikipedia — ${sq.clubId} squad`,
    url: sq.url,
    license: 'CC BY-SA 4.0 (text); facts used with attribution',
    termsChecked: true,
    accessedAt: ACCESSED,
    notes: `First-team squad as listed on the club article, as of ${sq.asOf}.` + (sq.extraction === 'summary' ? ' Read via an automated page summary — spot-check against the live page.' : ''),
  })
}

const clamp = (v) => Math.max(1, Math.min(99, Math.round(v)))

const finalClubs = clubs.map((c) => {
  const power = fit.att[c.id] + fit.def[c.id]
  const attTilt = fit.att[c.id] - fit.def[c.id]
  const base = 0.65 * c.prior + 0.35 * (68 + 14 * power)
  const squad = squads[c.id]
  if (!squad || squad.players.length < 14) throw new Error(`squad missing for ${c.id}`)
  // Club-level estimate: every player starts from the club base (no per-player data is available);
  // a ±1.5 deterministic jitter only avoids identical values. Labelled as an estimate in the UI.
  const players = squad.players.map(({ number, broad, nat, name }) => {
    const r = rng(hash(`${c.id}:${number}:${name}`))
    const position = BROAD[broad].position
    const lineTilt = broad === 'FW' ? attTilt * 6 : broad === 'DF' || broad === 'GK' ? -attTilt * 6 : 0
    const lvl = base + lineTilt + (r() - 0.5) * 3
    const parts = name.split(/\s+/)
    const p = {
      id: `${c.id}-${number}-${slug(name)}`.slice(0, 80),
      clubId: c.id,
      fullName: name,
      shortName: parts.length > 1 ? parts[parts.length - 1] : name,
      number,
      birthDate: null,
      nationality: COUNTRIES[nat] ?? nat,
      position,
      secondary: BROAD[broad].secondary,
      heightCm: null,
      foot: null,
      status: 'available',
      isPlaceholder: false,
      sourceId: `wikipedia-squad-${c.id}`,
      updatedAt: squad.asOf,
    }
    if (position === 'GK') {
      const g = () => clamp(lvl + (r() - 0.5) * 3)
      p.attrs = { pac: clamp(lvl - 25), sho: clamp(lvl - 45), pas: clamp(lvl - 20), dri: clamp(lvl - 30), def: clamp(lvl - 40), phy: clamp(lvl - 8) }
      p.gk = { div: g(), han: g(), kic: clamp(lvl - 6), ref: g(), spd: clamp(lvl - 10), pos: g() }
    } else {
      const prof = profiles[position]
      p.attrs = Object.fromEntries(Object.entries(prof).map(([k, off]) => [k, clamp(lvl + off + (r() - 0.5) * 3)]))
    }
    return p
  })
  return {
    id: c.id,
    name: c.name,
    shortName: c.shortName,
    code: c.code,
    city: c.city,
    stadium: { name: c.stadium, capacity: c.capacity },
    colors: { primary: c.colors[0], secondary: c.colors[1], verified: false },
    coach: c.coach,
    coachSince: c.coachSince,
    gameRating: { prior: c.prior, fittedPower: +power.toFixed(3), base: +base.toFixed(1) },
    sourceId: 'wikipedia-apl-2026-27',
    updatedAt: ACCESSED,
    players,
  }
})

const out = {
  schema: 'azpfl.dataset/1',
  season: {
    id: '2026-27',
    name: '2026/27',
    dataVersion: 3,
    startDate: '2026-08-14',
    endDate: '2027-05-24',
    updatedAt: ACCESSED,
  },
  competitionRules: [
    {
      id: 'apl-2026-27',
      competition: 'apl',
      season: '2026-27',
      name: 'Azerbaijan Premier League 2026/27',
      format: 'round_robin',
      roundRobinCycles: 3,
      pointsWin: 3,
      pointsDraw: 1,
      pointsLoss: 0,
      tiebreakers: ['points', 'wins', 'goal_diff', 'goals_for', 'h2h_points', 'h2h_goal_diff', 'fair_play', 'draw'],
      verified: true,
      sourceId: 'wikipedia-apl-2026-27',
      notes: 'Tiebreaker order as printed under the Wikipedia table. 33 rounds as listed by RSSSF. Confirm against official PFL regulations before treating as authoritative.',
    },
    {
      id: 'cup-azpfl-default',
      competition: 'cup',
      season: '2026-27',
      name: 'Cup tournament — simulation format',
      format: 'knockout',
      legs: { default: 1, semiFinal: 2, final: 1 },
      extraTime: true,
      penalties: true,
      awayGoals: false,
      verified: false,
      sourceId: 'azpfl-estimates',
      notes: 'Simulator format. NOT the official Azerbaijan Cup regulation.',
    },
  ],
  calibration,
  dataSources,
  clubs: finalClubs,
  realMatches,
}

const target = join(here, '..', 'seed', 'azpfl-2026-27.json')
writeFileSync(target, JSON.stringify(out, null, 1) + '\n')
console.log(`Wrote ${target}`)
console.log('Calibration:', calibration)
console.log(finalClubs.map((c) => `${c.code} prior=${c.gameRating.prior} power=${c.gameRating.fittedPower} base=${c.gameRating.base}`).join('\n'))
