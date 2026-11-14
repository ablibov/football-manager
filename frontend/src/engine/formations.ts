import type { FormationCode, FormationSlot, Position } from './types'

const s = (id: string, role: Position, x: number, y: number): FormationSlot => ({ id, role, x, y })
const GK = s('GK', 'GK', 50, 6)

/**
 * Formation slots, x = 0 (left touchline) … 100 (right), y = 0 (own goal line) … 100.
 * Mentality / width modifiers are used by the engine (see strength.ts).
 */
export const FORMATIONS: Record<FormationCode, { slots: FormationSlot[]; attack: number; defense: number; width: number }> = {
  '4-3-3': {
    attack: 0.04, defense: -0.01, width: 0.04,
    slots: [GK, s('LB', 'LB', 14, 28), s('LCB', 'CB', 37, 22), s('RCB', 'CB', 63, 22), s('RB', 'RB', 86, 28),
      s('LCM', 'CM', 30, 50), s('CDM', 'DM', 50, 42), s('RCM', 'CM', 70, 50),
      s('LW', 'LW', 16, 76), s('ST', 'ST', 50, 84), s('RW', 'RW', 84, 76)],
  },
  '4-2-3-1': {
    attack: 0.02, defense: 0.02, width: 0.02,
    slots: [GK, s('LB', 'LB', 14, 28), s('LCB', 'CB', 37, 22), s('RCB', 'CB', 63, 22), s('RB', 'RB', 86, 28),
      s('LDM', 'DM', 38, 42), s('RDM', 'DM', 62, 42),
      s('LAM', 'LW', 18, 66), s('CAM', 'AM', 50, 64), s('RAM', 'RW', 82, 66), s('ST', 'ST', 50, 84)],
  },
  '4-4-2': {
    attack: 0.01, defense: 0.01, width: 0.03,
    slots: [GK, s('LB', 'LB', 14, 28), s('LCB', 'CB', 37, 22), s('RCB', 'CB', 63, 22), s('RB', 'RB', 86, 28),
      s('LM', 'LM', 14, 54), s('LCM', 'CM', 38, 50), s('RCM', 'CM', 62, 50), s('RM', 'RM', 86, 54),
      s('LST', 'ST', 38, 82), s('RST', 'ST', 62, 82)],
  },
  '4-1-4-1': {
    attack: -0.01, defense: 0.04, width: 0.02,
    slots: [GK, s('LB', 'LB', 14, 28), s('LCB', 'CB', 37, 22), s('RCB', 'CB', 63, 22), s('RB', 'RB', 86, 28),
      s('CDM', 'DM', 50, 40), s('LM', 'LM', 15, 60), s('LCM', 'CM', 37, 56), s('RCM', 'CM', 63, 56), s('RM', 'RM', 85, 60),
      s('ST', 'ST', 50, 84)],
  },
  '4-3-2-1': {
    attack: 0.02, defense: 0.01, width: -0.04,
    slots: [GK, s('LB', 'LB', 14, 28), s('LCB', 'CB', 37, 22), s('RCB', 'CB', 63, 22), s('RB', 'RB', 86, 28),
      s('LCM', 'CM', 28, 48), s('CDM', 'DM', 50, 42), s('RCM', 'CM', 72, 48),
      s('LAM', 'AM', 36, 68), s('RAM', 'AM', 64, 68), s('ST', 'ST', 50, 85)],
  },
  '3-4-3': {
    attack: 0.06, defense: -0.04, width: 0.05,
    slots: [GK, s('LCB', 'CB', 28, 24), s('CB', 'CB', 50, 20), s('RCB', 'CB', 72, 24),
      s('LM', 'LWB', 12, 52), s('LCM', 'CM', 38, 48), s('RCM', 'CM', 62, 48), s('RM', 'RWB', 88, 52),
      s('LW', 'LW', 20, 77), s('ST', 'ST', 50, 85), s('RW', 'RW', 80, 77)],
  },
  '3-5-2': {
    attack: 0.03, defense: -0.01, width: 0.01,
    slots: [GK, s('LCB', 'CB', 28, 24), s('CB', 'CB', 50, 20), s('RCB', 'CB', 72, 24),
      s('LWB', 'LWB', 10, 54), s('LCM', 'CM', 32, 52), s('CDM', 'DM', 50, 42), s('RCM', 'CM', 68, 52), s('RWB', 'RWB', 90, 54),
      s('LST', 'ST', 38, 82), s('RST', 'ST', 62, 82)],
  },
  '5-3-2': {
    attack: -0.04, defense: 0.06, width: -0.01,
    slots: [GK, s('LWB', 'LWB', 9, 34), s('LCB', 'CB', 30, 22), s('CB', 'CB', 50, 19), s('RCB', 'CB', 70, 22), s('RWB', 'RWB', 91, 34),
      s('LCM', 'CM', 30, 52), s('CDM', 'DM', 50, 46), s('RCM', 'CM', 70, 52),
      s('LST', 'ST', 38, 80), s('RST', 'ST', 62, 80)],
  },
  '5-4-1': {
    attack: -0.08, defense: 0.09, width: 0.0,
    slots: [GK, s('LWB', 'LWB', 9, 32), s('LCB', 'CB', 30, 22), s('CB', 'CB', 50, 19), s('RCB', 'CB', 70, 22), s('RWB', 'RWB', 91, 32),
      s('LM', 'LM', 15, 56), s('LCM', 'CM', 38, 50), s('RCM', 'CM', 62, 50), s('RM', 'RM', 85, 56),
      s('ST', 'ST', 50, 80)],
  },
}

export const FORMATION_CODES = Object.keys(FORMATIONS) as FormationCode[]
