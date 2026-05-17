# Implementation Plan: Portfolio Cinematic Redesign

## Overview

Convert the feature design into a series of prompts for a code-generation LLM that will implement each step with incremental progress. Make sure that each prompt builds on the previous prompts, and ends with wiring things together. There should be no hanging or orphaned code that isn't integrated into a previous step. Focus ONLY on tasks that involve writing, modifying, or testing code.

The plan replaces the legacy single-file portfolio at `artifacts/portfolio/` with the architecture defined in `design.md`. Work proceeds in layers:

1. Workspace tooling and design tokens.
2. Pure-data foundations: Content_Registry, Route_Map, Responsive_Engine, Motion_System (PBT-first; tests precede implementation).
3. Accessibility plumbing and design-system primitives.
4. The Above_The_Fold scene (`Threshold`) and its DOM smoke test.
5. Lazy scenes: `TwinCompass`, `Work` with four differentiated reveals, `Ethos`, `Signal`.
6. Cinematic_Background, lazy-loaded behind a single React boundary after FCP.
7. App shell wiring and remaining DOM smoke tests.
8. Build-time payload-budget assertion, pre-rendered HTML, dependency-deprecation gate.
9. ESLint enforcement of the architectural invariants (single shared scroll source, no raw spacing, registry-only literals).

