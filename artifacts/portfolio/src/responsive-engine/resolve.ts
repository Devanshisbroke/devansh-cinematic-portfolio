/**
 * Responsive_Engine resolvers.
 *
 * Pure functions that turn a viewport width (CSS px) into the four
 * named Breakpoint_Tiers and the per-tier `LayoutTier` payload that
 * downstream layout, typography, and reveal-stagger code reads.
 *
 * Sourced from `requirements.md` Requirements 12 and 17, and
 * `design.md` § Component architecture → `responsive-engine/` and
 * § Correctness Properties → Property 6 (resolver totality /
 * determinism / monotonicity) and Property 7 (layout-tier idempotence
 * within a tier).
 *
 * Tier viewport-width partition (R12.1, contiguous, non-overlapping):
 *  - `mobile`    [320,  767]
 *  - `tablet`    [768, 1023]
 *  - `desktop`   [1024, 1919]
 *  - `ultrawide` [1920,    ∞)
 *
 * Widths below 320 px clamp to `mobile`; non-finite inputs (NaN, ±∞)
 * also clamp to `mobile` so the resolver is total over every `number`
 * value (R17.1, design Property 6 sub-property 6d).
 *
 * Validates: Requirements 12.1, 12.2, 17.1, 17.2, 17.3, 17.4
 *
 * Rules:
 *  - This module is pure: no I/O, no globals, no observers. The
 *    `useBreakpoint` hook (task 5.4) wraps these resolvers and is the
 *    single place that touches `window.matchMedia` / `ResizeObserver`.
 *  - Per-tier `LayoutTier` values are module-scoped readonly singletons.
 *    Property 7 (deep-equal across same-tier widths) holds by reference
 *    identity by construction — no allocation per call, no drift.
 *  - Token-named spacing (`SpacingStep`) keeps the no-raw-spacing
 *    invariant intact end-to-end (R3.3).
 */

import type { Breakpoint, LayoutTier } from './types';

// ---------------------------------------------------------------------------
// Tier upper bounds (R12.1)
// ---------------------------------------------------------------------------
//
// Inclusive upper bounds of the `mobile`, `tablet`, and `desktop` tiers.
// Anything strictly above the `desktop` upper bound resolves to
// `ultrawide`. Defined as named constants rather than inline literals so
// the partition is auditable in one place.

const MOBILE_UPPER_INCLUSIVE = 767;
const TABLET_UPPER_INCLUSIVE = 1023;
const DESKTOP_UPPER_INCLUSIVE = 1919;

// ---------------------------------------------------------------------------
// Per-tier layout payloads (Property 7)
// ---------------------------------------------------------------------------
//
// Each constant is the canonical `LayoutTier` value for its tier. They
// are frozen-by-`as const` and live at module scope, so every call to
// `resolveLayoutTier(w)` returns the same reference for any two widths
// in the same tier — Property 7 (deep-equal idempotence) is satisfied
// by reference identity, no per-call allocation.
//
// Field rationales:
//  - `columns`                   — single column on `mobile` (R12.4),
//                                  six on `tablet`, twelve on `desktop`,
//                                  twelve on `ultrawide` (the wider tier
//                                  reuses the desktop column count and
//                                  spends its extra width on a larger
//                                  gutter and vertical rhythm).
//  - `gutterToken`               — `SpacingStep` for inter-column gutter.
//                                  Tier-scaled so wider viewports breathe
//                                  more.
//  - `maxMeasureCh`              — prose measure cap in `ch` units; bounds
//                                  long-form copy width regardless of
//                                  viewport (R4 readability).
//  - `sceneVerticalRhythmToken`  — `SpacingStep` for the vertical rhythm
//                                  between scene rows / blocks.
//  - `revealLayerStaggerMs`      — base ms delay between adjacent layers
//                                  in a `RevealSpec`. Narrower tiers
//                                  stage reveals more tightly than wider
//                                  ones.

