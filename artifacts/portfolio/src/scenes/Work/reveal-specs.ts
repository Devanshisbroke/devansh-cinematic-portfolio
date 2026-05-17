/**
 * Project_Showcase reveal specifications — the four canonical reveals.
 *
 * The `Reveal data model` section of `design.md` proposes
 * `src/project-showcase/reveal-spec.ts`; this implementation colocates
 * the spec with the scenes that consume it (`src/scenes/Work/`) and
 * defines the `RevealSpec` / `RevealLayer` types inline so the file is
 * the sole authority for the contract. The motion variants themselves
 * are registered inside each project's reveal component
 * (`reveals/*.tsx`, tasks 11.5–11.8); this module carries only the
 * structural metadata that Property 9 asserts against.
 *
 * Validates: Requirements 8.1, 8.2 (Property 9)
 *
 * Per-reveal data is sourced verbatim from `design.md` § "Project_Showcase
 * reveals" tables. The distinctness signatures in `motionSequenceSignature`
 * mirror the "Pairwise dimension distinctness" table.
 */

// ---------------------------------------------------------------------------
// Type contracts
// ---------------------------------------------------------------------------

/**
 * Visual-treatment palette identifiers. Each project owns exactly one
 * palette; the four values are pairwise-disjoint by design (R8.1).
 */
export type VisualPalette =
  | 'ink'
  | 'duotone-moss'
  | 'ember-graphite'
  | 'sunken-typographic';

/**
 * Layout-pattern identifiers, drawn from the design's per-reveal layout
 * structure column. Each project owns exactly one pattern; the four
 * values are pairwise-disjoint (R8.1).
 */
export type RevealLayoutPattern =
  | 'centered-singular'
  | 'split-asymmetric'
  | 'full-bleed-canvas'
  | 'full-width-banded-typographic';

/**
 * One animatable layer inside a reveal sequence. The design names three
 * layer kinds (`typography`, `visual-artifact`, `motion`); each project
 * combines them per the per-reveal motion sequence in `design.md`.
 *
 * `variantId` is the registry key used by `motion-create.registerVariant`
 * inside each reveal component. This file carries only the identifier;
 * the concrete `MotionVariant` keyframes live next to the rendering
 * code so they can use React + framer-motion idioms without dragging
 * those imports into this pure-data module.
 */
export interface RevealLayer {
  readonly kind: 'typography' | 'visual-artifact' | 'motion';
  readonly variantId: string;
  /** Brief human-readable description for documentation / debugging. */
  readonly description: string;
}

/**
 * The full specification for one project's reveal.
 *
 * `totalDurationMs` is `max((delayMs ?? 0) + durationMs)` across the
 * reveal's last-finishing layer, capped at 3000 ms by R8.2. The cap is
 * asserted at module-load time below.
 *
 * `motionSequenceSignature` is a stable string identifier for the
 * choreography of this reveal (e.g. `"path-draw + headline-rise + …"`).
 * It exists so the pairwise-distinctness assertion can prove all four
 * reveals differ on motion sequence concurrently with palette and
 * layout (R8.1).
 */
export interface RevealSpec {
  readonly projectId: string;
  readonly visualPalette: VisualPalette;
  readonly layoutPattern: RevealLayoutPattern;
  readonly layers: readonly RevealLayer[];
  readonly totalDurationMs: number;
  readonly motionSequenceSignature: string;
}

// ---------------------------------------------------------------------------
// Canonical reveal specs (R8.1, R8.2)
// ---------------------------------------------------------------------------

/**
 * The four canonical reveal specs, in the same order as the
 * Content_Registry projects list (R8.5, R8.6). Each `projectId` matches
 * the `Project_Record.id` slug in `content-registry/data.ts` so
 * downstream renderers (`ProjectReveal.tsx`, task 11.4) can dispatch
 * directly off `projectId`.
 *
 * Per-reveal layer counts and total durations come from `design.md`
 * § "Project_Showcase reveals":
 *
 *   GlobeID            — 4 layers, 1800 ms (path-draw + headline + tagline + CTA)
 *   Khetech            — 4 layers, 1500 ms (clip-mask + duotone + word-stagger + numerals)
 *   SupportDeskOps-v6  — 4 layers, 2600 ms (stroke-draw + group-rise + counter-tick + flash)
 *   Last-Minute PDF    — 4 layers, 2100 ms (scale-in + fill + line-fade + CTA-translate)
 */
