/**
 * Reduced-motion transformer — property-based tests.
 *
 * One property from `design.md` § "Properties to verify", split
 * across the four sub-properties enumerated by tasks.md task 6.2:
 *
 *   8a. `totalDurationMs(applyReducedMotion(v)) === 0 || ≤ 120`.
 *   8b. Idempotence: `applyReducedMotion(applyReducedMotion(v))`
 *       deep-equals `applyReducedMotion(v)`.
 *   8c. Transform restriction: every keyframe's `transform`
 *       deep-equals `{}` (the identity transform), which by
 *       construction implies no `scale > 1.05`, no `rotate`, and no
 *       `scrollLinked` channel survives the transformer.
 *   8d. Involution: `applyFullMotion(v.keyframes)(applyReducedMotion(v))`
 *       deep-equals `v`.
 *
 * Each sub-property runs ≥ 200 iterations (the global `numRuns` is
 * configured by `src/tests/setup.ts` via `fc.configureGlobal`; an
 * explicit `{ numRuns: 200 }` is passed defensively per task 6.2).
 *
 * The API surface bound here is the one specified by `design.md`
 * (§ "Property 8" pseudo-code) and tasks.md task 6.3:
 *   - `applyReducedMotion(v: MotionVariant): MotionVariant`
 *   - `applyFullMotion(originalKeyframes)(reduced): MotionVariant`
 *     — a curried "involution closure" keyed by the original
 *     keyframes captured at registration time.
 *
 * NOTE — TDD red state:
 *   The transformer imported below lives in
 *   `src/motion/reduced-motion.ts`, which is created in task 6.3.
 *   This file is committed in red state and turns green once 6.3
 *   lands. That is intentional. Do **not** add a stub here to make
 *   the imports resolve early — the failing import is the contract
 *   that 6.3 must satisfy.
 *
 * Validates: Requirements 18.1, 18.2, 18.3, 18.4, 18.5, 5.7, 8.10
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

import { arbMotionVariant } from './_generators';
import {
  applyReducedMotion,
  applyFullMotion,
} from '../../motion/reduced-motion';
import { totalDurationMs } from '../../motion/variant-types';

// ---------------------------------------------------------------------------
// Property 8 — Reduced-motion transformer bounds, idempotence,
//              transform restriction, involution
// ---------------------------------------------------------------------------

describe('Property 8 — Reduced-motion transformer', () => {
  // -------------------------------------------------------------------------
  // Sub-property 8a — total-duration bound
  // -------------------------------------------------------------------------

  /**
   * Validates: Requirements 18.1, 18.2
   *
   * For every generated `MotionVariant`, the reduced-motion
   * transformer collapses the variant to either an instantaneous
   * (`totalDurationMs === 0`) state-swap or a cross-fade no longer
   * than the design's reduced-motion ceiling of 120 ms (R18.2).
   * This is the core perf/comfort guarantee: no scroll-linked or
   * long-duration motion survives the transformer.
   */
  it('Sub-property 8a — totalDurationMs is 0 or ≤ 120 ms', () => {
    fc.assert(
      fc.property(arbMotionVariant, (v) => {
        const reduced = applyReducedMotion(v);
        const total = totalDurationMs(reduced);
        expect(total === 0 || total <= 120).toBe(true);
      }),
      { numRuns: 200 },
    );
  });

  // -------------------------------------------------------------------------
  // Sub-property 8b — idempotence
  // -------------------------------------------------------------------------

  /**
   * Validates: Requirements 18.3
   *
   * Applying the transformer to an already-reduced variant MUST be
   * a no-op. This guards against accidental "double application"
   * drift: if a downstream caller routes a variant through the
   * reduced-motion gate twice (e.g. via `getResolvedVariant` after
   * a `registerVariant` round-trip), the resulting keyframes must
   * be byte-for-byte identical to a single application. Without
   * this property, repeated toggling could introduce silent
   * accumulation errors in `delayMs` / `durationMs` clamping.
   */
  it('Sub-property 8b — applyReducedMotion is idempotent', () => {
    fc.assert(
      fc.property(arbMotionVariant, (v) => {
        const once = applyReducedMotion(v);
        const twice = applyReducedMotion(once);
        expect(twice).toStrictEqual(once);
      }),
      { numRuns: 200 },
    );
  });

  // -------------------------------------------------------------------------
  // Sub-property 8c — transform restriction
  // -------------------------------------------------------------------------

  /**
   * Validates: Requirements 18.4, 5.7, 8.10
   *
   * Every keyframe emitted by the transformer MUST present an
   * empty (identity) `transform` object. Asserting strict deep
   * equality with `{}` is the strongest form of the design's
   * "transform component restricted to identity, opacity-only, or
   * color-only" clause — any surviving channel (`translateX`,
   * `translateY`, `scale`, `rotate`, `scrollLinked`) would surface
   * as a key on the transform record and fail this assertion. By
   * construction this also forbids `scale > 1.05`, `rotate`, and
   * `scrollLinked`, the three channels singled out by tasks.md 6.2.
   */
  it('Sub-property 8c — every keyframe transform deep-equals {}', () => {
    fc.assert(
      fc.property(arbMotionVariant, (v) => {
        const reduced = applyReducedMotion(v);
        for (const k of reduced.keyframes) {
          expect(k.transform).toStrictEqual({});
        }
      }),
      { numRuns: 200 },
    );
  });

  // -------------------------------------------------------------------------
  // Sub-property 8d — involution (round-trip restoration)
  // -------------------------------------------------------------------------

  /**
   * Validates: Requirements 18.5
   *
   * The "full motion" closure restores a reduced variant to its
   * original keyframes when the original keyframes are supplied as
   * the closure argument. The curried shape
   * `applyFullMotion(originalKeyframes)(reduced)` is the explicit
   * involution form named by `design.md` § "Property 8" pseudo-code
   * and by tasks.md task 6.3. The closure preserves `id` from the
   * reduced argument (which itself preserves `id` from the original
   * via 8b's idempotence guarantee), so the restored variant must
   * deep-equal the original variant verbatim.
   */
  it('Sub-property 8d — applyFullMotion reverses applyReducedMotion', () => {
    fc.assert(
      fc.property(arbMotionVariant, (v) => {
        const reduced = applyReducedMotion(v);
        const restored = applyFullMotion(v.keyframes)(reduced);
        expect(restored).toStrictEqual(v);
      }),
      { numRuns: 200 },
    );
  });
});
