import { describe, expect, it } from 'vitest'
import { SEED } from '../data/seed'
import { pendingMatches } from '../engine/cup'
import { autoLineup } from '../engine/lineup'
import { simulateMatch } from '../engine/match'
import { applyCupResult, applyLeagueResult, cupConfig, currentRound, DEFAULT_CUP_FORMAT, leagueConfig, leagueStandings, newCup, newLeague, type DataCtx } from '../lib/competitions'
import { compact, playerTotals } from '../lib/football'

const ctx: DataCtx = {
  club: (id) => SEED.clubs.find((c) => c.id === id),
  clubPlayers: (id) => SEED.players.filter((p) => p.clubId === id),
  lineupFor: (id) => autoLineup(id, SEED.players, '4-3-3'),
}

describe('full season simulation', () => {
  it('plays all 198 matches of the 2026/27 format and produces a consistent table', () => {
    let save = { ...newLeague(SEED, 'test', 'season-seed'), id: 'x' }
    expect(save.data.fixtures.length).toBe(198)
    while (currentRound(save.data) !== null) {
      const r = currentRound(save.data)!
      for (const f of save.data.fixtures.filter((x) => x.round === r)) {
        save = applyLeagueResult(save, f.id, compact(simulateMatch(leagueConfig(ctx, save.data, f)), 'instant'))
      }
    }
    const table = leagueStandings(save.data)
    expect(table.every((t) => t.played === 33)).toBe(true)
    const gf = table.reduce((s, t) => s + t.goalsFor, 0)
    const ga = table.reduce((s, t) => s + t.goalsAgainst, 0)
    expect(gf).toBe(ga)
    const draws = table.reduce((s, t) => s + t.drawn, 0) / 2
    const points = table.reduce((s, t) => s + t.points, 0)
    expect(points).toBe((198 - draws) * 3 + draws * 2)
    for (let i = 1; i < table.length; i++) expect(table[i - 1].points).toBeGreaterThanOrEqual(table[i].points)
    // player totals agree with the table
    const results = Object.entries(save.data.results).map(([id, r]) => {
      const f = save.data.fixtures.find((x) => x.id === id)!
      return { homeId: f.homeId, awayId: f.awayId, players: r.players, homeGoals: r.homeGoals, awayGoals: r.awayGoals }
    })
    const totals = playerTotals(results, SEED.players)
    const ownGoals = Object.values(save.data.results).flatMap((r) => r.events).filter((e) => e.type === 'own_goal').length
    expect(totals.reduce((s, t) => s + t.goals, 0) + ownGoals).toBe(gf)
    // same seed → same season
    const again = { ...newLeague(SEED, 'test', 'season-seed'), id: 'y' }
    const f1 = again.data.fixtures[0]
    expect(compact(simulateMatch(leagueConfig(ctx, again.data, f1)), 'instant').homeGoals).toBe(save.data.results[f1.id].homeGoals)
  })

  it('plays a full cup with byes, two-legged semis, ET and penalties to a single champion', () => {
    for (let k = 0; k < 20; k++) {
      let save = { ...newCup(SEED, 'cup', `cup-${k}`, SEED.clubs.map((c) => c.id), DEFAULT_CUP_FORMAT, []), id: 'c' }
      let guard = 0
      while (!save.data.state.championId && guard++ < 40) {
        for (const m of pendingMatches(save.data.state)) save = applyCupResult(save, m, simulateMatch(cupConfig(ctx, save.data, m)), 'instant')
      }
      expect(save.data.state.championId).toBeTruthy()
      const semis = save.data.state.rounds.find((r) => r.name === 'semi_final')!
      expect(semis.ties.every((t) => t.played.length === 2)).toBe(true)
    }
  })
})
