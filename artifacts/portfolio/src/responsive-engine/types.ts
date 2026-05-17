/**
 * Responsive_Engine type contracts and rank table.
 *
 * Defines the four named Breakpoint_Tiers, their narrowest→widest rank
 * ordering, and the per-tier `LayoutTier` shape that downstream layout,
 * typography, and reveal-stagger code reads from `resolveLayoutTier(w)`.
 *
 * Sourced from `requirements.md` Requirements 12 and 17, and `design.md`
 * § Component architecture → `responsive-engine/` and § Correctness
 * Properties → Property 6 (resolver totality / determinism / monotonicity)
 * and Property 7 (layout-tier idempotence within a tier).
 *
 * Tier viewport-width ranges (R12.1, contiguous, non-overlapping, total
 * over [320, ∞)):
 *  - `mobile`     [320,  767]  — single-column phones
 *  - `tablet`     [768, 1023]  — small landscape devices
 *  - `desktop`    [1024, 1919] — standard laptop / desktop
 *  - `ultrawide`  [1920,    ∞) — high-pixel desktop and beyond
 *
 * Validates: Requirements 12.1, 12.2, 17.1
 *
 * Rules:
 *  - The string set in `Breakpoint` is the canonical, exhaustive enum;
 *    `BREAKPOINT_RANK` is a `Record<Breakpoint, 1|2|3|4>` so TypeScript
 *    fails the build if a tier is added without a rank, or vice versa.
 *  - `BREAKPOINT_RANK` is a runtime export (a `const`), used by the
 *    Property 6 monotonicity check (rank delta ∈ {0, 1} between adjacent
 *    integer widths) and by any consumer that needs a stable narrowest→
 *    widest ordering (R17.2).
 *  - `LayoutTier` carries token-named spacing references (not raw px or
 *    rem) so the no-raw-spacing ESLint rule (planned in task 16.x) and
 *    the design-token contract stay enforceable end-to-end (R3.3).
 */

import type { SpacingStep } from '../design-system/tokens.types';

// ---------------------------------------------------------------------------
// Breakpoint enum (R12.1)
// ---------------------------------------------------------------------------

/**
 * The four named Breakpoint_Tiers (R12.1). Order in the union is
 * narrowest → widest, matching the rank assignment in
 * `BREAKPOINT_RANK`. The tier name set is closed and exhaustive — no
 * additional tiers are permitted, and `resolveBreakpoint(w)` MUST
 * return exactly one of these values for every width w ≥ 320 (R12.2,
 * R17.1).
 */
export type Breakpoint = 'mobile' | 'tablet' | 'desktop' | 'ultrawide';

// ---------------------------------------------------------------------------
// Breakpoint rank (R17.2)
// ---------------------------------------------------------------------------

/**
 * Narrowest→widest rank table. Rank values are the integer indices
 * required by R17.2 / design Property 6: for any pair of adjacent
 * integer widths `(w, w+1)` in [320, 3840],
 *
 *   BREAKPOINT_RANK[resolveBreakpoint(w + 1)]
 *     - BREAKPOINT_RANK[resolveBreakpoint(w)]   ∈ {0, 1}
 *
 * which expresses the monotonic-with-step-≤-1 transition contract.
 *
 * The literal `1 | 2 | 3 | 4` value type (rather than `number`) keeps
 * the rank set closed at the type level, so a future tier addition
 * cannot silently widen the rank space.
 */
export const BREAKPOINT_RANK: Record<Breakpoint, 1 | 2 | 3 | 4> = {
  mobile: 1,
  tablet: 2,
  desktop: 3,
  ultrawide: 4,
} as const;

// ---------------------------------------------------------------------------
// Layout tier (Property 7)
// ---------------------------------------------------------------------------

/**
 * The resolved per-tier layout contract returned by
 * `resolveLayoutTier(width)`. Property 7 requires this value to be
 * deep-equal across any two widths that resolve to the same
 * Breakpoint_Tier (idempotence within a tier).
 *
 * Field semantics:
 *  - `columns`               — number of grid columns the tier renders.
 *                              R12.4 mandates a single-column layout
 *                              below 768 px, so the `mobile` tier MUST
 *                              set `columns: 1`.
 *  - `gutterToken`           — `SpacingStep` resolving to the inter-column
 *                              gutter via the design tokens. Token-named
 *                              (no raw spacing) so the contract stays
 *                              auditable by the ESLint rule planned in
 *                              task 16.x (R3.3).
 *  - `maxMeasureCh`          — maximum prose measure in `ch` units.
 *                              Bounds long-form copy width per the
 *                              typography readability rules in R4.x
 *                              regardless of viewport width.
 *  - `sceneVerticalRhythmToken` — `SpacingStep` for the vertical rhythm
 *                              between scene rows / blocks; consumed by
 *                              `Stack` and scene wrappers.
 *  - `revealLayerStaggerMs`  — base millisecond delay between adjacent
 *                              layers in a `RevealSpec`. Tier-scaled so
 *                              narrower viewports stage reveals more
 *                              tightly than ultrawide ones.
 */
export interface LayoutTier {
  readonly columns: number;
  readonly gutterToken: SpacingStep;
  readonly maxMeasureCh: number;
  readonly sceneVerticalRhythmToken: SpacingStep;
  readonly revealLayerStaggerMs: number;
}
