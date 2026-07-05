import { useEffect, useRef, useState } from 'react'

/** How long a finished timer keeps showing "Done" before resetting. */
const DONE_LINGER_MS = 60 * 60 * 1000

function format(totalSeconds: number): string {
  const mm = Math.floor(totalSeconds / 60)
  const ss = String(Math.round(totalSeconds % 60)).padStart(2, '0')
  return `${mm}:${ss}`
}

function storedEndsAt(key: string): number | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? Number(raw) : null
  } catch {
    return null
  }
}

/**
 * Tappable countdown for any timed step. The end time is persisted per step,
 * so a running timer survives switching tabs and relaunching the app.
 */
export function CountdownTimer({
  minutes,
  storageKey = 'regimen-timer-wait',
}: {
  minutes: number
  storageKey?: string
}) {
  const [remaining, setRemaining] = useState<number | null>(() => {
    const endsAt = storedEndsAt(storageKey)
    if (endsAt === null) return null
    const left = Math.ceil((endsAt - Date.now()) / 1000)
    if (left > 0) return left
    if (Date.now() - endsAt < DONE_LINGER_MS) return 0
    try {
      localStorage.removeItem(storageKey)
    } catch {
      /* storage unavailable — timer just won't persist */
    }
    return null
  })
  const interval = useRef<ReturnType<typeof setInterval> | null>(null)

  function tick() {
    const endsAt = storedEndsAt(storageKey)
    if (endsAt === null) return
    const left = Math.ceil((endsAt - Date.now()) / 1000)
    if (left <= 0) {
      if (interval.current) clearInterval(interval.current)
      setRemaining(0)
    } else {
      setRemaining(left)
    }
  }

  useEffect(() => {
    // Resume ticking if a timer was already running when this mounted.
    if (remaining !== null && remaining > 0 && interval.current === null) {
      interval.current = setInterval(tick, 1000)
    }
    return () => {
      if (interval.current) clearInterval(interval.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function start() {
    const seconds = Math.round(minutes * 60)
    try {
      localStorage.setItem(storageKey, String(Date.now() + seconds * 1000))
    } catch {
      /* storage unavailable — timer just won't persist */
    }
    setRemaining(seconds)
    if (interval.current) clearInterval(interval.current)
    interval.current = setInterval(tick, 1000)
  }

  if (remaining === null) {
    return (
      <button className="chip small countdown" onClick={start}>
        Start {format(minutes * 60)} timer
      </button>
    )
  }
  if (remaining === 0) {
    return <span className="countdown">Done ✓</span>
  }
  return (
    <span className="countdown" aria-live="off">
      {format(remaining)}
    </span>
  )
}
