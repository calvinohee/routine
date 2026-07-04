import { describe, expect, test } from 'vitest'
import {
  BENZAC_MAX_CONSECUTIVE_NIGHTS,
  BHA_WAIT_MIN_MINUTES,
  BHA_WAIT_MAX_MINUTES,
  BHA_NIGHT_VITAMIN_C_ID,
  wouldExceedConsecutiveActiveCap,
  benzacConsecutiveNights,
  includeShirojyunOnNight,
  includeTuner,
  needsDoubleCleanse,
  isAdapaleneIsolatedPhase,
  validateRoutineSafety,
} from '../safety'
import type { Product, RoutineStep } from '../types'
import { pmSession } from './fixtures'
import productsJson from '../../../products.json'

const PRODUCTS = productsJson.products as Product[]

function productStep(productId: string): RoutineStep {
  return { kind: 'product', productId, title: productId, purpose: '', technique: '', waitMinutes: 0 }
}

function patchStep(productId: string): RoutineStep {
  return { kind: 'patch', productId, title: productId, purpose: '', technique: '', waitMinutes: 0 }
}

const TODAY = '2026-07-04'

describe('rule 3 — never 3 consecutive leave-on exfoliant/retinoid nights (BHA + adapalene jointly)', () => {
  test('two consecutive active nights block a third', () => {
    const history = [pmSession('2026-07-02', 'bha'), pmSession('2026-07-03', 'adapalene')]
    expect(wouldExceedConsecutiveActiveCap(history, TODAY)).toBe(true)
  })

  test('a single active night yesterday does not block tonight', () => {
    const history = [pmSession('2026-07-03', 'bha')]
    expect(wouldExceedConsecutiveActiveCap(history, TODAY)).toBe(false)
  })

  test('two active nights separated by a gap do not block', () => {
    const history = [pmSession('2026-07-01', 'bha'), pmSession('2026-07-03', 'bha')]
    expect(wouldExceedConsecutiveActiveCap(history, TODAY)).toBe(false)
  })
})

describe('rule 6 — Benzac consecutive-night cap', () => {
  test('cap constant is 5', () => {
    expect(BENZAC_MAX_CONSECUTIVE_NIGHTS).toBe(5)
  })

  test('counts consecutive benzac nights ending yesterday', () => {
    const history = [
      pmSession('2026-07-01', 'benzac'),
      pmSession('2026-07-02', 'benzac'),
      pmSession('2026-07-03', 'benzac'),
    ]
    expect(benzacConsecutiveNights(history, TODAY)).toBe(3)
  })

  test('a non-benzac night resets the count', () => {
    const history = [pmSession('2026-07-01', 'benzac'), pmSession('2026-07-02', 'simple'), pmSession('2026-07-03', 'benzac')]
    expect(benzacConsecutiveNights(history, TODAY)).toBe(1)
  })

  test('zero when last night was not benzac', () => {
    const history = [pmSession('2026-07-02', 'benzac')]
    expect(benzacConsecutiveNights(history, TODAY)).toBe(0)
  })
})

describe('rule 7 — Shirojyun skipped on TN nights, retained on VC100 nights', () => {
  test('skipped on tn', () => {
    expect(includeShirojyunOnNight('tn')).toBe(false)
  })

  test.each(['bha', 'vc100', 'simple', 'adapalene', 'clay', 'benzac'] as const)(
    'retained on %s',
    (night) => {
      expect(includeShirojyunOnNight(night)).toBe(true)
    },
  )
})

describe('rule 8 — OBK Tuner skipped when cheeks are dry/tight', () => {
  test('skipped with dry-tight-cheeks', () => {
    expect(includeTuner(['dry-tight-cheeks'])).toBe(false)
  })

  test('included otherwise', () => {
    expect(includeTuner(['clear'])).toBe(true)
  })
})

describe('rule 14 — double cleanse triggers', () => {
  test.each([
    [{ spf: true, cc: false, wax: false }, true],
    [{ spf: false, cc: true, wax: false }, true],
    [{ spf: false, cc: false, wax: true }, true],
    [{ spf: false, cc: false, wax: false }, false],
  ])('%o → %s', (worn, expected) => {
    expect(needsDoubleCleanse(worn)).toBe(expected)
  })
})

describe('rule 11 — adapalene isolated sequence during intro/build phases', () => {
  test.each(['patch-test', 'preauricular', 'one-cheek', 'full-face-1x', 'full-face-2x', 'full-face-3x'] as const)(
    '%s uses the isolated sequence',
    (phase) => {
      expect(isAdapaleneIsolatedPhase(phase)).toBe(true)
    },
  )

  test('established does not require isolation', () => {
    expect(isAdapaleneIsolatedPhase('established')).toBe(false)
  })
})

