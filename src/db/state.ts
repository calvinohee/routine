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
import { lastDateOfNightType } from '../engine/quotas'
import productsJson from '../../products.json'
import type { RoutineDb } from './db'

/**
 * Keeps the product catalogue (names, summaries, techniques, leave-on text)
 * in step with the app version while preserving the user's enable toggles.
 */
export async function syncProductCatalog(db: RoutineDb): Promise<void> {
  await db.transaction('rw', db.products, async () => {
    for (const product of productsJson.products as Product[]) {
      const existing = await db.products.get(product.id)
      if (existing) await db.products.put({ ...product, enabled: existing.enabled })
      else await db.products.add(product)
    }
  })
}

/** One-off data migrations for existing installs. */
export async function migrateSettings(db: RoutineDb): Promise<void> {
  const settings = await getSettings(db)
  let changed = false
  const weeklySchedule = { ...settings.weeklySchedule }
  for (const day of Object.keys(weeklySchedule) as Array<keyof typeof weeklySchedule>) {
    // 'gym-office' was retired in favour of the morning-shower question.
    if (weeklySchedule[day] === 'gym-office') {
      weeklySchedule[day] = 'office'
      changed = true
    }
  }
  if (changed) await putSettings(db, { ...settings, weeklySchedule })
}

/** Seed on first launch; afterwards, refresh the catalogue text on every boot. */
export async function seedIfNeeded(db: RoutineDb): Promise<void> {
  const count = await db.products.count()
  if (count > 0) {
    await syncProductCatalog(db)
    await migrateSettings(db)
    return
  }
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
  const [settings, products, allSessions, spots] = await Promise.all([
    getSettings(db),
    db.products.toArray(),
    db.sessions.toArray(),
    db.spots.toArray(),
  ])
  // The engine must see the world as it was BEFORE this session: when
  // redoing a check-in, tonight's earlier log must not count as history,
  // and adapalene dates that log wrote must be rolled back too.
  const history = allSessions.filter((s) => !(s.date === date && s.slot === slot))
  let effectiveSettings = settings
  if (settings.adapalene.lastApplication === date) {
    effectiveSettings = {
      ...settings,
      adapalene: {
        ...settings.adapalene,
        lastApplication: lastDateOfNightType(history, 'adapalene'),
        firstFullFace:
          settings.adapalene.firstFullFace === date ? null : settings.adapalene.firstFullFace,
      },
    }
  }
  return {
    date,
    slot,
    settings: effectiveSettings,
    products,
    history,
    spots,
    answers,
    weather,
    conflictChoices,
  }
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
