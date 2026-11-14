import { useEffect, useState } from 'react'

export type Route =
  | { page: 'dashboard' }
  | { page: 'quick' }
  | { page: 'clubs'; clubId?: string }
  | { page: 'squad'; clubId?: string }
  | { page: 'match'; matchId?: string }
  | { page: 'league' }
  | { page: 'cup' }
  | { page: 'stats' }
  | { page: 'settings' }
  | { page: 'admin' }
  | { page: 'about' }
  | { page: 'privacy' }

export function parseHash(hash: string): Route {
  const [, page = '', arg] = hash.replace(/^#/, '').split('/')
  switch (page) {
    case 'quick': return { page: 'quick' }
    case 'clubs': return { page: 'clubs', clubId: arg ? decodeURIComponent(arg) : undefined }
    case 'squad': return { page: 'squad', clubId: arg ? decodeURIComponent(arg) : undefined }
    case 'match': return { page: 'match', matchId: arg ? decodeURIComponent(arg) : undefined }
    case 'league': return { page: 'league' }
    case 'cup': return { page: 'cup' }
    case 'stats': return { page: 'stats' }
    case 'settings': return { page: 'settings' }
    case 'admin': return { page: 'admin' }
    case 'about': return { page: 'about' }
    case 'privacy': return { page: 'privacy' }
    default: return { page: 'dashboard' }
  }
}

export function href(r: Route): string {
  const raw = 'clubId' in r ? r.clubId : 'matchId' in r ? r.matchId : undefined
  const arg = raw ? `/${encodeURIComponent(raw)}` : ''
  return r.page === 'dashboard' ? '#/' : `#/${r.page}${arg}`
}

export function navigate(r: Route) {
  window.location.hash = href(r)
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(window.location.hash))
  useEffect(() => {
    const on = () => {
      setRoute(parseHash(window.location.hash))
      window.scrollTo({ top: 0 })
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return route
}
