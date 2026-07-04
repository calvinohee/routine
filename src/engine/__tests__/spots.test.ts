import { describe, expect, test } from 'vitest'
import {
  applySpotAnswers,
  pairNightRun,
  shouldOfferEscalation,
  buildEscalationCard,
  shouldEndBenzacMode,
} from '../spots'
import type { Spot } from '../types'
import { pmSession, pmAnswers } from './fixtures'

const TODAY = '2026-07-04'

function spot(overrides: Partial<Spot> = {}): Spot {
  return {
    id: 'chin-spot-2026-06-25',
    zone: 'chin',
    type: 'spot',
    startDate: '2026-06-25',
    updates: [],
    state: 'active',
    ...overrides,
  }
}

/** history where the given spot got Pair for n consecutive nights ending yesterday */
function pairNights(spotId: string, n: number, endDate = '2026-07-03') {
  const sessions = []
  for (let i = 0; i < n; i++) {
    const d = new Date(Date.UTC(2026, 6, 3 - i)) // walk back from 3 July
    void endDate
    sessions.push(
      pmSession(d.toISOString().slice(0, 10), 'simple', { pairSpotIds: [spotId] }),
    )
  }
  return sessions
}

describe('applySpotAnswers', () => {
  test('creates a new spot from a new-spot report', () => {
    const answers = pmAnswers({ newSpots: [{ zone: 'jaw-l', type: 'closed-lump' }] })
    const result = applySpotAnswers([], answers, TODAY)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      zone: 'jaw-l',
      type: 'closed-lump',
      startDate: TODAY,
      state: 'active',
      updates: [],
    })
  })

  test('appends better/same/worse updates to tracked spots', () => {
    const existing = spot()
    const answers = pmAnswers({ spotUpdates: [{ spotId: existing.id, status: 'worse' }] })
    const result = applySpotAnswers([existing], answers, TODAY)
    expect(result[0]?.updates).toEqual([{ date: TODAY, status: 'worse' }])
  })

  test('a better update marks the spot healed once reported better twice in a row', () => {
    const existing = spot({ updates: [{ date: '2026-07-03', status: 'better' }] })
    const answers = pmAnswers({ spotUpdates: [{ spotId: existing.id, status: 'better' }] })
    const result = applySpotAnswers([existing], answers, TODAY)
    expect(result[0]?.state).toBe('healed')
  })

  test('does not duplicate an existing active spot in the same zone with the same type', () => {
    const existing = spot({ zone: 'chin', type: 'spot' })
    const answers = pmAnswers({ newSpots: [{ zone: 'chin', type: 'spot' }] })
    const result = applySpotAnswers([existing], answers, TODAY)
    expect(result).toHaveLength(1)
  })
})

describe('pairNightRun', () => {
  test('counts consecutive Pair nights ending last night', () => {
    const s = spot()
    expect(pairNightRun(s, pairNights(s.id, 3), TODAY)).toBe(3)
  })

  test('a night without Pair breaks the run', () => {
    const s = spot()
    const history = [
      pmSession('2026-07-01', 'simple', { pairSpotIds: [s.id] }),
      pmSession('2026-07-02', 'simple', { pairSpotIds: [] }),
      pmSession('2026-07-03', 'simple', { pairSpotIds: [s.id] }),
    ]
    expect(pairNightRun(s, history, TODAY)).toBe(1)
  })
})

describe('shouldOfferEscalation — 5 consecutive Pair nights, no improvement', () => {
  test('offered at 5 nights with no improvement', () => {
    const s = spot()
    expect(shouldOfferEscalation(s, pairNights(s.id, 5), TODAY)).toBe(true)
  })

  test('not offered at 4 nights', () => {
    const s = spot()
    expect(shouldOfferEscalation(s, pairNights(s.id, 4), TODAY)).toBe(false)
  })

  test('not offered when the spot has improved during the run', () => {
    const s = spot({ updates: [{ date: '2026-07-02', status: 'better' }] })
    expect(shouldOfferEscalation(s, pairNights(s.id, 5), TODAY)).toBe(false)
  })

  test('not offered for spots already escalated', () => {
    const s = spot({ state: 'benzac' })
    expect(shouldOfferEscalation(s, pairNights(s.id, 5), TODAY)).toBe(false)
  })
})

describe('buildEscalationCard', () => {
  test('closed unbroken spot → Benzac mode option recommended', () => {
    const s = spot({ type: 'closed-lump' })
    const card = buildEscalationCard(s)
    const benzacOption = card.options.find((o) =>
      o.effects.some((e) => e.type === 'start-benzac-mode'),
    )
    expect(benzacOption).toBeDefined()
    expect(card.recommendedOptionId).toBe(benzacOption?.id)
  })

  test('boil → dermatologist flag recommended, no Benzac option', () => {
    const s = spot({ type: 'boil' })
    const card = buildEscalationCard(s)
    expect(card.options.some((o) => o.effects.some((e) => e.type === 'start-benzac-mode'))).toBe(
      false,
    )
    const dermOption = card.options.find((o) => o.effects.some((e) => e.type === 'flag-derm'))
    expect(card.recommendedOptionId).toBe(dermOption?.id)
  })

  test('always includes a continue-with-Pair option', () => {
    const card = buildEscalationCard(spot({ type: 'closed-lump' }))
    expect(card.options.some((o) => o.effects.length === 0)).toBe(true)
    expect(card.options.length).toBeGreaterThanOrEqual(2)
    expect(card.options.length).toBeLessThanOrEqual(3)
  })
})

describe('shouldEndBenzacMode', () => {
  const mode = { startedDate: '2026-06-29', spotId: 'chin-spot-2026-06-25' }

  test('auto-terminates after 5 consecutive Benzac nights', () => {
    const history = [
      pmSession('2026-06-29', 'benzac'),
      pmSession('2026-06-30', 'benzac'),
      pmSession('2026-07-01', 'benzac'),
      pmSession('2026-07-02', 'benzac'),
      pmSession('2026-07-03', 'benzac'),
    ]
    expect(shouldEndBenzacMode(mode, [spot()], history, TODAY)).toBe(true)
  })

  test('terminates when the user marks the spot improved', () => {
    const improved = spot({ updates: [{ date: '2026-07-03', status: 'better' }] })
    const history = [pmSession('2026-07-03', 'benzac')]
    expect(shouldEndBenzacMode(mode, [improved], history, TODAY)).toBe(true)
  })

  test('continues otherwise', () => {
    const history = [pmSession('2026-07-02', 'benzac'), pmSession('2026-07-03', 'benzac')]
    expect(shouldEndBenzacMode(mode, [spot()], history, TODAY)).toBe(false)
  })
})
