/**
 * Spot tracking and Benzac escalation (brief Section 5.6).
 * Benzac mode is ONLY ever entered by user acceptance of an escalation card.
 */
import type {
  Answers,
  BenzacModeState,
  ConflictSet,
  IsoDate,
  Session,
  Spot,
} from './types'
import { addDays, consecutiveRunEndingAt } from './dates'
import { BENZAC_MAX_CONSECUTIVE_NIGHTS, benzacConsecutiveNights } from './safety'

export const PAIR_ESCALATION_NIGHTS = 5

/**
 * Fold questionnaire answers into the spot list: create spots for new
 * reports (skipping duplicates in the same zone/type), append status
 * updates, and mark spots healed after two consecutive 'better' reports.
 */
export function applySpotAnswers(spots: Spot[], answers: Answers, date: IsoDate): Spot[] {
  let result = spots.map((s) => ({ ...s, updates: [...s.updates] }))

  for (const report of answers.newSpots) {
    const duplicate = result.some(
      (s) => s.state === 'active' && s.zone === report.zone && s.type === report.type,
    )
    if (duplicate) continue
    result = [
      ...result,
      {
        id: `${report.zone}-${report.type}-${date}`,
        zone: report.zone,
        type: report.type,
        startDate: date,
        updates: [],
        state: 'active',
      },
    ]
  }

  const updates = answers.slot === 'pm' ? answers.spotUpdates : []
  for (const update of updates) {
    const target = result.find((s) => s.id === update.spotId)
    if (!target) continue
    // Re-logging the same evening replaces that day's update (idempotent),
    // so a redo can never stack two same-day "better"s into a false heal.
    target.updates = target.updates.filter((u) => u.date !== date)
    const previous = target.updates[target.updates.length - 1]
    target.updates.push({ date, status: update.status })
    if (target.state === 'active' || target.state === 'healed') {
      target.state =
        update.status === 'better' && previous?.status === 'better' ? 'healed' : 'active'
    }
  }

  return result
}

/** Consecutive Pair-treated nights for this spot, ending last night. */
export function pairNightRun(spot: Spot, history: Session[], today: IsoDate): number {
  const dates = history
    .filter((s) => s.slot === 'pm' && s.pairSpotIds.includes(spot.id))
    .map((s) => s.date)
  return consecutiveRunEndingAt(dates, addDays(today, -1))
}

/**
 * Escalation triggers at 5 consecutive Pair nights with no improvement,
 * only for spots still in normal tracking.
 */
export function shouldOfferEscalation(spot: Spot, history: Session[], today: IsoDate): boolean {
  if (spot.state !== 'active') return false
  const run = pairNightRun(spot, history, today)
  if (run < PAIR_ESCALATION_NIGHTS) return false
  const runStart = addDays(today, -run)
  const improvedDuringRun = spot.updates.some((u) => u.status === 'better' && u.date >= runStart)
  return !improvedDuringRun
}

/**
 * The escalation card. Benzac requires closed, unbroken skin — boils are
 * flagged for the dermatologist instead.
 */
export function buildEscalationCard(spot: Spot): ConflictSet {
  const benzacEligible = spot.type !== 'boil'
  const continueOption = {
    id: 'continue-pair',
    label: 'Keep going with Pair on this spot',
    cost: `Already ${PAIR_ESCALATION_NIGHTS} nights without improvement — more of the same may not shift it`,
    nightType: 'simple' as const,
    effects: [],
  }
  const options = benzacEligible
    ? [
        {
          id: 'start-benzac',
          label: 'Start Benzac mode (short-contact benzoyl peroxide wash, max 5 nights)',
          cost: 'Pauses BHA and adapalene while active; can be drying',
          nightType: 'benzac' as const,
          effects: [{ type: 'start-benzac-mode' as const, spotId: spot.id }],
        },
        continueOption,
      ]
    : [
        {
          id: 'flag-derm',
          label: 'Flag this spot for a dermatologist visit',
          cost: 'No home treatment tonight beyond a simple night',
          nightType: 'simple' as const,
          effects: [{ type: 'flag-derm' as const, spotId: spot.id }],
        },
        continueOption,
      ]
  return {
    id: `escalation-${spot.id}`,
    reason: `${PAIR_ESCALATION_NIGHTS} consecutive Pair nights on this ${spot.type} with no improvement`,
    options,
    recommendedOptionId: benzacEligible ? 'start-benzac' : 'flag-derm',
  }
}

/**
 * Benzac mode ends automatically at the 5-night hard cap, or as soon as the
 * user marks the target spot improved.
 */
export function shouldEndBenzacMode(
  mode: BenzacModeState,
  spots: Spot[],
  history: Session[],
  today: IsoDate,
): boolean {
  if (benzacConsecutiveNights(history, today) >= BENZAC_MAX_CONSECUTIVE_NIGHTS) return true
  const target = spots.find((s) => s.id === mode.spotId)
  if (!target) return true
  return target.updates.some((u) => u.date >= mode.startedDate && u.status === 'better')
}
