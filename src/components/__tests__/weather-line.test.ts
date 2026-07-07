import { describe, expect, test } from 'vitest'
import { weatherLine } from '../StatusHeader'
import type { WeatherSnapshot } from '../../engine/types'

const snap: WeatherSnapshot = {
  tempC: 22.4,
  humidityPct: 61,
  uvIndex: 5,
  conditions: 'Partly cloudy',
  fetchedAt: '2026-07-06T07:30:00+10:00',
}

describe('weatherLine', () => {
  test('online with data shows the full summary and fetch time', () => {
    const line = weatherLine(snap, true)
    expect(line).toContain('22°C')
    expect(line).toContain('UV 5')
    expect(line).toMatch(/fetched/)
  })

  test('offline with cached data flags offline and shows the snapshot time', () => {
    const line = weatherLine(snap, false)
    expect(line).toMatch(/^Offline/)
    expect(line).toMatch(/showing weather from/)
  })

  test('online with no data reassures the routine still works', () => {
    expect(weatherLine(null, true)).toMatch(/run fine without it/)
  })

  test('offline with no data reassures without implying a fetch', () => {
    expect(weatherLine(null, false)).toMatch(/^Offline — routines run fine/)
  })
})
