/**
 * Top-level engine entry point: questionnaire answers + state in,
 * conflicts or a resolved routine out. Pure — no I/O, no clocks.
 */
import type {
  ConflictEffect,
  ConflictSet,
  EngineInput,
  EngineResult,
  PmAnswers,
  RoutineStep,
} from './types'
import { applySpotAnswers, buildEscalationCard, shouldEndBenzacMode, shouldOfferEscalation } from './spots'
import { selectNightType } from './nightType'
import { buildSequence } from './sequence'
import { isInPurgeWindow } from './adapalene'
import { validateRoutineSafety } from './safety'

export function generateRoutine(input: EngineInput): EngineResult {
  const updatedSpots = applySpotAnswers(input.spots, input.answers, input.date)
  const appliedEffects: ConflictEffect[] = []
  const conflicts: ConflictSet[] = []

  if (input.answers.slot === 'am') {
    const routine = buildSequence({ ...input, nightType: null, spots: updatedSpots })
    addSharedAdvisories(input, routine.advisories)
    assertSafe(input, routine.steps)
    return { conflicts: [], routine, appliedEffects, updatedSpots }
  }

  const answers: PmAnswers = input.answers

  // Benzac mode lifecycle — ends automatically at the cap or on improvement.
  let benzacActive = input.settings.benzacMode !== null
  if (
    input.settings.benzacMode !== null &&
    shouldEndBenzacMode(input.settings.benzacMode, updatedSpots, input.history, input.date)
  ) {
    benzacActive = false
    appliedEffects.push({ type: 'end-benzac-mode' })
  }

  // Spot escalation cards — Benzac mode is only ever entered by acceptance here.
  for (const spot of updatedSpots) {
    if (!shouldOfferEscalation(spot, input.history, input.date)) continue
    const card = buildEscalationCard(spot)
    const choice = input.conflictChoices.find((c) => c.conflictId === card.id)
    if (!choice) {
      conflicts.push(card)
      continue
    }
    const option = card.options.find((o) => o.id === choice.chosenOptionId)
    for (const effect of option?.effects ?? []) {
      appliedEffects.push(effect)
      if (effect.type === 'start-benzac-mode') benzacActive = true
    }
  }

  const selection = selectNightType({
    date: input.date,
    settings: input.settings,
    history: input.history,
    answers,
    benzacActive,
    conflictChoices: input.conflictChoices,
  })

  if (selection.kind === 'conflict') {
    conflicts.push(selection.conflict)
  } else {
    // Effects of the conflict choice (if any) that resolved the night type.
    appliedEffects.push(...selection.effects)
  }

  if (conflicts.length > 0) {
    return { conflicts, routine: null, appliedEffects, updatedSpots }
  }

  // No conflicts remain, so the selection necessarily resolved to a night.
  const nightType = (selection as Extract<typeof selection, { kind: 'night' }>).nightType
  const routine = buildSequence({ ...input, nightType, spots: updatedSpots })
  addSharedAdvisories(input, routine.advisories)
  if (answers.adapaleneReport === 'stinging-on-application') {
    routine.advisories.push(
      'Stinging on application usually means skin wasn’t fully dry — next time, buffer with Snail 92 first and wait longer.',
    )
  }
  assertSafe(input, routine.steps)
  return { conflicts: [], routine, appliedEffects, updatedSpots }
}

function addSharedAdvisories(input: EngineInput, advisories: string[]): void {
  if (isInPurgeWindow(input.settings.adapalene, input.date)) {
    advisories.unshift(
      'Purge window (weeks 3–8 of full-face adapalene) — new small spots in usual zones are likely purge, not regression.',
    )
  }
}

/** The engine must never emit an unsafe routine — a violation here is a bug. */
function assertSafe(input: EngineInput, steps: RoutineStep[]): void {
  const violations = validateRoutineSafety(steps, input.products, input.slot, {
    establishedTnUnlock: input.settings.establishedUnlocks.tnOnAdapaleneNights,
    establishedVc100Unlock: input.settings.establishedUnlocks.vc100OnAdapaleneNights,
  })
  if (violations.length > 0) {
    throw new Error(`Engine produced an unsafe routine: ${violations.join('; ')}`)
  }
}
