import { describe, expect, test } from 'vitest'
import { weatherModifiers, DEFAULT_WEATHER_THRESHOLDS } from '../weather'
import type { WeatherSnapshot } from '../types'

function snapshot(overrides: Partial<WeatherSnapshot> = {}): WeatherSnapshot {
  return {
    tempC: 20,
    humidityPct: 50,
    uvIndex: 2,
    conditions: 'Partly cloudy',
    fetchedAt: '2026-07-04T07:00:00+10:00',
    ...overrides,
  }
}

const T = DEFAULT_WEATHER_THRESHOLDS

describe('default thresholds match the brief', () => {
  test('seed values', () => {
    expect(T).toEqual({
      hotTempC: 28,
      hotHumidityPct: 65,
      antiShineTempC: 35,
      coolTempC: 14,
      dryHumidityPct: 40,
      uvReapplyEmphasis: 8,
      uvSpfMandatory: 3,
    })
  })
})

describe('weatherModifiers', () => {
  test('null snapshot (offline, never fetched) → no modifiers, no crash', () => {
    expect(weatherModifiers(null, T, 'office')).toEqual({
      hotHumid: false,
      antiShineUnlocked: false,
      dryCheekBias: false,
      uvReapplyEmphasis: false,
      spfMandatory: false,
    })
  })

  test('hot/humid at exactly 28°C and 65% humidity', () => {
    const mods = weatherModifiers(snapshot({ tempC: 28, humidityPct: 65 }), T, 'office')
    expect(mods.hotHumid).toBe(true)
  })

  test('hot but not humid → not hot/humid', () => {
    const mods = weatherModifiers(snapshot({ tempC: 30, humidityPct: 50 }), T, 'office')
    expect(mods.hotHumid).toBe(false)
  })

  test('anti-shine SPF unlocks at 35°C', () => {
    expect(weatherModifiers(snapshot({ tempC: 35 }), T, 'office').antiShineUnlocked).toBe(true)
    expect(weatherModifiers(snapshot({ tempC: 34.9 }), T, 'office').antiShineUnlocked).toBe(false)
  })

  test('cool at 14°C or dry at 40% humidity → dry-cheek bias', () => {
    expect(weatherModifiers(snapshot({ tempC: 14 }), T, 'office').dryCheekBias).toBe(true)
    expect(weatherModifiers(snapshot({ humidityPct: 40 }), T, 'office').dryCheekBias).toBe(true)
    expect(weatherModifiers(snapshot({ tempC: 15, humidityPct: 41 }), T, 'office').dryCheekBias).toBe(false)
  })

  test('UV 8 → reapplication emphasis', () => {
    expect(weatherModifiers(snapshot({ uvIndex: 8 }), T, 'office').uvReapplyEmphasis).toBe(true)
    expect(weatherModifiers(snapshot({ uvIndex: 7.9 }), T, 'office').uvReapplyEmphasis).toBe(false)
  })

  test('UV 3 + outdoor day → SPF mandatory regardless of conditions', () => {
    const rainy = snapshot({ uvIndex: 3, conditions: 'Rain' })
    expect(weatherModifiers(rainy, T, 'outdoor').spfMandatory).toBe(true)
  })

  test('UV 3 on a non-outdoor day → SPF not forced by weather', () => {
    expect(weatherModifiers(snapshot({ uvIndex: 3 }), T, 'office').spfMandatory).toBe(false)
  })

  test('UV below 3 on an outdoor day → not forced', () => {
    expect(weatherModifiers(snapshot({ uvIndex: 2.9 }), T, 'outdoor').spfMandatory).toBe(false)
  })

  test('custom thresholds are respected', () => {
    const custom = { ...T, hotTempC: 25, hotHumidityPct: 60 }
    expect(weatherModifiers(snapshot({ tempC: 26, humidityPct: 61 }), custom, 'office').hotHumid).toBe(true)
  })
})
