import { BarChart3, Goal, Hand, Shield, Square } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { Crest } from '../components/Crest'
import { Badge, Card, Empty, PageHeader, Select } from '../components/ui'
import type { CupData, LeagueData, SaveRecord } from '../data/types'
import { useT } from '../i18n'
import { playerTotals, type PlayerTotals } from '../lib/football'
import { compareAz } from '../lib/text'
import { useStore } from '../store/context'
import { StandingsTable } from './League'
import { realStandings } from '../lib/football'

function LeaderList({ title, icon, rows, value, unit }: { title: string; icon: ReactNode; rows: PlayerTotals[]; value: (r: PlayerTotals) => number; unit?: string }) {
  const t = useT()
  const store = useStore()
  const top = rows.filter((r) => value(r) > 0).sort((a, b) => value(b) - value(a) || a.minutes - b.minutes).slice(0, 10)
  return (
    <Card>
      <div className="mb-3 flex items-center gap-2 font-semibold"><span className="text-accent">{icon}</span> {title}</div>
      {top.length === 0 ? (
        <p className="py-4 text-center text-sm text-faint">{t('stats.noData')}</p>
      ) : (
        <ol className="space-y-1.5">
          {top.map((r, i) => {
            const p = store.players.find((x) => x.id === r.playerId)
            const c = store.club(r.clubId)
            return (
              <li key={r.playerId} className="grid grid-cols-[22px_24px_minmax(0,1fr)_auto] items-center gap-2 text-sm">
                <span className="text-center text-xs font-bold text-faint tabular">{i + 1}</span>
                <Crest club={c} size={20} />
                <span className="min-w-0 truncate">{p?.fullName ?? t('common.unknownPlayer')} <span className="text-xs text-faint">· {c?.shortName}</span></span>
                <span className="font-bold tabular">{value(r)}{unit}</span>
              </li>
            )
          })}
        </ol>
      )}
    </Card>
  )
}

export function Leaders({ totals }: { totals: PlayerTotals[] }) {
  const t = useT()
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <LeaderList title={t('stats.topScorers')} icon={<Goal size={18} />} rows={totals} value={(r) => r.goals} />
      <LeaderList title={t('stats.topAssists')} icon={<Hand size={18} />} rows={totals} value={(r) => r.assists} />
      <LeaderList title={t('stats.cleanSheets')} icon={<Shield size={18} />} rows={totals} value={(r) => r.cleanSheets} />
      <LeaderList title={t('stats.gkSaves')} icon={<Shield size={18} />} rows={totals} value={(r) => r.saves} />
      <LeaderList title={t('stats.yellowCards')} icon={<Square size={16} fill="#facc15" stroke="#a16207" />} rows={totals} value={(r) => r.yellow} />
    </div>
  )
}

