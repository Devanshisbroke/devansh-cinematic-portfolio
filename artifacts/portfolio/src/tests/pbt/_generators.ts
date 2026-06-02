/**
 * Property-based testing generators (`fast-check` arbitraries).
 *
 * One canonical home for every PBT arbitrary that mirrors a typed
 * data model in the Portfolio_Site. Each generator is annotated with
 * the requirement(s) it underpins; the property tests in
 * `src/tests/pbt/*.pbt.test.ts` consume only what is exported here so
 * the bound between "generator" and "property" stays surgical.
 *
 * Validates: Requirements 15.1, 16.1, 17.1, 18.1
 *
 * Sourced verbatim from `design.md` § "Generators" with two
 * additions (`arbIdentityProfile`, `arbContactChannel`) that the
 * design's Testing-plan section names as required arbitraries but
 * does not spell out inline. Their shapes are derived strictly from
 * the type contracts in `src/content-registry/types.ts`.
 *
 * Rules:
 *  - This file MUST stay test-only. No production module is allowed
 *    to import from it (enforced by Property 14 — Module-graph
 *    cleanliness).
 *  - Every generator's output MUST satisfy the corresponding TS
 *    type when assigned to a typed variable; the explicit
 *    `: fc.Arbitrary<T>` annotations below are the type-safety
 *    backstop.
 *  - Optional fields use `fc.option(arb, { nil: undefined })` so the
 *    generated value is `undefined` rather than `null`.
 */

import * as fc from 'fast-check';

import type {
  Contact_Channel,
  CrossReference,
  Identity_Profile,
  InstitutionAffiliation,
  Project_Record,
  SocialLink,
} from '../../content-registry/types';
import type { RouteEntry, RouteMap } from '../../route-map/types';
import type {
  MotionKeyframe,
  MotionVariant,
} from '../../motion/variant-types';

// ---------------------------------------------------------------------------
// Width — Properties 6, 7 (R17.1)
// ---------------------------------------------------------------------------

/** Width generator for Property 6, 7. R17.1 explicitly bounds [320, 3840]. */
export const arbWidth: fc.Arbitrary<number> = fc.integer({
  min: 320,
  max: 3840,
});

/** Wider width for stress: covers below-min and above-max. */
export const arbWideWidth: fc.Arbitrary<number> = fc.integer({
  min: 0,
  max: 7680,
});

// ---------------------------------------------------------------------------
// Slug / DOM id — R6.6 / R16
// ---------------------------------------------------------------------------

/** Slug generator: R6.6 / R16 — lowercase a-z 0-9 -, 1..64. */
export const arbSlug: fc.Arbitrary<string> = fc
  .stringMatching(/^[a-z0-9-]{1,64}$/)
  .filter((s) => s.length >= 1);

/** DOM id generator: R16 — `^[a-zA-Z][a-zA-Z0-9_-]{0,127}$`. */
export const arbDomId: fc.Arbitrary<string> = fc.stringMatching(
  /^[a-zA-Z][a-zA-Z0-9_-]{0,127}$/,
);

// ---------------------------------------------------------------------------
// RouteMap — Property 4 / Property 5 (R6.1, R6.2, R6.6, R16.1)
// ---------------------------------------------------------------------------

/**
 * RouteMap generator. Slugs are unique by selector; domIds are
 * deduplicated by post-filter. Ranks are reassigned to match each
 * entry's index so the generator output already satisfies the
 * `rank === index` contract enforced by `route-map/validate.ts`.
 */
export const arbRouteMap: fc.Arbitrary<RouteMap> = fc
  .uniqueArray(
    fc.record({
      slug: arbSlug,
      domId: arbDomId,
      role: fc.constantFrom(
        'opening',
        'identity',
        'work',
        'philosophy',
        'contact',
      ),
      dominantLayoutPattern: fc.constantFrom(
        'centered-hero',
        'full-bleed-media',
        'split-two-column',
        'card-grid',
        'vertical-list',
        'asymmetric-editorial',
        'immersive-canvas',
      ),
    }),
    { minLength: 1, maxLength: 1000, selector: (e) => e.slug },
  )
  .map((entries): readonly RouteEntry[] =>
    entries.map((e, rank) => ({ ...e, rank }) as RouteEntry),
  )
  .filter((rm) => new Set(rm.map((e) => e.domId)).size === rm.length);

