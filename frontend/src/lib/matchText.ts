import type { MatchEvent, Side, TeamStats } from '../engine/types'
import type { T } from '../i18n'

export function minuteLabel(e: { minute: number; added?: number }) {
  return e.added ? `${e.minute}+${e.added}'` : `${e.minute}'`
}

export function describe(e: MatchEvent, t: T, name: (id?: string) => string, club: (s?: Side) => string): string {
  const p = name(e.playerId)
  const q = name(e.secondaryPlayerId)
  const c = club(e.side)
  switch (e.type) {
    case 'kickoff': return t('ev.kickoff')
    case 'goal': return e.secondaryPlayerId ? t('ev.goalAssist', { player: p, club: c, assist: q }) : t('ev.goal', { player: p, club: c })
    case 'penalty_goal': return t('ev.penaltyGoal', { player: p, club: c })
    case 'own_goal': return t('ev.ownGoal', { player: p, club: c })
    case 'penalty_miss': return e.detail === 'saved' ? t('ev.penaltySaved', { player: p, keeper: q }) : t('ev.penaltyMissed', { player: p })
    case 'chance': return e.detail === 'penalty_awarded' ? t('ev.penaltyAwarded', { club: c, player: q }) : t('ev.bigChance', { player: p, xg: (e.xg ?? 0).toFixed(2) })
    case 'shot_off': return t('ev.shotOff', { player: p })
    case 'shot_blocked': return t('ev.shotBlocked', { player: p })
    case 'save': return t('ev.save', { keeper: p, player: q })
    case 'yellow': return t('ev.yellow', { player: p, club: c })
    case 'second_yellow': return t('ev.secondYellow', { player: p, club: c })
    case 'red': return t('ev.red', { player: p, club: c })
    case 'sub': return t('ev.sub', { on: p, off: q, club: c })
    case 'injury': return t('ev.injury', { player: p, club: c })
    case 'offside': return t('ev.offside', { player: p })
    case 'corner': return t('ev.corner', { club: c })
    case 'foul': return e.detail === 'box' ? t('ev.foulBox', { player: p, victim: q }) : t('ev.foul', { player: p, victim: q })
    case 'var': return e.detail === 'goal_stands' ? t('ev.varStands', { player: p }) : t('ev.varDisallowed', { player: p, reason: t(`ev.var.${e.detail}`) })
    case 'half_time': return t('ev.halfTime', { score: e.score?.join('–') ?? '' })
    case 'full_time': return t('ev.fullTime', { score: e.score?.join('–') ?? '' })
    case 'added_time': return t('ev.addedTime', { n: e.detail ?? '0' })
    case 'extra_time_start': return t('ev.extraTime')
    case 'extra_time_end': return t('ev.extraTimeEnd', { score: e.score?.join('–') ?? '' })
    case 'shootout_kick': return t(e.detail === 'scored' ? 'ev.soScored' : 'ev.soMissed', { player: p, score: e.score?.join('–') ?? '' })
    case 'shootout_end': return t('ev.soEnd', { club: c, score: e.score?.join('–') ?? '' })
    default: return e.type
  }
}

export const STAT_ROWS: { key: keyof TeamStats; label: string; fmt?: (v: number) => string }[] = [
  { key: 'possession', label: 'stats.possession', fmt: (v) => `${v}%` },
  { key: 'shots', label: 'stats.shots' },
  { key: 'shotsOnTarget', label: 'stats.shotsOnTarget' },
  { key: 'xg', label: 'stats.xg', fmt: (v) => v.toFixed(2) },
  { key: 'passes', label: 'stats.passes' },
  { key: 'passAccuracy', label: 'stats.passAccuracy', fmt: (v) => `${v}%` },
  { key: 'corners', label: 'stats.corners' },
  { key: 'fouls', label: 'stats.fouls' },
  { key: 'yellow', label: 'stats.yellow' },
  { key: 'red', label: 'stats.red' },
  { key: 'saves', label: 'stats.saves' },
  { key: 'offsides', label: 'stats.offsides' },
]
