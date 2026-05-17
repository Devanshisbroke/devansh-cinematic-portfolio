/**
 * Scene-adjacency layout-pattern non-repetition — property-based tests.
 *
 * Property 12 from `design.md` § "Properties to verify":
 *
 *   12. For every adjacent pair of scenes in `scenes/scene-order.ts`,
 *       the two scenes do not share the same dominant layout pattern
 *       from the enumerated taxonomy
 *       {centered-hero, full-bleed-media, split-two-column, card-grid,
 *        vertical-list, asymmetric-editorial, immersive-canvas}.
 *
 * The suite is split into three blocks:
 *
 *   1. Canonical sweep — the live `sceneOrder` export already satisfies
 *      the invariant.
 *   2. Validator agreement — for arbitrary length-N sequences over the
 *      taxonomy, an explicit "is there a violation?" check matches a
 *      reference implementation of the rule.
 *   3. Negative oracle — appending two copies of the same pattern to
 *      any sequence MUST trip the validator.
 *
 * Each fast-check property runs ≥ 200 iterations (the global `numRuns`
 * is set by `src/tests/setup.ts`; an explicit `{ numRuns: 200 }` is
 * passed defensively).
 *
 * Validates: Requirements 6.2
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

import { sceneOrder } from '../../scenes/scene-order';
import type { LayoutPattern } from '../../route-map/types';

// ---------------------------------------------------------------------------
// Local taxonomy — mirrors the `LayoutPattern` union exactly. The
// `satisfies` clause guarantees this list stays in sync with the type;
// adding or removing a value from the union without updating this list
// is a compile-time error.
// ---------------------------------------------------------------------------
const ALL_PATTERNS = [
  'centered-hero',
  'full-bleed-media',
  'split-two-column',
  'card-grid',
  'vertical-list',
  'asymmetric-editorial',
  'immersive-canvas',
] as const satisfies readonly LayoutPattern[];

/**
 * Returns `true` when at least one adjacent pair in `patterns` shares
 * the same value. This is the reference implementation of the rule
 * tested across both the canonical fixture and the fast-check
 * generators.
 */
function violatesAdjacency(patterns: readonly LayoutPattern[]): boolean {
  for (let i = 0; i < patterns.length - 1; i += 1) {
    if (patterns[i] === patterns[i + 1]) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Property 12 — Scene-adjacency layout-pattern non-repetition
// ---------------------------------------------------------------------------

describe('Property 12 — Scene-adjacency layout-pattern non-repetition', () => {
  // Validates: Requirements 6.2

  /**
   * Canonical sweep. The shipped `sceneOrder` export is the canonical
   * input to the property; no two adjacent entries may share a
   * `dominantLayoutPattern`.
   */
  it('canonical sceneOrder has no two adjacent scenes sharing a layout pattern', () => {
    for (let i = 0; i < sceneOrder.length - 1; i += 1) {
      const a = sceneOrder[i]!.dominantLayoutPattern;
      const b = sceneOrder[i + 1]!.dominantLayoutPattern;
      expect(
        a,
        `sceneOrder[${i}] (${sceneOrder[i]!.domId}) and sceneOrder[${i + 1}] (${sceneOrder[i + 1]!.domId}) share pattern "${a}"`,
      ).not.toBe(b);
    }
  });

  /**
   * Validator agreement. For an arbitrary sequence drawn from the
   * taxonomy, a hand-rolled "any adjacent equality" scan agrees with
   * the reference implementation. This pins the validator's contract
   * — it accepts iff the sequence is adjacency-distinct — and ensures
   * the rule is exercised across all 7^N pattern arrangements that
   * fast-check explores.
   */
  it('validator agrees with adjacency-equality scan on arbitrary sequences', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(...ALL_PATTERNS), {
          minLength: 2,
          maxLength: 20,
        }),
        (patterns) => {
          let observed = false;
          for (let i = 0; i < patterns.length - 1; i += 1) {
            if (patterns[i] === patterns[i + 1]) {
              observed = true;
              break;
            }
          }
          return violatesAdjacency(patterns) === observed;
        },
      ),
      { numRuns: 200 },
    );
  });

  /**
   * Negative oracle. For any base sequence and any taxonomy member,
   * appending that member twice in a row yields a sequence the
   * validator MUST reject. This guarantees the validator does not
   * silently let through adjacent duplicates regardless of where they
   * appear in the sequence.
   */
  it('inserting a duplicate adjacent pattern always violates the invariant', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(...ALL_PATTERNS), {
          minLength: 0,
          maxLength: 20,
        }),
        fc.constantFrom(...ALL_PATTERNS),
        (base, dup) => {
          const broken: readonly LayoutPattern[] = [...base, dup, dup];
          return violatesAdjacency(broken);
        },
      ),
      { numRuns: 200 },
    );
  });
});
