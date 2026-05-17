/**
 * Reduced-motion transformer (R5.7, R8.10, R18.1–R18.5).
 *
 * Pure-data gate that collapses every `MotionVariant` to either an
 * instantaneous state-swap or a ≤ 120 ms cross-fade by stripping every
 * transform channel, dropping `delayMs`, clamping `durationMs`, and
 * retaining only `opacity` / `color` plus the original `easing` token.
 *
 * The transformer is a pair: `applyReducedMotion` walks a variant
 * forward into reduced form, and `applyFullMotion(originalKeyframes)`
 * is a curried "involution closure" that restores the original
 * keyframes onto a reduced variant. Together they satisfy Property 8
 * sub-properties 8a–8d (see `tests/pbt/reduced-motion.pbt.test.ts`):
 *
 *   8a. `totalDurationMs(applyReducedMotion(v)) === 0 || ≤ 120`
 *   8b. `applyReducedMotion(applyReducedMotion(v))` deep-equals
 *       `applyReducedMotion(v)` — idempotent.
 *   8c. Every keyframe's `transform` deep-equals `{}` after reduction.
 *   8d. `applyFullMotion(v.keyframes)(applyReducedMotion(v))`
 *       deep-equals `v`.
 *
 * Runtime read-out — `matchReducedMotion()` — is a forward-declared
 * thin wrapper. The concrete `accessibility/reduced-motion-store.ts`
 * arrives in task 7.1 and will own the persisted toggle, the
 * `prefers-reduced-motion` media subscription, and the storage event
 * fan-out. Until then we read `localStorage` and `matchMedia` directly
 * as a stop-gap so this module has no hard dependency on the store.
 *
 * Validates: Requirements 5.7, 8.10, 18.1, 18.2, 18.3, 18.4, 18.5
 *
 * Rules:
 *  - No DOM, React, or animation-library imports. The transformer is
 *    pure data — input MotionVariant → output MotionVariant.
 *  - `applyReducedMotion` MUST NOT mutate its argument.
 *  - The output keyframe shape MUST be deterministic so that 8b's
 *    deep-equality holds across repeated applications: identity
 *    transform `{}`, no `delayMs` key, clamped `durationMs`, original
 *    `easing`, and `opacity` / `color` keys present iff the input
 *    keyframe had them defined (a `!== undefined` check, not an `in`
 *    check, so explicitly-`undefined` source fields collapse away).
 */

import type { MotionKeyframe, MotionVariant } from './variant-types';

// ---------------------------------------------------------------------------
// Reduced-motion ceiling
// ---------------------------------------------------------------------------

/**
 * Maximum `durationMs` permitted on a reduced-motion keyframe (R18.2).
 * Exposed as a named constant so the design's 120 ms ceiling has one
 * canonical home — sub-property 8a's bound is asserted against the
 * same value the transformer applies.
 */
export const REDUCED_MOTION_MAX_DURATION_MS = 120;

// ---------------------------------------------------------------------------
// applyReducedMotion
// ---------------------------------------------------------------------------

/**
 * Reduce a `MotionVariant` to its accessibility-safe form.
 *
 * For every keyframe:
 *  - `transform` is replaced with the identity `{}` (R18.3, 8c —
 *    strips `translateX`, `translateY`, `scale`, `rotate`, and
 *    `scrollLinked` in one stroke).
 *  - `durationMs` is clamped to `min(original, 120)` (R18.2).
 *  - `delayMs` is dropped entirely so the variant lands within
 *    `≤ 120 ms` total (R18.2 / sub-property 8a).
 *  - `easing` is retained unchanged — curve choice is independent of
 *    motion magnitude (R18.4).
 *  - `opacity` and `color` are retained iff the source keyframe had
 *    them defined; a fade or color cross-fade is the only remaining
 *    expressive channel (R18.4, R8.10).
 *
 * The `id` is preserved so `applyFullMotion`'s closure can rejoin the
 * original keyframes against the reduced variant by id-equality
 * (sub-property 8d).
 */
