import type { AdapalenePhaseTransition, IsoDate, Session, Spot } from '../../engine/types'
import { phaseTimeline, shortDate, spotTimeline } from '../../lib/history'
import { PHASE_LABELS, SPOT_TYPE_LABELS, ZONE_LABELS } from '../../lib/labels'

export function SpotTimelineView({ spot, sessions }: { spot: Spot; sessions: Session[] }) {
  const entries = spotTimeline(spot, sessions)
  return (
    <div className="card">
      <h3>
        {ZONE_LABELS[spot.zone]} · {SPOT_TYPE_LABELS[spot.type]}
        {spot.state === 'active' && <span className="hx-live"> · tracking</span>}
      </h3>
      <div className="timeline">
        {entries.map((entry, i) => (
          <div key={`${entry.date}-${entry.kind}-${i}`} className={`tl-row ${entry.kind}`}>
            <span className="tl-date">{shortDate(entry.date)}</span>
            <span className="tl-dot" />
            <span className="tl-label">{entry.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function PhaseTimelineView({
  transitions,
  today,
}: {
  transitions: AdapalenePhaseTransition[]
  today: IsoDate
}) {
  const entries = phaseTimeline(transitions, today)
  if (entries.length === 0) return null
  return (
    <div className="card">
      <h3>Adapalene journey</h3>
      <div className="timeline">
        {entries.map((entry) => (
          <div key={entry.startDate} className={`tl-row ${entry.current ? 'current' : ''}`}>
            <span className="tl-date">{shortDate(entry.startDate)}</span>
            <span className="tl-dot" />
            <span className="tl-label">
              {PHASE_LABELS[entry.phase]}
              <span className="tl-sub">
                {' '}
                · {entry.dayCount} day{entry.dayCount === 1 ? '' : 's'}
                {entry.current ? ' so far' : ''}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
