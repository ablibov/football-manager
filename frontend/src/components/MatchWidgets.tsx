import { motion } from 'framer-motion'
import { Ambulance, ArrowLeftRight, Clock, CornerUpRight, Crosshair, Flag, Goal, MonitorPlay, ShieldCheck, Square, Target, Timer, XCircle } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Club, MatchEvent, Side, TeamStats } from '../engine/types'
import { useT } from '../i18n'
import { describe, minuteLabel, STAT_ROWS } from '../lib/matchText'
import { clsx } from '../lib/text'
import { Crest } from './Crest'


export function Scoreboard({ home, away, score, minute, added, status, stadium, halfTime, penalties, aggregate, live }: {
  home: Club; away: Club; score: [number, number]; minute: number; added?: number; status: string; stadium: string
  halfTime?: [number, number] | null; penalties?: [number, number] | null; aggregate?: [number, number] | null; live?: boolean
}) {
  const t = useT()
  const team = (c: Club, align: 'left' | 'right') => (
    <div className={clsx('flex min-w-0 flex-1 flex-col items-center gap-2 sm:flex-row sm:gap-4', align === 'right' && 'sm:flex-row-reverse')}>
      <Crest club={c} size={56} className="shrink-0 drop-shadow-lg" />
      <div className={clsx('min-w-0 text-center', align === 'left' ? 'sm:text-left' : 'sm:text-right')}>
        <div className="truncate font-display text-base font-bold sm:text-2xl">{c.shortName}</div>
        <div className="hidden truncate text-xs text-muted sm:block">{c.name}</div>
      </div>
    </div>
  )
  return (
    <div className="relative overflow-hidden rounded-3xl border border-line bg-elev p-4 sm:p-6 glow">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-50" />
      <div className="pointer-events-none absolute -left-20 top-0 h-full w-1/2 opacity-25 blur-3xl" style={{ background: `radial-gradient(circle at left, ${home.colors.primary}, transparent 70%)` }} />
      <div className="pointer-events-none absolute -right-20 top-0 h-full w-1/2 opacity-25 blur-3xl" style={{ background: `radial-gradient(circle at right, ${away.colors.primary}, transparent 70%)` }} />
      <div className="relative">
        <div className="mb-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-muted">
          <span className={clsx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-semibold uppercase tracking-wider', live ? 'bg-danger/20 text-danger' : 'bg-surface-2')}>
            {live && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-danger" />}
            {status}
          </span>
          <span className="truncate">{stadium}</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-6">
          {team(home, 'left')}
          <div className="flex shrink-0 flex-col items-center">
            <div className="flex items-center gap-2 rounded-2xl border border-line bg-black/40 px-3 py-1.5 sm:gap-3 sm:px-5 sm:py-2">
              <motion.span key={`h${score[0]}`} initial={{ scale: 1.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="scoreboard-digit text-4xl font-bold text-white sm:text-6xl">
                {score[0]}
              </motion.span>
              <span className="text-2xl text-faint sm:text-4xl">:</span>
              <motion.span key={`a${score[1]}`} initial={{ scale: 1.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="scoreboard-digit text-4xl font-bold text-white sm:text-6xl">
                {score[1]}
              </motion.span>
            </div>
            <div className="mt-2 font-mono text-lg font-bold text-accent tabular sm:text-xl">{minuteLabel({ minute, added })}</div>
          </div>
          {team(away, 'right')}
        </div>
        <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted tabular">
          {halfTime && <span>{t('match.halfTimeShort')} {halfTime[0]}–{halfTime[1]}</span>}
          {aggregate && <span>{t('match.aggregate')} {aggregate[0]}–{aggregate[1]}</span>}
          {penalties && <span className="font-semibold text-fg">{t('match.penaltiesShort')} {penalties[0]}–{penalties[1]}</span>}
        </div>
      </div>
    </div>
  )
}

const MAJOR = new Set(['goal', 'penalty_goal', 'own_goal', 'red', 'second_yellow', 'yellow', 'sub', 'penalty_miss', 'var', 'injury'])

export function Timeline({ events, minute, total, homeColor, awayColor }: { events: MatchEvent[]; minute: number; total: number; homeColor: string; awayColor: string }) {
  const marks = events.filter((e) => MAJOR.has(e.type))
  return (
    <div className="relative px-1 pt-5 pb-5">
      <div className="relative h-2 rounded-full bg-line">
        <motion.div className="absolute inset-y-0 left-0 rounded-full bg-accent" animate={{ width: `${Math.min(100, (minute / total) * 100)}%` }} transition={{ duration: 0.25 }} />
        <div className="absolute inset-y-[-4px] w-px bg-faint" style={{ left: `${(45 / total) * 100}%` }} />
        {total > 90 && <div className="absolute inset-y-[-4px] w-px bg-faint" style={{ left: `${(90 / total) * 100}%` }} />}
        {marks.map((e) => {
          const left = `${Math.min(100, ((e.minute + (e.added ?? 0) * 0.15) / total) * 100)}%`
          const isGoal = e.type === 'goal' || e.type === 'penalty_goal' || e.type === 'own_goal'
          const color = e.type === 'yellow' ? '#facc15' : e.type === 'red' || e.type === 'second_yellow' ? '#ef4444' : e.side === 'home' ? homeColor : awayColor
          return (
            <motion.div
              key={e.id}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className={clsx('absolute -translate-x-1/2 rounded-full border border-black/40', isGoal ? 'h-3.5 w-3.5' : 'h-2 w-2', e.side === 'home' ? '-top-4' : 'top-4')}
              style={{ left, background: color }}
              title={`${minuteLabel(e)} ${e.type}`}
            />
          )
        })}
      </div>
      <div className="mt-1 flex justify-between font-mono text-[10px] text-faint">
        <span>0'</span>
        <span>45'</span>
        <span>{total}'</span>
      </div>
    </div>
  )
}

function icon(e: MatchEvent): ReactNode {
  switch (e.type) {
    case 'goal': case 'penalty_goal': case 'own_goal': return <Goal size={16} />
    case 'yellow': return <Square size={14} fill="#facc15" stroke="#a16207" />
    case 'second_yellow': case 'red': return <Square size={14} fill="#ef4444" stroke="#7f1d1d" />
    case 'sub': return <ArrowLeftRight size={16} />
    case 'save': return <ShieldCheck size={16} />
    case 'chance': case 'shot_on': return <Crosshair size={16} />
    case 'shot_off': case 'shot_blocked': return <Target size={16} />
    case 'penalty_miss': return <XCircle size={16} />
    case 'offside': return <Flag size={16} />
    case 'corner': return <CornerUpRight size={16} />
    case 'injury': return <Ambulance size={16} />
    case 'var': return <MonitorPlay size={16} />
    case 'added_time': return <Clock size={16} />
    default: return <Timer size={16} />
  }
}


export function EventFeed({ events, name, club, all, maxHeight = 520 }: { events: MatchEvent[]; name: (id?: string) => string; club: (s?: Side) => string; all: boolean; maxHeight?: number }) {
  const t = useT()
  const visible = [...events].reverse().filter((e) => all || !['foul', 'corner', 'shot_off', 'shot_blocked', 'offside', 'save'].includes(e.type))
  return (
    <div className="space-y-1.5 overflow-y-auto pr-1 scrollbar-thin" style={{ maxHeight }}>
      {visible.map((e) => {
        const isGoal = e.type === 'goal' || e.type === 'penalty_goal' || e.type === 'own_goal'
        const neutral = !e.side || ['half_time', 'full_time', 'kickoff', 'added_time', 'extra_time_start', 'extra_time_end'].includes(e.type)
        return (
          <motion.div
            key={e.id}
            layout="position"
            initial={{ opacity: 0, x: e.side === 'away' ? 16 : -16 }}
            animate={{ opacity: 1, x: 0 }}
            className={clsx(
              'flex items-start gap-3 rounded-xl border px-3 py-2 text-sm',
              isGoal ? 'border-accent/50 bg-accent/10' : neutral ? 'border-line bg-surface-2/60 text-muted' : 'border-line bg-surface',
              !neutral && e.side === 'away' && 'sm:ml-8',
              !neutral && e.side === 'home' && 'sm:mr-8',
            )}
          >
            <span className="w-11 shrink-0 font-mono text-xs font-bold text-muted tabular">{e.type === 'kickoff' ? "0'" : minuteLabel(e)}</span>
            <span className={clsx('mt-0.5 shrink-0', isGoal ? 'text-accent' : 'text-muted')}>{icon(e)}</span>
            <span className={clsx('min-w-0 flex-1', isGoal && 'font-semibold')}>{describe(e, t, name, club)}</span>
            {e.score && isGoal && <span className="shrink-0 font-mono text-xs font-bold tabular">{e.score[0]}–{e.score[1]}</span>}
          </motion.div>
        )
      })}
      {visible.length === 0 && <p className="py-6 text-center text-sm text-faint">{t('match.noEvents')}</p>}
    </div>
  )
}


export function StatsTable({ home, away, homeClub, awayClub }: { home: TeamStats; away: TeamStats; homeClub: Club; awayClub: Club }) {
  const t = useT()
  const ac = awayClub.colors.primary === homeClub.colors.primary ? awayClub.colors.secondary : awayClub.colors.primary
  return (
    <div>
      <div className="mb-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-xs font-semibold text-muted">
        <span className="flex items-center gap-2"><Crest club={homeClub} size={20} /> {homeClub.code}</span>
        <span />
        <span className="flex items-center justify-end gap-2">{awayClub.code} <Crest club={awayClub} size={20} /></span>
      </div>
      <table className="w-full text-sm">
        <caption className="sr-only">{t('match.stats')}</caption>
        <tbody>
          {STAT_ROWS.map((r) => {
            const h = home[r.key]
            const a = away[r.key]
            const tot = h + a || 1
            const f = r.fmt ?? ((v: number) => String(v))
            return (
              <tr key={r.key} className="border-b border-line/60 last:border-0">
                <td className="w-1/4 py-2 font-semibold tabular">{f(h)}</td>
                <td className="py-2">
                  <div className="mb-1 text-center text-xs text-muted">{t(r.label)}</div>
                  <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full">
                    <div className="h-full rounded-l-full" style={{ width: `${(h / tot) * 100}%`, background: homeClub.colors.primary }} />
                    <div className="h-full rounded-r-full" style={{ width: `${(a / tot) * 100}%`, background: ac }} />
                  </div>
                </td>
                <td className="w-1/4 py-2 text-right font-semibold tabular">{f(a)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/** Horizontal action pitch: ball position follows the last meaningful event. */
export function ActionPitch({ last, homeColor, awayColor }: { last: MatchEvent | undefined; homeColor: string; awayColor: string }) {
  let x = 50, y = 50
  const dir = last?.side === 'away' ? -1 : 1
  const atk = (d: number) => 50 + dir * d
  if (last) {
    switch (last.type) {
      case 'goal': case 'penalty_goal': x = atk(48); y = 50; break
      case 'own_goal': x = atk(47); y = 46; break
      case 'save': x = last.side === 'home' ? 6 : 94; y = 50; break // side = keeper's side
      case 'chance': case 'shot_off': case 'shot_blocked': case 'penalty_miss': x = atk(36); y = 40 + (last.id % 5) * 5; break
      case 'corner': x = atk(49); y = last.id % 2 ? 2 : 98; break
      case 'offside': x = atk(30); y = 30 + (last.id % 7) * 6; break
      case 'foul': case 'yellow': case 'red': case 'second_yellow': x = 50 - dir * 15; y = 25 + (last.id % 9) * 6; break
      default: x = 50; y = 50
    }
  }
  return (
    <div className="relative overflow-hidden rounded-2xl border border-line" style={{ aspectRatio: '105 / 52' }}>
      <svg viewBox="0 0 105 68" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <rect width="105" height="68" fill="var(--pitch-1)" />
        {Array.from({ length: 7 }, (_, i) => <rect key={i} x={i * 15} width="7.5" height="68" fill="var(--pitch-2)" />)}
        <g fill="none" stroke="var(--pitch-line)" strokeWidth="0.4">
          <rect x="1" y="1" width="103" height="66" />
          <line x1="52.5" y1="1" x2="52.5" y2="67" />
          <circle cx="52.5" cy="34" r="9.15" />
          <rect x="1" y="13.84" width="16.5" height="40.32" />
          <rect x="87.5" y="13.84" width="16.5" height="40.32" />
          <rect x="1" y="24.84" width="5.5" height="18.32" />
          <rect x="98.5" y="24.84" width="5.5" height="18.32" />
        </g>
        <rect x="0" y="30" width="1" height="8" fill={homeColor} />
        <rect x="104" y="30" width="1" height="8" fill={awayColor} />
      </svg>
      <motion.div className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-black/50 bg-white shadow-[0_0_12px_rgba(255,255,255,.9)]" animate={{ left: `${x}%`, top: `${y}%` }} transition={{ type: 'spring', stiffness: 120, damping: 16 }} />
    </div>
  )
}
