import { FastForward, ListFilter, MonitorPlay, Pause, Play, RefreshCw, Repeat, SkipForward, Trophy, Zap } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Crest } from '../components/Crest'
import { ActionPitch, EventFeed, Scoreboard, StatsTable, Timeline } from '../components/MatchWidgets'
import { Badge, Bar, Button, Card, Empty, PageHeader, Segmented, Select, Toggle } from '../components/ui'
import type { CupData, LeagueData, PendingMatch, SavedMatch, SaveRecord } from '../data/types'
import { MatchSimulation, type LiveSnapshot, type Phase } from '../engine/match'
import { randomSeed } from '../engine/rng'
import type { Club, MatchResult, Side, Tactics } from '../engine/types'
import { useT, type T } from '../i18n'
import { applyCupResult, applyLeagueResult, findCupMatch } from '../lib/competitions'
import { compact, toSavedMatch } from '../lib/football'
import { navigate } from '../lib/router'
import { clsx } from '../lib/text'
import { useStore } from '../store/context'

const SPEEDS = [1, 2, 4, 8, 16]
const msFor = (speed: number) => Math.round(1000 / speed)

function phaseLabel(t: T, phase: Phase, finished: boolean, penalties: boolean) {
  if (finished) return penalties ? t('match.status.afterPens') : t('match.status.ft')
  return t(`match.status.${phase}`)
}

export function MatchCenter({ matchId }: { matchId?: string }) {
  const t = useT()
  const store = useStore()
  if (matchId) {
    const m = store.matches.find((x) => x.id === matchId)
    return m ? <SavedMatchView match={m} /> : <Empty icon={<MonitorPlay size={36} />} title={t('match.notFound')} action={<Button onClick={() => navigate({ page: 'quick' })}>{t('nav.quick')}</Button>} />
  }
  if (!store.pending) {
    const last = store.matches[0]
    return (
      <div>
        <PageHeader icon={<MonitorPlay size={22} />} title={t('nav.match')} subtitle={t('match.subtitle')} />
        <Empty
          icon={<MonitorPlay size={40} />}
          title={t('match.noneTitle')}
          text={t('match.noneText')}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="primary" onClick={() => navigate({ page: 'quick' })}><Zap size={16} /> {t('nav.quick')}</Button>
              {last && <Button onClick={() => navigate({ page: 'match', matchId: last.id })}>{t('match.lastMatch')}</Button>}
            </div>
          }
        />
      </div>
    )
  }
  const p = store.pending
  return <LiveMatch key={`${p.config.seed}:${p.config.home.club.id}:${p.config.away.club.id}:${JSON.stringify(p.context)}`} pending={p} />
}

function useNames(home: Club, away: Club) {
  const { players } = useStore()
  const t = useT()
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players])
  const name = useCallback((id?: string) => (id ? byId.get(id)?.fullName ?? t('common.unknownPlayer') : ''), [byId, t])
  const club = useCallback((s?: Side) => (s === 'home' ? home.shortName : s === 'away' ? away.shortName : ''), [home, away])
  return { name, club }
}

