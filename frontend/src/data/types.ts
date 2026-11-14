import type { CupState } from '../engine/cup'
import type { ScheduledFixture } from '../engine/schedule'
import type { MatchConfig, MatchEvent, PlayerMatchLine, Side, TeamStats, Weather } from '../engine/types'

export type Lang = 'az' | 'ru' | 'en'
export type Theme = 'dark' | 'light'

export interface Settings {
  lang: Lang
  theme: Theme
  weatherEnabled: boolean
  defaultSpeed: number
}

export interface MediaAssetInfo {
  id: string
  kind: 'crest' | 'kit_home' | 'kit_away' | 'photo'
  clubId: string | null
  playerId: string | null
  url: string | null
  mime: string
  width: number | null
  height: number | null
  rightsHolder: string
  license: string
  permissionStatus: 'confirmed' | 'pending' | 'unknown' | 'denied'
  sourceUrl: string
  enabled: boolean
}

export type MatchMode = 'instant' | 'live' | 'manual'

/** A finished match as stored in history (quick matches) */
export interface SavedMatch {
  id: string
  createdAt: string
  homeId: string
  awayId: string
  score: [number, number]
  halfTime: [number, number] | null
  penalties: [number, number] | null
  extraTime: boolean
  mode: MatchMode
  seed: string
  neutral: boolean
  weather: Weather
  stadiumName: string
  events: MatchEvent[]
  stats: { home: TeamStats; away: TeamStats } | null
  players: PlayerMatchLine[] | null
}

/** Result stored inside league / cup saves */
export interface CompactResult {
  homeGoals: number
  awayGoals: number
  halfTime: [number, number] | null
  extraTime: boolean
  penalties: [number, number] | null
  events: MatchEvent[]
  stats: { home: TeamStats; away: TeamStats } | null
  players: PlayerMatchLine[]
  seed: string
  mode: MatchMode
}

export interface LeagueData {
  type: 'league'
  seasonId: string
  ruleId: string
  cycles: number
  tiebreakers: string[]
  points: { win: number; draw: number; loss: number }
  seed: string
  clubIds: string[]
  fixtures: ScheduledFixture[]
  results: Record<string, CompactResult>
  createdAt: string
}

export interface CupData {
  type: 'cup'
  seasonId: string
  state: CupState
  /** key: `${tieId}:${leg}` */
  results: Record<string, CompactResult & { homeId: string; awayId: string }>
  createdAt: string
}

export interface SaveRecord<T = LeagueData | CupData> {
  id: string
  kind: 'league' | 'cup'
  name: string
  season: string | null
  data: T
  version: number
  updatedAt: string
  /** true when the save only exists in this browser */
  localOnly?: boolean
}

export type MatchContext =
  | { kind: 'quick' }
  | { kind: 'league'; saveId: string; fixtureId: string }
  | { kind: 'cup'; saveId: string; tieId: string; leg: number }

export interface PendingMatch {
  config: MatchConfig
  mode: Exclude<MatchMode, 'manual'>
  stadiumName: string
  context: MatchContext
  /** sides controlled by the user in live mode (substitutions, tactics) */
  userSides: Side[]
}

export interface Toast { id: number; kind: 'ok' | 'error' | 'info'; text: string }
