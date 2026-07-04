/**
 * Domain model for the ROUTINE rules engine.
 * Pure types only — no framework imports, no runtime code beyond const arrays
 * used as single sources of truth for unions.
 */

// ── Calendar ────────────────────────────────────────────────────────────────

/** Date as ISO `YYYY-MM-DD`. The engine never touches Date.now() or timezones. */
export type IsoDate = string

export const WEEKDAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const
export type Weekday = (typeof WEEKDAYS)[number]

export type Slot = 'am' | 'pm'

// ── Questionnaire vocabulary (Section 4) ────────────────────────────────────

export const DAY_TYPES = ['gym-office', 'office', 'wfh', 'outdoor', 'rest-indoors'] as const
export type DayType = (typeof DAY_TYPES)[number]

/** Weekly schedule may also pre-assign a run day (outdoor with run follow-up). */
export type ScheduledDayType = DayType | 'outdoor-run-day'

export type RunTiming = 'run-am' | 'run-pm' | 'no-run'

export const NIGHT_TYPES = ['bha', 'tn', 'adapalene', 'clay', 'vc100', 'simple', 'benzac'] as const
export type NightType = (typeof NIGHT_TYPES)[number]

export const SKIN_STATES = [
  'clear',
  'dry-tight-cheeks',
  'oily',
  'new-spot',
  'red-lump',
  'new-pih',
  'irritated',
  // available only during adapalene intro/build phases, PM:
  'purge-activity',
  'true-breakout',
] as const
export type SkinState = (typeof SKIN_STATES)[number]

export const ZONES = [
  'forehead',
  'nose',
  'cheek-l',
  'cheek-r',
  'jaw-l',
  'jaw-r',
  'chin',
  'below-ear-l',
  'below-ear-r',
  'preauricular-l',
  'preauricular-r',
  'neck',
] as const
export type Zone = (typeof ZONES)[number]

export type PatchNeed = 'whitehead' | 'healing-spot' | 'closed-lump' | 'none'

// ── Products (mirrors products.json) ────────────────────────────────────────

export interface Product {
  id: string
  name: string
  category: string
  status: 'active' | 'situational' | 'benched'
  enabled: boolean
  benchedReason?: string
  format: string
  function: string
  evidence: string
  technique: string
  waitMinutes: number
  waitNote?: string
  slots: Slot[]
  activeTags: string[]
  conflictTags: string[]
  conditions: string[]
}

// ── Adapalene phase machine (Section 6) ─────────────────────────────────────

export const ADAPALENE_PHASES = [
  'patch-test',
  'preauricular',
  'one-cheek',
  'full-face-1x',
  'full-face-2x',
  'full-face-3x',
  'established',
] as const
export type AdapalenePhase = (typeof ADAPALENE_PHASES)[number]

export interface AdapaleneState {
  phase: AdapalenePhase
  /** Date the current phase started. */
  phaseStart: IsoDate
  /** Date adapalene was last applied, null if never. */
  lastApplication: IsoDate | null
  /** First full-face application ever — anchors the purge window. Null until it happens. */
  firstFullFace: IsoDate | null
}

export interface AdapalenePhaseTransition {
  id?: number
  date: IsoDate
  fromPhase: AdapalenePhase | null
  toPhase: AdapalenePhase
}

// ── Weather (Section 10) ────────────────────────────────────────────────────

export interface WeatherSnapshot {
  tempC: number
  humidityPct: number
  uvIndex: number
  conditions: string
  /** ISO datetime the snapshot was fetched. */
  fetchedAt: string
}

export interface WeatherThresholds {
  hotTempC: number // default 28
  hotHumidityPct: number // default 65
  antiShineTempC: number // default 35
  coolTempC: number // default 14
  dryHumidityPct: number // default 40
  uvReapplyEmphasis: number // default 8
  uvSpfMandatory: number // default 3
}

// ── Settings (Section 11) ───────────────────────────────────────────────────

export interface BenzacModeState {
  /** Date Benzac mode was accepted via escalation card. */
  startedDate: IsoDate
  /** Spot that triggered the escalation. */
  spotId: string
}

export interface Settings {
  coordinates: { lat: number; lon: number; label: string }
  quotas: { bha: number; tn: number; clay: number; vc100: number }
  preassigned: { clay: Weekday; vc100: Weekday }
  weeklySchedule: Record<Weekday, ScheduledDayType>
  weatherThresholds: WeatherThresholds
  adapalene: AdapaleneState
  /** Active Benzac mode, or null. Only ever set by user accepting an escalation card. */
  benzacMode: BenzacModeState | null
  /** Established-phase unlocks (Section 5.8), off by default. */
  establishedUnlocks: { tnOnAdapaleneNights: boolean; vc100OnAdapaleneNights: boolean }
  theme: 'system' | 'light' | 'dark'
}

// ── Spots (Section 5.6) ─────────────────────────────────────────────────────

