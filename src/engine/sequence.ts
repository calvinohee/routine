/**
 * Sequencing templates (brief Section 5.7) — resolves a slot + night type +
 * answers + weather into ordered steps, pulling technique/wait text from the
 * product roster. Disabled products never appear.
 */
import type {
  Answers,
  AmAnswers,
  DayType,
  IsoDate,
  NightType,
  PmAnswers,
  Product,
  ResolvedRoutine,
  RoutineStep,
  Session,
  Settings,
  Spot,
  WeatherSnapshot,
} from './types'
import { addDays, weekdayOf } from './dates'
import { quotaCounts } from './quotas'
import {
  BHA_WAIT_MAX_MINUTES,
  BHA_WAIT_MIN_MINUTES,
  includeShirojyunOnNight,
  includeTuner,
  isAdapaleneIsolatedPhase,
  needsDoubleCleanse,
} from './safety'
import { applicationSiteWording } from './adapalene'
import { weatherModifiers, type WeatherModifiers } from './weather'

export interface SequenceContext {
  date: IsoDate
  slot: 'am' | 'pm'
  /** Resolved night type (PM); null for AM. */
  nightType: NightType | null
  answers: Answers
  settings: Settings
  products: Product[]
  history: Session[]
  spots: Spot[]
  weather: WeatherSnapshot | null
}

class RoutineBuilder {
  steps: RoutineStep[] = []
  advisories: string[] = []
  private byId: Map<string, Product>

  constructor(products: Product[]) {
    this.byId = new Map(products.map((p) => [p.id, p]))
  }

  enabled(id: string): boolean {
    return this.byId.get(id)?.enabled === true
  }

  /** Add a product-backed step if the product is enabled; no-op otherwise. */
  add(id: string, purpose: string, kind: 'product' | 'patch' = 'product'): void {
    const product = this.byId.get(id)
    if (!product?.enabled) return
    this.steps.push({
      kind,
      productId: id,
      title: product.name,
      purpose,
      technique: product.technique,
      leaveOn: product.leaveOn,
      waitMinutes: product.waitMinutes,
    })
  }

  addRaw(step: RoutineStep): void {
    this.steps.push(step)
  }

  advise(line: string): void {
    this.advisories.push(line)
  }

  /** Advisory mentioning a product — suppressed when that product is disabled. */
  adviseIf(id: string, line: string): void {
    if (this.enabled(id)) this.advisories.push(line)
  }
}

const OFFICE_LIKE: DayType[] = ['office', 'gym-office', 'outdoor']

function scheduleDayType(settings: Settings, date: IsoDate): DayType {
  const scheduled = settings.weeklySchedule[weekdayOf(date)]
  return scheduled === 'outdoor-run-day' ? 'outdoor' : scheduled
}

function todaysAm(ctx: SequenceContext): Session | undefined {
  return ctx.history.find((s) => s.date === ctx.date && s.answers.slot === 'am')
}

/** The day type in effect today (PM only — looks at the logged AM, then the schedule). */
function effectiveDayType(ctx: SequenceContext): DayType {
  const am = todaysAm(ctx)
  // todaysAm only matches sessions whose answers are AM answers.
  return am !== undefined
    ? (am.answers as AmAnswers).dayType
    : scheduleDayType(ctx.settings, ctx.date)
}

/** What went on the face today — drives the double-cleanse rule. */
function wornToday(ctx: SequenceContext, answers: PmAnswers): { spf: boolean; cc: boolean; wax: boolean } {
  if (answers.followedAm === 'skipped') return { spf: false, cc: false, wax: false }
  const dayType = effectiveDayType(ctx)
  const waxDay = dayType === 'office' || dayType === 'gym-office'
  const am = todaysAm(ctx)
  if (am === undefined) {
    // No AM logged — assume the scheduled day type's defaults were worn.
    return { spf: OFFICE_LIKE.includes(dayType), cc: false, wax: waxDay }
  }
  const spfIds = new Set(
    ctx.products.filter((p) => p.activeTags.includes('spf')).map((p) => p.id),
  )
  const stepIds = am.steps.map((s) => s.productId)
  return {
    spf: stepIds.some((id) => id !== null && spfIds.has(id)),
    cc: stepIds.includes('it-cosmetics-cc'),
    wax: waxDay,
  }
}

