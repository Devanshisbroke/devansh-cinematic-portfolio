/**
 * Design-system token type contracts.
 *
 * This module is the *type-only* surface area of the design system. It
 * declares the named token identifier sets that every other module in the
 * app references when reading a concrete value from `tokens.ts`.
 *
 * Sourced from `design.md` § "Visual Identity" and the motion bucket
 * definitions in R5.1 / § "Motion System".
 *
 * Rules:
 *  - No runtime values. This file MUST stay pure types.
 *  - No import from `./tokens` (would cycle once tokens.ts imports these).
 *  - Each identifier set is exhaustive: `tokens.ts` populates a record over
 *    the union, and TS will fail the build if either side drifts.
 *  - Validates: Requirements 3.1, 3.2, 3.3, 3.4, 4.2, 4.3, 5.1
 */

// ---------------------------------------------------------------------------
// Color — primary palette and neutral ramp (R3.1)
// ---------------------------------------------------------------------------

/**
 * Primary palette identifiers. The five core hues (R3.1) plus the
 * derived `amber-deep` step used by the Last-Minute PDF reveal so the
 * registry stays inside the five-hue cap while still naming the warm-red
 * accent.
 */
export type Hue =
  | 'ink'
  | 'paper'
  | 'amber'
  | 'moss'
  | 'signal'
  | 'amber-deep';

/**
 * Neutral ramp steps. Eleven named steps, ≥ 9 required by R3.1, indexed
 * by their hue-tonal step number rather than ordinal so the names match
 * the `--neutral-{step}` CSS custom properties one-to-one.
 */
export type NeutralStep =
  | '0'
  | '50'
  | '100'
  | '200'
  | '300'
  | '400'
  | '500'
  | '600'
  | '700'
  | '800'
  | '900';

// ---------------------------------------------------------------------------
// Surfaces (R3.1, R3.2)
// ---------------------------------------------------------------------------

/**
 * Surface ramp tones. Five tones from the design's surface table: the
 * page background, two elevated layers, an accent context surface used
 * by project rooms, and a translucent overlay scrim. Both dark and
 * light themes resolve every tone.
 */
export type SurfaceTone =
  | 'base'
  | 'elevated-1'
  | 'elevated-2'
  | 'accent'
  | 'overlay';

// ---------------------------------------------------------------------------
// Spacing (R3.3)
// ---------------------------------------------------------------------------

/**
 * Spacing scale steps. Ten steps, ≥ 8 required by R3.3. Every margin,
 * padding, and gap value in the codebase MUST resolve to one of these
 * via `Stack` / `Inline` / token-driven CSS — no raw `px` or `rem`
 * leaks (enforced by the `no-raw-spacing` ESLint rule).
 */
export type SpacingStep =
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '10';

// ---------------------------------------------------------------------------
// Radius / Shadow / Border (R3.4) — ≥ 3 variants per category
// ---------------------------------------------------------------------------

/** Radius variants. */
export type RadiusVariant =
  | 'none'
  | 'sm'
  | 'md'
  | 'lg'
  | 'pill';

/** Shadow variants. `focus` is the AA-contrast focus ring composed in tokens. */
export type ShadowVariant =
  | 'low'
  | 'medium'
  | 'high'
  | 'cinema'
  | 'focus';

/** Border variants. */
export type BorderVariant =
  | 'hairline'
  | 'thin'
  | 'medium'
  | 'emphasis';

// ---------------------------------------------------------------------------
// Typography (R4.2, R4.3) — ≥ 6 named steps
// ---------------------------------------------------------------------------

/**
 * Type-scale step identifiers. Six named steps spanning display through
 * caption (R4.2). Every concrete step in `tokens.ts` carries a
 * `fontSize`, `lineHeight`, `letterSpacing`, and `fontWeight` (R4.3).
 */
export type TypeStep =
  | 'display'
  | 'headline'
  | 'title'
  | 'body'
  | 'small'
  | 'caption';

// ---------------------------------------------------------------------------
// Motion (R5.1)
// ---------------------------------------------------------------------------

