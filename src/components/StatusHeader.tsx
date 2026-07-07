import type { Session, Settings, WeatherSnapshot } from '../engine/types'
import { phaseGuidance, phaseWeeklyTarget, isInPurgeWindow } from '../engine/adapalene'
import { quotaCounts } from '../engine/quotas'
import { diffDays } from '../engine/dates'
import type { IsoDate } from '../engine/types'
import { PHASE_LABELS } from '../lib/labels'
import { useOnline } from '../hooks/useOnline'

function sydneyTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-AU', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Australia/Sydney',
  })
}

/** The weather status line, with an offline notice when connectivity is down. */
export function weatherLine(weather: WeatherSnapshot | null, online: boolean): string {
  if (!weather) {
    return online
      ? 'Weather unavailable — routines run fine without it.'
      : 'Offline — routines run fine without weather.'
  }
  const summary = `${Math.round(weather.tempC)}°C · ${Math.round(weather.humidityPct)}% humidity · UV ${weather.uvIndex.toFixed(0)} · ${weather.conditions}`
  return online
    ? `${summary} · fetched ${sydneyTime(weather.fetchedAt)}`
    : `Offline · showing weather from ${sydneyTime(weather.fetchedAt)}`
}

interface Props {
  date: IsoDate
  settings: Settings
  history: Session[]
  weather: WeatherSnapshot | null
}

export function StatusHeader({ date, settings, history, weather }: Props) {
  const online = useOnline()
  const counts = quotaCounts(history, date)
  const { adapalene } = settings
  const dayCount = diffDays(adapalene.phaseStart, date) + 1
  const target = phaseWeeklyTarget(adapalene.phase)
  const established = adapalene.phase === 'established'

  const chips: Array<[string, number, number]> = [
    ['BHA', counts.bha, settings.quotas.bha],
    ['TN', counts.tn, settings.quotas.tn],
    ['Clay', counts.clay, settings.quotas.clay],
    ['VC100', counts.vc100, settings.quotas.vc100],
    ['Adapalene', counts.adapalene, target],
  ]

  return (
    <div className="card">
      {!established && (
        <div className="adapalene-line" style={{ marginBottom: 10 }}>
          <strong>
            Adapalene: {PHASE_LABELS[adapalene.phase]} · day {dayCount}
          </strong>
          <span>
            {isInPurgeWindow(adapalene, date) ? 'Purge window (weeks 3–8). ' : ''}
            {phaseGuidance(adapalene.phase)}
          </span>
        </div>
      )}
      <div className="chip-row" style={{ marginBottom: 10 }}>
        {chips.map(([label, count, quota]) => (
          <span key={label} className={`quota-chip ${count >= quota ? 'met' : ''}`}>
            {label} {count}/{quota}
          </span>
        ))}
      </div>
      <div className="weather-line">{weatherLine(weather, online)}</div>
    </div>
  )
}
