/**
 * Design-system tokens — the single source of truth for every concrete
 * design value referenced by the Portfolio_Site.
 *
 * Sourced verbatim from `design.md` § "Visual Identity" (palette, neutral
 * ramp, surface ramp, spacing, radius, shadow, border tables) and the
 * motion / typography specifications in R4 / R5.
 *
 * Every named export carries an explicit `satisfies` clause against the
 * matching contract in `./tokens.types.ts`, so TypeScript fails the build
 * if either the runtime values or the type contracts drift.
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 5.1
 */

import type {
  BorderScale,
  DurationScale,
  EasingScale,
  FontFamilyStacks,
  HuePalette,
  NeutralPalette,
  RadiusScale,
  ShadowScale,
  SpacingScale,
  SurfacePalette,
  TypeScale,
} from './tokens.types';

// ---------------------------------------------------------------------------
// Color — primary palette (R3.1)
// ---------------------------------------------------------------------------

/**
 * Five-hue palette plus the derived `amber-deep` accent used by the
 * Last-Minute PDF reveal so the registry stays inside the five-core-hue
 * cap (R3.1) while still naming the warm-red accent.
 */
export const huePalette = {
  ink: '#000000',
  paper: '#F4F1EA',
  amber: '#FFB347',
  moss: '#8EB58A',
  signal: '#6FD4FF',
  'amber-deep': '#D9621F',
} as const satisfies HuePalette;

// ---------------------------------------------------------------------------
// Color — neutral ramp (R3.1, 11 named steps ≥ 9 required)
// ---------------------------------------------------------------------------

export const neutralPalette = {
  '0': '#FFFFFF',
  '50': '#FFFFFF',
  '100': '#FAFAFA',
  '200': '#E0DDD3',
  '300': '#C8C5BC',
  '400': '#9C988C',
  '500': '#7A766B',
  '600': '#3F3D36',
  '700': '#1F1E1A',
  '800': '#0A0A0A',
  '900': '#000000',
} as const satisfies NeutralPalette;

// ---------------------------------------------------------------------------
// Surface ramp (R3.1, R3.2 — 5 tones, dark + light per tone)
// ---------------------------------------------------------------------------

/**
 * Each surface tone resolves to both a dark-theme value (default) and a
 * light-theme value, per the Visual Identity surface table. The
 * `overlay` tone uses 8-digit hex with the trailing `CC` alpha byte for
 * a translucent scrim.
 */
export const surfacePalette = {
  base: { dark: '#000000', light: '#F4F1EA' },
  'elevated-1': { dark: '#060606', light: '#FFFFFF' },
  'elevated-2': { dark: '#0E0E0E', light: '#FBF9F4' },
  accent: { dark: '#1A0F00', light: '#FFF6E1' },
  overlay: { dark: '#000000CC', light: '#F4F1EACC' },
} as const satisfies SurfacePalette;

// ---------------------------------------------------------------------------
// Spacing scale (R3.3 — 10 named steps ≥ 8 required)
// ---------------------------------------------------------------------------

/** Step → CSS-pixel value. Every margin / padding / gap resolves here. */
export const spacingScale = {
  '1': 4,
  '2': 8,
  '3': 12,
  '4': 16,
  '5': 24,
  '6': 32,
  '7': 48,
  '8': 64,
  '9': 96,
  '10': 128,
} as const satisfies SpacingScale;

// ---------------------------------------------------------------------------
// Radius scale (R3.4 — 5 variants ≥ 3 required)
// ---------------------------------------------------------------------------

export const radiusScale = {
  none: '0',
  sm: '4px',
  md: '12px',
  lg: '24px',
  pill: '9999px',
} as const satisfies RadiusScale;

// ---------------------------------------------------------------------------
// Shadow scale (R3.4 — 5 variants ≥ 3 required)
// ---------------------------------------------------------------------------

/**
 * The `focus` token composes a 2-px inner halo against `--surface-base`
 * with a 2-px outer ring of `--hue-amber`, giving ≥ 3:1 non-text
 * contrast on every supported surface (R13.6, R7.1).
 */
export const shadowScale = {
  low: '0 1px 2px rgba(0, 0, 0, 0.18)',
  medium: '0 6px 18px rgba(0, 0, 0, 0.22)',
  high: '0 18px 48px rgba(0, 0, 0, 0.28)',
  cinema: '0 48px 120px rgba(0, 0, 0, 0.45)',
  focus: '0 0 0 2px var(--surface-base), 0 0 0 4px var(--hue-amber)',
} as const satisfies ShadowScale;

// ---------------------------------------------------------------------------
// Border scale (R3.4 — 4 variants ≥ 3 required)
// ---------------------------------------------------------------------------

export const borderScale = {
  hairline: '0.5px solid var(--neutral-300)',
  thin: '1px solid var(--neutral-400)',
  medium: '2px solid var(--hue-amber)',
  emphasis: '3px solid currentColor',
} as const satisfies BorderScale;

// ---------------------------------------------------------------------------
// Typography scale (R4.2, R4.3, R4.5 — 6 named steps)
// ---------------------------------------------------------------------------

/**
 * Six-step type scale spanning display through caption.
 *
 * For every step whose computed font size > 48 CSS px, R4.5 requires
 * `letterSpacing ≤ -0.02em` and `lineHeight ≤ 1.1`. The `display` and
 * `headline` steps satisfy that bound by construction; this is restated
 * here so future drift is caught by reviewers as well as by the
 * `Text` primitive's runtime guard.
 */
