/**
 * `<Stagger>` — orchestrates per-child variants with a token-driven
 * delay step.
 *
 * The component wraps each direct child in a `motion.div` and assigns
 * an incrementally larger delay to each one, so the children animate
 * in sequence rather than all at once. Used by every reveal that has a
 * "lines fade in one after another" beat (Khetech word-stagger,
 * Last-Minute PDF line-by-line summary, Threshold credentials block,
 * the `Signal` contact list).
 *
 * R5.7 — Reduced_Motion_Mode collapses the per-child delay to `0` and
 * the per-child duration to `≤ 120 ms`, matching the
 * `applyReducedMotion` ceiling. Children still receive a fade so the
 * stagger remains a visible, time-bounded reveal rather than an
 * unannounced state swap.
 *
 * R5.4 — only `transform` (`y`) and `opacity` are animated. Layout
 * properties stay untouched. The token-driven delay step accepts the
 * design system's `DurationToken` ids (`instant`, `short`, `medium`,
 * `long`) so callers reference named tokens rather than literal ms
 * values; a custom step in milliseconds is also accepted for the rare
 * cases that need fractional bucket values.
 *
 * Variant resolution: when a `variantId` is supplied, the stagger
 * resolves it through `getResolvedVariant(...)` and uses the resolved
 * variant's first keyframe as the per-child enter shape. Without a
 * variant, a calm default fade-up is used. Either way the registry is
 * the only read path (R5.7), so reduced-motion is honoured uniformly.
 *
 * Validates: Requirements 5.3, 5.4, 5.7
 */

import {
  motion,
  type Easing,
  type Transition,
} from 'framer-motion';
import {
  Children,
  isValidElement,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  readReducedMotion,
  subscribeReducedMotion,
} from '../../accessibility';
import { getResolvedVariant } from '../motion-create';
import type { MotionKeyframe, MotionVariant } from '../variant-types';
import type {
  DurationToken,
  EaseToken,
} from '../../design-system/tokens.types';

// ---------------------------------------------------------------------------
// Token → ms map for the per-child delay step
// ---------------------------------------------------------------------------

/**
 * Default millisecond value per duration bucket, matching
 * `durationScale` in `design-system/tokens.ts`. Inlined here so the
 * stagger primitive does not pull the entire token module onto the
 * critical path; callers reference named tokens, the primitive maps
 * them to numbers, and tokens.ts remains the source of truth.
 *
 * If `tokens.ts` updates a default, this table must be updated to
 * match. Keep them in sync.
 */
const DURATION_TOKEN_MS: Readonly<Record<DurationToken, number>> = {
  instant: 60,
  short: 180,
  medium: 320,
  long: 720,
};

const EASE_BEZIER: Readonly<Record<EaseToken, Easing>> = {
  linear: 'linear',
  'ease-out-soft': [0.16, 1, 0.3, 1],
  'ease-in-out-quiet': [0.6, -0.05, 0.01, 0.99],
  'ease-in-decisive': [0.34, 1.56, 0.64, 1],
};

// ---------------------------------------------------------------------------
// Reduced-motion subscription
// ---------------------------------------------------------------------------

function useReducedMotionPref(): boolean {
  const [reduced, setReduced] = useState<boolean>(() => readReducedMotion());
  useEffect(() => {
    return subscribeReducedMotion(setReduced);
  }, []);
  return reduced;
}

// ---------------------------------------------------------------------------
// Default per-child enter keyframe
// ---------------------------------------------------------------------------

/**
 * Calm default reveal applied to each child when no `variantId` is
 * supplied: a small upward translate paired with a fade-in. Designed
 * to feel like prose lines settling into place rather than drawing
 * attention to the motion itself.
 */
const DEFAULT_KEYFRAME: MotionKeyframe = {
  transform: { translateY: 8 },
  opacity: 0,
  durationMs: 400,
  easing: 'ease-out-soft',
};

/**
 * Resolve the variant's first keyframe (the per-child enter shape).
 * Falls back to `DEFAULT_KEYFRAME` on a missing variant, on a registry
 * miss, or on a variant with no keyframes.
 */
function resolvePerChildKeyframe(
  variantId: string | undefined,
  reducedMotion: boolean,
): MotionKeyframe {
  if (variantId === undefined) {
    return reducedMotion ? reduceKeyframe(DEFAULT_KEYFRAME) : DEFAULT_KEYFRAME;
  }
  let resolved: MotionVariant;
  try {
    resolved = getResolvedVariant(variantId, reducedMotion);
  } catch {
    return reducedMotion ? reduceKeyframe(DEFAULT_KEYFRAME) : DEFAULT_KEYFRAME;
  }
  if (resolved.keyframes.length === 0) {
    return reducedMotion ? reduceKeyframe(DEFAULT_KEYFRAME) : DEFAULT_KEYFRAME;
  }
  return resolved.keyframes[0]!;
}

/**
 * Inline reduced-motion shape for the default keyframe — mirrors
 * `applyReducedMotion` (transform stripped, no delay, duration clamped
 * to 120 ms, opacity retained). Used only when no variantId is
 * supplied; with a variantId the registry path already collapsed the
 * keyframe.
 */
