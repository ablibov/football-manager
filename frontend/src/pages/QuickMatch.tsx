import { ArrowLeftRight, ChevronDown, CloudRain, Dices, Pencil, Play, Save, Zap } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Crest, FormDots } from '../components/Crest'
import { Badge, Button, Card, Input, PageHeader, RatingPill, Segmented, Select, Toggle } from '../components/ui'
import { FORMATION_CODES } from '../engine/formations'
import { changeFormation, isPlayable } from '../engine/lineup'
import { MatchSimulation } from '../engine/match'
import { outcomeProbabilities } from '../engine/odds'
import { randomSeed } from '../engine/rng'
import type { FormationCode, Lineup, Side, Tactics, Weather } from '../engine/types'
import { useT } from '../i18n'
import { buildConfig, formValue, realForm, teamRatings } from '../lib/football'
import { navigate } from '../lib/router'
import { readLocal, writeLocal, writeSession } from '../lib/storage'
import { compareAz } from '../lib/text'
import { useStore } from '../store/context'

const WEATHER: Weather[] = ['clear', 'rain', 'wind', 'snow', 'heat']
const SETUP_KEY = 'azpfl.quickSetup'
interface QuickSetup { homeId: string; awayId: string; neutral: boolean; stadium: string; weather: Weather; mode: 'instant' | 'live' | 'manual'; control: 'none' | Side | 'both' }

