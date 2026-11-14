import { createContext, useContext } from 'react'
import type { Dataset } from '../data/seed'
import type { MediaAssetInfo, PendingMatch, SavedMatch, SaveRecord, Settings, Toast } from '../data/types'
import type { Club, Lineup, Player } from '../engine/types'

export interface AppStore {
  ready: boolean
  online: boolean
  staff: boolean
  username: string | null
  dataset: Dataset
  clubs: Club[]
  players: Player[]
  media: MediaAssetInfo[]
  lineups: Record<string, Lineup>
  saves: SaveRecord[]
  matches: SavedMatch[]
  settings: Settings
  pending: PendingMatch | null
  toasts: Toast[]
  localEdits: boolean

  club: (id: string) => Club | undefined
  clubPlayers: (clubId: string) => Player[]
  lineupFor: (clubId: string) => Lineup
  crestFor: (clubId: string) => MediaAssetInfo | undefined

  setSettings: (s: Partial<Settings>) => void
  toast: (kind: Toast['kind'], text: string) => void
  dismissToast: (id: number) => void

  saveLineup: (l: Lineup) => Promise<void>
  resetLineup: (clubId: string) => Promise<void>
  savePlayer: (p: Player, isNew?: boolean) => Promise<boolean>
  deletePlayer: (id: string) => Promise<boolean>
  transferPlayer: (id: string, clubId: string | null, number: number) => Promise<boolean>
  saveClub: (c: Club) => Promise<boolean>

  recordMatch: (m: SavedMatch) => Promise<SavedMatch>
  deleteMatch: (id: string) => Promise<void>
  putSave: (s: SaveRecord) => Promise<SaveRecord>
  deleteSave: (id: string) => Promise<void>

  startMatch: (p: PendingMatch) => void
  clearPending: () => void

  importDataset: (data: unknown) => Promise<boolean>
  exportDataset: () => Promise<unknown>
  resetLocalData: () => void
  deleteMyData: () => Promise<boolean>
  login: (username: string, password: string) => Promise<boolean>
  logout: () => void
  uploadMedia: (form: FormData) => Promise<boolean>
  updateMedia: (id: string, patch: Partial<MediaAssetInfo>) => Promise<boolean>
  refresh: () => Promise<void>
}

export const StoreContext = createContext<AppStore | null>(null)

export function useStore(): AppStore {
  const s = useContext(StoreContext)
  if (!s) throw new Error('useStore outside StoreProvider')
  return s
}
