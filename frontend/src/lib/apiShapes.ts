import type { SavedMatch, SaveRecord } from '../data/types'
import { DEFAULT_TACTICS } from '../engine/lineup'
import type { Lineup, MatchEvent, Tactics } from '../engine/types'

// ---------- API ↔ app shape converters
export interface ApiMatch {
  id: string; kind: string; homeId: string; awayId: string; homeGoals: number; awayGoals: number; halfTime: [number, number] | null
  extraTime: boolean; penalties: [number, number] | null; mode: SavedMatch['mode']; seed: string; neutral: boolean; weather: SavedMatch['weather']
  stadiumName: string; playerLines: SavedMatch['players']; events: (MatchEvent & { playerId: string; secondaryPlayerId: string })[]
  stats: SavedMatch['stats'] | Record<string, never>; createdAt: string
}

export function fromApiMatch(m: ApiMatch): SavedMatch {
  return {
    id: m.id, createdAt: m.createdAt, homeId: m.homeId, awayId: m.awayId, score: [m.homeGoals, m.awayGoals], halfTime: m.halfTime,
    penalties: m.penalties, extraTime: m.extraTime, mode: m.mode, seed: m.seed, neutral: m.neutral, weather: m.weather, stadiumName: m.stadiumName,
    events: m.events.map((e) => {
      const ev: MatchEvent = { ...e, playerId: e.playerId || undefined, secondaryPlayerId: e.secondaryPlayerId || undefined }
      if (ev.added == null) delete ev.added
      if (ev.xg == null) delete ev.xg
      if (!ev.detail) delete ev.detail
      if (!ev.side) delete ev.side
      if (ev.score == null) delete ev.score
      return ev
    }),
    stats: m.stats && 'home' in m.stats ? (m.stats as SavedMatch['stats']) : null,
    players: m.playerLines,
  }
}

export function toApiMatch(m: SavedMatch) {
  return {
    kind: 'simulated', homeId: m.homeId, awayId: m.awayId, homeGoals: m.score[0], awayGoals: m.score[1], halfTime: m.halfTime,
    extraTime: m.extraTime, penalties: m.penalties, mode: m.mode, seed: m.seed, neutral: m.neutral, weather: m.weather,
    stadiumName: m.stadiumName, playerLines: m.players,
    events: m.events.map((e) => ({
      id: e.id, minute: e.minute, added: e.added ?? null, type: e.type, side: e.side ?? '', playerId: e.playerId ?? '',
      secondaryPlayerId: e.secondaryPlayerId ?? '', xg: e.xg ?? null, detail: e.detail ?? '', score: e.score ?? null,
    })),
    stats: m.stats ?? undefined,
  }
}

export interface ApiLineup extends Omit<Lineup, 'customPos'> { id: number; name: string; customPos: Lineup['customPos'] | null }
export const fromApiLineup = (l: ApiLineup): Lineup => ({
  clubId: l.clubId, formation: l.formation, slots: l.slots, customPos: l.customPos ?? undefined, bench: l.bench,
  captainId: l.captainId, penaltyTakerId: l.penaltyTakerId, freeKickTakerId: l.freeKickTakerId, cornerTakerId: l.cornerTakerId,
  tactics: { ...DEFAULT_TACTICS, ...(l.tactics as Partial<Tactics>) },
})

export interface ApiSave { id: string; kind: SaveRecord['kind']; name: string; season: string | null; data: SaveRecord['data']; version: number; updatedAt: string }

