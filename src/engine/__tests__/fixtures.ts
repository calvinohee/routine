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