describe('rules 12–13 — BHA wait and BHA-night vitamin C', () => {
  test('BHA wait window is 5–10 minutes', () => {
    expect(BHA_WAIT_MIN_MINUTES).toBe(5)
    expect(BHA_WAIT_MAX_MINUTES).toBe(10)
  })

  test('Melano CC Premium (not Men) is the BHA-night vitamin C', () => {
    expect(BHA_NIGHT_VITAMIN_C_ID).toBe('melano-cc-premium')
  })
})

describe('validateRoutineSafety — resolved-step invariants', () => {
  test('rule 1: two salicylic-acid sources in one PM is a violation', () => {
    const steps = [productStep('pc-bha'), productStep('melano-cc-men')]
    const violations = validateRoutineSafety(steps, PRODUCTS, 'pm')
    expect(violations.some((v) => v.includes('salicylic'))).toBe(true)
  })

  test('rule 1: Melano CC Men in any PM is a violation (AM-only, always)', () => {
    const violations = validateRoutineSafety([productStep('melano-cc-men')], PRODUCTS, 'pm')
    expect(violations.length).toBeGreaterThan(0)
  })

  test('rule 1: Melano CC Men in AM is fine', () => {
    const violations = validateRoutineSafety([productStep('melano-cc-men')], PRODUCTS, 'am')
    expect(violations).toEqual([])
  })

  test('rule 2: BHA + adapalene sharing a night is a violation', () => {
    const steps = [productStep('pc-bha'), productStep('differin-adapalene')]
    expect(validateRoutineSafety(steps, PRODUCTS, 'pm').length).toBeGreaterThan(0)
  })

  test('rule 2: Benzac + adapalene is a violation', () => {
    const steps = [productStep('benzac-wash-5'), productStep('differin-adapalene')]
    expect(validateRoutineSafety(steps, PRODUCTS, 'pm').length).toBeGreaterThan(0)
  })

  test('rule 2: adapalene + clay is a violation', () => {
    const steps = [productStep('differin-adapalene'), productStep('lrp-effaclar-clay')]
    expect(validateRoutineSafety(steps, PRODUCTS, 'pm').length).toBeGreaterThan(0)
  })

  test('rule 2: BHA + Benzac is a violation', () => {
    const steps = [productStep('pc-bha'), productStep('benzac-wash-5')]
    expect(validateRoutineSafety(steps, PRODUCTS, 'pm').length).toBeGreaterThan(0)
  })

  test('rule 4: BHA + TN stacked in one PM is a violation', () => {
    const steps = [productStep('pc-bha'), productStep('cosdebaha-tn')]
    const violations = validateRoutineSafety(steps, PRODUCTS, 'pm')
    expect(violations.some((v) => v.includes('leave-on active'))).toBe(true)
  })

  test('rule 5: clay and sheet mask in the same session is a violation', () => {
    const steps = [productStep('lrp-effaclar-clay'), productStep('vc100-sheet-mask')]
    expect(validateRoutineSafety(steps, PRODUCTS, 'pm').length).toBeGreaterThan(0)
  })

  test('rule 9: VT patch after a product step is a violation (must be first, bare skin)', () => {
    const steps = [productStep('pc-skin-balancing-toner'), patchStep('vt-pro-cica-patch')]
    expect(validateRoutineSafety(steps, PRODUCTS, 'pm').length).toBeGreaterThan(0)
  })

  test('rule 9: VT patch before all products is fine', () => {
    const steps = [patchStep('vt-pro-cica-patch'), productStep('pc-skin-balancing-toner')]
    expect(validateRoutineSafety(steps, PRODUCTS, 'pm')).toEqual([])
  })

  test('rule 9 exception: COSRX pillow barrier over settled Pair as final step is fine', () => {
    const steps = [
      productStep('curel-foaming-wash'),
      productStep('cosrx-snail-92'),
      productStep('pair-acne-cream-w'),
      patchStep('cosrx-master-patch'),
    ]
    expect(validateRoutineSafety(steps, PRODUCTS, 'pm')).toEqual([])
  })

  test('rule 10: Pair before the moisturiser is a violation (absolute last after moisturiser)', () => {
    const steps = [productStep('pair-acne-cream-w'), productStep('cosrx-snail-92')]
    expect(validateRoutineSafety(steps, PRODUCTS, 'pm').length).toBeGreaterThan(0)
  })

  test('a normal BHA-night sequence passes clean', () => {
    const steps = [
      productStep('curel-foaming-wash'),
      productStep('pc-skin-balancing-toner'),
      productStep('pc-bha'),
      productStep('shirojyun-premium'),
      productStep('melano-cc-premium'),
      productStep('skin1004-centella'),
      productStep('cosrx-snail-92'),
      productStep('pair-acne-cream-w'),
    ]
    expect(validateRoutineSafety(steps, PRODUCTS, 'pm')).toEqual([])
  })
})

