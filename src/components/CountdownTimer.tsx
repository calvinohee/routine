import { useEffect, useRef, useState } from 'react'

const STORAGE_KEY = 'regimen-wait-timer'
/** How long a finished timer keeps showing "Done" before resetting. */
const DONE_LINGER_MS = 60 * 60 * 1000

function storedEndsAt(): number | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? Number(raw) : null
  } catch {
    return null
  }
}

/**
 * Tappable countdown for the BHA wait step. The end time is persisted, so the
 * countdown survives switching tabs and even relaunching the app mid-wait.
 */
export function CountdownTimer({ minutes }: { minutes: number }) {
  const [remaining, setRemaining] = useState<number | null>(() => {
    const endsAt = storedEndsAt()
    if (endsAt === null) return null
    const left = Math.ceil((endsAt - Date.now()) / 1000)
    if (left > 0) return left
    if (Date.now() - endsAt < DONE_LINGER_MS) return 0
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* storage unavailable — timer just won't persist */
    }
    return null
  })
  const interval = useRef<ReturnType<typeof setInterval> | null>(null)

  function tick() {
    const endsAt = storedEndsAt()
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
    const endsAt = Date.now() + minutes * 60 * 1000
    try {
      localStorage.setItem(STORAGE_KEY, String(endsAt))
    } catch {
      /* storage unavailable — timer just won't persist */
    }
    setRemaining(minutes * 60)
    if (interval.current) clearInterval(interval.current)
    interval.current = setInterval(tick, 1000)
  }

  if (remaining === null) {
    return (
      <button className="chip small countdown" onClick={start}>
        Start {minutes}:00 timer
      </button>
    )
  }
  if (remaining === 0) {
    return <span className="countdown">Done — next layer ✓</span>
  }
  const mm = Math.floor(remaining / 60)
  const ss = String(remaining % 60).padStart(2, '0')
  return (
    <span className="countdown" aria-live="off">
      {mm}:{ss}
    </span>
  )
}
