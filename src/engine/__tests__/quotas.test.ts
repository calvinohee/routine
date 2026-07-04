import { describe, expect, test } from 'vitest'
import { quotaCounts, lastDateOfNightType, exfoliantRetinoidDates } from '../quotas'
import { pmSession, amSession } from './fixtures'

const TODAY = '2026-07-04'

describe('quotaCounts', () => {
  test('all zero with no history', () => {
    expect(quotaCounts([], TODAY)).toEqual({
      bha: 0,
      tn: 0,
      clay: 0,
      vc100: 0,
      adapalene: 0,
    })
  })

  test('counts each night type inside the rolling-7 window', () => {
    const history = [
      pmSession('2026-06-28', 'bha'),
      pmSession('2026-06-29', 'tn'),
      pmSession('2026-06-30', 'adapalene'),
      pmSession('2026-07-01', 'clay'),
      pmSession('2026-07-02', 'vc100'),
      pmSession('2026-07-03', 'bha'),
    ]
    expect(quotaCounts(history, TODAY)).toEqual({
      bha: 2,
      tn: 1,
      clay: 1,
      vc100: 1,
      adapalene: 1,
    })
  })

  test('a session exactly 7 days ago has dropped out of the window', () => {
    const history = [pmSession('2026-06-27', 'bha'), pmSession('2026-06-28', 'bha')]
    expect(quotaCounts(history, TODAY).bha).toBe(1)
  })

  test('a session logged today counts', () => {
    const history = [pmSession(TODAY, 'tn')]
    expect(quotaCounts(history, TODAY).tn).toBe(1)
  })

  test('AM sessions and simple/benzac nights do not affect quota counts', () => {
    const history = [
      amSession('2026-07-01'),
      pmSession('2026-07-01', 'simple'),
      pmSession('2026-07-02', 'benzac'),
    ]
    expect(quotaCounts(history, TODAY)).toEqual({
      bha: 0,
      tn: 0,
      clay: 0,
      vc100: 0,
      adapalene: 0,
    })
  })
})

describe('lastDateOfNightType', () => {
  test('returns the most recent date of the given night type', () => {
    const history = [
      pmSession('2026-06-20', 'bha'),
      pmSession('2026-07-01', 'bha'),
      pmSession('2026-07-02', 'tn'),
    ]
    expect(lastDateOfNightType(history, 'bha')).toBe('2026-07-01')
  })

  test('returns null when the night type never occurred', () => {
    expect(lastDateOfNightType([pmSession('2026-07-01', 'simple')], 'bha')).toBeNull()
  })

  test('ignores AM sessions', () => {
    expect(lastDateOfNightType([amSession('2026-07-01')], 'bha')).toBeNull()
  })
})

describe('exfoliantRetinoidDates', () => {
  test('collects BHA and adapalene night dates jointly', () => {
    const history = [
      pmSession('2026-07-01', 'bha'),
      pmSession('2026-07-02', 'adapalene'),
      pmSession('2026-07-03', 'tn'),
    ]
    expect(exfoliantRetinoidDates(history)).toEqual(['2026-07-01', '2026-07-02'])
  })
})
