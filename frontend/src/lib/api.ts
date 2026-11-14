// Thin REST client for the Caspian Match Simulator API (same origin in production; proxied by Vite in development).
import { guestId } from './guest'

export class ApiError extends Error {
  status: number
  body: unknown
  constructor(status: number, body: unknown, message: string) {
    super(message)
    this.status = status
    this.body = body
  }
}

let token: string | null = null
export const setApiToken = (t: string | null) => {
  token = t
}

function errorMessage(body: unknown, status: number): string {
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>
    if (typeof b.error === 'string') return b.error
    if (typeof b.detail === 'string') return b.detail
    const first = Object.entries(b)[0]
    if (first) return `${first[0]}: ${Array.isArray(first[1]) ? first[1].join(' ') : JSON.stringify(first[1])}`
  }
  return `HTTP ${status}`
}

export async function api<T>(path: string, opts: { method?: string; body?: unknown; form?: FormData; timeoutMs?: number } = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json', 'X-AzPFL-Guest': guestId() }
  if (token) headers.Authorization = `Token ${token}`
  let body: BodyInit | undefined
  if (opts.form) body = opts.form
  else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(opts.body)
  }
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 15000)
  try {
    const res = await fetch(`/api${path}`, { method: opts.method ?? 'GET', headers, body, signal: ctrl.signal, credentials: 'omit' })
    const text = await res.text()
    let data: unknown = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = text
    }
    if (!res.ok) throw new ApiError(res.status, data, errorMessage(data, res.status))
    return data as T
  } finally {
    clearTimeout(timer)
  }
}

/** true if the error means "backend unreachable" (vs. a validation / permission error) */
export function isNetworkError(e: unknown): boolean {
  // the Vite proxy answers 5xx with a non-JSON body when Django is not running
  if (e instanceof ApiError) return e.status >= 500 && (e.body === null || typeof e.body !== 'object')
  return true
}