All paths are absolute under `c:\Users\devan\Downloads\devansh-portfolio-master\devansh-portfolio-master\artifacts\portfolio\`. The package name is `@workspace/portfolio` and uses Vite 7 + React 19 + Tailwind v4 already wired in the workspace catalog. PBT is implemented with `vitest` + `fast-check`, ≥ 200 iterations per property, in `src/tests/pbt/`.

## Tasks

- [x] 1. Workspace tooling and test harness
  - [x] 1.1 Add dev dependencies to `artifacts/portfolio/package.json`
    - Add `framer-motion`, `vitest`, `@vitest/coverage-v8`, `fast-check`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `gzip-size`, `eslint`, `@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin`, `eslint-plugin-jsx-a11y`, `eslint-plugin-react`, `eslint-plugin-react-hooks` (catalog-pinned where present)
    - Confirm `react`, `react-dom`, `tailwindcss`, `@tailwindcss/vite`, `vite` already resolve from the catalog
    - _Requirements: 10.1, 10.2, 10.3, 19.4, 19.5_

  - [x] 1.2 Add `test`, `test:watch`, `lint`, and updated `typecheck` scripts to `artifacts/portfolio/package.json`
    - `"test": "vitest run"`, `"test:watch": "vitest"`, `"lint": "eslint src --max-warnings=0"`, `"typecheck": "tsc -p tsconfig.json --noEmit"`
    - Add a root-level `scripts.test` in workspace root `package.json` that delegates to `pnpm --filter @workspace/portfolio run test`
    - _Requirements: 19.1, 19.2, 19.3_

  - [x] 1.3 Create `artifacts/portfolio/vitest.config.ts`
    - Configure `environment: 'jsdom'`, `setupFiles: ['./src/tests/setup.ts']`, `globals: false`, `coverage.provider: 'v8'`
    - Set fast-check default `numRuns` to 200 via `setupFiles`
    - Include `src/tests/**/*.test.{ts,tsx}` and exclude `dist`
    - _Requirements: 19.3_

  - [x] 1.4 Create `artifacts/portfolio/src/tests/setup.ts`
    - Import `@testing-library/jest-dom`
    - Install `matchMedia`, `IntersectionObserver`, `ResizeObserver`, `requestIdleCallback`, `localStorage`, and `WebGL2RenderingContext` polyfills used by jsdom paths
    - Set `fc.configureGlobal({ numRuns: 200 })`
    - _Requirements: 19.3, 13.1, 13.2_

  - [x] 1.5 Create base `artifacts/portfolio/eslint.config.js`
    - Enable `@typescript-eslint`, `react`, `react-hooks`, `jsx-a11y` (recommended)
    - Stub two custom rule placeholders that are filled in tasks 16.1 and 16.2 (`no-window-scroll-listeners`, `no-raw-spacing`, `no-registry-bypass`, `no-restricted-imports`)
    - _Requirements: 5.2, 13.9, 19.2_

- [x] 2. Design tokens and contrast property
  - [x] 2.1 Create `artifacts/portfolio/src/design-system/tokens.types.ts`
    - Export TS interfaces for `Hue`, `NeutralStep`, `SurfaceTone`, `SpacingStep`, `RadiusVariant`, `ShadowVariant`, `BorderVariant`, `TypeStep`, `EaseToken`, `DurationToken`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.2, 4.3, 5.1_

  - [x] 2.2 Create `artifacts/portfolio/src/design-system/tokens.ts`
    - Export the five-hue palette (`ink`, `paper`, `amber`, `moss`, `signal`) plus `amber-deep`
    - Export the 11-step neutral ramp, 5-step surface ramp (per design table), 10-step spacing scale, 5 radii, 5 shadows, 4 borders, type scale (display, headline, title, body, small, caption), 4 ease curves, and 4 duration buckets (`instant ≤ 80`, `short 120–220`, `medium 260–400`, `long 500–900`)
    - Provide `hexToHsl` helper used by the contrast pair registry
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 5.1_

  - [x] 2.3 Create `artifacts/portfolio/src/styles/theme.css`, `reset.css`, and `fonts.css`
    - `theme.css`: `@import "tailwindcss"` + `@theme { ... }` mapping every token from `tokens.ts` exactly per the design's Tailwind v4 mapping
    - `reset.css`: minimal reset with `:focus-visible` token applied (≥ 2 CSS px outline + `--shadow-focus`)
    - `fonts.css`: `@font-face` for Fraunces / Inter / JetBrains Mono with `font-display: swap`, plus a `[data-fonts="fallback"]` letter-spacing correction selector for the slow-font watchdog
    - _Requirements: 3.5, 4.1, 4.4, 4.6, 4.8, 4.9, 13.6_

  - [x] 2.4 Create `artifacts/portfolio/src/design-system/contrast-pairs.ts`
    - Export `defaultContrastPairs: ReadonlyArray<{ id: string; foreground: string; background: string; size: 'normal' | 'large' }>`
    - Cover every default text-on-surface pairing rendered in the redesign (ink-on-paper, paper-on-ink, neutral-900 on each surface tone, amber on ink, moss on ink, signal on ink, focus ring on each surface)
    - Export `wcagContrast(fgHex: string, bgHex: string): number` utility
    - _Requirements: 3.9, 13.11_

  - [x] 2.5 Write `artifacts/portfolio/src/tests/pbt/contrast.pbt.test.ts`
    - **Property 10: Default text-on-surface token-pair contrast ≥ AA**
    - Iterate every entry in `defaultContrastPairs`; assert `wcagContrast(fg, bg) ≥ 4.5` for `size === 'normal'` and `≥ 3` for `size === 'large'`
    - Add a `fast-check` property over arbitrary `fc.constantFrom(...defaultContrastPairs)` with 200 runs to guard against future additions failing the threshold
    - _Property 10_
    - _Requirements: 3.9, 13.11_

- [x] 3. Content registry, generators, copy hygiene, and validators
  - [x] 3.1 Create `artifacts/portfolio/src/content-registry/types.ts`
    - Export `Identity_Profile`, `Project_Record`, `Contact_Channel`, `Voice`, `Claim`, `ProjectStatus = 'in-development' | 'production' | 'shipped' | 'archived'`, `RegistryValidationResult`
    - `Identity_Profile` includes `displayName`, `tagline`, `currentInstitution`, `currentProgram`, `currentYears`, `crossReferences[]` (the two co-primary academic affiliations + role flag), `email`, `socials[]`, and `ethos` (a string of 1..2000 chars used as the philosophy beat in `scenes/Ethos.tsx` per R2.6 / R9.6)
    - `Project_Record.year` accepts `number | [number, number]`; `primaryLink` is `{ label: string; kind: 'live' | 'repository' | 'case-study' | 'demo' | 'paper'; url: string }`
    - _Requirements: 1.5, 2.6, 8.3, 9.6, 15.1, 15.4, 15.7_

  - [x] 3.2 Create `artifacts/portfolio/src/tests/pbt/_generators.ts`
    - Export `arbProjectRecord`, `arbIdentityProfile`, `arbContactChannel`, `arbRouteMap`, `arbSlug`, `arbDomId`, `arbWidth` (`fc.integer({ min: 320, max: 3840 })`), `arbWideWidth`, `arbYearValue`, `arbKeyframe`, `arbMotionVariant` exactly per the design's "Generators" subsection
    - _Requirements: 15.1, 16.1, 17.1, 18.1_

  - [x] 3.3 Write `artifacts/portfolio/src/tests/pbt/content-registry.pbt.test.ts`
    - **Property 1: Project_Record field bounds and value invariants** — for each `arbProjectRecord`, assert `validateProject` accepts iff every R15 bound holds; on rejection, assert the result identifies the offending record id and field
    - **Property 2: Project_Record JSON round-trip structural equality** — for valid records, `JSON.parse(JSON.stringify(r))` deep-equals `r`
    - **Property 3: Identity_Profile field bounds and contact validity** — for each `arbIdentityProfile`, assert `validateIdentity` enforces non-empty trimmed strings, RFC 5322-style email, and absolute `https://` socials
    - 200 iterations each
    - _Property 1, Property 2, Property 3_
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7_

  - [x] 3.4 Create `artifacts/portfolio/src/content-registry/banned-phrases.ts` and `baseline-prose.ts`
    - `banned-phrases.ts` exports `BANNED_PHRASES: readonly string[]` containing at minimum `"passionate about"`, `"leveraging cutting-edge"`, `"results-driven"`, `"in today's fast-paced world"`
    - `baseline-prose.ts` exports `BASELINE_PROSE: readonly string[]` capturing every audited prose string from the legacy `src/pages/Portfolio.tsx` (case-insensitive, whitespace-normalised) used as the "do not match verbatim" set
    - _Requirements: 9.1, 9.2_

  - [x] 3.5 Write `artifacts/portfolio/src/tests/pbt/copy-hygiene.pbt.test.ts`
    - **Property 11: Copy hygiene — no banned phrases, no baseline verbatim**
    - For every prose string in the Content_Registry (identity, project tagline/summary/voice/outcomes, ethos beat, contact label), assert no `BANNED_PHRASES` entry appears as case-insensitive substring and no string normalises (lowercase + collapsed whitespace) to any `BASELINE_PROSE` entry
    - Include a fast-check property that randomly mutates valid project copy and re-asserts the invariant under 200 runs
    - _Property 11_
    - _Requirements: 9.1, 9.2_

  - [x] 3.6 Create `artifacts/portfolio/src/lib/url.ts`, `src/content-registry/validate.ts`, and `src/content-registry/index.ts`
    - `lib/url.ts`: export `isAbsoluteHttpsUrl(s: string): boolean` (URL parse + scheme `https:` + non-empty hostname + length ≤ 2048)
    - `validate.ts`: implement `validateProject`, `validateIdentity`, `validateContact`, `validateRegistry` returning `{ ok: true } | { ok: false; recordId: string; field: string; reason: string }`; enforce R15.1–R15.7 bounds, project id uniqueness, RFC 5322 email check
    - `index.ts`: re-export types, validators, and `BANNED_PHRASES`/`BASELINE_PROSE`
    - Existing test `content-registry.pbt.test.ts` (3.3) must turn green for the canonical fixture; copy-hygiene test (3.5) must turn green
    - _Requirements: 1.8, 1.9, 1.10, 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7, 15.9_

  - [x] 3.7 Create `artifacts/portfolio/src/content-registry/data.ts`
    - Export `identity: Identity_Profile` with `displayName: "Devansh Barai"`, tagline `"Computer science, AI/ML, and product-oriented builder focused on turning ideas into useful software."`, two co-primary `crossReferences` entries (IIT Madras BS Data Science 2024–2028 + IIM Bangalore BBA Digital Business & Entrepreneurship 2025–2028, equal-weight role flag), `email: "devanshbarai.official@gmail.com"`, `socials` with the verified LinkedIn (`https://linkedin.com/in/devansh-barai`) and GitHub (`https://github.com/Devanshisbroke`) URLs, and an `ethos` prose beat (≥ 1 sentence, no banned phrase, no baseline verbatim) communicating the AI / product / system-builder orientation as continuous prose for `scenes/Ethos.tsx` (R2.6, R9.6)
    - Export `projects: readonly Project_Record[]` with exactly four entries in order: GlobeID, Khetech, SupportDeskOps-v6, Last-Minute PDF; populate `tagline`, `summary`, `problem`, `role`, `year`, `tags`, `primaryLink`, `outcomes`, `technologyOrientation`, `status`, `voice.firstPersonSentence`, `voice.convictionSentence` per the design and résumé; ensure no banned phrase and no baseline verbatim
    - Module top: `validateRegistry({ identity, projects, contact })` invocation that throws on failure (build-time validation)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 2.6, 8.3, 8.5, 8.6, 9.5, 9.6, 9.7, 9.8, 10.7, 15.8_

