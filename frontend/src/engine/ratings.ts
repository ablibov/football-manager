import type { OutfieldAttrs, Player, Position } from './types'

/**
 * Caspian Match Simulator overall-rating methodology (game estimate, not an official rating):
 * overall = weighted mean of the six attributes, weights depend on the primary position.
 * Goalkeepers use the six goalkeeping attributes. Documented in docs/RATINGS.md and mirrored in
 * backend/core/ratings.py.
 */
export const POSITION_WEIGHTS: Record<Exclude<Position, 'GK'>, OutfieldAttrs> = {
  ST: { pac: 0.18, sho: 0.38, pas: 0.08, dri: 0.18, def: 0.0, phy: 0.18 },
  RW: { pac: 0.26, sho: 0.2, pas: 0.14, dri: 0.3, def: 0.0, phy: 0.1 },
  LW: { pac: 0.26, sho: 0.2, pas: 0.14, dri: 0.3, def: 0.0, phy: 0.1 },
  AM: { pac: 0.1, sho: 0.18, pas: 0.32, dri: 0.32, def: 0.0, phy: 0.08 },
  CM: { pac: 0.08, sho: 0.08, pas: 0.36, dri: 0.22, def: 0.14, phy: 0.12 },
  DM: { pac: 0.06, sho: 0.02, pas: 0.26, dri: 0.1, def: 0.34, phy: 0.22 },
  RM: { pac: 0.24, sho: 0.1, pas: 0.24, dri: 0.24, def: 0.08, phy: 0.1 },
  LM: { pac: 0.24, sho: 0.1, pas: 0.24, dri: 0.24, def: 0.08, phy: 0.1 },
  CB: { pac: 0.12, sho: 0.0, pas: 0.1, dri: 0.04, def: 0.46, phy: 0.28 },
  RB: { pac: 0.24, sho: 0.0, pas: 0.16, dri: 0.12, def: 0.3, phy: 0.18 },
  LB: { pac: 0.24, sho: 0.0, pas: 0.16, dri: 0.12, def: 0.3, phy: 0.18 },
  RWB: { pac: 0.26, sho: 0.02, pas: 0.18, dri: 0.16, def: 0.22, phy: 0.16 },
  LWB: { pac: 0.26, sho: 0.02, pas: 0.18, dri: 0.16, def: 0.22, phy: 0.16 },
}

export function ratingFor(p: Player, pos: Position = p.position): number {
  if (pos === 'GK') {
    if (!p.gk) return Math.max(1, Math.round(p.attrs.phy * 0.3))
    const g = p.gk
    return Math.round(g.div * 0.21 + g.han * 0.2 + g.kic * 0.08 + g.ref * 0.23 + g.spd * 0.08 + g.pos * 0.2)
  }
  const w = POSITION_WEIGHTS[pos]
  const a = p.attrs
  const v = a.pac * w.pac + a.sho * w.sho + a.pas * w.pas + a.dri * w.dri + a.def * w.def + a.phy * w.phy
  return Math.max(1, Math.min(99, Math.round(v)))
}

export function overall(p: Player): number {
  return ratingFor(p, p.position)
}

// Position families used for compatibility.
const ADJ: Record<Position, Position[]> = {
  GK: [],
  CB: ['DM'],
  RB: ['RWB', 'CB', 'RM'],
  LB: ['LWB', 'CB', 'LM'],
  RWB: ['RB', 'RM'],
  LWB: ['LB', 'LM'],
  DM: ['CM', 'CB'],
  CM: ['DM', 'AM'],
  AM: ['CM', 'ST', 'LW', 'RW'],
  RM: ['RW', 'RWB', 'CM'],
  LM: ['LW', 'LWB', 'CM'],
  RW: ['RM', 'LW', 'ST'],
  LW: ['LM', 'RW', 'ST'],
  ST: ['AM'],
}

/** 0..1 multiplier for playing `p` in `slot` role */
export function positionFit(p: Player, slot: Position): number {
  if (p.position === slot) return 1
  if (slot === 'GK' || p.position === 'GK') return 0.25
  if (p.secondary.includes(slot)) return 0.95
  if (ADJ[p.position].includes(slot)) return 0.86
  const line = (x: Position) =>
    ['CB', 'RB', 'LB', 'RWB', 'LWB'].includes(x) ? 0 : ['DM', 'CM', 'RM', 'LM', 'AM'].includes(x) ? 1 : 2
  return Math.abs(line(p.position) - line(slot)) === 1 ? 0.74 : 0.6
}

/** effective rating of a player in a slot (position rating × fit) */
export function slotRating(p: Player, slot: Position): number {
  const fit = positionFit(p, slot)
  if (fit === 1) return overall(p)
  if (slot === 'GK') return ratingFor(p, 'GK')
  // keeps part of the natural quality, scaled down by unfamiliarity with the role
  const base = Math.max(ratingFor(p, slot), overall(p))
  return Math.round(base * (0.55 + 0.45 * fit))
}

export const POSITION_ORDER: Position[] = ['GK', 'RB', 'RWB', 'CB', 'LB', 'LWB', 'DM', 'CM', 'RM', 'LM', 'AM', 'RW', 'LW', 'ST']

export function lineOf(pos: Position): 'GK' | 'DEF' | 'MID' | 'ATT' {
  if (pos === 'GK') return 'GK'
  if (['CB', 'RB', 'LB', 'RWB', 'LWB'].includes(pos)) return 'DEF'
  if (['DM', 'CM', 'RM', 'LM', 'AM'].includes(pos)) return 'MID'
  return 'ATT'
}
