/**
 * Content_Registry — runtime validators.
 *
 * Implements the build-time integrity gate for the canonical
 * Content_Registry. Each record exported from
 * `src/content-registry/data.ts` is run through these validators at
 * module-top so any drift fails the build (R1.8, R1.9, R1.10, R15.9).
 *
 * Contract (the type-level shape lives in `./types.ts`):
 *   - `validateProject`   — per-record bounds for `Project_Record`.
 *     Enforces R15.1, R15.2, R15.3, R15.4, R15.5 and the stricter R1.5
 *     redesign-specific bounds where they conflict.
 *   - `validateIdentity`  — per-record bounds for `Identity_Profile`.
 *     Enforces R1.7, R15.7.
 *   - `validateContact`   — per-record bounds for `Contact_Channel`.
 *     Enforces R1.7.
 *   - `validateRegistry`  — cross-record invariants: project-id
 *     uniqueness (R15.6), runs every per-record validator, and
 *     enforces the copy-hygiene contract (R9.1, R9.2) using
 *     `BANNED_PHRASES` and `BASELINE_PROSE`.
 *
 * Every validator returns a tagged
 * {@link RegistryValidationResult}. The discriminated `ok` field
 * makes consumer narrowing exhaustive without runtime introspection.
 *
 * @see requirements.md §1, §9, §15
 * @see design.md — Component architecture → `content-registry/`
 */

import { isAbsoluteHttpsUrl } from '../lib/url';
import type {
  Contact_Channel,
  Identity_Profile,
  Project_Record,
  ProjectStatus,
  RegistryValidationResult,
} from './types';
import { BANNED_PHRASES } from './banned-phrases';
import { BASELINE_PROSE } from './baseline-prose';

// ---------------------------------------------------------------------------
// Local primitives
// ---------------------------------------------------------------------------

/** Lowercase alnum + hyphen, 1..64 chars. Shared by `id` and cross-ref id. */
const ID_RX = /^[a-z0-9-]{1,64}$/;

/**
 * Pragmatic RFC-5322-style email guard. Mirrors the shape produced
 * by `fc.emailAddress()` and the canonical fixture
 * (`devanshbarai.official@gmail.com`): non-empty local part, single
 * `@`, and a domain with at least one dot. The cap of ≤ 254 chars is
 * applied separately by the caller.
 */
const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const VALID_PROJECT_STATUSES: readonly ProjectStatus[] = [
  'in-development',
  'production',
  'shipped',
  'archived',
];

const VALID_PRIMARY_LINK_KINDS = [
  'live',
  'repository',
  'case-study',
  'demo',
  'paper',
] as const;

/** Build a `{ ok: false }` result with the canonical recordId/field/reason. */
function fail(
  recordId: string,
  field: string,
  reason: string,
): RegistryValidationResult {
  return { ok: false, recordId, field, reason };
}

/**
 * `s` is a string with `1 <= s.length <= max`. Length-based (not
 * trim-based) so the validator accepts every value emitted by the
 * generators in `tests/pbt/_generators.ts`, which are bounded by raw
 * length and may include incidental whitespace.
 */
function isBoundedString(s: unknown, max: number): s is string {
  return typeof s === 'string' && s.length >= 1 && s.length <= max;
}

/**
 * Lowercase + trim + collapse internal whitespace. Mirrors the
 * normalisation rule documented on `BASELINE_PROSE` so a verbatim
 * comparison is a single `===` check.
 */
function normaliseProse(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, ' ');
}

// ---------------------------------------------------------------------------
// validateProject
// ---------------------------------------------------------------------------

/**
 * Validates a single `Project_Record` against the R1.5 / R8.3 / R15
 * bounds. The fields are checked in declaration order so a single
 * fault is reported with the most specific `field` name.
 */
