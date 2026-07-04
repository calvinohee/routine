/**
 * Open-Meteo current-weather fetch (no API key). Throttled to at most one
 * fetch per hour; the last snapshot is cached in localStorage so the app
 * degrades gracefully offline (brief Section 10).
 */
import type { WeatherSnapshot } from '../engine/types'

const CACHE_KEY = 'routine-weather-snapshot'
const THROTTLE_MS = 60 * 60 * 1000

interface OpenMeteoResponse {
  current: {
    temperature_2m: number
    relative_humidity_2m: number
    uv_index: number
    weather_code: number
  }
}

/** WMO weather codes → short human text. */
function describe(code: number): string {
  if (code === 0) return 'Clear'
  if (code <= 2) return 'Partly cloudy'
  if (code === 3) return 'Overcast'
  if (code <= 48) return 'Fog'
  if (code <= 57) return 'Drizzle'
  if (code <= 67) return 'Rain'
  if (code <= 77) return 'Snow'
  if (code <= 82) return 'Showers'
  if (code <= 86) return 'Snow showers'
  return 'Thunderstorm'
}

export function cachedSnapshot(): WeatherSnapshot | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? (JSON.parse(raw) as WeatherSnapshot) : null
  } catch {
    return null
  }
}

/**
 * Returns a fresh snapshot when due (≥1h since the cached one), otherwise the
 * cache; null only when offline with an empty cache.
 */
export async function getWeather(lat: number, lon: number): Promise<WeatherSnapshot | null> {
  const cached = cachedSnapshot()
  if (cached && Date.now() - Date.parse(cached.fetchedAt) < THROTTLE_MS) return cached

  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      '&current=temperature_2m,relative_humidity_2m,uv_index,weather_code&timezone=auto'
    const response = await fetch(url)
    if (!response.ok) return cached
    const data = (await response.json()) as OpenMeteoResponse
    const snapshot: WeatherSnapshot = {
      tempC: data.current.temperature_2m,
      humidityPct: data.current.relative_humidity_2m,
      uvIndex: data.current.uv_index,
      conditions: describe(data.current.weather_code),
      fetchedAt: new Date().toISOString(),
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(snapshot))
    return snapshot
  } catch {
    return cached
  }
}