describe('validateRoutineSafety — refinements', () => {
  test('rule 9: cleanser steps before a patch are fine (patches go on CLEAN skin)', () => {
    const steps = [
      productStep('curel-foaming-wash'),
      patchStep('vt-pro-cica-patch'),
      productStep('pc-skin-balancing-toner'),
    ]
    expect(validateRoutineSafety(steps, PRODUCTS, 'pm')).toEqual([])
  })

  test('rule 9: a null-product action step (water splash) before a patch is fine', () => {
    const steps: RoutineStep[] = [
      { kind: 'product', productId: null, title: 'Water splash', purpose: '', technique: '', waitMinutes: 0 },
      patchStep('vt-pro-cica-patch'),
      productStep('pc-skin-balancing-toner'),
    ]
    expect(validateRoutineSafety(steps, PRODUCTS, 'pm')).toEqual([])
  })

  test('rule 5: a strong active on a clay night is a violation', () => {
    const steps = [productStep('lrp-effaclar-clay'), productStep('cosdebaha-tn')]
    expect(validateRoutineSafety(steps, PRODUCTS, 'pm').length).toBeGreaterThan(0)
  })

  test('rule 5: a strong active on a sheet-mask night is a violation', () => {
    const steps = [productStep('vc100-sheet-mask'), productStep('pc-bha')]
    expect(validateRoutineSafety(steps, PRODUCTS, 'pm').length).toBeGreaterThan(0)
  })

  test('rule 5 / 5.8: TN sharing an adapalene night passes only with the established unlock', () => {
    const steps = [productStep('cosdebaha-tn'), productStep('differin-adapalene')]
    expect(validateRoutineSafety(steps, PRODUCTS, 'pm').length).toBeGreaterThan(0)
    expect(
      validateRoutineSafety(steps, PRODUCTS, 'pm', { establishedTnUnlock: true }),
    ).toEqual([])
  })

  test('rule 5 / 5.8: VC100 sharing an adapalene night passes only with the established unlock', () => {
    const steps = [productStep('vc100-sheet-mask'), productStep('differin-adapalene')]
    expect(validateRoutineSafety(steps, PRODUCTS, 'pm').length).toBeGreaterThan(0)
    expect(
      validateRoutineSafety(steps, PRODUCTS, 'pm', { establishedVc100Unlock: true }),
    ).toEqual([])
  })
})

describe('coverage of remaining validator paths', () => {
  test('COSRX pillow barrier anywhere but last is a violation', () => {
    const steps = [patchStep('cosrx-master-patch'), productStep('pc-skin-balancing-toner')]
    expect(validateRoutineSafety(steps, PRODUCTS, 'pm').length).toBeGreaterThan(0)
  })

  test('a patch-only routine is fine (no leave-on products at all)', () => {
    expect(validateRoutineSafety([patchStep('vt-pro-cica-patch')], PRODUCTS, 'pm')).toEqual([])
  })

  test('vc100 unlock does not sanction TN sharing a sheet-mask night', () => {
    const steps = [productStep('vc100-sheet-mask'), productStep('cosdebaha-tn')]
    expect(
      validateRoutineSafety(steps, PRODUCTS, 'pm', { establishedVc100Unlock: true }).length,
    ).toBeGreaterThan(0)
  })

  test('vc100 unlock does not sanction actives on a clay night', () => {
    const steps = [productStep('lrp-effaclar-clay'), productStep('cosdebaha-tn')]
    expect(
      validateRoutineSafety(steps, PRODUCTS, 'pm', { establishedVc100Unlock: true }).length,
    ).toBeGreaterThan(0)
  })

  test('tn unlock does not sanction BHA + TN', () => {
    const steps = [productStep('pc-bha'), productStep('cosdebaha-tn')]
    expect(
      validateRoutineSafety(steps, PRODUCTS, 'pm', { establishedTnUnlock: true }).length,
    ).toBeGreaterThan(0)
  })
})
