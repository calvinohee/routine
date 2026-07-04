import { describe, expect, test } from 'vitest'
import { buildSequence, type SequenceContext } from '../sequence'
import { validateRoutineSafety } from '../safety'
import type { Product, ResolvedRoutine, Spot } from '../types'
import { amAnswers, amSession, makeSettings, pmAnswers } from './fixtures'
import productsJson from '../../../products.json'

const PRODUCTS = productsJson.products as Product[]
const MONDAY = '2026-07-06'
const SUNDAY = '2026-07-05'

function ids(routine: ResolvedRoutine): Array<string> {
  return routine.steps.map((s) => s.productId ?? s.kind)
}

function activeSpot(overrides: Partial<Spot> = {}): Spot {
  return {
    id: 'chin-spot-2026-07-01',
    zone: 'chin',
    type: 'spot',
    startDate: '2026-07-01',
    updates: [],
    state: 'active',
    ...overrides,
  }
}

/** An AM office session for today (Anessa SPF logged) — triggers PM double cleanse. */
function amOfficeSession(date: string) {
  return amSession(date, {
    steps: [
      { kind: 'product', productId: 'anessa-perfect-uv-gold', title: '', purpose: '', technique: '', waitMinutes: 3 },
    ],
  })
}

function ctx(overrides: Partial<SequenceContext> = {}): SequenceContext {
  return {
    date: MONDAY,
    slot: 'pm',
    nightType: 'simple',
    answers: pmAnswers(),
    settings: makeSettings(),
    products: PRODUCTS,
    history: [],
    spots: [],
    weather: null,
    ...overrides,
  }
}

function expectSafe(c: SequenceContext, routine: ResolvedRoutine) {
  const unlocks = {
    establishedTnUnlock: c.settings.establishedUnlocks.tnOnAdapaleneNights,
    establishedVc100Unlock: c.settings.establishedUnlocks.vc100OnAdapaleneNights,
  }
  expect(validateRoutineSafety(routine.steps, c.products, c.slot, unlocks)).toEqual([])
}

describe('PM cleansing', () => {
  test('single foaming cleanse when nothing was worn (rest day, no AM session)', () => {
    const c = ctx({ date: SUNDAY }) // sunday = rest-indoors
    const routine = buildSequence(c)
    expect(ids(routine)[0]).toBe('curel-foaming-wash')
    expect(ids(routine)).not.toContain('curel-cleansing-oil')
  })

  test('double cleanse (oil first) when SPF was worn today', () => {
    const c = ctx({ history: [amOfficeSession(MONDAY)] })
    const routine = buildSequence(c)
    expect(ids(routine).slice(0, 2)).toEqual(['curel-cleansing-oil', 'curel-foaming-wash'])
  })

  test('AM skipped → single cleanse even on an office day', () => {
    const c = ctx({
      history: [amOfficeSession(MONDAY)],
      answers: pmAnswers({ followedAm: 'skipped' }),
    })
    expect(ids(buildSequence(c))[0]).toBe('curel-foaming-wash')
  })

  test('no AM session logged on an office day → assume worn, double cleanse', () => {
    const c = ctx() // monday = gym-office in the weekly schedule
    expect(ids(buildSequence(c)).slice(0, 2)).toEqual(['curel-cleansing-oil', 'curel-foaming-wash'])
  })
})

