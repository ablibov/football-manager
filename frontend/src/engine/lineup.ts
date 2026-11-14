import { FORMATIONS } from './formations'
import { overall, slotRating } from './ratings'
import type { FormationCode, Lineup, Player, Tactics } from './types'

export const DEFAULT_TACTICS: Tactics = { mentality: 'balanced', pressing: 'medium', tempo: 'normal' }
export const BENCH_SIZE = 9

/** Greedy max-score assignment of `pool` to formation slots. */
function assign(pool: Player[], formation: FormationCode): Record<string, string> {
  const slots = FORMATIONS[formation].slots
  const pairs: { slotId: string; playerId: string; score: number }[] = []
  for (const slot of slots) for (const p of pool) pairs.push({ slotId: slot.id, playerId: p.id, score: slotRating(p, slot.role) })
  pairs.sort((a, b) => b.score - a.score)
  const used = new Set<string>()
  const result: Record<string, string> = {}
  for (const pr of pairs) {
    if (result[pr.slotId] || used.has(pr.playerId)) continue
    result[pr.slotId] = pr.playerId
    used.add(pr.playerId)
  }
  return result
}

export function autoLineup(clubId: string, players: Player[], formation: FormationCode, tactics: Tactics = DEFAULT_TACTICS): Lineup {
  const available = players.filter((p) => p.clubId === clubId && p.status === 'available')
  const slots = assign(available, formation)
  const xi = new Set(Object.values(slots))
  const bench = available
    .filter((p) => !xi.has(p.id))
    .sort((a, b) => {
      // keep one goalkeeper on the bench, then best-rated
      const ga = a.position === 'GK' ? 1 : 0
      const gb = b.position === 'GK' ? 1 : 0
      return gb - ga || overall(b) - overall(a)
    })
  const benchIds: string[] = []
  let gkOnBench = false
  for (const p of bench) {
    if (benchIds.length >= BENCH_SIZE) break
    if (p.position === 'GK') {
      if (gkOnBench) continue
      gkOnBench = true
    }
    benchIds.push(p.id)
  }
  const starters = [...xi].map((id) => available.find((p) => p.id === id)!).filter(Boolean)
  const best = (f: (p: Player) => number) => [...starters].sort((a, b) => f(b) - f(a))[0]?.id ?? null
  return {
    clubId,
    formation,
    slots,
    bench: benchIds,
    captainId: best((p) => overall(p) + (p.position === 'GK' ? 0 : 2)),
    penaltyTakerId: best((p) => (p.position === 'GK' ? 0 : p.attrs.sho * 0.7 + p.attrs.phy * 0.1 + p.attrs.pas * 0.2)),
    freeKickTakerId: best((p) => (p.position === 'GK' ? 0 : p.attrs.pas * 0.5 + p.attrs.sho * 0.5)),
    cornerTakerId: best((p) => (p.position === 'GK' ? 0 : p.attrs.pas * 0.8 + p.attrs.dri * 0.2)),
    tactics,
  }
}

/** Change formation keeping the same XI, re-assigning players to the closest-fitting slots. */
export function changeFormation(lineup: Lineup, formation: FormationCode, players: Player[]): Lineup {
  const xi = Object.values(lineup.slots).map((id) => players.find((p) => p.id === id)).filter((p): p is Player => !!p)
  const slots = assign(xi, formation)
  return { ...lineup, formation, slots, customPos: undefined }
}

export interface LineupIssue { code: 'count' | 'duplicate' | 'unavailable' | 'no_gk' | 'bench_overlap' | 'unknown_player' | 'wrong_club' | 'bench_size'; playerId?: string }

export function validateLineup(lineup: Lineup, players: Player[]): LineupIssue[] {
  const issues: LineupIssue[] = []
  const byId = new Map(players.map((p) => [p.id, p]))
  const slotIds = FORMATIONS[lineup.formation].slots.map((s) => s.id)
  const xi = slotIds.map((id) => lineup.slots[id]).filter(Boolean)
  if (xi.length !== 11) issues.push({ code: 'count' })
  const seen = new Set<string>()
  for (const id of [...xi, ...lineup.bench]) {
    if (seen.has(id)) issues.push({ code: xi.includes(id) && lineup.bench.includes(id) ? 'bench_overlap' : 'duplicate', playerId: id })
    seen.add(id)
    const p = byId.get(id)
    if (!p) issues.push({ code: 'unknown_player', playerId: id })
    else if (p.clubId !== lineup.clubId) issues.push({ code: 'wrong_club', playerId: id })
    else if (p.status !== 'available') issues.push({ code: 'unavailable', playerId: id })
  }
  const gk = lineup.slots.GK ? byId.get(lineup.slots.GK) : undefined
  if (!gk || gk.position !== 'GK') issues.push({ code: 'no_gk' })
  if (lineup.bench.length > BENCH_SIZE) issues.push({ code: 'bench_size' })
  return issues
}

/** Lineup is playable if it has 11 distinct, available players of the club (a non-GK in goal is allowed but warned). */
export function isPlayable(lineup: Lineup, players: Player[]): boolean {
  return validateLineup(lineup, players).every((i) => i.code === 'no_gk')
}

/** Drop players that left the club / became unavailable and refill holes automatically. */
export function repairLineup(lineup: Lineup, players: Player[]): Lineup {
  const ok = (id: string | undefined | null) => {
    const p = id ? players.find((x) => x.id === id) : undefined
    return !!p && p.clubId === lineup.clubId && p.status === 'available'
  }
  const slots: Record<string, string> = {}
  const used = new Set<string>()
  for (const slot of FORMATIONS[lineup.formation].slots) {
    const id = lineup.slots[slot.id]
    if (ok(id) && !used.has(id)) {
      slots[slot.id] = id
      used.add(id)
    }
  }
  const pool = players.filter((p) => p.clubId === lineup.clubId && p.status === 'available' && !used.has(p.id))
  for (const slot of FORMATIONS[lineup.formation].slots) {
    if (slots[slot.id]) continue
    const best = [...pool].filter((p) => !used.has(p.id)).sort((a, b) => slotRating(b, slot.role) - slotRating(a, slot.role))[0]
    if (best) {
      slots[slot.id] = best.id
      used.add(best.id)
    }
  }
  const bench = lineup.bench.filter((id) => ok(id) && !used.has(id))
  const keep = (id: string | null) => (id && used.has(id) ? id : null)
  const fixed: Lineup = {
    ...lineup,
    slots,
    bench,
    captainId: keep(lineup.captainId),
    penaltyTakerId: keep(lineup.penaltyTakerId),
    freeKickTakerId: keep(lineup.freeKickTakerId),
    cornerTakerId: keep(lineup.cornerTakerId),
  }
  if (!fixed.captainId || !fixed.penaltyTakerId || !fixed.freeKickTakerId || !fixed.cornerTakerId) {
    const auto = autoLineup(lineup.clubId, players, lineup.formation, lineup.tactics)
    const pick = (cur: string | null, alt: string | null) => cur ?? (alt && used.has(alt) ? alt : Object.values(slots)[0] ?? null)
    fixed.captainId = pick(fixed.captainId, auto.captainId)
    fixed.penaltyTakerId = pick(fixed.penaltyTakerId, auto.penaltyTakerId)
    fixed.freeKickTakerId = pick(fixed.freeKickTakerId, auto.freeKickTakerId)
    fixed.cornerTakerId = pick(fixed.cornerTakerId, auto.cornerTakerId)
  }
  return fixed
}