/**
 * Easing curve identifiers. R5.1 requires ≥ 1 ease-out and ≥ 1
 * ease-in-out; this set ships four curves so motion variants can choose
 * between linear (data plots), soft-out (entrances), in-out-quiet
 * (reveals), and in-decisive (assertive transitions).
 *
 * These literals are also the canonical `easing` values consumed by
 * `MotionVariant` keyframes and by the PBT generators in
 * `tests/pbt/_generators.ts`.
 */
export type EaseToken =
  | 'linear'
  | 'ease-out-soft'
  | 'ease-in-out-quiet'
  | 'ease-in-decisive';

/**
 * Duration bucket identifiers (R5.1). Each bucket maps to a numeric
 * range in `tokens.ts`:
 *  - `instant` ≤ 80 ms
 *  - `short`   120–220 ms
 *  - `medium`  260–400 ms
 *  - `long`    500–900 ms
 */
export type DurationToken =
  | 'instant'
  | 'short'
  | 'medium'
  | 'long';

// ---------------------------------------------------------------------------
// Companion record-shape types
// ---------------------------------------------------------------------------
//
// Pure-type "table of contents" interfaces that `tokens.ts` will
// satisfy. Keeping these here means downstream modules can import the
// shapes without dragging in concrete runtime values, and TypeScript
// will refuse to compile `tokens.ts` if any key drifts.

/** Hex string in the form `#RRGGBB` or `#RRGGBBAA`. */
export type HexColor = `#${string}`;

/** Concrete hue → hex map. */
export type HuePalette = Readonly<Record<Hue, HexColor>>;

/** Concrete neutral step → hex map. */
export type NeutralPalette = Readonly<Record<NeutralStep, HexColor>>;

/**
 * One surface tone resolved per theme. Each tone carries both a dark
 * theme value (default) and a light theme value (R3.5 / R3.6). The
 * `overlay` tone may include alpha and is permitted to be 8-digit hex.
 */
export interface SurfaceValue {
  readonly dark: HexColor;
  readonly light: HexColor;
}

export type SurfacePalette = Readonly<Record<SurfaceTone, SurfaceValue>>;

/** Spacing step → pixel value map. */
export type SpacingScale = Readonly<Record<SpacingStep, number>>;

/** Radius variant → CSS length map. Use raw CSS strings (e.g. `'12px'`). */
export type RadiusScale = Readonly<Record<RadiusVariant, string>>;

/** Shadow variant → CSS box-shadow value map. */
export type ShadowScale = Readonly<Record<ShadowVariant, string>>;

/** Border variant → CSS border shorthand value map. */
export type BorderScale = Readonly<Record<BorderVariant, string>>;

/**
 * One concrete type-scale step. R4.3 requires every scale step to
 * define line-height, letter-spacing, and weight; R4.2 bounds
 * `fontSize` to the [10, 96] CSS-px window.
 */
export interface TypeStepValue {
  /** Font size in CSS px. R4.2: 10..96. */
  readonly fontSize: number;
  /** Unitless line height (e.g. 1.1, 1.5). */
  readonly lineHeight: number;
  /** Letter spacing in `em` (negative permitted, e.g. -0.02). */
  readonly letterSpacing: number;
  /** Font weight (100..900). */
  readonly fontWeight: number;
}

export type TypeScale = Readonly<Record<TypeStep, TypeStepValue>>;

/** Easing token → cubic-bezier or named keyword string map. */
export type EasingScale = Readonly<Record<EaseToken, string>>;

/**
 * One duration bucket as a closed millisecond range. The default value
 * is what most variants use; the range is preserved so the bucket can
 * be sanity-checked against R5.1's bounds.
 */
export interface DurationValue {
  /** Default ms value used by motion variants in this bucket. */
  readonly defaultMs: number;
  /** Inclusive minimum bucket bound (ms). */
  readonly minMs: number;
  /** Inclusive maximum bucket bound (ms). */
  readonly maxMs: number;
}

export type DurationScale = Readonly<Record<DurationToken, DurationValue>>;

/**
 * Font-family stack identifier set used by `tokens.ts` for the display,
 * body, and supporting (mono) families (R4.1).
 */
export type FontFamilyRole = 'display' | 'body' | 'mono';
export type FontFamilyStacks = Readonly<Record<FontFamilyRole, string>>;