function LiveMatch({ pending }: { pending: PendingMatch }) {
  const t = useT()
  const store = useStore()
  const { config } = pending
  const home = config.home.club
  const away = config.away.club
  const [sim] = useState(() => new MatchSimulation(config))
  const [snap, setSnap] = useState<LiveSnapshot>(() => {
    if (pending.mode === 'instant') sim.runToEnd()
    return sim.snapshot()
  })
  const [playing, setPlaying] = useState(pending.mode === 'live')
  const [speed, setSpeed] = useState(store.settings.defaultSpeed)
  const [allEvents, setAllEvents] = useState(false)
  const [tab, setTab] = useState<'events' | 'stats' | 'lineups'>('events')
  const [savedId, setSavedId] = useState<string | null>(null)
  const finished = snap.phase === 'finished'
  const handled = useRef(false)
  const { name, club } = useNames(home, away)

  // the clock
  useEffect(() => {
    if (!playing || finished) return
    const id = window.setInterval(() => {
      sim.step()
      const s = sim.snapshot()
      setSnap(s)
      if (s.phase === 'half_time' && pending.userSides.length) setPlaying(false)
    }, msFor(speed))
    return () => window.clearInterval(id)
  }, [playing, speed, finished, sim, pending.userSides.length])

  const persist = async (result: MatchResult) => {
    const ctx = pending.context
    const mode = pending.mode
    if (ctx.kind === 'quick') {
      const saved = await store.recordMatch(toSavedMatch(result, config, mode, pending.stadiumName))
      setSavedId(saved.id)
      store.toast('ok', 'match.saved')
    } else if (ctx.kind === 'league') {
      const save = store.saves.find((s) => s.id === ctx.saveId) as SaveRecord<LeagueData> | undefined
      if (!save) return store.toast('error', 'match.saveMissing')
      await store.putSave(applyLeagueResult(save, ctx.fixtureId, compact(result, mode)))
      store.toast('ok', 'match.savedLeague')
    } else {
      const save = store.saves.find((s) => s.id === ctx.saveId) as SaveRecord<CupData> | undefined
      const m = save && findCupMatch(save.data, ctx.tieId, ctx.leg)
      if (!save || !m) return store.toast('error', 'match.saveMissing')
      await store.putSave(applyCupResult(save, m, result, mode))
      store.toast('ok', 'match.savedCup')
    }
  }
  // persist the result exactly once
  useEffect(() => {
    if (!finished || handled.current) return
    handled.current = true
    const result = sim.result()
    void persist(result)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished])



  const skipToEnd = () => {
    sim.runToEnd()
    setSnap(sim.snapshot())
    setPlaying(false)
  }

  const replay = (newSeed: boolean) => {
    store.startMatch({ ...pending, config: { ...config, seed: newSeed ? randomSeed() : config.seed } })
  }

  const result = finished ? sim.result() : null
  const total = snap.minute > 90 || snap.phase.startsWith('et') ? 120 : 90
  const lastVisual = [...snap.events].reverse().find((e) => !['added_time', 'sub', 'injury'].includes(e.type))
  const aggregate = config.aggregate ? ([snap.score[0] + config.aggregate.awayGoals, snap.score[1] + config.aggregate.homeGoals] as [number, number]) : null
  const ac = away.colors.primary === home.colors.primary ? away.colors.secondary : away.colors.primary

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted">
          <MonitorPlay size={18} className="text-accent" />
          <span className="font-semibold text-fg">{t('nav.match')}</span>
          <Badge tone="info">{t(`mode.${pending.mode}`)}</Badge>
          {pending.context.kind !== 'quick' && <Badge tone="accent">{t(`nav.${pending.context.kind}`)}</Badge>}
        </div>
        {finished && (
          <div className="flex flex-wrap gap-2">
            {pending.context.kind === 'quick' ? (
              <>
                <Button onClick={() => replay(false)} title={t('match.replaySameHint')}><Repeat size={16} /> {t('match.replaySame')}</Button>
                <Button onClick={() => replay(true)}><RefreshCw size={16} /> {t('match.rematch')}</Button>
                <Button variant="primary" onClick={() => { store.clearPending(); navigate({ page: 'quick' }) }}>{t('match.newMatch')}</Button>
              </>
            ) : (
              <Button variant="primary" onClick={() => { store.clearPending(); navigate({ page: pending.context.kind as 'league' | 'cup' }) }}>
                <Trophy size={16} /> {t('match.backTo', { what: t(`nav.${pending.context.kind}`) })}
              </Button>
            )}
          </div>
        )}
      </div>

      <Scoreboard
        home={home}
        away={away}
        score={snap.score}
        minute={snap.phase === 'pre' ? 0 : snap.minute}
        added={snap.added}
        status={phaseLabel(t, snap.phase, finished, !!snap.penalties)}
        stadium={pending.stadiumName}
        halfTime={snap.minute > 45 || finished ? result?.halfTime ?? null : null}
        penalties={snap.penalties}
        aggregate={aggregate}
        live={!finished && snap.phase !== 'pre'}
      />

      <Card className="mt-4">
        <div className="flex flex-wrap items-center gap-3">
          {!finished ? (
            <>
              <Button variant="primary" onClick={() => setPlaying((p) => !p)} aria-label={playing ? t('match.pause') : t('match.play')}>
                {playing ? <Pause size={16} /> : <Play size={16} />} {playing ? t('match.pause') : snap.phase === 'pre' ? t('match.kickoff') : t('match.resume')}
              </Button>
              <Button onClick={() => { sim.step(); setSnap(sim.snapshot()) }} disabled={playing} title={t('match.step')}>
                <SkipForward size={16} />
              </Button>
              <Segmented size="sm" value={speed} onChange={setSpeed} options={SPEEDS.map((s) => ({ value: s, label: `${s}×` }))} />
              <Button onClick={skipToEnd} className="ml-auto"><FastForward size={16} /> {t('match.toEnd')}</Button>
            </>
          ) : (
            <div className="flex w-full flex-wrap items-center justify-between gap-2 text-sm">
              <span className="text-muted">{result?.winner ? t('match.winner', { club: result.winner === 'home' ? home.shortName : away.shortName }) : t('match.drawResult')}</span>
              {savedId && <a className="text-accent hover:underline" href={`#/match/${savedId}`}>{t('match.permalink')}</a>}
            </div>
          )}
        </div>
        <Timeline events={snap.events} minute={snap.phase === 'finished' ? total : snap.minute} total={total} homeColor={home.colors.primary} awayColor={ac} />
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)]">
        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Segmented value={tab} onChange={setTab} options={[{ value: 'events', label: t('match.events') }, { value: 'stats', label: t('match.stats') }, { value: 'lineups', label: t('match.lineups') }]} />
            {tab === 'events' && (
              <Button size="sm" variant="ghost" onClick={() => setAllEvents((a) => !a)}>
                <ListFilter size={15} /> {allEvents ? t('match.keyEvents') : t('match.allEvents')}
              </Button>
            )}
          </div>
          {tab === 'events' && <EventFeed events={snap.events} name={name} club={club} all={allEvents} />}
          {tab === 'stats' && <Card><StatsTable home={snap.stats.home} away={snap.stats.away} homeClub={home} awayClub={away} /></Card>}
          {tab === 'lineups' && (
            <div className="grid gap-4 sm:grid-cols-2">
              {(['home', 'away'] as Side[]).map((s) => (
                <OnPitchList key={s} club={s === 'home' ? home : away} rows={snap.onPitch[s]} />
              ))}
            </div>
          )}
        </div>
        <div className="space-y-4">
          <ActionPitch last={lastVisual} homeColor={home.colors.primary} awayColor={ac} />
          <Card>
            <div className="mb-2 flex justify-between text-xs text-muted">
              <span>{t('stats.possession')}</span>
              <span className="tabular">{snap.stats.home.possession}% – {snap.stats.away.possession}%</span>
            </div>
            <div className="flex h-2 overflow-hidden rounded-full">
              <div style={{ width: `${snap.stats.home.possession}%`, background: home.colors.primary }} />
              <div style={{ width: `${snap.stats.away.possession}%`, background: ac }} />
            </div>
            <div className="mt-3 grid grid-cols-3 text-center text-xs text-muted">
              <div><div className="font-display text-lg font-bold text-fg tabular">{snap.stats.home.shots}–{snap.stats.away.shots}</div>{t('stats.shots')}</div>
              <div><div className="font-display text-lg font-bold text-fg tabular">{snap.stats.home.xg.toFixed(1)}–{snap.stats.away.xg.toFixed(1)}</div>xG</div>
              <div><div className="font-display text-lg font-bold text-fg tabular">{snap.stats.home.corners}–{snap.stats.away.corners}</div>{t('stats.corners')}</div>
            </div>
          </Card>
          {!finished && pending.userSides.map((s) => <Controls key={s} side={s} club={s === 'home' ? home : away} sim={sim} snap={snap} onChange={() => setSnap(sim.snapshot())} initialTactics={config[s].lineup.tactics} />)}
        </div>
      </div>
    </div>
  )
}

