import { describe, expect, test } from 'vitest'
import { generateRoutine } from '../generate'
import { seedSettings, seedSessions } from '../seed'
import type { EngineInput, Product, Spot } from '../types'
import { amAnswers, makeSettings, pmAnswers, pmSession } from './fixtures'
import productsJson from '../../../products.json'

const PRODUCTS = productsJson.products as Product[]
const SATURDAY = '2026-07-04'
const SUNDAY = '2026-07-05'

/** Default history: all quotas met for the SUNDAY window, so the default night is simple. */
function quotasMetHistory() {
  return [
    pmSession('2026-06-29', 'adapalene'),
    pmSession('2026-06-30', 'bha'),
    pmSession('2026-07-02', 'bha'),
    pmSession('2026-07-04', 'bha'),
    pmSession('2026-07-01', 'tn'),
    pmSession('2026-07-03', 'tn'),
  ]
}

function input(overrides: Partial<EngineInput> = {}): EngineInput {
  return {
    date: SUNDAY,
    slot: 'pm',
    settings: makeSettings(),
    products: PRODUCTS,
    history: quotasMetHistory(),
    spots: [],
    answers: pmAnswers(),
    weather: null,
    conflictChoices: [],
    ...overrides,
  }
}

function trackedSpot(): Spot {
  return {
    id: 'chin-spot-2026-06-28',
    zone: 'chin',
    type: 'closed-lump',
    startDate: '2026-06-28',
    updates: [],
    state: 'active',
  }
}

/**
 * History where the tracked spot got Pair for 5 consecutive nights ending
 * yesterday. TN nights early in the run keep the TN quota met, so declining
 * escalation resolves to an unambiguous BHA night rather than a second card.
 */
function fivePairNights(spotId: string) {
  const nights = ['tn', 'tn', 'simple', 'simple', 'simple'] as const
  return ['2026-06-30', '2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04'].map((d, i) =>
    pmSession(d, nights[i] ?? 'simple', { pairSpotIds: [spotId] }),
  )
}

describe('AM generation', () => {
  test('produces a routine with no conflicts and no night type', () => {
    const result = generateRoutine(
      input({ slot: 'am', answers: amAnswers({ dayType: 'rest-indoors' }) }),
    )
    expect(result.conflicts).toEqual([])
    expect(result.routine?.nightType).toBeNull()
    expect(result.routine?.steps.length).toBeGreaterThan(0)
  })
})

describe('PM generation end-to-end', () => {
  test('quiet Sunday resolves to a simple night routine', () => {
    const history = [
      pmSession('2026-06-29', 'adapalene'),
      pmSession('2026-06-30', 'bha'),
      pmSession('2026-07-02', 'bha'),
      pmSession('2026-07-04', 'bha'),
      pmSession('2026-07-01', 'tn'),
      pmSession('2026-07-03', 'tn'),
    ]
    const result = generateRoutine(input({ history }))
    expect(result.conflicts).toEqual([])
    expect(result.routine?.nightType).toBe('simple')
  })

  test('mask-day irritation → conflict first, routine null', () => {
    const result = generateRoutine(
      input({ date: SATURDAY, answers: pmAnswers({ skinStates: ['irritated'] }) }),
    )
    expect(result.routine).toBeNull()
    expect(result.conflicts).toHaveLength(1)
    expect(result.conflicts[0]?.id).toContain('mask-vs-irritation')
  })

  test('choosing the swap option resolves to simple and carries the reschedule effect', () => {
    const first = generateRoutine(
      input({ date: SATURDAY, answers: pmAnswers({ skinStates: ['irritated'] }) }),
    )
    const conflict = first.conflicts[0]
    const swap = conflict?.options.find((o) => o.nightType === 'simple')
    const second = generateRoutine(
      input({
        date: SATURDAY,
        answers: pmAnswers({ skinStates: ['irritated'] }),
        conflictChoices: [{ conflictId: conflict?.id ?? '', chosenOptionId: swap?.id ?? '' }],
      }),
    )
    expect(second.conflicts).toEqual([])
    expect(second.routine?.nightType).toBe('simple')
    expect(second.appliedEffects).toEqual([{ type: 'reschedule-mask', mask: 'vc100' }])
  })
})