export function Statistics() {
  const t = useT()
  const store = useStore()
  const [source, setSource] = useState<string>('quick')
  const saves = store.saves

  const results = useMemo(() => {
    if (source === 'quick') {
      return store.matches.filter((m) => m.players).map((m) => ({ homeId: m.homeId, awayId: m.awayId, players: m.players!, homeGoals: m.score[0], awayGoals: m.score[1], stats: m.stats }))
    }
    const s = saves.find((x) => x.id === source)
    if (!s) return []
    if (s.kind === 'league') {
      const d = (s as SaveRecord<LeagueData>).data
      return Object.entries(d.results).map(([id, r]) => {
        const f = d.fixtures.find((x) => x.id === id)!
        return { homeId: f.homeId, awayId: f.awayId, players: r.players, homeGoals: r.homeGoals, awayGoals: r.awayGoals, stats: r.stats }
      })
    }
    const d = (s as SaveRecord<CupData>).data
    return Object.values(d.results).map((r) => ({ homeId: r.homeId, awayId: r.awayId, players: r.players, homeGoals: r.homeGoals, awayGoals: r.awayGoals, stats: r.stats }))
  }, [source, saves, store.matches])

  const totals = useMemo(() => playerTotals(results, store.players), [results, store.players])

  const teams = useMemo(() => {
    const m = new Map<string, { clubId: string; games: number; gf: number; ga: number; xg: number; xga: number; poss: number; shots: number; withStats: number }>()
    for (const r of results) {
      for (const side of ['home', 'away'] as const) {
        const id = side === 'home' ? r.homeId : r.awayId
        const row = m.get(id) ?? { clubId: id, games: 0, gf: 0, ga: 0, xg: 0, xga: 0, poss: 0, shots: 0, withStats: 0 }
        row.games++
        row.gf += side === 'home' ? r.homeGoals : r.awayGoals
        row.ga += side === 'home' ? r.awayGoals : r.homeGoals
        if (r.stats) {
          row.withStats++
          row.xg += r.stats[side].xg
          row.xga += r.stats[side === 'home' ? 'away' : 'home'].xg
          row.poss += r.stats[side].possession
          row.shots += r.stats[side].shots
        }
        m.set(id, row)
      }
    }
    return [...m.values()].sort((a, b) => b.gf / b.games - a.gf / a.games || compareAz(a.clubId, b.clubId))
  }, [results])

  const totalGoals = results.reduce((s, r) => s + r.homeGoals + r.awayGoals, 0)
  const homeWins = results.filter((r) => r.homeGoals > r.awayGoals).length
  const draws = results.filter((r) => r.homeGoals === r.awayGoals).length

  return (
    <div>
      <PageHeader
        icon={<BarChart3 size={22} />}
        title={t('nav.stats')}
        subtitle={t('stats.subtitle')}
        action={
          <Select value={source} onChange={(e) => setSource(e.target.value)} aria-label={t('stats.source')}>
            <option value="quick">{t('stats.quickMatches', { n: store.matches.length })}</option>
            {saves.map((s) => <option key={s.id} value={s.id}>{t(`nav.${s.kind}`)} · {s.name}</option>)}
          </Select>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          [t('stats.matches'), results.length],
          [t('stats.goalsPerMatch'), results.length ? (totalGoals / results.length).toFixed(2) : '—'],
          [t('stats.homeWins'), results.length ? `${Math.round((homeWins / results.length) * 100)}%` : '—'],
          [t('stats.draws'), results.length ? `${Math.round((draws / results.length) * 100)}%` : '—'],
        ].map(([label, v]) => (
          <Card key={String(label)} className="p-4">
            <div className="text-xs text-muted">{label}</div>
            <div className="mt-1 font-display text-2xl font-bold tabular">{v}</div>
          </Card>
        ))}
      </div>
      <p className="-mt-2 mb-5 text-xs text-faint">{t('stats.realBenchmark', { gpm: String(store.dataset.calibration.goalsPerMatch ?? '—'), home: Math.round(Number(store.dataset.calibration.homeWinPct ?? 0) * 100), draw: Math.round(Number(store.dataset.calibration.drawPct ?? 0) * 100) })}</p>

      {results.length === 0 ? <Empty icon={<BarChart3 size={36} />} title={t('stats.noData')} text={t('stats.noDataText')} /> : (
        <>
          <Leaders totals={totals} />
          <Card className="mt-5">
            <div className="mb-3 font-semibold">{t('stats.teams')}</div>
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-faint">
                    <th className="py-2">{t('table.club')}</th>
                    <th className="py-2 text-center">{t('table.played')}</th>
                    <th className="py-2 text-center">{t('stats.gfPerGame')}</th>
                    <th className="py-2 text-center">{t('stats.gaPerGame')}</th>
                    <th className="py-2 text-center">xG</th>
                    <th className="py-2 text-center">xGA</th>
                    <th className="py-2 text-center">{t('stats.possession')}</th>
                    <th className="py-2 text-center">{t('stats.shots')}</th>
                  </tr>
                </thead>
                <tbody>
                  {teams.map((r) => {
                    const c = store.club(r.clubId)
                    const per = (v: number, n: number) => (n ? (v / n).toFixed(2) : '—')
                    return (
                      <tr key={r.clubId} className="border-b border-line/50 last:border-0">
                        <td className="py-2"><span className="flex items-center gap-2"><Crest club={c} size={20} /> {c?.shortName}</span></td>
                        <td className="py-2 text-center tabular">{r.games}</td>
                        <td className="py-2 text-center tabular">{per(r.gf, r.games)}</td>
                        <td className="py-2 text-center tabular">{per(r.ga, r.games)}</td>
                        <td className="py-2 text-center tabular">{per(r.xg, r.withStats)}</td>
                        <td className="py-2 text-center tabular">{per(r.xga, r.withStats)}</td>
                        <td className="py-2 text-center tabular">{r.withStats ? `${Math.round(r.poss / r.withStats)}%` : '—'}</td>
                        <td className="py-2 text-center tabular">{per(r.shots, r.withStats)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {source === 'quick' && store.matches.length > 0 && (
        <Card className="mt-5">
          <div className="mb-3 font-semibold">{t('stats.history')}</div>
          <div className="space-y-1.5">
            {store.matches.slice(0, 50).map((m) => {
              const h = store.club(m.homeId)
              const a = store.club(m.awayId)
              return (
                <a key={m.id} href={`#/match/${m.id}`} className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl px-2 py-2 text-sm hover:bg-surface-2">
                  <span className="flex min-w-0 items-center justify-end gap-2 text-right"><span className="truncate">{h?.shortName}</span><Crest club={h} size={20} /></span>
                  <span className="font-mono font-bold tabular">{m.score[0]}–{m.score[1]}{m.penalties ? ` (${m.penalties[0]}–${m.penalties[1]})` : ''}</span>
                  <span className="flex min-w-0 items-center gap-2"><Crest club={a} size={20} /><span className="truncate">{a?.shortName}</span></span>
                  <span className="hidden items-center gap-2 text-xs text-muted sm:flex"><Badge>{t(`mode.${m.mode}`)}</Badge>{new Date(m.createdAt).toLocaleDateString()}</span>
                </a>
              )
            })}
          </div>
        </Card>
      )}

      <Card className="mt-5">
        <div className="mb-3 flex flex-wrap items-center gap-2 font-semibold">{t('real.title')} <Badge tone="info">{t('real.badge')}</Badge></div>
        <StandingsTable rows={realStandings(store.dataset)} />
        <p className="mt-3 text-[11px] text-faint">{t('real.sourceNote')}</p>
      </Card>
    </div>
  )
}
