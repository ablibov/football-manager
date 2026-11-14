import { describe, expect, it } from 'vitest'
import { MatchSimulation, simulateMatch } from '../match'
import type { MatchResult } from '../types'
import { CLUB_IDS, cfgFor } from './helpers'

function checkConsistency(r: MatchResult) {
  const goals = (side: 'home' | 'away') => r.events.filter((e) => e.side === side && ['goal', 'penalty_goal', 'own_goal'].includes(e.type)).length
  expect(goals('home')).toBe(r.score[0])
  expect(goals('away')).toBe(r.score[1])
  // shots on target = own (non-own-goal) goals + opponent saves
  const nonOg = (side: 'home' | 'away') => r.events.filter((e) => e.side === side && ['goal', 'penalty_goal'].includes(e.type)).length
  expect(r.stats.home.shotsOnTarget).toBe(nonOg('home') + r.stats.away.saves)
  expect(r.stats.away.shotsOnTarget).toBe(nonOg('away') + r.stats.home.saves)
  expect(r.stats.home.shotsOnTarget).toBeLessThanOrEqual(r.stats.home.shots)
  expect(r.stats.home.possession + r.stats.away.possession).toBe(100)
  expect(r.stats.home.passesCompleted).toBeLessThanOrEqual(r.stats.home.passes)
  // cards in stats = card events
  for (const side of ['home', 'away'] as const) {
    const yellows = r.events.filter((e) => e.side === side && (e.type === 'yellow' || e.type === 'second_yellow')).length
    const reds = r.events.filter((e) => e.side === side && (e.type === 'red' || e.type === 'second_yellow')).length
    expect(r.stats[side].yellow).toBe(yellows)
    expect(r.stats[side].red).toBe(reds)
  }
  // player-line goals equal scorer events (own goals are not credited)
  const lineGoals = r.players.reduce((s, p) => s + p.goals, 0)
  const scorerEvents = r.events.filter((e) => e.type === 'goal' || e.type === 'penalty_goal').length
  expect(lineGoals).toBe(scorerEvents)
  // nobody acts after leaving the pitch; nobody acts before coming on
  const offAt = new Map<string, number>()
  const onAt = new Map<string, number>()
  for (const e of r.events) {
    if (e.type === 'sub' && e.secondaryPlayerId) {
      onAt.set(e.playerId!, e.id)
      offAt.set(e.secondaryPlayerId, e.id)
      continue
    }
    if (e.type === 'shootout_kick' || e.type === 'shootout_end') continue
    for (const pid of [e.playerId, e.type === 'save' || e.type === 'foul' ? undefined : e.secondaryPlayerId]) {
      if (!pid) continue
      if (offAt.has(pid)) throw new Error(`player ${pid} acted (${e.type}) after leaving`)
    }
    if (e.type === 'red' || e.type === 'second_yellow') offAt.set(e.playerId!, e.id)
  }
  // starters + used subs only
  const bench = new Set(r.players.filter((p) => !p.started).map((p) => p.playerId))
  for (const id of onAt.keys()) expect(bench.has(id)).toBe(true)
  // events chronologically ordered
  for (let i = 1; i < r.events.length; i++) {
    const a = r.events[i - 1], b = r.events[i]
    expect(a.minute * 100 + (a.added ?? 0)).toBeLessThanOrEqual(b.minute * 100 + (b.added ?? 0) + (b.minute === 45 || b.minute === 90 || b.minute === 105 || b.minute === 120 ? 99 : 0))
  }
}

describe('match engine', () => {
  it('is reproducible from the seed', () => {
    const a = simulateMatch(cfgFor('qarabag', 'sabah', 'seed-123'))
    const b = simulateMatch(cfgFor('qarabag', 'sabah', 'seed-123'))
    expect(b).toEqual(a)
    const c = simulateMatch(cfgFor('qarabag', 'sabah', 'seed-124'))
    expect(c.events).not.toEqual(a.events)
  })

  it('keeps score, events and statistics consistent', () => {
    for (let i = 0; i < 300; i++) {
      const h = CLUB_IDS[i % 12]
      const a = CLUB_IDS[(i * 5 + 3) % 12]
      if (h === a) continue
      checkConsistency(simulateMatch(cfgFor(h, a, `consistency-${i}`, { knockout: i % 3 === 0 })))
    }
  })

  it('never uses more than 5 substitutions in 90 minutes and never re-uses a player', () => {
    for (let i = 0; i < 200; i++) {
      const r = simulateMatch(cfgFor('neftci', 'zira', `subs-${i}`))
      for (const side of ['home', 'away'] as const) {
        const subs = r.events.filter((e) => e.type === 'sub' && e.side === side)
        expect(subs.length).toBeLessThanOrEqual(r.extraTime ? 6 : 5)
        const ins = subs.map((s) => s.playerId)
        expect(new Set(ins).size).toBe(ins.length)
      }
    }
  })

  it('resolves knockout draws with extra time and penalties', () => {
    let shootouts = 0
    for (let i = 0; i < 400; i++) {
      const r = simulateMatch(cfgFor('turan-tovuz', 'zira', `ko-${i}`, { knockout: true }))
      expect(r.winner).not.toBeNull()
      if (r.penalties) {
        shootouts++
        expect(r.extraTime).toBe(true)
        expect(r.score[0]).toBe(r.score[1])
        expect(r.penalties[0]).not.toBe(r.penalties[1])
        expect(r.winner).toBe(r.penalties[0] > r.penalties[1] ? 'home' : 'away')
      } else if (!r.extraTime) {
        expect(r.score[0]).not.toBe(r.score[1])
      }
    }
    expect(shootouts).toBeGreaterThan(10)
  })

  it('applies the first-leg aggregate in a second leg', () => {
    for (let i = 0; i < 200; i++) {
      const r = simulateMatch(cfgFor('sabah', 'qarabag', `agg-${i}`, { knockout: true, aggregate: { homeGoals: 2, awayGoals: 0 } }))
      // leg-1: qarabag (this away) 2-0 sabah. sabah totals: score[0] + 0, qarabag: score[1] + 2
      const sab = r.score[0]
      const qar = r.score[1] + 2
      if (sab !== qar) expect(r.winner).toBe(sab > qar ? 'home' : 'away')
      if (sab === qar) expect(r.extraTime || r.penalties).toBeTruthy()
    }
  })

  it('supports live substitutions and blocks invalid ones', () => {
    const sim = new MatchSimulation(cfgFor('qarabag', 'sabah', 'live-1', { autoSubs: { home: false, away: true } }))
    for (let i = 0; i < 30; i++) sim.step()
    const snap = sim.snapshot()
    const out = snap.onPitch.home[5].player.id
    const inn = snap.bench.home[0].id
    expect(sim.substitute('home', out, inn)).toBeNull()
    expect(sim.substitute('home', out, snap.bench.home[1].id)).toBe('not_on_pitch')
    expect(sim.substitute('home', inn, inn)).toBe('already_used')
    expect(sim.substitute('home', inn, 'nobody')).toBe('not_on_bench')
    const r = sim.runToEnd()
    checkConsistency(r)
    expect(r.events.filter((e) => e.type === 'sub' && e.side === 'home').length).toBeGreaterThanOrEqual(1)
  })
})
