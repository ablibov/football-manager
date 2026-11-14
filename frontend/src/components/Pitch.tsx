import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { FORMATIONS } from '../engine/formations'
import { positionFit, slotRating } from '../engine/ratings'
import type { Club, Lineup, Player } from '../engine/types'
import { clsx, surname } from '../lib/text'
import { contrast } from '../lib/color'

/** Football pitch markings, vertical, own goal at the bottom. */
export function PitchMarkings({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 68 105" preserveAspectRatio="none" className={clsx('absolute inset-0 h-full w-full', className)} aria-hidden="true">
      <defs>
        <pattern id="stripes" width="68" height="15" patternUnits="userSpaceOnUse">
          <rect width="68" height="7.5" fill="var(--pitch-1)" />
          <rect y="7.5" width="68" height="7.5" fill="var(--pitch-2)" />
        </pattern>
      </defs>
      <rect width="68" height="105" fill="url(#stripes)" />
      <g fill="none" stroke="var(--pitch-line)" strokeWidth="0.35">
        <rect x="1.5" y="1.5" width="65" height="102" />
        <line x1="1.5" y1="52.5" x2="66.5" y2="52.5" />
        <circle cx="34" cy="52.5" r="9.15" />
        <rect x="13.84" y="1.5" width="40.32" height="16.5" />
        <rect x="24.84" y="1.5" width="18.32" height="5.5" />
        <rect x="13.84" y="87" width="40.32" height="16.5" />
        <rect x="24.84" y="98" width="18.32" height="5.5" />
        <path d="M 26.7 18 A 9.15 9.15 0 0 0 41.3 18" />
        <path d="M 26.7 87 A 9.15 9.15 0 0 1 41.3 87" />
        <rect x="30.34" y="0" width="7.32" height="1.5" />
        <rect x="30.34" y="103.5" width="7.32" height="1.5" />
      </g>
      <g fill="var(--pitch-line)">
        <circle cx="34" cy="52.5" r="0.5" />
        <circle cx="34" cy="12.5" r="0.4" />
        <circle cx="34" cy="92.5" r="0.4" />
      </g>
    </svg>
  )
}

export function Token({ player, club, captain, selected, warn, rating, small, dim }: { player: Player | undefined; club: Club; captain?: boolean; selected?: boolean; warn?: boolean; rating?: number; small?: boolean; dim?: boolean }) {
  const bg = player?.position === 'GK' ? club.colors.secondary : club.colors.primary
  const ring = player?.position === 'GK' ? club.colors.primary : club.colors.secondary
  const size = small ? 'h-8 w-8 text-xs' : 'h-10 w-10 text-sm sm:h-11 sm:w-11'
  return (
    <div className={clsx('flex flex-col items-center gap-0.5', dim && 'opacity-50')}>
      <div className="relative">
        <div
          className={clsx('grid place-items-center rounded-full font-bold shadow-lg tabular transition-transform', size, selected && 'scale-110')}
          style={{ background: bg, color: contrast(bg), boxShadow: `0 0 0 2px ${ring}, 0 6px 16px rgba(0,0,0,.45)${selected ? ', 0 0 0 5px var(--accent)' : ''}` }}
        >
          {player ? player.number : '?'}
        </div>
        {captain && <span className="absolute -right-1.5 -top-1.5 grid h-4 w-4 place-items-center rounded-full bg-warning text-[9px] font-black text-black">C</span>}
        {warn && <span className="absolute -left-1.5 -top-1.5 h-3 w-3 rounded-full border-2 border-white bg-danger" title="out of position" />}
        {rating !== undefined && <span className="absolute -bottom-1 -right-2 rounded bg-black/75 px-1 text-[9px] font-bold text-white tabular">{rating}</span>}
      </div>
      <div className={clsx('max-w-[78px] truncate rounded bg-black/55 px-1.5 py-px font-semibold text-white', small ? 'text-[9px]' : 'text-[10px] sm:text-[11px]')}>
        {player ? surname(player.shortName) : '—'}
      </div>
    </div>
  )
}

export function LineupPitch({
  lineup, players, club, selectedSlot, onSlotPointerDown, interactive = true, children, mirrored,
}: {
  lineup: Lineup
  players: Player[]
  club: Club
  selectedSlot?: string | null
  onSlotPointerDown?: (e: React.PointerEvent, slotId: string, label: ReactNode) => void
  interactive?: boolean
  children?: ReactNode
  mirrored?: boolean
}) {
  const byId = new Map(players.map((p) => [p.id, p]))
  const slots = FORMATIONS[lineup.formation].slots
  return (
    <div data-drop={interactive ? 'pitch' : undefined} className="relative w-full overflow-hidden rounded-2xl border border-line shadow-inner" style={{ aspectRatio: '68 / 100', touchAction: interactive ? 'none' : 'auto' }}>
      <PitchMarkings />
      {slots.map((slot) => {
        const p = byId.get(lineup.slots[slot.id])
        const pos = lineup.customPos?.[slot.id] ?? { x: slot.x, y: slot.y }
        const top = mirrored ? pos.y : 100 - pos.y
        const left = mirrored ? 100 - pos.x : pos.x
        const fit = p ? positionFit(p, slot.role) : 1
        const token = <Token player={p} club={club} captain={p?.id === lineup.captainId} selected={selectedSlot === slot.id} warn={fit < 0.86} rating={p ? slotRating(p, slot.role) : undefined} />
        return (
          <motion.div
            key={slot.id}
            layout
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            data-drop={interactive ? `slot:${slot.id}` : undefined}
            className={clsx('absolute -translate-x-1/2 -translate-y-1/2', interactive && 'cursor-grab active:cursor-grabbing')}
            style={{ left: `${left}%`, top: `${top}%` }}
            onPointerDown={interactive && onSlotPointerDown ? (e) => onSlotPointerDown(e, slot.id, token) : undefined}
            title={p ? `${p.fullName} · ${slot.role}` : slot.role}
          >
            {token}
            <div className="mt-0.5 text-center text-[9px] font-bold uppercase tracking-wider text-white/70">{slot.role}</div>
          </motion.div>
        )
      })}
      {children}
    </div>
  )
}