function OnPitchList({ club, rows }: { club: Club; rows: LiveSnapshot['onPitch']['home'] }) {
  const t = useT()
  return (
    <Card>
      <div className="mb-3 flex items-center gap-2 font-semibold">
        <Crest club={club} size={24} /> {club.shortName}
        <span className="ml-auto text-xs font-normal text-muted">{t('match.onPitch', { n: rows.length })}</span>
      </div>
      <div className="space-y-1.5">
        {rows.map((r) => (
          <div key={r.player.id} className="grid grid-cols-[28px_minmax(0,1fr)_40px_64px] items-center gap-2 text-sm">
            <span className="font-bold tabular text-muted">{r.player.number}</span>
            <span className="flex min-w-0 items-center gap-1.5 truncate">
              <span className="truncate">{r.player.fullName}</span>
              {r.yellow > 0 && <span className="h-3 w-2 shrink-0 rounded-[2px] bg-yellow-400" />}
            </span>
            <span className="text-xs text-muted">{r.role}</span>
            <Bar value={r.stamina} className={clsx(r.stamina < 55 && '[&>div]:bg-warning')} />
          </div>
        ))}
      </div>
    </Card>
  )
}

function Controls({ side, club, sim, snap, onChange, initialTactics }: { side: Side; club: Club; sim: MatchSimulation; snap: LiveSnapshot; onChange: () => void; initialTactics: Tactics }) {
  const t = useT()
  const store = useStore()
  const [outId, setOutId] = useState('')
  const [inId, setInId] = useState('')
  const [tactics, setTactics] = useState<Tactics>(initialTactics)
  const [auto, setAuto] = useState(false)
  const onPitch = snap.onPitch[side]
  const bench = snap.bench[side]
  const sub = () => {
    const err = sim.substitute(side, outId, inId)
    if (err) store.toast('error', `sub.${err}`)
    else {
      setOutId('')
      setInId('')
      onChange()
    }
  }
  const setT = (k: keyof Tactics, v: string) => {
    const next = { ...tactics, [k]: v } as Tactics
    setTactics(next)
    sim.setTactics(side, next)
  }
  return (
    <Card className="border-accent/30">
      <div className="mb-3 flex items-center gap-2 font-semibold">
        <Crest club={club} size={22} /> {t('match.yourTeam', { club: club.shortName })}
        <Badge tone="accent" className="ml-auto">{t('match.subsLeft', { n: snap.subsLeft[side] })}</Badge>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Select label={t('match.subOff')} value={outId} onChange={(e) => setOutId(e.target.value)}>
          <option value="">—</option>
          {onPitch.map((r) => <option key={r.player.id} value={r.player.id}>{r.player.number}. {r.player.shortName} ({r.stamina}%)</option>)}
        </Select>
        <Select label={t('match.subOn')} value={inId} onChange={(e) => setInId(e.target.value)}>
          <option value="">—</option>
          {bench.map((p) => <option key={p.id} value={p.id}>{p.number}. {p.shortName} · {p.position}</option>)}
        </Select>
      </div>
      <Button className="mt-2 w-full" onClick={sub} disabled={!outId || !inId || snap.subsLeft[side] === 0}>{t('match.makeSub')}</Button>
      <div className="mt-4 space-y-2 text-sm">
        {(['mentality', 'pressing', 'tempo'] as const).map((k) => (
          <div key={k} className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-muted">{t(`tactics.${k}`)}</span>
            <Segmented size="sm" value={tactics[k] as string} onChange={(v) => setT(k, v)} options={(k === 'mentality' ? ['defensive', 'balanced', 'attacking'] : k === 'pressing' ? ['low', 'medium', 'high'] : ['slow', 'normal', 'fast']).map((v) => ({ value: v, label: t(`tactics.${k}.${v}`) }))} />
          </div>
        ))}
      </div>
      <div className="mt-4">
        <Toggle checked={auto} onChange={(v) => { setAuto(v); sim.setAuto(side, v) }} label={t('match.autoSubs')} />
      </div>
    </Card>
  )
}

