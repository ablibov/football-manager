import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { normalizeDataset, SEED, type Dataset } from '../data/seed'
import type { MediaAssetInfo, PendingMatch, SavedMatch, SaveRecord, Settings, Toast } from '../data/types'
import { autoLineup, repairLineup } from '../engine/lineup'
import type { Club, Lineup, Player } from '../engine/types'
import { api, ApiError, isNetworkError, setApiToken } from '../lib/api'
import { readLocal, removeLocal, writeLocal } from '../lib/storage'
import { StoreContext, type AppStore } from './context'

const LS = {
  settings: 'azpfl.settings',
  token: 'azpfl.token',
  dataset: 'azpfl.dataset.local',
  lineups: 'azpfl.lineups',
  saves: 'azpfl.saves',
  matches: 'azpfl.matches',
  pending: 'azpfl.pending',
}

function detectLang(): Settings['lang'] {
  try {
    const l = (navigator.language || 'az').toLowerCase()
    return l.startsWith('ru') ? 'ru' : l.startsWith('en') ? 'en' : 'az'
  } catch {
    return 'az'
  }
}

const DEFAULT_SETTINGS: Settings = { lang: detectLang(), theme: 'dark', weatherEnabled: true, defaultSpeed: 4 }

import { fromApiLineup, fromApiMatch, toApiMatch, type ApiLineup, type ApiMatch, type ApiSave } from '../lib/apiShapes'

