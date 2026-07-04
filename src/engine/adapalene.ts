import type {
  AdapalenePhase,
  AdapalenePhaseTransition,
  AdapaleneState,
  IsoDate,
  Session,
} from './types'
import { ADAPALENE_PHASES } from './types'
import { diffDays } from './dates'
import { quotaCounts } from './quotas'

const WEEKLY_TARGETS: Record<AdapalenePhase, number> = {
  'patch-test': 0,
  preauricular: 1,
  'one-cheek': 1,
  'full-face-1x': 1,
  'full-face-2x': 2,
  'full-face-3x': 3,
  established: 3,
}

export function phaseWeeklyTarget(phase: AdapalenePhase): number {
  return WEEKLY_TARGETS[phase]
}

export function nextPhase(phase: AdapalenePhase): AdapalenePhase | null {
  const i = ADAPALENE_PHASES.indexOf(phase)
  return ADAPALENE_PHASES[i + 1] ?? null
}

export function previousPhase(phase: AdapalenePhase): AdapalenePhase | null {
  const i = ADAPALENE_PHASES.indexOf(phase)
  return i > 0 ? (ADAPALENE_PHASES[i - 1] as AdapalenePhase) : null
}

/** Minimum nights between applications: 1×/wk → 7, 2×/wk → 3, 3×/wk → 2. */
function minGapDays(target: number): number {
  return Math.floor(7 / target)
}

/**
 * Due when the rolling-7 application count is under the phase target and
 * the spacing gap since the last application allows tonight.
 */
export function isAdapaleneDue(
  state: AdapaleneState,
  history: Session[],
  today: IsoDate,
): boolean {
  const target = phaseWeeklyTarget(state.phase)
  if (target === 0) return false
  if (quotaCounts(history, today).adapalene >= target) return false
  if (state.lastApplication === null) return true
  return diffDays(state.lastApplication, today) >= minGapDays(target)
}

/** Purge window: weeks 3–8 (days 14–55) from first full-face use. */
export function isInPurgeWindow(state: AdapaleneState, today: IsoDate): boolean {
  if (state.firstFullFace === null) return false
  const d = diffDays(state.firstFullFace, today)
  return d >= 14 && d < 56
}

/**
 * Manual phase change (Settings) — any phase selectable, forwards or backwards.
 * The engine never calls this on its own; progression is user-controlled.
 */
export function advanceToPhase(
  state: AdapaleneState,
  toPhase: AdapalenePhase,
  date: IsoDate,
): { state: AdapaleneState; transition: AdapalenePhaseTransition } {
  return {
    state: { ...state, phase: toPhase, phaseStart: date },
    transition: { date, fromPhase: state.phase, toPhase },
  }
}

const SITE_WORDING: Record<AdapalenePhase, string> = {
  'patch-test': 'the small patch-test area only (side of the jaw)',
  preauricular: 'the strips in front of each ear (preauricular) only',
  'one-cheek': 'one cheek only — the same cheek each time',
  'full-face-1x': 'the full face (pea-sized amount)',
  'full-face-2x': 'the full face (pea-sized amount)',
  'full-face-3x': 'the full face (pea-sized amount)',
  established: 'the full face (pea-sized amount)',
}

export function applicationSiteWording(phase: AdapalenePhase): string {
  return SITE_WORDING[phase]
}

const GUIDANCE: Record<AdapalenePhase, string> = {
  'patch-test':
    'Assess the patch-test site for a few days. If calm, advance to the preauricular phase in Settings.',
  preauricular:
    'Typically about 1 week tolerating the preauricular strips before advancing.',
  'one-cheek': 'Typically about 1 week tolerating one cheek before advancing to full face.',
  'full-face-1x':
    'Typically about 1 week tolerating full face at 1× per week before moving to 2×.',
  'full-face-2x': 'Typically 2–3 weeks at 2× per week before moving to 3×.',
  'full-face-3x':
    'Once 3× per week is comfortable for a few weeks, you can mark the phase as established.',
  established:
    'Established: adapalene and BHA alternate as the two anchor actives on separate nights.',
}

export function phaseGuidance(phase: AdapalenePhase): string {
  return GUIDANCE[phase]
}