export type SpotType = 'spot' | 'boil' | 'closed-lump'
export type SpotProgress = 'better' | 'same' | 'worse'

export interface SpotStatusUpdate {
  date: IsoDate
  status: SpotProgress
}

export interface Spot {
  id: string
  zone: Zone
  type: SpotType
  startDate: IsoDate
  updates: SpotStatusUpdate[]
  /** Resolution: still tracked, healed, escalated to Benzac, or flagged for dermatologist. */
  state: 'active' | 'healed' | 'benzac' | 'derm-flagged'
}

// ── Questionnaire answers (Section 7) ───────────────────────────────────────

export interface NewSpotReport {
  zone: Zone
  type: SpotType
}

export type AdapaleneAmReport = 'looked-fine' | 'mild-redness' | 'notably-irritated'
export type AdapalenePmReport = 'no-reaction' | 'stinging-on-application' | 'reaction-tonight'

export interface AmAnswers {
  slot: 'am'
  dayType: DayType
  /** Only present when today is a scheduled run day and dayType is outdoor. */
  runTiming?: RunTiming
  skinStates: SkinState[]
  newSpots: NewSpotReport[]
  patches: PatchNeed
  /** Present while adapalene phase < established. */
  adapaleneReport?: AdapaleneAmReport
}

export interface SpotUpdateAnswer {
  spotId: string
  status: SpotProgress
}

export interface PmAnswers {
  slot: 'pm'
  followedAm: 'yes' | 'modified' | 'skipped'
  skinStates: SkinState[]
  newSpots: NewSpotReport[]
  spotUpdates: SpotUpdateAnswer[]
  patches: PatchNeed
  /** Present while adapalene phase < established. */
  adapaleneReport?: AdapalenePmReport
}

export type Answers = AmAnswers | PmAnswers

// ── Sessions ────────────────────────────────────────────────────────────────

export interface ConflictChoiceLog {
  conflictId: string
  chosenOptionId: string
}

export interface Session {
  id?: number
  date: IsoDate
  slot: Slot
  answers: Answers
  /** PM only — the resolved night type. */
  nightType: NightType | null
  steps: RoutineStep[]
  conflictChoices: ConflictChoiceLog[]
  weather: WeatherSnapshot | null
  adapalenePhase: AdapalenePhase
  /** Product ids of spot treatments applied to tracked spots this session (Pair). */
  pairSpotIds: string[]
}

// ── Engine output ───────────────────────────────────────────────────────────

export type StepKind = 'product' | 'wait' | 'patch' | 'note'

export interface RoutineStep {
  kind: StepKind
  /** Product id when kind is 'product' or 'patch'; null for waits/notes/water-splash. */
  productId: string | null
  title: string
  /** Purpose one-liner. */
  purpose: string
  /** Technique / quantity text (from products.json when product-backed). */
  technique: string
  /** Explicit wait before the next step, minutes. Rendered as countdown when > 1. */
  waitMinutes: number
}

export interface ConflictOption {
  id: string
  /** What happens tonight. */
  label: string
  /** What it costs. */
  cost: string
  /** Night type this option resolves to (or keeps). */
  nightType: NightType
  /** Side effects to apply if chosen. */
  effects: ConflictEffect[]
}

export type ConflictEffect =
  | { type: 'start-benzac-mode'; spotId: string }
  | { type: 'flag-derm'; spotId: string }
  | { type: 'end-benzac-mode' }
  | { type: 'reschedule-mask'; mask: 'clay' | 'vc100' }

export interface ConflictSet {
  id: string
  /** Why the engine could not silently resolve. */
  reason: string
  options: ConflictOption[]
  recommendedOptionId: string
}

export interface EngineResult {
  /** Conflicts requiring a user choice before a routine can be produced. */
  conflicts: ConflictSet[]
  /** The resolved routine; null while unresolved conflicts remain. */
  routine: ResolvedRoutine | null
  /** Effects of chosen conflict options plus automatic ones (e.g. Benzac auto-termination) — the caller persists these. */
  appliedEffects: ConflictEffect[]
  /** Spot list after folding in tonight's answers — the caller persists this on log. */
  updatedSpots: Spot[]
}

export interface ResolvedRoutine {
  nightType: NightType | null // null for AM
  steps: RoutineStep[]
  /** Non-step contextual lines (purge-window label, UV emphasis, moisturiser suggestion). */
  advisories: string[]
  /** Ids of tracked spots Pair is applied to this session (drives the Pair-night counter). */
  pairSpotIds: string[]
}

// ── Engine input ────────────────────────────────────────────────────────────

export interface EngineInput {
  date: IsoDate
  slot: Slot
  settings: Settings
  products: Product[]
  /** All sessions, most recent last. Engine only reads the trailing window it needs. */
  history: Session[]
  spots: Spot[]
  answers: Answers
  weather: WeatherSnapshot | null
  /** Choices already made for conflicts emitted earlier in this generation. */
  conflictChoices: ConflictChoiceLog[]
}
