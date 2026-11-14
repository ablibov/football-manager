import { describe, expect, it } from 'vitest'
import { computeStandings, type ResultLike, type Tiebreaker } from '../standings'
import { roundRobin } from '../schedule'
import { SEED } from '../../data/seed'

const APL: Tiebreaker[] = ['points', 'wins', 'goal_diff', 'goals_for', 'h2h_points', 'h2h_goal_diff', 'fair_play', 'draw']
const r = (homeId: string, awayId: string, homeGoals: number, awayGoals: number): ResultLike => ({ homeId, awayId, homeGoals, awayGoals })

describe('standings', () => {
  it('awards 3/1/0 points and counts goals', () => {
    const t = computeStandings(['a', 'b', 'c'], [r('a', 'b', 2, 0), r('b', 'c', 1, 1), r('c', 'a', 0, 3)], APL)
    const a = t.find((x) => x.clubId === 'a')!
    expect(a).toMatchObject({ played: 2, won: 2, drawn: 0, lost: 0, goalsFor: 5, goalsAgainst: 0, goalDiff: 5, points: 6, position: 1 })
    const b = t.find((x) => x.clubId === 'b')!
    expect(b.points).toBe(1)
    expect(t.map((x) => x.clubId)).toEqual(['a', 'b', 'c'])
  })

  it('applies wins before goal difference (APL 2026/27 order)', () => {
    // x: 1W 0D 1L GD +4 = 3 pts? make equal points with different wins
    const res = [r('x', 'y', 5, 0), r('x', 'z', 0, 1), r('y', 'z', 0, 0), r('y', 'w', 0, 0), r('y', 'v', 0, 0)]
    const t = computeStandings(['x', 'y', 'z', 'w', 'v'], res, APL)
    const x = t.find((s) => s.clubId === 'x')!
    const y = t.find((s) => s.clubId === 'y')!
    expect(x.points).toBe(3)
    expect(y.points).toBe(3)
    expect(t.indexOf(x)).toBeLessThan(t.indexOf(y))
    // with goal difference first, x still first (GD +4 vs -5); flip: give y better GD but fewer wins
    const t2 = computeStandings(['p', 'q', 'o1', 'o2', 'o3'], [r('p', 'o1', 1, 0), r('p', 'o2', 0, 4), r('q', 'o1', 2, 2), r('q', 'o2', 2, 2), r('q', 'o3', 2, 2)], APL)
    // p: 3 pts 1 win GD -3 ; q: 3 pts 0 wins GD 0 → p ahead by wins
    expect(t2.findIndex((s) => s.clubId === 'p')).toBeLessThan(t2.findIndex((s) => s.clubId === 'q'))
    const t3 = computeStandings(['p', 'q', 'o1', 'o2', 'o3'], [r('p', 'o1', 1, 0), r('p', 'o2', 0, 4), r('q', 'o1', 2, 2), r('q', 'o2', 2, 2), r('q', 'o3', 2, 2)], ['points', 'goal_diff'])
    expect(t3.findIndex((s) => s.clubId === 'q')).toBeLessThan(t3.findIndex((s) => s.clubId === 'p'))
  })

  it('uses head-to-head inside the tied group only', () => {
    // a and b level on points, wins, GD, GF; a beat b
    const res = [r('a', 'b', 1, 0), r('b', 'c', 1, 0), r('c', 'a', 1, 0)]
    const t = computeStandings(['a', 'b', 'c'], res, ['points', 'h2h_points'])
    // all three level on 3 pts and h2h (circular) → falls back to listed order
    expect(t.map((x) => x.clubId)).toEqual(['a', 'b', 'c'])
    const t2 = computeStandings(['a', 'b', 'c', 'd'], [r('b', 'a', 0, 1), r('a', 'd', 0, 2), r('b', 'd', 3, 0), r('c', 'd', 0, 0)], ['points', 'h2h_points'])
    // a 3pts, b 3pts; a beat b → a above b
    expect(t2.findIndex((x) => x.clubId === 'a')).toBeLessThan(t2.findIndex((x) => x.clubId === 'b'))
  })

  it('reproduces the real 2026/27 table after round 11 (Wikipedia, 8 Nov 2026)', () => {
    const played = SEED.realMatches.filter((m) => m.status === 'played')
    const rule = SEED.competitionRules.find((c) => c.id === 'apl-2026-27')!
    const t = computeStandings(SEED.clubs.map((c) => c.id), played.map((m) => r(m.homeId, m.awayId, m.homeGoals!, m.awayGoals!)), rule.tiebreakers as Tiebreaker[])
    expect(t.map((x) => `${x.clubId}:${x.points}`)).toEqual([
      'neftci:24', 'sabah:21', 'turan-tovuz:21', 'qarabag:19', 'zira:19', 'kapaz:17',
      'samaxi:14', 'imisli:11', 'sumqayit:10', 'qabala:8', 'safa:5', 'araz-naxcivan:4',
    ])
    expect(t[0]).toMatchObject({ played: 11, won: 7, drawn: 3, lost: 1, goalsFor: 26, goalsAgainst: 11 })
  })
})

describe('calendar', () => {
  it('builds a valid triple round-robin for 12 clubs (33 rounds)', () => {
    const ids = SEED.clubs.map((c) => c.id)
    const fx = roundRobin(ids, 3, 'test')
    expect(fx.length).toBe(12 * 11 / 2 * 3)
    const rounds = new Set(fx.map((f) => f.round))
    expect(rounds.size).toBe(33)
    for (const round of rounds) {
      const teams = fx.filter((f) => f.round === round).flatMap((f) => [f.homeId, f.awayId])
      expect(new Set(teams).size).toBe(12)
    }
    for (const a of ids) for (const b of ids) {
      if (a >= b) continue
      expect(fx.filter((f) => (f.homeId === a && f.awayId === b) || (f.homeId === b && f.awayId === a)).length).toBe(3)
    }
    for (const id of ids) {
      const home = fx.filter((f) => f.homeId === id).length
      expect(home).toBeGreaterThanOrEqual(15)
      expect(home).toBeLessThanOrEqual(18)
    }
  })
})