export function validateProject(p: Project_Record): RegistryValidationResult {
  // -- id ------------------------------------------------------------------
  // R15.2 / R15.6: id matches `/^[a-z0-9-]+$/`, 1..64 chars.
  const id = typeof p.id === 'string' ? p.id : '<malformed-id>';
  if (typeof p.id !== 'string' || !ID_RX.test(p.id)) {
    return fail(id, 'id', 'id must match /^[a-z0-9-]+$/ and be 1..64 chars');
  }

  // -- name ----------------------------------------------------------------
  // R1.5 / R15.1: 1..60 chars.
  if (!isBoundedString(p.name, 60)) {
    return fail(p.id, 'name', 'name must be 1..60 chars');
  }

  // -- tagline -------------------------------------------------------------
  // R1.5 / R15.1: 1..120 chars.
  if (!isBoundedString(p.tagline, 120)) {
    return fail(p.id, 'tagline', 'tagline must be 1..120 chars');
  }

  // -- summary -------------------------------------------------------------
  // R1.5 / R15.1: 1..600 chars.
  if (!isBoundedString(p.summary, 600)) {
    return fail(p.id, 'summary', 'summary must be 1..600 chars');
  }

  // -- problem -------------------------------------------------------------
  // R8.3: 1..600 chars.
  if (!isBoundedString(p.problem, 600)) {
    return fail(p.id, 'problem', 'problem must be 1..600 chars');
  }

  // -- role ----------------------------------------------------------------
  // R1.5 / R15.1: 1..80 chars.
  if (!isBoundedString(p.role, 80)) {
    return fail(p.id, 'role', 'role must be 1..80 chars');
  }

  // -- year ----------------------------------------------------------------
  // R1.5 / R15.4: integer in [2000, 2100], or ordered tuple thereof.
  if (typeof p.year === 'number') {
    if (!Number.isInteger(p.year) || p.year < 2000 || p.year > 2100) {
      return fail(p.id, 'year', 'year must be integer in [2000, 2100]');
    }
  } else if (Array.isArray(p.year) && p.year.length === 2) {
    const [y1, y2] = p.year as readonly [number, number];
    if (
      !Number.isInteger(y1) ||
      !Number.isInteger(y2) ||
      y1 < 2000 ||
      y2 > 2100 ||
      y1 > y2
    ) {
      return fail(
        p.id,
        'year',
        'year tuple must be ordered integers within [2000, 2100]',
      );
    }
  } else {
    return fail(p.id, 'year', 'year must be number or [number, number]');
  }

  // -- tags ----------------------------------------------------------------
  // R1.5 / R15.5: 1..8 unique entries, each 1..24 chars.
  if (!Array.isArray(p.tags) || p.tags.length < 1 || p.tags.length > 8) {
    return fail(p.id, 'tags', 'tags must be 1..8 entries');
  }
  const seenTags = new Set<string>();
  for (const tag of p.tags) {
    if (!isBoundedString(tag, 24)) {
      return fail(p.id, 'tags', 'each tag must be 1..24 chars');
    }
    if (seenTags.has(tag)) {
      return fail(p.id, 'tags', `duplicate tag "${tag}"`);
    }
    seenTags.add(tag);
  }

  // -- primaryLink ---------------------------------------------------------
  // R1.6 / R1.8 / R8.3 / R15.3.
  if (!p.primaryLink || typeof p.primaryLink !== 'object') {
    return fail(p.id, 'primaryLink', 'primaryLink missing');
  }
  if (!isBoundedString(p.primaryLink.label, 40)) {
    return fail(
      p.id,
      'primaryLink.label',
      'primaryLink.label must be 1..40 chars',
    );
  }
  if (
    !VALID_PRIMARY_LINK_KINDS.includes(
      p.primaryLink.kind as (typeof VALID_PRIMARY_LINK_KINDS)[number],
    )
  ) {
    return fail(
      p.id,
      'primaryLink.kind',
      `primaryLink.kind must be one of ${VALID_PRIMARY_LINK_KINDS.join('|')}`,
    );
  }
  if (!isAbsoluteHttpsUrl(p.primaryLink.url)) {
    return fail(
      p.id,
      'primaryLink.url',
      'primaryLink.url must be absolute https:// with non-empty host, ≤ 2048 chars',
    );
  }

  // -- status --------------------------------------------------------------
  if (!VALID_PROJECT_STATUSES.includes(p.status)) {
    return fail(
      p.id,
      'status',
      `status must be one of ${VALID_PROJECT_STATUSES.join('|')}`,
    );
  }

  // -- outcomes (optional in type; bounded when present) -------------------
  // R8.3 / R15.5: 0..6 entries, each 1..120 chars.
  if (p.outcomes !== undefined) {
    if (!Array.isArray(p.outcomes) || p.outcomes.length > 6) {
      return fail(p.id, 'outcomes', 'outcomes must be 0..6 entries');
    }
    for (const o of p.outcomes) {
      if (!isBoundedString(o, 120)) {
        return fail(p.id, 'outcomes', 'each outcome must be 1..120 chars');
      }
    }
  }

  // -- technologyOrientation (optional) -----------------------------------
  if (
    p.technologyOrientation !== undefined &&
    !isBoundedString(p.technologyOrientation, 120)
  ) {
    return fail(
      p.id,
      'technologyOrientation',
      'technologyOrientation must be 1..120 chars',
    );
  }

  // -- voice ---------------------------------------------------------------
  // R9.5 / R9.6: both sentences present, each 1..240 chars.
  if (!p.voice || typeof p.voice !== 'object') {
    return fail(p.id, 'voice', 'voice missing');
  }
  if (!isBoundedString(p.voice.firstPersonSentence, 240)) {
    return fail(
      p.id,
      'voice.firstPersonSentence',
      'voice.firstPersonSentence must be 1..240 chars',
    );
  }
  if (!isBoundedString(p.voice.convictionSentence, 240)) {
    return fail(
      p.id,
      'voice.convictionSentence',
      'voice.convictionSentence must be 1..240 chars',
    );
  }

  // -- claims (optional) --------------------------------------------------
  // R9.7 / R9.8: when present, each value 1..120 chars and source non-empty
  // up to 240 chars.
  if (p.claims !== undefined) {
    if (!Array.isArray(p.claims) || p.claims.length > 10) {
      return fail(p.id, 'claims', 'claims must be 0..10 entries');
    }
    for (const c of p.claims) {
      if (!isBoundedString(c.value, 120)) {
        return fail(p.id, 'claims.value', 'claims.value must be 1..120 chars');
      }
      if (!isBoundedString(c.source, 240)) {
        return fail(
          p.id,
          'claims.source',
          'claims.source must be 1..240 chars',
        );
      }
    }
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// validateIdentity
// ---------------------------------------------------------------------------

/**
 * Validates an `Identity_Profile` against the R1.7 / R15.7 bounds.
 * The pseudo-record-id `'<identity>'` is reported on failures so the
 * consumer can distinguish the identity record from a project.
 */
export function validateIdentity(
  profile: Identity_Profile,
): RegistryValidationResult {
  const recordId = '<identity>';

  if (!isBoundedString(profile.displayName, 200)) {
    return fail(recordId, 'displayName', 'displayName must be 1..200 chars');
  }
  if (!isBoundedString(profile.tagline, 200)) {
    return fail(recordId, 'tagline', 'tagline must be 1..200 chars');
  }

  // R1.2 / R1.3: at least two co-primary affiliations, every entry primary.
  if (
    !Array.isArray(profile.currentInstitutions) ||
    profile.currentInstitutions.length < 2
  ) {
    return fail(
      recordId,
      'currentInstitutions',
      'currentInstitutions must contain at least 2 co-primary affiliations',
    );
  }
  for (const inst of profile.currentInstitutions) {
    if (!inst || typeof inst !== 'object') {
      return fail(
        recordId,
        'currentInstitutions',
        'each affiliation must be an object',
      );
    }
    if (inst.role !== 'primary') {
      return fail(
        recordId,
        'currentInstitutions.role',
        'every affiliation must have role: "primary"',
      );
    }
    if (!isBoundedString(inst.institution, 120)) {
      return fail(
        recordId,
        'currentInstitutions.institution',
        'institution must be 1..120 chars',
      );
    }
    if (!isBoundedString(inst.program, 200)) {
      return fail(
        recordId,
        'currentInstitutions.program',
        'program must be 1..200 chars',
      );
    }
    if (!isBoundedString(inst.years, 32)) {
      return fail(
        recordId,
        'currentInstitutions.years',
        'years must be 1..32 chars',
      );
    }
  }

  // R1.7 / R15.7: email is non-empty, ≤ 254 chars, RFC-5322-style.
  if (
    typeof profile.email !== 'string' ||
    profile.email.length === 0 ||
    profile.email.length > 254 ||
    !EMAIL_RX.test(profile.email)
  ) {
    return fail(
      recordId,
      'email',
      'email must be RFC 5322-style and 1..254 chars',
    );
  }

  // R1.7 / R15.7: at least one social link; cap at 20.
  if (
    !Array.isArray(profile.socials) ||
    profile.socials.length < 1 ||
    profile.socials.length > 20
  ) {
    return fail(recordId, 'socials', 'socials must be 1..20 entries');
  }
  for (const s of profile.socials) {
    if (!s || typeof s !== 'object') {
      return fail(recordId, 'socials', 'each social must be an object');
    }
    if (!isBoundedString(s.label, 40)) {
      return fail(recordId, 'socials.label', 'socials.label must be 1..40 chars');
    }
    if (!isAbsoluteHttpsUrl(s.url)) {
      return fail(
        recordId,
        'socials.url',
        'socials.url must be absolute https:// with non-empty host, ≤ 2048 chars',
      );
    }
  }

  // R9.5 / R9.6: cross-references optional; when present, 1..20 entries.
  if (profile.crossReferences !== undefined) {
    if (
      !Array.isArray(profile.crossReferences) ||
      profile.crossReferences.length < 1 ||
      profile.crossReferences.length > 20
    ) {
      return fail(
        recordId,
        'crossReferences',
        'crossReferences must be 1..20 entries when present',
      );
    }
    for (const cr of profile.crossReferences) {
      if (!cr || typeof cr !== 'object') {
        return fail(
          recordId,
          'crossReferences',
          'each cross-reference must be an object',
        );
      }
      if (typeof cr.id !== 'string' || !ID_RX.test(cr.id)) {
        return fail(
          recordId,
          'crossReferences.id',
          `crossReferences.id "${String(cr.id)}" must match /^[a-z0-9-]+$/`,
        );
      }
      if (!isBoundedString(cr.body, 600)) {
        return fail(
          recordId,
          'crossReferences.body',
          'crossReferences.body must be 1..600 chars',
        );
      }
    }
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// validateContact
// ---------------------------------------------------------------------------

/**
 * Validates a `Contact_Channel` against R1.7. Mirrors the email +
 * socials checks from `validateIdentity` but uses `'<contact>'` as
 * the pseudo-record-id so failures from the Signal scene's standalone
 * record are distinguishable.
 */
export function validateContact(
  c: Contact_Channel,
): RegistryValidationResult {
  const recordId = '<contact>';

  if (
    typeof c.email !== 'string' ||
    c.email.length === 0 ||
    c.email.length > 254 ||
    !EMAIL_RX.test(c.email)
  ) {
    return fail(
      recordId,
      'email',
      'email must be RFC 5322-style and 1..254 chars',
    );
  }

  if (!Array.isArray(c.socials) || c.socials.length < 2 || c.socials.length > 20) {
    return fail(
      recordId,
      'socials',
      'socials must be 2..20 entries (canonical fixture requires LinkedIn + GitHub)',
    );
  }
  for (const s of c.socials) {
    if (!s || typeof s !== 'object') {
      return fail(recordId, 'socials', 'each social must be an object');
    }
    if (!isBoundedString(s.label, 40)) {
      return fail(recordId, 'socials.label', 'socials.label must be 1..40 chars');
    }
    if (!isAbsoluteHttpsUrl(s.url)) {
      return fail(
        recordId,
        'socials.url',
        'socials.url must be absolute https:// with non-empty host, ≤ 2048 chars',
      );
    }
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// validateRegistry
// ---------------------------------------------------------------------------

/**
 * Cross-record integrity gate. Runs every per-record validator,
 * enforces project-id uniqueness (R15.6), and applies the copy-hygiene
 * contract (R9.1, R9.2) across every prose string the renderer would
 * surface.
 *
 * Called from the top of `src/content-registry/data.ts` so any drift
 * fails the build (R1.8, R1.9, R1.10, R15.9).
 */
export function validateRegistry(input: {
  identity: Identity_Profile;
  projects: readonly Project_Record[];
  contact?: Contact_Channel;
}): RegistryValidationResult {
  const { identity, projects, contact } = input;

  const idResult = validateIdentity(identity);
  if (!idResult.ok) return idResult;

  if (contact) {
    const cResult = validateContact(contact);
    if (!cResult.ok) return cResult;
  }

  if (!Array.isArray(projects)) {
    return fail('<registry>', 'projects', 'projects must be an array');
  }

  const seenIds = new Set<string>();
  for (const p of projects) {
    const pResult = validateProject(p);
    if (!pResult.ok) return pResult;
    if (seenIds.has(p.id)) {
      return fail(p.id, 'id', 'duplicate project id across registry');
    }
    seenIds.add(p.id);
  }

  // -- Copy-hygiene gate (R9.1, R9.2) -------------------------------------
  // Build the universe of rendered prose strings, then check each for
  // banned phrases (case-insensitive substring) and baseline-verbatim
  // matches (after `normaliseProse`).
  const proseStrings: string[] = [];
  proseStrings.push(identity.displayName, identity.tagline);
  if (identity.crossReferences) {
    for (const cr of identity.crossReferences) proseStrings.push(cr.body);
  }
  for (const p of projects) {
    proseStrings.push(p.tagline, p.summary, p.problem, p.role);
    proseStrings.push(
      p.voice.firstPersonSentence,
      p.voice.convictionSentence,
    );
    if (p.outcomes) {
      for (const o of p.outcomes) proseStrings.push(o);
    }
    if (p.technologyOrientation) proseStrings.push(p.technologyOrientation);
  }

  for (const s of proseStrings) {
    const lower = s.toLowerCase();
    for (const phrase of BANNED_PHRASES) {
      if (lower.includes(phrase.toLowerCase())) {
        return fail(
          '<copy-hygiene>',
          'banned-phrase',
          `banned phrase "${phrase}" appears in rendered prose: ${s}`,
        );
      }
    }
    const norm = normaliseProse(s);
    for (const baseline of BASELINE_PROSE) {
      if (norm === baseline) {
        return fail(
          '<copy-hygiene>',
          'baseline-verbatim',
          `prose matches baseline verbatim after normalisation: ${s}`,
        );
      }
    }
  }

  return { ok: true };
}
