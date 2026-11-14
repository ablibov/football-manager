// Knockout tournament (Azerbaijan Cup simulation mode). The format is configurable and NOT
// the official Azerbaijan Cup regulation unless the user configures it that way.
import { Rng } from './rng'

export interface CupFormat {
  /** legs per round, by stage name; any stage not listed uses `default` */
  legs: { default: 1 | 2; semiFinal: 1 | 2; final: 1 | 2 }
  extraTime: boolean
  penalties: boolean
  /** redraw pairings before every round instead of a fixed bracket */
  drawEachRound: boolean
}

export interface CupLeg { homeId: string; awayId: string; homeGoals: number; awayGoals: number; extraTime: boolean; penalties: [number, number] | null; seed: string }

export interface CupTie {
  id: string
  roundIndex: number
  /** first-leg home team */
  aId: string
  /** null = bye */
  bId: string | null
  legs: number
  played: CupLeg[]
  winnerId: string | null
}

export interface CupRound { index: number; name: CupStage; size: number; ties: CupTie[] }
export type CupStage = 'preliminary' | 'round_of_32' | 'round_of_16' | 'quarter_final' | 'semi_final' | 'final'

export interface CupState {
  id: string
  seed: string
  participants: string[]
  format: CupFormat
  rounds: CupRound[]
  championId: string | null
}

const stageFor = (teams: number): CupStage =>
  teams === 2 ? 'final' : teams === 4 ? 'semi_final' : teams === 8 ? 'quarter_final' : teams === 16 ? 'round_of_16' : teams === 32 ? 'round_of_32' : 'preliminary'

function legsFor(format: CupFormat, stage: CupStage): number {
  if (stage === 'final') return format.legs.final
  if (stage === 'semi_final') return format.legs.semiFinal
  return format.legs.default
}

function shuffle<T>(arr: T[], rng: Rng): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * Creates the cup and draws the first round. If the field is not a power of two, the
 * `seeds` (best-ranked first) receive byes into the second round.
 */
export function createCup(id: string, participants: string[], format: CupFormat, seed: string, seeds: string[] = participants): CupState {
  if (participants.length < 2) throw new Error('A cup needs at least two clubs')
  if (new Set(participants).size !== participants.length) throw new Error('Duplicate participants')
  const rng = new Rng(seed + ':draw:0')
  let size = 1
  while (size < participants.length) size *= 2
  const byes = size - participants.length
  const ordered = seeds.filter((s) => participants.includes(s)).concat(participants.filter((p) => !seeds.includes(p)))
  const byeTeams = ordered.slice(0, byes)
  const drawn = shuffle(participants.filter((p) => !byeTeams.includes(p)), rng)
  const stage = stageFor(size)
  const ties: CupTie[] = []
  let n = 0
  for (const b of byeTeams) ties.push({ id: `r0-t${n++}`, roundIndex: 0, aId: b, bId: null, legs: 0, played: [], winnerId: b })
  for (let i = 0; i < drawn.length; i += 2) {
    ties.push({ id: `r0-t${n++}`, roundIndex: 0, aId: drawn[i], bId: drawn[i + 1], legs: legsFor(format, stage), played: [], winnerId: null })
  }
  // interleave byes with real ties so bye teams don't meet each other immediately
  const real = ties.filter((t) => t.bId)
  const bye = ties.filter((t) => !t.bId)
  const mixed: CupTie[] = []
  while (real.length || bye.length) {
    if (bye.length) mixed.push(bye.shift()!)
    if (real.length) mixed.push(real.shift()!)
  }
  mixed.forEach((t, i) => (t.id = `r0-t${i}`))
  return { id, seed, participants, format, rounds: [{ index: 0, name: stage, size, ties: mixed }], championId: null }
}

export interface PendingCupMatch {
  tieId: string
  roundIndex: number
  leg: number
  homeId: string
  awayId: string
  /** for the second leg: first-leg goals from the perspective of this match's home team */
  aggregate?: { homeGoals: number; awayGoals: number }
  /** whether a draw must be resolved (single leg or last leg) */
  knockout: boolean
}

