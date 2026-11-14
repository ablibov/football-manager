import { ChevronLeft, ChevronRight, FastForward, Info, Play, Plus, Trash2, Trophy, Zap } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Crest, FormDots } from '../components/Crest'
import { Badge, Button, Card, Empty, Input, PageHeader, Segmented, Select } from '../components/ui'
import type { LeagueData, SaveRecord } from '../data/types'
import { simulateMatch } from '../engine/match'
import { randomSeed } from '../engine/rng'
import type { StandingRow } from '../engine/standings'
import { useT, type T } from '../i18n'
import { applyLeagueResult, currentRound, leagueConfig, leagueStandings, newLeague, totalRounds, type DataCtx } from '../lib/competitions'
import { compact, playerTotals, realStandings } from '../lib/football'
import { navigate } from '../lib/router'
import { clsx } from '../lib/text'
import { useStore } from '../store/context'
import { Leaders } from './Statistics'

export function League() {
  const t = useT()
  const store = useStore()
  const leagues = store.saves.filter((s): s is SaveRecord<LeagueData> => s.kind === 'league')
  const [selected, setSelected] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const save = leagues.find((s) => s.id === selected) ?? leagues[0]

  return (
    <div>
      <PageHeader
        icon={<Trophy size={22} />}
        title={t('nav.league')}
        subtitle={t('league.subtitle')}
        action={
          <>
            {leagues.length > 0 && (
              <Select value={save?.id ?? ''} onChange={(e) => setSelected(e.target.value)} aria-label={t('league.saves')}>
                {leagues.map((s) => <option key={s.id} value={s.id}>{s.name}{s.localOnly ? ` (${t('common.localOnly')})` : ''}</option>)}
              </Select>
            )}
            <Button variant="primary" onClick={() => setCreating(true)}><Plus size={16} /> {t('league.new')}</Button>
          </>
        }
      />
      {(creating || !save) ? (
        <CreateLeague onCreated={(id) => { setSelected(id); setCreating(false) }} onCancel={leagues.length ? () => setCreating(false) : undefined} />
      ) : (
        <LeagueView key={save.id} save={save} />
      )}
    </div>
  )
}

function RuleSummary({ t }: { t: T }) {
  const { dataset } = useStore()
  const rule = dataset.competitionRules.find((r) => r.competition === 'apl')
  const source = dataset.dataSources.find((s) => s.id === rule?.sourceId)
  if (!rule) return null
  return (
    <div className="rounded-xl border border-line bg-surface-2 p-4 text-sm">
      <div className="mb-2 flex flex-wrap items-center gap-2 font-semibold">
        {rule.name}
        <Badge tone={rule.verified ? 'accent' : 'warning'}>{rule.verified ? t('rule.sourced') : t('rule.unverified')}</Badge>
      </div>
      <ul className="space-y-1 text-muted">
        <li>{t('rule.format', { teams: dataset.clubs.length, cycles: rule.roundRobinCycles ?? 2, rounds: (dataset.clubs.length - 1) * (rule.roundRobinCycles ?? 2) })}</li>
        <li>{t('rule.points', { w: rule.pointsWin ?? 3, d: rule.pointsDraw ?? 1, l: rule.pointsLoss ?? 0 })}</li>
        <li>{t('rule.tiebreakers')}: {(rule.tiebreakers ?? []).map((x) => t(`tb.${x}`)).join(' → ')}</li>
      </ul>
      <p className="mt-2 text-xs text-faint">{rule.notes} {source && <>— <a className="text-accent hover:underline" href={source.url ?? '#'} target="_blank" rel="noreferrer">{source.name}</a></>}</p>
    </div>
  )
}

