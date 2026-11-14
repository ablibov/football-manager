import raw from '../../../shared/seed/azpfl-2026-27.json'
import type { Club, Player } from '../engine/types'

export interface DataSource { id: string; name: string; url: string | null; license: string; termsChecked: boolean; accessedAt: string; notes: string }
export interface RealMatch { id: string; season: string; competition: string; round: number; date: string | null; homeId: string; awayId: string; homeGoals: number | null; awayGoals: number | null; status: 'played' | 'postponed' | 'scheduled'; sourceId: string }
export interface CompetitionRule {
  id: string; competition: 'apl' | 'cup'; season: string; name: string; format: 'round_robin' | 'knockout'
  roundRobinCycles?: number; pointsWin?: number; pointsDraw?: number; pointsLoss?: number; tiebreakers?: string[]
  legs?: { default: number; semiFinal: number; final: number }; extraTime?: boolean; penalties?: boolean; awayGoals?: boolean
  verified: boolean; sourceId: string; notes: string
}
export interface Dataset {
  schema: string
  season: { id: string; name: string; dataVersion: number; startDate: string; endDate: string; updatedAt: string }
  competitionRules: CompetitionRule[]
  calibration: Record<string, number | string>
  dataSources: DataSource[]
  clubs: Club[]
  players: Player[]
  realMatches: RealMatch[]
}

type RawClub = Club & { players: Player[] }

export function normalizeDataset(input: unknown): Dataset {
  const d = input as Omit<Dataset, 'clubs' | 'players'> & { clubs: RawClub[]; players?: Player[] }
  if (!d || !Array.isArray(d.clubs)) throw new Error('Invalid dataset: clubs missing')
  const players: Player[] = d.players ? [...d.players] : []
  const clubs: Club[] = d.clubs.map((c) => {
    const { players: ps, ...club } = c
    if (ps) players.push(...ps)
    return club as Club
  })
  return {
    ...d,
    clubs,
    players,
    realMatches: d.realMatches ?? [],
    dataSources: d.dataSources ?? [],
    competitionRules: d.competitionRules ?? [],
    // datasets from the API or older exports may lack calibration — fall back to the bundled one
    calibration: d.calibration ?? (raw as { calibration?: Dataset['calibration'] }).calibration ?? {},
  } as Dataset
}

export const SEED: Dataset = normalizeDataset(raw)
