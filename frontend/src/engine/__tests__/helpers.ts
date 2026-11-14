import { SEED } from '../../data/seed'
import { autoLineup } from '../lineup'
import type { FormationCode, MatchConfig, Tactics } from '../types'

export function cfgFor(homeId: string, awayId: string, seed: string, opts: Partial<MatchConfig> & { hf?: FormationCode; af?: FormationCode; ht?: Tactics; at?: Tactics } = {}): MatchConfig {
  const club = (id: string) => SEED.clubs.find((c) => c.id === id)!
  const players = (id: string) => SEED.players.filter((p) => p.clubId === id)
  const hl = autoLineup(homeId, players(homeId), opts.hf ?? '4-3-3', opts.ht)
  const al = autoLineup(awayId, players(awayId), opts.af ?? '4-3-3', opts.at)
  return {
    seed,
    home: { club: club(homeId), players: players(homeId), lineup: hl },
    away: { club: club(awayId), players: players(awayId), lineup: al },
    neutral: opts.neutral ?? false,
    weather: opts.weather ?? 'clear',
    knockout: opts.knockout ?? false,
    aggregate: opts.aggregate,
    form: opts.form,
    autoSubs: opts.autoSubs ?? { home: true, away: true },
  }
}

export const CLUB_IDS = SEED.clubs.map((c) => c.id)
