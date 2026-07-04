/**
 * Data-layer operations: first-launch seeding, engine input assembly,
 * session logging with effect application.
 */
import type {
  ConflictEffect,
  EngineInput,
  IsoDate,
  Product,
  ResolvedRoutine,
  Session,
  Settings,
  Spot,
  WeatherSnapshot,
  Answers,
  ConflictChoiceLog,
} from '../engine/types'
import { seedSessions, seedSettings } from '../engine/seed'
import productsJson from '../../products.json'
import type { RoutineDb } from './db'

/** Seed on first launch only: products verbatim, Section 11 settings, one historical session. */
export async function seedIfNeeded(db: RoutineDb): Promise<void> {
  const count = await db.products.count()
  if (count > 0) return
  await db.transaction('rw', [db.products, db.settings, db.sessions, db.adapalenePhaseHistory], async () => {
    await db.products.bulkAdd(productsJson.products as Product[])
    await db.settings.add({ id: 'singleton', value: seedSettings() })
    await db.sessions.bulkAdd(seedSessions())
    await db.adapalenePhaseHistory.add({
      date: '2026-06-30',
      fromPhase: null,
      toPhase: 'full-face-1x',
    })
  })
}

export async function getSettings(db: RoutineDb): Promise<Settings> {
  const row = await db.settings.get('singleton')
  if (!row) throw new Error('Settings not seeded')
  return row.value
}

export async function putSettings(db: RoutineDb, value: Settings): Promise<void> {
  await db.settings.put({ id: 'singleton', value })
}

/** Assemble everything the engine needs for one generation. */
export async function buildEngineInput(
  db: RoutineDb,
  date: IsoDate,
  slot: 'am' | 'pm',
  answers: Answers,
  weather: WeatherSnapshot | null,
  conflictChoices: ConflictChoiceLog[],
): Promise<EngineInput> {
  const [settings, products, history, spots] = await Promise.all([
    getSettings(db),
    db.products.toArray(),
    db.sessions.toArray(),
    db.spots.toArray(),
  ])
  return { date, slot, settings, products, history, spots, answers, weather, conflictChoices }
}

/**
 * Log a generated routine: writes the session, persists updated spots,
 * applies conflict effects, and maintains adapalene application dates.
 */
export async function logSession(
  db: RoutineDb,
  args: {
    date: IsoDate
    slot: 'am' | 'pm'
    answers: Answers
    routine: ResolvedRoutine
    updatedSpots: Spot[]
    appliedEffects: ConflictEffect[]
    conflictChoices: ConflictChoiceLog[]
    weather: WeatherSnapshot | null
  },
): Promise<void> {
  await db.transaction('rw', [db.sessions, db.spots, db.settings], async () => {
    const settings = await getSettings(db)

    const session: Session = {
      date: args.date,
      slot: args.slot,
      answers: args.answers,
      nightType: args.routine.nightType,
      steps: args.routine.steps,
      conflictChoices: args.conflictChoices,
      weather: args.weather,
      adapalenePhase: settings.adapalene.phase,
      pairSpotIds: args.routine.pairSpotIds,
    }
    // Replace any earlier log for the same date+slot (re-log overwrites).
    const existing = await db.sessions.where('[date+slot]').equals([args.date, args.slot]).first()
    if (existing?.id !== undefined) await db.sessions.delete(existing.id)
    await db.sessions.add(session)

    await db.spots.bulkPut(args.updatedSpots)

    let next = settings
    if (args.routine.nightType === 'adapalene') {
      const firstFullFace =
        settings.adapalene.firstFullFace === null && settings.adapalene.phase.startsWith('full-face')
          ? args.date
          : settings.adapalene.firstFullFace
      next = { ...next, adapalene: { ...next.adapalene, lastApplication: args.date, firstFullFace } }
    }
    for (const effect of args.appliedEffects) {
      next = await applyEffect(db, next, effect, args.date)
    }
    await db.settings.put({ id: 'singleton', value: next })
  })
}

async function applyEffect(
  db: RoutineDb,
  settings: Settings,
  effect: ConflictEffect,
  date: IsoDate,
): Promise<Settings> {
  switch (effect.type) {
    case 'start-benzac-mode': {
      await db.spots.update(effect.spotId, { state: 'benzac' })
      return { ...settings, benzacMode: { startedDate: date, spotId: effect.spotId } }
    }
    case 'end-benzac-mode':
      return { ...settings, benzacMode: null }
    case 'flag-derm': {
      await db.spots.update(effect.spotId, { state: 'derm-flagged' })
      return settings
    }
    case 'reschedule-mask':
      // Logged with the session; catch-up scheduling is a Phase 2+ concern.
      return settings
  }
}
