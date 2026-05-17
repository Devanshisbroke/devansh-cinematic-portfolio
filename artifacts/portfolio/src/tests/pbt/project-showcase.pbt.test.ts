/**
 * Project_Showcase — property-based tests.
 *
 * One property from `design.md` § "Properties to verify":
 *
 *   9. Project_Showcase reveal layer count and total duration
 *      (Requirements 8.1, 8.2).
 *
 * Sub-properties:
 *
 *   9a. For every `spec` in the canonical `revealSpecs`,
 *       `spec.layers.length >= 3` AND `spec.totalDurationMs <= 3000`
 *       (R8.2).
 *   9b. For every pair `(specs[i], specs[j])` with `i !== j`, the two
 *       specs differ on `visualPalette`, `layoutPattern`, AND
 *       `motionSequenceSignature` concurrently (R8.1).
 *   9c. The pairwise-distinctness validator catches violations on
 *       arbitrary 4-tuples of `RevealSpec` candidates — forcing two
 *       tuples to share any of the three dimensions causes the
 *       validator to return `false` (200 runs).
 *   9d. A 4-tuple constructed with all-different palettes /
 *       layouts / signatures passes the validator, confirming the
 *       validator is not over-restrictive (200 runs).
 *
 * Each fast-check property runs ≥ 200 iterations (the global
 * `numRuns` is set in `src/tests/setup.ts` via `fc.configureGlobal`;
 * an explicit `{ numRuns: 200 }` is passed defensively).
 *
 * Validates: Requirements 8.1, 8.2
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

import {
  revealSpecs,
  type RevealLayer,
  type RevealLayoutPattern,
  type RevealSpec,
  type VisualPalette,
} from '../../scenes/Work/reveal-specs';

// ---------------------------------------------------------------------------
// Generators (test-local — not added to `_generators.ts` because no other
// property consumes them).
// ---------------------------------------------------------------------------

const PALETTES: readonly VisualPalette[] = [
  'ink',
  'duotone-moss',
  'ember-graphite',
  'sunken-typographic',
];

const LAYOUT_PATTERNS: readonly RevealLayoutPattern[] = [
  'centered-singular',
  'split-asymmetric',
  'full-bleed-canvas',
  'full-width-banded-typographic',
];

const arbLayer: fc.Arbitrary<RevealLayer> = fc.record({
  kind: fc.constantFrom('typography', 'visual-artifact', 'motion'),
  variantId: fc.stringMatching(/^[a-z0-9-]{1,32}$/),
  description: fc.string({ minLength: 1, maxLength: 200 }),
});

const arbSpec: fc.Arbitrary<RevealSpec> = fc.record({
  projectId: fc.stringMatching(/^[a-z0-9-]{1,32}$/),
  visualPalette: fc.constantFrom(...PALETTES),
  layoutPattern: fc.constantFrom(...LAYOUT_PATTERNS),
  layers: fc.array(arbLayer, { minLength: 1, maxLength: 8 }),
  totalDurationMs: fc.integer({ min: 0, max: 5000 }),
  motionSequenceSignature: fc.string({ minLength: 1, maxLength: 80 }),
});

// ---------------------------------------------------------------------------
// Helpers under test (the validators that Property 9 asserts against).
// ---------------------------------------------------------------------------

/** R8.2 — layer count ≥ 3 AND total duration ≤ 3000 ms. */
function isWithinRevealBudget(spec: RevealSpec): boolean {
  return spec.layers.length >= 3 && spec.totalDurationMs <= 3000;
}

/**
 * R8.1 — every pair of specs MUST differ on `visualPalette`,
 * `layoutPattern`, AND `motionSequenceSignature` concurrently. A
 * shared value on any one dimension is a violation.
 */
