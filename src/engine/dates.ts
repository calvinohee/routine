import type { IsoDate, Weekday } from './types'
import { WEEKDAYS } from './types'

const MS_PER_DAY = 86_400_000

/** Parse `YYYY-MM-DD` to a UTC timestamp — immune to local timezone/DST. */
function toUtc(date: IsoDate): number {
  const [y, m, d] = date.split('-').map(Number)
  return Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1)
}

function toIso(utcMs: number): IsoDate {
  return new Date(utcMs).toISOString().slice(0, 10)
}

export function addDays(date: IsoDate, n: number): IsoDate {
  return toIso(toUtc(date) + n * MS_PER_DAY)
}

/** Days from `a` to `b` — positive when `b` is later. */
export function diffDays(a: IsoDate, b: IsoDate): number {
  return Math.round((toUtc(b) - toUtc(a)) / MS_PER_DAY)
}

export function weekdayOf(date: IsoDate): Weekday {
  // getUTCDay(): 0 = Sunday; WEEKDAYS starts at Monday.
  const sundayFirst = new Date(toUtc(date)).getUTCDay()
  const mondayFirst = (sundayFirst + 6) % 7
  return WEEKDAYS[mondayFirst] as Weekday
}

/** First date of the trailing-7 window ending at `today` (today inclusive). */
export function rolling7Start(today: IsoDate): IsoDate {
  return addDays(today, -6)
}

export function isInRolling7(date: IsoDate, today: IsoDate): boolean {
  const d = diffDays(date, today)
  return d >= 0 && d <= 6
}

/**
 * Length of the consecutive-day run within `dates` ending exactly at `endDate`.
 * Zero when `endDate` itself is absent. Tolerates unsorted/duplicated input.
 */
export function consecutiveRunEndingAt(dates: IsoDate[], endDate: IsoDate): number {
  const set = new Set(dates)
  let run = 0
  let cursor = endDate
  while (set.has(cursor)) {
    run += 1
    cursor = addDays(cursor, -1)
  }
  return run
}
