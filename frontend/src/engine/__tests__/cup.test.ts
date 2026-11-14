import { describe, expect, it } from 'vitest'
import { createCup, pendingMatches, recordLeg, type CupFormat } from '../cup'
import { runShootout } from '../match'
import { Rng } from '../rng'
import { SEED } from '../../data/seed'

const fmt: CupFormat = { legs: { default: 1, semiFinal: 2, final: 1 }, extraTime: true, penalties: true, drawEachRound: false }

describe('cup', () => {
  it('handles byes, two-legged semis and produces one champion', () => {
    const ids = SEED.clubs.map((c) => c.id)
    let cup = createCup('c1', ids, fmt, 'cup-seed')
    expect(cup.rounds[0].ties.filter((t) => !t.bId).length).toBe(4)
    let guard = 0
    while (!cup.championId && guard++ < 50) {
      for (const m of pendingMatches(cup)) {
        // home team wins 1-0, second-leg hosts win 2-0 so ties are decided on aggregate
        const leg = { homeId: m.homeId, awayId: m.awayId, homeGoals: m.aggregate ? 2 : 1, awayGoals: 0, extraTime: false, penalties: null, seed: 's' }
        cup = recordLeg(cup, m.tieId, leg, m.knockout ? (m.aggregate ? null : m.homeId) : null)
      }
    }
    expect(cup.championId).toBeTruthy()
    expect(cup.rounds.map((r) => r.name)).toEqual(['round_of_16', 'quarter_final', 'semi_final', 'final'])
  })

  it('requires a winner when two legs finish level', () => {
    let cup = createCup('c2', ['a', 'b'], { ...fmt, legs: { default: 2, semiFinal: 2, final: 2 } }, 'x')
    const [m1] = pendingMatches(cup)
    cup = recordLeg(cup, m1.tieId, { homeId: m1.homeId, awayId: m1.awayId, homeGoals: 1, awayGoals: 0, extraTime: false, penalties: null, seed: '' }, null)
    const [m2] = pendingMatches(cup)
    expect(m2.aggregate).toEqual({ homeGoals: 1, awayGoals: 0 })
    expect(() => recordLeg(cup, m2.tieId, { homeId: m2.homeId, awayId: m2.awayId, homeGoals: 1, awayGoals: 0, extraTime: true, penalties: null, seed: '' }, null)).toThrow()
    const done = recordLeg(cup, m2.tieId, { homeId: m2.homeId, awayId: m2.awayId, homeGoals: 1, awayGoals: 0, extraTime: true, penalties: [4, 3], seed: '' }, null)
    expect(done.championId).toBe(m2.homeId)
  })
})

describe('penalty shoot-out', () => {
  const ps = SEED.players.filter((p) => p.clubId === 'qarabag' && p.position !== 'GK').slice(0, 10).map((p) => ({ p, stamina: 80 }))
  const qs = SEED.players.filter((p) => p.clubId === 'sabah' && p.position !== 'GK').slice(0, 10).map((p) => ({ p, stamina: 80 }))
  it('always produces a winner with valid kick order and early termination', () => {
    for (let i = 0; i < 500; i++) {
      const { kicks, score } = runShootout(new Rng(`so-${i}`), ps, qs)
      expect(score[0]).not.toBe(score[1])
      // alternate kicks
      kicks.forEach((k, j) => expect(k.side).toBe(j % 2 === 0 ? 'home' : 'away'))
      const h = kicks.filter((k) => k.side === 'home').length
      const a = kicks.filter((k) => k.side === 'away').length
      expect(Math.abs(h - a)).toBeLessThanOrEqual(1)
      if (h > 5) expect(h).toBe(a) // sudden death completes rounds
      expect(score[0]).toBe(kicks.filter((k) => k.side === 'home' && k.scored).length)
      // in the best-of-5 phase, the shoot-out ends as soon as it is mathematically decided
      if (h <= 5 && a <= 5) {
        const remH = 5 - h, remA = 5 - a
        expect(score[0] + remH < score[1] || score[1] + remA < score[0]).toBe(true)
      }
    }
  })
})