describe('PM templates', () => {
  test('simple night: cleanse → toner → Shirojyun → Snail 92', () => {
    const c = ctx({ date: SUNDAY })
    const routine = buildSequence(c)
    expect(ids(routine)).toEqual([
      'curel-foaming-wash',
      'pc-skin-balancing-toner',
      'shirojyun-premium',
      'cosrx-snail-92',
    ])
    expectSafe(c, routine)
  })

  test('BHA night: toner → BHA → timed wait → Shirojyun → Melano Premium → Centella → Snail', () => {
    const c = ctx({ date: SUNDAY, nightType: 'bha' })
    const routine = buildSequence(c)
    expect(ids(routine)).toEqual([
      'curel-foaming-wash',
      'pc-skin-balancing-toner',
      'pc-bha',
      'wait',
      'shirojyun-premium',
      'melano-cc-premium',
      'skin1004-centella',
      'cosrx-snail-92',
    ])
    const wait = routine.steps.find((s) => s.kind === 'wait')
    expect(wait?.waitMinutes).toBe(10)
    expectSafe(c, routine)
  })

  test('BHA night + tight cheeks → Serum Veil between Centella and Snail', () => {
    const c = ctx({
      date: SUNDAY,
      nightType: 'bha',
      answers: pmAnswers({ skinStates: ['dry-tight-cheeks'] }),
    })
    const list = ids(buildSequence(c))
    expect(list.indexOf('obk-serum-veil')).toBe(list.indexOf('skin1004-centella') + 1)
    expect(list.indexOf('cosrx-snail-92')).toBe(list.indexOf('obk-serum-veil') + 1)
  })

  test('3rd BHA night this window → Serum Veil even without tight cheeks', () => {
    const history = [
      { ...amOfficeSession('2026-06-29'), slot: 'pm' as const, nightType: 'bha' as const },
      { ...amOfficeSession('2026-07-02'), slot: 'pm' as const, nightType: 'bha' as const },
    ]
    const c = ctx({ date: SUNDAY, nightType: 'bha', history })
    expect(ids(buildSequence(c))).toContain('obk-serum-veil')
  })

  test('TN night: no Shirojyun (TXA redundancy)', () => {
    const c = ctx({ date: SUNDAY, nightType: 'tn' })
    const routine = buildSequence(c)
    expect(ids(routine)).toEqual([
      'curel-foaming-wash',
      'pc-skin-balancing-toner',
      'cosdebaha-tn',
      'cosrx-snail-92',
    ])
    expectSafe(c, routine)
  })

  test('VC100 night: Shirojyun retained, mask replaces the serum step', () => {
    const c = ctx({ date: SUNDAY, nightType: 'vc100' })
    const routine = buildSequence(c)
    expect(ids(routine)).toEqual([
      'curel-foaming-wash',
      'pc-skin-balancing-toner',
      'shirojyun-premium',
      'vc100-sheet-mask',
      'cosrx-snail-92',
    ])
    expect(routine.steps.find((s) => s.productId === 'vc100-sheet-mask')?.waitMinutes).toBe(15)
    expectSafe(c, routine)
  })

  test('clay night goes clay straight after cleansing, before toner', () => {
    const c = ctx({ date: SUNDAY, nightType: 'clay' })
    const list = ids(buildSequence(c))
    expect(list.indexOf('pc-skin-balancing-toner')).toBeGreaterThan(
      list.findIndex((id) => id.includes('clay')),
    )
  })

  test('clay night with reactive skin uses LRP Effaclar', () => {
    const c = ctx({
      date: SUNDAY,
      nightType: 'clay',
      answers: pmAnswers({ skinStates: ['new-spot'], newSpots: [{ zone: 'chin', type: 'spot' }] }),
    })
    expect(ids(buildSequence(c))).toContain('lrp-effaclar-clay')
  })

  test('clay night with clear tolerant skin uses Innisfree volcanic', () => {
    const c = ctx({ date: SUNDAY, nightType: 'clay' })
    expect(ids(buildSequence(c))).toContain('innisfree-volcanic-clay')
  })

  test('adapalene night (intro/build): isolated sequence only', () => {
    const c = ctx({ date: SUNDAY, nightType: 'adapalene' })
    const routine = buildSequence(c)
    expect(ids(routine)).toEqual([
      'curel-foaming-wash',
      'pc-skin-balancing-toner',
      'shirojyun-premium',
      'differin-adapalene',
      'cosrx-snail-92',
    ])
    expectSafe(c, routine)
  })

  test('established + TN unlock + TN behind quota → TN shares the adapalene night, Shirojyun out', () => {
    const settings = makeSettings({
      adapalene: {
        phase: 'established',
        phaseStart: '2026-06-01',
        lastApplication: '2026-07-03',
        firstFullFace: '2026-04-01',
      },
      establishedUnlocks: { tnOnAdapaleneNights: true, vc100OnAdapaleneNights: false },
    })
    const c = ctx({ date: SUNDAY, nightType: 'adapalene', settings })
    const routine = buildSequence(c)
    expect(ids(routine)).toEqual([
      'curel-foaming-wash',
      'pc-skin-balancing-toner',
      'cosdebaha-tn',
      'differin-adapalene',
      'cosrx-snail-92',
    ])
    expectSafe(c, routine)
  })

  test('benzac night: short-contact wash replaces second cleanse; Curél cream when raw; pillow barrier last', () => {
    const spot = activeSpot({ id: 'jaw-l-closed-lump-2026-07-01', zone: 'jaw-l', type: 'closed-lump' })
    const c = ctx({
      nightType: 'benzac',
      history: [amOfficeSession(MONDAY)],
      answers: pmAnswers({ skinStates: ['irritated'], patches: 'closed-lump' }),
      spots: [spot],
    })
    const routine = buildSequence(c)
    expect(ids(routine)).toEqual([
      'curel-cleansing-oil',
      'benzac-wash-5',
      'pc-skin-balancing-toner',
      'shirojyun-premium',
      'melano-cc-premium',
      'skin1004-centella',
      'curel-moisture-cream',
      'pair-acne-cream-w',
      'cosrx-master-patch',
    ])
    expect(routine.pairSpotIds).toEqual([spot.id])
    expectSafe(c, routine)
  })

  test('benzac night without raw skin uses Snail 92', () => {
    const c = ctx({ nightType: 'benzac', history: [amOfficeSession(MONDAY)] })
    expect(ids(buildSequence(c))).toContain('cosrx-snail-92')
  })
})

