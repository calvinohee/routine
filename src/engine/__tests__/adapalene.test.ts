import { describe, expect, test } from 'vitest'
import {
  phaseWeeklyTarget,
  nextPhase,
  previousPhase,
  isAdapaleneDue,
  isInPurgeWindow,
  advanceToPhase,
  applicationSiteWording,
  phaseGuidance,
} from '../adapalene'
import type { AdapaleneState } from '../types'
import { pmSession } from './fixtures'

const TODAY = '2026-07-04'

function state(overrides: Partial<AdapaleneState> = {}): AdapaleneState {
  return {
    phase: 'full-face-1x',
    phaseStart: '2026-06-30',
    lastApplication: '2026-06-30',
    firstFullFace: '2026-06-30',
    ...overrides,
  }
}

describe('phaseWeeklyTarget', () => {
  test.each([
    ['patch-test', 0],
    ['preauricular', 1],
    ['one-cheek', 1],
    ['full-face-1x', 1],
    ['full-face-2x', 2],
    ['full-face-3x', 3],
    ['established', 3],
  ] as const)('%s → %d per week', (phase, target) => {
    expect(phaseWeeklyTarget(phase)).toBe(target)
  })
})

describe('phase order', () => {
  test('nextPhase walks the ladder in order', () => {
    expect(nextPhase('patch-test')).toBe('preauricular')
    expect(nextPhase('full-face-3x')).toBe('established')
  })

  test('nextPhase at the top returns null', () => {
    expect(nextPhase('established')).toBeNull()
  })

  test('previousPhase walks backwards', () => {
    expect(previousPhase('one-cheek')).toBe('preauricular')
  })

  test('previousPhase at the bottom returns null', () => {
    expect(previousPhase('patch-test')).toBeNull()
  })
})

describe('isAdapaleneDue', () => {
  test('due when rolling-7 count is under target and spacing allows', () => {
    // Last application 4 days ago, target 1/week, nothing in window.
    const s = state({ lastApplication: '2026-06-27' })
    expect(isAdapaleneDue(s, [], TODAY)).toBe(true)
  })

  test('not due when the weekly target is already met', () => {
    const s = state()
    const history = [pmSession('2026-06-30', 'adapalene')]
    expect(isAdapaleneDue(s, history, TODAY)).toBe(false)
  })

  test('never due during patch-test (target 0 — assessment only)', () => {
    const s = state({ phase: 'patch-test', lastApplication: null, firstFullFace: null })
    expect(isAdapaleneDue(s, [], TODAY)).toBe(false)
  })

  test('due when never applied before', () => {
    const s = state({ phase: 'preauricular', lastApplication: null, firstFullFace: null })
    expect(isAdapaleneDue(s, [], TODAY)).toBe(true)
  })

  test('at 3x per week, not due the night immediately after an application', () => {
    const s = state({ phase: 'full-face-3x', lastApplication: '2026-07-03' })
    const history = [pmSession('2026-07-03', 'adapalene')]
    expect(isAdapaleneDue(s, history, TODAY)).toBe(false)
  })

  test('at 3x per week, due two nights after the last application', () => {
    const s = state({ phase: 'full-face-3x', lastApplication: '2026-07-02' })
    const history = [pmSession('2026-07-02', 'adapalene')]
    expect(isAdapaleneDue(s, history, TODAY)).toBe(true)
  })

  test('at 2x per week, a 3-day gap is required', () => {
    const s = state({ phase: 'full-face-2x', lastApplication: '2026-07-02' })
    const history = [pmSession('2026-07-02', 'adapalene')]
    expect(isAdapaleneDue(s, history, TODAY)).toBe(false)
    const s2 = state({ phase: 'full-face-2x', lastApplication: '2026-07-01' })
    const history2 = [pmSession('2026-07-01', 'adapalene')]
    expect(isAdapaleneDue(s2, history2, TODAY)).toBe(true)
  })
})

describe('isInPurgeWindow (weeks 3–8 from first full-face use)', () => {
  test('day 13 after first full-face is before the window', () => {
    expect(isInPurgeWindow(state(), '2026-07-13')).toBe(false)
  })

  test('day 14 (start of week 3) is inside', () => {
    expect(isInPurgeWindow(state(), '2026-07-14')).toBe(true)
  })

  test('day 55 (end of week 8) is inside', () => {
    expect(isInPurgeWindow(state(), '2026-08-24')).toBe(true)
  })

  test('day 56 is past the window', () => {
    expect(isInPurgeWindow(state(), '2026-08-25')).toBe(false)
  })

  test('no first full-face date → not in window', () => {
    expect(isInPurgeWindow(state({ firstFullFace: null }), TODAY)).toBe(false)
  })
})

describe('advanceToPhase (user-controlled, any phase selectable)', () => {
  test('produces new state and a transition record', () => {
    const { state: next, transition } = advanceToPhase(state(), 'full-face-2x', TODAY)
    expect(next.phase).toBe('full-face-2x')
    expect(next.phaseStart).toBe(TODAY)
    expect(transition).toEqual({
      date: TODAY,
      fromPhase: 'full-face-1x',
      toPhase: 'full-face-2x',
    })
  })

  test('regression to an earlier phase is allowed', () => {
    const { state: next } = advanceToPhase(state(), 'one-cheek', TODAY)
    expect(next.phase).toBe('one-cheek')
  })

  test('keeps lastApplication and firstFullFace untouched', () => {
    const { state: next } = advanceToPhase(state(), 'full-face-2x', TODAY)
    expect(next.lastApplication).toBe('2026-06-30')
    expect(next.firstFullFace).toBe('2026-06-30')
  })
})

describe('wording and guidance', () => {
  test('each phase has application-site wording', () => {
    expect(applicationSiteWording('preauricular')).toMatch(/ear/i)
    expect(applicationSiteWording('one-cheek')).toMatch(/cheek/i)
    expect(applicationSiteWording('full-face-1x')).toMatch(/full face/i)
  })

  test('each phase has non-empty guidance', () => {
    for (const phase of [
      'patch-test',
      'preauricular',
      'one-cheek',
      'full-face-1x',
      'full-face-2x',
      'full-face-3x',
      'established',
    ] as const) {
      expect(phaseGuidance(phase).length).toBeGreaterThan(0)
    }
  })
})