function CreateLeague({ onCreated, onCancel }: { onCreated: (id: string) => void; onCancel?: () => void }) {
  const t = useT()
  const store = useStore()
  const [name, setName] = useState(() => `${t('nav.league')} ${store.dataset.season.name}`)
  const [seed, setSeed] = useState('')
  const [busy, setBusy] = useState(false)
  const create = async () => {
    setBusy(true)
    const s = await store.putSave(newLeague(store.dataset, name.trim() || 'League', seed.trim() || randomSeed()))
    setBusy(false)
    onCreated(s.id)
  }
  return (
    <Card className="max-w-2xl">
      <div className="mb-4 font-display text-lg font-semibold">{t('league.createTitle')}</div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label={t('common.name')} value={name} onChange={(e) => setName(e.target.value)} />
        <Select label={t('league.season')} value={store.dataset.season.id} onChange={() => undefined}>
          <option value={store.dataset.season.id}>{store.dataset.season.name}</option>
        </Select>
        <Input label={t('quick.seed')} placeholder={t('quick.seedPlaceholder')} value={seed} onChange={(e) => setSeed(e.target.value)} className="sm:col-span-2" />
      </div>
      <div className="mt-4"><RuleSummary t={t} /></div>
      <p className="mt-3 text-xs text-faint">{t('league.separateNote')}</p>
      <div className="mt-5 flex justify-end gap-2">
        {onCancel && <Button onClick={onCancel}>{t('common.cancel')}</Button>}
        <Button variant="primary" onClick={create} disabled={busy}><Plus size={16} /> {t('league.create')}</Button>
      </div>
    </Card>
  )
}

const ZONES: Record<number, string> = { 1: 'zone.ucl', 2: 'zone.uecl', 3: 'zone.uecl', 11: 'zone.playoff', 12: 'zone.relegation' }

export function StandingsTable({ rows, compactView, zones = true }: { rows: StandingRow[]; compactView?: boolean; zones?: boolean }) {
  const t = useT()
  const store = useStore()
  const n = rows.length
  const zoneOf = (pos: number) => (zones && n === 12 ? ZONES[pos] : undefined)
  return (
    <div className="overflow-x-auto scrollbar-thin">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-faint">
            <th className="w-8 py-2 pr-2 text-center">#</th>
            <th className="py-2 pr-2">{t('table.club')}</th>
            <th className="py-2 px-1 text-center" title={t('table.played.long')}>{t('table.played')}</th>
            {!compactView && <>
              <th className="py-2 px-1 text-center" title={t('table.won.long')}>{t('table.won')}</th>
              <th className="py-2 px-1 text-center" title={t('table.drawn.long')}>{t('table.drawn')}</th>
              <th className="py-2 px-1 text-center" title={t('table.lost.long')}>{t('table.lost')}</th>
              <th className="py-2 px-1 text-center" title={t('table.gf.long')}>{t('table.gf')}</th>
              <th className="py-2 px-1 text-center" title={t('table.ga.long')}>{t('table.ga')}</th>
            </>}
            <th className="py-2 px-1 text-center" title={t('table.gd.long')}>{t('table.gd')}</th>
            <th className="py-2 px-1 text-center" title={t('table.pts.long')}>{t('table.pts')}</th>
            {!compactView && <th className="hidden py-2 pl-2 sm:table-cell">{t('table.form')}</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const c = store.club(r.clubId)
            const z = zoneOf(r.position)
            return (
              <tr key={r.clubId} className="border-b border-line/50 last:border-0">
                <td className="py-2 pr-2 text-center">
                  <span className={clsx('inline-grid h-6 w-6 place-items-center rounded-md text-xs font-bold tabular', z === 'zone.ucl' && 'bg-accent text-accent-ink', z === 'zone.uecl' && 'bg-info/25 text-info', z === 'zone.playoff' && 'bg-warning/25 text-warning', z === 'zone.relegation' && 'bg-danger/25 text-danger')} title={z ? t(z) : undefined}>
                    {r.position}
                  </span>
                </td>
                <td className="py-2 pr-2">
                  <a href={`#/clubs/${r.clubId}`} className="flex min-w-0 items-center gap-2 hover:text-accent">
                    <Crest club={c} size={22} />
                    <span className="truncate font-medium">{compactView ? c?.shortName : c?.name}</span>
                  </a>
                </td>
                <td className="px-1 py-2 text-center tabular">{r.played}</td>
                {!compactView && <>
                  <td className="px-1 py-2 text-center tabular">{r.won}</td>
                  <td className="px-1 py-2 text-center tabular">{r.drawn}</td>
                  <td className="px-1 py-2 text-center tabular">{r.lost}</td>
                  <td className="px-1 py-2 text-center tabular">{r.goalsFor}</td>
                  <td className="px-1 py-2 text-center tabular">{r.goalsAgainst}</td>
                </>}
                <td className="px-1 py-2 text-center tabular">{r.goalDiff > 0 ? `+${r.goalDiff}` : r.goalDiff}</td>
                <td className="px-1 py-2 text-center font-bold tabular">{r.points}</td>
                {!compactView && <td className="hidden py-2 pl-2 sm:table-cell"><FormDots form={r.form} size="sm" /></td>}
              </tr>
            )
          })}
        </tbody>
      </table>
      {zones && n === 12 && !compactView && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-accent" /> {t('zone.ucl')}</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-info/60" /> {t('zone.uecl')}</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-warning/60" /> {t('zone.playoff')}</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-danger/60" /> {t('zone.relegation')}</span>
        </div>
      )}
    </div>
  )
}