describe('Pair and patches', () => {
  test('active spots → Pair as the last step, spot ids recorded', () => {
    const spot = activeSpot()
    const c = ctx({ date: SUNDAY, spots: [spot] })
    const routine = buildSequence(c)
    expect(ids(routine).at(-1)).toBe('pair-acne-cream-w')
    expect(routine.pairSpotIds).toEqual([spot.id])
    expectSafe(c, routine)
  })

  test('no active spots → no Pair (never preventive)', () => {
    const c = ctx({ date: SUNDAY })
    expect(ids(buildSequence(c))).not.toContain('pair-acne-cream-w')
  })

  test('healed spots get no Pair', () => {
    const c = ctx({ date: SUNDAY, spots: [activeSpot({ state: 'healed' })] })
    expect(ids(buildSequence(c))).not.toContain('pair-acne-cream-w')
  })

  test('whitehead patches: VT patch after cleansing, before all leave-ons', () => {
    const c = ctx({ date: SUNDAY, answers: pmAnswers({ patches: 'whitehead' }) })
    const routine = buildSequence(c)
    const list = ids(routine)
    expect(list.indexOf('vt-pro-cica-patch')).toBe(list.indexOf('curel-foaming-wash') + 1)
    expectSafe(c, routine)
  })

  test('closed-lump patches: COSRX pillow barrier as the final step', () => {
    const c = ctx({ date: SUNDAY, answers: pmAnswers({ patches: 'closed-lump' }), spots: [activeSpot({ type: 'closed-lump' })] })
    const routine = buildSequence(c)
    expect(ids(routine).at(-1)).toBe('cosrx-master-patch')
    expectSafe(c, routine)
  })
})

describe('AM templates', () => {
  test('office day: Tuner → toner → Melano CC Men → SPF (Anessa) → optional CC', () => {
    const c = ctx({ slot: 'am', nightType: null, answers: amAnswers({ dayType: 'office' }) })
    const routine = buildSequence(c)
    expect(ids(routine)).toEqual([
      'obk-balancing-tuner',
      'pc-skin-balancing-toner',
      'melano-cc-men',
      'anessa-perfect-uv-gold',
      'it-cosmetics-cc',
    ])
    expectSafe(c, routine)
  })

  test('office day + dry cheeks: Tuner out, Shirojyun and Snail in', () => {
    const c = ctx({
      slot: 'am',
      nightType: null,
      answers: amAnswers({ dayType: 'office', skinStates: ['dry-tight-cheeks'] }),
    })
    expect(ids(buildSequence(c))).toEqual([
      'pc-skin-balancing-toner',
      'shirojyun-premium',
      'melano-cc-men',
      'cosrx-snail-92',
      'anessa-perfect-uv-gold',
      'it-cosmetics-cc',
    ])
  })

  test('WFH day: water splash → toner → Melano CC Men → Biore (incidental)', () => {
    const c = ctx({ slot: 'am', nightType: null, answers: amAnswers({ dayType: 'wfh' }) })
    const routine = buildSequence(c)
    expect(ids(routine)).toEqual([
      'product', // water splash, productId null
      'pc-skin-balancing-toner',
      'melano-cc-men',
      'biore-aqua-rich',
    ])
    expectSafe(c, routine)
  })

  test('outdoor day: BOJ Aqua-Fresh tier', () => {
    const c = ctx({ slot: 'am', nightType: null, answers: amAnswers({ dayType: 'outdoor' }) })
    expect(ids(buildSequence(c))).toContain('boj-aqua-fresh')
  })

  test('gym-office day: Anessa tier and gym trailing notes', () => {
    const c = ctx({ slot: 'am', nightType: null, answers: amAnswers({ dayType: 'gym-office' }) })
    const routine = buildSequence(c)
    expect(ids(routine)).toContain('anessa-perfect-uv-gold')
    expect(routine.advisories.join(' ')).toMatch(/CeraVe SA/i)
    expect(routine.advisories.join(' ')).toMatch(/Certain Dri/i)
  })

  test('AM whitehead patches: VT patch first (daytime-capable)', () => {
    const c = ctx({
      slot: 'am',
      nightType: null,
      answers: amAnswers({ dayType: 'office', patches: 'whitehead' }),
    })
    const routine = buildSequence(c)
    expect(ids(routine)[0]).toBe('vt-pro-cica-patch')
    expectSafe(c, routine)
  })
})