function pairwiseDistinct(specs: readonly RevealSpec[]): boolean {
  for (let i = 0; i < specs.length; i++) {
    for (let j = i + 1; j < specs.length; j++) {
      const a = specs[i]!;
      const b = specs[j]!;
      if (a.visualPalette === b.visualPalette) return false;
      if (a.layoutPattern === b.layoutPattern) return false;
      if (a.motionSequenceSignature === b.motionSequenceSignature) return false;
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// Property 9 — Project_Showcase reveal layer count and total duration
// ---------------------------------------------------------------------------

describe('Property 9 — Project_Showcase reveal layer count and total duration', () => {
  // -------------------------------------------------------------------------
  // 9a — canonical revealSpecs satisfy the layer + duration budget (R8.2)
  // -------------------------------------------------------------------------
  it('every canonical revealSpec has ≥ 3 layers and totalDurationMs ≤ 3000', () => {
    expect(revealSpecs.length).toBe(4);
    for (const spec of revealSpecs) {
      expect(
        spec.layers.length,
        `${spec.projectId} has only ${spec.layers.length} layers`,
      ).toBeGreaterThanOrEqual(3);
      expect(
        spec.totalDurationMs,
        `${spec.projectId} totalDurationMs ${spec.totalDurationMs} > 3000`,
      ).toBeLessThanOrEqual(3000);
    }
  });

  // -------------------------------------------------------------------------
  // 9b — canonical revealSpecs are pairwise-distinct on all three dimensions
  // concurrently (R8.1)
  // -------------------------------------------------------------------------
  it('the four canonical revealSpecs are pairwise-distinct on visualPalette, layoutPattern, and motionSequenceSignature', () => {
    expect(pairwiseDistinct(revealSpecs)).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 9c — the budget validator agrees with arbitrary spec inputs (200 runs).
  //
  // This is a tautological cross-check that guards against future drift in
  // `isWithinRevealBudget`'s implementation: any change that diverges from
  // the literal "≥ 3 layers AND ≤ 3000 ms" contract will surface as a
  // mismatch against the inlined formula.
  // -------------------------------------------------------------------------
  it('the layer-count + duration validator matches the literal R8.2 formula', () => {
    fc.assert(
      fc.property(arbSpec, (spec) => {
        const validatorSays = isWithinRevealBudget(spec);
        const literalSays = spec.layers.length >= 3 && spec.totalDurationMs <= 3000;
        return validatorSays === literalSays;
      }),
      { numRuns: 200 },
    );
  });

  // -------------------------------------------------------------------------
  // 9c — pairwise-distinctness validator catches violations across arbitrary
  // 4-tuples (200 runs). The test forces ONE shared dimension at a time and
  // asserts the validator returns `false`.
  // -------------------------------------------------------------------------
  it('pairwiseDistinct returns false when any single dimension is shared (visualPalette)', () => {
    fc.assert(
      fc.property(
        fc.tuple(arbSpec, arbSpec, arbSpec, arbSpec),
        ([s0, s1, s2, s3]) => {
          // Force s1 to share visualPalette with s0; the other two stay free.
          const broken: readonly RevealSpec[] = [
            s0,
            { ...s1, visualPalette: s0.visualPalette },
            s2,
            s3,
          ];
          return pairwiseDistinct(broken) === false;
        },
      ),
      { numRuns: 200 },
    );
  });

  it('pairwiseDistinct returns false when any single dimension is shared (layoutPattern)', () => {
    fc.assert(
      fc.property(
        fc.tuple(arbSpec, arbSpec, arbSpec, arbSpec),
        ([s0, s1, s2, s3]) => {
          const broken: readonly RevealSpec[] = [
            s0,
            s1,
            { ...s2, layoutPattern: s0.layoutPattern },
            s3,
          ];
          return pairwiseDistinct(broken) === false;
        },
      ),
      { numRuns: 200 },
    );
  });

  it('pairwiseDistinct returns false when any single dimension is shared (motionSequenceSignature)', () => {
    fc.assert(
      fc.property(
        fc.tuple(arbSpec, arbSpec, arbSpec, arbSpec),
        ([s0, s1, s2, s3]) => {
          const broken: readonly RevealSpec[] = [
            s0,
            s1,
            s2,
            { ...s3, motionSequenceSignature: s0.motionSequenceSignature },
          ];
          return pairwiseDistinct(broken) === false;
        },
      ),
      { numRuns: 200 },
    );
  });

  // -------------------------------------------------------------------------
  // 9d — a 4-tuple constructed with all-different palettes / layouts /
  // signatures passes the validator. This guards against the validator
  // being trivially `false`.
  // -------------------------------------------------------------------------
  it('a 4-tuple drawn with all-different palettes/patterns/signatures passes pairwise distinctness', () => {
    fc.assert(
      fc.property(
        fc.tuple(arbSpec, arbSpec, arbSpec, arbSpec),
        ([s0, s1, s2, s3]) => {
          // Force the four dimensions distinct by assigning index-aligned
          // palette / pattern / signature; the rest of each spec stays
          // arbitrary so the test exercises ≥ 200 distinct shapes.
          const aligned: readonly RevealSpec[] = [s0, s1, s2, s3].map(
            (s, i) => ({
              ...s,
              visualPalette: PALETTES[i]!,
              layoutPattern: LAYOUT_PATTERNS[i]!,
              motionSequenceSignature: `sig-${i}-${s.motionSequenceSignature}`,
            }),
          );
          return pairwiseDistinct(aligned);
        },
      ),
      { numRuns: 200 },
    );
  });
});
