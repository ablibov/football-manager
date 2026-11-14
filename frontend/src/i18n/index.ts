import { useCallback } from 'react'
import type { Lang } from '../data/types'
import { useStore } from '../store/context'
import { az } from './az'
import { en } from './en'
import { ru } from './ru'

export const DICTS: Record<Lang, Record<string, string>> = { en, ru, az }
export const LANG_NAMES: Record<Lang, string> = { az: 'Azərbaycan dili', ru: 'Русский', en: 'English' }

export function translate(lang: Lang, key: string, vars?: Record<string, string | number>): string {
  let s = DICTS[lang][key] ?? en[key] ?? key
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v))
  return s
}

export type T = (key: string, vars?: Record<string, string | number>) => string

export function useT(): T {
  const lang = useStore().settings.lang
  return useCallback((key: string, vars?: Record<string, string | number>) => translate(lang, key, vars), [lang])
}

export function useLang(): Lang {
  return useStore().settings.lang
}
