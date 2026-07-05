import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, test } from 'vitest'
import { createDb, type RoutineDb } from '../db'
import { buildEngineInput, getSettings, logSession, seedIfNeeded } from '../state'
import { generateRoutine } from '../../engine/generate'
import { pmAnswers } from '../../engine/__tests__/fixtures'

let db: RoutineDb
let n = 0

beforeEach(async () => {
  db = createDb(`test-${++n}`)
  await seedIfNeeded(db)
})

describe('first-launch seeding', () => {
  test('products land verbatim, benched items disabled', async () => {
    const products = await db.products.toArray()
    expect(products.length).toBeGreaterThan(40)
    const benched = products.find((p) => p.id === 'anua-azelaic')
    expect(benched?.enabled).toBe(false)
    expect(benched?.benchedReason).toContain('breakout')
  })

  test('settings and the single historical session are present', async () => {
    const settings = await getSettings(db)
    expect(settings.adapalene.phase).toBe('full-face-1x')
    const sessions = await db.sessions.toArray()
    expect(sessions).toHaveLength(1)
    expect(sessions[0]?.date).toBe('2026-06-30')
  })

  test('seeding is idempotent', async () => {
    await seedIfNeeded(db)
    expect(await db.sessions.count()).toBe(1)
  })
})

describe('generate → log round trip', () => {
  test('a PM session logs with spots and adapalene date maintenance', async () => {
    const answers = pmAnswers({
      skinStates: ['new-spot'],
      newSpots: [{ zone: 'chin', type: 'spot' }],
    })
    const input = await buildEngineInput(db, '2026-07-07', 'pm', answers, null, [])
    const result = generateRoutine(input)
    expect(result.routine?.nightType).toBe('adapalene') // cold-start Tuesday

    await logSession(db, {
      date: '2026-07-07',
      slot: 'pm',
      answers,
      routine: result.routine!,
      updatedSpots: result.updatedSpots,
      appliedEffects: result.appliedEffects,
      conflictChoices: [],
      weather: null,
    })

    const sessions = await db.sessions.toArray()
    expect(sessions).toHaveLength(2)
    const spots = await db.spots.toArray()
    expect(spots).toHaveLength(1)
    expect(spots[0]?.zone).toBe('chin')
    const settings = await getSettings(db)
    expect(settings.adapalene.lastApplication).toBe('2026-07-07')
  })

  test('re-logging the same date+slot overwrites rather than duplicates', async () => {
    const answers = pmAnswers()
    const input = await buildEngineInput(db, '2026-07-07', 'pm', answers, null, [])
    const result = generateRoutine(input)
    const log = () =>
      logSession(db, {
        date: '2026-07-07',
        slot: 'pm',
        answers,
        routine: result.routine!,
        updatedSpots: result.updatedSpots,
        appliedEffects: result.appliedEffects,
        conflictChoices: [],
        weather: null,
      })
    await log()
    await log()
    expect(await db.sessions.where('date').equals('2026-07-07').count()).toBe(1)
  })
})

describe('syncProductCatalog', () => {
  test('boot refreshes catalogue text but preserves enable toggles', async () => {
    // Simulate an older install: stale text, user turned Centella off.
    await db.products.update('skin1004-centella', { function: 'stale text', enabled: false })
    await seedIfNeeded(db) // second boot → sync path
    const centella = await db.products.get('skin1004-centella')
    expect(centella?.function).not.toBe('stale text')
    expect(centella?.enabled).toBe(false)
  })

  test('every product carries leave-on guidance after sync', async () => {
    await seedIfNeeded(db)
    const products = await db.products.toArray()
    expect(products.every((p) => typeof p.leaveOn === 'string' && p.leaveOn.length > 0)).toBe(true)
  })
})