- [x] 4. Route map and hash routing
  - [x] 4.1 Create `artifacts/portfolio/src/route-map/types.ts`
    - Export `RouteEntry { slug: string; domId: string; role: 'opening' | 'identity' | 'work' | 'philosophy' | 'contact'; rank: number; dominantLayoutPattern: LayoutPattern }`
    - Export `LayoutPattern = 'centered-hero' | 'full-bleed-media' | 'split-two-column' | 'card-grid' | 'vertical-list' | 'asymmetric-editorial' | 'immersive-canvas'`
    - Export `RouteMap = readonly RouteEntry[]`, `RouteLookup`, `RouteValidationResult`
    - _Requirements: 6.1, 6.2, 6.6, 14.1, 16.1_

  - [x] 4.2 Write `artifacts/portfolio/src/tests/pbt/route-map.pbt.test.ts` and `src/tests/pbt/route-map-render.pbt.test.ts`
    - **Property 4: Route_Map bijection and round-trip identity** — for `arbRouteMap`, assert `validate(rm).ok` ⇒ `lookup.slugFromId(lookup.idFromSlug(slug)) === slug` and the symmetric round trip; assert no two entries share a `domId` or `slug`
    - **Property 5: Route_Map size bounds and validation behaviour** — assert size 1..1000 accepted; size 0 or 1001 rejected; duplicated slug or empty `domId` rejected with deterministic `{ ok: false, slug | domId, reason }` shape
    - 200 iterations each
    - _Property 4, Property 5_
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.6_

  - [x] 4.3 Create `artifacts/portfolio/src/route-map/lookup.ts` and `src/route-map/validate.ts`
    - `createRouteLookup(rm: RouteMap): RouteLookup` returns `idFromSlug(slug)`, `slugFromId(domId)`, `entryByRole(role)`, all O(1)
    - `validate(rm: RouteMap): RouteValidationResult` enforces 1..1000 entries, slug regex `/^[a-z0-9-]{1,64}$/`, domId regex `/^[a-zA-Z][a-zA-Z0-9_-]{0,127}$/`, slug↔domId bijection, role coverage (opening, identity, work, philosophy, contact each ≥ 1)
    - PBT files from 4.2 must turn green
    - _Requirements: 6.1, 6.6, 14.1, 16.1, 16.2, 16.3, 16.4, 16.6_

  - [x] 4.4 Create `artifacts/portfolio/src/route-map/hash-router.ts`
    - On mount, read `window.location.hash`; if matches a slug, scroll the corresponding `#{domId}` to top accounting for sticky header within ±2 px tolerance using `scrollTo({ behavior: reducedMotion ? 'auto' : 'smooth' })` completing ≤ 800 ms (or instant ≤ 50 ms when reduced-motion); on unknown hash, scroll to opening scene and surface a non-blocking 4-second `[role="status"]` toast "That section was not found." dismissable with Escape, never unloading the document
    - Listen to `hashchange`
    - Subscribe to the shared scroll source from `motion/scroll-source.ts` (no extra `addEventListener('scroll')`); when a section occupies ≥ 50 % of the viewport, call `history.replaceState` to update the hash, debounced to ≤ 4 updates/sec
    - _Requirements: 5.2, 6.6, 6.7, 14.2, 14.3, 14.4, 14.5, 14.6_

  - [x] 4.5 Create `artifacts/portfolio/src/route-map/data.ts` and `src/route-map/index.ts`
    - `data.ts`: export `routeMap` with five entries — `{slug:'threshold', domId:'scene-threshold', role:'opening', dominantLayoutPattern:'asymmetric-editorial'}`, `{slug:'compass', domId:'scene-compass', role:'identity', dominantLayoutPattern:'split-two-column'}`, `{slug:'work', domId:'scene-work', role:'work', dominantLayoutPattern:'asymmetric-editorial'}` (and per-project sub-anchors `scene-work-globeid`, `scene-work-khetech`, `scene-work-supportdeskops`, `scene-work-last-minute-pdf`), `{slug:'ethos', domId:'scene-ethos', role:'philosophy', dominantLayoutPattern:'centered-hero'}`, `{slug:'signal', domId:'scene-signal', role:'contact', dominantLayoutPattern:'vertical-list'}`; module top runs `validate(routeMap)` and throws on failure
    - `index.ts`: re-export types, lookup, validate, data, hash-router
    - _Requirements: 6.1, 6.6, 14.1, 16.1, 16.6_

- [x] 5. Responsive engine
  - [x] 5.1 Create `artifacts/portfolio/src/responsive-engine/types.ts`
    - Export `Breakpoint = 'mobile' | 'tablet' | 'desktop' | 'ultrawide'`, `BREAKPOINT_RANK: Record<Breakpoint, 1|2|3|4>`, `LayoutTier { columns: number; gutterToken: SpacingStep; maxMeasureCh: number; sceneVerticalRhythmToken: SpacingStep; revealLayerStaggerMs: number }`
    - _Requirements: 12.1, 12.2, 17.1_

  - [x] 5.2 Write `artifacts/portfolio/src/tests/pbt/responsive-engine.pbt.test.ts`
    - **Property 6: Breakpoint resolver totality, determinism, monotonicity** — over `arbWidth`, assert `resolveBreakpoint` returns one of the four tiers; over `(w, w+1)` adjacents in [320, 3839], assert rank delta ∈ {0, 1}; over `arbWideWidth`, assert no throw
    - **Property 7: Layout-tier idempotence within a tier** — for `(w1, w2)` in `arbWidth × arbWidth` with the same `resolveBreakpoint`, assert `resolveLayoutTier(w1)` deep-equals `resolveLayoutTier(w2)`
    - 500 runs for Property 6 totality, 200 for Property 7
    - _Property 6, Property 7_
    - _Requirements: 17.1, 17.2, 17.3, 17.4_

  - [x] 5.3 Create `artifacts/portfolio/src/responsive-engine/resolve.ts`
    - Implement `resolveBreakpoint(width: number): Breakpoint` partitioning [320, 3840] as `mobile [320,767]`, `tablet [768,1023]`, `desktop [1024,1919]`, `ultrawide [1920,∞)`; widths < 320 clamp to `mobile`
    - Implement `resolveLayoutTier(width: number): LayoutTier` returning a per-tier deep-equal value (constants per tier ⇒ idempotence by construction)
    - PBT (5.2) must turn green
    - _Requirements: 12.1, 12.2, 17.1, 17.2, 17.3, 17.4_

  - [x] 5.4 Create `artifacts/portfolio/src/responsive-engine/useBreakpoint.ts` and `src/responsive-engine/index.ts`
    - `useBreakpoint()` hook backed by a singleton `ResizeObserver` on `document.documentElement` and a single `matchMedia` listener per breakpoint range, debounced to 16 ms
    - On coarse-pointer detection (`matchMedia('(pointer: coarse)')`), surface `useCoarsePointer()` so hover-only affordances can degrade
    - `index.ts` re-exports types, resolvers, hooks
    - _Requirements: 12.1, 12.2, 12.5, 12.8, 17.1_

