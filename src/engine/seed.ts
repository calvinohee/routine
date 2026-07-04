/**
 * Cold-start seed data (brief Section 11, exactly).
 */
import type { Session, Settings } from './types'
import { DEFAULT_WEATHER_THRESHOLDS } from './weather'

export function seedSettings(): Settings {
  return {
    coordinates: { lat: -33.8688, lon: 151.2093, label: 'Sydney' },
    quotas: { bha: 3, tn: 2, clay: 1, vc100: 1 },
    preassigned: { clay: 'thursday', vc100: 'saturday' },
    weeklySchedule: {
      monday: 'gym-office',
      tuesday: 'gym-office',
      wednesday: 'gym-office',
      thursday: 'gym-office',
      friday: 'gym-office',
      saturday: 'outdoor-run-day',
      sunday: 'rest-indoors',
    },
    weatherThresholds: DEFAULT_WEATHER_THRESHOLDS,
    adapalene: {
      phase: 'full-face-1x',
      phaseStart: '2026-06-30',
      lastApplication: '2026-06-30',
      firstFullFace: '2026-06-30',
    },
    benzacMode: null,
    establishedUnlocks: { tnOnAdapaleneNights: false, vc100OnAdapaleneNights: false },
    theme: 'system',
  }
}

/**
 * One historical adapalene session on 30/06/2026 so the rolling-7 window and
 * spacing logic start correct. All other quotas start at zero — recent nights
 * were simple by the user's confirmation; no backfill screen is needed.
 */
export function seedSessions(): Session[] {
  return [
    {
      date: '2026-06-30',
      slot: 'pm',
      answers: {
        slot: 'pm',
        followedAm: 'yes',
        skinStates: ['clear'],
        newSpots: [],
        spotUpdates: [],
        patches: 'none',
      },
      nightType: 'adapalene',
      steps: [],
      conflictChoices: [],
      weather: null,
      adapalenePhase: 'full-face-1x',
      pairSpotIds: [],
    },
  ]
}