function SavedMatchView({ match }: { match: SavedMatch }) {
  const t = useT()
  const store = useStore()
  const home = store.club(match.homeId)
  const away = store.club(match.awayId)
  const [all, setAll] = useState(false)
  const names = useNames(home ?? store.clubs[0], away ?? store.clubs[1])
  if (!home || !away) return <Empty title={t('match.notFound')} />
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm text-muted">
          <MonitorPlay size={18} className="text-accent" />
          <span className="font-semibold text-fg">{t('match.report')}</span>
          <Badge tone="info">{t(`mode.${match.mode}`)}</Badge>
          <span>{new Date(match.createdAt).toLocaleString()}</span>
        </div>
        <div className="flex gap-2">
          <Button variant="danger" size="sm" onClick={async () => { if (window.confirm(t('common.confirmDelete'))) { await store.deleteMatch(match.id); navigate({ page: 'stats' }) } }}>{t('common.delete')}</Button>
        </div>
      </div>
      <Scoreboard home={home} away={away} score={match.score} minute={match.extraTime ? 120 : 90} status={match.penalties ? t('match.status.afterPens') : t('match.status.ft')} stadium={match.stadiumName} halfTime={match.halfTime} penalties={match.penalties} />
      {match.mode === 'manual' ? (
        <Card className="mt-4 text-sm text-muted">{t('match.manualNote')}</Card>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
          <div>
            <div className="mb-3 flex justify-end">
              <Button size="sm" variant="ghost" onClick={() => setAll((a) => !a)}><ListFilter size={15} /> {all ? t('match.keyEvents') : t('match.allEvents')}</Button>
            </div>
            <EventFeed events={match.events} name={names.name} club={names.club} all={all} maxHeight={700} />
          </div>
          {match.stats && <Card><StatsTable home={match.stats.home} away={match.stats.away} homeClub={home} awayClub={away} /></Card>}
        </div>
      )}
    </div>
  )
}