const MOBILE_LAYOUT: LayoutTier = {
  columns: 1,
  gutterToken: '4',
  maxMeasureCh: 38,
  sceneVerticalRhythmToken: '7',
  revealLayerStaggerMs: 80,
} as const;

const TABLET_LAYOUT: LayoutTier = {
  columns: 6,
  gutterToken: '5',
  maxMeasureCh: 56,
  sceneVerticalRhythmToken: '8',
  revealLayerStaggerMs: 100,
} as const;

const DESKTOP_LAYOUT: LayoutTier = {
  columns: 12,
  gutterToken: '5',
  maxMeasureCh: 75,
  sceneVerticalRhythmToken: '9',
  revealLayerStaggerMs: 120,
} as const;

const ULTRAWIDE_LAYOUT: LayoutTier = {
  columns: 12,
  gutterToken: '6',
  maxMeasureCh: 75,
  sceneVerticalRhythmToken: '10',
  revealLayerStaggerMs: 140,
} as const;

// ---------------------------------------------------------------------------
// resolveBreakpoint (R12.1, R17.1, R17.2, R17.3)
// ---------------------------------------------------------------------------

/**
 * Resolve a viewport width (CSS px) to one of the four named
 * Breakpoint_Tiers.
 *
 * Totality (Property 6 sub-property 6a / 6d):
 *  - Every finite numeric width returns one of `'mobile' | 'tablet' |
 *    'desktop' | 'ultrawide'`.
 *  - Widths < 320 (including 0 and negative numbers) clamp to `mobile`.
 *  - Non-finite inputs (`NaN`, `±Infinity`) also clamp to `mobile` so
 *    the function never throws.
 *
 * Determinism (Property 6 sub-property 6b):
 *  - Pure function of the input width; no I/O, no closures over mutable
 *    state.
 *
 * Monotonicity (Property 6 sub-property 6c):
 *  - The integer-flooring step preserves the contiguous partition, so
 *    for any adjacent integer pair `(w, w+1)` the resolved tier rank
 *    delta lies in `{0, 1}` (verified by the PBT in
 *    `tests/pbt/responsive-engine.pbt.test.ts`).
 *
 * @param width Viewport width in CSS pixels.
 * @returns The resolved Breakpoint_Tier name.
 */
export function resolveBreakpoint(width: number): Breakpoint {
  // Clamp non-finite values (NaN, ±Infinity) and sub-mobile widths to
  // the narrowest tier. `Math.floor` collapses sub-pixel fractional
  // widths into the partition's integer grid so the monotonicity
  // contract is preserved across the real-valued input space too.
  const w = Number.isFinite(width) ? Math.floor(width) : 0;

  if (w <= MOBILE_UPPER_INCLUSIVE) return 'mobile';
  if (w <= TABLET_UPPER_INCLUSIVE) return 'tablet';
  if (w <= DESKTOP_UPPER_INCLUSIVE) return 'desktop';
  return 'ultrawide';
}

// ---------------------------------------------------------------------------
// resolveLayoutTier (Property 7, R17.4)
// ---------------------------------------------------------------------------

/**
 * Resolve a viewport width (CSS px) to its per-tier `LayoutTier`
 * payload.
 *
 * Idempotence within a tier (Property 7):
 *  - For any two widths `(w1, w2)` resolving to the same
 *    Breakpoint_Tier, this function returns the same module-scoped
 *    constant — `resolveLayoutTier(w1)` deep-equals (and reference-
 *    equals) `resolveLayoutTier(w2)`.
 *
 * @param width Viewport width in CSS pixels.
 * @returns The `LayoutTier` payload for the tier `width` resolves into.
 */
export function resolveLayoutTier(width: number): LayoutTier {
  switch (resolveBreakpoint(width)) {
    case 'mobile':
      return MOBILE_LAYOUT;
    case 'tablet':
      return TABLET_LAYOUT;
    case 'desktop':
      return DESKTOP_LAYOUT;
    case 'ultrawide':
      return ULTRAWIDE_LAYOUT;
  }
}
