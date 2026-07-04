import type { DayType, WeatherSnapshot, WeatherThresholds } from './types'

/** Brief Section 10 defaults — config-editable in Settings. */
export const DEFAULT_WEATHER_THRESHOLDS: WeatherThresholds = {
  hotTempC: 28,
  hotHumidityPct: 65,
  antiShineTempC: 35,
  coolTempC: 14,
  dryHumidityPct: 40,
  uvReapplyEmphasis: 8,
  uvSpfMandatory: 3,
}

export interface WeatherModifiers {
  /** ≥28°C and ≥65% — suggest skipping AM moisturiser; PM moisturiser becomes optional. */
  hotHumid: boolean
  /** ≥35°C — LRP Anti-Shine unlocked as SPF suggestion. */
  antiShineUnlocked: boolean
  /** ≤14°C or ≤40% — dry-cheek protocol bias. */
  dryCheekBias: boolean
  /** UV ≥8 — reapplication emphasis (UV drives PIH). */
  uvReapplyEmphasis: boolean
  /** UV ≥3 + outdoor day — SPF mandatory regardless of cloud/rain. */
  spfMandatory: boolean
}

const NONE: WeatherModifiers = {
  hotHumid: false,
  antiShineUnlocked: false,
  dryCheekBias: false,
  uvReapplyEmphasis: false,
  spfMandatory: false,
}

/** Weather degrades gracefully: no snapshot means no modifiers, never an error. */
export function weatherModifiers(
  snapshot: WeatherSnapshot | null,
  thresholds: WeatherThresholds,
  dayType: DayType,
): WeatherModifiers {
  if (snapshot === null) return NONE
  return {
    hotHumid:
      snapshot.tempC >= thresholds.hotTempC && snapshot.humidityPct >= thresholds.hotHumidityPct,
    antiShineUnlocked: snapshot.tempC >= thresholds.antiShineTempC,
    dryCheekBias:
      snapshot.tempC <= thresholds.coolTempC || snapshot.humidityPct <= thresholds.dryHumidityPct,
    uvReapplyEmphasis: snapshot.uvIndex >= thresholds.uvReapplyEmphasis,
    spfMandatory: snapshot.uvIndex >= thresholds.uvSpfMandatory && dayType === 'outdoor',
  }
}