export const revealSpecs: readonly RevealSpec[] = [
  {
    projectId: 'globeid',
    visualPalette: 'ink',
    layoutPattern: 'centered-singular',
    layers: [
      {
        kind: 'visual-artifact',
        variantId: 'globeid-glyph-draw',
        description:
          'Thin-line vector globe glyph drawn via SVG pathLength 0→1 over 1200 ms with ease-out-soft.',
      },
      {
        kind: 'typography',
        variantId: 'globeid-headline-rise',
        description:
          'Headline fades + slides translateY 12 → 0 over 600 ms starting at +400 ms.',
      },
      {
        kind: 'typography',
        variantId: 'globeid-tagline-cross-fade',
        description:
          'Tagline cross-fades opacity 0 → 0.7 over 400 ms starting at +800 ms.',
      },
      {
        kind: 'motion',
        variantId: 'globeid-cta-stage-in',
        description:
          'Magnetic CTA stages in via opacity 0 → 1 over 400 ms starting at +1400 ms.',
      },
    ],
    totalDurationMs: 1800,
    motionSequenceSignature:
      'path-draw + headline-rise + tagline-fade + cta-stage',
  },
  {
    projectId: 'khetech',
    visualPalette: 'duotone-moss',
    layoutPattern: 'split-asymmetric',
    layers: [
      {
        kind: 'visual-artifact',
        variantId: 'khetech-aperture-wipe',
        description:
          'Aperture clip-path wipes inset(100% 0 0 0) → inset(0) over 900 ms with ease-in-out-quiet.',
      },
      {
        kind: 'visual-artifact',
        variantId: 'khetech-duotone-fade',
        description:
          'Image desaturates from grayscale to moss duotone over 600 ms starting at +600 ms.',
      },
      {
        kind: 'typography',
        variantId: 'khetech-prose-stagger',
        description:
          'Right-column prose stack staggers in word-by-word over 1100 ms starting at +400 ms.',
      },
      {
        kind: 'motion',
        variantId: 'khetech-numerals-slide',
        description:
          'Outcome numerals slide translateY 24 → 0 over 500 ms starting at +1100 ms.',
      },
    ],
    totalDurationMs: 1500,
    motionSequenceSignature:
      'clip-mask + duotone-filter + word-stagger + numeral-slide',
  },
  {
    projectId: 'supportdeskops-v6',
    visualPalette: 'ember-graphite',
    layoutPattern: 'full-bleed-canvas',
    layers: [
      {
        kind: 'visual-artifact',
        variantId: 'supportdeskops-curve-draw',
        description:
          'Reward curve draws left-to-right via cumulative stroke-dashoffset over 1600 ms (linear).',
      },
      {
        kind: 'typography',
        variantId: 'supportdeskops-headline-rise',
        description:
          'Bottom-left headline + summary group rises translateY 32 → 0 opacity 0 → 1 over 600 ms starting at +200 ms.',
      },
      {
        kind: 'motion',
        variantId: 'supportdeskops-counter-tick',
        description:
          'Bottom-right outcome counters tick up via useMotionValue interpolation over 1400 ms starting at +600 ms.',
      },
      {
        kind: 'motion',
        variantId: 'supportdeskops-accent-flash',
        description:
          'Ember accent flash on final tick over 200 ms at +2400 ms.',
      },
    ],
    totalDurationMs: 2600,
    motionSequenceSignature:
      'stroke-dashoffset + group-rise + counter-tick + accent-flash',
  },
  {
    projectId: 'last-minute-pdf',
    visualPalette: 'sunken-typographic',
    layoutPattern: 'full-width-banded-typographic',
    layers: [
      {
        kind: 'typography',
        variantId: 'lmpdf-cipher-scale-in',
        description:
          'Outlined "PDF" cipher glyphs scale-in 0.92 → 1.0 with opacity 0 → 1 over 700 ms with ease-out-soft.',
      },
      {
        kind: 'visual-artifact',
        variantId: 'lmpdf-glyph-fill',
        description:
          'One cipher glyph fills via fill-opacity 0 → 1 starting at +800 ms over 400 ms.',
      },
      {
        kind: 'typography',
        variantId: 'lmpdf-summary-fade',
        description:
          'Bottom-band summary fades in line-by-line over 900 ms starting at +1000 ms.',
      },
      {
        kind: 'motion',
        variantId: 'lmpdf-cta-slide',
        description:
          'Primary link slides translateX 24 → 0 over 400 ms starting at +1700 ms.',
      },
    ],
    totalDurationMs: 2100,
    motionSequenceSignature:
      'scale-in + glyph-fill + line-by-line-fade + cta-translate',
  },
] as const;

// ---------------------------------------------------------------------------
// Module-load-time invariants (R8.1, R8.2 — Property 9)
// ---------------------------------------------------------------------------

// Per-spec: ≥ 3 layers and totalDurationMs ≤ 3000 (R8.2). The same
// invariants are exercised by `tests/pbt/project-showcase.pbt.test.ts`
// (Property 9); duplicating the assertion here turns any future drift
// into a build-time error rather than a test failure.
for (const spec of revealSpecs) {
  if (spec.layers.length < 3) {
    throw new Error(
      `RevealSpec "${spec.projectId}" must have ≥ 3 layers; has ${spec.layers.length}`,
    );
  }
  if (spec.totalDurationMs > 3000) {
    throw new Error(
      `RevealSpec "${spec.projectId}" totalDurationMs ${spec.totalDurationMs} exceeds the 3000 ms cap (R8.2)`,
    );
  }
}

// Pairwise distinctness across visualPalette, layoutPattern, and
// motionSequenceSignature (R8.1: "differs from every other on all three
// dimensions concurrently").
for (let i = 0; i < revealSpecs.length; i++) {
  for (let j = i + 1; j < revealSpecs.length; j++) {
    const a = revealSpecs[i]!;
    const b = revealSpecs[j]!;
    if (a.visualPalette === b.visualPalette) {
      throw new Error(
        `RevealSpecs "${a.projectId}" and "${b.projectId}" share visualPalette "${a.visualPalette}" (R8.1)`,
      );
    }
    if (a.layoutPattern === b.layoutPattern) {
      throw new Error(
        `RevealSpecs "${a.projectId}" and "${b.projectId}" share layoutPattern "${a.layoutPattern}" (R8.1)`,
      );
    }
    if (a.motionSequenceSignature === b.motionSequenceSignature) {
      throw new Error(
        `RevealSpecs "${a.projectId}" and "${b.projectId}" share motionSequenceSignature "${a.motionSequenceSignature}" (R8.1)`,
      );
    }
  }
}
