/**
 * Content_Registry — property-based tests.
 *
 * Three properties from `design.md` § "Properties to verify":
 *
 *   1. Project_Record field bounds and value invariants.
 *   2. Project_Record JSON round-trip structural equality.
 *   3. Identity_Profile field bounds and contact validity.
 *
 * Each property runs ≥ 200 iterations (the global `numRuns` is set
 * by `src/tests/setup.ts` via `fc.configureGlobal`; an explicit
 * `{ numRuns: 200 }` is passed defensively in case this test is
 * executed before that setup file resolves).
 *
 * NOTE — TDD red state:
 *   The validators imported below live in
 *   `src/content-registry/validate.ts`, which is created in task 3.6.
 *   This file is committed in red state and turns green once 3.6
 *   lands. That is intentional. Do **not** add a stub here to make
 *   the imports resolve early — the failing import is the contract
 *   that 3.6 must satisfy.
 *
 * The canonical-fixture pass (importing from
 * `src/content-registry/data.ts`) belongs to task 3.7 and is
 * therefore deliberately absent here. This file's contract is
 * "validators behave correctly on generated inputs", which does not
 * depend on the fixture.
 *
 * `validateRegistry` is exported by task 3.6 alongside
 * `validateProject` / `validateIdentity` but is not imported here:
 * it is exercised by the 3.7 fixture test and by `data.ts`'s
 * module-top invocation, neither of which is in scope for this file.
 *
 * Validates: Requirements 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

import { arbProjectRecord, arbIdentityProfile } from './_generators';
import {
  validateProject,
  validateIdentity,
} from '../../content-registry/validate';
import type {
  Project_Record,
  Identity_Profile,
} from '../../content-registry/types';

// ---------------------------------------------------------------------------
// Property 1 — Project_Record field bounds and value invariants
// ---------------------------------------------------------------------------

/**
 * Validates: Requirements 15.1, 15.2, 15.3, 15.4, 15.5
 *
 * Sub-property 1a: every value emitted by `arbProjectRecord` is
 * shaped to satisfy the R15.1–R15.5 bounds, so `validateProject`
 * MUST accept it.
 *
 * Sub-property 1b: when a known-bad mutation is applied (the
 * `name` field is replaced by an empty string, which violates the
 * R1.5 / R15.1 "1..60 chars after trim" bound), the validator MUST
 * reject the record AND report the offending record id and field
 * with a non-empty reason. The discriminated-union shape of
 * `RegistryValidationResult` is exhaustively narrowed via the
 * `result.ok === false` guard.
 */
describe('Property 1 — Project_Record field bounds and value invariants', () => {
  it('valid Project_Records pass validateProject', () => {
    fc.assert(
      fc.property(arbProjectRecord, (record) => {
        const result = validateProject(record);
        expect(result.ok).toBe(true);
      }),
      { numRuns: 200 },
    );
  });

  it('invalid records report offending field with deterministic shape', () => {
    fc.assert(
      fc.property(arbProjectRecord, (record) => {
        const broken: Project_Record = { ...record, name: '' };
        const result = validateProject(broken);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.recordId).toBe(record.id);
          expect(result.field).toBe('name');
          expect(typeof result.reason).toBe('string');
          expect(result.reason.length).toBeGreaterThan(0);
        }
      }),
      { numRuns: 200 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 2 — Project_Record JSON round-trip structural equality
// ---------------------------------------------------------------------------

/**
 * Validates: Requirements 15.6
 *
 * Pure-data records SHALL survive a JSON serialise/parse round-trip
 * without information loss. This guards against accidental
 * introduction of non-JSON-safe values (functions, `undefined`
 * fields that should be omitted, `Date` instances, `Symbol`s) into
 * `Project_Record`. The arbitrary deliberately emits only
 * JSON-clean shapes, so any future regression that adds a
 * non-JSON-safe field will surface here.
 */
describe('Property 2 — Project_Record JSON round-trip structural equality', () => {
  it('JSON serialise → parse preserves structural equality', () => {
    fc.assert(
      fc.property(arbProjectRecord, (record) => {
        const serialised = JSON.stringify(record);
        const restored = JSON.parse(serialised) as Project_Record;
        expect(restored).toEqual(record);
      }),
      { numRuns: 200 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 3 — Identity_Profile field bounds and contact validity
// ---------------------------------------------------------------------------

/**
 * Validates: Requirements 15.7
 *
 * Sub-property 3a: every value emitted by `arbIdentityProfile`
 * satisfies the R1.7 / R15.7 bounds (non-empty trimmed strings,
 * RFC 5322-style email via `fc.emailAddress`, absolute `https://`
 * social URLs via `fc.webUrl({ validSchemes: ['https'] })`), so
 * `validateIdentity` MUST accept it.
 *
 * Sub-property 3b: replacing the first social link's URL with an
 * `http://` scheme breaks the R1.7 / R15.7 absolute-https contract,
 * so the validator MUST reject. `arbIdentityProfile` guarantees
 * `socials.length >= 2`, so indexing `socials[0]` is always safe.
 */
describe('Property 3 — Identity_Profile field bounds and contact validity', () => {
  it('valid Identity_Profiles pass validateIdentity', () => {
    fc.assert(
      fc.property(arbIdentityProfile, (profile) => {
        const result = validateIdentity(profile);
        expect(result.ok).toBe(true);
      }),
      { numRuns: 200 },
    );
  });

  it('a non-https socials URL fails validation', () => {
    fc.assert(
      fc.property(arbIdentityProfile, (profile) => {
        const broken: Identity_Profile = {
          ...profile,
          socials: profile.socials.map((s, i) =>
            i === 0 ? { ...s, url: 'http://insecure.example' } : s,
          ),
        };
        const result = validateIdentity(broken);
        expect(result.ok).toBe(false);
      }),
      { numRuns: 200 },
    );
  });
});