// ---------------------------------------------------------------------------
// Year — R15.4
// ---------------------------------------------------------------------------

/**
 * Year generator for R15.4. Either a single integer in
 * [2000, currentYear+1] or an inclusive ordered tuple of two such
 * integers (`[Y1, Y2]` with `Y1 <= Y2`).
 */
export const arbYearValue: fc.Arbitrary<number | readonly [number, number]> =
  fc.oneof(
    fc.integer({ min: 2000, max: new Date().getFullYear() + 1 }),
    fc
      .tuple(
        fc.integer({ min: 2000, max: new Date().getFullYear() + 1 }),
        fc.integer({ min: 2000, max: new Date().getFullYear() + 1 }),
      )
      .map(
        ([a, b]) =>
          [Math.min(a, b), Math.max(a, b)] as readonly [number, number],
      ),
  );

// ---------------------------------------------------------------------------
// Project_Record — Property 1, Property 2 (R15.1)
// ---------------------------------------------------------------------------

/**
 * Project_Record generator. Field bounds mirror the type contract in
 * `src/content-registry/types.ts`. `outcomes` and `technologyOrientation`
 * are emitted as required values (not `undefined`) so that the
 * downstream registry validator's R8.3 presence check is exercised
 * against well-formed inputs; tests that need to probe their absence
 * can `.map` over the generator and delete the fields.
 */
export const arbProjectRecord: fc.Arbitrary<Project_Record> = fc.record({
  id: fc.stringMatching(/^[a-z0-9-]{1,64}$/),
  name: fc
    .string({ minLength: 1, maxLength: 60 })
    .filter((s) => s.trim().length >= 1),
  tagline: fc.string({ minLength: 1, maxLength: 120 }),
  summary: fc.string({ minLength: 1, maxLength: 600 }),
  problem: fc.string({ minLength: 1, maxLength: 600 }),
  role: fc.string({ minLength: 1, maxLength: 80 }),
  outcomes: fc.array(fc.string({ minLength: 1, maxLength: 120 }), {
    minLength: 1,
    maxLength: 6,
  }),
  technologyOrientation: fc.string({ minLength: 1, maxLength: 120 }),
  year: arbYearValue,
  tags: fc.uniqueArray(fc.string({ minLength: 1, maxLength: 24 }), {
    minLength: 1,
    maxLength: 8,
  }),
  primaryLink: fc.record({
    label: fc.string({ minLength: 1, maxLength: 40 }),
    kind: fc.constantFrom(
      'live',
      'repository',
      'case-study',
      'demo',
      'paper',
    ),
    url: fc.webUrl({ validSchemes: ['https'] }),
  }),
  status: fc.constantFrom(
    'in-development',
    'production',
    'shipped',
    'archived',
  ),
  voice: fc.record({
    firstPersonSentence: fc.string({ minLength: 1, maxLength: 240 }),
    convictionSentence: fc.string({ minLength: 1, maxLength: 240 }),
  }),
});

// ---------------------------------------------------------------------------
// Identity_Profile / Contact_Channel — Property 3 (R1.7, R15.7)
// ---------------------------------------------------------------------------

/** A single InstitutionAffiliation, always `role: 'primary'` (R1.2). */
const arbInstitutionAffiliation: fc.Arbitrary<InstitutionAffiliation> =
  fc.record({
    institution: fc.string({ minLength: 1, maxLength: 120 }),
    program: fc.string({ minLength: 1, maxLength: 200 }),
    years: fc.string({ minLength: 1, maxLength: 32 }),
    role: fc.constant('primary' as const),
  });

