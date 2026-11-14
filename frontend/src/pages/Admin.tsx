import { Database, Download, Image, KeyRound, LogOut, RefreshCw, ShieldCheck, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { Badge, Button, Card, Input, PageHeader, Select, Toggle } from '../components/ui'
import { useT } from '../i18n'
import { downloadJson, readFileJson } from '../lib/storage'
import { useStore } from '../store/context'

/** Admin tools (not linked in the navigation): real-data maintenance and the media registry. */
export function Admin() {
  const t = useT()
  const store = useStore()
  const datasetFile = useRef<HTMLInputElement>(null)
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')

  const importDataset = async (file: File) => {
    try {
      const data = await readFileJson(file)
      if (await store.importDataset(data)) store.toast('ok', 'import.datasetDone')
    } catch (e) {
      console.error('Caspian Match Simulator:', e)
      store.toast('error', 'import.badDataset')
    }
  }

  return (
    <div>
      <PageHeader icon={<ShieldCheck size={22} />} title={t('admin.title')} subtitle={t('admin.subtitle')} />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <div className="mb-4 flex items-center gap-2 font-semibold"><Database size={18} /> {t('settings.backend')}</div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge tone={store.online ? 'accent' : 'warning'}>{store.online ? t('status.online') : t('status.offline')}</Badge>
            {store.staff && <Badge tone="info">{t('settings.admin')}</Badge>}
            {store.localEdits && <Badge tone="warning">{t('settings.localEdits')}</Badge>}
            <Button size="sm" variant="ghost" onClick={() => store.refresh()}><RefreshCw size={14} /> {t('settings.reconnect')}</Button>
          </div>
          <p className="mt-2 text-xs text-muted">{store.online ? t('status.online.long') : t('status.offline.long')}</p>
          <div className="mt-4 border-t border-line pt-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><KeyRound size={16} /> {t('settings.adminLogin')}</div>
            {store.username ? (
              <div className="flex items-center justify-between gap-2 text-sm">
                <span>{t('settings.loggedIn', { user: store.username })}</span>
                <Button size="sm" onClick={store.logout}><LogOut size={14} /> {t('settings.logout')}</Button>
              </div>
            ) : (
              <form className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end" onSubmit={async (e) => { e.preventDefault(); if (await store.login(user, pass)) { setPass(''); store.toast('ok', 'settings.loginOk') } }}>
                <Input label={t('settings.username')} value={user} onChange={(e) => setUser(e.target.value)} autoComplete="username" />
                <Input label={t('settings.password')} type="password" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="current-password" />
                <Button type="submit" disabled={!store.online || !user || !pass}>{t('settings.login')}</Button>
              </form>
            )}
            <p className="mt-2 text-[11px] text-faint">{t('settings.adminHint')}</p>
          </div>
        </Card>

        <Card>
          <div className="mb-4 flex items-center gap-2 font-semibold"><Download size={18} /> {t('settings.data')}</div>
          <div className="space-y-3 text-sm">
            <div className="flex flex-wrap gap-2">
              <Button onClick={async () => downloadJson(`azpfl-dataset-${store.dataset.season.id}.json`, await store.exportDataset())}><Download size={15} /> {t('settings.exportDataset')}</Button>
              <Button onClick={() => datasetFile.current?.click()}><Upload size={15} /> {t('settings.importDataset')}</Button>
              <input ref={datasetFile} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void importDataset(f); e.target.value = '' }} />
            </div>
            <p className="text-xs text-muted">{t('settings.datasetHint')}</p>
          </div>
        </Card>

        <MediaRegistry />

        <MediaRegistry />
      </div>
    </div>
  )
}

function MediaRegistry() {
  const t = useT()
  const store = useStore()
  const [kind, setKind] = useState('crest')
  const [clubId, setClubId] = useState(store.clubs[0]?.id ?? '')
  const [rightsHolder, setRightsHolder] = useState('')
  const [license, setLicense] = useState('')
  const [permission, setPermission] = useState('pending')
  const [sourceUrl, setSourceUrl] = useState('')
  const [file, setFile] = useState<File | null>(null)

  const upload = async () => {
    if (!file) return
    const f = new FormData()
    f.append('kind', kind)
    f.append('clubId', clubId)
    f.append('file', file)
    f.append('rightsHolder', rightsHolder)
    f.append('license', license)
    f.append('permissionStatus', permission)
    if (sourceUrl) f.append('sourceUrl', sourceUrl)
    if (await store.uploadMedia(f)) {
      store.toast('ok', 'media.uploaded')
      setFile(null)
    }
  }

  return (
    <Card>
      <div className="mb-3 flex items-center gap-2 font-semibold"><Image size={18} /> {t('media.title')}</div>
      <p className="text-xs text-muted">{t('media.policy')}</p>
      {store.staff ? (
        <>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Select label={t('media.kind')} value={kind} onChange={(e) => setKind(e.target.value)}>
              {['crest', 'kit_home', 'kit_away'].map((k) => <option key={k} value={k}>{t(`media.kind.${k}`)}</option>)}
            </Select>
            <Select label={t('table.club')} value={clubId} onChange={(e) => setClubId(e.target.value)}>
              {store.clubs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <Input label={t('media.rightsHolder')} value={rightsHolder} onChange={(e) => setRightsHolder(e.target.value)} />
            <Input label={t('media.license')} value={license} onChange={(e) => setLicense(e.target.value)} />
            <Select label={t('media.permission')} value={permission} onChange={(e) => setPermission(e.target.value)}>
              {['pending', 'confirmed', 'unknown', 'denied'].map((k) => <option key={k} value={k}>{t(`media.perm.${k}`)}</option>)}
            </Select>
            <Input label={t('media.sourceUrl')} value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://" />
            <Input label={t('media.file')} type="file" accept="image/png,image/webp,image/svg+xml" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="sm:col-span-2 [&_input]:pt-2" />
          </div>
          <Button className="mt-3" variant="primary" onClick={upload} disabled={!file || !rightsHolder || !license}><Upload size={15} /> {t('media.upload')}</Button>
          <div className="mt-4 space-y-1.5">
            {store.media.map((m) => (
              <div key={m.id} className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2 text-sm">
                {m.url && <img src={m.url} alt="" className="h-8 w-8 object-contain" />}
                <div className="min-w-0 flex-1">
                  <div className="truncate">{store.club(m.clubId ?? '')?.shortName} · {t(`media.kind.${m.kind}`)}</div>
                  <div className="truncate text-xs text-muted">{m.rightsHolder} · {m.license}</div>
                </div>
                <Badge tone={m.permissionStatus === 'confirmed' ? 'accent' : 'warning'}>{t(`media.perm.${m.permissionStatus}`)}</Badge>
                <Toggle checked={m.enabled} onChange={(v) => store.updateMedia(m.id, { enabled: v })} label="" />
              </div>
            ))}
            {store.media.length === 0 && <p className="text-xs text-faint">{t('media.none')}</p>}
          </div>
        </>
      ) : (
        <p className="mt-3 text-sm text-muted">{t('media.adminOnly')}</p>
      )}
    </Card>
  )
}
