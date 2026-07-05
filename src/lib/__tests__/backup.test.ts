import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, test } from 'vitest'
import { createDb, type RoutineDb } from '../../db/db'
import { getSettings, seedIfNeeded } from '../../db/state'
import { exportPayload, importPayload, validatePayload, BACKUP_SCHEMA_VERSION } from '../backup'
import { pmSession } from '../../engine/__tests__/fixtures'

let db: RoutineDb
let n = 0

beforeEach(async () => {
  db = createDb(`backup-test-${++n}`)
  await seedIfNeeded(db)
})

describe('exportPayload', () => {
  test('contains all five tables, schema version and identity', async () => {
    const payload = await exportPayload(db)
    expect(payload.app).toBe('regimen')
    expect(payload.schemaVersion).toBe(BACKUP_SCHEMA_VERSION)
    expect(payload.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(payload.products.length).toBeGreaterThan(40)
    expect(payload.sessions).toHaveLength(1)
    expect(payload.spots).toEqual([])
    expect(payload.adapalenePhaseHistory).toHaveLength(1)
    expect(payload.settings.adapalene.phase).toBe('full-face-1x')
  })
})

describe('validatePayload', () => {
  test('accepts a fresh export', async () => {
    const payload = await exportPayload(db)
    const result = validatePayload(JSON.parse(JSON.stringify(payload)))
    expect(result.ok).toBe(true)
  })

  test('rejects a wrong schema version with a plain-English reason', async () => {
    const payload = { ...(await exportPayload(db)), schemaVersion: 99 }
    const result = validatePayload(payload)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toMatch(/version/i)
  })

  test('rejects non-backup JSON', () => {
    expect(validatePayload({ hello: 'world' }).ok).toBe(false)
    expect(validatePayload(null).ok).toBe(false)
    expect(validatePayload('nope').ok).toBe(false)
  })

  test('rejects a payload missing a table', async () => {
    const payload = await exportPayload(db)
    const broken = { ...payload } as Record<string, unknown>
    delete broken['sessions']
    expect(validatePayload(broken).ok).toBe(false)
  })
})

describe('importPayload', () => {
  test('round trip: export → wipe → import restores everything', async () => {
    await db.sessions.add(pmSession('2026-07-04', 'bha'))
    const payload = await exportPayload(db)

    const target = createDb(`backup-target-${n}`)
    await seedIfNeeded(target)
    await importPayload(target, payload)

    expect(await target.sessions.count()).toBe(2)
    expect(await target.products.count()).toBe(payload.products.length)
    const settings = await getSettings(target)
    expect(settings.adapalene.phase).toBe('full-face-1x')
  })

  test('import replaces existing data rather than merging', async () => {
    const payload = await exportPayload(db) // 1 session
    const target = createDb(`backup-target-b-${n}`)
    await seedIfNeeded(target)
    await target.sessions.bulkAdd([pmSession('2026-07-01', 'tn'), pmSession('2026-07-02', 'tn')])
    await importPayload(target, payload)
    expect(await target.sessions.count()).toBe(1)
  })
})
