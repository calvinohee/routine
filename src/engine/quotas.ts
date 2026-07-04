import type { IsoDate, NightType, Session } from './types'
import { isInRolling7 } from './dates'

export interface QuotaCounts {
  bha: number
  tn: number
  clay: number
  vc100: number
  adapalene: number
}

const QUOTA_NIGHT_TYPES = ['bha', 'tn', 'clay', 'vc100', 'adapalene'] as const

/**
 * Live rolling-7 counts (today inclusive) — never stored, always computed.
 */
export function quotaCounts(history: Session[], today: IsoDate): QuotaCounts {
  const counts: QuotaCounts = { bha: 0, tn: 0, clay: 0, vc100: 0, adapalene: 0 }
  for (const session of history) {
    if (session.slot !== 'pm' || session.nightType === null) continue
    if (!isInRolling7(session.date, today)) continue
    const type = session.nightType
    if ((QUOTA_NIGHT_TYPES as readonly string[]).includes(type)) {
      counts[type as keyof QuotaCounts] += 1
    }
  }
  return counts
}

/** Most recent date the given night type was logged, or null. */
export function lastDateOfNightType(history: Session[], nightType: NightType): IsoDate | null {
  let last: IsoDate | null = null
  for (const session of history) {
    if (session.slot !== 'pm' || session.nightType !== nightType) continue
    if (last === null || session.date > last) last = session.date
  }
  return last
}

/**
 * Dates of leave-on exfoliant/retinoid nights — BHA and adapalene count
 * jointly toward the 3-consecutive-nights safety cap.
 */
export function exfoliantRetinoidDates(history: Session[]): IsoDate[] {
  return history
    .filter((s) => s.slot === 'pm' && (s.nightType === 'bha' || s.nightType === 'adapalene'))
    .map((s) => s.date)
}
