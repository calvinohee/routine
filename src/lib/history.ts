/**
 * Display aggregations for the History screen (brief Section 8) — pure
 * functions over sessions/spots/phase transitions, no engine rules here.
 */
import type {
  AdapalenePhase,
  AdapalenePhaseTransition,
  IsoDate,
  NightType,
  Session,
  Spot,
} from '../engine/types'
import { addDays, diffDays, weekdayOf } from '../engine/dates'
import { WEEKDAYS } from '../engine/types'

export const RECENT_DAYS = 14

export function splitRecent(
  sessions: Session[],
  today: IsoDate,
): { recent: Session[]; older: Session[] } {
  const recent: Session[] = []
  const older: Session[] = []
  for (const session of sessions) {
    if (diffDays(session.date, today) < RECENT_DAYS) recent.push(session)
    else older.push(session)
  }
  return { recent, older }
}

export interface DayGroup {
  date: IsoDate
  am?: Session
  pm?: Session
}

/** Buckets sessions per day (AM+PM paired), newest day first. */
export function groupByDay(sessions: Session[]): DayGroup[] {
  const byDate = new Map<IsoDate, DayGroup>()
  for (const session of sessions) {
    const group = byDate.get(session.date) ?? { date: session.date }
    if (session.slot === 'am') group.am = session
    else group.pm = session
    byDate.set(session.date, group)
  }
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? 1 : -1))
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** `2026-06-29` → `29 Jun` (Australian day-first). */
export function shortDate(date: IsoDate): string {
  const day = Number(date.slice(8, 10))
  const month = MONTHS[Number(date.slice(5, 7)) - 1]
  return `${day} ${month}`
}

function mondayOf(date: IsoDate): IsoDate {
  return addDays(date, -WEEKDAYS.indexOf(weekdayOf(date)))
}

export interface WeekRollup {
  weekStart: IsoDate
  /** e.g. "29 Jun – 5 Jul" */
  label: string
  nightCounts: Partial<Record<NightType, number>>
  conflictCount: number
  sessionCount: number
  days: DayGroup[]
}

/** Monday-started weekly summaries, newest week first. */
export function weeklyRollups(sessions: Session[]): WeekRollup[] {
  const byWeek = new Map<IsoDate, Session[]>()
  for (const session of sessions) {
    const week = mondayOf(session.date)
    byWeek.set(week, [...(byWeek.get(week) ?? []), session])
  }
  return [...byWeek.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([weekStart, weekSessions]) => {
      const nightCounts: Partial<Record<NightType, number>> = {}
      let conflictCount = 0
      for (const session of weekSessions) {
        if (session.slot === 'pm' && session.nightType !== null) {
          nightCounts[session.nightType] = (nightCounts[session.nightType] ?? 0) + 1
        }
        conflictCount += session.conflictChoices.length
      }
      return {
        weekStart,
        label: `${shortDate(weekStart)} – ${shortDate(addDays(weekStart, 6))}`,
        nightCounts,
        conflictCount,
        sessionCount: weekSessions.length,
        days: groupByDay(weekSessions),
      }
    })
}

export interface SpotTimelineEntry {
  date: IsoDate
  kind: 'reported' | 'pair' | 'update' | 'healed' | 'escalated' | 'derm'
  label: string
  /** Consecutive Pair-night number (resets after a gap). */
  pairCount?: number
}

/** Day-by-day story of one spot, oldest first. */
export function spotTimeline(spot: Spot, sessions: Session[]): SpotTimelineEntry[] {
  const entries: SpotTimelineEntry[] = [
    { date: spot.startDate, kind: 'reported', label: 'Reported' },
  ]

  const pairDates = sessions
    .filter((s) => s.slot === 'pm' && s.pairSpotIds.includes(spot.id))
    .map((s) => s.date)
    .sort()
  let run = 0
  let previous: IsoDate | null = null
  for (const date of pairDates) {
    run = previous !== null && diffDays(previous, date) === 1 ? run + 1 : 1
    entries.push({ date, kind: 'pair', label: `Pair night ${run}`, pairCount: run })
    previous = date
  }

  const STATUS_LABELS = { better: 'Better', same: 'Same', worse: 'Worse' } as const
  for (const update of spot.updates) {
    entries.push({ date: update.date, kind: 'update', label: STATUS_LABELS[update.status] })
  }

  entries.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))

  const lastDate = entries[entries.length - 1]?.date ?? spot.startDate
  if (spot.state === 'healed') entries.push({ date: lastDate, kind: 'healed', label: 'Healed' })
  if (spot.state === 'benzac')
    entries.push({ date: lastDate, kind: 'escalated', label: 'Escalated to Benzac mode' })
  if (spot.state === 'derm-flagged')
    entries.push({ date: lastDate, kind: 'derm', label: 'Flagged for dermatologist' })

  return entries
}

export interface PhaseTimelineEntry {
  phase: AdapalenePhase
  startDate: IsoDate
  /** Days spent in the phase (inclusive of the start day; current phase counts to today). */
  dayCount: number
  current: boolean
}

/** The adapalene journey from the transitions table, oldest first. */
export function phaseTimeline(
  transitions: AdapalenePhaseTransition[],
  today: IsoDate,
): PhaseTimelineEntry[] {
  const sorted = [...transitions].sort((a, b) => (a.date < b.date ? -1 : 1))
  return sorted.map((transition, i) => {
    const next = sorted[i + 1]
    const end = next ? next.date : addDays(today, 1)
    return {
      phase: transition.toPhase,
      startDate: transition.date,
      dayCount: diffDays(transition.date, end),
      current: next === undefined,
    }
  })
}
