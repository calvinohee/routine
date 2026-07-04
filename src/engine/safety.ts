/**
 * Hardcoded chemistry/safety rules (brief Section 5.3).
 * These are science, not preference — they are NOT user-editable.
 */
import type {
  AdapalenePhase,
  IsoDate,
  NightType,
  Product,
  RoutineStep,
  Session,
  SkinState,
  Slot,
} from './types'
import { addDays, consecutiveRunEndingAt } from './dates'
import { exfoliantRetinoidDates } from './quotas'

// Rule 12 — BHA requires an explicit timed wait before the next layer.
export const BHA_WAIT_MIN_MINUTES = 5
export const BHA_WAIT_MAX_MINUTES = 10

// Rule 13 — Melano CC Premium (not Men) is the vitamin C on BHA nights.
export const BHA_NIGHT_VITAMIN_C_ID = 'melano-cc-premium'

// Rule 6 — Benzac hard cap.
export const BENZAC_MAX_CONSECUTIVE_NIGHTS = 5

/**
 * Rule 3 — never 3 consecutive nights of any leave-on exfoliant or retinoid;
 * BHA and adapalene count jointly. True when tonight would be the 3rd.
 */
export function wouldExceedConsecutiveActiveCap(history: Session[], today: IsoDate): boolean {
  const yesterday = addDays(today, -1)
  return consecutiveRunEndingAt(exfoliantRetinoidDates(history), yesterday) >= 2
}

/** Consecutive Benzac nights ending yesterday (tonight would be n+1). */
export function benzacConsecutiveNights(history: Session[], today: IsoDate): number {
  const dates = history
    .filter((s) => s.slot === 'pm' && s.nightType === 'benzac')
    .map((s) => s.date)
  return consecutiveRunEndingAt(dates, addDays(today, -1))
}

/** Rule 7 — skip Shirojyun on TN nights (TXA redundancy); retain on VC100 nights. */
export function includeShirojyunOnNight(nightType: NightType): boolean {
  return nightType !== 'tn'
}

/** Rule 8 — skip OBK Balancing Tuner when cheeks are dry/tight (alcohol). */
export function includeTuner(skinStates: SkinState[]): boolean {
  return !skinStates.includes('dry-tight-cheeks')
}

/** Rule 14 — double cleanse (oil first) is mandatory when SPF, CC cream, or wax was worn. */
export function needsDoubleCleanse(worn: { spf: boolean; cc: boolean; wax: boolean }): boolean {
  return worn.spf || worn.cc || worn.wax
}

/** Rule 11 — intro/build phases use the isolated adapalene sequence only. */
export function isAdapaleneIsolatedPhase(phase: AdapalenePhase): boolean {
  return phase !== 'established'
}

function tagsOf(step: RoutineStep, products: Product[]): string[] {
  const product = products.find((p) => p.id === step.productId)
  return product ? product.activeTags : []
}

/**
 * Invariant checker over a resolved step list. Returns human-readable
 * violations — a correct engine always produces an empty array, and the
 * generator asserts this before returning a routine.
 */
export function validateRoutineSafety(
  steps: RoutineStep[],
  products: Product[],
  slot: Slot,
): string[] {
  const violations: string[] = []
  const ids = steps.map((s) => s.productId)
  const has = (id: string) => ids.includes(id)

  if (slot === 'pm') {
    // Rule 1 — Melano CC Men is AM-only, always; never two salicylic-acid sources in one PM.
    if (has('melano-cc-men')) {
      violations.push('Melano CC Men is AM-only — it must never appear in a PM routine')
    }
    const salicylicCount = steps.filter((s) => tagsOf(s, products).includes('salicylic-acid')).length
    if (salicylicCount > 1) {
      violations.push('Two salicylic-acid sources in one PM')
    }

    // Rule 4 — one leave-on active serum per PM (BHA, retinoid, TN count; vitamin C does not).
    const leaveOnActives = steps.filter((s) => {
      const tags = tagsOf(s, products)
      return tags.includes('bha') || tags.includes('retinoid') || tags.includes('leave-on-serum')
    }).length
    if (leaveOnActives > 1) {
      violations.push('More than one leave-on active in one PM')
    }
  }

  // Rule 2 — forbidden same-night pairings.
  const tagPresent = (tag: string) => steps.some((s) => tagsOf(s, products).includes(tag))
  const pairs: Array<[string, string, string]> = [
    ['bha', 'retinoid', 'BHA and adapalene must never share a night'],
    ['bha', 'benzoyl-peroxide', 'BHA and Benzac must never share a night'],
    ['retinoid', 'benzoyl-peroxide', 'Benzac and adapalene must never share a night'],
    ['retinoid', 'clay-mask', 'Adapalene and clay must never share a night'],
    // Rule 5 — never clay and sheet mask in the same session.
    ['clay-mask', 'sheet-mask', 'Clay and sheet mask must never share a session'],
  ]
  for (const [a, b, message] of pairs) {
    if (tagPresent(a) && tagPresent(b)) violations.push(message)
  }

  // Rule 9 — patches go on clean, bare, dry skin before all products,
  // EXCEPT the COSRX pillow barrier, which goes over settled Pair as the final step.
  const firstProductIndex = steps.findIndex((s) => s.kind === 'product')
  steps.forEach((step, i) => {
    if (step.kind !== 'patch') return
    if (step.productId === 'cosrx-master-patch') {
      if (i !== steps.length - 1) {
        violations.push('COSRX pillow barrier must be the final step (over settled Pair)')
      }
      return
    }
    if (firstProductIndex !== -1 && i > firstProductIndex) {
      violations.push('Patches must be applied to bare, dry skin before all products')
    }
  })

  // Rule 10 — Pair Acne Cream W: absolute last step after moisturiser
  // (only the COSRX pillow barrier may follow it).
  const pairIndex = ids.indexOf('pair-acne-cream-w')
  if (pairIndex !== -1) {
    const followers = steps.slice(pairIndex + 1)
    if (followers.some((s) => s.productId !== 'cosrx-master-patch')) {
      violations.push('Pair must be the absolute last step after moisturiser')
    }
    const moisturiserIndex = steps.findIndex((s) => {
      const product = products.find((p) => p.id === s.productId)
      return product?.category === 'moisturiser'
    })
    if (moisturiserIndex !== -1 && moisturiserIndex > pairIndex) {
      violations.push('Pair must come after the moisturiser')
    }
  }

  return violations
}
