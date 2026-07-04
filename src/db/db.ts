import Dexie, { type EntityTable } from 'dexie'
import type {
  AdapalenePhaseTransition,
  Product,
  Session,
  Settings,
  Spot,
} from '../engine/types'

/** Settings live as a single keyed row so Dexie can store one object. */
export interface SettingsRow {
  id: 'singleton'
  value: Settings
}

export type RoutineDb = Dexie & {
  products: EntityTable<Product, 'id'>
  sessions: EntityTable<Session, 'id'>
  spots: EntityTable<Spot, 'id'>
  adapalenePhaseHistory: EntityTable<AdapalenePhaseTransition, 'id'>
  settings: EntityTable<SettingsRow, 'id'>
}

export function createDb(name = 'routine'): RoutineDb {
  const db = new Dexie(name) as RoutineDb
  // Schema v1 — bump the version and add an upgrade() when the shape changes.
  db.version(1).stores({
    products: 'id, category, status',
    sessions: '++id, date, slot, [date+slot]',
    spots: 'id, state, startDate',
    adapalenePhaseHistory: '++id, date',
    settings: 'id',
  })
  return db
}

export const db = createDb()
