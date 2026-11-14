// League & cup save logic (pure functions over SaveRecord data).
import type { Dataset } from '../data/seed'
import type { CompactResult, CupData, LeagueData, SaveRecord } from '../data/types'
import { createCup, pendingMatches, recordLeg, type CupFormat, type PendingCupMatch } from '../engine/cup'
import { roundRobin, type ScheduledFixture } from '../engine/schedule'
import { computeStandings, type StandingRow, type Tiebreaker } from '../engine/standings'
import type { Club, Lineup, MatchConfig, MatchResult, Player } from '../engine/types'
import { buildConfig, cardPoints, compact, formValue } from './football'

export interface DataCtx {
  club: (id: string) => Club | undefined
  clubPlayers: (id: string) => Player[]
  lineupFor: (id: string) => Lineup
}

export function newLeague(ds: Dataset, name: string, seed: string): SaveRecord<LeagueData> {
  const rule = ds.competitionRules.find((r) => r.competition === 'apl')
  const clubIds = ds.clubs.map((c) => c.id)
  const cycles = rule?.roundRobinCycles ?? 2
  return {
    id: '',
    kind: 'league',
    name,
    season: ds.season.id,
    version: 1,
    updatedAt: new Date().toISOString(),
    data: {
      type: 'league',
      seasonId: ds.season.id,
      ruleId: rule?.id ?? 'custom',
      cycles,
      tiebreakers: rule?.tiebreakers ?? ['points', 'goal_diff', 'goals_for'],
      points: { win: rule?.pointsWin ?? 3, draw: rule?.pointsDraw ?? 1, loss: rule?.pointsLoss ?? 0 },
      seed,
      clubIds,
      fixtures: roundRobin(clubIds, cycles, seed),
      results: {},
      createdAt: new Date().toISOString(),
    },
  }
}

function orderedResults(d: LeagueData) {
  return d.fixtures.filter((f) => d.results[f.id]).sort((a, b) => a.round - b.round)
}

export function leagueStandings(d: LeagueData): StandingRow[] {
  const rs = orderedResults(d).map((f) => {
    const r = d.results[f.id]
    return { homeId: f.homeId, awayId: f.awayId, homeGoals: r.homeGoals, awayGoals: r.awayGoals, homeCards: cardPoints(r, 'home'), awayCards: cardPoints(r, 'away') }
  })
  return computeStandings(d.clubIds, rs, d.tiebreakers as Tiebreaker[], d.points)
}

export function leagueForm(d: LeagueData, beforeRound: number): Record<string, ('W' | 'D' | 'L')[]> {
  const out: Record<string, ('W' | 'D' | 'L')[]> = {}
  for (const f of orderedResults(d)) {
    if (f.round >= beforeRound) continue
    const r = d.results[f.id]
    const h = r.homeGoals > r.awayGoals ? 'W' : r.homeGoals < r.awayGoals ? 'L' : 'D'
    const a = h === 'W' ? 'L' : h === 'L' ? 'W' : 'D'
    ;(out[f.homeId] ??= []).push(h)
    ;(out[f.awayId] ??= []).push(a)
  }
  for (const k of Object.keys(out)) out[k] = out[k].slice(-5)
  return out
}

export function currentRound(d: LeagueData): number | null {
  const open = d.fixtures.filter((f) => !d.results[f.id])
  return open.length ? Math.min(...open.map((f) => f.round)) : null
}

export function totalRounds(d: LeagueData): number {
  return Math.max(0, ...d.fixtures.map((f) => f.round))
}

export function leagueConfig(ctx: DataCtx, d: LeagueData, f: ScheduledFixture, autoSubs = { home: true, away: true }): MatchConfig {
  const home = ctx.club(f.homeId)!
  const away = ctx.club(f.awayId)!
  const form = leagueForm(d, f.round)
  return buildConfig({
    seed: `${d.seed}:${f.id}`,
    home: { club: home, players: ctx.clubPlayers(f.homeId), lineup: ctx.lineupFor(f.homeId) },
    away: { club: away, players: ctx.clubPlayers(f.awayId), lineup: ctx.lineupFor(f.awayId) },
    form: { home: formValue(form[f.homeId]), away: formValue(form[f.awayId]) },
    autoSubs,
  })
}

export function applyLeagueResult(save: SaveRecord<LeagueData>, fixtureId: string, r: CompactResult): SaveRecord<LeagueData> {
  if (!save.data.fixtures.some((f) => f.id === fixtureId)) throw new Error('unknown fixture')
  return { ...save, data: { ...save.data, results: { ...save.data.results, [fixtureId]: r } } }
}

// ------------------------------------------------------------------ cup
export const DEFAULT_CUP_FORMAT: CupFormat = { legs: { default: 1, semiFinal: 2, final: 1 }, extraTime: true, penalties: true, drawEachRound: true }

export function newCup(ds: Dataset, name: string, seed: string, participants: string[], format: CupFormat, seeds: string[]): SaveRecord<CupData> {
  return {
    id: '',
    kind: 'cup',
    name,
    season: ds.season.id,
    version: 1,
    updatedAt: new Date().toISOString(),
    data: { type: 'cup', seasonId: ds.season.id, state: createCup(seed, participants, format, seed, seeds), results: {}, createdAt: new Date().toISOString() },
  }
}

export function cupConfig(ctx: DataCtx, d: CupData, m: PendingCupMatch, autoSubs = { home: true, away: true }): MatchConfig {
  return buildConfig({
    seed: `${d.state.seed}:${m.tieId}:${m.leg}`,
    home: { club: ctx.club(m.homeId)!, players: ctx.clubPlayers(m.homeId), lineup: ctx.lineupFor(m.homeId) },
    away: { club: ctx.club(m.awayId)!, players: ctx.clubPlayers(m.awayId), lineup: ctx.lineupFor(m.awayId) },
    // a final is commonly played at a neutral venue — single-leg final treated as neutral
    neutral: d.state.rounds.find((r) => r.index === m.roundIndex)?.name === 'final' && m.leg === 0 && !m.aggregate,
    knockout: m.knockout,
    aggregate: m.aggregate,
    autoSubs,
  })
}

export function applyCupResult(save: SaveRecord<CupData>, m: PendingCupMatch, res: MatchResult, mode: CompactResult['mode']): SaveRecord<CupData> {
  const c = compact(res, mode)
  const winnerId = m.knockout && res.winner ? (res.winner === 'home' ? m.homeId : m.awayId) : null
  const state = recordLeg(save.data.state, m.tieId, { homeId: m.homeId, awayId: m.awayId, homeGoals: c.homeGoals, awayGoals: c.awayGoals, extraTime: c.extraTime, penalties: c.penalties, seed: res.seed }, winnerId)
  return { ...save, data: { ...save.data, state, results: { ...save.data.results, [`${m.tieId}:${m.leg}`]: { ...c, homeId: m.homeId, awayId: m.awayId } } } }
}

export function findCupMatch(d: CupData, tieId: string, leg: number): PendingCupMatch | undefined {
  return pendingMatches(d.state).find((m) => m.tieId === tieId && m.leg === leg)
}