- [x] 6. Motion system (PBT-first)
  - [x] 6.1 Create `artifacts/portfolio/src/motion/variant-types.ts`
    - Export `MotionTransform { translateX?, translateY?, scale?, rotate?, scrollLinked? }`, `MotionKeyframe { transform: MotionTransform; opacity?: number; color?: string; durationMs: number; delayMs?: number; easing: EaseToken }`, `MotionVariant { id: string; keyframes: readonly MotionKeyframe[] }`
    - Export `totalDurationMs(v: MotionVariant): number` (sum of `delayMs + durationMs` of last-finishing keyframe)
    - _Requirements: 5.1, 8.2, 18.1, 18.2_

  - [x] 6.2 Write `artifacts/portfolio/src/tests/pbt/reduced-motion.pbt.test.ts`
    - **Property 8: Reduced-motion transformer bounds, idempotence, transform restriction, involution**
    - Sub-property 8a: `totalDurationMs(applyReducedMotion(v)) === 0 || ≤ 120`
    - Sub-property 8b: `applyReducedMotion(applyReducedMotion(v))` deep-equals `applyReducedMotion(v)`
    - Sub-property 8c: every keyframe's `transform` deep-equals `{}` (identity); no `scale > 1.05`, no `rotate`, no `scrollLinked`
    - Sub-property 8d: `applyFullMotion(v.keyframes)(applyReducedMotion(v))` deep-equals `v`
    - 200 iterations per sub-property
    - _Property 8_
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 5.7, 8.10_

  - [x] 6.3 Create `artifacts/portfolio/src/motion/reduced-motion.ts`
    - `applyReducedMotion(v: MotionVariant): MotionVariant` — clamps `delayMs = 0`, clamps each `durationMs` to `min(120, original)`, strips every transform field, retains `opacity` and `color` only, retains `easing`
    - `applyFullMotion(originalKeyframes)(reduced: MotionVariant): MotionVariant` — restores original keyframes from a memoised registry keyed by `MotionVariant.id` (involution closure)
    - `matchReducedMotion()` reads `accessibility/reduced-motion-store.ts` (declared as forward import; concrete impl arrives in 7.1)
    - PBT file (6.2) must turn green
    - _Requirements: 5.7, 8.10, 18.1, 18.2, 18.3, 18.4, 18.5_

  - [x] 6.4 Create `artifacts/portfolio/src/motion/scroll-source.ts`
    - Single React `ScrollContext` exposing `useScroll()` returning `{ scrollY: MotionValue<number>; sceneProgress: (domId: string) => MotionValue<number> }`
    - The provider attaches **exactly one** `window.addEventListener('scroll', …, { passive: true })` and one `ResizeObserver` on `document.documentElement`; this file is the only allowed location for either
    - Use `requestAnimationFrame` coalescing; expose subscription API (`subscribe(cb)`) to keep observers off the rest of the codebase
    - _Requirements: 5.2, 5.4_

  - [x] 6.5 Create `artifacts/portfolio/src/motion/motion-create.ts` and `src/motion/lenis-bridge.ts`
    - `motion-create.ts`: `registerVariant(v: MotionVariant): MotionVariant` (memoises the original for involution), `getResolvedVariant(id: string, reducedMotion: boolean): MotionVariant` (funnels through `applyReducedMotion`)
    - `lenis-bridge.ts`: lazy default-export factory that wraps Lenis smooth scroll only when `!reducedMotion && hardwareConcurrency > 4 && deviceMemory > 4`; bound to the single shared scroll source so it adds zero `scroll` listeners
    - _Requirements: 5.1, 5.7, 12.6, 12.7_

  - [x] 6.6 Create `artifacts/portfolio/src/motion/primitives/Reveal.tsx`, `Parallax.tsx`, `Sticky.tsx`, `Stagger.tsx`
    - `Reveal`: `IntersectionObserver` with `threshold: 0.1`, fires its variant exactly once per page session via a `useRef` + `WeakSet`; passes through `getResolvedVariant`
    - `Parallax`: subscribes to `useScroll().sceneProgress(domId)` and applies `useTransform` on `transform`/`opacity`/`filter` only — no layout-affecting properties
    - `Sticky`: pins the child for the duration of its scene's progress (used by SupportDeskOps reveal)
    - `Stagger`: orchestrates per-child variants with a token-driven delay step
    - Every variant goes through `motion-create.getResolvedVariant`
    - _Requirements: 5.3, 5.4, 5.7_

  - [x] 6.7 Create `artifacts/portfolio/src/motion/reduced-motion-toggle.tsx`
    - `<button role="switch" aria-pressed={state} aria-label="Reduce motion">…</button>`
    - Reads/writes via `accessibility/reduced-motion-store.ts`; provides a sibling "Match system" `<button>` that clears the override
    - On Enter / Space activate; visible focus ring
    - Renders text label "Reduce motion: on" / "off" (redundant non-color, non-motion cue)
    - _Requirements: 13.1, 13.2, 13.3, 13.12_

- [x] 7. Accessibility plumbing
  - [x] 7.1 Create `artifacts/portfolio/src/accessibility/reduced-motion-store.ts` and `src/accessibility/theme-store.ts`
    - `reduced-motion-store.ts`: `readReducedMotion()`, `writeReducedMotion(v)`, `clearReducedMotionPref()`, `subscribe(cb)`; key `pcr.reduced-motion`; honours `localStorage` value over OS pref; falls back to `matchMedia('(prefers-reduced-motion: reduce)')`; pre-paint hydration helper exposes a `<script>`-injectable string for `index.html`
    - `theme-store.ts`: `readTheme()`, `writeTheme()`, key `pcr.theme`; pre-paint hydration helper to avoid flash
    - _Requirements: 3.6, 13.1, 13.2, 13.3_

  - [x] 7.2 Create `artifacts/portfolio/src/accessibility/focus-management.ts`
    - Export `getMainContentRef()`, `focusMain()`, `manageHeadingOrder({ h1Id })`; provides a `useFocusTrap` no-op (none needed) and a runtime assertion that no skipped heading levels appear
    - _Requirements: 13.5, 13.7, 13.8_

  - [x] 7.3 Create `artifacts/portfolio/src/accessibility/redundant-cues.ts` and `src/accessibility/index.ts`
    - `redundant-cues.ts`: export the cue table from the design (active scene = bold + `aria-current`; hovered project = underline + `aria-describedby`; reduced-motion = text label + `aria-pressed`; magnetic CTA = persistent border + label; external link = trailing `↗` icon + `rel`; theme = text + `aria-pressed`); export `assertRedundantCue({state, channels})` for use by tests
    - `index.ts`: re-export everything
    - _Requirements: 13.10, 13.12, 13.13_

