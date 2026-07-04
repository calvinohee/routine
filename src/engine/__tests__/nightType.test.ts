import { describe, expect, test } from 'vitest'
import { selectNightType, type NightSelectionContext } from '../nightType'
import type { Session } from '../types'
import { makeSettings, pmAnswers, pmSession } from './fixtures'

// 2026-07-04 is a Saturday (vc100 mask day); 2026-07-06 is a Monday.
const SATURDAY = '2026-07-04'
const MONDAY = '2026-07-06'

/** Settings where adapalene is due on MONDAY (last application 8 days prior). */
const adapaleneDue = makeSettings({
  adapalene: {
    phase: 'full-face-1x',
    phaseStart: '2026-06-23',
    lastApplication: '2026-06-28',
    firstFullFace: '2026-06-28',
  },
})

function ctx(overrides: Partial<NightSelectionContext> = {}): NightSelectionContext {
  return {
    date: MONDAY,
    settings: makeSettings(),
    history: [pmSession('2026-06-30', 'adapalene')],
    answers: pmAnswers(),
    benzacActive: false,
    conflictChoices: [],
    ...overrides,
  }
}

describe('priority 1 — Benzac mode', () => {
  test('benzac wins over everything while active', () => {
    const c = ctx({ date: SATURDAY, benzacActive: true }) // also a vc100 mask day
    expect(selectNightType(c)).toEqual({ kind: 'night', nightType: 'benzac', effects: [] })
  })
})

describe('priority 2 — pre-assigned mask days', () => {
  test('Saturday resolves to vc100', () => {
    const c = ctx({ date: SATURDAY })
    expect(selectNightType(c)).toEqual({ kind: 'night', nightType: 'vc100', effects: [] })
  })

  test('Thursday resolves to clay', () => {
    // 2026-07-09 is a Thursday; adapalene met inside that window.
    const c = ctx({ date: '2026-07-09', history: [pmSession('2026-07-06', 'adapalene')] })
    expect(selectNightType(c)).toEqual({ kind: 'night', nightType: 'clay', effects: [] })
  })

  test('mask day + irritated skin emits a conflict card (keep vs swap-and-reschedule)', () => {
    const c = ctx({ date: SATURDAY, answers: pmAnswers({ skinStates: ['irritated'] }) })
    const result = selectNightType(c)
    if (result.kind !== 'conflict') throw new Error('expected conflict')
    expect(result.conflict.options).toHaveLength(2)
    const swap = result.conflict.options.find((o) => o.nightType === 'simple')
    expect(swap?.effects).toEqual([{ type: 'reschedule-mask', mask: 'vc100' }])
    expect(result.conflict.recommendedOptionId).toBe(swap?.id)
    const keep = result.conflict.options.find((o) => o.nightType === 'vc100')
    expect(keep).toBeDefined()
    expect(keep?.cost.length).toBeGreaterThan(0)
  })

  test('a made choice resolves the mask conflict without re-emitting', () => {
    const c = ctx({ date: SATURDAY, answers: pmAnswers({ skinStates: ['irritated'] }) })
    const first = selectNightType(c)
    if (first.kind !== 'conflict') throw new Error('expected conflict')
    const chosen = first.conflict.options.find((o) => o.nightType === 'vc100')
    const resolved = selectNightType({
      ...c,
      conflictChoices: [{ conflictId: first.conflict.id, chosenOptionId: chosen?.id ?? '' }],
    })
    expect(resolved).toEqual({ kind: 'night', nightType: 'vc100', effects: [] })
  })

  test('true-breakout also triggers the mask-day conflict', () => {
    const c = ctx({ date: SATURDAY, answers: pmAnswers({ skinStates: ['true-breakout'] }) })
    expect(selectNightType(c).kind).toBe('conflict')
  })
})

describe('priority 3 — adapalene', () => {
  test('adapalene due → adapalene night', () => {
    const c = ctx({ settings: adapaleneDue, history: [] })
    expect(selectNightType(c)).toEqual({ kind: 'night', nightType: 'adapalene', effects: [] })
  })

  test('adapalene beats BHA when both are due (top active priority — no card)', () => {
    // BHA count 0 (behind quota), adapalene due → ladder resolves silently.
    const c = ctx({ settings: adapaleneDue, history: [] })
    expect(selectNightType(c)).toEqual({ kind: 'night', nightType: 'adapalene', effects: [] })
  })

  test('adapalene due + irritated skin → conflict card, skip recommended', () => {
    const c = ctx({
      settings: adapaleneDue,
      history: [],
      answers: pmAnswers({ skinStates: ['irritated'] }),
    })
    const result = selectNightType(c)
    if (result.kind !== 'conflict') throw new Error('expected conflict')
    const skip = result.conflict.options.find((o) => o.nightType === 'simple')
    expect(result.conflict.recommendedOptionId).toBe(skip?.id)
    expect(result.conflict.options.some((o) => o.nightType === 'adapalene')).toBe(true)
  })

  test('adapalene due + reaction reported tonight → conflict card', () => {
    const c = ctx({
      settings: adapaleneDue,
      history: [],
      answers: pmAnswers({ adapaleneReport: 'reaction-tonight' }),
    })
    const result = selectNightType(c)
    if (result.kind !== 'conflict') throw new Error('expected conflict')
    expect(result.conflict.id).toContain('adapalene-vs-reaction')
  })

  test('adapalene due but 2 consecutive active nights → deferred silently (hard rule)', () => {
    const history = [pmSession('2026-07-04', 'bha'), pmSession('2026-07-05', 'bha')]
    const result = selectNightType(ctx({ settings: adapaleneDue, history }))
    expect(
      result.kind === 'night'
        ? [result.nightType]
        : result.conflict.options.map((o) => o.nightType),
    ).not.toContain('adapalene')
  })
})

