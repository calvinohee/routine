/**
 * Night-type selection — the priority ladder of brief Section 5.4, with
 * conflict-card emission (Section 5.5) where rules collide.
 *
 * Design decision: hardcoded chemistry/safety rules (Section 5.3) are
 * inviolable — conflict cards only ever offer safe options.
 */
import type {
  ConflictChoiceLog,
  ConflictEffect,
  ConflictSet,
  IsoDate,
  NightType,
  PmAnswers,
  Session,
  Settings,
} from './types'
import { weekdayOf, addDays } from './dates'
import { quotaCounts } from './quotas'
import { exfoliantRetinoidDates } from './quotas'
import { isAdapaleneDue } from './adapalene'
import { wouldExceedConsecutiveActiveCap } from './safety'

export interface NightSelectionContext {
  date: IsoDate
  settings: Settings
  history: Session[]
  answers: PmAnswers
  /** Benzac mode active and not yet terminating (resolved by the caller). */
  benzacActive: boolean
  conflictChoices: ConflictChoiceLog[]
}

export type NightSelection =
  | { kind: 'night'; nightType: NightType; effects: ConflictEffect[] }
  | { kind: 'conflict'; conflict: ConflictSet }

function night(nightType: NightType, effects: ConflictEffect[] = []): NightSelection {
  return { kind: 'night', nightType, effects }
}

function resolveOrEmit(ctx: NightSelectionContext, conflict: ConflictSet): NightSelection {
  const choice = ctx.conflictChoices.find((c) => c.conflictId === conflict.id)
  if (choice) {
    const option = conflict.options.find((o) => o.id === choice.chosenOptionId)
    if (option) return night(option.nightType, option.effects)
  }
  return { kind: 'conflict', conflict }
}

export function selectNightType(ctx: NightSelectionContext): NightSelection {
  const { date, settings, history, answers } = ctx
  const skin = answers.skinStates
  const irritated = skin.includes('irritated')
  const counts = quotaCounts(history, date)

  // 1 — Benzac mode.
  if (ctx.benzacActive) return night('benzac')

  // 2 — Pre-assigned mask day.
  const weekday = weekdayOf(date)
  const mask: 'clay' | 'vc100' | null =
    settings.preassigned.clay === weekday
      ? 'clay'
      : settings.preassigned.vc100 === weekday
        ? 'vc100'
        : null
  if (mask) {
    if (irritated || skin.includes('true-breakout')) {
      return resolveOrEmit(ctx, {
        id: `mask-vs-irritation-${date}`,
        reason: `Tonight is the pre-assigned ${mask === 'clay' ? 'clay' : 'VC100 sheet'} mask night, but your skin is flaring`,
        options: [
          {
            id: 'swap-simple',
            label: 'Swap to a simple night and reschedule the mask',
            cost: 'The mask moves to a later night this week',
            nightType: 'simple',
            effects: [{ type: 'reschedule-mask', mask }],
          },
          {
            id: 'keep-mask',
            label: 'Keep the mask night as planned',
            cost: 'Masking on flaring skin risks further irritation',
            nightType: mask,
            effects: [],
          },
        ],
        recommendedOptionId: 'swap-simple',
      })
    }
    return night(mask)
  }

  // 3 — Adapalene (top active priority). Hard rule: never a 3rd consecutive
  // exfoliant/retinoid night — if capped, defer silently.
  const capped = wouldExceedConsecutiveActiveCap(history, date)
  const adapaleneDue = isAdapaleneDue(settings.adapalene, history, date)
  if (adapaleneDue && !capped) {
    const reactionFlagged = irritated || answers.adapaleneReport === 'reaction-tonight'
    if (reactionFlagged) {
      return resolveOrEmit(ctx, {
        id: `adapalene-vs-reaction-${date}`,
        reason: 'Adapalene is due tonight, but a skin reaction is flagged',
        options: [
          {
            id: 'skip-adapalene',
            label: 'Skip adapalene tonight — simple barrier night',
            cost: 'The weekly adapalene target may land short this window',
            nightType: 'simple',
            effects: [],
          },
          {
            id: 'apply-adapalene',
            label: 'Apply adapalene as scheduled',
            cost: 'Applying over reacting skin can worsen irritation',
            nightType: 'adapalene',
            effects: [],
          },
        ],
        recommendedOptionId: 'skip-adapalene',
      })
    }
    return night('adapalene')
  }

  // Irritated skin biases everything below toward simple.
  if (irritated) return night('simple')

  const bhaBehind = counts.bha < settings.quotas.bha
  const tnBehind = counts.tn < settings.quotas.tn

  // 4 — BHA: behind quota, spacing allows (roughly every-other-night — never
  // straight after an active night, and never a 3rd consecutive active night).
  const yesterdayActive = exfoliantRetinoidDates(history).includes(addDays(date, -1))
  const bhaSpacingOk = !capped && !yesterdayActive
  if (bhaBehind && bhaSpacingOk) {
    if (tnBehind) {
      return resolveOrEmit(ctx, {
        id: `two-actives-due-${date}`,
        reason: 'BHA and TN are both behind quota and both fit tonight',
        options: [
          {
            id: 'choose-bha',
            label: 'BHA night',
            cost: 'TN stays behind quota for now',
            nightType: 'bha',
            effects: [],
          },
          {
            id: 'choose-tn',
            label: 'TN night',
            cost: 'BHA stays behind its 3×/week floor for now',
            nightType: 'tn',
            effects: [],
          },
        ],
        recommendedOptionId: 'choose-bha',
      })
    }
    return night('bha')
  }

  // Quota pressure vs spacing: BHA is behind but spacing blocks it tonight.
  if (bhaBehind && !bhaSpacingOk && tnBehind) {
    return resolveOrEmit(ctx, {
      id: `quota-vs-spacing-${date}`,
      reason: 'BHA is behind quota but last night was an active night — spacing blocks it',
      options: [
        {
          id: 'choose-tn',
          label: 'TN night (no exfoliant, quota progress elsewhere)',
          cost: 'BHA stays behind its floor until spacing clears',
          nightType: 'tn',
          effects: [],
        },
        {
          id: 'choose-simple',
          label: 'Simple barrier night',
          cost: 'Both BHA and TN stay behind quota tonight',
          nightType: 'simple',
          effects: [],
        },
      ],
      recommendedOptionId: 'choose-tn',
    })
  }

  // 5 — TN.
  if (tnBehind) return night('tn')

  // 6 — Simple.
  return night('simple')
}