describe('spot escalation through the integration layer', () => {
  test('5th consecutive Pair night with no improvement surfaces the escalation card', () => {
    const spot = trackedSpot()
    const result = generateRoutine(
      input({ spots: [spot], history: fivePairNights(spot.id) }),
    )
    expect(result.routine).toBeNull()
    expect(result.conflicts.some((c) => c.id === `escalation-${spot.id}`)).toBe(true)
  })

  test('accepting Benzac escalation yields a benzac night and a start-benzac-mode effect', () => {
    const spot = trackedSpot()
    const base = input({ spots: [spot], history: fivePairNights(spot.id) })
    const first = generateRoutine(base)
    const card = first.conflicts.find((c) => c.id === `escalation-${spot.id}`)
    const accept = card?.options.find((o) => o.id === 'start-benzac')
    const second = generateRoutine({
      ...base,
      conflictChoices: [{ conflictId: card?.id ?? '', chosenOptionId: accept?.id ?? '' }],
    })
    expect(second.routine?.nightType).toBe('benzac')
    expect(second.appliedEffects).toContainEqual({ type: 'start-benzac-mode', spotId: spot.id })
  })

  test('declining escalation continues normal selection — Benzac never starts on its own', () => {
    const spot = trackedSpot()
    const base = input({ spots: [spot], history: fivePairNights(spot.id) })
    const first = generateRoutine(base)
    const card = first.conflicts.find((c) => c.id === `escalation-${spot.id}`)
    const decline = card?.options.find((o) => o.id === 'continue-pair')
    const second = generateRoutine({
      ...base,
      conflictChoices: [{ conflictId: card?.id ?? '', chosenOptionId: decline?.id ?? '' }],
    })
    expect(second.routine).not.toBeNull()
    expect(second.routine?.nightType).not.toBe('benzac')
    expect(second.appliedEffects).toEqual([])
  })
})

describe('Benzac mode lifecycle', () => {
  const spot = trackedSpot()
  const mode = { startedDate: '2026-06-30', spotId: spot.id }

  test('active Benzac mode → benzac night', () => {
    const result = generateRoutine(
      input({
        settings: makeSettings({ benzacMode: mode }),
        spots: [spot],
        history: [pmSession('2026-07-03', 'benzac'), pmSession('2026-07-04', 'benzac')],
      }),
    )
    expect(result.routine?.nightType).toBe('benzac')
  })

  test('night-5 cap auto-terminates: not a benzac night, end effect emitted', () => {
    const history = ['2026-06-30', '2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04'].map(
      (d) => pmSession(d, 'benzac'),
    )
    const result = generateRoutine(
      input({ settings: makeSettings({ benzacMode: mode }), spots: [spot], history }),
    )
    expect(result.appliedEffects).toContainEqual({ type: 'end-benzac-mode' })
    if (result.routine) expect(result.routine.nightType).not.toBe('benzac')
  })

  test('marked improvement terminates Benzac mode', () => {
    const improved = { ...spot, updates: [{ date: '2026-07-04', status: 'better' as const }] }
    const result = generateRoutine(
      input({
        settings: makeSettings({ benzacMode: mode }),
        spots: [improved],
        history: [pmSession('2026-07-04', 'benzac')],
      }),
    )
    expect(result.appliedEffects).toContainEqual({ type: 'end-benzac-mode' })
  })
})

describe('advisories and spot updates', () => {
  test('purge window (weeks 3–8 after first full-face) is labelled', () => {
    const settings = makeSettings({
      adapalene: {
        phase: 'full-face-1x',
        phaseStart: '2026-06-10',
        lastApplication: '2026-07-01',
        firstFullFace: '2026-06-10', // 25 days before SUNDAY
      },
    })
    const result = generateRoutine(input({ settings }))
    expect(result.routine?.advisories.join(' ')).toMatch(/purge/i)
  })

  test('stinging on application → buffer guidance', () => {
    const result = generateRoutine(
      input({ answers: pmAnswers({ adapaleneReport: 'stinging-on-application' }) }),
    )
    expect(result.routine?.advisories.join(' ')).toMatch(/dry|buffer/i)
  })

  test('new spots reported tonight come back in updatedSpots', () => {
    const result = generateRoutine(
      input({
        answers: pmAnswers({
          skinStates: ['new-spot'],
          newSpots: [{ zone: 'forehead', type: 'spot' }],
        }),
      }),
    )
    expect(result.updatedSpots.some((s) => s.zone === 'forehead' && s.state === 'active')).toBe(true)
  })
})