/** A single CrossReference paragraph (R9.5, R9.6). */
const arbCrossReference: fc.Arbitrary<CrossReference> = fc.record({
  id: fc.stringMatching(/^[a-z0-9-]{1,64}$/),
  body: fc.string({ minLength: 1, maxLength: 600 }),
});

/** A single SocialLink with absolute https URL (R1.7, R15.7). */
const arbSocialLink: fc.Arbitrary<SocialLink> = fc.record({
  label: fc.string({ minLength: 1, maxLength: 40 }),
  url: fc.webUrl({ validSchemes: ['https'] }),
});

/**
 * Identity_Profile generator. Mirrors the shape in
 * `src/content-registry/types.ts`: `currentInstitutions` length 2..4
 * (R1.2 minimum of two co-primary affiliations), `socials` length
 * 2..6 (R1.7 minimum of LinkedIn + GitHub), and `crossReferences`
 * optional with `nil: undefined` so the type's `?` modifier is
 * faithfully represented.
 */
export const arbIdentityProfile: fc.Arbitrary<Identity_Profile> = fc.record({
  displayName: fc.string({ minLength: 1, maxLength: 200 }),
  tagline: fc.string({ minLength: 1, maxLength: 200 }),
  currentInstitutions: fc.array(arbInstitutionAffiliation, {
    minLength: 2,
    maxLength: 4,
  }),
  crossReferences: fc.option(
    fc.array(arbCrossReference, { minLength: 1, maxLength: 20 }),
    { nil: undefined },
  ),
  email: fc.emailAddress(),
  socials: fc.array(arbSocialLink, { minLength: 2, maxLength: 6 }),
});

/**
 * Contact_Channel generator. Smaller wrapper over email + socials,
 * sharing the same per-element bounds as Identity_Profile so the
 * Signal scene's standalone validator receives consistently shaped
 * inputs.
 */
export const arbContactChannel: fc.Arbitrary<Contact_Channel> = fc.record({
  email: fc.emailAddress(),
  socials: fc.array(arbSocialLink, { minLength: 2, maxLength: 6 }),
});

// ---------------------------------------------------------------------------
// MotionVariant — Property 8 (R18.1)
// ---------------------------------------------------------------------------

/**
 * Single keyframe generator. Optional channels use
 * `fc.option(..., { nil: undefined })` so omitted fields are
 * `undefined` rather than `null`, matching the TS contract.
 */
export const arbKeyframe: fc.Arbitrary<MotionKeyframe> = fc.record({
  transform: fc.record({
    translateX: fc.option(fc.integer({ min: -2000, max: 2000 }), {
      nil: undefined,
    }),
    translateY: fc.option(fc.integer({ min: -2000, max: 2000 }), {
      nil: undefined,
    }),
    scale: fc.option(fc.float({ min: 0.5, max: 3, noNaN: true }), {
      nil: undefined,
    }),
    rotate: fc.option(fc.integer({ min: -360, max: 360 }), {
      nil: undefined,
    }),
    scrollLinked: fc.option(fc.boolean(), { nil: undefined }),
  }),
  opacity: fc.option(fc.float({ min: 0, max: 1, noNaN: true }), {
    nil: undefined,
  }),
  color: fc.option(fc.string(), { nil: undefined }),
  durationMs: fc.integer({ min: 0, max: 5000 }),
  delayMs: fc.option(fc.integer({ min: 0, max: 5000 }), { nil: undefined }),
  easing: fc.constantFrom(
    'linear',
    'ease-out-soft',
    'ease-in-out-quiet',
    'ease-in-decisive',
  ),
});

/** MotionVariant generator. R18.1 — id matches `/^[a-z0-9-]+$/`. */
export const arbMotionVariant: fc.Arbitrary<MotionVariant> = fc.record({
  id: fc.stringMatching(/^[a-z0-9-]+$/),
  keyframes: fc.array(arbKeyframe, { minLength: 1, maxLength: 8 }),
});
