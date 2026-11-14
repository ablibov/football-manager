import { Download, Languages, Save, Scale, Settings as SettingsIcon, Upload } from 'lucide-react'
import { useRef } from 'react'
import { Button, Card, PageHeader, Segmented, Select, Toggle } from '../components/ui'
import type { Lang } from '../data/types'
import { LANG_NAMES, useT } from '../i18n'
import { downloadJson, readFileJson } from '../lib/storage'
import { useStore } from '../store/context'

export function Settings() {
  const t = useT()
  const store = useStore()
  const { settings } = store
  const savesFile = useRef<HTMLInputElement>(null)

  const exportSaves = () => downloadJson(`azpfl-saves-${new Date().toISOString().slice(0, 10)}.json`, { schema: 'azpfl.saves/1', exportedAt: new Date().toISOString(), saves: store.saves, matches: store.matches, lineups: store.lineups })

  const importSaves = async (file: File) => {
    try {
      const data = (await readFileJson(file)) as { schema?: string; saves?: unknown[]; lineups?: Record<string, unknown> }
      if (data.schema !== 'azpfl.saves/1' || !Array.isArray(data.saves)) throw new Error('import.badSaves')
      let n = 0
      for (const s of data.saves as Parameters<typeof store.putSave>[0][]) {
        if (!s || (s.kind !== 'league' && s.kind !== 'cup') || !s.data) continue
        await store.putSave({ ...s, id: '' })
        n++
      }
      for (const l of Object.values(data.lineups ?? {}) as Parameters<typeof store.saveLineup>[0][]) {
        if (l?.clubId && store.club(l.clubId)) await store.saveLineup(l).catch(() => undefined)
      }
      store.toast('ok', t('import.savesDone', { n }))
    } catch (e) {
      console.error('Caspian Match Simulator:', e)
      store.toast('error', 'import.badSaves')
    }
  }


  return (
    <div>
      <PageHeader icon={<SettingsIcon size={22} />} title={t('nav.settings')} subtitle={t('settings.subtitle')} />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <div className="mb-4 flex items-center gap-2 font-semibold"><Languages size={18} /> {t('settings.interface')}</div>
          <div className="space-y-4">
            <div>
              <div className="mb-1.5 text-xs font-medium text-muted">{t('settings.language')}</div>
              <Segmented value={settings.lang} onChange={(v) => store.setSettings({ lang: v as Lang })} options={(['az', 'ru', 'en'] as Lang[]).map((l) => ({ value: l, label: LANG_NAMES[l] }))} />
            </div>
            <div>
              <div className="mb-1.5 text-xs font-medium text-muted">{t('settings.theme')}</div>
              <Segmented value={settings.theme} onChange={(v) => store.setSettings({ theme: v })} options={[{ value: 'dark', label: t('settings.dark') }, { value: 'light', label: t('settings.light') }]} />
            </div>
            <Select label={t('settings.speed')} value={settings.defaultSpeed} onChange={(e) => store.setSettings({ defaultSpeed: Number(e.target.value) })}>
              {[1, 2, 4, 8, 16].map((s) => <option key={s} value={s}>{s}×</option>)}
            </Select>
            <Toggle checked={settings.weatherEnabled} onChange={(v) => store.setSettings({ weatherEnabled: v })} label={t('settings.weather')} />
          </div>
        </Card>

        <Card>
          <div className="mb-4 flex items-center gap-2 font-semibold"><Save size={18} /> {t('settings.progress')}</div>
          <p className="text-sm text-muted">{store.online ? t('settings.progressOnline') : t('settings.progressOffline')}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={exportSaves}><Download size={15} /> {t('settings.exportSaves')}</Button>
            <Button onClick={() => savesFile.current?.click()}><Upload size={15} /> {t('settings.importSaves')}</Button>
            <input ref={savesFile} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void importSaves(f); e.target.value = '' }} />
          </div>
          <p className="mt-2 text-xs text-muted">{t('settings.backupHint')}</p>
          <div className="mt-4 border-t border-line pt-4">
            <Button variant="danger" onClick={async () => { if (window.confirm(t('settings.resetConfirm')) && (await store.deleteMyData())) store.toast('ok', 'settings.deleted') }}>{t('settings.resetLocal')}</Button>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <div className="mb-2 flex items-center gap-2 font-semibold"><Scale size={18} /> {t('settings.legal')}</div>
          <p className="text-sm text-muted">{t('legal.disclaimer')}</p>
          <div className="mt-3 flex gap-4 text-sm"><a className="text-accent hover:underline" href="#/about">{t('nav.about')}</a><a className="text-accent hover:underline" href="#/privacy">{t('nav.privacy')}</a></div>
        </Card>
      </div>
    </div>
  )
}
