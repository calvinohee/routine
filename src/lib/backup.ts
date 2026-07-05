/**
 * Backup export/import (brief Section 3): one JSON file holding every table
 * plus the schema version. Import is all-or-nothing inside a transaction.
 */
import type {
  AdapalenePhaseTransition,
  Product,
  Session,
  Settings,
  Spot,
} from '../engine/types'
import type { RoutineDb } from '../db/db'
import { getSettings } from '../db/state'

export const BACKUP_SCHEMA_VERSION = 1

export interface BackupPayload {
  app: 'regimen'
  schemaVersion: number
  exportedAt: string
  products: Product[]
  sessions: Session[]
  spots: Spot[]
  adapalenePhaseHistory: AdapalenePhaseTransition[]
  settings: Settings
}

export async function exportPayload(db: RoutineDb): Promise<BackupPayload> {
  const [products, sessions, spots, adapalenePhaseHistory, settings] = await Promise.all([
    db.products.toArray(),
    db.sessions.toArray(),
    db.spots.toArray(),
    db.adapalenePhaseHistory.toArray(),
    getSettings(db),
  ])
  return {
    app: 'regimen',
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    products,
    sessions,
    spots,
    adapalenePhaseHistory,
    settings,
  }
}

export type ValidationResult = { ok: true; payload: BackupPayload } | { ok: false; reason: string }

export function validatePayload(raw: unknown): ValidationResult {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, reason: 'This file is not a Regimen backup.' }
  }
  const candidate = raw as Record<string, unknown>
  if (candidate['app'] !== 'regimen') {
    return { ok: false, reason: 'This file is not a Regimen backup.' }
  }
  if (candidate['schemaVersion'] !== BACKUP_SCHEMA_VERSION) {
    return {
      ok: false,
      reason: `This backup uses data version ${String(candidate['schemaVersion'])}, but this app expects version ${BACKUP_SCHEMA_VERSION}.`,
    }
  }
  for (const table of ['products', 'sessions', 'spots', 'adapalenePhaseHistory'] as const) {
    if (!Array.isArray(candidate[table])) {
      return { ok: false, reason: `The backup is incomplete — "${table}" is missing.` }
    }
  }
  if (typeof candidate['settings'] !== 'object' || candidate['settings'] === null) {
    return { ok: false, reason: 'The backup is incomplete — settings are missing.' }
  }
  return { ok: true, payload: candidate as unknown as BackupPayload }
}

/** Replaces ALL existing data. All-or-nothing: any failure rolls back. */
export async function importPayload(db: RoutineDb, payload: BackupPayload): Promise<void> {
  await db.transaction(
    'rw',
    [db.products, db.sessions, db.spots, db.adapalenePhaseHistory, db.settings],
    async () => {
      await Promise.all([
        db.products.clear(),
        db.sessions.clear(),
        db.spots.clear(),
        db.adapalenePhaseHistory.clear(),
        db.settings.clear(),
      ])
      // Strip auto-increment ids so restored rows get fresh keys.
      await db.products.bulkAdd(payload.products)
      await db.sessions.bulkAdd(payload.sessions.map(({ id: _id, ...s }) => s as Session))
      await db.spots.bulkAdd(payload.spots)
      await db.adapalenePhaseHistory.bulkAdd(
        payload.adapalenePhaseHistory.map(({ id: _id, ...t }) => t as AdapalenePhaseTransition),
      )
      await db.settings.add({ id: 'singleton', value: payload.settings })
    },
  )
}
