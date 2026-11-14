// Azerbaijani-aware sorting and search. Names are never modified — only compared.

const collator = new Intl.Collator('az', { sensitivity: 'base', numeric: true })
export const compareAz = (a: string, b: string) => collator.compare(a, b)

const FOLD: Record<string, string> = { ə: 'e', ı: 'i', ğ: 'g', ş: 's', ç: 'c', ö: 'o', ü: 'u' }

/** Lower-case with Azerbaijani rules (I→ı, İ→i) and fold letters so "qarabag" finds "Qarabağ". */
export function fold(s: string): string {
  return s
    .toLocaleLowerCase('az')
    .replace(/[əığşçöü]/g, (c) => FOLD[c] ?? c)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

export function matches(haystack: string, query: string): boolean {
  const q = fold(query.trim())
  if (!q) return true
  const h = fold(haystack)
  return h.includes(q)
}

export function surname(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  return parts.length > 1 ? parts[parts.length - 1] : fullName
}

export const clsx = (...xs: (string | false | null | undefined)[]) => xs.filter(Boolean).join(' ')
