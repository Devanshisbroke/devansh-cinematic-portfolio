/**
 * Content_Registry — type definitions.
 *
 * This module is the typed contract for every record stored in
 * `src/content-registry/data.ts`. It is **pure types only**: no runtime
 * validation lives here. Field bounds are enforced by `validate.ts`
 * (created in a later task). The JSDoc on every field names the bound
 * the validator must check, so the validator author has a clear
 * contract.
 *
 * Bounds reference R1.5, R8.3, R15.1, R15.4, R15.5, R15.7 of
 * `requirements.md`. Where R1.5 (the stricter, redesign-specific
 * bound) and R15.x (the integrity envelope) disagree, R1.5 is the
 * tighter one that the validator MUST enforce.
 *
 * @see requirements.md §15 — Content Registry Integrity
 * @see design.md — Component architecture → `content-registry/`
 */

// ---------------------------------------------------------------------------
// Project status enum
// ---------------------------------------------------------------------------

/**
 * Lifecycle status of a Project_Record. The validator MUST reject any
 * value outside this union. (R15.1: `status` is one enum value;
 * `status` length ≤ 32 chars — every member here satisfies that.)
 */
export type ProjectStatus =
  | 'in-development'
  | 'production'
  | 'shipped'
  | 'archived';

// ---------------------------------------------------------------------------
// Project_Record substructures
// ---------------------------------------------------------------------------

/**
 * Kind of the single primary link surfaced by `Project_Record.primaryLink`.
 * The visible label of the link MUST name the destination type (R1.6).
 */
export type PrimaryLinkKind =
  | 'live'
  | 'repository'
  | 'case-study'
  | 'demo'
  | 'paper';

/**
 * The single primary link rendered for a project (R1.6, R8.3).
 *
 * @property label — Visible link label.
 *   Bound: 1–40 chars after trim (R1.6); MUST NOT equal `url` verbatim.
 * @property kind — Destination class; renders the trailing affordance
 *   and informs the validator's URL-pattern checks.
 * @property url — Absolute `https://` URL.
 *   Bound: ≤ 2048 chars, scheme exactly `https` (lowercase),
 *   non-empty host after trim (R1.8, R15.3).
 */
export interface PrimaryLink {
  readonly label: string;
  readonly kind: PrimaryLinkKind;
  readonly url: string;
}

/**
 * First-person voice block attached to every project (R9.5, R9.6).
 *
 * The validator MUST require both sentences to be non-empty after trim
 * and to be distinct from each other (R9.5: "at least one additional
 * sentence stating an underlying conviction or insight that is
 * distinct from any feature enumeration sentence").
 *
 * @property firstPersonSentence — One sentence written in first person.
 *   Bound: 1–240 chars after trim.
 * @property convictionSentence — One sentence stating the underlying
 *   conviction or insight.
 *   Bound: 1–240 chars after trim.
 */
export interface Voice {
  readonly firstPersonSentence: string;
  readonly convictionSentence: string;
}

/**
 * Structured quantitative claim with mandatory provenance (R9.7, R9.8).
 *
 * Any prose making a quantitative claim about users, growth, accuracy,
 * or scale MUST be stored as a `Claim` and MUST have a non-empty
 * `source`. The renderer MUST omit the claim entirely if `source` is
 * empty (R9.8) — but the type system guarantees `source` is present;
 * the validator enforces non-emptiness after trim.
 *
 * @property value — The claim text exactly as it should be rendered.
 *   Bound: 1–120 chars after trim.
 * @property source — Verifiable source (URL, citation, or named
 *   artifact). Bound: 1–240 chars after trim, non-empty.
 */
export interface Claim {
  readonly value: string;
  readonly source: string;
}

// ---------------------------------------------------------------------------
// Project_Record
// ---------------------------------------------------------------------------