describe('cold start (Section 11, exactly)', () => {
  test('seed settings match the brief', () => {
    const s = seedSettings()
    expect(s.coordinates).toEqual({ lat: -33.8688, lon: 151.2093, label: 'Sydney' })
    expect(s.quotas).toEqual({ bha: 3, tn: 2, clay: 1, vc100: 1 })
    expect(s.preassigned).toEqual({ clay: 'thursday', vc100: 'saturday' })
    expect(s.weeklySchedule.saturday).toBe('outdoor-run-day')
    expect(s.weeklySchedule.sunday).toBe('rest-indoors')
    expect(s.adapalene.phase).toBe('full-face-1x')
    expect(s.adapalene.phaseStart).toBe('2026-06-30')
    expect(s.adapalene.lastApplication).toBe('2026-06-30')
    expect(s.adapalene.firstFullFace).toBe('2026-06-30')
    expect(s.benzacMode).toBeNull()
    expect(s.theme).toBe('system')
  })

  test('seed history is exactly one adapalene session on 30/06/2026', () => {
    const sessions = seedSessions()
    expect(sessions).toHaveLength(1)
    expect(sessions[0]).toMatchObject({ date: '2026-06-30', slot: 'pm', nightType: 'adapalene' })
  })

  test('first PM after cold start on Tue 07/07: adapalene is due again (seed session outside window, spacing satisfied)', () => {
    const result = generateRoutine(
      input({
        date: '2026-07-07',
        settings: seedSettings(),
        history: seedSessions(),
      }),
    )
    expect(result.routine?.nightType).toBe('adapalene')
  })

  test('quota met exactly at the window boundary: a BHA session exactly 7 days back has dropped out', () => {
    // Monday 06/07; BHA on 29/06 is outside the trailing-7 window.
    const history = [
      pmSession('2026-06-29', 'bha'),
      pmSession('2026-06-30', 'bha'),
      pmSession('2026-07-01', 'bha'),
      pmSession('2026-07-03', 'adapalene'),
      pmSession('2026-07-02', 'tn'),
      pmSession('2026-07-04', 'tn'),
    ]
    const result = generateRoutine(input({ date: '2026-07-06', history }))
    // bha count is 2/3 inside the window → behind → BHA night (spacing clear).
    expect(result.routine?.nightType).toBe('bha')
  })
})

describe('coverage of remaining generate paths', () => {
  test('the engine refuses to emit a routine if corrupted product data breaks a safety rule', () => {
    // Corrupt the foaming wash into a second salicylic-acid source.
    const corrupted = PRODUCTS.map((p) =>
      p.id === 'curel-foaming-wash' ? { ...p, activeTags: ['salicylic-acid'] } : p,
    )
    const c = input({
      date: SUNDAY,
      products: corrupted,
      history: quotasMetHistory().map((s) =>
        s.nightType === 'bha' ? s : s,
      ),
    })
    // Force a BHA night (two salicylic sources: corrupted wash + BHA).
    const withBhaDue = {
      ...c,
      history: [
        pmSession('2026-06-29', 'adapalene'),
        pmSession('2026-07-01', 'tn'),
        pmSession('2026-07-03', 'tn'),
      ],
    }
    expect(() => generateRoutine(withBhaDue)).toThrow(/unsafe/i)
  })

  test('an escalation choice with a bogus option id applies no effects', () => {
    const spot = trackedSpot()
    const base = input({ spots: [spot], history: fivePairNights(spot.id) })
    const first = generateRoutine(base)
    const card = first.conflicts.find((c) => c.id === `escalation-${spot.id}`)
    const result = generateRoutine({
      ...base,
      conflictChoices: [{ conflictId: card?.id ?? '', chosenOptionId: 'nope' }],
    })
    expect(result.appliedEffects).toEqual([])
  })

  test('AM generation inside the purge window carries the label too', () => {
    const settings = makeSettings({
      adapalene: {
        phase: 'full-face-1x',
        phaseStart: '2026-06-10',
        lastApplication: '2026-07-01',
        firstFullFace: '2026-06-10',
      },
    })
    const result = generateRoutine(
      input({ slot: 'am', settings, answers: amAnswers({ dayType: 'office' }) }),
    )
    expect(result.routine?.advisories[0]).toMatch(/purge/i)
  })
})

describe('remaining escalation and choice paths', () => {
  test('boil escalation: choosing the derm flag applies flag-derm without starting Benzac', () => {
    const boil: Spot = { ...trackedSpot(), type: 'boil' }
    const base = input({ spots: [boil], history: fivePairNights(boil.id) })
    const first = generateRoutine(base)
    const card = first.conflicts.find((c) => c.id === `escalation-${boil.id}`)
    const derm = card?.options.find((o) => o.id === 'flag-derm')
    const second = generateRoutine({
      ...base,
      conflictChoices: [{ conflictId: card?.id ?? '', chosenOptionId: derm?.id ?? '' }],
    })
    expect(second.appliedEffects).toEqual([{ type: 'flag-derm', spotId: boil.id }])
    expect(second.routine?.nightType).not.toBe('benzac')
  })

  test('a stale conflict choice from a conflict that no longer arises is ignored', () => {
    const result = generateRoutine(
      input({ conflictChoices: [{ conflictId: `stale-${SUNDAY}`, chosenOptionId: 'x' }] }),
    )
    expect(result.conflicts).toEqual([])
    expect(result.routine?.nightType).toBe('simple')
    expect(result.appliedEffects).toEqual([])
  })
})
