import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db/db'
import { seedIfNeeded } from './db/state'
import { TabBar, type Tab } from './components/TabBar'
import { TodayScreen } from './components/TodayScreen'
import { HistoryScreen } from './components/history/HistoryScreen'

function Placeholder({ title, phase }: { title: string; phase: string }) {
  return (
    <div>
      <h1 className="large-title">{title}</h1>
      <div className="placeholder">Coming in {phase}.</div>
    </div>
  )
}

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
      <main className="app-main">
        {tab === 'today' && <TodayScreen />}
        {tab === 'history' && <HistoryScreen />}
        {tab === 'library' && <Placeholder title="Library" phase="Phase 3" />}
      </main>
      <TabBar tab={tab} onChange={setTab} />
    </>
  )
}