describe('weather integration', () => {
  const hot = {
    tempC: 30,
    humidityPct: 70,
    uvIndex: 9,
    conditions: 'Sunny',
    fetchedAt: '2026-07-06T07:00:00+10:00',
  }

  test('hot/humid AM → skip-moisturiser advisory', () => {
    const c = ctx({ slot: 'am', nightType: null, answers: amAnswers({ dayType: 'office' }), weather: hot })
    expect(buildSequence(c).advisories.join(' ')).toMatch(/moisturiser/i)
  })

  test('UV ≥ 8 → reapplication emphasis advisory', () => {
    const c = ctx({ slot: 'am', nightType: null, answers: amAnswers({ dayType: 'office' }), weather: hot })
    expect(buildSequence(c).advisories.join(' ')).toMatch(/reappl/i)
  })

  test('UV ≥ 3 + outdoor → SPF flagged mandatory', () => {
    const c = ctx({
      slot: 'am',
      nightType: null,
      answers: amAnswers({ dayType: 'outdoor' }),
      weather: { ...hot, uvIndex: 4 },
    })
    expect(buildSequence(c).advisories.join(' ')).toMatch(/SPF.*(mandatory|non-negotiable)/i)
  })

  test('35°C+ → Anti-Shine suggestion', () => {
    const c = ctx({
      slot: 'am',
      nightType: null,
      answers: amAnswers({ dayType: 'office' }),
      weather: { ...hot, tempC: 36 },
    })
    expect(buildSequence(c).advisories.join(' ')).toMatch(/Anti-Shine/i)
  })

  test('hot/humid + oily PM → moisturiser-optional suggestion, never forced off', () => {
    const c = ctx({
      date: SUNDAY,
      answers: pmAnswers({ skinStates: ['oily'] }),
      weather: hot,
    })
    const routine = buildSequence(c)
    expect(ids(routine)).toContain('cosrx-snail-92') // still present
    expect(routine.advisories.join(' ')).toMatch(/moisturiser/i)
  })
})

describe('conditional swaps and exclusions', () => {
  test('barrier-emergency simple night (irritated + tight cheeks) → Gokujyun Gold replaces Shirojyun', () => {
    const c = ctx({
      date: SUNDAY,
      answers: pmAnswers({ skinStates: ['irritated', 'dry-tight-cheeks'] }),
    })
    const routine = buildSequence(c)
    const list = ids(routine)
    expect(list).toContain('gokujyun-premium-gold')
    expect(list).not.toContain('shirojyun-premium')
    expect(routine.advisories.join(' ')).toMatch(/TXA/i)
  })

  test('disabled products are excluded from generation', () => {
    const products = PRODUCTS.map((p) =>
      p.id === 'skin1004-centella' ? { ...p, enabled: false } : p,
    )
    const c = ctx({ date: SUNDAY, nightType: 'bha', products })
    expect(ids(buildSequence(c))).not.toContain('skin1004-centella')
  })

  test('every product step carries technique text from products.json', () => {
    const c = ctx({ date: SUNDAY, nightType: 'bha' })
    const routine = buildSequence(c)
    for (const step of routine.steps) {
      if (step.kind === 'product' && step.productId !== null) {
        const product = PRODUCTS.find((p) => p.id === step.productId)
        expect(step.technique).toBe(product?.technique)
      }
    }
  })
})