function weatherAdvisories(b: RoutineBuilder, mods: WeatherModifiers, slot: 'am' | 'pm'): void {
  if (slot === 'am') {
    if (mods.hotHumid) b.advise('Hot and humid today — consider skipping the AM moisturiser.')
    if (mods.antiShineUnlocked)
      b.advise('35°C+ — LRP Anthelios Anti-Shine is unlocked as today’s SPF (pat on, don’t rub).')
    if (mods.uvReapplyEmphasis)
      b.advise('UV is 8+ — reapply SPF through the day; UV drives PIH.')
    if (mods.spfMandatory)
      b.advise('UV 3+ on an outdoor day — SPF is mandatory today, whatever the clouds are doing.')
    if (mods.dryCheekBias)
      b.advise('Cool/dry conditions — skip the Tuner if cheeks feel tight and watch for dryness.')
  } else {
    if (mods.dryCheekBias)
      b.advise('Cool/dry conditions — if cheeks feel raw, Curél Moisture Cream on cheeks only; T-zone stays Snail 92.')
  }
}

// ── AM ──────────────────────────────────────────────────────────────────────

function buildAm(ctx: SequenceContext, answers: AmAnswers): ResolvedRoutine {
  const b = new RoutineBuilder(ctx.products)
  const dayType = answers.dayType
  const dryCheeks = answers.skinStates.includes('dry-tight-cheeks')
  const mods = weatherModifiers(ctx.weather, ctx.settings.weatherThresholds, dayType)

  // Patches first — VT Pro Cica is daytime-capable, on clean bare dry skin.
  if (answers.patches === 'whitehead' || answers.patches === 'healing-spot') {
    b.add('vt-pro-cica-patch', 'Protects the spot under the day — routine goes around it', 'patch')
  }
  if (answers.patches === 'closed-lump') {
    b.advise('Closed lumps get the COSRX pillow barrier tonight — no daytime patch.')
  }

  if (OFFICE_LIKE.includes(dayType)) {
    if (includeTuner(answers.skinStates)) {
      b.add('obk-balancing-tuner', 'Oil control for the T-zone through the day')
    }
    b.add('pc-skin-balancing-toner', 'Niacinamide base layer — first product on skin')
    if (dryCheeks) b.add('shirojyun-premium', 'TXA for PIH — extra press into dry cheeks')
    b.add('melano-cc-men', 'Vitamin C for brightening and PIH — daily AM')
    if (dryCheeks) b.add('cosrx-snail-92', 'Moisturiser — cheeks are notably dry today')
    if (dayType === 'outdoor') {
      b.add('boj-aqua-fresh', 'SPF — casual outdoor tier')
    } else {
      b.add('anessa-perfect-uv-gold', 'SPF — office/commute/gym tier, sweat-resistant')
    }
    if (dayType !== 'outdoor') {
      b.add('it-cosmetics-cc', 'Optional coverage — only if wearing CC today; SPF stays primary')
    }
  } else {
    b.addRaw({
      kind: 'product',
      productId: null,
      title: 'Water splash',
      purpose: 'Home morning — no cleanser needed',
      technique: 'Splash lukewarm water, pat dry.',
      waitMinutes: 0,
    })
    b.add('pc-skin-balancing-toner', 'Niacinamide base layer — first product on skin')
    if (dryCheeks) b.add('shirojyun-premium', 'TXA for PIH — extra press into dry cheeks')
    b.add('melano-cc-men', 'Vitamin C for brightening and PIH — daily AM')
    if (dryCheeks) b.add('cosrx-snail-92', 'Moisturiser — cheeks are notably dry today')
    b.add('biore-aqua-rich', 'Optional SPF — only if getting incidental sun today')
  }

  weatherAdvisories(b, mods, 'am')

  // Trailing contextual notes — day-type driven, not skincare steps.
  if (dayType === 'office' || dayType === 'gym-office' || dayType === 'outdoor') {
    b.adviseIf('braun-series-7', 'Shave first (Braun) on clean dry skin, before any skincare.')
  }
  if (dayType === 'gym-office') {
    b.adviseIf('cerave-sa-cleanser', 'Gym: CeraVe SA cleanser in the gym shower (1–2 pumps, wet skin, rinse).')
    b.adviseIf('sukin-shampoo', 'Hair: Sukin shampoo with the Muji scrubber, then Himawari conditioner.')
    b.adviseIf('certain-dri-extra', 'Certain Dri after the post-gym shower, before leaving.')
  }
  if (dayType === 'office' || dayType === 'gym-office') {
    b.adviseIf('uevo-wax', 'Style: Uevo wax on dry hair after blowdry (medium heat only).')
    b.adviseIf('issey-fragrance', 'Fragrance last: pulse points only — never on the face or SPF-covered neck.')
  }
  if (dayType === 'outdoor') {
    b.adviseIf('rohto-melty-lip', 'Lips: Rohto Melty lip SPF before leaving; reapply outdoors.')
    if (answers.runTiming === 'run-am')
      b.advise('AM run: SPF goes on before the run; cleanse and redo skincare after.')
    if (answers.runTiming === 'run-pm')
      b.advise('PM run planned: do tonight’s routine after the run.')
  }
  const weekday = weekdayOf(ctx.date)
  if (weekday === 'saturday' || weekday === 'sunday' || dayType === 'gym-office') {
    b.adviseIf('rexona-advanced', 'Deodorant: Rexona roll-on this morning.')
  }
  if (dayType === 'wfh' || dayType === 'rest-indoors') {
    b.adviseIf('moilip', 'Lips: Moilip as needed (home default).')
  }

  return { nightType: null, steps: b.steps, advisories: b.advisories, pairSpotIds: [] }
}

