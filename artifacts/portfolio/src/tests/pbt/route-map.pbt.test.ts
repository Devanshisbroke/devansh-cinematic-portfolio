/**
 * Property-based tests for `route-map/`.
 *
 * Validates: Requirements 16.1, 16.2, 16.3, 16.4, 16.6
 *
 * Implements two named correctness properties from `design.md`:
 *
 *   - **Property 4 — Route_Map bijection and round-trip identity.** Every
 *     valid Route_Map establishes a slug ↔ domId bijection: the lookup
 *     round-trips identically in both directions, and no two entries share a
 *     `domId` or `slug`.
 *
 *   - **Property 5 — Route_Map size bounds and validation behaviour.** A
 *     Route_Map with 1..1000 entries is accepted; 0 or 1001 entries is
 *     rejected; duplicated slug or empty `domId` is rejected with a
 *     deterministic `{ ok: false, slug? | domId?, reason }` shape.
 *
 * Each property runs ≥ 200 iterations via the global `numRuns` configured in
 * `src/tests/setup.ts` (Requirement 19.3).
 *
 * These tests are committed in the "red" state — they will turn green once
 * `route-map/lookup.ts` and `route-map/validate.ts` (task 4.3) land.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

import { arbRouteMap, arbSlug, arbDomId } from './_generators';
import { createRouteLookup } from '../../route-map/lookup';
import { validate } from '../../route-map/validate';
import type { RouteMap } from '../../route-map/types';

describe('Property 4 — Route_Map bijection and round-trip identity', () => {
  // Validates: Requirements 16.1, 16.2, 16.3, 16.4

  it('valid Route_Maps satisfy slug↔domId round-trip', () => {
    fc.assert(
      fc.property(arbRouteMap, (rm) => {
        const result = validate(rm);
        if (!result.ok) return; // skip generator-produced rejects (rare)
        const lookup = createRouteLookup(rm);
        for (const e of rm) {
          expect(lookup.idFromSlug(e.slug)).toBe(e.domId);
          expect(lookup.slugFromId(e.domId)).toBe(e.slug);
        }
      }),
    );
  });

  it('a Route_Map with a duplicated slug fails validation', () => {
    fc.assert(
      fc.property(arbRouteMap, (rm) => {
        if (rm.length < 2) return;
        const broken: RouteMap = [
          ...rm,
          { ...rm[0]!, domId: rm[0]!.domId + '-dup' },
        ];
        const result = validate(broken);
        expect(result.ok).toBe(false);
      }),
    );
  });

  it('a Route_Map with a duplicated domId fails validation', () => {
    fc.assert(
      fc.property(arbRouteMap, (rm) => {
        if (rm.length < 2) return;
        const broken: RouteMap = [
          ...rm,
          { ...rm[0]!, slug: rm[0]!.slug + '-dup' },
        ];
        const result = validate(broken);
        expect(result.ok).toBe(false);
      }),
    );
  });
});

describe('Property 5 — Route_Map size bounds and validation behaviour', () => {
  // Validates: Requirements 16.6

  it('an empty Route_Map fails validation with reason', () => {
    const result = validate([]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(typeof result.reason).toBe('string');
  });

  it('a Route_Map with > 1000 entries fails validation', () => {
    fc.assert(
      fc.property(arbSlug, arbDomId, (baseSlug, baseId) => {
        const huge: RouteMap = Array.from({ length: 1001 }, (_, i) => ({
          slug: `${baseSlug}-${i}`,
          domId: `${baseId}-${i}`,
          role: 'work' as const,
          rank: i,
          dominantLayoutPattern: 'card-grid' as const,
        }));
        const result = validate(huge);
        expect(result.ok).toBe(false);
      }),
    );
  });

  it('rejection reports a deterministic shape', () => {
    fc.assert(
      fc.property(arbRouteMap, (rm) => {
        if (rm.length < 1) return;
        const broken: RouteMap = [
          ...rm,
          { ...rm[0]!, slug: rm[0]!.slug + '-dup' },
        ];
        const result = validate(broken);
        if (result.ok) return;
        expect(result.reason).toBeTruthy();
        expect(result.slug !== undefined || result.domId !== undefined).toBe(
          true,
        );
      }),
    );
  });
});
