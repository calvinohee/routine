import { useEffect, useRef, useState } from 'react'
import type { IsoDate, Slot } from '../engine/types'

const SYDNEY = 'Australia/Sydney'

export function sydneyToday(now = new Date()): IsoDate {
  return new Intl.DateTimeFormat('en-CA', { timeZone: SYDNEY }).format(now)
}

export function sydneyHour(now = new Date()): number {
  // hourCycle h23: midnight is 0, never 24 (the h24 quirk would read as PM).
  const hour = Number(
    new Intl.DateTimeFormat('en-AU', {
      timeZone: SYDNEY,
      hour: 'numeric',
      hourCycle: 'h23',
    }).format(now),
  )
  return hour
}

export function defaultSlot(now = new Date()): Slot {
  return sydneyHour(now) < 15 ? 'am' : 'pm'
}

/**
 * Today's date in Sydney plus a time-aware default slot (PM from 3pm).
 * Tabs stay mounted for the app's whole life, so the date re-checks itself
 * on focus/visibility and every minute — surviving overnight background
 * resumes without logging to yesterday.
 */
export function useToday(): { date: IsoDate; slot: Slot; setSlot: (s: Slot) => void } {
  const [date, setDate] = useState<IsoDate>(() => sydneyToday())
  const [slot, setSlot] = useState<Slot>(() => defaultSlot())
  const dateRef = useRef(date)
  dateRef.current = date

  useEffect(() => {
    const refresh = () => {
      const now = sydneyToday()
      if (now !== dateRef.current) {
        setDate(now)
        setSlot(defaultSlot()) // new day → back to the time-aware default
      }
    }
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('focus', refresh)
    const interval = setInterval(refresh, 60_000)
    return () => {
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('focus', refresh)
      clearInterval(interval)
    }
  }, [])

  return { date, slot, setSlot }
}
