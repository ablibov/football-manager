import { AlertTriangle, ArrowLeft, Check, CheckCircle2, RotateCcw, Search, Sparkles, Users } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Crest } from '../components/Crest'
import { LineupPitch, Token } from '../components/Pitch'
import { useDragDrop, type DragSource, type DropTarget } from '../lib/useDragDrop'
import { Badge, Bar, Button, Card, Input, PageHeader, RatingPill, Segmented, Select } from '../components/ui'
import { FORMATION_CODES } from '../engine/formations'
import { autoLineup, BENCH_SIZE, changeFormation, validateLineup } from '../engine/lineup'
import { overall, POSITION_ORDER } from '../engine/ratings'
import type { FormationCode, Lineup, Player, Tactics } from '../engine/types'
import { useT } from '../i18n'
import { teamRatings } from '../lib/football'
import { navigate } from '../lib/router'
import { readSession, writeSession } from '../lib/storage'
import { clsx, compareAz, matches } from '../lib/text'
import { useStore } from '../store/context'

function fixDuties(l: Lineup, players: Player[]): Lineup {
  const xi = new Set(Object.values(l.slots))
  const ok = (id: string | null) => (id && xi.has(id) ? id : null)
  const next = { ...l, captainId: ok(l.captainId), penaltyTakerId: ok(l.penaltyTakerId), freeKickTakerId: ok(l.freeKickTakerId), cornerTakerId: ok(l.cornerTakerId) }
  if (next.captainId && next.penaltyTakerId && next.freeKickTakerId && next.cornerTakerId) return next
  const xiPlayers = players.filter((p) => xi.has(p.id))
  const best = (f: (p: Player) => number) => [...xiPlayers].sort((a, b) => f(b) - f(a))[0]?.id ?? null
  return {
    ...next,
    captainId: next.captainId ?? best((p) => overall(p)),
    penaltyTakerId: next.penaltyTakerId ?? best((p) => (p.position === 'GK' ? 0 : p.attrs.sho)),
    freeKickTakerId: next.freeKickTakerId ?? best((p) => (p.position === 'GK' ? 0 : p.attrs.pas + p.attrs.sho)),
    cornerTakerId: next.cornerTakerId ?? best((p) => (p.position === 'GK' ? 0 : p.attrs.pas)),
  }
}

export function SquadBuilder({ clubId }: { clubId?: string }) {
  const store = useStore()
  const cid = clubId && store.club(clubId) ? clubId : store.clubs[0]?.id
  const players = store.clubPlayers(cid)
  // remount when the club changes or the saved line-up arrives from the backend
  const key = `${cid}:${store.ready}:${store.lineups[cid] ? 'saved' : 'auto'}:${players.length}`
  return <Builder key={key} clubId={cid} initial={store.lineupFor(cid)} players={players} />
}

