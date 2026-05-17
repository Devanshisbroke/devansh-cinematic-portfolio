/**
 * Default text-on-surface token-pair contrast — property-based tests.
 *
 * Property 10 from `design.md` § "Properties to verify":
 *
 *   10. For every default text-on-surface token pair registered in
 *       `design-system/contrast-pairs.ts`, the WCAG 2.1 contrast ratio
 *       is ≥ 4.5:1 for normal text and ≥ 3:1 for large text and
 *       meaningful non-text affordances.
 *
 * The test is split into two `it` blocks:
 *
 *   1. Deterministic sweep — iterate every entry in
 *      `defaultContrastPairs` and assert the registered pair clears
 *      its WCAG threshold. This is the canonical assertion: any
 *      regression in `tokens.ts` or in the registry itself fails this
 *      block immediately with the offending pair id and ratio.
 *   2. fast-check property — sample the registry with
 *      `fc.constantFrom(...defaultContrastPairs)` over 200 runs. The
 *      property holds vacuously today (the set is finite and small)
 *      but it future-proofs the registry: anyone adding a new pair
 *      that falls below threshold trips this property as well, and
 *      fast-check shrinks straight to the offending entry.
 *
 * The 200-run global default is set by `src/tests/setup.ts`; an
 * explicit `{ numRuns: 200 }` is passed defensively in case this
 * test executes before that setup file resolves.
 *
 * Standard reference: W3C "Web Content Accessibility Guidelines (WCAG)
 * 2.1" — Success Criteria 1.4.3 (Contrast — Minimum, normal text
 * 4.5:1, large text 3:1) and 1.4.11 (Non-text Contrast, 3:1 for UI
 * components such as focus indicators).
 *
 * Validates: Requirements 3.9, 13.11
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

import {
  defaultContrastPairs,
  wcagContrast,
  type ContrastPair,
} from '../../design-system/contrast-pairs';

// ---------------------------------------------------------------------------
// Threshold lookup — single source of truth shared by both `it` blocks.
// ---------------------------------------------------------------------------

/**
 * The minimum WCAG 2.1 contrast ratio a pair must clear, keyed by the
 * pair's `size` discriminator. Normal text demands SC 1.4.3's 4.5:1
 * floor; large text and non-text affordances (focus rings, headline
 * accents) ride the 3.0:1 floor of SC 1.4.3 / SC 1.4.11.
 */
const MIN_RATIO: Record<ContrastPair['size'], number> = {
  normal: 4.5,
  large: 3.0,
};

// ---------------------------------------------------------------------------
// Property 10 — Default text-on-surface token-pair contrast ≥ AA
// ---------------------------------------------------------------------------

describe('Property 10 — Default text-on-surface token-pair contrast ≥ AA', () => {
  // Validates: Requirements 3.9, 13.11

  /**
   * Validates: Requirements 3.9, 13.11
   *
   * Deterministic registry sweep. For every entry in
   * `defaultContrastPairs`, the WCAG 2.1 contrast ratio between
   * `foreground` and `background` MUST clear the threshold dictated
   * by `size` (4.5:1 for normal, 3.0:1 for large / non-text).
   *
   * The assertion message embeds the pair id, the computed ratio
   * (formatted to two decimal places), and the threshold so a
   * regression in `tokens.ts` surfaces with full context in CI logs.
   */
  it('every entry in defaultContrastPairs clears its WCAG threshold', () => {
    expect(defaultContrastPairs.length).toBeGreaterThan(0);
    for (const pair of defaultContrastPairs) {
      const ratio = wcagContrast(pair.foreground, pair.background);
      const minimum = MIN_RATIO[pair.size];
      expect(
        ratio,
        `pair "${pair.id}" computed ${ratio.toFixed(
          2,
        )}:1 — below the ${minimum.toFixed(1)}:1 ${pair.size}-text floor (fg=${
          pair.foreground
        }, bg=${pair.background})`,
      ).toBeGreaterThanOrEqual(minimum);
    }
  });

  /**
   * Validates: Requirements 3.9, 13.11
   *
   * fast-check property guard. `fc.constantFrom(...defaultContrastPairs)`
   * uniformly samples the registry; over 200 runs every entry is
   * exercised many times. The property is identical in shape to the
   * deterministic sweep, but its purpose is forward-looking: if a
   * future commit appends a pair that fails its threshold, this
   * property fails and shrinks immediately to that entry — exactly
   * the failure mode Property 10 is meant to guard against.
   */
  it('property: any sampled pair clears its threshold (200 runs)', () => {
    fc.assert(
      fc.property(fc.constantFrom(...defaultContrastPairs), (pair) => {
        const ratio = wcagContrast(pair.foreground, pair.background);
        const minimum = MIN_RATIO[pair.size];
        // Returning a boolean lets fast-check's shrinker minimise
        // straight to the offending pair on failure; the explicit
        // `expect` above already provides a richly-annotated message
        // for the deterministic sweep, so this block stays terse.
        return ratio >= minimum;
      }),
      { numRuns: 200 },
    );
  });
});