function uid() {
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [settings, setSettingsState] = useState<Settings>(() => ({ ...DEFAULT_SETTINGS, ...readLocal<Partial<Settings>>(LS.settings, {}) }))
  const [ready, setReady] = useState(false)
  const [online, setOnline] = useState(false)
  const [staff, setStaff] = useState(false)
  const [username, setUsername] = useState<string | null>(() => readLocal<{ user: string } | null>(LS.token, null)?.user ?? null)
  const [dataset, setDataset] = useState<Dataset>(() => {
    const local = readLocal<Dataset | null>(LS.dataset, null)
    try {
      return local ? normalizeDataset(local) : SEED
    } catch {
      return SEED
    }
  })
  const [localEdits, setLocalEdits] = useState(() => readLocal<Dataset | null>(LS.dataset, null) !== null)
  const [media, setMedia] = useState<MediaAssetInfo[]>([])
  const [lineups, setLineups] = useState<Record<string, Lineup>>(() => readLocal(LS.lineups, {}))
  const [saves, setSaves] = useState<SaveRecord[]>(() => readLocal(LS.saves, []))
  const [matches, setMatches] = useState<SavedMatch[]>(() => readLocal(LS.matches, []))
  const [pending, setPending] = useState<PendingMatch | null>(() => readLocal(LS.pending, null))
  const [toasts, setToasts] = useState<Toast[]>([])
  const toastId = useRef(0)
  const onlineRef = useRef(false)

  const fail = useCallback((e: unknown, key = 'error.save') => {
    console.error('Caspian Match Simulator:', e)
    const id = ++toastId.current
    setToasts((t) => [...t.slice(-3), { id, kind: 'error', text: key }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200)
  }, [])

  const toast = useCallback((kind: Toast['kind'], text: string) => {
    const id = ++toastId.current
    setToasts((t) => [...t.slice(-3), { id, kind, text }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200)
  }, [])
  const dismissToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), [])

  // theme + language side effects
  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme
    document.documentElement.lang = settings.lang
    writeLocal(LS.settings, settings)
  }, [settings])
  const setSettings = useCallback((s: Partial<Settings>) => setSettingsState((cur) => ({ ...cur, ...s })), [])

  useEffect(() => writeLocal(LS.lineups, lineups), [lineups])
  useEffect(() => writeLocal(LS.saves, saves), [saves])
  useEffect(() => writeLocal(LS.matches, matches.slice(0, 200)), [matches])
  useEffect(() => {
    if (pending) writeLocal(LS.pending, pending)
    else removeLocal(LS.pending)
  }, [pending])

  const goOffline = useCallback(() => {
    if (onlineRef.current) toast('error', 'offline')
    onlineRef.current = false
    setOnline(false)
  }, [toast])

  const refresh = useCallback(async () => {
    const stored = readLocal<{ token: string; user: string } | null>(LS.token, null)
    setApiToken(stored?.token ?? null)
    try {
      const health = await api<{ ok: boolean; staff: boolean }>('/health/', { timeoutMs: 4000 })
      if (!health?.ok) throw new Error('bad health')
      // upload progress that was made while the server was unreachable
      const synced = new Map<string, string>()
      for (const s of readLocal<SaveRecord[]>(LS.saves, []).filter((x) => x.localOnly)) {
        try {
          const res = await api<ApiSave>('/saves/', { method: 'POST', body: { kind: s.kind, name: s.name, season: s.season, data: s.data } })
          synced.set(s.id, res.id)
        } catch (e) {
          console.error('Caspian Match Simulator: could not sync save', e)
        }
      }
      for (const m of readLocal<SavedMatch[]>(LS.matches, []).filter((x) => x.id.startsWith('local-'))) {
        try {
          await api('/matches/', { method: 'POST', body: toApiMatch(m) })
          synced.set(m.id, m.id)
        } catch (e) {
          console.error('Caspian Match Simulator: could not sync match', e)
        }
      }
      if (synced.size) {
        setPending((p) => (p && 'saveId' in p.context && synced.has(p.context.saveId) ? { ...p, context: { ...p.context, saveId: synced.get(p.context.saveId)! } } : p))
      }
      const [ds, ls, sv, ms] = await Promise.all([
        api<unknown>('/bootstrap/'),
        api<ApiLineup[]>('/lineups/'),
        api<ApiSave[]>('/saves/'),
        api<ApiMatch[]>('/matches/?kind=simulated'),
      ])
      const data = normalizeDataset(ds) as Dataset & { media?: MediaAssetInfo[] }
      onlineRef.current = true
      setOnline(true)
      setStaff(!!health.staff)
      setDataset(data)
      setLocalEdits(false)
      setMedia(data.media ?? [])
      setLineups((cur) => {
        const fromApi = Object.fromEntries(ls.filter((l) => l.name === 'default').map((l) => [l.clubId, fromApiLineup(l)]))
        // keep local-only line-ups (made offline) unless the server has one
        return { ...cur, ...fromApi }
      })
      setSaves((cur) => {
        const server = sv.map((s) => ({ ...s, localOnly: false }) as SaveRecord)
        const localOnly = cur.filter((s) => s.localOnly && !synced.has(s.id) && !server.some((x) => x.id === s.id))
        return [...server, ...localOnly]
      })
      setMatches((cur) => {
        const server = ms.map(fromApiMatch)
        const localOnly = cur.filter((m) => m.id.startsWith('local-') && !synced.has(m.id))
        return [...localOnly, ...server].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      })
    } catch {
      onlineRef.current = false
      setOnline(false)
      setStaff(false)
    } finally {
      setReady(true)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load from the backend
    void refresh()
  }, [refresh])

  const clubs = dataset.clubs
  const players = dataset.players
  const club = useCallback((id: string) => clubs.find((c) => c.id === id), [clubs])
  const clubPlayers = useCallback((clubId: string) => players.filter((p) => p.clubId === clubId), [players])
  const lineupFor = useCallback(
    (clubId: string) => {
      const saved = lineups[clubId]
      return saved ? repairLineup(saved, players) : autoLineup(clubId, players, '4-3-3')
    },
    [lineups, players],
  )
  const crestFor = useCallback((clubId: string) => media.find((m) => m.kind === 'crest' && m.clubId === clubId && m.enabled && m.permissionStatus === 'confirmed'), [media])

  const persistLocalDataset = useCallback((d: Dataset) => {
    writeLocal(LS.dataset, d)
    setLocalEdits(true)
  }, [])

  // ---------- line-ups (user data: anyone may save)
  const saveLineup = useCallback(async (l: Lineup) => {
    setLineups((cur) => ({ ...cur, [l.clubId]: l }))
    if (!onlineRef.current) return
    try {
      await api('/lineups/', { method: 'POST', body: { ...l, name: 'default', customPos: l.customPos ?? null } })
    } catch (e) {
      if (isNetworkError(e)) goOffline()
      else fail(e)
      throw e
    }
  }, [goOffline, fail])

  const resetLineup = useCallback(async (clubId: string) => {
    const fresh = autoLineup(clubId, players, '4-3-3')
    await saveLineup(fresh)
  }, [players, saveLineup])

  // ---------- real data edits (staff on the backend; local overrides when offline)
  const mutateDataset = useCallback(
    async (apiCall: (() => Promise<unknown>) | null, local: (d: Dataset) => Dataset): Promise<boolean> => {
      if (onlineRef.current) {
        if (!staff) {
          toast('error', 'admin_required')
          return false
        }
        try {
          if (apiCall) await apiCall()
        } catch (e) {
          fail(e)
          return false
        }
        setDataset((d) => local(d))
        return true
      }
      toast('error', 'error.offlineEdit')
      return false
    },
    [staff, toast, fail],
  )

  const savePlayer = useCallback(
    (p: Player, isNew = false) =>
      mutateDataset(
        () => (isNew ? api('/players/', { method: 'POST', body: p }) : api(`/players/${encodeURIComponent(p.id)}/`, { method: 'PATCH', body: p })),
        (d) => ({ ...d, players: isNew ? [...d.players, p] : d.players.map((x) => (x.id === p.id ? { ...p, updatedAt: new Date().toISOString().slice(0, 10) } : x)) }),
      ),
    [mutateDataset],
  )
  const deletePlayer = useCallback(
    (id: string) => mutateDataset(() => api(`/players/${encodeURIComponent(id)}/`, { method: 'DELETE' }), (d) => ({ ...d, players: d.players.filter((x) => x.id !== id) })),
    [mutateDataset],
  )
  const transferPlayer = useCallback(
    (id: string, clubId: string | null, number: number) =>
      mutateDataset(
        () => api(`/players/${encodeURIComponent(id)}/transfer/`, { method: 'POST', body: { club: clubId, number } }),
        (d) => ({ ...d, players: d.players.map((x) => (x.id === id ? { ...x, clubId: clubId as string, number } : x)) }),
      ),
    [mutateDataset],
  )
  const saveClub = useCallback(
    (c: Club) => mutateDataset(() => api(`/clubs/${encodeURIComponent(c.id)}/`, { method: 'PATCH', body: c }), (d) => ({ ...d, clubs: d.clubs.map((x) => (x.id === c.id ? c : x)) })),
    [mutateDataset],
  )

  // ---------- match history
  const recordMatch = useCallback(async (m: SavedMatch) => {
    let saved = m
    if (onlineRef.current) {
      try {
        const res = await api<ApiMatch>('/matches/', { method: 'POST', body: toApiMatch(m) })
        saved = { ...m, id: res.id, createdAt: res.createdAt }
      } catch (e) {
        if (isNetworkError(e)) goOffline()
        else fail(e)
      }
    }
    setMatches((cur) => [saved, ...cur.filter((x) => x.id !== m.id)])
    return saved
  }, [goOffline, fail])

  const deleteMatch = useCallback(async (id: string) => {
    if (onlineRef.current && !id.startsWith('local-')) {
      try {
        await api(`/matches/${id}/`, { method: 'DELETE' })
      } catch (e) {
        if (!(e instanceof ApiError && e.status === 404)) {
          fail(e)
          return
        }
      }
    }
    setMatches((cur) => cur.filter((x) => x.id !== id))
  }, [fail])

  // ---------- league / cup saves
  const putSave = useCallback(async (s: SaveRecord) => {
    let saved: SaveRecord = { ...s, updatedAt: new Date().toISOString() }
    if (onlineRef.current) {
      try {
        const body = { kind: s.kind, name: s.name, season: s.season, data: s.data }
        const res = s.id && !s.id.startsWith('local-')
          ? await api<ApiSave>(`/saves/${s.id}/`, { method: 'PUT', body })
          : await api<ApiSave>('/saves/', { method: 'POST', body })
        saved = { ...res, localOnly: false } as SaveRecord
      } catch (e) {
        if (isNetworkError(e)) goOffline()
        else fail(e)
        saved = { ...saved, id: s.id || uid(), localOnly: true }
      }
    } else {
      saved = { ...saved, id: s.id || uid(), localOnly: true }
    }
    setSaves((cur) => {
      const rest = cur.filter((x) => x.id !== s.id && x.id !== saved.id)
      return [saved, ...rest]
    })
    return saved
  }, [goOffline, fail])

  const deleteSave = useCallback(async (id: string) => {
    if (onlineRef.current && !id.startsWith('local-')) {
      try {
        await api(`/saves/${id}/`, { method: 'DELETE' })
      } catch (e) {
        if (!(e instanceof ApiError && e.status === 404)) {
          fail(e)
          return
        }
      }
    }
    setSaves((cur) => cur.filter((x) => x.id !== id))
  }, [fail])

  const startMatch = useCallback((p: PendingMatch) => setPending(p), [])
  const clearPending = useCallback(() => setPending(null), [])

  // ---------- dataset import / export
  const importDataset = useCallback(async (data: unknown) => {
    let normalized: Dataset
    try {
      normalized = normalizeDataset(data)
    } catch (e) {
      fail(e)
      return false
    }
    if (onlineRef.current) {
      if (!staff) {
        toast('error', 'admin_required')
        return false
      }
      try {
        await api('/import/', { method: 'POST', body: data, timeoutMs: 60000 })
        await refresh()
        return true
      } catch (e) {
        fail(e)
        return false
      }
    }
    setDataset(normalized)
    persistLocalDataset(normalized)
    return true
  }, [staff, toast, fail, refresh, persistLocalDataset])

  const exportDataset = useCallback(async () => {
    if (onlineRef.current) {
      try {
        return await api('/export/')
      } catch {
        /* fall through to local copy */
      }
    }
    const { clubs: cs, players: ps, ...rest } = dataset
    return { ...rest, clubs: cs, players: ps }
  }, [dataset])

  const resetLocalData = useCallback(() => {
    for (const k of [LS.dataset, LS.lineups, LS.saves, LS.matches, LS.pending]) removeLocal(k)
    setDataset(SEED)
    setLocalEdits(false)
    setLineups({})
    setSaves((cur) => cur.filter((s) => !s.localOnly))
    setMatches((cur) => cur.filter((m) => !m.id.startsWith('local-')))
    setPending(null)
    void refresh()
  }, [refresh])

  /** deletes the visitor's progress on the server (if reachable) and on this device */
  const deleteMyData = useCallback(async () => {
    if (onlineRef.current) {
      try {
        await api('/me/', { method: 'DELETE' })
      } catch (e) {
        fail(e)
        return false
      }
    }
    setSaves([])
    setMatches([])
    resetLocalData()
    return true
  }, [fail, resetLocalData])

  const login = useCallback(async (user: string, password: string) => {
    try {
      const res = await api<{ token: string }>('/auth/token/', { method: 'POST', body: { username: user, password } })
      writeLocal(LS.token, { token: res.token, user })
      setUsername(user)
      await refresh()
      return true
    } catch (e) {
      fail(e)
      return false
    }
  }, [refresh, fail])

  const logout = useCallback(() => {
    removeLocal(LS.token)
    setApiToken(null)
    setUsername(null)
    setStaff(false)
  }, [])

  const uploadMedia = useCallback(async (form: FormData) => {
    try {
      const m = await api<MediaAssetInfo>('/media/', { method: 'POST', form })
      setMedia((cur) => [...cur, m])
      return true
    } catch (e) {
      fail(e)
      return false
    }
  }, [fail])

  const updateMedia = useCallback(async (id: string, patch: Partial<MediaAssetInfo>) => {
    try {
      const m = await api<MediaAssetInfo>(`/media/${id}/`, { method: 'PATCH', body: patch })
      setMedia((cur) => cur.map((x) => (x.id === id ? m : x)))
      return true
    } catch (e) {
      fail(e)
      return false
    }
  }, [fail])

  // staff see all media (incl. pending) for the registry
  useEffect(() => {
    if (!staff || !online) return
    api<MediaAssetInfo[]>('/media/').then(setMedia).catch(() => undefined)
  }, [staff, online])

  const value: AppStore = useMemo(() => ({
    ready, online, staff, username, dataset, clubs, players, media, lineups, saves, matches, settings, pending, toasts, localEdits,
    club, clubPlayers, lineupFor, crestFor, setSettings, toast, dismissToast, saveLineup, resetLineup, savePlayer, deletePlayer,
    transferPlayer, saveClub, recordMatch, deleteMatch, putSave, deleteSave, startMatch, clearPending, importDataset, exportDataset,
    resetLocalData, deleteMyData, login, logout, uploadMedia, updateMedia, refresh,
  }), [ready, online, staff, username, dataset, clubs, players, media, lineups, saves, matches, settings, pending, toasts, localEdits,
    club, clubPlayers, lineupFor, crestFor, setSettings, toast, dismissToast, saveLineup, resetLineup, savePlayer, deletePlayer,
    transferPlayer, saveClub, recordMatch, deleteMatch, putSave, deleteSave, startMatch, clearPending, importDataset, exportDataset,
    resetLocalData, deleteMyData, login, logout, uploadMedia, updateMedia, refresh])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}
