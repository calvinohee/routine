import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db/db'
import { seedIfNeeded } from './db/state'
import { TabBar, type Tab } from './components/TabBar'
import { TodayScreen } from './components/TodayScreen'
import { UpdateToast } from './components/UpdateToast'

// Today is on the critical path; History and Library load on first visit.
const HistoryScreen = lazy(() =>
  import('./components/history/HistoryScreen').then((m) => ({ default: m.HistoryScreen })),
)
const LibraryScreen = lazy(() =>
  import('./components/library/LibraryScreen').then((m) => ({ default: m.LibraryScreen })),
)

export default function App() {
  const [tab, setTab] = useState<Tab>('today')
  const [ready, setReady] = useState(false)
  // Track which tabs have been opened so we mount lazy screens on demand,
  // then keep them mounted (preserving Today's in-flight state on switch).
  const visited = useRef<Set<Tab>>(new Set(['today']))
  visited.current.add(tab)

  useEffect(() => {
    void seedIfNeeded(db).then(() => setReady(true))
  }, [])

  const theme = useLiveQuery(async () => (await db.settings.get('singleton'))?.value.theme, [])
  useEffect(() => {
    document.documentElement.dataset['theme'] = theme ?? 'system'
  }, [theme])

  if (!ready) return null

  return (
    <>
      {/* Gradient-blur cover for the iOS status-bar area (light + dark aware). */}
      <div className="top-safe" aria-hidden="true" />
      <main className="app-main">
        <div hidden={tab !== 'today'}>
          <TodayScreen />
        </div>
        <Suspense fallback={null}>
          {visited.current.has('history') && (
            <div hidden={tab !== 'history'}>
              <HistoryScreen />
            </div>
          )}
          {visited.current.has('library') && (
            <div hidden={tab !== 'library'}>
              <LibraryScreen />
            </div>
          )}
        </Suspense>
      </main>
      <TabBar tab={tab} onChange={setTab} />
      <UpdateToast />
    </>
  )
}