function reduceKeyframe(k: MotionKeyframe): MotionKeyframe {
  return {
    transform: {},
    durationMs: Math.min(k.durationMs, 120),
    easing: k.easing,
    ...(k.opacity !== undefined ? { opacity: k.opacity } : {}),
    ...(k.color !== undefined ? { color: k.color } : {}),
  };
}

// ---------------------------------------------------------------------------
// Per-child shape builder
// ---------------------------------------------------------------------------

interface PerChildShape {
  initial: Record<string, number>;
  animate: Record<string, number>;
  baseTransition: Transition;
}

function buildPerChildShape(k: MotionKeyframe): PerChildShape {
  const initial: Record<string, number> = {};
  const animate: Record<string, number> = {};

  if (k.opacity !== undefined) {
    initial.opacity = k.opacity;
    animate.opacity = 1;
  }
  if (k.transform.translateY !== undefined) {
    initial.y = k.transform.translateY;
    animate.y = 0;
  }
  if (k.transform.translateX !== undefined) {
    initial.x = k.transform.translateX;
    animate.x = 0;
  }
  if (k.transform.scale !== undefined) {
    initial.scale = k.transform.scale;
    animate.scale = 1;
  }
  if (k.transform.rotate !== undefined) {
    initial.rotate = k.transform.rotate;
    animate.rotate = 0;
  }

  return {
    initial,
    animate,
    baseTransition: {
      duration: Math.max(0, k.durationMs) / 1000,
      ease: EASE_BEZIER[k.easing],
    },
  };
}

// ---------------------------------------------------------------------------
// Component props
// ---------------------------------------------------------------------------

export interface StaggerProps {
  /**
   * Optional variant id to resolve the per-child enter shape. Resolved
   * via `getResolvedVariant(...)` so reduced-motion is honoured.
   */
  readonly variantId?: string;

  /**
   * Per-child delay, expressed as either a named duration token
   * (`'instant' | 'short' | 'medium' | 'long'`) or a literal
   * millisecond value. Defaults to `'short'` (180 ms), the bucket
   * design.md uses for "lines settling into place" stagger work.
   */
  readonly step?: DurationToken | number;

  /**
   * Initial offset before the first child animates, in milliseconds.
   * Useful when the parent reveal should land before the stagger
   * begins. Defaults to `0`.
   */
  readonly initialDelayMs?: number;

  /** Children to stagger. Non-element children are passed through unchanged. */
  readonly children: ReactNode;

  /** Forwarded `className`. */
  readonly className?: string;

  /** Forwarded id. */
  readonly id?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<Stagger>` — wraps each direct child in an animated wrapper with a
 * token-driven incremental delay.
 *
 * Behaviour:
 *  - Direct element children are wrapped in `motion.div` and animated
 *    using the resolved per-child enter shape.
 *  - Non-element children (raw strings, numbers, fragments without an
 *    element wrapper) are rendered untouched. This lets callers
 *    interleave a header with a stagger list without forcing the
 *    header to participate.
 *  - Under Reduced_Motion_Mode the per-child delay collapses to `0`
 *    and the resolved per-child shape's duration is already clamped to
 *    `≤ 120 ms` by the registry's reduced-motion gate (R5.7).
 */
export function Stagger(props: StaggerProps) {
  const {
    variantId,
    step = 'short',
    initialDelayMs = 0,
    children,
    className,
    id,
  } = props;

  const reducedMotion = useReducedMotionPref();

  const stepMs =
    typeof step === 'number'
      ? Math.max(0, step)
      : DURATION_TOKEN_MS[step];

  // Reduced-motion: collapse per-child delay so the stagger happens
  // effectively in parallel. The resolved variant's duration is already
  // clamped by `applyReducedMotion`.
  const effectiveStepMs = reducedMotion ? 0 : stepMs;
  const effectiveInitialDelayMs = reducedMotion
    ? 0
    : Math.max(0, initialDelayMs);

  const keyframe = resolvePerChildKeyframe(variantId, reducedMotion);
  const shape = buildPerChildShape(keyframe);

  // Walk children and wrap valid React elements; pass everything else
  // through. We only count valid elements when computing the per-child
  // delay so non-element nodes (text, fragments without an element
  // host) do not consume a slot in the stagger sequence.
  let elementIndex = 0;
  const wrapped = Children.map(children, (child, fallbackKey) => {
    if (!isValidElement(child)) {
      return child;
    }
    const i = elementIndex;
    elementIndex += 1;
    const transition: Transition = {
      ...shape.baseTransition,
      delay: (effectiveInitialDelayMs + i * effectiveStepMs) / 1000,
    };
    const childKey =
      child.key !== null && child.key !== undefined
        ? `stagger-${String(child.key)}`
        : `stagger-${fallbackKey}`;
    return (
      <motion.div
        key={childKey}
        initial={shape.initial}
        animate={shape.animate}
        transition={transition}
      >
        {child}
      </motion.div>
    );
  });

  return (
    <div className={className} id={id}>
      {wrapped}
    </div>
  );
}