// ── PM ──────────────────────────────────────────────────────────────────────

function addCleansing(b: RoutineBuilder, ctx: SequenceContext, answers: PmAnswers, nightType: NightType): void {
  const worn = wornToday(ctx, answers)
  const double = needsDoubleCleanse(worn)
  if (nightType === 'benzac') {
    // Benzac replaces the second cleanse.
    if (double) b.add('curel-cleansing-oil', 'Dissolves SPF/wax first — oil cleanse on dry skin')
    b.add('benzac-wash-5', 'Short-contact benzoyl peroxide: leave 60–90 seconds, then rinse')
    return
  }
  if (double) {
    b.add('curel-cleansing-oil', 'Dissolves SPF/wax first — oil cleanse on dry skin')
    b.add('curel-foaming-wash', 'Second cleanse — lifts what the oil left behind')
  } else {
    b.add('curel-foaming-wash', 'Single gentle cleanse — nothing heavy was worn today')
  }
}

function clayProductId(b: RoutineBuilder, answers: PmAnswers, spots: Spot[]): string {
  const reactive =
    spots.some((s) => s.state === 'active') ||
    answers.skinStates.some((s) =>
      ['new-spot', 'red-lump', 'irritated', 'purge-activity', 'true-breakout'].includes(s),
    )
  if (!reactive && b.enabled('innisfree-volcanic-clay')) return 'innisfree-volcanic-clay'
  return 'lrp-effaclar-clay'
}