function Builder({ clubId, initial, players }: { clubId: string; initial: Lineup; players: Player[] }) {
  const t = useT()
  const store = useStore()
  const club = store.club(clubId)!
  const [lineup, setLineup] = useState<Lineup>(initial)
  const [dirty, setDirty] = useState(false)
  const [selected, setSelected] = useState<DragSource | null>(null)
  const [query, setQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players])

  const update = useCallback((f: (l: Lineup) => Lineup) => {
    setLineup((l) => fixDuties(f(l), players))
    setDirty(true)
  }, [players])

  const xiIds = new Set(Object.values(lineup.slots))
  const benchIds = new Set(lineup.bench)
  const reserves = players
    .filter((p) => !xiIds.has(p.id) && !benchIds.has(p.id))
    .filter((p) => matches(`${p.fullName} ${p.number} ${p.position}`, query))
    .sort((a, b) => POSITION_ORDER.indexOf(a.position) - POSITION_ORDER.indexOf(b.position) || overall(b) - overall(a) || compareAz(a.fullName, b.fullName))

  const applyDrop = useCallback((src: DragSource, dst: DropTarget) => {
    update((l) => {
      const slots = { ...l.slots }
      const bench = [...l.bench]
      const customPos = { ...(l.customPos ?? {}) }
      const playerOf = (s: DragSource) => (s.type === 'slot' ? slots[s.slotId] : s.playerId)
      const pid = playerOf(src)
      if (!pid && src.type !== 'slot') return l
      if (src.type === 'slot') {
        if (dst.type === 'slot') {
          if (dst.slotId === src.slotId) return l
          const a = slots[src.slotId]
          const b = slots[dst.slotId]
          if (b) slots[src.slotId] = b
          else delete slots[src.slotId]
          if (a) slots[dst.slotId] = a
          else delete slots[dst.slotId]
        } else if (dst.type === 'pitch') {
          customPos[src.slotId] = { x: Math.round(dst.x), y: Math.round(dst.y) }
          return { ...l, customPos }
        } else if (dst.type === 'bench') {
          const out = slots[src.slotId]
          const inn = bench[dst.index]
          if (!out) return l
          if (inn) {
            slots[src.slotId] = inn
            bench[dst.index] = out
          } else if (bench.length < BENCH_SIZE) {
            delete slots[src.slotId]
            bench.push(out)
          }
        } else if (dst.type === 'reserve') {
          delete slots[src.slotId]
        }
      } else if (src.type === 'bench') {
        if (dst.type === 'slot') {
          const out = slots[dst.slotId]
          slots[dst.slotId] = src.playerId
          if (out) bench[src.index] = out
          else bench.splice(src.index, 1)
        } else if (dst.type === 'bench') {
          if (dst.index >= bench.length) return l
          ;[bench[src.index], bench[dst.index]] = [bench[dst.index], bench[src.index]]
        } else if (dst.type === 'reserve') {
          bench.splice(src.index, 1)
        }
      } else if (src.type === 'reserve') {
        const p = byId.get(src.playerId)
        if (!p || p.status !== 'available') return l
        if (dst.type === 'slot') slots[dst.slotId] = src.playerId
        else if (dst.type === 'bench') {
          if (dst.index < bench.length) bench[dst.index] = src.playerId
          else if (bench.length < BENCH_SIZE) bench.push(src.playerId)
        }
      }
      return { ...l, slots, bench, customPos }
    })
    setSelected(null)
  }, [update, byId])

  const onTap = useCallback((src: DragSource) => {
    setSelected((cur) => {
      if (!cur) return src
      const same = JSON.stringify(cur) === JSON.stringify(src)
      if (same) return null
      const dst: DropTarget = src.type === 'slot' ? { type: 'slot', slotId: src.slotId } : src.type === 'bench' ? { type: 'bench', index: src.index } : { type: 'reserve' }
      // tapping a reserve while a reserve is selected just changes the selection
      if (cur.type === 'reserve' && src.type === 'reserve') return src
      queueMicrotask(() => applyDrop(cur, dst))
      return null
    })
  }, [applyDrop])

  const { start, ghostEl } = useDragDrop(applyDrop, onTap)
  const issues = validateLineup(lineup, players)
  const ratings = teamRatings(lineup, players)
  const xiPlayers = players.filter((p) => xiIds.has(p.id))

  // every valid change is saved automatically (no "Save" button to forget)
  const playable = issues.every((i) => i.code === 'no_gk')
  const { saveLineup } = store
  useEffect(() => {
    if (!dirty || !playable) return
    const id = window.setTimeout(async () => {
      setSaving(true)
      try {
        await saveLineup(lineup)
        setDirty(false)
      } catch {
        /* friendly toast already shown; keep dirty so the next change retries */
      } finally {
        setSaving(false)
      }
    }, 500)
    return () => window.clearTimeout(id)
  }, [lineup, dirty, playable, saveLineup])
  const returnToMatch = readSession('azpfl.returnTo') === 'quick'

  const setTactics = (k: keyof Tactics, v: string) => update((l) => ({ ...l, tactics: { ...l.tactics, [k]: v } }))
  const issueText = (code: string, pid?: string) => t(`issue.${code}`, { player: pid ? byId.get(pid)?.fullName ?? pid : '' })
  const isSel = (s: DragSource) => !!selected && JSON.stringify(selected) === JSON.stringify(s)

  const benchRow = (p: Player | undefined, index: number): ReactNode => {
    const src: DragSource | null = p ? { type: 'bench', index, playerId: p.id } : null
    return (
      <div
        key={p?.id ?? `empty-${index}`}
        data-drop={`bench:${index}`}
        onPointerDown={src ? (e) => start(e, src, <Token player={p} club={club} small />) : undefined}
        onClick={!src && selected ? () => applyDrop(selected, { type: 'bench', index }) : undefined}
        className={clsx(
          'flex min-h-12 items-center gap-3 rounded-xl border px-2.5 py-1.5 text-sm transition-colors',
          src ? 'cursor-grab border-line bg-surface-2 active:cursor-grabbing' : 'border-dashed border-line text-faint',
          src && isSel(src) && 'border-accent bg-accent/10',
        )}
        style={{ touchAction: 'none' }}
      >
        {p ? (
          <>
            <span className="w-6 text-center font-bold tabular text-muted">{p.number}</span>
            <span className="min-w-0 flex-1 truncate">{p.fullName}</span>
            <Badge>{p.position}</Badge>
            <RatingPill value={overall(p)} />
          </>
        ) : (
          <span className="text-xs">{t('squad.emptyBench')}</span>
        )}
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        icon={<Users size={22} />}
        title={t('nav.squad')}
        subtitle={t('squad.subtitle')}
        action={
          <>
            <Button onClick={() => update(() => autoLineup(clubId, players, lineup.formation, lineup.tactics))}>
              <Sparkles size={16} /> {t('squad.autoPick')}
            </Button>
            <Button onClick={() => { setLineup(autoLineup(clubId, players, '4-3-3')); setDirty(true); setSelected(null) }}>
              <RotateCcw size={16} /> {t('squad.reset')}
            </Button>
            {returnToMatch && (
              <Button variant="primary" disabled={!playable} onClick={() => { writeSession('azpfl.returnTo', null); navigate({ page: 'quick' }) }}>
                <ArrowLeft size={16} /> {t('squad.backToMatch')}
              </Button>
            )}
          </>
        }
      />

      <div className="mb-5 flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {store.clubs.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => {
              if (!playable && !window.confirm(t('squad.discard'))) return
              navigate({ page: 'squad', clubId: c.id })
            }}
            className={clsx('flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium', c.id === clubId ? 'border-accent bg-accent/10 text-fg' : 'border-line text-muted hover:text-fg')}
          >
            <Crest club={c} size={22} />
            {c.shortName}
          </button>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,400px)]">
        <div className="grid gap-5 md:grid-cols-[minmax(0,460px)_minmax(0,1fr)]">
          <div className="mx-auto w-full max-w-[460px]">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Crest club={club} size={30} />
                <div className="font-display font-semibold">{club.name}</div>
              </div>
              {!playable ? <Badge tone="warning">{t('squad.notSaved')}</Badge> : saving || dirty ? <Badge>{t('squad.saving')}</Badge> : <Badge tone="accent"><Check size={12} /> {t('squad.savedAuto')}</Badge>}
            </div>
            <LineupPitch lineup={lineup} players={players} club={club} selectedSlot={selected?.type === 'slot' ? selected.slotId : null} onSlotPointerDown={(e, slotId, label) => start(e, { type: 'slot', slotId }, label)} />
            <p className="mt-2 text-xs text-muted">{t('squad.hint')}</p>
          </div>

          <div className="space-y-4">
            <Card>
              <div className="mb-3 text-sm font-semibold">{t('squad.formation')}</div>
              <div className="grid grid-cols-3 gap-2">
                {FORMATION_CODES.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => update((l) => changeFormation(l, f as FormationCode, players))}
                    className={clsx('rounded-xl border px-2 py-2 font-mono text-sm font-bold tabular', lineup.formation === f ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface-2 hover:border-accent/50')}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </Card>

            <Card>
              <div className="mb-3 text-sm font-semibold">{t('squad.tactics')}</div>
              <div className="space-y-3 text-sm">
                {(['mentality', 'pressing', 'tempo'] as const).map((k) => (
                  <div key={k} className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-muted">{t(`tactics.${k}`)}</span>
                    <Segmented
                      size="sm"
                      value={lineup.tactics[k] as string}
                      onChange={(v) => setTactics(k, v)}
                      options={(k === 'mentality' ? ['defensive', 'balanced', 'attacking'] : k === 'pressing' ? ['low', 'medium', 'high'] : ['slow', 'normal', 'fast']).map((v) => ({ value: v, label: t(`tactics.${k}.${v}`) }))}
                    />
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <div className="mb-3 text-sm font-semibold">{t('squad.duties')}</div>
              <div className="grid grid-cols-2 gap-3">
                {([['captainId', 'squad.captain'], ['penaltyTakerId', 'squad.penalties'], ['freeKickTakerId', 'squad.freeKicks'], ['cornerTakerId', 'squad.corners']] as const).map(([k, label]) => (
                  <Select key={k} label={t(label)} value={lineup[k] ?? ''} onChange={(e) => update((l) => ({ ...l, [k]: e.target.value || null }))}>
                    {xiPlayers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.number}. {p.fullName}
                      </option>
                    ))}
                  </Select>
                ))}
              </div>
            </Card>

            <Card>
              <div className="mb-3 flex items-center justify-between text-sm font-semibold">
                {t('squad.strength')}
                <RatingPill value={ratings.overall} />
              </div>
              <div className="space-y-2.5 text-sm">
                {(['att', 'mid', 'def', 'gk'] as const).map((k) => (
                  <div key={k} className="grid grid-cols-[90px_1fr_32px] items-center gap-3">
                    <span className="text-muted">{t(`rating.${k}`)}</span>
                    <Bar value={ratings[k]} />
                    <span className="text-right font-semibold tabular">{ratings[k]}</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[11px] text-faint">{t('rating.disclaimer')}</p>
            </Card>

            <Card className={issues.length ? 'border-warning/40' : 'border-accent/30'}>
              {issues.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-accent">
                  <CheckCircle2 size={18} /> {t('squad.valid')}
                </div>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {issues.map((i, n) => (
                    <li key={n} className="flex items-start gap-2 text-warning">
                      <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {issueText(i.code, i.playerId)}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>

        <div className="space-y-4">
          <Card>
            <div className="mb-3 flex items-center justify-between text-sm font-semibold">
              {t('squad.bench')} <span className="text-muted tabular">{lineup.bench.length}/{BENCH_SIZE}</span>
            </div>
            <div className="space-y-1.5">
              {lineup.bench.map((id, i) => benchRow(byId.get(id), i))}
              {lineup.bench.length < BENCH_SIZE && benchRow(undefined, lineup.bench.length)}
            </div>
          </Card>
          <Card data-drop="reserve">
            <div className="mb-3 flex items-center justify-between gap-2 text-sm font-semibold">
              {t('squad.reserves')} <span className="text-muted tabular">{reserves.length}</span>
            </div>
            <div className="relative mb-3">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
              <Input placeholder={t('common.search')} value={query} onChange={(e) => setQuery(e.target.value)} className="[&_input]:pl-9" />
            </div>
            <div className="max-h-[420px] space-y-1.5 overflow-y-auto pr-1 scrollbar-thin">
              {reserves.map((p) => {
                const src: DragSource = { type: 'reserve', playerId: p.id }
                const available = p.status === 'available'
                return (
                  <div
                    key={p.id}
                    onPointerDown={available ? (e) => start(e, src, <Token player={p} club={club} small />) : undefined}
                    className={clsx('flex items-center gap-3 rounded-xl border px-2.5 py-1.5 text-sm', available ? 'cursor-grab border-line bg-surface-2' : 'cursor-not-allowed border-line opacity-50', isSel(src) && 'border-accent bg-accent/10')}
                    style={{ touchAction: 'none' }}
                  >
                    <span className="w-6 text-center font-bold tabular text-muted">{p.number}</span>
                    <span className="min-w-0 flex-1 truncate">{p.fullName}</span>
                    {!available && <Badge tone="danger">{t(`status.${p.status}`)}</Badge>}
                    <Badge>{p.position}</Badge>
                    <RatingPill value={overall(p)} />
                  </div>
                )
              })}
              {reserves.length === 0 && <p className="py-4 text-center text-sm text-faint">{t('common.nothing')}</p>}
            </div>
            {players.some((p) => p.isPlaceholder) && <p className="mt-3 text-[11px] text-warning">{t('players.placeholderNote')}</p>}
          </Card>
        </div>
      </div>
      {ghostEl}
    </div>
  )
}
