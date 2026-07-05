import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db/db'
import { seedIfNeeded } from './db/state'
import { TabBar, type Tab } from './components/TabBar'
import { TodayScreen } from './components/TodayScreen'
import { HistoryScreen } from './components/history/HistoryScreen'
import { LibraryScreen } from './components/library/LibraryScreen'

export default function App() {
  const [tab, setTab] = useState<Tab>('today')
  const [ready, setReady] = useState(false)

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
      {/* Opaque cover for the iOS status-bar area (light + dark aware). */}
      <div className="top-safe" aria-hidden="true" />
      <main className="app-main">
        {/* All tabs stay mounted so in-flight state (e.g. the BHA timer) survives switching. */}
        <div hidden={tab !== 'today'}>
          <TodayScreen />
        </div>
        <div hidden={tab !== 'history'}>
          <HistoryScreen />
        </div>
        <div hidden={tab !== 'library'}>
          <LibraryScreen />
        </div>
      </main>
      <TabBar tab={tab} onChange={setTab} />
    </>
  )
}
