// Render smoke test: every page renders without throwing (server renderer, no effects).
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SEED } from '../data/seed'
import { autoLineup } from '../engine/lineup'
import { buildConfig } from '../lib/football'
import { newCup, newLeague, DEFAULT_CUP_FORMAT } from '../lib/competitions'

const store = new Map<string, string>()
function stubBrowser(hash: string) {
  vi.stubGlobal('window', { location: { hash }, addEventListener() {}, removeEventListener() {}, scrollTo() {}, confirm: () => true })
  vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) })
}

const PAGES: Record<string, [string, string, Record<string, unknown>?]> = {
  '#/': ['Dashboard', 'Dashboard'],
  '#/quick': ['QuickMatch', 'QuickMatch'],
  '#/clubs': ['Clubs', 'Clubs'],
  '#/clubs/qarabag': ['Clubs', 'Clubs', { clubId: 'qarabag' }],
  '#/squad/neftci': ['SquadBuilder', 'SquadBuilder', { clubId: 'neftci' }],
  '#/match': ['MatchCenter', 'MatchCenter'],
  '#/league': ['League', 'League'],
  '#/cup': ['Cup', 'Cup'],
  '#/stats': ['Statistics', 'Statistics'],
  '#/settings': ['Settings', 'Settings'],
  '#/admin': ['Admin', 'Admin'],
  '#/about': ['About', 'About'],
  '#/privacy': ['About', 'Privacy'],
}

async function render(hash: string) {
  stubBrowser(hash)
  vi.resetModules()
  const { StoreProvider } = await import('../store/StoreProvider')
  const { Layout } = await import('../components/Layout')
  const [file, name, props] = PAGES[hash]
  const mod = (await import(`../pages/${file}.tsx`)) as Record<string, (p: unknown) => unknown>
  const page = createElement(mod[name] as never, props ?? {})
  return renderToString(createElement(StoreProvider, null, createElement(Layout, { route: { page: 'dashboard' } } as never, page)))
}

describe('pages render', () => {
  beforeEach(() => store.clear())
  const players = (id: string) => SEED.players.filter((p) => p.clubId === id)

  it.each(['#/', '#/quick', '#/clubs', '#/clubs/qarabag', '#/squad/neftci', '#/match', '#/league', '#/cup', '#/stats', '#/settings', '#/admin', '#/about', '#/privacy'])('%s', async (hash) => {
    const html = await render(hash)
    expect(html.length).toBeGreaterThan(3000)
    expect(html).not.toMatch(/>(?:[a-z]+\.)+[a-zA-Z_]+</) // untranslated i18n key
    expect(html).not.toMatch(/>(undefined|NaN|null)</)
    expect(html).not.toMatch(/AzPFL/)
    expect(html).toContain('Caspian')
  })

  it('renders Dashboard and Statistics with an API dataset that has no calibration block', async () => {
    const { calibration: _drop, ...apiShape } = JSON.parse(JSON.stringify(SEED))
    void _drop
    store.set('azpfl.dataset.local', JSON.stringify(apiShape))
    vi.resetModules()
    const { normalizeDataset } = await import('../data/seed')
    store.set('azpfl.dataset.local', JSON.stringify(normalizeDataset(apiShape)))
    expect(normalizeDataset(apiShape).calibration.goalsPerMatch).toBe(SEED.calibration.goalsPerMatch)
    for (const hash of ['#/', '#/stats']) expect((await render(hash)).length).toBeGreaterThan(3000)
  })

  it('renders the dashboard (ready) with real table, live match, league and cup saves', async () => {
    const cfg = buildConfig({
      seed: 'smoke',
      home: { club: SEED.clubs[0], players: players(SEED.clubs[0].id), lineup: autoLineup(SEED.clubs[0].id, SEED.players, '4-3-3') },
      away: { club: SEED.clubs[1], players: players(SEED.clubs[1].id), lineup: autoLineup(SEED.clubs[1].id, SEED.players, '3-5-2') },
    })
    store.set('azpfl.pending', JSON.stringify({ config: cfg, mode: 'instant', stadiumName: 'X', context: { kind: 'quick' }, userSides: ['home'] }))
    const league = { ...newLeague(SEED, 'L', 's'), id: 'local-l', localOnly: true }
    const cup = { ...newCup(SEED, 'C', 's', SEED.clubs.map((c) => c.id), DEFAULT_CUP_FORMAT, []), id: 'local-c', localOnly: true }
    store.set('azpfl.saves', JSON.stringify([league, cup]))
    for (const hash of ['#/match', '#/league', '#/cup', '#/stats']) {
      const html = await render(hash)
      expect(html.length).toBeGreaterThan(3000)
      if (hash === '#/match') expect(html).toMatch(/scoreboard-digit/)
      expect(html).not.toMatch(/>(?:[a-z]+\.)+[a-zA-Z_]+</)
      expect(html).not.toMatch(/>(undefined|NaN|null)</)
    }
  })
})