export function QuickMatch() {
  const t = useT()
  const store = useStore()
  const clubs = useMemo(() => [...store.clubs].sort((a, b) => compareAz(a.name, b.name)), [store.clubs])
  // the setup is remembered, so a trip to the Squad Builder doesn't lose it
  const [saved] = useState(() => readLocal<Partial<QuickSetup>>(SETUP_KEY, {}))
  const valid = (id: string | undefined) => (id && store.club(id) ? id : undefined)
  const [homeId, setHomeId] = useState(() => valid(saved.homeId) ?? store.clubs[0]?.id ?? '')
  const [awayId, setAwayId] = useState(() => valid(saved.awayId) ?? store.clubs[1]?.id ?? '')
  const [neutral, setNeutral] = useState(saved.neutral ?? false)
  const [stadium, setStadium] = useState<string>(saved.stadium ?? '')
  const [weather, setWeather] = useState<Weather>(saved.weather ?? 'clear')
  const [mode, setMode] = useState<'instant' | 'live' | 'manual'>(saved.mode ?? 'live')
  const [control, setControl] = useState<'none' | Side | 'both'>(saved.control ?? 'home')
  const [seed, setSeed] = useState('')
  const [more, setMore] = useState(false)
  useEffect(() => {
    writeLocal(SETUP_KEY, { homeId, awayId, neutral, stadium, weather, mode, control } satisfies QuickSetup)
  }, [homeId, awayId, neutral, stadium, weather, mode, control])
  const [overrides, setOverrides] = useState<Partial<Record<Side, { formation?: FormationCode; tactics?: Tactics }>>>({})
  const [manual, setManual] = useState({ home: 0, away: 0 })

  const form = useMemo(() => realForm(store.dataset), [store.dataset])
  const home = store.club(homeId)
  const away = store.club(awayId)

  const lineupOf = (side: Side): Lineup | null => {
    const id = side === 'home' ? homeId : awayId
    if (!store.club(id)) return null
    let l = store.lineupFor(id)
    const o = overrides[side]
    if (o?.formation && o.formation !== l.formation) l = changeFormation(l, o.formation, store.clubPlayers(id))
    if (o?.tactics) l = { ...l, tactics: o.tactics }
    return l
  }
  const hl = lineupOf('home')
  const al = lineupOf('away')
  const stadiumName = neutral ? stadium || t('quick.neutralVenue') : home?.stadium.name ?? t('common.unknown')

  const config = useMemo(() => {
    if (!home || !away || !hl || !al || homeId === awayId) return null
    if (!isPlayable(hl, store.clubPlayers(homeId)) || !isPlayable(al, store.clubPlayers(awayId))) return null
    return buildConfig({
      seed: seed.trim() || 'preview',
      home: { club: home, players: store.clubPlayers(homeId), lineup: hl },
      away: { club: away, players: store.clubPlayers(awayId), lineup: al },
      neutral,
      weather: store.settings.weatherEnabled ? weather : 'clear',
      form: { home: formValue(form[homeId]), away: formValue(form[awayId]) },
      autoSubs: { home: !(control === 'home' || control === 'both') || mode === 'instant', away: !(control === 'away' || control === 'both') || mode === 'instant' },
    })
  }, [home, away, hl, al, homeId, awayId, neutral, weather, form, control, mode, seed, store])

  const odds = useMemo(() => {
    if (!config) return null
    const sim = new MatchSimulation(config)
    return { ...outcomeProbabilities(sim.lambdaAtKickoff.home, sim.lambdaAtKickoff.away), xg: sim.lambdaAtKickoff }
  }, [config])

  const swap = () => {
    setHomeId(awayId)
    setAwayId(homeId)
    setOverrides((o) => ({ home: o.away, away: o.home }))
    setManual((m) => ({ home: m.away, away: m.home }))
  }

  const simulate = () => {
    if (!config) return
    const cfg = { ...config, seed: seed.trim() || randomSeed() }
    if (mode === 'manual') return
    store.startMatch({
      config: cfg,
      mode,
      stadiumName,
      context: { kind: 'quick' },
      userSides: mode === 'live' ? (control === 'both' ? ['home', 'away'] : control === 'none' ? [] : [control]) : [],
    })
    navigate({ page: 'match' })
  }

  const saveManual = async () => {
    if (!home || !away || homeId === awayId) return
    await store.recordMatch({
      id: `local-${Date.now().toString(36)}`, createdAt: new Date().toISOString(), homeId, awayId, score: [manual.home, manual.away],
      halfTime: null, penalties: null, extraTime: false, mode: 'manual', seed: '', neutral, weather, stadiumName, events: [], stats: null, players: null,
    })
    store.toast('ok', 'quick.manualSaved')
  }

  const side = (s: Side) => {
    const id = s === 'home' ? homeId : awayId
    const c = store.club(id)
    const l = s === 'home' ? hl : al
    const r = l ? teamRatings(l, store.clubPlayers(id)) : null
    return (
      <Card className="relative overflow-hidden">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-20 blur-3xl" style={{ background: c?.colors.primary }} />
        <div className="mb-4 flex items-center justify-between">
          <Badge tone={s === 'home' ? 'accent' : 'info'}>{t(neutral ? `quick.team${s === 'home' ? 'A' : 'B'}` : `common.${s}`)}</Badge>
          {c && <FormDots form={form[c.id] ?? []} size="sm" />}
        </div>
        <div className="flex items-center gap-4">
          <Crest club={c} size={64} />
          <div className="min-w-0 flex-1">
            <Select value={id} onChange={(e) => (s === 'home' ? setHomeId : setAwayId)(e.target.value)} aria-label={t(`common.${s}`)}>
              {clubs.map((x) => (
                <option key={x.id} value={x.id} disabled={x.id === (s === 'home' ? awayId : homeId)}>
                  {x.name}
                </option>
              ))}
            </Select>
            <div className="mt-1.5 truncate text-xs text-muted">{c?.city} · {c?.coach ?? t('club.coachUnconfirmed')}</div>
          </div>
        </div>
        {l && r && (
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Select label={t('squad.formation')} value={l.formation} onChange={(e) => setOverrides((o) => ({ ...o, [s]: { ...o[s], formation: e.target.value as FormationCode } }))}>
              {FORMATION_CODES.map((f) => <option key={f}>{f}</option>)}
            </Select>
            <Select label={t('tactics.mentality')} value={l.tactics.mentality} onChange={(e) => setOverrides((o) => ({ ...o, [s]: { ...o[s], tactics: { ...l.tactics, mentality: e.target.value as Tactics['mentality'] } } }))}>
              {(['defensive', 'balanced', 'attacking'] as const).map((v) => <option key={v} value={v}>{t(`tactics.mentality.${v}`)}</option>)}
            </Select>
            <Select label={t('tactics.pressing')} value={l.tactics.pressing} onChange={(e) => setOverrides((o) => ({ ...o, [s]: { ...o[s], tactics: { ...l.tactics, pressing: e.target.value as Tactics['pressing'] } } }))}>
              {(['low', 'medium', 'high'] as const).map((v) => <option key={v} value={v}>{t(`tactics.pressing.${v}`)}</option>)}
            </Select>
            <Select label={t('tactics.tempo')} value={l.tactics.tempo} onChange={(e) => setOverrides((o) => ({ ...o, [s]: { ...o[s], tactics: { ...l.tactics, tempo: e.target.value as Tactics['tempo'] } } }))}>
              {(['slow', 'normal', 'fast'] as const).map((v) => <option key={v} value={v}>{t(`tactics.tempo.${v}`)}</option>)}
            </Select>
            <div className="col-span-2 flex items-center justify-between gap-2 rounded-xl bg-surface-2 px-3 py-2 text-xs">
              <span className="text-muted">{t('rating.att')} <b className="text-fg">{r.att}</b> · {t('rating.mid')} <b className="text-fg">{r.mid}</b> · {t('rating.def')} <b className="text-fg">{r.def}</b> · {t('rating.gk')} <b className="text-fg">{r.gk}</b></span>
              <RatingPill value={r.overall} />
            </div>
            <a href={`#/squad/${id}`} onClick={() => writeSession('azpfl.returnTo', 'quick')} className="col-span-2 inline-flex items-center justify-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm font-medium text-accent hover:border-accent/50">
              <Pencil size={14} /> {t('quick.editLineup')}
            </a>
          </div>
        )}
      </Card>
    )
  }

  return (
    <div>
      <PageHeader icon={<Zap size={22} />} title={t('nav.quick')} subtitle={t('quick.subtitle')} />

      <div className="grid items-start gap-4 lg:grid-cols-[1fr_auto_1fr]">
        {side('home')}
        <div className="flex items-center justify-center lg:pt-24">
          <Button onClick={swap} className="h-12 w-12 rounded-full p-0" title={t('quick.swap')} aria-label={t('quick.swap')}>
            <ArrowLeftRight size={20} />
          </Button>
        </div>
        {side('away')}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
        <Card>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-3">
              <Toggle checked={neutral} onChange={setNeutral} label={t('quick.neutral')} />
              <Select label={t('quick.stadium')} value={neutral ? stadium : home?.stadium.name ?? ''} disabled={!neutral} onChange={(e) => setStadium(e.target.value)}>
                {!neutral && <option value={home?.stadium.name ?? ''}>{home?.stadium.name ?? t('common.unknown')}</option>}
                {neutral && <option value="">{t('quick.neutralVenue')}</option>}
                {neutral && store.clubs.filter((c) => c.stadium.name).map((c) => <option key={c.id} value={c.stadium.name!}>{c.stadium.name}</option>)}
              </Select>
              {store.settings.weatherEnabled && (
                <Select label={<span className="inline-flex items-center gap-1"><CloudRain size={13} /> {t('quick.weather')}</span>} value={weather} onChange={(e) => setWeather(e.target.value as Weather)}>
                  {WEATHER.map((w) => <option key={w} value={w}>{t(`weather.${w}`)}</option>)}
                </Select>
              )}
            </div>
            <div className="space-y-3">
              <div className="text-xs font-medium text-muted">{t('quick.mode')}</div>
              <Segmented value={mode} onChange={setMode} options={[{ value: 'instant', label: t('mode.instant') }, { value: 'live', label: t('mode.live') }, { value: 'manual', label: t('mode.manual') }]} />
              <p className="text-xs text-muted">{t(`mode.${mode}.desc`)}</p>
              {mode === 'live' && (
                <Select label={t('quick.control')} value={control} onChange={(e) => setControl(e.target.value as typeof control)}>
                  <option value="home">{home?.shortName}</option>
                  <option value="away">{away?.shortName}</option>
                  <option value="both">{t('quick.controlBoth')}</option>
                  <option value="none">{t('quick.controlNone')}</option>
                </Select>
              )}
              {mode !== 'manual' && (
                <div>
                  <button type="button" onClick={() => setMore((m) => !m)} className="inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-fg" aria-expanded={more}>
                    <ChevronDown size={14} className={more ? 'rotate-180 transition-transform' : 'transition-transform'} /> {t('quick.more')}
                  </button>
                  {more && (
                    <div className="mt-2 flex items-end gap-2">
                      <Input label={t('quick.seed')} placeholder={t('quick.seedPlaceholder')} value={seed} onChange={(e) => setSeed(e.target.value)} className="flex-1" />
                      <Button onClick={() => setSeed(randomSeed())} title={t('quick.randomSeed')} aria-label={t('quick.randomSeed')}>
                        <Dices size={16} />
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          {mode === 'manual' ? (
            <div className="mt-5 flex flex-wrap items-end gap-3 border-t border-line pt-5">
              <Input type="number" min={0} max={30} label={home?.shortName} value={manual.home} onChange={(e) => setManual((m) => ({ ...m, home: Math.max(0, Math.min(30, Number(e.target.value) || 0)) }))} className="w-28" />
              <span className="pb-2 text-xl font-bold text-faint">:</span>
              <Input type="number" min={0} max={30} label={away?.shortName} value={manual.away} onChange={(e) => setManual((m) => ({ ...m, away: Math.max(0, Math.min(30, Number(e.target.value) || 0)) }))} className="w-28" />
              <Button variant="primary" size="lg" onClick={saveManual} disabled={homeId === awayId} className="ml-auto">
                <Save size={18} /> {t('quick.saveResult')}
              </Button>
            </div>
          ) : (
            <div className="mt-5 flex justify-end border-t border-line pt-5">
              <Button variant="primary" size="lg" onClick={simulate} disabled={!config} className="w-full sm:w-auto">
                <Play size={18} /> {t('quick.simulate')}
              </Button>
            </div>
          )}
          {!config && homeId !== awayId && <p className="mt-3 text-sm text-warning">{t('quick.invalidLineup')}</p>}
        </Card>

        <Card>
          <div className="mb-3 text-sm font-semibold">{t('quick.prediction')}</div>
          {odds && home && away ? (
            <>
              <div className="flex h-3 overflow-hidden rounded-full">
                <div style={{ width: `${odds.home * 100}%`, background: home.colors.primary }} />
                <div className="bg-line" style={{ width: `${odds.draw * 100}%` }} />
                <div style={{ width: `${odds.away * 100}%`, background: away.colors.primary === home.colors.primary ? away.colors.secondary : away.colors.primary }} />
              </div>
              <div className="mt-3 grid grid-cols-3 text-center">
                {([['home', home.shortName], ['draw', t('common.draw')], ['away', away.shortName]] as const).map(([k, label]) => (
                  <div key={k}>
                    <div className="font-display text-2xl font-bold tabular">{Math.round(odds[k] * 100)}%</div>
                    <div className="truncate text-xs text-muted">{label}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex justify-between rounded-xl bg-surface-2 px-3 py-2 text-sm">
                <span className="text-muted">{t('quick.expectedGoals')}</span>
                <span className="font-semibold tabular">{odds.xg.home.toFixed(2)} – {odds.xg.away.toFixed(2)}</span>
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-faint">{t('quick.predictionNote')}</p>
            </>
          ) : (
            <p className="text-sm text-muted">{t('quick.pickTwo')}</p>
          )}
        </Card>
      </div>
    </div>
  )
}
