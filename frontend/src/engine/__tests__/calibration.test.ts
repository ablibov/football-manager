import { describe, expect, it } from 'vitest'
import { simulateMatch } from '../match'
import { SEED } from '../../data/seed'
import { CLUB_IDS, cfgFor } from './helpers'

describe('statistical adequacy (large samples)', () => {
  it('league-wide averages match the real APL 2026/27 targets', () => {
    let goals = 0, hw = 0, d = 0, aw = 0, n = 0, shots = 0, sot = 0, corners = 0, fouls = 0, yellows = 0, reds = 0, xg = 0
    for (let rep = 0; rep < 6; rep++) {
      for (const h of CLUB_IDS) for (const a of CLUB_IDS) {
        if (h === a) continue
        const r = simulateMatch(cfgFor(h, a, `cal-${rep}-${h}-${a}`))
        n++
        goals += r.score[0] + r.score[1]
        if (r.score[0] > r.score[1]) hw++
        else if (r.score[0] === r.score[1]) d++
        else aw++
        shots += r.stats.home.shots + r.stats.away.shots
        sot += r.stats.home.shotsOnTarget + r.stats.away.shotsOnTarget
        corners += r.stats.home.corners + r.stats.away.corners
        fouls += r.stats.home.fouls + r.stats.away.fouls
        yellows += r.stats.home.yellow + r.stats.away.yellow
        reds += r.stats.home.red + r.stats.away.red
        xg += r.stats.home.xg + r.stats.away.xg
      }
    }
    const s = { gpm: goals / n, home: hw / n, draw: d / n, away: aw / n, shots: shots / n, sot: sot / n, corners: corners / n, fouls: fouls / n, yellows: yellows / n, reds: reds / n, xg: xg / n }
    console.log('calibration', JSON.stringify(Object.fromEntries(Object.entries(s).map(([k, v]) => [k, +v.toFixed(3)]))))
    expect(s.gpm).toBeGreaterThan(2.35)
    expect(s.gpm).toBeLessThan(2.8)
    expect(s.home).toBeGreaterThan(s.away)
    expect(s.home).toBeGreaterThan(0.36)
    expect(s.home).toBeLessThan(0.52)
    expect(s.draw).toBeGreaterThan(0.2)
    expect(s.draw).toBeLessThan(0.33)
    expect(Math.abs(s.xg - s.gpm)).toBeLessThan(0.35)
    expect(s.shots).toBeGreaterThan(18)
    expect(s.shots).toBeLessThan(30)
  })

  it('the stronger team wins more often, but upsets still happen', () => {
    const strong = [...SEED.clubs].sort((a, b) => b.gameRating.base - a.gameRating.base)[0].id
    const weak = [...SEED.clubs].sort((a, b) => a.gameRating.base - b.gameRating.base)[0].id
    let w = 0, l = 0
    const N = 600
    for (let i = 0; i < N; i++) {
      const r = simulateMatch(cfgFor(i % 2 ? strong : weak, i % 2 ? weak : strong, `fav-${i}`))
      const strongSide = i % 2 ? 'home' : 'away'
      if (r.winner === strongSide) w++
      else if (r.winner) l++
    }
    console.log('favourite', { win: w / N, loss: l / N })
    expect(w / N).toBeGreaterThan(0.5)
    expect(w / N).toBeLessThan(0.85)
    expect(l / N).toBeGreaterThan(0.04)
  })

  it('red cards and tactics move expected goals in the right direction', () => {
    const base = simulateMatch(cfgFor('neftci', 'kapaz', 'tac-0'))
    const att = simulateMatch(cfgFor('neftci', 'kapaz', 'tac-0', { ht: { mentality: 'attacking', pressing: 'medium', tempo: 'normal' } }))
    const def = simulateMatch(cfgFor('neftci', 'kapaz', 'tac-0', { ht: { mentality: 'defensive', pressing: 'medium', tempo: 'normal' } }))
    expect(att.xgModel.home).toBeGreaterThan(base.xgModel.home)
    expect(def.xgModel.home).toBeLessThan(base.xgModel.home)
    expect(def.xgModel.away).toBeLessThan(base.xgModel.away)
    const neutral = simulateMatch(cfgFor('neftci', 'kapaz', 'tac-0', { neutral: true }))
    expect(neutral.xgModel.home).toBeLessThan(base.xgModel.home)
  })
})
