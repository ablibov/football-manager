import { useId } from 'react'
import type { Club } from '../engine/types'
import { useT } from '../i18n'
import { contrast } from '../lib/color'
import { useStore } from '../store/context'

/**
 * Club crest. Shows an uploaded crest only when the media registry marks it enabled with
 * confirmed rights; otherwise renders a neutral Caspian Match Simulator fallback badge in the club's UI colours.
 */
export function Crest({ club, size = 40, className }: { club: Club | undefined; size?: number; className?: string }) {
  const { crestFor } = useStore()
  const gid = useId().replace(/:/g, '')
  if (!club) return <div style={{ width: size, height: size }} className={className} />
  const asset = crestFor(club.id)
  if (asset?.url) {
    return <img src={asset.url} alt={club.name} width={size} height={size} className={className} style={{ width: size, height: size, objectFit: 'contain' }} loading="lazy" />
  }
  const { primary, secondary } = club.colors
  return (
    <svg viewBox="0 0 64 72" width={size} height={size * 1.125} className={className} role="img" aria-label={`${club.name} (neutral badge)`}>
      <defs>
        <clipPath id={`s${gid}`}>
          <path d="M32 2 L60 10 V34 C60 52 47 64 32 70 C17 64 4 52 4 34 V10 Z" />
        </clipPath>
        <linearGradient id={`g${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.22" />
          <stop offset="1" stopColor="#000" stopOpacity="0.18" />
        </linearGradient>
      </defs>
      <g clipPath={`url(#s${gid})`}>
        <rect width="64" height="72" fill={primary} />
        <path d="M-4 52 L68 18 V30 L-4 64 Z" fill={secondary} opacity="0.95" />
        <rect width="64" height="72" fill={`url(#g${gid})`} />
      </g>
      <path d="M32 2 L60 10 V34 C60 52 47 64 32 70 C17 64 4 52 4 34 V10 Z" fill="none" stroke={secondary} strokeOpacity="0.7" strokeWidth="2.5" />
      <text x="32" y="38" textAnchor="middle" fontFamily="system-ui, sans-serif" fontWeight="700" fontSize="17" fill={contrast(primary)} stroke={primary} strokeWidth="0.6" paintOrder="stroke">
        {club.code}
      </text>
    </svg>
  )
}


/** Kit preview (home = primary, away = secondary). Generic Caspian Match Simulator shirt shape, not an official kit. */
export function Kit({ club, variant, size = 56 }: { club: Club; variant: 'home' | 'away'; size?: number }) {
  const { media } = useStore()
  const asset = media.find((m) => m.clubId === club.id && m.kind === (variant === 'home' ? 'kit_home' : 'kit_away') && m.enabled && m.permissionStatus === 'confirmed')
  if (asset?.url) return <img src={asset.url} alt="" style={{ width: size, height: size, objectFit: 'contain' }} />
  const body = variant === 'home' ? club.colors.primary : club.colors.secondary
  const trim = variant === 'home' ? club.colors.secondary : club.colors.primary
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
      <path d="M22 6 L12 10 L2 22 L10 30 L16 25 V58 H48 V25 L54 30 L62 22 L52 10 L42 6 C40 11 36 13 32 13 C28 13 24 11 22 6 Z" fill={body} stroke={trim} strokeWidth="2" />
      <path d="M22 6 C24 11 28 13 32 13 C36 13 40 11 42 6" fill="none" stroke={trim} strokeWidth="3" />
      <path d="M16 25 V58 M48 25 V58" stroke={trim} strokeOpacity="0.5" strokeWidth="2" />
    </svg>
  )
}

export function FormDots({ form, size = 'md' }: { form: ('W' | 'D' | 'L')[]; size?: 'sm' | 'md' }) {
  const t = useT()
  const s = size === 'sm' ? 'h-5 w-5 text-[10px]' : 'h-6 w-6 text-[11px]'
  if (!form.length) return <span className="text-xs text-faint">—</span>
  return (
    <div className="flex gap-1">
      {form.map((f, i) => (
        <span key={i} title={t(`form.long.${f}`)} className={`grid ${s} place-items-center rounded-md font-bold ${f === 'W' ? 'bg-accent text-accent-ink' : f === 'D' ? 'bg-line text-fg' : 'bg-danger/80 text-white'}`}>
          {t(`form.${f}`)}
        </span>
      ))}
    </div>
  )
}