- [x] 8. Design system primitives
  - [x] 8.1 Create `artifacts/portfolio/src/design-system/primitives/Surface.tsx`, `Stack.tsx`, `Inline.tsx`, `Text.tsx`
    - `Surface`: prop `tone: 'base' | 'raised' | 'sunken' | 'accent' | 'inverse'` mapped to surface tokens; renders a styled `<section>` or `<div>` with no literal sizes
    - `Stack`, `Inline`: `gapStep: SpacingStep` and `paddingStep?: SpacingStep` only; rejects literal numbers via TS
    - `Text`: prop `step: TypeStep` (display | headline | title | body | small | caption); applies font-size, line-height, letter-spacing, weight from `tokens.ts`; refuses literal numeric sizing; for `step === 'display'` enforces `letter-spacing ≤ -0.02em` and `line-height ≤ 1.1` when computed font size > 48 px
    - _Requirements: 3.3, 4.1, 4.2, 4.3, 4.4, 4.6, 4.7_

  - [x] 8.2 Create `artifacts/portfolio/src/design-system/primitives/Link.tsx`, `MagneticCTA.tsx`, `FocusRing.tsx`, `SkipToContent.tsx`
    - `Link`: when `href` host differs from `location.host`, sets `target="_blank"` and `rel="noopener noreferrer"`; renders a trailing `↗` glyph for off-origin (R8.8 redundant cue)
    - `MagneticCTA`: pointer-bounded magnetic translate (max 16 px), released within 100 ms of pointer leaving the hit-area; falls back to instant rest state under reduced motion; surface text-label "Hold for action" + persistent border (redundant cue); minimum 44×44 CSS-px hit area
    - `FocusRing`: applies `--shadow-focus`; ≥ 2 CSS-px outline; ≥ 3:1 contrast on every surface
    - `SkipToContent`: visually-hidden until focused; `href="#main-content"`; first focusable element on every page
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.8, 8.8, 12.5, 12.8, 13.5, 13.6, 13.7, 13.9, 13.12, 14.7_

- [x] 9. Threshold scene (Above_The_Fold)
  - [x] 9.1 Create `artifacts/portfolio/src/scenes/Threshold.tsx`
    - Section root `<section id="scene-threshold" aria-labelledby="threshold-h1">`
    - `<h1 id="threshold-h1">` renders the exact string `"Devansh Barai"` sourced from `content-registry/data.ts`
    - Single-line tagline rendered via `<Text step="title">` from `identity.tagline`
    - Twin-Compass paired credentials block: two `<Text step="headline">` nodes for IIT Madras and IIM Bangalore using identical `step` and identical `Surface` treatment, side-by-side at `desktop`/`ultrawide`, stacked top-to-bottom at `mobile`/`tablet`; both wrapped in a `<div role="group" aria-label="Education">` so they read as a single paired block
    - No glassmorphism cards, no cyan→indigo→pink gradient, no aurora blobs, no noise overlay, no role-typewriter, no skill bars, no status badges, no global cursor swap
    - Bound to `routeMap.entryByRole('opening').domId === 'scene-threshold'`
    - _Requirements: 1.1, 1.2, 1.3, 2.2, 2.3, 2.5, 6.1, 6.4, 6.8_

  - [x] 9.2 Write `artifacts/portfolio/src/tests/dom/threshold-above-the-fold.test.tsx`
    - Render `<App />` at viewport 1440×900 and 390×844 (set via `window.innerWidth`/`Height` + `dispatchEvent(new Event('resize'))`)
    - Assert `screen.getByRole('heading', { level: 1 })` text equals `"Devansh Barai"`
    - Assert both credential strings appear in nodes whose computed font-size, font-weight, and surface token are equal (read via `getComputedStyle`)
    - Assert no other heading on the page has font-size ≥ the credential nodes' size (R1.3)
    - _Requirements: 1.1, 1.2, 1.3, 6.4_

- [x] 10. Scene order and adjacency property
  - [x] 10.1 Create `artifacts/portfolio/src/scenes/scene-order.ts`
    - Export `sceneOrder: readonly { domId: string; role: RouteEntry['role']; dominantLayoutPattern: LayoutPattern }[]` matching `routeMap` and ordered: `scene-threshold` → `scene-compass` → `scene-work` → `scene-ethos` → `scene-signal`
    - Layout patterns chosen so no two adjacent scenes share one (e.g. `asymmetric-editorial → split-two-column → asymmetric-editorial → centered-hero → vertical-list`)
    - _Requirements: 6.1, 6.2_

  - [x] 10.2 Write `artifacts/portfolio/src/tests/pbt/scene-adjacency.pbt.test.ts`
    - **Property 12: Scene-adjacency layout-pattern non-repetition** — for every adjacent pair `(sceneOrder[i], sceneOrder[i+1])`, assert `dominantLayoutPattern[i] !== dominantLayoutPattern[i+1]`
    - Add a fast-check property over arbitrary length-N permutations of the layout taxonomy and assert the validator catches violations (200 runs)
    - _Property 12_
    - _Requirements: 6.2_

