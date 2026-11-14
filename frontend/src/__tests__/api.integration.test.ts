// Runs against a live backend when AZPFL_API is set, e.g. AZPFL_API=http://127.0.0.1:8000/api npx vitest run api
import { describe, expect, it } from 'vitest'
import { SEED } from '../data/seed'
import { autoLineup } from '../engine/lineup'
import { simulateMatch } from '../engine/match'
import { fromApiMatch, toApiMatch, type ApiMatch } from '../lib/apiShapes'
import { buildConfig, toSavedMatch } from '../lib/football'

const API = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.AZPFL_API

describe.skipIf(!API)('live backend round-trip', () => {
  it('stores a simulated match and reads it back identically', async () => {
    const [h, a] = SEED.clubs
    const cfg = buildConfig({
      seed: 'api-roundtrip',
      home: { club: h, players: SEED.players.filter((p) => p.clubId === h.id), lineup: autoLineup(h.id, SEED.players, '4-3-3') },
      away: { club: a, players: SEED.players.filter((p) => p.clubId === a.id), lineup: autoLineup(a.id, SEED.players, '4-4-2') },
      knockout: true,
    })
    const saved = toSavedMatch(simulateMatch(cfg), cfg, 'instant', 'Test')
    const headers = { 'Content-Type': 'application/json', 'X-AzPFL-Guest': 'c'.repeat(32) }
    const res = await fetch(`${API}/matches/`, { method: 'POST', headers, body: JSON.stringify(toApiMatch(saved)) })
    const body = await res.json()
    expect(res.status, JSON.stringify(body).slice(0, 300)).toBe(201)
    const back = fromApiMatch(body as ApiMatch)
    expect(back.score).toEqual(saved.score)
    expect(back.events.length).toBe(saved.events.length)
    expect(back.events.map((e) => [e.type, e.minute, e.playerId])).toEqual(saved.events.map((e) => [e.type, e.minute, e.playerId]))
    expect(back.stats).toEqual(saved.stats)
    expect(back.penalties).toEqual(saved.penalties)
    // another visitor cannot see it
    const other = await (await fetch(`${API}/matches/?kind=simulated`, { headers: { 'X-AzPFL-Guest': 'd'.repeat(32) } })).json()
    expect(other).toEqual([])
    expect((await fetch(`${API}/matches/${back.id}/`, { method: 'DELETE', headers })).status).toBe(204)
  })
})
