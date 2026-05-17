/**
 * Motion variant contract surface.
 *
 * Defines the pure-data shapes (`MotionTransform`, `MotionKeyframe`,
 * `MotionVariant`) that every animated component in the portfolio
 * speaks. These shapes are the input/output contract for the
 * reduced-motion transformer (`./reduced-motion.ts`) and therefore
 * underpin Property 8 — Reduced-Motion Transformer Bounds, Idempotence,
 * Transform Restriction, and Involution. Field names and types here
 * MUST stay exact; the PBT generators (`tests/pbt/_generators.ts`) and
 * the reduced-motion property test bind to these literals.
 *
 * Validates: Requirements 5.1, 8.2, 18.1, 18.2
 *
 * Rules:
 *  - No runtime values other than the `totalDurationMs` helper.
 *  - No DOM, React, or framer-motion imports — this file is the
 *    contract; the rendering layer (`./primitives/*`) consumes it.
 *  - Every numeric transform channel is unitless and resolves to CSS
 *    `transform` later: `translateX/Y` are CSS pixels, `scale` is a
 *    multiplier (1 === identity), `rotate` is degrees.
 *  - `scrollLinked` marks a keyframe as driven by scroll progress
 *    rather than wall-clock time; the reduced-motion transformer
 *    strips it (R18.3).
 */

import type { EaseToken } from '../design-system/tokens.types';

// ---------------------------------------------------------------------------
// MotionTransform
// ---------------------------------------------------------------------------

/**
 * Per-keyframe transform channels. Every field is optional so a
 * keyframe can express "only fade" (no transform) by passing `{}`,
 * which is also the canonical reduced-motion identity transform
 * required by Property 8c.
 *
 * Channel semantics:
 *  - `translateX`, `translateY`: CSS-pixel offsets relative to layout
 *    position. Positive Y moves the element downward.
 *  - `scale`: uniform multiplier, `1` is identity. Property 8c bounds
 *    reduced-motion `scale` ≤ 1.05.
 *  - `rotate`: rotation in degrees about the element's own origin.
 *    Reduced-motion strips this entirely.
 *  - `scrollLinked`: when `true`, the keyframe's progress is sampled
 *    from the shared scroll source instead of an animation timeline.
 *    Reduced-motion strips this so the keyframe collapses to its
 *    static end state.
 */
export interface MotionTransform {
  readonly translateX?: number;
  readonly translateY?: number;
  readonly scale?: number;
  readonly rotate?: number;
  readonly scrollLinked?: boolean;
}

// ---------------------------------------------------------------------------
// MotionKeyframe
// ---------------------------------------------------------------------------

/**
 * One animatable frame inside a `MotionVariant`. A keyframe owns a
 * transform snapshot, optional non-transform channels (`opacity`,
 * `color`), and timing metadata (`durationMs`, `delayMs`, `easing`).
 *
 * Timing semantics:
 *  - `durationMs`: how long this keyframe takes to play, in ms.
 *  - `delayMs`: offset from the variant start before this keyframe
 *    begins. Defaults to `0` when omitted.
 *  - `easing`: easing curve identifier from the design tokens. The
 *    reduced-motion transformer preserves this (R18) because curve
 *    choice is independent of motion magnitude.
 *
 * Visual channels:
 *  - `opacity`: 0..1 fade target. Retained under reduced motion since
 *    fades carry information without inducing motion.
 *  - `color`: CSS color string (any form). Retained under reduced
 *    motion for the same reason.
 */
export interface MotionKeyframe {
  readonly transform: MotionTransform;
  readonly opacity?: number;
  readonly color?: string;
  readonly durationMs: number;
  readonly delayMs?: number;
  readonly easing: EaseToken;
}

// ---------------------------------------------------------------------------
// MotionVariant
// ---------------------------------------------------------------------------

/**
 * A named animation variant: an identifier plus an ordered, immutable
 * list of keyframes. The `id` is the registry key the
 * involution-restoring `applyFullMotion` uses to look up the original
 * variant after `applyReducedMotion` has stripped it (Property 8d).
 *
 * Keyframes run in parallel from a shared `t = 0`; each keyframe's
 * end time is `(delayMs ?? 0) + durationMs`. The variant's total
 * duration is therefore the maximum end time across all keyframes,
 * computed by `totalDurationMs` below.
 */
export interface MotionVariant {
  readonly id: string;
  readonly keyframes: readonly MotionKeyframe[];
}

// ---------------------------------------------------------------------------
// totalDurationMs
// ---------------------------------------------------------------------------

/**
 * Returns the total duration of a `MotionVariant` in milliseconds —
 * the end time of the last-finishing keyframe, computed as
 * `max((delayMs ?? 0) + durationMs)` across all keyframes.
 *
 * An empty variant has duration `0`. This convention matches the
 * reduced-motion sub-property 8a, which states that an all-zero or
 * stripped variant must have `totalDurationMs ≤ 120`.
 */
export function totalDurationMs(v: MotionVariant): number {
  if (v.keyframes.length === 0) return 0;
  return Math.max(
    ...v.keyframes.map((k) => (k.delayMs ?? 0) + k.durationMs),
  );
}