export function currentRound(state: CupState): CupRound | null {
  return state.rounds.find((r) => r.ties.some((t) => !t.winnerId)) ?? null
}

export function pendingMatches(state: CupState): PendingCupMatch[] {
  const round = currentRound(state)
  if (!round) return []
  const out: PendingCupMatch[] = []
  for (const t of round.ties) {
    if (t.winnerId || !t.bId) continue
    const leg = t.played.length
    if (t.legs === 1) {
      out.push({ tieId: t.id, roundIndex: round.index, leg: 0, homeId: t.aId, awayId: t.bId, knockout: true })
    } else if (leg === 0) {
      out.push({ tieId: t.id, roundIndex: round.index, leg: 0, homeId: t.aId, awayId: t.bId, knockout: false })
    } else {
      const l1 = t.played[0]
      // leg 2: B at home; aggregate from leg 1 seen from leg-2 home (B) perspective
      out.push({ tieId: t.id, roundIndex: round.index, leg: 1, homeId: t.bId, awayId: t.aId, knockout: true, aggregate: { homeGoals: l1.homeGoals, awayGoals: l1.awayGoals } })
    }
  }
  // all first legs before any second leg
  const minLeg = Math.min(...out.map((m) => m.leg))
  return out.filter((m) => m.leg === minLeg)
}

/** Records a leg. `winnerSide` must be provided for the deciding leg (from the engine). */
export function recordLeg(state: CupState, tieId: string, leg: CupLeg, winnerId: string | null): CupState {
  const next: CupState = structuredClone(state)
  const tie = next.rounds.flatMap((r) => r.ties).find((t) => t.id === tieId)
  if (!tie) throw new Error(`Unknown tie ${tieId}`)
  if (tie.winnerId) throw new Error(`Tie ${tieId} already decided`)
  tie.played.push(leg)
  if (tie.played.length >= tie.legs) {
    if (!winnerId) {
      winnerId = tieWinnerFromLegs(tie)
      if (!winnerId) throw new Error(`Tie ${tieId} level after all legs — winner required`)
    }
    if (winnerId !== tie.aId && winnerId !== tie.bId) throw new Error('Winner is not part of the tie')
    tie.winnerId = winnerId
  }
  return advance(next)
}

/** Aggregate winner without penalties info (null if level). */
export function tieWinnerFromLegs(tie: CupTie): string | null {
  let a = 0, b = 0
  for (const l of tie.played) {
    if (l.homeId === tie.aId) { a += l.homeGoals; b += l.awayGoals } else { b += l.homeGoals; a += l.awayGoals }
  }
  const last = tie.played[tie.played.length - 1]
  if (a !== b) return a > b ? tie.aId : tie.bId
  if (last?.penalties) {
    const homeWon = last.penalties[0] > last.penalties[1]
    return homeWon ? last.homeId : last.awayId
  }
  return null
}

function advance(state: CupState): CupState {
  const last = state.rounds[state.rounds.length - 1]
  if (last.ties.some((t) => !t.winnerId)) return state
  const winners = last.ties.map((t) => t.winnerId!)
  if (winners.length === 1) {
    state.championId = winners[0]
    return state
  }
  const index = last.index + 1
  const rng = new Rng(`${state.seed}:draw:${index}`)
  const order = state.format.drawEachRound ? shuffle(winners, rng) : winners
  const size = order.length
  const stage = stageFor(size)
  const ties: CupTie[] = []
  for (let i = 0; i < order.length; i += 2) {
    // home advantage in fixed brackets alternates by drawing lots
    const [a, b] = rng.chance(0.5) ? [order[i], order[i + 1]] : [order[i + 1], order[i]]
    ties.push({ id: `r${index}-t${i / 2}`, roundIndex: index, aId: a, bId: b, legs: legsFor(state.format, stage), played: [], winnerId: null })
  }
  state.rounds.push({ index, name: stage, size, ties })
  return state
}
