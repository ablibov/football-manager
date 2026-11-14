// UI-side football helpers built on top of the engine.
import type { Dataset } from '../data/seed'
import type { CompactResult, SavedMatch } from '../data/types'
import { FORMATIONS } from '../engine/formations'
import { lineOf, slotRating } from '../engine/ratings'
import { computeStandings, formScore, type StandingRow, type Tiebreaker } from '../engine/standings'
import type { Lineup, MatchConfig, MatchResult, Player } from '../engine/types'

export interface TeamRatings { overall: number; att: number; mid: number; def: number; gk: number }

/** Line ratings of a line-up: mean effective (position-adjusted) rating per line. */
export function teamRatings(lineup: Lineup, players: Player[]): TeamRatings {
  const byId = new Map(players.map((p) => [p.id, p]))
  const acc: Record<string, number[]> = { GK: [], DEF: [], MID: [], ATT: [] }
  for (const slot of FORMATIONS[lineup.formation].slots) {
    const p = byId.get(lineup.slots[slot.id])
    if (!p) continue
    const line = slot.role === 'AM' ? 'ATT' : lineOf(slot.role)
    acc[line].push(slotRating(p, slot.role))
  }
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
  const att = avg(acc.ATT.length ? acc.ATT : acc.MID)
  const mid = avg(acc.MID)
  const def = avg(acc.DEF)
  const gk = avg(acc.GK)
  const all = Object.values(acc).flat()
  return { overall: Math.round(avg(all)), att: Math.round(att), mid: Math.round(mid), def: Math.round(def), gk: Math.round(gk) }
}

export const APL_TIEBREAKERS = (ds: Dataset): Tiebreaker[] =>
  (ds.competitionRules.find((r) => r.competition === 'apl')?.tiebreakers as Tiebreaker[] | undefined) ?? ['points', 'goal_diff', 'goals_for']

/** Real (official) table computed from real results — kept separate from simulations. */
export function realStandings(ds: Dataset): StandingRow[] {
  const played = ds.realMatches
    .filter((m) => m.status === 'played' && m.homeGoals != null && m.awayGoals != null)
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
  return computeStandings(ds.clubs.map((c) => c.id), played.map((m) => ({ homeId: m.homeId, awayId: m.awayId, homeGoals: m.homeGoals!, awayGoals: m.awayGoals! })), APL_TIEBREAKERS(ds))
}

export function realForm(ds: Dataset): Record<string, ('W' | 'D' | 'L')[]> {
  return Object.fromEntries(realStandings(ds).map((r) => [r.clubId, r.form]))
}

export function formValue(form: ('W' | 'D' | 'L')[] | undefined): number {
  return form ? formScore(form) : 0
}

export function buildConfig(opts: {
  seed: string
  home: { club: MatchConfig['home']['club']; players: Player[]; lineup: Lineup }
  away: { club: MatchConfig['away']['club']; players: Player[]; lineup: Lineup }
  neutral?: boolean
  weather?: MatchConfig['weather']
  knockout?: boolean
  aggregate?: MatchConfig['aggregate']
  form?: MatchConfig['form']
  autoSubs?: MatchConfig['autoSubs']
}): MatchConfig {
  return {
    seed: opts.seed,
    home: opts.home,
    away: opts.away,
    neutral: opts.neutral ?? false,
    weather: opts.weather ?? 'clear',
    knockout: opts.knockout ?? false,
    aggregate: opts.aggregate,
    form: opts.form,
    autoSubs: opts.autoSubs ?? { home: true, away: true },
  }
}

const KEY_EVENTS = new Set(['goal', 'penalty_goal', 'own_goal', 'penalty_miss', 'yellow', 'second_yellow', 'red', 'sub', 'injury', 'var', 'half_time', 'full_time', 'extra_time_start', 'shootout_kick', 'shootout_end'])

export function compact(r: MatchResult, mode: CompactResult['mode']): CompactResult {
  return {
    homeGoals: r.score[0], awayGoals: r.score[1], halfTime: r.halfTime, extraTime: r.extraTime, penalties: r.penalties,
    events: r.events.filter((e) => KEY_EVENTS.has(e.type)), stats: r.stats,
    players: r.players.filter((p) => p.goals || p.assists || p.yellow || p.red || p.saves || p.started || p.minutesOn),
    seed: r.seed, mode,
  }
}

export function toSavedMatch(r: MatchResult, cfg: MatchConfig, mode: SavedMatch['mode'], stadiumName: string): SavedMatch {
  return {
    id: `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
    homeId: r.homeId, awayId: r.awayId, score: r.score, halfTime: r.halfTime, penalties: r.penalties, extraTime: r.extraTime,
    mode, seed: r.seed, neutral: cfg.neutral, weather: cfg.weather, stadiumName, events: r.events, stats: r.stats, players: r.players,
  }
}

export function cardPoints(c: CompactResult, side: 'home' | 'away'): number {
  return c.events.filter((e) => e.side === side && (e.type === 'yellow' || e.type === 'red' || e.type === 'second_yellow')).reduce((s, e) => s + (e.type === 'yellow' ? 1 : 3), 0)
}

export interface PlayerTotals { playerId: string; clubId: string; apps: number; minutes: number; goals: number; assists: number; yellow: number; red: number; saves: number; cleanSheets: number; conceded: number }

/** Aggregate player statistics from a set of results. */
export function playerTotals(results: { homeId: string; awayId: string; players: CompactResult['players']; homeGoals: number; awayGoals: number }[], players: Player[]): PlayerTotals[] {
  const club = new Map(players.map((p) => [p.id, p.clubId]))
  const pos = new Map(players.map((p) => [p.id, p.position]))
  const m = new Map<string, PlayerTotals>()
  for (const r of results) {
    for (const l of r.players) {
      const cid = club.get(l.playerId) ?? (l.side === 'home' ? r.homeId : r.awayId)
      const t = m.get(l.playerId) ?? { playerId: l.playerId, clubId: cid, apps: 0, minutes: 0, goals: 0, assists: 0, yellow: 0, red: 0, saves: 0, cleanSheets: 0, conceded: 0 }
      if (l.minutesOn > 0 || l.started) t.apps++
      t.minutes += l.minutesOn
      t.goals += l.goals
      t.assists += l.assists
      t.yellow += l.yellow
      t.red += l.red ? 1 : 0
      t.saves += l.saves
      t.conceded += l.goalsConceded
      const conceded = l.side === 'home' ? r.awayGoals : r.homeGoals
      if (l.started && conceded === 0 && l.minutesOn >= 60 && pos.get(l.playerId) === 'GK') t.cleanSheets++
      m.set(l.playerId, t)
    }
  }
  return [...m.values()]
}
