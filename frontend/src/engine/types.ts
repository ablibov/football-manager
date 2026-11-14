// Domain types shared by the match engine and the UI. The engine never imports React.

export type Position =
  | 'GK' | 'RB' | 'LB' | 'CB' | 'RWB' | 'LWB' | 'DM' | 'CM' | 'AM' | 'RM' | 'LM' | 'RW' | 'LW' | 'ST'

export type PlayerStatus = 'available' | 'injured' | 'suspended'

export interface OutfieldAttrs { pac: number; sho: number; pas: number; dri: number; def: number; phy: number }
export interface GkAttrs { div: number; han: number; kic: number; ref: number; spd: number; pos: number }

export interface Player {
  id: string
  clubId: string
  fullName: string
  shortName: string
  number: number
  birthDate: string | null
  nationality: string | null
  position: Position
  secondary: Position[]
  heightCm: number | null
  foot: 'left' | 'right' | 'both' | null
  status: PlayerStatus
  attrs: OutfieldAttrs
  gk?: GkAttrs
  isPlaceholder: boolean
  sourceId: string | null
  updatedAt: string
}

export interface Club {
  id: string
  name: string
  shortName: string
  code: string
  city: string
  stadium: { name: string | null; capacity: number | null }
  colors: { primary: string; secondary: string; verified: boolean }
  coach: string | null
  coachSince: string | null
  gameRating: { prior: number; fittedPower: number; base: number }
  sourceId: string | null
  updatedAt: string
}

export type FormationCode = '4-3-3' | '4-2-3-1' | '4-4-2' | '4-1-4-1' | '4-3-2-1' | '3-4-3' | '3-5-2' | '5-3-2' | '5-4-1'

export interface FormationSlot { id: string; role: Position; x: number; y: number } // x 0..100 (left→right), y 0..100 (own goal→opponent goal)

export type Mentality = 'defensive' | 'balanced' | 'attacking'
export type Pressing = 'low' | 'medium' | 'high'
export type Tempo = 'slow' | 'normal' | 'fast'

export interface Tactics { mentality: Mentality; pressing: Pressing; tempo: Tempo }

export interface Lineup {
  clubId: string
  formation: FormationCode
  /** slotId → playerId */
  slots: Record<string, string>
  /** optional per-slot custom coordinates after dragging */
  customPos?: Record<string, { x: number; y: number }>
  bench: string[]
  captainId: string | null
  penaltyTakerId: string | null
  freeKickTakerId: string | null
  cornerTakerId: string | null
  tactics: Tactics
}

export type Weather = 'clear' | 'rain' | 'wind' | 'snow' | 'heat'

export type EventType =
  | 'kickoff' | 'goal' | 'own_goal' | 'penalty_goal' | 'penalty_miss' | 'chance' | 'shot_on' | 'shot_off'
  | 'shot_blocked' | 'save' | 'yellow' | 'second_yellow' | 'red' | 'sub' | 'injury' | 'offside' | 'var'
  | 'corner' | 'foul' | 'half_time' | 'full_time' | 'extra_time_start' | 'extra_time_end' | 'added_time'
  | 'shootout_kick' | 'shootout_end'

export type Side = 'home' | 'away'

export interface MatchEvent {
  id: number
  minute: number
  /** stoppage minute (e.g. 45+2 → minute 45, added 2) */
  added?: number
  type: EventType
  side?: Side
  playerId?: string
  /** assist / player coming on / fouled player */
  secondaryPlayerId?: string
  xg?: number
  /** VAR outcome, shoot-out result etc. */
  detail?: string
  score?: [number, number]
}

export interface TeamStats {
  possession: number
  shots: number
  shotsOnTarget: number
  xg: number
  passes: number
  passesCompleted: number
  passAccuracy: number
  corners: number
  fouls: number
  yellow: number
  red: number
  saves: number
  offsides: number
}

export interface MatchConfig {
  seed: string
  home: { club: Club; players: Player[]; lineup: Lineup }
  away: { club: Club; players: Player[]; lineup: Lineup }
  neutral: boolean
  weather: Weather
  /** knockout: draw after 90' goes to ET + penalties (taking aggregate into account) */
  knockout: boolean
  /** first-leg score (home of this match first) for two-legged ties: [thisHomeGoals, thisAwayGoals] from leg 1 */
  aggregate?: { homeGoals: number; awayGoals: number }
  /** home/away form, -1..1 (from last 5 results) */
  form?: { home: number; away: number }
  /** AI performs substitutions automatically (Instant mode, AI side in Live mode) */
  autoSubs: { home: boolean; away: boolean }
}

export interface PlayerMatchLine {
  playerId: string
  side: Side
  started: boolean
  minutesOn: number
  minuteOff: number | null
  goals: number
  assists: number
  yellow: number
  red: boolean
  saves: number
  goalsConceded: number
}

export interface MatchResult {
  seed: string
  homeId: string
  awayId: string
  score: [number, number]
  halfTime: [number, number]
  fullTime: [number, number]
  extraTime: boolean
  penalties: [number, number] | null
  winner: Side | null
  events: MatchEvent[]
  stats: { home: TeamStats; away: TeamStats }
  xgModel: { home: number; away: number }
  players: PlayerMatchLine[]
  finalMinute: number
}
