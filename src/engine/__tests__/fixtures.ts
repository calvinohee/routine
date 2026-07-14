import type {
  AmAnswers,
  IsoDate,
  NightType,
  PmAnswers,
  Session,
} from '../types'

export function pmAnswers(overrides: Partial<PmAnswers> = {}): PmAnswers {
  return {
    slot: 'pm',
    followedAm: 'yes',
    skinStates: ['clear'],
    newSpots: [],
    spotUpdates: [],
    patches: 'none',
    ...overrides,
  }
}

export function amAnswers(overrides: Partial<AmAnswers> = {}): AmAnswers {
  return {
    slot: 'am',
    dayType: 'office',
    skinStates: ['clear'],
    newSpots: [],
    patches: 'none',
    ...overrides,
  }
}

/** A logged PM session of the given night type. */
export function pmSession(
  date: IsoDate,
  nightType: NightType,
  overrides: Partial<Session> = {},
): Session {
  return {
    date,
    slot: 'pm',
    answers: pmAnswers(),
    nightType,
    steps: [],
    conflictChoices: [],
    weather: null,
    adapalenePhase: 'full-face-1x',
    pairSpotIds: [],
    ...overrides,
  }
}

/** A logged AM session. */
export function amSession(date: IsoDate, overrides: Partial<Session> = {}): Session {
  return {
    date,
    slot: 'am',
    answers: amAnswers(),
    nightType: null,
    steps: [],
    conflictChoices: [],
    weather: null,
    adapalenePhase: 'full-face-1x',
    pairSpotIds: [],
    ...overrides,
  }
}

import type { Settings } from '../types'
import { DEFAULT_WEATHER_THRESHOLDS } from '../weather'

/** Seed-default settings (brief Section 11). */
export function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    coordinates: { lat: -33.8688, lon: 151.2093, label: 'Sydney' },
    quotas: { bha: 3, tn: 2, clay: 1, vc100: 1 },
    preassigned: { clay: 'thursday', vc100: 'saturday' },
    weeklySchedule: {
      monday: 'office',
      tuesday: 'office',
      wednesday: 'office',
      thursday: 'office',
      friday: 'office',
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
    ...overrides,
  }
}
