import { motion } from 'framer-motion'
import { ArrowRight, Shield, Sparkles, Swords, Trophy, Users, Zap } from 'lucide-react'
import { useMemo } from 'react'
import { Crest } from '../components/Crest'
import { Badge, Card, SectionTitle } from '../components/ui'
import type { LeagueData, SaveRecord } from '../data/types'
import { useT } from '../i18n'
import { currentRound, leagueStandings, totalRounds } from '../lib/competitions'
import { realStandings } from '../lib/football'
import { useStore } from '../store/context'
import { StandingsTable } from './League'

export function Dashboard() {
  const t = useT()
  const store = useStore()
  const real = useMemo(() => realStandings(store.dataset), [store.dataset])
  const league = store.saves.find((s): s is SaveRecord<LeagueData> => s.kind === 'league')
  const leagueRows = league ? leagueStandings(league.data) : null
  const realPlayed = store.dataset.realMatches.filter((m) => m.status === 'played')
  const lastRound = Math.max(0, ...realPlayed.map((m) => m.round))
  const lastResults = realPlayed.filter((m) => m.round === lastRound)
  const cal = store.dataset.calibration

  const tiles = [
    { href: '#/quick', icon: <Zap size={20} />, title: t('nav.quick'), text: t('dash.quickText') },
    { href: '#/squad', icon: <Users size={20} />, title: t('nav.squad'), text: t('dash.squadText') },
    { href: '#/league', icon: <Trophy size={20} />, title: t('nav.league'), text: t('dash.leagueText') },
    { href: '#/cup', icon: <Swords size={20} />, title: t('nav.cup'), text: t('dash.cupText') },
  ]

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl border border-line bg-elev p-6 sm:p-10">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-60" />
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-accent/25 blur-3xl" />
        <div className="relative max-w-2xl">
          <Badge tone="accent"><Sparkles size={12} /> {t('dash.badge', { season: store.dataset.season.name })}</Badge>
          <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-5xl">
            {t('dash.title')}
          </motion.h1>
          <p className="mt-3 text-base text-muted sm:text-lg">{t('dash.lead')}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href="#/quick" className="inline-flex h-12 items-center gap-2 rounded-xl bg-accent px-6 font-semibold text-accent-ink shadow-[0_8px_30px_-10px_var(--accent)] hover:bg-accent-2">
              <Zap size={18} /> {t('dash.cta')}
            </a>
            <a href="#/league" className="inline-flex h-12 items-center gap-2 rounded-xl border border-line bg-surface-2 px-6 font-semibold hover:border-accent/50">
              <Trophy size={18} /> {league ? t('dash.continue') : t('league.new')}
            </a>
          </div>
        </div>
        <div className="relative mt-8 flex gap-3 overflow-x-auto pb-1 scrollbar-thin">
          {store.clubs.map((c, i) => (
            <motion.a key={c.id} href={`#/clubs/${c.id}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className="flex shrink-0 flex-col items-center gap-1 rounded-2xl border border-line bg-surface/70 px-3 py-2 hover:border-accent/50" title={c.name}>
              <Crest club={c} size={34} />
              <span className="text-[11px] font-medium text-muted">{c.code}</span>
            </motion.a>
          ))}
        </div>
      </section>

      <section aria-labelledby="how-title">
        <h2 id="how-title" className="mb-3 font-display text-lg font-semibold">{t('how.title')}</h2>
        <ol className="grid gap-3 sm:grid-cols-3">
          {[
            { n: 1, href: '#/quick', key: 'how.step1' },
            { n: 2, href: '#/squad', key: 'how.step2' },
            { n: 3, href: '#/quick', key: 'how.step3' },
          ].map((x) => (
            <li key={x.n}>
              <a href={x.href} className="flex h-full items-start gap-3 rounded-2xl border border-line bg-surface p-4 hover:border-accent/50">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent font-display font-bold text-accent-ink">{x.n}</span>
                <span>
                  <span className="block font-semibold">{t(`${x.key}.title`)}</span>
                  <span className="mt-0.5 block text-sm text-muted">{t(`${x.key}.text`)}</span>
                </span>
              </a>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((x) => (
          <a key={x.href} href={x.href} className="group rounded-2xl border border-line bg-surface p-5 transition-colors hover:border-accent/50">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent/12 text-accent">{x.icon}</div>
            <div className="mt-3 flex items-center justify-between font-display font-semibold">{x.title}<ArrowRight size={16} className="text-faint transition-transform group-hover:translate-x-1 group-hover:text-accent" /></div>
            <p className="mt-1 text-sm text-muted">{x.text}</p>
          </a>
        ))}
      </section>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Card>
          <SectionTitle title={t('dash.realTable')} subtitle={t('dash.realTableSub', { round: lastRound })} action={<Badge tone="info">{t('real.badge')}</Badge>} />
          <StandingsTable rows={real} compactView />
        </Card>
        <div className="space-y-5">
          <Card>
            <SectionTitle title={t('dash.lastRound', { round: lastRound })} action={<Badge tone="info">{t('real.badge')}</Badge>} />
            <div className="space-y-1.5">
              {lastResults.map((m) => {
                const h = store.club(m.homeId)
                const a = store.club(m.awayId)
                return (
                  <div key={m.id} className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 rounded-xl bg-surface-2 px-3 py-2 text-sm">
                    <span className="flex min-w-0 items-center justify-end gap-2 text-right"><span className="truncate">{h?.shortName}</span><Crest club={h} size={20} /></span>
                    <span className="font-mono font-bold tabular">{m.homeGoals}–{m.awayGoals}</span>
                    <span className="flex min-w-0 items-center gap-2"><Crest club={a} size={20} /><span className="truncate">{a?.shortName}</span></span>
                  </div>
                )
              })}
            </div>
          </Card>
          {league && leagueRows && (
            <Card>
              <SectionTitle title={league.name} subtitle={currentRound(league.data) ? t('league.roundOf', { n: currentRound(league.data)!, total: totalRounds(league.data) }) : t('cup.finished')} action={<Badge tone="accent">{t('common.simulated')}</Badge>} />
              <div className="space-y-1.5">
                {leagueRows.slice(0, 4).map((r) => {
                  const c = store.club(r.clubId)
                  return (
                    <div key={r.clubId} className="flex items-center gap-3 text-sm">
                      <span className="w-5 text-center font-bold text-faint tabular">{r.position}</span>
                      <Crest club={c} size={20} />
                      <span className="flex-1 truncate">{c?.shortName}</span>
                      <span className="font-bold tabular">{r.points}</span>
                    </div>
                  )
                })}
              </div>
            </Card>
          )}
          <Card>
            <SectionTitle title={t('dash.engine')} />
            <p className="text-sm text-muted">{t('dash.engineText', { gpm: String(cal.goalsPerMatch), home: Math.round(Number(cal.homeWinPct) * 100), draw: Math.round(Number(cal.drawPct) * 100), n: String(cal.matches) })}</p>
            {store.matches[0] && (
              <a href={`#/match/${store.matches[0].id}`} className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">
                <Shield size={14} /> {t('match.lastMatch')}
              </a>
            )}
          </Card>
        </div>
      </section>
    </div>
  )
}
