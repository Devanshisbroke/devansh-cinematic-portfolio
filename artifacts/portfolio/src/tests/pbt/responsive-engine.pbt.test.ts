/**
 * Responsive_Engine — property-based tests.
 *
 * Two properties from `design.md` § "Properties to verify":
 *
 *   6. Breakpoint resolver totality, determinism, monotonicity.
 *   7. Layout-tier idempotence within a tier.
 *
 * Iteration counts (per task 5.2 of `tasks.md`):
 *   - Property 6 totality / determinism / monotonicity / extreme widths
 *     run at 500 iterations (the design calls for ≥ 500 on the totality
 *     check; we apply the same budget to determinism and monotonicity
 *     so adjacency and identity edges are both well-sampled).
 *   - Property 7 same-tier idempotence runs at 200 iterations (the
 *     `numRuns: 200` global default from `src/tests/setup.ts`).
 *
 * NOTE — TDD red state:
 *   The resolvers imported below live in
 *   `src/responsive-engine/resolve.ts`, which is created in task 5.3.
 *   This file is committed in red state and turns green once 5.3
 *   lands. That is intentional. Do **not** add a stub here to make
 *   the imports resolve early — the failing import is the contract
 *   that 5.3 must satisfy.
 *
 * Validates: Requirements 17.1, 17.2, 17.3, 17.4
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

import { arbWidth, arbWideWidth } from './_generators';
import {
  resolveBreakpoint,
  resolveLayoutTier,
} from '../../responsive-engine/resolve';
import { BREAKPOINT_RANK } from '../../responsive-engine/types';
import type { Breakpoint } from '../../responsive-engine/types';

// ---------------------------------------------------------------------------
// Tier constant — the closed, exhaustive set of valid resolver outputs.
// ---------------------------------------------------------------------------

/**
 * The four named Breakpoint_Tiers in narrowest→widest order, used by
 * Property 6's totality check (`resolveBreakpoint(w)` MUST be one of
 * these for every width in [320, 3840]).
 */
const TIERS: readonly Breakpoint[] = [
  'mobile',
  'tablet',
  'desktop',
  'ultrawide',
];

// ---------------------------------------------------------------------------
// Property 6 — Breakpoint resolver totality, determinism, monotonicity
// ---------------------------------------------------------------------------

describe('Property 6 — Breakpoint resolver totality, determinism, monotonicity', () => {
  /**
   * Validates: Requirements 17.1, 17.3
   *
   * Sub-property 6a: every integer width in [320, 3840] resolves to
   * exactly one of the four documented Breakpoint_Tiers (totality
   * over the supported range).
   */
  it('every width in [320, 3840] resolves to one of the four tiers (totality)', () => {
    fc.assert(
      fc.property(arbWidth, (w) => {
        const tier = resolveBreakpoint(w);
        expect(TIERS).toContain(tier);
      }),
      { numRuns: 500 },
    );
  });

  /**
   * Validates: Requirements 17.1
   *
   * Sub-property 6b: identical inputs produce identical outputs
   * (determinism). Three calls in a row gives strong evidence that
   * the resolver is pure with no hidden state.
   */
  it('resolveBreakpoint is deterministic — identical inputs produce identical outputs', () => {
    fc.assert(
      fc.property(arbWidth, (w) => {
        const a = resolveBreakpoint(w);
        const b = resolveBreakpoint(w);
        const c = resolveBreakpoint(w);
        expect(a).toBe(b);
        expect(b).toBe(c);
      }),
      { numRuns: 500 },
    );
  });

  /**
   * Validates: Requirements 17.2
   *
   * Sub-property 6c: for every adjacent pair `(w, w+1)` in
   * [320, 3839], the resolved tier rank is non-decreasing and the
   * delta lies in {0, 1}. Combined with sub-property 6a this
   * guarantees the resolver partitions the width range into four
   * contiguous, non-overlapping tiers (R17.3).
   *
   * The generator is bounded `max: 3839` so `w + 1` never exceeds
   * the supported range.
   */
  it('adjacent widths differ in rank by at most 1 (monotonicity)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 320, max: 3839 }), (w) => {
        const r1 = BREAKPOINT_RANK[resolveBreakpoint(w)];
        const r2 = BREAKPOINT_RANK[resolveBreakpoint(w + 1)];
        // Non-decreasing.
        expect(r2 - r1).toBeGreaterThanOrEqual(0);
        // Step ≤ 1.
        expect(r2 - r1).toBeLessThanOrEqual(1);
      }),
      { numRuns: 500 },
    );
  });

  /**
   * Validates: Requirements 17.1
   *
   * Sub-property 6d: extreme widths (below 320 and above 3840,
   * including 0) MUST NOT throw. Widths < 320 clamp to `mobile` and
   * widths ≥ 1920 stay in `ultrawide`; the resolver is total over
   * `arbWideWidth`'s [0, 7680] range as required by the design's
   * extreme-width robustness clause.
   */
  it('extreme widths do not throw and still resolve to a valid tier', () => {
    fc.assert(
      fc.property(arbWideWidth, (w) => {
        expect(() => resolveBreakpoint(w)).not.toThrow();
        expect(TIERS).toContain(resolveBreakpoint(w));
      }),
      { numRuns: 500 },
    );
  });

  /**
   * Validates: Requirements 17.3
   *
   * Surface check: every tier appears for at least one width in the
   * supported range. This complements the random-sampled totality
   * property with an exhaustive sweep so an accidental "always
   * mobile" regression cannot pass on a quiet day.
   *
   * This is an example-style test rather than a property; it runs
   * once, not 200 times, so it is left outside the fast-check
   * harness intentionally.
   */
  it('partition: every tier appears for at least one width in [320, 3840]', () => {
    const observed = new Set<Breakpoint>();
    for (let w = 320; w <= 3840; w += 1) {
      observed.add(resolveBreakpoint(w));
    }
    for (const tier of TIERS) {
      expect(observed.has(tier)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Property 7 — Layout-tier idempotence within a tier
// ---------------------------------------------------------------------------

describe('Property 7 — Layout-tier idempotence within a tier', () => {
  /**
   * Validates: Requirements 17.4
   *
   * For any two widths `(w1, w2)` resolving to the same
   * Breakpoint_Tier, `resolveLayoutTier(w1)` deep-equals
   * `resolveLayoutTier(w2)`. The `if (… !== …) return;` guard turns
   * cross-tier pairs into successful no-ops; fast-check explores
   * enough of the joint width × width space at 200 runs to surface
   * any per-width drift inside a tier.
   */
  it('same tier ⇒ deep-equal layout-tier outputs', () => {
    fc.assert(
      fc.property(arbWidth, arbWidth, (w1, w2) => {
        if (resolveBreakpoint(w1) !== resolveBreakpoint(w2)) return;
        expect(resolveLayoutTier(w1)).toStrictEqual(resolveLayoutTier(w2));
      }),
      { numRuns: 200 },
    );
  });
});
