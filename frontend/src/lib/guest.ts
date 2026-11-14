// Anonymous visitor id: lets guests keep their own saves on the server without registering.
const KEY = 'azpfl.guest'
let memory: string | null = null

function random32(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function guestId(): string {
  try {
    const v = localStorage.getItem(KEY)
    if (v && /^[0-9a-f]{32}$/.test(v)) return v
    const n = random32()
    localStorage.setItem(KEY, n)
    return n
  } catch {
    // storage blocked (private mode): keep one id for this tab
    memory ??= random32()
    return memory
  }
}
