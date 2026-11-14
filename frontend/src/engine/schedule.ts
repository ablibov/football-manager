import { Rng } from './rng'

export interface ScheduledFixture { id: string; round: number; homeId: string; awayId: string }

/**
 * Round-robin calendar (circle method). `cycles` = how many times every pair meets
 * (APL 2026/27: 3 → 33 rounds for 12 clubs). Venues are swapped in every other cycle, and the
 * fixed team of the circle alternates home/away by round to avoid long streaks.
 * The club order is shuffled with `seed`, so each new season save gets its own calendar.
 */
export function roundRobin(clubIds: string[], cycles: number, seed = 'calendar'): ScheduledFixture[] {
  const rng = new Rng(seed)
  const teams = [...clubIds]
  for (let i = teams.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1))
    ;[teams[i], teams[j]] = [teams[j], teams[i]]
  }
  const BYE = '__bye__'
  if (teams.length % 2) teams.push(BYE)
  const n = teams.length
  const base: [string, string][][] = []
  const arr = [...teams]
  for (let r = 0; r < n - 1; r++) {
    const round: [string, string][] = []
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i]
      const b = arr[n - 1 - i]
      if (i === 0) round.push(r % 2 === 0 ? [a, b] : [b, a])
      else round.push(i % 2 === 0 ? [a, b] : [b, a])
    }
    base.push(round)
    // rotate all but the first team
    arr.splice(1, 0, arr.pop()!)
  }
  const out: ScheduledFixture[] = []
  let roundNo = 0
  for (let c = 0; c < cycles; c++) {
    for (const round of base) {
      roundNo++
      for (const [h, a] of round) {
        if (h === BYE || a === BYE) continue
        const [home, away] = c % 2 === 0 ? [h, a] : [a, h]
        out.push({ id: `r${roundNo}-${home}-${away}`, round: roundNo, homeId: home, awayId: away })
      }
    }
  }
  return out
}
