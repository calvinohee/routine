import { describe, expect, test } from 'vitest'
import {
  splitRecent,
  groupByDay,
  weeklyRollups,
  spotTimeline,
  phaseTimeline,
} from '../history'
import type { AdapalenePhaseTransition, Spot } from '../../engine/types'
import { amSession, pmSession } from '../../engine/__tests__/fixtures'

const TODAY = '2026-07-20'

describe('splitRecent — 14 days including today', () => {
  test('a session 13 days ago is recent; 14 days ago is older', () => {
    const recent13 = pmSession('2026-07-07', 'simple')
    const older14 = pmSession('2026-07-06', 'simple')
    const { recent, older } = splitRecent([recent13, older14], TODAY)
    expect(recent).toEqual([recent13])
    expect(older).toEqual([older14])
  })

  test('empty history → both empty', () => {
    expect(splitRecent([], TODAY)).toEqual({ recent: [], older: [] })
  })
})

describe('groupByDay', () => {
  test('pairs AM and PM of the same date, newest day first', () => {
    const am = amSession('2026-07-18')
    const pm = pmSession('2026-07-18', 'bha')
    const earlier = pmSession('2026-07-17', 'simple')
    const groups = groupByDay([earlier, am, pm])
    expect(groups.map((g) => g.date)).toEqual(['2026-07-18', '2026-07-17'])
    expect(groups[0]?.am).toBe(am)
    expect(groups[0]?.pm).toBe(pm)
    expect(groups[1]?.am).toBeUndefined()
    expect(groups[1]?.pm).toBe(earlier)
  })
})

describe('weeklyRollups', () => {
  test('groups by Monday-started weeks, newest week first, with night counts', () => {
    const sessions = [
      // Week of Mon 29 June
      pmSession('2026-06-29', 'bha'),
      pmSession('2026-06-30', 'adapalene', {
        conflictChoices: [{ conflictId: 'x', chosenOptionId: 'y' }],
      }),
      pmSession('2026-07-05', 'simple'), // Sunday, same week
      // Week of Mon 6 July
      pmSession('2026-07-06', 'tn'),
    ]
    const rollups = weeklyRollups(sessions)
    expect(rollups.map((r) => r.weekStart)).toEqual(['2026-07-06', '2026-06-29'])
    const june = rollups[1]
    expect(june?.nightCounts).toEqual({ bha: 1, adapalene: 1, simple: 1 })
    expect(june?.conflictCount).toBe(1)
    expect(june?.sessionCount).toBe(3)
    expect(june?.label).toBe('29 Jun – 5 Jul')
    expect(june?.days.map((d) => d.date)).toEqual(['2026-07-05', '2026-06-30', '2026-06-29'])
  })

  test('AM sessions count toward sessionCount but not nightCounts', () => {
    const rollups = weeklyRollups([amSession('2026-07-07'), pmSession('2026-07-07', 'clay')])
    expect(rollups[0]?.sessionCount).toBe(2)
    expect(rollups[0]?.nightCounts).toEqual({ clay: 1 })
  })
})

describe('spotTimeline', () => {
  const spot: Spot = {
    id: 'chin-spot-2026-07-10',
    zone: 'chin',
    type: 'spot',
    startDate: '2026-07-10',
    updates: [
      { date: '2026-07-12', status: 'same' },
      { date: '2026-07-14', status: 'better' },
      { date: '2026-07-15', status: 'better' },
    ],
    state: 'healed',
  }

  test('reported first, Pair nights carry a consecutive counter, updates and healed state appear', () => {
    const sessions = [
      pmSession('2026-07-10', 'simple', { pairSpotIds: [spot.id] }),
      pmSession('2026-07-11', 'simple', { pairSpotIds: [spot.id] }),
      // gap on the 12th
      pmSession('2026-07-13', 'simple', { pairSpotIds: [spot.id] }),
    ]
    const timeline = spotTimeline(spot, sessions)
    expect(timeline[0]).toMatchObject({ date: '2026-07-10', kind: 'reported' })
    const pairs = timeline.filter((e) => e.kind === 'pair')
    expect(pairs.map((e) => e.pairCount)).toEqual([1, 2, 1]) // gap resets the counter
    expect(timeline.some((e) => e.kind === 'update' && e.date === '2026-07-14')).toBe(true)
    expect(timeline[timeline.length - 1]?.kind).toBe('healed')
  })

  test('escalated spot ends with an escalation entry', () => {
    const benzacSpot: Spot = { ...spot, updates: [], state: 'benzac' }
    const timeline = spotTimeline(benzacSpot, [])
    expect(timeline[timeline.length - 1]?.kind).toBe('escalated')
  })

  test('active spot has no terminal entry', () => {
    const active: Spot = { ...spot, updates: [], state: 'active' }
    const timeline = spotTimeline(active, [])
    expect(timeline).toHaveLength(1) // reported only
  })
})

describe('phaseTimeline', () => {
  const transitions: AdapalenePhaseTransition[] = [
    { date: '2026-06-30', fromPhase: null, toPhase: 'full-face-1x' },
    { date: '2026-07-14', fromPhase: 'full-face-1x', toPhase: 'full-face-2x' },
  ]

  test('each phase gets start date and day count; the latest is current', () => {
    const timeline = phaseTimeline(transitions, TODAY)
    expect(timeline).toHaveLength(2)
    expect(timeline[0]).toMatchObject({
      phase: 'full-face-1x',
      startDate: '2026-06-30',
      dayCount: 14, // 30 Jun → 13 Jul inclusive
      current: false,
    })
    expect(timeline[1]).toMatchObject({
      phase: 'full-face-2x',
      startDate: '2026-07-14',
      dayCount: 7, // 14 Jul → 20 Jul inclusive
      current: true,
    })
  })

  test('empty transitions → empty timeline', () => {
    expect(phaseTimeline([], TODAY)).toEqual([])
  })
})
