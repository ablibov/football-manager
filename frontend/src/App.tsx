import { ErrorBoundary } from './components/ErrorBoundary'
import { Layout } from './components/Layout'
import { useT } from './i18n'
import { useRoute } from './lib/router'
import { About, Privacy } from './pages/About'
import { Admin } from './pages/Admin'
import { Clubs } from './pages/Clubs'
import { Cup } from './pages/Cup'
import { Dashboard } from './pages/Dashboard'
import { League } from './pages/League'
import { MatchCenter } from './pages/MatchCenter'
import { QuickMatch } from './pages/QuickMatch'
import { Settings } from './pages/Settings'
import { SquadBuilder } from './pages/SquadBuilder'
import { Statistics } from './pages/Statistics'
import { useStore } from './store/context'

function Page() {
  const route = useRoute()
  const { ready } = useStore()
  const t = useT()
  let page
  switch (route.page) {
    case 'quick': page = <QuickMatch />; break
    case 'clubs': page = <Clubs clubId={route.clubId} />; break
    case 'squad': page = <SquadBuilder clubId={route.clubId} />; break
    case 'match': page = <MatchCenter matchId={route.matchId} />; break
    case 'league': page = <League />; break
    case 'cup': page = <Cup />; break
    case 'stats': page = <Statistics />; break
    case 'settings': page = <Settings />; break
    case 'admin': page = <Admin />; break
    case 'about': page = <About />; break
    case 'privacy': page = <Privacy />; break
    default: page = <Dashboard />
  }
  return (
    <Layout route={route}>
      {ready ? (
        <ErrorBoundary
          key={window.location.hash}
          fallback={(_error, reset) => (
            <div className="rounded-2xl border border-danger/40 bg-danger/10 p-6">
              <div className="font-display text-lg font-semibold">{t('error.title')}</div>
              <p className="mt-1 text-sm text-muted">{t('error.text')}</p>
              <button type="button" onClick={reset} className="mt-4 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-ink">{t('error.retry')}</button>
            </div>
          )}
        >
          {page}
        </ErrorBoundary>
      ) : <div className="grid min-h-[50vh] place-items-center"><div className="h-10 w-10 animate-spin rounded-full border-2 border-line border-t-accent" /></div>}
    </Layout>
  )
}

export default function App() {
  return <Page />
}