function buildPm(ctx: SequenceContext, answers: PmAnswers): ResolvedRoutine {
  const nightType = ctx.nightType ?? 'simple'
  const b = new RoutineBuilder(ctx.products)
  const skin = answers.skinStates
  const dryCheeks = skin.includes('dry-tight-cheeks')
  const irritated = skin.includes('irritated')
  const dayType = effectiveDayType(ctx)
  const mods = weatherModifiers(ctx.weather, ctx.settings.weatherThresholds, dayType)
  const counts = quotaCounts(ctx.history, ctx.date)

  addCleansing(b, ctx, answers, nightType)

  // Patches on clean, bare, dry skin before all leave-on products.
  if (answers.patches === 'whitehead' || answers.patches === 'healing-spot') {
    b.add('vt-pro-cica-patch', 'On the cleaned, dried spot before everything else — routine goes around it', 'patch')
  }

  // Clay goes straight after cleansing, before the toner.
  if (nightType === 'clay') {
    b.add(clayProductId(b, answers, ctx.spots), 'Oil control mask — avoid lumps, wounds and patches')
  }

  b.add('pc-skin-balancing-toner', 'Niacinamide base layer — first product on skin')

  // Established-phase unlocks (Section 5.8) — TN may share an adapalene night.
  const tnShares =
    nightType === 'adapalene' &&
    !isAdapaleneIsolatedPhase(ctx.settings.adapalene.phase) &&
    ctx.settings.establishedUnlocks.tnOnAdapaleneNights &&
    counts.tn < ctx.settings.quotas.tn
  const vc100Shares =
    nightType === 'adapalene' &&
    !isAdapaleneIsolatedPhase(ctx.settings.adapalene.phase) &&
    !tnShares &&
    ctx.settings.establishedUnlocks.vc100OnAdapaleneNights &&
    counts.vc100 < ctx.settings.quotas.vc100

  // Shirojyun (or its barrier-emergency stand-in) — skipped on TN nights.
  // On BHA nights it renders inside the template, after the timed wait.
  const tnTonight = nightType === 'tn' || tnShares
  if (!tnTonight && nightType !== 'bha' && includeShirojyunOnNight(nightType)) {
    if (nightType === 'simple' && irritated && dryCheeks) {
      b.add('gokujyun-premium-gold', 'Barrier-emergency hydration — plain HA, zero actives')
      b.advise('Gokujyun Gold stands in for Shirojyun tonight — no TXA coverage while the barrier recovers.')
    } else {
      b.add('shirojyun-premium', 'TXA every night — the PIH workhorse')
    }
  }

  switch (nightType) {
    case 'bha': {
      b.add('pc-bha', 'Leave-on exfoliant — pore declogging, around (not over) open spots')
      b.addRaw({
        kind: 'wait',
        productId: null,
        title: `Wait ${BHA_WAIT_MIN_MINUTES}–${BHA_WAIT_MAX_MINUTES} minutes`,
        purpose: 'Non-negotiable — let the BHA finish working before the next layer',
        technique: 'Tap the timer and let it run.',
        waitMinutes: BHA_WAIT_MAX_MINUTES,
      })
      b.add('shirojyun-premium', 'TXA after the wait — the PIH workhorse')
      b.add('melano-cc-premium', 'Vitamin C on BHA nights — Premium, never Men in the PM')
      b.add('skin1004-centella', 'Calming buffer after the acid')
      const thirdBhaNight = counts.bha >= 2
      if (dryCheeks || thirdBhaNight) {
        b.add('obk-serum-veil', thirdBhaNight ? 'Barrier support — 3rd BHA night this window' : 'Barrier support — cheeks are tight tonight')
      }
      break
    }
    case 'tn': {
      b.add('cosdebaha-tn', 'TXA 5% + niacinamide — tonight’s single leave-on active')
      break
    }
    case 'vc100': {
      b.add('vc100-sheet-mask', '10–15 minutes, pat the rest in — replaces the serum step')
      break
    }
    case 'adapalene': {
      if (tnShares) b.add('cosdebaha-tn', 'TN shares tonight (established unlock) — Shirojyun sits out')
      if (vc100Shares) b.add('vc100-sheet-mask', 'VC100 shares tonight (established unlock) — pat in and let skin dry fully')
      b.add('differin-adapalene', `Adapalene on ${applicationSiteWording(ctx.settings.adapalene.phase)} — skin must be COMPLETELY dry first`)
      break
    }
    case 'benzac': {
      b.add('melano-cc-premium', 'Vitamin C — Premium in the PM')
      b.add('skin1004-centella', 'Calming buffer')
      break
    }
    case 'clay':
    case 'simple':
      break
  }

  // Moisturiser: Curél cream when skin is raw on Benzac nights; Snail 92 otherwise.
  if (nightType === 'benzac' && (irritated || dryCheeks)) {
    b.add('curel-moisture-cream', 'Barrier repair on raw cheeks — T-zone stays light')
  } else {
    b.add('cosrx-snail-92', 'PM moisturiser — press in, don’t rub')
  }

  // Pair — individual tracked spots only, absolute last, never preventive.
  const pairTargets = ctx.spots.filter(
    (s) => s.state === 'active' && (nightType !== 'benzac' || s.type === 'closed-lump'),
  )
  if (pairTargets.length > 0) {
    b.add(
      'pair-acne-cream-w',
      `Thin dab on: ${pairTargets.map((s) => s.zone).join(', ')} — individual spots only, absolute last`,
    )
  }

  // COSRX pillow barrier — over settled Pair, the one patch that goes last.
  if (answers.patches === 'closed-lump') {
    b.add('cosrx-master-patch', 'Overnight pillow barrier on the closed lump — over settled Pair', 'patch')
  }

  if (mods.hotHumid && skin.includes('oily')) {
    b.advise('Hot/humid and skin ran oily today — the PM moisturiser is optional tonight if you’d rather skip it.')
  }
  weatherAdvisories(b, mods, 'pm')
  if (dryCheeks && nightType !== 'benzac') {
    b.advise('Cheeks tight — Curél Moisture Cream on cheeks only is available; T-zone stays Snail 92.')
  }
  if (dayType === 'office' || dayType === 'gym-office') {
    b.adviseIf('maro-deo-shampoo', 'Wax day: Maro Deo shampoo (Muji scrubber) then Maro treatment on scalp and hair.')
  }
  const tomorrowScheduled = ctx.settings.weeklySchedule[weekdayOf(addDays(ctx.date, 1))]
  if (tomorrowScheduled === 'office') {
    b.adviseIf('certain-dri-extra', 'Office tomorrow (no gym): Certain Dri goes on tonight before bed.')
  }

  return {
    nightType,
    steps: b.steps,
    advisories: b.advisories,
    pairSpotIds: pairTargets.map((s) => s.id),
  }
}

export function buildSequence(ctx: SequenceContext): ResolvedRoutine {
  if (ctx.answers.slot === 'am') return buildAm(ctx, ctx.answers)
  return buildPm(ctx, ctx.answers)
}