- [x] 11. Lazy scenes: Twin Compass, Project Showcase reveals, Ethos, Signal
  - [x] 11.1 Create `artifacts/portfolio/src/scenes/TwinCompass.tsx`
    - `<section id="scene-compass" aria-labelledby="compass-h2">` with `<h2 id="compass-h2">`
    - Renders the two co-primary academic credentials in identical typographic role (both `<Text step="headline">` on identical `Surface` tone) side-by-side, now expanded with degree program + years + brief 1–2 sentence first-person description from `identity.crossReferences`
    - No primary/secondary hierarchy; no "subordinate" badge
    - _Requirements: 1.2, 1.3, 2.6, 6.1, 6.2, 9.5_

  - [x] 11.2 Create `artifacts/portfolio/src/scenes/Work/reveal-specs.ts`
    - Export `revealSpecs: readonly RevealSpec[]` with four entries (`globeid`, `khetech`, `supportdeskops`, `last-minute-pdf`) matching the design's per-reveal table exactly
    - `globeid`: `visualPalette: 'ink'`, `layoutPattern: 'centered-singular'`, four `RevealLayer` entries, `totalDurationMs: 1800`
    - `khetech`: `'duotone-moss'`, `'split-asymmetric'`, four layers, 1500
    - `supportdeskops`: `'ember-graphite'`, `'full-bleed-canvas'`, four layers, 2600
    - `last-minute-pdf`: `'sunken-typographic'`, `'full-width-banded-typographic'`, four layers, 2100
    - Module top: `revealSpecs.forEach(spec => assert(spec.layers.length >= 3 && spec.totalDurationMs <= 3000))` and a pairwise distinctness assertion across `visualPalette`, `layoutPattern`, and `motionSequenceSignature`
    - _Requirements: 8.1, 8.2_

  - [x] 11.3 Write `artifacts/portfolio/src/tests/pbt/project-showcase.pbt.test.ts`
    - **Property 9: Project_Showcase reveal layer count and total duration** — for every `spec` in `revealSpecs`, assert `spec.layers.length ≥ 3` and `spec.totalDurationMs ≤ 3000`; for every pair `(specs[i], specs[j]) where i ≠ j`, assert distinct on all three dimensions concurrently
    - Add a fast-check property over arbitrary 4-tuples of `RevealSpec` candidates and assert the pairwise-distinctness validator catches violations (200 runs)
    - _Property 9_
    - _Requirements: 8.1, 8.2_

  - [x] 11.4 Create `artifacts/portfolio/src/scenes/Work/ProjectReveal.tsx`
    - Lazy-dispatching component that takes `projectId` + record and renders the matching reveal renderer; under `Reduced_Motion_Mode` renders the **final composed state** statically with all variants passed through `applyReducedMotion`
    - _Requirements: 8.10_

  - [x] 11.5 Create `artifacts/portfolio/src/scenes/Work/reveals/GlobeIDReveal.tsx`
    - `centered-singular` layout; thin-line vector-glyph globe drawn via SVG `pathLength` 0→1 over 1200 ms with `motion.ease.out-soft`; headline + tagline + magnetic CTA per the design's motion sequence; ember-tinted seam via `--hue-amber`
    - Variants registered through `registerVariant` so `applyReducedMotion` can collapse them
    - Project link uses `<Link kind="live"…>` with `target="_blank" rel="noopener noreferrer"`
    - _Requirements: 8.1, 8.2, 8.3, 8.7, 8.8_
    - _Property 9_

  - [x] 11.6 Create `artifacts/portfolio/src/scenes/Work/reveals/KhetechReveal.tsx`
    - `split-asymmetric` 5/12 + 7/12 grid; clip-path mask wipe `inset(100% 0 0 0) → inset(0)` over 900 ms; CSS `filter` duotone (moss tint) over 600 ms; word-by-word prose stagger; outcome numerals slide
    - _Requirements: 8.1, 8.2, 8.3, 8.7, 8.8_
    - _Property 9_

  - [x] 11.7 Create `artifacts/portfolio/src/scenes/Work/reveals/SupportDeskOpsReveal.tsx`
    - `full-bleed-canvas` SVG reward curve drawn via cumulative `stroke-dashoffset` over 1600 ms (linear easing); bottom-left headline group rises; bottom-right counters tick with `useMotionValue` interpolation; ember accent flash at +2400 ms
    - _Requirements: 8.1, 8.2, 8.3, 8.7, 8.8_
    - _Property 9_

  - [x] 11.8 Create `artifacts/portfolio/src/scenes/Work/reveals/LastMinutePDFReveal.tsx`
    - `full-width-banded-typographic` cipher "PDF" in `--font-display`; outlined glyph scale-in 0.92 → 1.0 over 700 ms; one glyph fills via `fill-opacity` at +800 ms; line-by-line summary fade; CTA `translateX 24 → 0`
    - _Requirements: 8.1, 8.2, 8.3, 8.7, 8.8_
    - _Property 9_

  - [x] 11.9 Create `artifacts/portfolio/src/scenes/Work/TheWork.tsx`
    - `<section id="scene-work" aria-labelledby="work-h2">` with `<h2 id="work-h2">The Work</h2>`
    - Iterates `projects` from the registry in `Content_Registry` order; for each, runs `validateProject(p)` and either renders `<ProjectReveal>` (with sub-anchor `id={\`scene-work-\${p.id}\`}`) or — on a missing required data point per R8.9 — emits a non-blocking `<aside role="status">` indicating the entry was skipped while continuing to render remaining projects
    - Not rendered inside a single uniform card grid; reveals stack inside the parent `asymmetric-editorial` scene
    - Lazy-loads case-study deep-dives via `React.lazy(() => import('./case-studies/...'))` for in-place expansion at `desktop`+ widths
    - _Requirements: 8.1, 8.4, 8.5, 8.6, 8.7, 8.9_

  - [x] 11.10 Create `artifacts/portfolio/src/scenes/Ethos.tsx` and `src/scenes/Signal.tsx`
    - `Ethos.tsx`: `<section id="scene-ethos" aria-labelledby="ethos-h2">` with `<h2 id="ethos-h2">Ethos</h2>`; one continuous prose beat (≥ 1 viewport tall on both reference viewports) communicating AI / product / system-builder orientation as prose, not tags; pulls from registry `identity.ethos`
    - `Signal.tsx`: `<section id="scene-signal" aria-labelledby="signal-h2">` with `<h2 id="signal-h2">Signal</h2>`; renders one `mailto:devanshbarai.official@gmail.com` link, one LinkedIn link, one GitHub link (each via `<Link>`); hit-area ≥ 44×44 CSS px; redundant trailing-arrow cue for off-origin
    - _Requirements: 1.7, 2.6, 6.1, 6.2, 7.1, 8.8, 9.5, 9.6, 12.8, 14.7_

- [x] 12. Cinematic background (lazy after FCP)
  - [x] 12.1 Create `artifacts/portfolio/src/cinematic-background/capabilities.ts` and `src/cinematic-background/post-fcp-loader.ts`
    - `capabilities.ts`: `resolveCinematicMode(): 'webgl' | 'static' | 'off'` returning `'off'` server-side, `'static'` if reduced-motion or `connection.saveData` or `hardwareConcurrency ≤ 4` or `deviceMemory ≤ 4` or no WebGL context, else `'webgl'`; export `hasWebGL()`
    - `post-fcp-loader.ts`: `schedulePostFCPLoad()` invokes `requestIdleCallback(cb, { timeout: 1500 })` (or `setTimeout(250)` fallback) to dynamic-import `WebGLLayer`
    - _Requirements: 5.7, 10.4, 12.6, 12.7, 12.9_

  - [x] 12.2 Create `artifacts/portfolio/src/cinematic-background/webgl/shader.frag.ts`, `shader.vert.ts`, `WebGLLayer.tsx`
    - `shader.vert.ts` / `shader.frag.ts`: domain-warped value-noise fragment shader tinted with `--hue-amber × --surface-base`; combined source ≤ 1 KB gz
    - `WebGLLayer.tsx`: the **only** module importing `WebGLRenderingContext` types; sets up program/quad once; `requestAnimationFrame` loop throttled to 30 fps while scrolling (subscribed to shared `useScroll`); pauses entirely on `document.visibilitychange === 'hidden'`; full module ≤ 4 KB gz
    - _Requirements: 5.4, 5.8, 10.4_

  - [x] 12.3 Create `artifacts/portfolio/src/cinematic-background/CinematicBackground.tsx`
    - Public boundary; imports nothing from `webgl/*` directly except via `React.lazy(() => import('./webgl/WebGLLayer'))`
    - Renders `<div data-cinematic="static" aria-hidden="true" />` when `mode !== 'webgl'`; else `<Suspense fallback={<div data-cinematic="static" aria-hidden="true" />}><WebGLLayer/></Suspense>`
    - Always `pointer-events: none`, `position: fixed`, `inset: 0`, `z-index: -1`; foreground content unaffected when this layer is removed (R3.8)
    - _Requirements: 3.7, 3.8, 10.4_