/**
 * A single flagship project rendered by the Project_Showcase.
 *
 * Field bounds (validator contract, R1.5 + R8.3 + R15):
 *
 * @property id — Stable record identifier.
 *   Bound: 1–64 chars, regex `/^[a-z0-9-]+$/`, unique across registry.
 * @property name — Display name.
 *   Bound: 1–60 chars after trim (R1.5). R15.1 caps name at ≤ 120, but
 *   R1.5 is stricter and wins.
 * @property tagline — Single-line tagline.
 *   Bound: 1–120 chars after trim (R1.5). R15.1 caps at ≤ 200.
 * @property summary — Short prose summary.
 *   Bound: 1–600 chars after trim (R1.5). R15.1 caps at ≤ 2000.
 * @property problem — Problem-framing prose (R8.3).
 *   Bound: 1–600 chars after trim.
 * @property role — Owner's role on the project.
 *   Bound: 1–80 chars after trim (R1.5). R15.1 caps at ≤ 120.
 * @property year — Single year or inclusive year range.
 *   Bound: integer Y ∈ [2000, 2100] (R1.5 / R15.4); when a tuple
 *   `[Y1, Y2]`, both endpoints in [2000, 2100] and Y1 ≤ Y2.
 * @property tags — Topic tags.
 *   Bound: 1–8 unique entries (R1.5); each entry 1–24 chars after trim
 *   (R1.5). R15.5 allows up to 20 entries × 40 chars; R1.5 is stricter.
 * @property primaryLink — Exactly one primary user-activatable link
 *   (R8.3). See {@link PrimaryLink}.
 * @property status — Lifecycle status from {@link ProjectStatus}.
 * @property outcomes — Outcomes or differentiators (R8.3 requires at
 *   least one for projects rendered in the showcase). Optional in the
 *   type system; the registry validator enforces presence for any
 *   record with `status === 'shipped' | 'production'`.
 *   Bound (per entry): 1–120 chars after trim; max 6 entries.
 * @property technologyOrientation — Technology orientation label
 *   (R8.3 requires it for projects rendered in the showcase). Optional
 *   in the type system; the registry validator enforces presence.
 *   Bound: 1–120 chars after trim.
 * @property voice — First-person voice block (R9.5, R9.6).
 * @property claims — Optional structured quantitative claims (R9.7,
 *   R9.8). Bound: 0–10 entries.
 */
export interface Project_Record {
  readonly id: string;
  readonly name: string;
  readonly tagline: string;
  readonly summary: string;
  readonly problem: string;
  readonly role: string;
  readonly year: number | readonly [number, number];
  readonly tags: readonly string[];
  readonly primaryLink: PrimaryLink;
  readonly status: ProjectStatus;
  readonly outcomes?: readonly string[];
  readonly technologyOrientation?: string;
  readonly voice: Voice;
  readonly claims?: readonly Claim[];
}

// ---------------------------------------------------------------------------
// Identity_Profile substructures
// ---------------------------------------------------------------------------

/**
 * Co-primary academic affiliation. Every entry in
 * `Identity_Profile.currentInstitutions` MUST use `role: 'primary'`,
 * which makes the "two co-primary, equal-weight" contract from R1.2
 * type-checkable: there is no way to express a "secondary"
 * affiliation in the type system.
 *
 * Field bounds (validator contract):
 *
 * @property institution — School name (e.g., "IIT Madras").
 *   Bound: 1–120 chars after trim.
 * @property program — Degree program (e.g., "BS in Data Science and
 *   Applications"). Bound: 1–200 chars after trim.
 * @property years — Years string (e.g., "2024–2028").
 *   Bound: 1–32 chars after trim.
 * @property role — Always the literal `'primary'`. Encodes equal
 *   typographic weight at the type level (R1.2, R1.3).
 */
export interface InstitutionAffiliation {
  readonly institution: string;
  readonly program: string;
  readonly years: string;
  readonly role: 'primary';
}

/**
 * A single professional or social link surfaced from the
 * Identity_Profile (R1.7, R15.7).
 *
 * @property label — Human-readable label (e.g., "LinkedIn", "GitHub").
 *   Bound: 1–40 chars after trim.
 * @property url — Absolute `https://` URL.
 *   Bound: ≤ 2048 chars, scheme exactly `https`, non-empty host
 *   after trim (R1.7, R15.7).
 */
