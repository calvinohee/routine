import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { sydneyToday } from '../../hooks/useToday'
import { groupByDay, splitRecent, weeklyRollups, type WeekRollup } from '../../lib/history'
import { NIGHT_LABELS } from '../../lib/labels'
import { DayCard } from './SessionCard'
import { PhaseTimelineView, SpotTimelineView } from './Timelines'

function RollupRow({ rollup }: { rollup: WeekRollup }) {
  const [open, setOpen] = useState(false)
  const summary = Object.entries(rollup.nightCounts)
    .map(([night, count]) => `${NIGHT_LABELS[night as keyof typeof NIGHT_LABELS].replace(' night', '')} ×${count}`)
    .join(' · ')
  return (
    <div className="card">
      <button className="rollup-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span>
          <strong>{rollup.label}</strong>
          <span className="rollup-summary">
            {summary || 'No PM routines'}
            {rollup.conflictCount > 0 &&
              ` · ${rollup.conflictCount} conflict${rollup.conflictCount > 1 ? 's' : ''}`}
          </span>
        </span>
        <span className={`rollup-chevron ${open ? 'open' : ''}`}>›</span>
      </button>
      {open && rollup.days.map((group) => <DayCard key={group.date} group={group} />)}
    </div>
  )
}

export function HistoryScreen() {
  const today = sydneyToday()
  const sessions = useLiveQuery(() => db.sessions.toArray(), [])
  const spots = useLiveQuery(() => db.spots.toArray(), [])
  const transitions = useLiveQuery(() => db.adapalenePhaseHistory.toArray(), [])

  if (!sessions || !spots || !transitions) return null

  const { recent, older } = splitRecent(sessions, today)
  const recentDays = groupByDay(recent)
  const rollups = weeklyRollups(older)

  return (
    <div>
      <h1 className="large-title">History</h1>
      <p className="title-sub">Kept forever — PIH fades slowly, receipts help.</p>

      {recentDays.length === 0 && rollups.length === 0 && (
        <div className="placeholder">Nothing logged yet — routines you log land here.</div>
      )}

      {recentDays.length > 0 && (
        <section>
          <h2 className="hx-section">Last 14 days</h2>
          {recentDays.map((group) => (
            <DayCard key={group.date} group={group} />
          ))}
        </section>
      )}

      {rollups.length > 0 && (
        <section>
          <h2 className="hx-section">Earlier</h2>
          {rollups.map((rollup) => (
            <RollupRow key={rollup.weekStart} rollup={rollup} />
          ))}
        </section>
      )}

      {spots.length > 0 && (
        <section>
          <h2 className="hx-section">Spots</h2>
          {spots.map((spot) => (
            <SpotTimelineView key={spot.id} spot={spot} sessions={sessions} />
          ))}
        </section>
      )}

      {transitions.length > 0 && (
        <section>
          <h2 className="hx-section">Adapalene</h2>
          <PhaseTimelineView transitions={transitions} today={today} />
        </section>
      )}
    </div>
  )
}