- [x] 13. App shell wiring and DOM smoke tests
  - [x] 13.1 Create `artifacts/portfolio/src/App.tsx`
    - Mount semantic landmarks: `<a class="skip-to-content" href="#main-content">`, `<header role="banner"><nav aria-label="Primary">…</nav></header>`, `<main id="main-content" tabindex="-1">…</main>`, `<footer role="contentinfo">` with `<ReducedMotionToggle/>` + `<ThemeToggle/>` (from task 13.8) + persistent legal line
    - Eagerly import `Threshold`; lazy-import `TwinCompass`, `TheWork`, `Ethos`, `Signal`, `CinematicBackground` via `React.lazy + <Suspense fallback={<SceneSkeleton />}>` with fallbacks reserving fixed min-height matching each scene's expected size (CLS ≤ 0.05)
    - Wrap the tree in `LazyMotion features={domAnimation} strict`, `ScrollSourceProvider`, `ThemeProvider`, `ReducedMotionProvider`, `BreakpointProvider`
    - On mount call `schedulePostFCPLoad()` to bring up `CinematicBackground`
    - Mount `hash-router` listener via `useHashRouter()`
    - Heading hierarchy: exactly one `<h1>` (Threshold), four `<h2>`s (one per remaining scene), `<h3>`s for each project
    - Delete legacy files: `src/portfolio.css`, `src/pages/Portfolio.tsx`, `src/pages/not-found.tsx` (no longer imported)
    - _Requirements: 3.5, 3.6, 6.1, 6.3, 6.6, 10.5, 13.5, 13.7, 13.8, 13.13_

  - [x] 13.2 Update `artifacts/portfolio/src/main.tsx` and replace `src/index.css`
    - `main.tsx`: mount `<App/>` into `#root`; first-paint inline-script for theme + reduced-motion hydration (consumes the helper from `accessibility/*`)
    - `index.css`: replace contents with `@import "./styles/theme.css"; @import "./styles/reset.css"; @import "./styles/fonts.css";` and **only** that
    - Update `artifacts/portfolio/index.html` to preload the display font, set `<html lang="en">`, include `<title>Devansh Barai — portfolio</title>`, and seed pre-rendered identity/role/project text (filled by task 15.4)
    - _Requirements: 4.8, 10.11, 13.13_

  - [x] 13.3 Write `artifacts/portfolio/src/tests/dom/hash-routing.test.tsx`
    - Unknown hash (`#nonexistent`) renders the opening scene without runtime error and exposes a non-blocking `[role="status"]` toast
    - Known hash (`#work`) positions `#scene-work` within the sticky-header tolerance ±2 px after `await waitFor`
    - Reduced-motion mode positions the section instantly (`scrollTo` called with `behavior: 'auto'`)
    - _Requirements: 6.7, 14.2, 14.3, 14.4, 14.5_

  - [x] 13.4 Write `artifacts/portfolio/src/tests/dom/focus-management.test.tsx`
    - Tab from a fresh `<App/>` mounts focus on the skip link; activating it moves focus into `#main-content` (`tabindex="-1"`)
    - Every interactive element exposes a non-empty `accessible name` (queried via `getByRole`)
    - Focus indicator on a primary CTA has computed outline thickness ≥ 2 CSS px and ≥ 3:1 contrast (resolved via the contrast utility from 2.4)
    - Tab order matches visual order across Threshold → TwinCompass → Work → Ethos → Signal
    - _Requirements: 13.5, 13.6, 13.7, 13.9_

  - [x] 13.5 Write `artifacts/portfolio/src/tests/dom/reduced-motion-toggle.test.tsx`
    - Toggle persists across remounts via `localStorage["pcr.reduced-motion"]`
    - When toggled on, `applyReducedMotion` is observed via a stub registered by `getResolvedVariant`
    - "Match system" button clears the override and reverts to `matchMedia` value
    - _Requirements: 13.1, 13.2, 13.3_

  - [x] 13.6 Write `artifacts/portfolio/src/tests/dom/no-runtime-fetch.test.tsx`
    - Mount `<App/>`, scroll programmatically through every scene anchor, assert global `fetch` is never called and `XMLHttpRequest` is never instantiated for the lifetime of the mount (stub both via `vi.spyOn`)
    - _Requirements: 10.10_

  - [x] 13.7 Write `artifacts/portfolio/src/tests/dom/project-showcase-render.test.tsx`
    - Mount `<App/>`, force `#scene-work` into view; assert the four reveals render in the exact `Content_Registry` order (`GlobeID`, `Khetech`, `SupportDeskOps-v6`, `Last-Minute PDF`) and that the order is identical across two consecutive remounts (R8.5, R8.6)
    - Assert every external project link has `target="_blank"` and `rel="noopener noreferrer"` set in the DOM **before** any pointer interaction (R8.8)
    - Assert the `<aside role="status">` skip indicator appears when a single fixture project is mutated to omit a required `R8.3` field (R8.9), while the remaining three still render in order
    - _Requirements: 8.5, 8.6, 8.8, 8.9_

  - [x] 13.8 Create `artifacts/portfolio/src/design-system/primitives/ThemeToggle.tsx` and wire into `<footer>`
    - `<button role="switch" aria-pressed={state} aria-label="Theme">…</button>` reading / writing via `accessibility/theme-store.ts` (`pcr.theme` key) with persistence across browser sessions; renders text label "Theme: dark" / "Theme: light" (redundant non-color cue per R13.12)
    - Toggle applies the `data-theme` attribute on `<html>` consumed by `theme.css`; pre-paint hydration helper from `theme-store.ts` runs before first paint to prevent flash
    - _Requirements: 3.5, 3.6, 13.2, 13.12_

