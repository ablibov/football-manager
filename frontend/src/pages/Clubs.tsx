import { ArrowLeft, ArrowRightLeft, Info, MapPin, Pencil, Plus, Search, Shield, Trash2, UserRound, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Crest, FormDots, Kit } from '../components/Crest'
import { Badge, Bar, Button, Card, Empty, Input, Modal, PageHeader, RatingPill, Select } from '../components/ui'
import { overall, POSITION_ORDER } from '../engine/ratings'
import type { Club, Player, PlayerStatus, Position } from '../engine/types'
import { useT } from '../i18n'
import { realForm, realStandings, teamRatings } from '../lib/football'
import { navigate } from '../lib/router'
import { clsx, compareAz, matches } from '../lib/text'
import { useStore } from '../store/context'

export function Clubs({ clubId }: { clubId?: string }) {
  const store = useStore()
  if (clubId) {
    const c = store.club(clubId)
    if (c) return <ClubDetail club={c} />
  }
  return <ClubList />
}

function ClubList() {
  const t = useT()
  const store = useStore()
  const [q, setQ] = useState('')
  const form = useMemo(() => realForm(store.dataset), [store.dataset])
  const table = useMemo(() => new Map(realStandings(store.dataset).map((r) => [r.clubId, r])), [store.dataset])
  const clubs = store.clubs.filter((c) => matches(`${c.name} ${c.city} ${c.code}`, q)).sort((a, b) => compareAz(a.name, b.name))
  return (
    <div>
      <PageHeader
        icon={<Shield size={22} />}
        title={t('nav.clubs')}
        subtitle={t('clubs.subtitle', { n: store.clubs.length, season: store.dataset.season.name })}
        action={
          <div className="relative w-full sm:w-64">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-faint" />
            <Input placeholder={t('common.search')} value={q} onChange={(e) => setQ(e.target.value)} className="[&_input]:pl-9" aria-label={t('common.search')} />
          </div>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {clubs.map((c) => {
          const r = teamRatings(store.lineupFor(c.id), store.clubPlayers(c.id))
          const row = table.get(c.id)
          return (
            <a key={c.id} href={`#/clubs/${c.id}`} className="group relative overflow-hidden rounded-2xl border border-line bg-surface p-5 transition-colors hover:border-accent/50">
              <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full opacity-25 blur-3xl transition-opacity group-hover:opacity-40" style={{ background: c.colors.primary }} />
              <div className="relative flex items-start gap-4">
                <Crest club={c} size={56} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-display text-lg font-semibold">{c.name}</div>
                  <div className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted"><MapPin size={12} /> {c.city}</div>
                  <div className="mt-0.5 truncate text-xs text-muted">{c.stadium.name ?? t('club.stadiumTbd')}</div>
                </div>
                <RatingPill value={r.overall} />
              </div>
              <div className="relative mt-4 grid grid-cols-4 gap-2 text-center">
                {(['att', 'mid', 'def', 'gk'] as const).map((k) => (
                  <div key={k} className="rounded-xl bg-surface-2 py-1.5">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-faint">{t(`rating.${k}.short`)}</div>
                    <div className="font-bold tabular">{r[k]}</div>
                  </div>
                ))}
              </div>
              <div className="relative mt-4 flex items-center justify-between gap-2">
                <FormDots form={form[c.id] ?? []} size="sm" />
                {row && <span className="text-xs text-muted tabular">{t('clubs.realPos', { pos: row.position, pts: row.points })}</span>}
              </div>
            </a>
          )
        })}
      </div>
      {clubs.length === 0 && <Empty title={t('common.nothing')} />}
    </div>
  )
}

const POSITIONS: Position[] = [...POSITION_ORDER]
const STATUSES: PlayerStatus[] = ['available', 'injured', 'suspended']


function newPlayer(club: Club, players: Player[]): Player {
  const used = new Set(players.map((p) => p.number))
  let n = 1
  while (used.has(n)) n++
  return {
    id: `${club.id}-${Date.now().toString(36)}`, clubId: club.id, fullName: '', shortName: '', number: n, birthDate: null, nationality: null,
    position: 'CM', secondary: [], heightCm: null, foot: null, status: 'available', attrs: { pac: 60, sho: 60, pas: 60, dri: 60, def: 60, phy: 60 },
    isPlaceholder: false, sourceId: null, updatedAt: new Date().toISOString().slice(0, 10),
  }
}

function SquadSource({ clubId, hasPlaceholders }: { clubId: string; hasPlaceholders: boolean }) {
  const t = useT()
  const { dataset } = useStore()
  const src = dataset.dataSources.find((s) => s.id === `wikipedia-squad-${clubId}`)
  const asOf = src?.notes.match(/as of (\d{4}-\d{2}-\d{2})/)?.[1]
  const summary = src?.notes.includes('spot-check')
  return (
    <div className={clsx('mb-4 flex gap-2 rounded-xl border p-3 text-xs', hasPlaceholders ? 'border-warning/40 bg-warning/10 text-warning' : 'border-line bg-surface-2 text-muted')}>
      <Info size={16} className="mt-0.5 shrink-0" />
      <div className="space-y-1">
        {hasPlaceholders ? <p>{t('players.placeholderBanner')}</p> : (
          <p>
            {t('squad.sourceNote', { date: asOf ?? '—' })}{' '}
            {src?.url && <a href={src.url} target="_blank" rel="noreferrer" className="text-accent hover:underline">Wikipedia</a>}
          </p>
        )}
        {summary && <p>{t('squad.sourceCaveat')}</p>}
        <p>{t('squad.ratingNote')}</p>
      </div>
    </div>
  )
}

function ClubDetail({ club }: { club: Club }) {
  const t = useT()
  const store = useStore()
  const players = store.clubPlayers(club.id)
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<'position' | 'number' | 'rating' | 'name'>('position')
  const [editing, setEditing] = useState<{ player: Player; isNew: boolean } | null>(null)
  const [transfer, setTransfer] = useState<Player | null>(null)
  const [editClub, setEditClub] = useState(false)
  const r = teamRatings(store.lineupFor(club.id), players)
  const form = realForm(store.dataset)[club.id] ?? []
  const source = store.dataset.dataSources.find((s) => s.id === club.sourceId)
  const list = players
    .filter((p) => matches(`${p.fullName} ${p.number} ${p.position} ${p.nationality ?? ''}`, q))
    .sort((a, b) =>
      sort === 'number' ? a.number - b.number : sort === 'rating' ? overall(b) - overall(a) : sort === 'name' ? compareAz(a.fullName, b.fullName) : POSITION_ORDER.indexOf(a.position) - POSITION_ORDER.indexOf(b.position) || a.number - b.number,
    )
  // real football data is maintained by admins only
  const canEdit = store.online && store.staff



  return (
    <div>
      <button type="button" onClick={() => navigate({ page: 'clubs' })} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
        <ArrowLeft size={16} /> {t('nav.clubs')}
      </button>
      <div className="relative mb-6 overflow-hidden rounded-3xl border border-line bg-elev p-5 sm:p-7">
        <div className="pointer-events-none absolute inset-0 opacity-30" style={{ background: `radial-gradient(circle at 15% 30%, ${club.colors.primary}, transparent 55%)` }} />
        <div className="relative flex flex-wrap items-center gap-5">
          <Crest club={club} size={96} />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl font-bold sm:text-3xl">{club.name}</h1>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
              <span className="inline-flex items-center gap-1.5"><MapPin size={14} /> {club.city}</span>
              <span>{club.stadium.name ?? t('club.stadiumTbd')}{club.stadium.capacity ? ` · ${club.stadium.capacity.toLocaleString()}` : ''}</span>
              <span className="inline-flex items-center gap-1.5"><UserRound size={14} /> {club.coach ? `${club.coach}${club.coachSince ? ` (${t('club.since', { date: club.coachSince })})` : ''}` : t('club.coachUnconfirmed')}</span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <FormDots form={form} />
              <span className="text-xs text-muted">{t('club.realForm')}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-center"><Kit club={club} variant="home" /><div className="text-[10px] text-muted">{t('club.kitHome')}</div></div>
            <div className="text-center"><Kit club={club} variant="away" /><div className="text-[10px] text-muted">{t('club.kitAway')}</div></div>
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 font-display font-semibold"><Users size={18} /> {t('club.squad')} <span className="text-sm font-normal text-muted">({players.length})</span></div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-44">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-faint" />
                <Input placeholder={t('common.search')} value={q} onChange={(e) => setQ(e.target.value)} className="[&_input]:h-9 [&_input]:pl-8" aria-label={t('common.search')} />
              </div>
              <Select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="[&_select]:h-9" aria-label={t('common.sort')}>
                {(['position', 'number', 'rating', 'name'] as const).map((s) => <option key={s} value={s}>{t(`sort.${s}`)}</option>)}
              </Select>
              {canEdit && <Button size="sm" variant="primary" onClick={() => setEditing({ player: newPlayer(club, players), isNew: true })}><Plus size={15} /> {t('players.add')}</Button>}
              <a href={`#/squad/${club.id}`}><Button size="sm">{t('nav.squad')}</Button></a>
            </div>
          </div>
          <SquadSource clubId={club.id} hasPlaceholders={players.some((p) => p.isPlaceholder)} />
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-faint">
                  <th className="py-2 pr-2">#</th>
                  <th className="py-2 pr-2">{t('players.name')}</th>
                  <th className="py-2 pr-2">{t('players.pos')}</th>
                  <th className="py-2 pr-2">{t('players.nat')}</th>
                  <th className="py-2 pr-2 text-center">PAC</th>
                  <th className="py-2 pr-2 text-center">SHO</th>
                  <th className="py-2 pr-2 text-center">PAS</th>
                  <th className="py-2 pr-2 text-center">DRI</th>
                  <th className="py-2 pr-2 text-center">DEF</th>
                  <th className="py-2 pr-2 text-center">PHY</th>
                  <th className="py-2 pr-2 text-center">{t('players.ovr')}</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {list.map((p) => (
                  <tr key={p.id} className="border-b border-line/50 last:border-0">
                    <td className="py-2 pr-2 font-bold tabular text-muted">{p.number}</td>
                    <td className="max-w-[220px] py-2 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{p.fullName}</span>
                        {p.isPlaceholder && <Badge tone="warning" title={t('players.placeholderNote')}>{t('players.placeholder')}</Badge>}
                        {p.status !== 'available' && <Badge tone="danger">{t(`status.${p.status}`)}</Badge>}
                      </div>
                    </td>
                    <td className="py-2 pr-2"><Badge>{p.position}</Badge>{p.secondary.length > 0 && <span className="ml-1 text-[10px] text-faint">{p.secondary.join('/')}</span>}</td>
                    <td className="py-2 pr-2 text-xs text-muted">{p.nationality ?? t('common.unconfirmed')}</td>
                    {p.gk ? (
                      <td colSpan={6} className="py-2 pr-2 text-center text-xs text-muted tabular">DIV {p.gk.div} · HAN {p.gk.han} · REF {p.gk.ref} · POS {p.gk.pos}</td>
                    ) : (
                      (['pac', 'sho', 'pas', 'dri', 'def', 'phy'] as const).map((k) => <td key={k} className="py-2 pr-2 text-center tabular">{p.attrs[k]}</td>)
                    )}
                    <td className="py-2 pr-2 text-center"><RatingPill value={overall(p)} /></td>
                    <td className="py-2 text-right">
                      {canEdit && (
                        <div className="flex justify-end gap-1">
                          <button type="button" className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-fg" onClick={() => setEditing({ player: p, isNew: false })} aria-label={t('common.edit')}><Pencil size={15} /></button>
                          <button type="button" className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-fg" onClick={() => setTransfer(p)} aria-label={t('players.transfer')}><ArrowRightLeft size={15} /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[11px] text-faint">{t('rating.disclaimer')}</p>
        </Card>

        <div className="space-y-4">
          <Card>
            <div className="mb-3 flex items-center justify-between font-semibold">{t('club.ratings')} <RatingPill value={r.overall} /></div>
            <div className="space-y-2.5 text-sm">
              {(['att', 'mid', 'def', 'gk'] as const).map((k) => (
                <div key={k} className="grid grid-cols-[90px_1fr_30px] items-center gap-3">
                  <span className="text-muted">{t(`rating.${k}`)}</span>
                  <Bar value={r[k]} />
                  <span className="text-right font-semibold tabular">{r[k]}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-faint">{t('club.ratingMethod', { prior: club.gameRating.prior, base: club.gameRating.base })}</p>
          </Card>
          <Card>
            <div className="mb-2 flex items-center justify-between font-semibold">
              {t('club.data')}
              {canEdit && <Button size="sm" variant="ghost" onClick={() => setEditClub(true)}><Pencil size={14} /> {t('common.edit')}</Button>}
            </div>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-muted">{t('club.short')}</dt><dd>{club.shortName} ({club.code})</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">{t('club.colors')}</dt><dd className="flex items-center gap-1.5"><span className="h-4 w-4 rounded" style={{ background: club.colors.primary }} /><span className="h-4 w-4 rounded border border-line" style={{ background: club.colors.secondary }} /></dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">{t('club.updated')}</dt><dd>{club.updatedAt}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">{t('club.source')}</dt><dd className="truncate text-right">{source?.url ? <a href={source.url} target="_blank" rel="noreferrer" className="text-accent hover:underline">{source.name}</a> : source?.name ?? '—'}</dd></div>
            </dl>
            {!club.colors.verified && <p className="mt-3 text-[11px] text-faint">{t('club.colorsNote')}</p>}
            <p className="mt-2 text-[11px] text-faint">{t('club.crestNote')}</p>
          </Card>
        </div>
      </div>

      {editing && <PlayerEditor key={editing.player.id} initial={editing.player} isNew={editing.isNew} onClose={() => setEditing(null)} />}
      {transfer && <TransferDialog player={transfer} onClose={() => setTransfer(null)} />}
      {editClub && <ClubEditor club={club} onClose={() => setEditClub(false)} />}
    </div>
  )
}

function PlayerEditor({ initial, isNew, onClose }: { initial: Player; isNew: boolean; onClose: () => void }) {
  const t = useT()
  const store = useStore()
  const [p, setP] = useState<Player>(initial)
  const [busy, setBusy] = useState(false)
  const clubmates = store.clubPlayers(p.clubId).filter((x) => x.id !== p.id)
  const numberClash = clubmates.some((x) => x.number === p.number)
  const valid = p.fullName.trim().length > 1 && p.number >= 1 && p.number <= 99 && !numberClash
  const set = <K extends keyof Player>(k: K, v: Player[K]) => setP((cur) => ({ ...cur, [k]: v }))
  const num = (v: string, min = 1, max = 99) => Math.max(min, Math.min(max, Math.round(Number(v) || min)))
  const save = async () => {
    setBusy(true)
    const clean: Player = { ...p, fullName: p.fullName.trim(), shortName: p.shortName.trim() || p.fullName.trim().split(/\s+/).slice(-1)[0] }
    if (clean.position === 'GK' && !clean.gk) clean.gk = { div: 60, han: 60, kic: 55, ref: 60, spd: 55, pos: 60 }
    if (clean.position !== 'GK') delete clean.gk
    const ok = await store.savePlayer(clean, isNew)
    setBusy(false)
    if (ok) {
      store.toast('ok', 'players.saved')
      onClose()
    }
  }
  const remove = async () => {
    if (!window.confirm(t('common.confirmDelete'))) return
    if (await store.deletePlayer(p.id)) onClose()
  }
  return (
    <Modal open onClose={onClose} title={isNew ? t('players.add') : t('players.edit')} wide>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label={t('players.fullName')} value={p.fullName} onChange={(e) => set('fullName', e.target.value)} autoFocus />
        <Input label={t('players.shortName')} value={p.shortName} onChange={(e) => set('shortName', e.target.value)} />
        <Input label={t('players.number')} type="number" min={1} max={99} value={p.number} onChange={(e) => set('number', num(e.target.value))} />
        <Select label={t('players.pos')} value={p.position} onChange={(e) => set('position', e.target.value as Position)}>
          {POSITIONS.map((x) => <option key={x}>{x}</option>)}
        </Select>
        <Input label={t('players.secondary')} placeholder="CM, AM" value={p.secondary.join(', ')} onChange={(e) => set('secondary', e.target.value.split(/[,\s]+/).map((s) => s.trim().toUpperCase()).filter((s): s is Position => POSITIONS.includes(s as Position)))} />
        <Select label={t('players.status')} value={p.status} onChange={(e) => set('status', e.target.value as PlayerStatus)}>
          {STATUSES.map((s) => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
        </Select>
        <Input label={t('players.nat')} value={p.nationality ?? ''} onChange={(e) => set('nationality', e.target.value || null)} />
        <Input label={t('players.birth')} type="date" value={p.birthDate ?? ''} onChange={(e) => set('birthDate', e.target.value || null)} />
        <Input label={t('players.height')} type="number" min={140} max={220} value={p.heightCm ?? ''} onChange={(e) => set('heightCm', e.target.value ? num(e.target.value, 140, 220) : null)} />
        <Select label={t('players.foot')} value={p.foot ?? ''} onChange={(e) => set('foot', (e.target.value || null) as Player['foot'])}>
          <option value="">{t('common.unconfirmed')}</option>
          {(['right', 'left', 'both'] as const).map((f) => <option key={f} value={f}>{t(`foot.${f}`)}</option>)}
        </Select>
      </div>
      <div className="mt-5 text-sm font-semibold">{t('players.attributes')}</div>
      <div className="mt-2 grid grid-cols-3 gap-3 sm:grid-cols-6">
        {(['pac', 'sho', 'pas', 'dri', 'def', 'phy'] as const).map((k) => (
          <Input key={k} label={k.toUpperCase()} type="number" min={1} max={99} value={p.attrs[k]} onChange={(e) => set('attrs', { ...p.attrs, [k]: num(e.target.value) })} />
        ))}
      </div>
      {p.position === 'GK' && (
        <>
          <div className="mt-4 text-sm font-semibold">{t('players.gkAttributes')}</div>
          <div className="mt-2 grid grid-cols-3 gap-3 sm:grid-cols-6">
            {(['div', 'han', 'kic', 'ref', 'spd', 'pos'] as const).map((k) => (
              <Input key={k} label={k.toUpperCase()} type="number" min={1} max={99} value={p.gk?.[k] ?? 60} onChange={(e) => set('gk', { div: 60, han: 60, kic: 55, ref: 60, spd: 55, pos: 60, ...p.gk, [k]: num(e.target.value) })} />
            ))}
          </div>
        </>
      )}
      <label className="mt-4 flex items-start gap-2 text-sm">
        <input type="checkbox" checked={p.isPlaceholder} onChange={(e) => set('isPlaceholder', e.target.checked)} className="mt-1" />
        <span>{t('players.isPlaceholder')}</span>
      </label>
      <div className="mt-3 flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2 text-sm">
        <span className="text-muted">{t('players.ovr')} ({t('rating.estimate')})</span>
        <RatingPill value={overall(p)} />
      </div>
      {numberClash && <p className="mt-2 text-sm text-danger">{t('players.numberTaken')}</p>}
      <div className="mt-5 flex flex-wrap justify-between gap-2">
        {!isNew ? <Button variant="danger" onClick={remove}><Trash2 size={15} /> {t('common.delete')}</Button> : <span />}
        <div className="flex gap-2">
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" onClick={save} disabled={!valid || busy}>{t('common.save')}</Button>
        </div>
      </div>
    </Modal>
  )
}

function TransferDialog({ player, onClose }: { player: Player; onClose: () => void }) {
  const t = useT()
  const store = useStore()
  const [to, setTo] = useState(store.clubs.find((c) => c.id !== player.clubId)?.id ?? '')
  const [number, setNumber] = useState(player.number)
  const taken = to ? store.clubPlayers(to).some((p) => p.number === number && p.id !== player.id) : false
  const go = async () => {
    if (await store.transferPlayer(player.id, to || null, number)) {
      store.toast('ok', 'players.transferred')
      onClose()
    }
  }
  return (
    <Modal open onClose={onClose} title={t('players.transferTitle', { player: player.fullName })}>
      <div className="grid gap-3">
        <Select label={t('players.toClub')} value={to} onChange={(e) => setTo(e.target.value)}>
          {store.clubs.filter((c) => c.id !== player.clubId).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          <option value="">{t('players.release')}</option>
        </Select>
        <Input label={t('players.number')} type="number" min={1} max={99} value={number} onChange={(e) => setNumber(Math.max(1, Math.min(99, Number(e.target.value) || 1)))} />
        {taken && <p className="text-sm text-danger">{t('players.numberTaken')}</p>}
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" onClick={go} disabled={taken}>{t('players.confirmTransfer')}</Button>
        </div>
      </div>
    </Modal>
  )
}

function ClubEditor({ club, onClose }: { club: Club; onClose: () => void }) {
  const t = useT()
  const store = useStore()
  const [c, setC] = useState<Club>(club)
  const save = async () => {
    if (await store.saveClub(c)) {
      store.toast('ok', 'club.saved')
      onClose()
    }
  }
  return (
    <Modal open onClose={onClose} title={t('club.edit')}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label={t('club.name')} value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} />
        <Input label={t('club.short')} value={c.shortName} onChange={(e) => setC({ ...c, shortName: e.target.value })} />
        <Input label={t('club.city')} value={c.city} onChange={(e) => setC({ ...c, city: e.target.value })} />
        <Input label={t('club.coach')} value={c.coach ?? ''} onChange={(e) => setC({ ...c, coach: e.target.value || null })} />
        <Input label={t('club.stadium')} value={c.stadium.name ?? ''} onChange={(e) => setC({ ...c, stadium: { ...c.stadium, name: e.target.value || null } })} />
        <Input label={t('club.capacity')} type="number" value={c.stadium.capacity ?? ''} onChange={(e) => setC({ ...c, stadium: { ...c.stadium, capacity: e.target.value ? Number(e.target.value) : null } })} />
        <Input label={t('club.primary')} type="color" value={c.colors.primary} onChange={(e) => setC({ ...c, colors: { ...c.colors, primary: e.target.value } })} className="[&_input]:p-1" />
        <Input label={t('club.secondary')} type="color" value={c.colors.secondary} onChange={(e) => setC({ ...c, colors: { ...c.colors, secondary: e.target.value } })} className="[&_input]:p-1" />
      </div>
      <div className={clsx('mt-5 flex justify-end gap-2')}>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="primary" onClick={save} disabled={!c.name.trim()}>{t('common.save')}</Button>
      </div>
    </Modal>
  )
}