export const typeScale = {
  display: {
    fontSize: 96,
    lineHeight: 1.05,
    letterSpacing: -0.03,
    fontWeight: 600,
  },
  headline: {
    fontSize: 64,
    lineHeight: 1.08,
    letterSpacing: -0.025,
    fontWeight: 600,
  },
  title: {
    fontSize: 36,
    lineHeight: 1.2,
    letterSpacing: -0.01,
    fontWeight: 500,
  },
  body: {
    fontSize: 16,
    lineHeight: 1.6,
    letterSpacing: 0,
    fontWeight: 400,
  },
  small: {
    fontSize: 14,
    lineHeight: 1.5,
    letterSpacing: 0,
    fontWeight: 400,
  },
  caption: {
    fontSize: 12,
    lineHeight: 1.4,
    letterSpacing: 0.02,
    fontWeight: 500,
  },
} as const satisfies TypeScale;

// ---------------------------------------------------------------------------
// Font-family stacks (R4.1 — exactly one display, one body, one supporting)
// ---------------------------------------------------------------------------

export const fontFamilyStacks = {
  display: '"Fraunces", "Iowan Old Style", "Georgia", serif',
  body: '"Inter", "Helvetica Neue", system-ui, sans-serif',
  mono: '"JetBrains Mono", "SFMono-Regular", ui-monospace, monospace',
} as const satisfies FontFamilyStacks;

// ---------------------------------------------------------------------------
// Motion — easing curves (R5.1)
// ---------------------------------------------------------------------------

/**
 * Four named easing curves: a linear baseline (used by data-driven
 * timelines such as the SupportDeskOps reward plot), a soft ease-out
 * for entrances, an in-out-quiet for reveal sequences, and an
 * in-decisive overshoot curve for assertive transitions.
 *
 * Values match the `@theme` mapping documented in design.md.
 */
export const easingScale = {
  linear: 'linear',
  'ease-out-soft': 'cubic-bezier(0.16, 1, 0.3, 1)',
  'ease-in-out-quiet': 'cubic-bezier(0.6, -0.05, 0.01, 0.99)',
  'ease-in-decisive': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
} as const satisfies EasingScale;

// ---------------------------------------------------------------------------
// Motion — duration buckets (R5.1)
// ---------------------------------------------------------------------------

/**
 * Four named duration buckets with default + inclusive min/max bounds:
 *  - `instant` ≤ 80 ms (focus rings, press feedback)
 *  - `short`   120–220 ms (micro-interactions, magnetic CTA settle)
 *  - `medium`  260–400 ms (hover depth, tactile responses)
 *  - `long`    500–900 ms (scene reveals, parallax envelopes)
 *
 * Reduced_Motion_Mode collapses any bucket's effective duration to
 * ≤ 120 ms via `applyReducedMotion` (R5.7, R18.2).
 */
export const durationScale = {
  instant: { defaultMs: 60, minMs: 0, maxMs: 80 },
  short: { defaultMs: 180, minMs: 120, maxMs: 220 },
  medium: { defaultMs: 320, minMs: 260, maxMs: 400 },
  long: { defaultMs: 720, minMs: 500, maxMs: 900 },
} as const satisfies DurationScale;

// ---------------------------------------------------------------------------
// Color helpers — pure functions consumed by the contrast-pair registry
// ---------------------------------------------------------------------------

/** RGB triple in the 0..255 integer space. */
export interface RgbColor {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

/** HSL triple: hue 0..360, saturation 0..100, lightness 0..100. */
export interface HslColor {
  readonly h: number;
  readonly s: number;
  readonly l: number;
}

/**
 * Parse a hex color string into its RGB components.
 *
 * Accepts 3-digit (`#abc`), 6-digit (`#aabbcc`), and 8-digit
 * (`#aabbccdd`) hex; the alpha byte, if present, is ignored. Throws
 * `TypeError` on malformed input so calling code (validators, the
 * contrast-pair registry) fails loudly during build rather than
 * silently producing NaN downstream.
 *
 * Pure function — no I/O, no globals.
 */
export function hexToRgb(hex: string): RgbColor {
  if (typeof hex !== 'string') {
    throw new TypeError(`hexToRgb: expected string, received ${typeof hex}`);
  }
  const trimmed = hex.trim().replace(/^#/, '');
  let normalised: string;
  if (trimmed.length === 3) {
    normalised = trimmed
      .split('')
      .map((c) => c + c)
      .join('');
  } else if (trimmed.length === 6 || trimmed.length === 8) {
    normalised = trimmed.slice(0, 6);
  } else {
    throw new TypeError(`hexToRgb: invalid hex color "${hex}"`);
  }
  if (!/^[0-9a-fA-F]{6}$/.test(normalised)) {
    throw new TypeError(`hexToRgb: invalid hex color "${hex}"`);
  }
  const r = parseInt(normalised.slice(0, 2), 16);
  const g = parseInt(normalised.slice(2, 4), 16);
  const b = parseInt(normalised.slice(4, 6), 16);
  return { r, g, b };
}

/**
 * Convert a hex color to HSL. Hue is rounded to the nearest integer
 * degree; saturation and lightness are rounded to the nearest integer
 * percentage. The output matches the canonical HSL values published in
 * the design's palette table within ±1 unit per channel (rounding
 * variance only).
 *
 * Used by the contrast-pair registry to derive pair metadata and by
 * the `theme.css` generator to mirror palette tokens as HSL CSS
 * variables. Pure function.
 */
export function hexToHsl(hex: string): HslColor {
  const { r, g, b } = hexToRgb(hex);
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (delta !== 0) {
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    if (max === rn) {
      h = (gn - bn) / delta + (gn < bn ? 6 : 0);
    } else if (max === gn) {
      h = (bn - rn) / delta + 2;
    } else {
      h = (rn - gn) / delta + 4;
    }
    h *= 60;
  }
  return {
    h: Math.round(h),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}
