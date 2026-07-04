import { describe, expect, test } from 'vitest'
import {
  addDays,
  diffDays,
  weekdayOf,
  rolling7Start,
  isInRolling7,
  consecutiveRunEndingAt,
} from '../dates'

describe('addDays', () => {
  test('adds days within a month', () => {
    expect(addDays('2026-07-04', 3)).toBe('2026-07-07')
  })

  test('crosses month boundaries', () => {
    expect(addDays('2026-06-29', 2)).toBe('2026-07-01')
  })

  test('subtracts days with negative n', () => {
    expect(addDays('2026-07-01', -1)).toBe('2026-06-30')
  })

  test('crosses year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })

  test('handles leap-year February', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
  })
})

describe('diffDays', () => {
  test('returns positive when second date is later', () => {
    expect(diffDays('2026-07-01', '2026-07-04')).toBe(3)
  })

  test('returns zero for the same day', () => {
    expect(diffDays('2026-07-04', '2026-07-04')).toBe(0)
  })

  test('returns negative when second date is earlier', () => {
    expect(diffDays('2026-07-04', '2026-07-01')).toBe(-3)
  })
})

describe('weekdayOf', () => {
  test('2026-07-04 is a Saturday', () => {
    expect(weekdayOf('2026-07-04')).toBe('saturday')
  })

  test('2026-06-30 is a Tuesday', () => {
    expect(weekdayOf('2026-06-30')).toBe('tuesday')
  })

  test('2026-07-05 is a Sunday', () => {
    expect(weekdayOf('2026-07-05')).toBe('sunday')
  })

  test('2026-07-06 is a Monday', () => {
    expect(weekdayOf('2026-07-06')).toBe('monday')
  })
})

describe('rolling7Start', () => {
  test('window starts 6 days before today (today inclusive)', () => {
    expect(rolling7Start('2026-07-04')).toBe('2026-06-28')
  })
})

describe('isInRolling7', () => {
  test('today is inside the window', () => {
    expect(isInRolling7('2026-07-04', '2026-07-04')).toBe(true)
  })

  test('six days ago is inside the window', () => {
    expect(isInRolling7('2026-06-28', '2026-07-04')).toBe(true)
  })

  test('exactly seven days ago has dropped out', () => {
    expect(isInRolling7('2026-06-27', '2026-07-04')).toBe(false)
  })

  test('future dates are outside the window', () => {
    expect(isInRolling7('2026-07-05', '2026-07-04')).toBe(false)
  })
})

describe('consecutiveRunEndingAt', () => {
  test('counts a run of consecutive dates ending at the given date', () => {
    const dates = ['2026-07-01', '2026-07-02', '2026-07-03']
    expect(consecutiveRunEndingAt(dates, '2026-07-03')).toBe(3)
  })

  test('returns zero when the end date itself is absent', () => {
    const dates = ['2026-07-01', '2026-07-02']
    expect(consecutiveRunEndingAt(dates, '2026-07-03')).toBe(0)
  })

  test('a gap breaks the run', () => {
    const dates = ['2026-06-30', '2026-07-02', '2026-07-03']
    expect(consecutiveRunEndingAt(dates, '2026-07-03')).toBe(2)
  })

  test('single date is a run of one', () => {
    expect(consecutiveRunEndingAt(['2026-07-03'], '2026-07-03')).toBe(1)
  })

  test('unsorted and duplicated input is tolerated', () => {
    const dates = ['2026-07-03', '2026-07-01', '2026-07-02', '2026-07-02']
    expect(consecutiveRunEndingAt(dates, '2026-07-03')).toBe(3)
  })
})
