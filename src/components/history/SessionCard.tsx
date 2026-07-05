import type { Session } from '../../engine/types'
import type { DayGroup } from '../../lib/history'
import { shortDate } from '../../lib/history'
import { NIGHT_LABELS, SKIN_LABELS, ZONE_LABELS } from '../../lib/labels'
import { weekdayOf } from '../../engine/dates'

const WEEKDAY_LABELS: Record<string, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
}

function SessionLine({ session }: { session: Session }) {
  const skin = session.answers.skinStates.filter((s) => s !== 'clear')
  const conflictChosen = session.conflictChoices.length > 0
  return (
    <div className="hx-session">
      <div className="hx-session-head">
        <span className={`hx-slot ${session.slot}`}>{session.slot === 'am' ? 'AM' : 'PM'}</span>
        <strong>
          {session.slot === 'pm' && session.nightType
            ? NIGHT_LABELS[session.nightType]
            : session.answers.slot === 'am'
              ? 'Morning routine'
              : 'Evening routine'}
        </strong>
        {session.weather && (
          <span className="hx-weather">{Math.round(session.weather.tempC)}°C</span>
        )}
      </div>
      {(skin.length > 0 || session.answers.newSpots.length > 0) && (
        <div className="chips" style={{ marginTop: 6 }}>
          {skin.map((state) => (
            <span key={state} className="chip small readonly">
              {SKIN_LABELS[state]}
            </span>
          ))}
          {session.answers.newSpots.map((spot) => (
            <span key={spot.zone} className="chip small readonly">
              {ZONE_LABELS[spot.zone]}
            </span>
          ))}
        </div>
      )}
      {conflictChosen && (
        <div className="hx-note">
          Your call: {session.nightType ? NIGHT_LABELS[session.nightType] : 'resolved'} (conflict
          card)
        </div>
      )}
      {session.pairSpotIds.length > 0 && (
        <div className="hx-note">Pair on {session.pairSpotIds.length} spot{session.pairSpotIds.length > 1 ? 's' : ''}</div>
      )}
    </div>
  )
}

/** One day (AM + PM together) in the rich 14-day view. */
export function DayCard({ group }: { group: DayGroup }) {
  return (
    <div className="card">
      <h3>
        {WEEKDAY_LABELS[weekdayOf(group.date)]} {shortDate(group.date)}
      </h3>
      {group.am && <SessionLine session={group.am} />}
      {group.pm && <SessionLine session={group.pm} />}
    </div>
  )
}
