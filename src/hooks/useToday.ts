import { useMemo, useState } from 'react'
import type { IsoDate, Slot } from '../engine/types'

const SYDNEY = 'Australia/Sydney'

export function sydneyToday(now = new Date()): IsoDate {
  return new Intl.DateTimeFormat('en-CA', { timeZone: SYDNEY }).format(now)
}

export function sydneyHour(now = new Date()): number {
  return Number(
    new Intl.DateTimeFormat('en-AU', { timeZone: SYDNEY, hour: 'numeric', hour12: false }).format(
      now,
    ),
  )
}

/** Today's date in Sydney plus a time-aware default slot (PM from 3pm). */
export function useToday(): { date: IsoDate; slot: Slot; setSlot: (s: Slot) => void } {
  const date = useMemo(() => sydneyToday(), [])
  const [slot, setSlot] = useState<Slot>(() => (sydneyHour() < 15 ? 'am' : 'pm'))
  return { date, slot, setSlot }
}