function LeagueView({ save }: { save: SaveRecord<LeagueData> }) {
  const t = useT()
  const store = useStore()
  const d = save.data
  const cur = currentRound(d)
  const last = totalRounds(d)
  const [round, setRound] = useState(cur ?? last)
  const [tab, setTab] = useState<'table' | 'fixtures' | 'players' | 'real'>('table')
  const [busy, setBusy] = useState(false)
  const rows = useMemo(() => leagueStandings(d), [d])
  const played = Object.keys(d.results).length
  const ctx: DataCtx = { club: store.club, clubPlayers: store.clubPlayers, lineupFor: store.lineupFor }
  const fixtures = d.fixtures.filter((f) => f.round === round)
  const results = Object.entries(d.results).map(([id, r]) => {
    const f = d.fixtures.find((x) => x.id === id)!
    return { homeId: f.homeId, awayId: f.awayId, players: r.players, homeGoals: r.homeGoals, awayGoals: r.awayGoals }
  })
  const totals = useMemo(() => playerTotals(results, store.players), [results, store.players])

  const simulateRounds = async (upTo: number) => {
    setBusy(true)
    await new Promise((r) => setTimeout(r, 20))
    let next = save
    for (const f of d.fixtures) {
      if (f.round > upTo || next.data.results[f.id]) continue
      const res = simulateMatch(leagueConfig(ctx, next.data, f))
      next = applyLeagueResult(next, f.id, compact(res, 'instant'))
    }
    await store.putSave(next)
    setBusy(false)
    const nr = currentRound(next.data)
    setRound(nr ?? last)
  }

  const watch = (fixtureId: string) => {
    const f = d.fixtures.find((x) => x.id === fixtureId)!
    const home = store.club(f.homeId)!
    store.startMatch({ config: leagueConfig(ctx, d, f, { home: true, away: true }), mode: 'live', stadiumName: home.stadium.name ?? '', context: { kind: 'league', saveId: save.id, fixtureId }, userSides: [] })
    navigate({ page: 'match' })
  }

  const remove = async () => {
    if (window.confirm(t('common.confirmDelete'))) await store.deleteSave(save.id)
  }

  const champion = cur === null ? store.club(rows[0]?.clubId) : null

  return (
    <div className="space-y-5">
      <Card className="flex flex-wrap items-center gap-4">
        <div className="min-w-0 flex-1">
          <div className="font-display text-lg font-semibold">{save.name}</div>
          <div className="text-sm text-muted">{t('league.progress', { played, total: d.fixtures.length, round: cur ?? last, rounds: last })}</div>
          <div className="mt-2 h-1.5 w-full max-w-md overflow-hidden rounded-full bg-line"><div className="h-full bg-accent" style={{ width: `${(played / d.fixtures.length) * 100}%` }} /></div>
        </div>
        {champion ? (
          <div className="flex items-center gap-3 rounded-2xl border border-accent/40 bg-accent/10 px-4 py-2">
            <Trophy className="text-accent" size={22} /><Crest club={champion} size={30} />
            <div><div className="text-xs text-muted">{t('league.champion')}</div><div className="font-semibold">{champion.name}</div></div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => simulateRounds(cur!)} disabled={busy}><Zap size={16} /> {t('league.simRound', { n: cur! })}</Button>
            <Button onClick={() => simulateRounds(last)} disabled={busy}><FastForward size={16} /> {t('league.simAll')}</Button>
          </div>
        )}
        <Button variant="ghost" onClick={remove} aria-label={t('common.delete')}><Trash2 size={16} /></Button>
      </Card>

      <Segmented value={tab} onChange={setTab} options={[{ value: 'table', label: t('league.table') }, { value: 'fixtures', label: t('league.fixtures') }, { value: 'players', label: t('league.players') }, { value: 'real', label: t('league.realTable') }]} />

      {tab === 'table' && (
        <Card>
          <StandingsTable rows={rows} />
          <p className="mt-3 flex items-start gap-1.5 text-[11px] text-faint"><Info size={13} className="mt-px shrink-0" /> {t('league.tiebreakNote', { list: d.tiebreakers.map((x) => t(`tb.${x}`)).join(' → ') })}</p>
        </Card>
      )}

      {tab === 'fixtures' && (
        <Card>
          <div className="mb-4 flex items-center justify-between gap-2">
            <Button size="sm" onClick={() => setRound((r) => Math.max(1, r - 1))} disabled={round <= 1} aria-label={t('common.prev')}><ChevronLeft size={16} /></Button>
            <Select value={round} onChange={(e) => setRound(Number(e.target.value))} aria-label={t('league.round')} className="w-40">
              {Array.from({ length: last }, (_, i) => i + 1).map((r) => <option key={r} value={r}>{t('league.roundN', { n: r })}</option>)}
            </Select>
            <Button size="sm" onClick={() => setRound((r) => Math.min(last, r + 1))} disabled={round >= last} aria-label={t('common.next')}><ChevronRight size={16} /></Button>
          </div>
          <div className="space-y-2">
            {fixtures.map((f) => {
              const r = d.results[f.id]
              const h = store.club(f.homeId)
              const a = store.club(f.awayId)
              const scorers = r?.events.filter((e) => e.type === 'goal' || e.type === 'penalty_goal' || e.type === 'own_goal') ?? []
              return (
                <div key={f.id} className="rounded-xl border border-line bg-surface-2 px-3 py-2.5">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
                    <div className="flex min-w-0 items-center justify-end gap-2 text-right"><span className="truncate font-medium">{h?.shortName}</span><Crest club={h} size={24} /></div>
                    <div className="min-w-16 text-center">
                      {r ? <span className="font-mono text-lg font-bold tabular">{r.homeGoals}–{r.awayGoals}</span> : <span className="text-xs text-faint">{t('common.vs')}</span>}
                    </div>
                    <div className="flex min-w-0 items-center gap-2"><Crest club={a} size={24} /><span className="truncate font-medium">{a?.shortName}</span></div>
                  </div>
                  {r ? (
                    scorers.length > 0 && (
                      <div className="mt-1.5 grid grid-cols-2 gap-3 text-[11px] text-muted">
                        <div className="text-right">{scorers.filter((e) => e.side === 'home').map((e) => `${store.players.find((p) => p.id === e.playerId)?.shortName ?? '?'} ${e.minute}'${e.type === 'own_goal' ? ' (OG)' : e.type === 'penalty_goal' ? ' (P)' : ''}`).join(', ')}</div>
                        <div>{scorers.filter((e) => e.side === 'away').map((e) => `${store.players.find((p) => p.id === e.playerId)?.shortName ?? '?'} ${e.minute}'${e.type === 'own_goal' ? ' (OG)' : e.type === 'penalty_goal' ? ' (P)' : ''}`).join(', ')}</div>
                      </div>
                    )
                  ) : (
                    <div className="mt-2 flex justify-center gap-2">
                      <Button size="sm" variant="ghost" onClick={() => watch(f.id)}><Play size={14} /> {t('league.watch')}</Button>
                      <Button size="sm" variant="ghost" onClick={async () => { const res = simulateMatch(leagueConfig(ctx, d, f)); await store.putSave(applyLeagueResult(save, f.id, compact(res, 'instant'))) }}><Zap size={14} /> {t('mode.instant')}</Button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {tab === 'players' && (played ? <Leaders totals={totals} /> : <Empty title={t('stats.noData')} />)}

      {tab === 'real' && (
        <Card>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge tone="info">{t('real.badge')}</Badge>
            <span className="text-sm text-muted">{t('real.note', { n: store.dataset.realMatches.filter((m) => m.status === 'played').length })}</span>
          </div>
          <StandingsTable rows={realStandings(store.dataset)} />
        </Card>
      )}
    </div>
  )
}