export interface SocialLink {
  readonly label: string;
  readonly url: string;
}

/**
 * Free-form first-person paragraph attached to the Identity_Profile —
 * used by the Twin Compass scene to render a brief description for
 * each institution and any cross-affiliation prose (R9.5, R9.6).
 *
 * @property id — Stable identifier so callers can pair a reference
 *   with the right institution. Bound: 1–64 chars, `/^[a-z0-9-]+$/`.
 * @property body — Prose body. Bound: 1–600 chars after trim.
 */
export interface CrossReference {
  readonly id: string;
  readonly body: string;
}

// ---------------------------------------------------------------------------
// Identity_Profile
// ---------------------------------------------------------------------------

/**
 * Canonical identity record (R1.1, R1.2, R1.7, R15.7).
 *
 * Field bounds (validator contract):
 *
 * @property displayName — Owner's full name as a single string.
 *   Bound: 1–200 chars after trim (R15.7); MUST equal exactly
 *   `"Devansh Barai"` (enforced by the registry validator against the
 *   canonical fixture, not by this type).
 * @property tagline — Single-line role/positioning statement (R1.1,
 *   R2.3). Bound: 1–200 chars after trim.
 * @property currentInstitutions — Two co-primary academic
 *   affiliations of equal standing (R1.2, R1.3). Length ≥ 2 is the
 *   redesign contract; the validator MUST reject length < 2.
 *   Every entry has `role: 'primary'` by construction.
 * @property crossReferences — Optional first-person prose paragraphs
 *   used by the Twin Compass scene (R9.5, R9.6). Bound: 1–20 entries
 *   when present (R15.7).
 * @property email — Owner's contact email.
 *   Bound: ≤ 254 chars, RFC 5322-style address (R1.7, R15.7).
 * @property socials — Verified professional social links.
 *   Bound: 1–20 entries (R15.7); each `url` is an absolute
 *   `https://` URL ≤ 2048 chars with non-empty host. R1.7 further
 *   requires at least 2 entries (LinkedIn + GitHub) for the canonical
 *   fixture.
 */
export interface Identity_Profile {
  readonly displayName: string;
  readonly tagline: string;
  readonly currentInstitutions: readonly InstitutionAffiliation[];
  readonly crossReferences?: readonly CrossReference[];
  readonly email: string;
  readonly socials: readonly SocialLink[];
}

// ---------------------------------------------------------------------------
// Contact_Channel
// ---------------------------------------------------------------------------

/**
 * The contact channel surfaced by the Signal scene (R1.7, R1.10).
 *
 * Mirrors the email + socials shape of Identity_Profile so the
 * Signal scene and the build-time `validateContact` step have a
 * focused, standalone record to operate on.
 *
 * @property email — Mailto target.
 *   Bound: ≤ 254 chars, RFC 5322-style; MUST equal exactly
 *   `"devanshbarai.official@gmail.com"` for the canonical fixture
 *   (R1.7).
 * @property socials — Verified professional social links.
 *   Bound: ≥ 2 entries for the canonical fixture (R1.7); each `url`
 *   is an absolute `https://` URL ≤ 2048 chars with non-empty host.
 */
export interface Contact_Channel {
  readonly email: string;
  readonly socials: readonly SocialLink[];
}

// ---------------------------------------------------------------------------
// Validation result
// ---------------------------------------------------------------------------

/**
 * Tagged result of any registry validation step (R1.8, R1.9, R1.10,
 * R15.9). The shape is deliberately discriminated on `ok` so the
 * caller's narrowing is exhaustive without runtime introspection.
 *
 * On failure, `recordId` identifies the offending record (project id,
 * `'identity'` for the Identity_Profile, `'contact'` for the
 * Contact_Channel, or `'<malformed-id>'` when the failing field is the
 * id itself), `field` names the specific field that failed, and
 * `reason` is a stable, human-readable explanation. The build SHALL
 * abort on any failure (R1.9, R15.9).
 */
export type RegistryValidationResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly recordId: string;
      readonly field: string;
      readonly reason: string;
    };
