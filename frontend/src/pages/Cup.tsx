import { Info, Play, Plus, Swords, Trash2, Trophy, Zap } from 'lucide-react'
import { useState } from 'react'
import { Crest } from '../components/Crest'
import { Badge, Button, Card, Empty, Input, PageHeader, Select, Toggle } from '../components/ui'
import type { CupData, SaveRecord } from '../data/types'
import { currentRound, pendingMatches, type CupFormat, type CupTie } from '../engine/cup'
import { simulateMatch } from '../engine/match'
import { randomSeed } from '../engine/rng'
import { useT } from '../i18n'
import { applyCupResult, cupConfig, DEFAULT_CUP_FORMAT, newCup, type DataCtx } from '../lib/competitions'
import { realStandings } from '../lib/football'
import { navigate } from '../lib/router'
import { clsx } from '../lib/text'
import { useStore } from '../store/context'

export function Cup() {
  const t = useT()
  const store = useStore()
  const cups = store.saves.filter((s): s is SaveRecord<CupData> => s.kind === 'cup')
  const [selected, setSelected] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const save = cups.find((s) => s.id === selected) ?? cups[0]
  const winners = cups.filter((c) => c.data.state.championId)

  return (
    <div>
      <PageHeader
        icon={<Swords size={22} />}
        title={t('nav.cup')}
        subtitle={t('cup.subtitle')}
        action={
          <>
            {cups.length > 0 && (
              <Select value={save?.id ?? ''} onChange={(e) => setSelected(e.target.value)} aria-label={t('cup.saves')}>
                {cups.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            )}
            <Button variant="primary" onClick={() => setCreating(true)}><Plus size={16} /> {t('cup.new')}</Button>
          </>
        }
      />
      <div className="mb-5 flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 p-3 text-xs text-warning">
        <Info size={16} className="mt-px shrink-0" /> {t('cup.formatWarning')}
      </div>
      {creating || !save ? (
        <CreateCup onCreated={(id) => { setSelected(id); setCreating(false) }} onCancel={cups.length ? () => setCreating(false) : undefined} />
      ) : (
        <CupView key={save.id} save={save} />
      )}
      {winners.length > 0 && (
        <Card className="mt-6">
          <div className="mb-3 flex items-center gap-2 font-semibold"><Trophy size={18} className="text-accent" /> {t('cup.history')}</div>
          <div className="space-y-1.5">
            {winners.map((w) => {
              const c = store.club(w.data.state.championId!)
              const final = w.data.state.rounds[w.data.state.rounds.length - 1]?.ties[0]
              const runnerUp = final && store.club(final.aId === w.data.state.championId ? final.bId ?? '' : final.aId)
              return (
                <div key={w.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-surface-2 px-3 py-2 text-sm">
                  <Crest club={c} size={24} />
                  <span className="font-semibold">{c?.name}</span>
                  {runnerUp && <span className="text-muted">{t('cup.beat', { club: runnerUp.shortName })}</span>}
                  <span className="ml-auto text-xs text-faint">{w.name} · {new Date(w.updatedAt).toLocaleDateString()}</span>
                </div>
              )
            })}
          </div>
        </Card>
      )}
    </div>
  )
}

function CreateCup({ onCreated, onCancel }: { onCreated: (id: string) => void; onCancel?: () => void }) {
  const t = useT()
  const store = useStore()
  const [name, setName] = useState(() => `${t('nav.cup')} ${store.dataset.season.name}`)
  const [participants, setParticipants] = useState<string[]>(() => store.clubs.map((c) => c.id))
  const [format, setFormat] = useState<CupFormat>(DEFAULT_CUP_FORMAT)
  const [seed, setSeed] = useState('')
  const toggle = (id: string) => setParticipants((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  const legs = (k: keyof CupFormat['legs']) => (
    <Select label={t(`cup.legs.${k}`)} value={format.legs[k]} onChange={(e) => setFormat({ ...format, legs: { ...format.legs, [k]: Number(e.target.value) as 1 | 2 } })}>
      <option value={1}>{t('cup.oneLeg')}</option>
      <option value={2}>{t('cup.twoLegs')}</option>
    </Select>
  )
  const create = async () => {
    // seeding for byes: current real league table order
    const seeds = realStandings(store.dataset).map((r) => r.clubId)
    const s = await store.putSave(newCup(store.dataset, name.trim() || 'Cup', seed.trim() || randomSeed(), participants, format, seeds))
    onCreated(s.id)
  }
  return (
    <Card className="max-w-3xl">
      <div className="mb-4 font-display text-lg font-semibold">{t('cup.createTitle')}</div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label={t('common.name')} value={name} onChange={(e) => setName(e.target.value)} />
        <Input label={t('quick.seed')} placeholder={t('quick.seedPlaceholder')} value={seed} onChange={(e) => setSeed(e.target.value)} />
        {legs('default')}
        {legs('semiFinal')}
        {legs('final')}
        <div className="flex flex-col justify-end gap-3 pb-1">
          <Toggle checked={format.drawEachRound} onChange={(v) => setFormat({ ...format, drawEachRound: v })} label={t('cup.drawEachRound')} />
        </div>
      </div>
      <p className="mt-3 text-xs text-muted">{t('cup.etNote')}</p>
      <div className="mt-5 mb-2 flex items-center justify-between text-sm font-semibold">
        {t('cup.participants')} <span className="text-muted tabular">{participants.length}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {store.clubs.map((c) => (
          <button key={c.id} type="button" onClick={() => toggle(c.id)} className={clsx('flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm', participants.includes(c.id) ? 'border-accent bg-accent/10' : 'border-line text-muted')}>
            <Crest club={c} size={20} /> <span className="truncate">{c.shortName}</span>
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-faint">{t('cup.byesNote')}</p>
      <div className="mt-5 flex justify-end gap-2">
        {onCancel && <Button onClick={onCancel}>{t('common.cancel')}</Button>}
        <Button variant="primary" onClick={create} disabled={participants.length < 2}><Swords size={16} /> {t('cup.draw')}</Button>
      </div>
    </Card>
  )
}

function TieCard({ tie, save }: { tie: CupTie; save: SaveRecord<CupData> }) {
  const t = useT()
  const store = useStore()
  const a = store.club(tie.aId)
  const b = tie.bId ? store.club(tie.bId) : undefined
  const legs = [0, 1].map((leg) => save.data.results[`${tie.id}:${leg}`]).filter(Boolean)
  let aggA = 0, aggB = 0
  for (const l of legs) {
    if (l.homeId === tie.aId) { aggA += l.homeGoals; aggB += l.awayGoals } else { aggB += l.homeGoals; aggA += l.awayGoals }
  }
  const pens = legs.find((l) => l.penalties)?.penalties
  const row = (id: string | undefined, club: typeof a, agg: number) => (
    <div className={clsx('flex items-center gap-2 px-3 py-1.5', tie.winnerId && tie.winnerId === id ? 'font-semibold text-fg' : tie.winnerId ? 'text-faint' : 'text-fg')}>
      <Crest club={club} size={20} />
      <span className="min-w-0 flex-1 truncate">{club?.shortName ?? t('cup.bye')}</span>
      {legs.length > 0 && <span className="font-mono tabular">{agg}</span>}
    </div>
  )
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface-2 text-sm">
      {row(tie.aId, a, aggA)}
      <div className="h-px bg-line" />
      {tie.bId ? row(tie.bId, b, aggB) : <div className="px-3 py-1.5 text-xs text-faint">{t('cup.bye')}</div>}
      {(legs.length > 0 || pens) && (
        <div className="border-t border-line px-3 py-1 text-[10px] text-muted">
          {legs.map((l, i) => <span key={i} className="mr-2">{t(i === 0 && tie.legs === 2 ? 'cup.leg1' : i === 1 ? 'cup.leg2' : 'cup.match')}: {l.homeGoals}–{l.awayGoals}{l.extraTime ? ` ${t('match.aet')}` : ''}</span>)}
          {pens && <span>{t('match.penaltiesShort')} {pens[0]}–{pens[1]}</span>}
        </div>
      )}
    </div>
  )
}

function CupView({ save }: { save: SaveRecord<CupData> }) {
  const t = useT()
  const store = useStore()
  const [busy, setBusy] = useState(false)
  const state = save.data.state
  const ctx: DataCtx = { club: store.club, clubPlayers: store.clubPlayers, lineupFor: store.lineupFor }
  const pending = pendingMatches(state)
  const round = currentRound(state)
  const champion = state.championId ? store.club(state.championId) : null

  const playAll = async () => {
    setBusy(true)
    await new Promise((r) => setTimeout(r, 20))
    let next = save
    for (const m of pendingMatches(next.data.state)) {
      next = applyCupResult(next, m, simulateMatch(cupConfig(ctx, next.data, m)), 'instant')
    }
    await store.putSave(next)
    setBusy(false)
  }

  const watch = (i: number) => {
    const m = pending[i]
    const cfg = cupConfig(ctx, save.data, m)
    store.startMatch({ config: cfg, mode: 'live', stadiumName: cfg.neutral ? t('quick.neutralVenue') : store.club(m.homeId)?.stadium.name ?? '', context: { kind: 'cup', saveId: save.id, tieId: m.tieId, leg: m.leg }, userSides: [] })
    navigate({ page: 'match' })
  }

  return (
    <div className="space-y-5">
      <Card className="flex flex-wrap items-center gap-4">
        <div className="min-w-0 flex-1">
          <div className="font-display text-lg font-semibold">{save.name}</div>
          <div className="text-sm text-muted">{round ? t('cup.current', { stage: t(`stage.${round.name}`) }) : t('cup.finished')}</div>
        </div>
        {champion ? (
          <div className="flex items-center gap-3 rounded-2xl border border-accent/40 bg-accent/10 px-4 py-2">
            <Trophy className="text-accent" size={22} /><Crest club={champion} size={30} />
            <div><div className="text-xs text-muted">{t('cup.winner')}</div><div className="font-semibold">{champion.name}</div></div>
          </div>
        ) : (
          <Button variant="primary" onClick={playAll} disabled={busy || !pending.length}><Zap size={16} /> {t('cup.playStage')}</Button>
        )}
        <Button variant="ghost" onClick={async () => { if (window.confirm(t('common.confirmDelete'))) await store.deleteSave(save.id) }} aria-label={t('common.delete')}><Trash2 size={16} /></Button>
      </Card>

      {pending.length > 0 && (
        <Card>
          <div className="mb-3 font-semibold">{t('cup.upcoming')}</div>
          <div className="grid gap-2 md:grid-cols-2">
            {pending.map((m, i) => {
              const h = store.club(m.homeId)
              const a = store.club(m.awayId)
              return (
                <div key={`${m.tieId}:${m.leg}`} className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm">
                  <Crest club={h} size={22} /><span className="font-medium">{h?.shortName}</span>
                  <span className="text-faint">{t('common.vs')}</span>
                  <span className="font-medium">{a?.shortName}</span><Crest club={a} size={22} />
                  {m.aggregate && <Badge>{t('cup.leg2')} · {t('cup.firstLeg', { score: `${m.aggregate.homeGoals}–${m.aggregate.awayGoals}` })}</Badge>}
                  <div className="ml-auto flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => watch(i)}><Play size={14} /> {t('league.watch')}</Button>
                    <Button size="sm" variant="ghost" onClick={async () => store.putSave(applyCupResult(save, m, simulateMatch(cupConfig(ctx, save.data, m)), 'instant'))}><Zap size={14} /></Button>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      <div className="overflow-x-auto pb-2 scrollbar-thin">
        <div className="flex min-w-max gap-4">
          {state.rounds.map((r) => (
            <div key={r.index} className="w-56 shrink-0">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">{t(`stage.${r.name}`)}</div>
              <div className="flex h-full flex-col justify-around gap-2">
                {r.ties.map((tie) => <TieCard key={tie.id} tie={tie} save={save} />)}
              </div>
            </div>
          ))}
        </div>
      </div>
      {state.rounds.length === 0 && <Empty title={t('common.nothing')} />}
    </div>
  )
}