- [x] 14. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 15. Build hygiene, payload budget, and pre-rendered HTML
  - [x] 15.1 Create `artifacts/portfolio/budget.json`
    - `{ "aboveTheFoldJsBytesGz": 184320, "aboveTheFoldTotalBytesGz": 358400, "criticalEntries": ["main", "scenes/Threshold"] }`
    - _Requirements: 11.7, 11.8_

  - [x] 15.2 Create `artifacts/portfolio/scripts/budget.mjs`
    - Reads `dist/public/.vite/manifest.json`, walks each `criticalEntries` chunk's transitive imports, gzips each emitted JS / CSS file via `gzip-size`, sums HTML+CSS+JS for the total cap
    - Prints `BUDGET FAIL: …` and `process.exit(1)` if either limit is exceeded; prints `BUDGET OK: js=…, total=…` on green
    - _Requirements: 10.6, 11.7, 11.8_

  - [x] 15.3 Update `artifacts/portfolio/package.json` `build` script and add `scripts.budget` / `scripts.deps:check` / `scripts.prerender`
    - `"build": "vite build --config vite.config.ts && node scripts/prerender.mjs && node scripts/budget.mjs"`
    - `"deps:check": "node scripts/check-deprecations.mjs"`
    - Treat Vite warnings as errors via `build.rollupOptions.onwarn = (w) => { throw w }`
    - _Requirements: 10.6, 19.2, 19.6_

  - [x] 15.4 Create `artifacts/portfolio/scripts/prerender.mjs` and `artifacts/portfolio/scripts/check-deprecations.mjs`
    - `prerender.mjs`: import `react-dom/server` to renderToString a minimal SSR shell; inject `Devansh Barai`, the role headline, and each project's name + tagline as static text into `dist/public/index.html` so crawlers / link previews extract content with no JS executed
    - `check-deprecations.mjs`: spawn `pnpm install --reporter=ndjson`, parse stderr for production-tree deprecation events, exit non-zero on first hit
    - _Requirements: 10.11, 19.6_

  - [x] 15.5 Update `artifacts/portfolio/vite.config.ts` for code splitting and chunking
    - `manualChunks` keeps `react`, `react-dom`, and `framer-motion` (`m` mini export only) on the critical path; everything in `scenes/Work/*`, `scenes/Ethos`, `scenes/Signal`, `scenes/TwinCompass`, `cinematic-background/*`, and `motion/lenis-bridge` ends up in lazy chunks
    - Configure `build.cssCodeSplit: true`, `assetsInlineLimit: 0`, `build.target: 'es2022'`, `build.sourcemap: false`
    - Configure font asset hashing + `<link rel="preload" as="font" crossorigin>` injection for the display family
    - _Requirements: 4.8, 10.5, 11.7, 11.8_

  - [x] 15.6 Create `artifacts/portfolio/src/perf/fps-sampler.ts`
    - Export `startFpsSampler(onSample, windowMs = 1000)` that returns a teardown; samples per-frame rates via `requestAnimationFrame`, computes `p05`/`p50`/`p95` over a rolling 1-second window
    - Always-on in development (`NODE_ENV !== 'production'`), output to `console.debug`; off in production unless `window.__PCR_FPS_DEBUG__ === true`
    - Imported by `App.tsx` only behind a `process.env.NODE_ENV !== 'production'` guard so the production bundle drops it
    - _Requirements: 5.5, 11.5, 11.6_

- [x] 16. Lint enforcement of architectural invariants
  - [x] 16.1 Add custom ESLint rules `no-window-scroll-listeners` and `no-raw-spacing` to `artifacts/portfolio/eslint.config.js`
    - `no-window-scroll-listeners`: forbid `addEventListener('scroll', …)` on `window` or `document` in any file other than `src/motion/scroll-source.ts` (R5.2)
    - `no-raw-spacing`: forbid raw `px` or `rem` literals in any `margin*`, `padding*`, or `gap` declaration outside `tokens.ts` and `theme.css` (R3.3, R10.2)
    - Wire `pnpm lint` to fail on either violation
    - _Requirements: 3.3, 5.2, 10.2_

  - [x] 16.2 Add ESLint `no-restricted-imports` and `no-registry-bypass` rules
    - `no-restricted-imports`: block `@workspace/api-server` and `@workspace/api-client-react` from every file in `artifacts/portfolio/src` (R10.10 — static, no runtime API)
    - `no-registry-bypass`: forbid string literals matching `/(GlobeID|Khetech|SupportDeskOps-v6|Last-Minute PDF|Devansh Barai|devanshbarai\.official@gmail\.com|linkedin\.com\/in\/devansh-barai|github\.com\/Devanshisbroke)/` in any rendering module outside `src/content-registry/` (R15.8)
    - Add a vitest grep guard `src/tests/dom/registry-only-literals.test.ts` that walks `src/scenes/`, `src/design-system/`, `src/motion/`, `src/cinematic-background/`, `src/route-map/data.ts`, and asserts no banned literal appears
    - _Requirements: 10.10, 15.8_

- [x] 17. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP. **No tasks here are marked optional**: every PBT property in this spec is non-optional (R15–R18 require executable property tests, and the design's twelve correctness properties form the core architectural contract). Unit / DOM smoke tests are likewise required because they cover acceptance criteria with no other harness.
- TDD discipline: every PBT test task is ordered **before** its implementation task. The test file is committed in the "red" state and turns green only when the implementation in the next task lands.
- Each task references specific requirements clauses (granular sub-requirements, not just user stories). PBT tasks additionally reference the `Property N` they implement.
- Checkpoints (tasks 14 and 17) ensure incremental validation; no automated tests run there beyond the existing `pnpm test` and `pnpm --filter @workspace/portfolio run build`.
- File paths are relative to `artifacts/portfolio/` unless otherwise noted. The package name is `@workspace/portfolio`; the workspace already has it wired in `pnpm-workspace.yaml`.
- The Above_The_Fold critical path is exactly: `main.tsx`, `App.tsx`, `styles/*`, `design-system/{tokens,primitives}`, `motion/{scroll-source,reduced-motion,variant-types,motion-create,primitives/Reveal}`, `content-registry/data.ts`, `route-map/*`, `responsive-engine/*`, `accessibility/*`, `scenes/Threshold.tsx`. Everything else is lazy.
- The Cinematic_Background ships **only** as a hand-rolled WebGL shader (≤ 4 KB gz) plus a CSS-only static fallback. `three.js` is not adopted (would consume ~18 % of the 180 KB Above_The_Fold JS budget).
- Banned audited-baseline signatures (R2.2, R2.5, R7.4) — glassmorphism cards as primary surface, cyan→indigo→pink hero gradient, aurora blobs, full-screen noise, gradient-text on every heading, role typewriter, percentage skill bars, status badges, global cursor swap — must not be reintroduced by any task. The lint rules in tasks 16.1 and 16.2 plus the DOM tests in 9.2, 13.4, and 16.2's grep guard are the enforcement surface.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1", "3.1", "4.1", "5.1", "6.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "2.2", "3.2", "3.4"] },
    { "id": 2, "tasks": ["1.4", "1.5", "2.3", "2.4", "3.3", "3.5", "4.2", "5.2", "6.2"] },
    { "id": 3, "tasks": ["2.5", "3.6", "4.3", "5.3", "6.3", "6.4", "7.1"] },
    { "id": 4, "tasks": ["3.7", "4.4", "4.5", "5.4", "6.5", "7.2", "7.3", "10.1", "11.2"] },
    { "id": 5, "tasks": ["6.6", "6.7", "8.1", "8.2", "10.2", "11.3", "13.8"] },
    { "id": 6, "tasks": ["9.1", "11.1", "11.4", "11.10", "12.1", "15.1"] },
    { "id": 7, "tasks": ["11.5", "11.6", "11.7", "11.8", "12.2"] },
    { "id": 8, "tasks": ["11.9", "12.3"] },
    { "id": 9, "tasks": ["13.1"] },
    { "id": 10, "tasks": ["9.2", "13.2", "13.3", "13.4", "13.5", "13.6", "13.7"] },
    { "id": 11, "tasks": ["15.2", "15.4", "15.5", "15.6"] },
    { "id": 12, "tasks": ["15.3", "16.1", "16.2"] }
  ]
}
```
