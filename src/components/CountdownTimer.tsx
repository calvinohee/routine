import { useEffect, useRef, useState } from 'react'

/** Tappable countdown for the BHA wait step. */
export function CountdownTimer({ minutes }: { minutes: number }) {
  const [remaining, setRemaining] = useState<number | null>(null)
  const interval = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (interval.current) clearInterval(interval.current)
    }
  }, [])

  function start() {
    if (interval.current) clearInterval(interval.current)
    setRemaining(minutes * 60)
    interval.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev === null || prev <= 1) {
          if (interval.current) clearInterval(interval.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)
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
