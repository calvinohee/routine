# ROUTINE — Phase 1 Implementation Plan (Engine + Today screen + Deploy)

## Context

Building **ROUTINE**, a rules-driven skincare routine generator/tracker as an iPhone-installable PWA, per `BUILD_BRIEF.md`. Phase 1 (of 4) delivers: project scaffold, data layer with seeds, the **complete rules engine with a Vitest suite at 100% branch coverage (hard gate before any UI)**, the Today screen end-to-end, weather, PWA shell, and deployment to GitHub Pages — ending with Calvin installing it on his iPhone and logging a real AM + PM session.

**Environment already verified this session:** Node v24 ✅, git 2.51 ✅, npm 11 ✅, `gh` 2.96 installed ✅, Superpowers plugin re-enabled ✅ (skills followed from disk this session). Nothing else to install until the deploy step, which needs a GitHub account (guided, ~5 min).

**Process:** Superpowers discipline — written plan (this document), strict TDD for the engine (red → green, module by module), frequent commits, systematic debugging. Fix-forward within the phase; stop at the checkpoint.

## Key design decisions (brief is silent → strong defaults, flagged here)

1. **Engine shape:** a single pure entry point `generateRoutine(input: EngineInput): EngineResult` where `EngineInput` is a plain snapshot (settings, enabled products, trailing sessions, spots, answers, weather, adapalene state, today's date/slot) and `EngineResult` is either `{ kind: 'routine', steps, notes, nightType }` or `{ kind: 'conflicts', cards }`; a second call with the chosen card id resolves to the routine. No I/O, no Date.now(), no framework imports — fully deterministic and testable.
2. **Dates in the engine are ISO strings** (`YYYY-MM-DD`) with hand-rolled helpers (no date library). Timezone (Australia/Sydney) is resolved at the UI boundary, never inside the engine.
3. **State/UI plumbing:** Dexie + `dexie-react-hooks` (`useLiveQuery`) + small React contexts. No Redux/Zustand — the app is small and local-only.
4. **Styling:** hand-rolled CSS with custom properties (design tokens) — no Tailwind/UI kit. Gives precise control over the iOS-native feel, dark mode, and safe areas with zero dependency weight.
5. **Repo name `routine`** → app served at `https://<username>.github.io/routine/` (Vite `base: '/routine/'`).
6. **History & Library tabs render as placeholder screens in P1** (tab bar is real; content arrives P2/P3). Update-available toast deferred to P4 per roadmap.

## File structure

```
routine/
├── products.json                 # copied verbatim from this folder
├── vite.config.ts                # PWA plugin, base path
├── vitest.config.ts              # 100% branch threshold scoped to src/engine/
├── tsconfig.json                 # strict
├── .github/workflows/deploy.yml  # build + deploy dist to Pages on push
├── docs/plans/                   # this plan + execution notes live in-repo
└── src/
    ├── engine/                   # PURE TS — zero framework imports
    │   ├── types.ts              # domain model, config shape, EngineInput/Result
    │   ├── dates.ts              # ISO date helpers, rolling-7 window, weekday
    │   ├── quotas.ts             # live rolling-7 quota computation from sessions
    │   ├── adapalene.ts          # phase machine, targets/spacing, purge window
    │   ├── safety.ts             # the 14 hardcoded chemistry/safety rules
    │   ├── spots.ts              # spot tracking, Pair counter, Benzac escalation/mode
    │   ├── weather.ts            # threshold modifiers (hot/humid, cool/dry, UV)
    │   ├── nightType.ts          # priority selection + conflict-card emission
    │   ├── sequence.ts           # AM/PM template resolution, waits, patches, notes
    │   ├── generate.ts           # top-level generateRoutine / resolveConflictChoice
    │   └── __tests__/            # one spec file per module + integration spec
    ├── db/                       # Dexie schema v1, seeding, session logging
    ├── services/weather.ts       # Open-Meteo fetch, ≤1/hr throttle, cached snapshot
    ├── components/               # Today screen, questionnaire sheets, conflict cards,
    │                             # routine steps + BHA countdown, quota chips, tab bar
    ├── styles/                   # tokens.css (light/dark), base.css (iOS feel)
    └── main.tsx / App.tsx
```

## Tasks, in order

### Task 1 — Scaffold (~no user action)
`git init` a new repo at `~/Documents/Claude/Skincare app/routine/`; Vite react-ts template; strict tsconfig; install `dexie`, `dexie-react-hooks`, `vite-plugin-pwa`, `vitest`, `@vitest/coverage-v8`, testing-library. Configure the **coverage threshold: 100% branches/lines/functions/statements on `src/engine/**`** in `vitest.config.ts` from day one so the gate is mechanical, not honour-system. Copy `products.json` in. Commit.

### Task 2 — Engine domain types
`types.ts`: day types, night types, skin states, zones, patch needs, product shape (mirroring products.json), settings shape (Section 11), session record, spot record, adapalene phases, weather snapshot, questionnaire answers, `EngineInput`, `RoutineStep`, `ConflictCard`, `EngineResult`. Commit.

### Tasks 3–10 — Engine modules, strict TDD (red → green per module, commit per module)
For each module: write the failing spec first, run to see it fail, implement minimally, run green, commit.

- **dates** — rolling-7 window (today inclusive), weekday-of ISO date, consecutive-night runs.
- **quotas** — computed live from trailing sessions; boundary cases: session exactly 7 days ago drops out; today's logged session counts.
- **adapalene** — phase order and weekly targets (0/1/1/1/2/3/3), spacing, purge-window (weeks 3–8 from first full-face), phase-appropriate wording keys, never auto-advance.
- **safety** — each of the 14 rules in Section 5.3 as an independently tested predicate/transform (e.g. `never 3 consecutive exfoliant/retinoid nights counting BHA+adapalene jointly`, `Benzac 5-night cap`, `one leave-on active per PM`, `double-cleanse trigger`, `Shirojyun skip on TN`, `Tuner skip on tight cheeks`, patch placement rules, Pair-last rule, BHA wait step, Melano Premium on BHA nights).
- **spots** — create/update from questionnaire, Pair-night counter, 5-nights-no-improvement escalation card, Benzac mode entered **only** via card acceptance, auto-terminate at night 5 or on improvement.
- **weather** — threshold modifiers as pure functions over the snapshot + config thresholds; graceful `null` snapshot (offline) → no weather modifiers, never a crash.
- **nightType** — the 6-step priority ladder (Section 5.4) + skin-state modifiers; emits conflict cards (2–3 options, cost text, recommended default) instead of silently resolving collisions.
- **sequence** — resolves the chosen night type + answers + weather into ordered steps using the Section 5.7 templates, pulling technique/wait text from product data; conditionals (Serum Veil, Curél cheeks-only, SPF tiering, CC cream, patches-first, trailing hair/deo notes); disabled products excluded.
- **generate** — the integration layer: answers + state → conflicts or resolved routine; `resolveConflictChoice`; cold-start seed behaviour (settings from Section 11, one adapalene session on 2026-06-30).

**Table-driven edge cases required by Section 12** (each is a named test): quota met exactly at window boundary; two actives due same night; mask day vs irritation; 5th consecutive Pair night; Benzac night-5 auto-termination; 3rd-consecutive-active prevention across BHA/adapalene jointly; disabled products excluded from generation.

### Task 11 — 🚧 HARD GATE
`npx vitest run --coverage` must pass with 100% branch coverage on `src/engine/`. **No UI file is created before this is green.** I'll show you the coverage summary when we pass it.

### Task 12 — Data layer
Dexie db (`products`, `sessions`, `spots`, `adapalenePhaseHistory`, `settings`), schema version 1 with upgrade scaffolding; first-launch seeding (products.json verbatim; Section 11 settings; the 30/06/2026 adapalene session). Session logging writes the full generated routine + choices + weather snapshot + phase.

### Task 13 — Weather service
Open-Meteo forecast fetch for configured coordinates (seed: Sydney), throttled ≤1/hour, cached last snapshot with fetched-at time; offline → cached snapshot with its timestamp.

### Task 14 — Today screen end-to-end
Status header (adapalene line **first** until established → quota chips BHA x/3 · TN x/2 · Clay · VC100 · Adapalene x/target → weather line); time-aware AM/PM flow with manual switch; tap-only questionnaire as sheet modals (day type pre-selected from weekly schedule; skin multi-select with inline zone picker; patches; conditional adapalene question); conflict cards; numbered routine with product/purpose/technique/wait; **BHA wait as a tappable countdown timer**; one-tap "Log it". Light component tests for questionnaire flow + conflict-card selection (no coverage chasing in UI).

### Task 15 — Design system + PWA shell
iOS-native feel: system font stack, type scale, large-title header, bottom tab bar (Today active; History/Library placeholders), ≥44pt targets, safe-area insets, `#00C2CB` accent used sparingly, full dark-mode palette (system default + manual override in P3), `prefers-reduced-motion` respected. vite-plugin-pwa: manifest (name ROUTINE, theme `#00C2CB`, standalone, portrait), apple-touch-icons, splash, precached shell, fully offline-functional.

### Task 16 — Deploy (this is where you're needed, ~10 min)
1. I walk you through creating a free GitHub account (click-by-click) — you'll need to pick a username and verify your email (calvinohee@hotmail.com).
2. `gh auth login` together (one-time browser code, I give exact steps).
3. I create the public repo, push, and set up the GitHub Actions workflow that builds and deploys on every push.
4. You get the final URL + exact iPhone steps: Safari → Share → **Add to Home Screen** → verify standalone launch and offline behaviour.

### Task 17 — ✅ PHASE 1 CHECKPOINT
You run a real AM and a real PM on your iPhone. I summarise what was built and give you a plain-English test checklist. **Phase 2 (History) does not start until you approve.**

## Verification

- Engine: full Vitest suite green with enforced 100% branch coverage (coverage summary shown to you).
- UI: component tests for questionnaire + conflict cards; manual run-through in local preview (AM office day, PM BHA night, a conflict scenario, a spot-tracking scenario) before deploying.
- Build: `npm run build` clean under strict TS; preview served locally and checked at iPhone viewport.
- Device: installed PWA on your iPhone, offline check (aeroplane mode → app still generates a routine with cached weather), real AM + PM logged.

## What could go wrong / notes

- **Localisation:** Australian English, °C, DD/MM/YYYY, Australia/Sydney time throughout the UI; engine stays timezone-agnostic.
- **No backend, no analytics, no free text anywhere.** Backup export/import arrives in Phase 3 per the roadmap.
- If Open-Meteo is unreachable the app must behave identically minus weather modifiers — covered by engine tests.
