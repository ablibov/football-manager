import { AnimatePresence, motion } from 'framer-motion'
import { BarChart3, CloudCheck, HardDrive, Info, RefreshCw, LayoutDashboard, Menu, MonitorPlay, Settings, Shield, Swords, Trophy, Users, X, Zap } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useT } from '../i18n'
import { href, type Route } from '../lib/router'
import { clsx } from '../lib/text'
import { useStore } from '../store/context'

const NAV: { page: Route['page']; key: string; icon: ReactNode }[] = [
  { page: 'dashboard', key: 'nav.dashboard', icon: <LayoutDashboard size={18} /> },
  { page: 'quick', key: 'nav.quick', icon: <Zap size={18} /> },
  { page: 'clubs', key: 'nav.clubs', icon: <Shield size={18} /> },
  { page: 'squad', key: 'nav.squad', icon: <Users size={18} /> },
  { page: 'match', key: 'nav.match', icon: <MonitorPlay size={18} /> },
  { page: 'league', key: 'nav.league', icon: <Trophy size={18} /> },
  { page: 'cup', key: 'nav.cup', icon: <Swords size={18} /> },
  { page: 'stats', key: 'nav.stats', icon: <BarChart3 size={18} /> },
  { page: 'settings', key: 'nav.settings', icon: <Settings size={18} /> },
  { page: 'about', key: 'nav.about', icon: <Info size={18} /> },
]

const MOBILE = ['dashboard', 'quick', 'squad', 'league', 'match']

function Logo() {
  return (
    <a href="#/" className="flex items-center gap-2.5">
      <div className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-accent-ink shadow-[0_6px_24px_-8px_var(--accent)]">
        <svg viewBox="0 0 64 64" width="22" height="22" aria-hidden="true">
          <path d="M10 40c7-6 13-6 20 0s13 6 20 0" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
          <path d="M10 26c7-6 13-6 20 0s13 6 20 0" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" opacity=".45" />
        </svg>
      </div>
      <div className="leading-tight">
        <div className="font-display text-lg font-bold tracking-tight">Caspian</div>
        <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-faint">Match Simulator</div>
      </div>
    </a>
  )
}

export function Layout({ route, children }: { route: Route; children: ReactNode }) {
  const t = useT()
  const { online, ready, toasts, dismissToast, pending, refresh } = useStore()
  const [retrying, setRetrying] = useState(false)
  const [open, setOpen] = useState(false)

  const link = (n: (typeof NAV)[number], onClick?: () => void) => {
    const active = route.page === n.page
    return (
      <a
        key={n.page}
        href={href({ page: n.page } as Route)}
        onClick={onClick}
        aria-current={active ? 'page' : undefined}
        className={clsx(
          'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
          active ? 'bg-accent/12 text-accent' : 'text-muted hover:bg-surface-2 hover:text-fg',
        )}
      >
        {n.icon}
        <span className="truncate">{t(n.key)}</span>
        {n.page === 'match' && pending && <span className="ml-auto h-2 w-2 rounded-full bg-accent animate-pulse" />}
      </a>
    )
  }

  return (
    <div className="min-h-screen bg-bg">
      {/* desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-elev/80 px-4 py-5 backdrop-blur lg:flex">
        <Logo />
        <nav className="mt-8 flex flex-col gap-1">{NAV.map((n) => link(n))}</nav>
        <div className="mt-auto space-y-3">
          <Status online={online} />
          <p className="text-[11px] leading-relaxed text-faint">{t('legal.short')}</p>
        </div>
      </aside>

      {/* mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-elev/90 px-4 py-3 backdrop-blur lg:hidden">
        <Logo />
        <div className="flex items-center gap-2">
          <Status online={online} compact />
          <button type="button" className="rounded-xl p-2 text-muted hover:bg-surface-2" onClick={() => setOpen(true)} aria-label={t('nav.menu')}>
            <Menu size={22} />
          </button>
        </div>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-40 bg-black/60 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)}>
            <motion.nav
              className="absolute right-0 top-0 flex h-full w-72 max-w-[85vw] flex-col gap-1 border-l border-line bg-elev p-4"
              initial={{ x: 300 }}
              animate={{ x: 0 }}
              exit={{ x: 300 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <Logo />
                <button type="button" className="rounded-lg p-2 text-muted" onClick={() => setOpen(false)} aria-label="Close">
                  <X size={20} />
                </button>
              </div>
              {NAV.map((n) => link(n, () => setOpen(false)))}
              <p className="mt-auto text-[11px] leading-relaxed text-faint">{t('legal.short')}</p>
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="pb-24 lg:pb-10 lg:pl-64">
        <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {ready && !online && (
            <div role="status" className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
              <HardDrive size={18} className="shrink-0 text-warning" />
              <span className="min-w-0 flex-1">{t('offline.banner')}</span>
              <button
                type="button"
                disabled={retrying}
                onClick={async () => { setRetrying(true); await refresh(); setRetrying(false) }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-warning/40 px-3 py-1.5 text-xs font-semibold text-warning hover:bg-warning/10 disabled:opacity-50"
              >
                <RefreshCw size={13} className={retrying ? 'animate-spin' : ''} /> {t('offline.retry')}
              </button>
            </div>
          )}
          {children}
        </div>
        <footer className="mx-auto max-w-7xl border-t border-line px-4 pt-5 pb-6 text-xs leading-relaxed text-faint sm:px-6 lg:px-8">
          <p>{t('legal.disclaimer')}</p>
          <nav className="mt-2 flex flex-wrap gap-x-4 gap-y-1" aria-label={t('nav.about')}>
            <a href="#/about" className="hover:text-fg">{t('nav.about')}</a>
            <a href="#/privacy" className="hover:text-fg">{t('nav.privacy')}</a>
            <span>© {new Date().getFullYear()} Caspian Match Simulator</span>
          </nav>
        </footer>
      </main>

      {/* mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-elev/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {NAV.filter((n) => MOBILE.includes(n.page)).map((n) => (
          <a key={n.page} href={href({ page: n.page } as Route)} className={clsx('flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium', route.page === n.page ? 'text-accent' : 'text-muted')}>
            {n.icon}
            <span className="max-w-full truncate px-1">{t(n.key + '.short')}</span>
          </a>
        ))}
      </nav>

      <div className="pointer-events-none fixed bottom-20 right-4 z-50 flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2 lg:bottom-6">
        <AnimatePresence>
          {toasts.map((x) => (
            <motion.button
              type="button"
              key={x.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: 40 }}
              onClick={() => dismissToast(x.id)}
              className={clsx(
                'pointer-events-auto rounded-xl border px-4 py-3 text-left text-sm shadow-xl backdrop-blur',
                x.kind === 'ok' && 'border-accent/40 bg-accent/15 text-fg',
                x.kind === 'error' && 'border-danger/40 bg-danger/15 text-fg',
                x.kind === 'info' && 'border-line bg-elev text-fg',
              )}
            >
              {t(x.text)}
            </motion.button>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}

function Status({ online, compact }: { online: boolean; compact?: boolean }) {
  const t = useT()
  return (
    <div
      title={online ? t('status.online.long') : t('status.offline.long')}
      className={clsx('flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium', online ? 'border-accent/30 text-accent' : 'border-warning/40 text-warning')}
    >
      {online ? <CloudCheck size={15} /> : <HardDrive size={15} />}
      {!compact && <span>{online ? t('status.online') : t('status.offline')}</span>}
    </div>
  )
}
