import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type {
  Answers,
  ConflictChoiceLog,
  EngineResult,
  Slot,
  WeatherSnapshot,
} from '../engine/types'
import { generateRoutine } from '../engine/generate'
import { db } from '../db/db'
import { buildEngineInput, logSession } from '../db/state'
import { getWeather } from '../services/weather'
import { useToday } from '../hooks/useToday'
import { QuestionnaireSheet } from './QuestionnaireSheet'
import { ConflictCards } from './ConflictCards'
import { RoutineView } from './RoutineView'
import { StatusHeader } from './StatusHeader'

export function TodayScreen() {
  const { date, slot, setSlot } = useToday()
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [answers, setAnswers] = useState<Answers | null>(null)
  const [choices, setChoices] = useState<ConflictChoiceLog[]>([])
  const [result, setResult] = useState<EngineResult | null>(null)
  const [justLogged, setJustLogged] = useState(false)

  const settings = useLiveQuery(async () => (await db.settings.get('singleton'))?.value, [])
  const history = useLiveQuery(() => db.sessions.toArray(), [])
  const spots = useLiveQuery(() => db.spots.toArray(), [])
  const loggedSession = useLiveQuery(
    () => db.sessions.where('[date+slot]').equals([date, slot]).first(),
    [date, slot],
  )

  useEffect(() => {
    if (!settings) return
    let cancelled = false
    void getWeather(settings.coordinates.lat, settings.coordinates.lon).then((snapshot) => {
      if (!cancelled) setWeather(snapshot)
    })
    return () => {
      cancelled = true
    }
  }, [settings?.coordinates.lat, settings?.coordinates.lon, settings === undefined])

  // Reset the flow when switching slot.
  useEffect(() => {
    setAnswers(null)
    setChoices([])
    setResult(null)
    setJustLogged(false)
  }, [slot])

  async function runEngine(nextAnswers: Answers, nextChoices: ConflictChoiceLog[]) {
    const input = await buildEngineInput(db, date, slot, nextAnswers, weather, nextChoices)
    setResult(generateRoutine(input))
  }

  async function submitAnswers(a: Answers) {
    setSheetOpen(false)
    setAnswers(a)
    setChoices([])
    await runEngine(a, [])
  }

  async function chooseOption(conflictId: string, optionId: string) {
    if (!answers) return
    const next = [...choices, { conflictId, chosenOptionId: optionId }]
    setChoices(next)
    await runEngine(answers, next)
  }

  async function log() {
    if (!result?.routine || !answers) return
    await logSession(db, {
      date,
      slot,
      answers,
      routine: result.routine,
      updatedSpots: result.updatedSpots,
      appliedEffects: result.appliedEffects,
      conflictChoices: choices,
      weather,
    })
    setJustLogged(true)
  }

  if (!settings || !history || !spots) return null

  const activeSpots = spots.filter((s) => s.state === 'active')
  const firstConflict = result?.conflicts[0]
  const alreadyLogged = loggedSession !== undefined && !justLogged && result === null

  return (
    <div className="screen">
      <h1 className="large-title">Today</h1>
      <p className="title-sub">
        {new Date(`${date}T12:00:00`).toLocaleDateString('en-AU', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        })}
      </p>

      <StatusHeader date={date} settings={settings} history={history} weather={weather} />

      <div className="seg" role="tablist" aria-label="Routine slot">
        {(['am', 'pm'] as Slot[]).map((s) => (
          <button key={s} className={slot === s ? 'active' : ''} onClick={() => setSlot(s)}>
            {s === 'am' ? 'Morning' : 'Evening'}
          </button>
        ))}
      </div>

      {result?.routine ? (
        <RoutineView routine={result.routine} logged={justLogged} onLog={() => void log()} />
      ) : alreadyLogged && loggedSession ? (
        <div>
          <div className="logged-banner">✓ {slot === 'am' ? 'Morning' : 'Evening'} logged</div>
          <RoutineView
            routine={{
              nightType: loggedSession.nightType,
              steps: loggedSession.steps,
              advisories: [],
              pairSpotIds: loggedSession.pairSpotIds,
            }}
            logged
            onLog={() => undefined}
          />
          <button className="primary-btn secondary" onClick={() => setSheetOpen(true)}>
            Redo check-in
          </button>
        </div>
      ) : (
        <button className="primary-btn" onClick={() => setSheetOpen(true)}>
          Start {slot === 'am' ? 'morning' : 'evening'} check-in
        </button>
      )}

      {sheetOpen && (
        <QuestionnaireSheet
          slot={slot}
          date={date}
          settings={settings}
          activeSpots={activeSpots}
          onSubmit={(a) => void submitAnswers(a)}
          onClose={() => setSheetOpen(false)}
        />
      )}

      {firstConflict && (
        <ConflictCards
          conflict={firstConflict}
          onChoose={(optionId) => void chooseOption(firstConflict.id, optionId)}
        />
      )}
    </div>
  )
}