describe('priority 4 — BHA', () => {
  // Adapalene not due: an application already inside the rolling window.
  const adapaleneMet = pmSession('2026-07-01', 'adapalene')

  test('BHA behind quota with spacing clear → bha (TN quota met)', () => {
    const history = [
      adapaleneMet,
      pmSession('2026-06-30', 'tn'),
      pmSession('2026-07-02', 'tn'),
    ]
    expect(selectNightType(ctx({ history }))).toEqual({ kind: 'night', nightType: 'bha', effects: [] })
  })

  test('BHA and TN both behind → conflict card, BHA recommended', () => {
    const result = selectNightType(ctx({ history: [adapaleneMet] }))
    if (result.kind !== 'conflict') throw new Error('expected conflict')
    const types = result.conflict.options.map((o) => o.nightType).sort()
    expect(types).toEqual(['bha', 'tn'])
    const bha = result.conflict.options.find((o) => o.nightType === 'bha')
    expect(result.conflict.recommendedOptionId).toBe(bha?.id)
  })

  test('BHA behind but last night was an active night, TN met → simple silently', () => {
    const history = [
      adapaleneMet,
      pmSession('2026-07-05', 'bha'), // yesterday
      pmSession('2026-06-30', 'tn'),
      pmSession('2026-07-02', 'tn'),
    ]
    expect(selectNightType(ctx({ history }))).toEqual({ kind: 'night', nightType: 'simple', effects: [] })
  })

  test('BHA blocked by spacing while TN behind → conflict (TN tonight vs simple)', () => {
    const history = [adapaleneMet, pmSession('2026-07-05', 'bha')]
    const result = selectNightType(ctx({ history }))
    if (result.kind !== 'conflict') throw new Error('expected conflict')
    const types = result.conflict.options.map((o) => o.nightType).sort()
    expect(types).toEqual(['simple', 'tn'])
  })

  test('irritated skin biases away from BHA to simple', () => {
    const history = [
      adapaleneMet,
      pmSession('2026-06-30', 'tn'),
      pmSession('2026-07-02', 'tn'),
    ]
    const c = ctx({ history, answers: pmAnswers({ skinStates: ['irritated'] }) })
    expect(selectNightType(c)).toEqual({ kind: 'night', nightType: 'simple', effects: [] })
  })
})

describe('priorities 5–6 — TN, then simple', () => {
  test('all quotas met → simple', () => {
    const history: Session[] = [
      pmSession('2026-06-30', 'adapalene'),
      pmSession('2026-07-01', 'bha'),
      pmSession('2026-07-03', 'bha'),
      pmSession('2026-07-05', 'bha'),
      pmSession('2026-07-02', 'tn'),
      pmSession('2026-07-04', 'tn'),
    ]
    expect(selectNightType(ctx({ history }))).toEqual({ kind: 'night', nightType: 'simple', effects: [] })
  })

  test('only TN behind → tn (TN has no consecutive-night constraint)', () => {
    const history = [
      pmSession('2026-06-30', 'adapalene'),
      pmSession('2026-07-01', 'bha'),
      pmSession('2026-07-03', 'bha'),
      pmSession('2026-07-05', 'bha'),
    ]
    expect(selectNightType(ctx({ history }))).toEqual({ kind: 'night', nightType: 'tn', effects: [] })
  })
})

describe('coverage of remaining paths', () => {
  test('a choice referencing a nonexistent option re-emits the conflict', () => {
    const c = ctx({ date: SATURDAY, answers: pmAnswers({ skinStates: ['irritated'] }) })
    const first = selectNightType(c)
    if (first.kind !== 'conflict') throw new Error('expected conflict')
    const again = selectNightType({
      ...c,
      conflictChoices: [{ conflictId: first.conflict.id, chosenOptionId: 'not-an-option' }],
    })
    expect(again.kind).toBe('conflict')
  })

  test('clay mask day + irritation words the card for clay', () => {
    // 2026-07-09 is a Thursday (clay day).
    const c = ctx({
      date: '2026-07-09',
      history: [pmSession('2026-07-06', 'adapalene')],
      answers: pmAnswers({ skinStates: ['irritated'] }),
    })
    const result = selectNightType(c)
    if (result.kind !== 'conflict') throw new Error('expected conflict')
    expect(result.conflict.reason).toContain('clay')
    const swap = result.conflict.options.find((o) => o.nightType === 'simple')
    expect(swap?.effects).toEqual([{ type: 'reschedule-mask', mask: 'clay' }])
  })
})