export function applyReducedMotion(v: MotionVariant): MotionVariant {
  return {
    id: v.id,
    keyframes: v.keyframes.map(reduceKeyframe),
  };
}

/**
 * Per-keyframe reducer. Built with conditional spreads so that
 * source fields explicitly set to `undefined` (e.g. by the
 * `fc.option(..., { nil: undefined })` PBT generator) collapse away
 * rather than leaving an `opacity: undefined` key on the output.
 * That is what makes sub-property 8b's strict-equality idempotence
 * hold: the second pass sees no `opacity` key, omits no `opacity`
 * key, and the two outputs match byte-for-byte.
 */
function reduceKeyframe(k: MotionKeyframe): MotionKeyframe {
  const reduced: MotionKeyframe = {
    transform: {},
    durationMs: Math.min(k.durationMs, REDUCED_MOTION_MAX_DURATION_MS),
    easing: k.easing,
    ...(k.opacity !== undefined ? { opacity: k.opacity } : {}),
    ...(k.color !== undefined ? { color: k.color } : {}),
  };
  return reduced;
}

// ---------------------------------------------------------------------------
// applyFullMotion — involution closure
// ---------------------------------------------------------------------------

/**
 * Restore a reduced variant to its full-motion form.
 *
 * Curried: `applyFullMotion(originalKeyframes)` returns a function
 * that takes a reduced variant and yields a new variant carrying the
 * supplied original keyframes. The reduced variant's `id` is
 * preserved (it already matches the original by 8b's idempotence
 * guarantee), and the original keyframes are substituted back in
 * verbatim.
 *
 * Together with `applyReducedMotion` this satisfies sub-property 8d:
 *
 *   `applyFullMotion(v.keyframes)(applyReducedMotion(v))` ≡ `v`
 *
 * The "memoised registry keyed by `MotionVariant.id`" referenced in
 * `design.md` is, in this implementation, the closure variable
 * `originalKeyframes` itself: each registered variant is paired with
 * its keyframes at registration time and the closure carries that
 * pairing forward. The variant registry (task 6.4) constructs these
 * closures once per registered variant, so no separate `Map` lookup
 * is required at resolution time.
 */
export function applyFullMotion(
  originalKeyframes: readonly MotionKeyframe[],
): (reduced: MotionVariant) => MotionVariant {
  return (reduced) => ({
    id: reduced.id,
    keyframes: originalKeyframes,
  });
}

// ---------------------------------------------------------------------------
// matchReducedMotion — runtime read-out (forward-declared)
// ---------------------------------------------------------------------------

const REDUCED_MOTION_STORAGE_KEY = 'pcr.reduced-motion';

/**
 * Read the active Reduced_Motion_Mode flag.
 *
 * Forward-declared API — the concrete persistent store lives in
 * `accessibility/reduced-motion-store.ts` (task 7.1). Until that
 * module exists, this function reads `localStorage` and the
 * `prefers-reduced-motion` media query directly as a stop-gap so
 * `motion/` has no hard import on a not-yet-written sibling.
 *
 * Resolution order matches the design's intent (R13.1, R13.2):
 *  1. Explicit user toggle persisted under `pcr.reduced-motion`
 *     (`'true'` / `'false'`) — a deliberate override always wins.
 *  2. The OS-level `prefers-reduced-motion: reduce` media query.
 *  3. Default `false` (full motion) on environments without `window`
 *     (SSR / tests that don't simulate a DOM).
 *
 * When task 7.1 lands, the body becomes a single delegated read into
 * the store (`return store.readReducedMotion();`); the resolution
 * order above moves into the store itself. Call sites of
 * `matchReducedMotion()` do not need to change.
 */
export function matchReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const persisted = window.localStorage?.getItem(REDUCED_MOTION_STORAGE_KEY);
    if (persisted === 'true') return true;
    if (persisted === 'false') return false;
  } catch {
    // `localStorage` access can throw in private/strict-mode browsers
    // and in test environments that stub it with a throwing surface.
    // Fall through to the media query.
  }

  if (typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  return false;
}
