/**
 * `<Parallax>` — scene-progress-driven transform / opacity / filter
 * primitive.
 *
 * R5.2 routes every scroll-linked effect through the single shared
 * scroll source in `motion/scroll-source.ts`. R5.4 forbids updating
 * layout-affecting properties (`width`, `height`, `top`, `left`,
 * `margin`, `padding`) at scroll cadence — only `transform`, `opacity`,
 * and `filter` are permitted. R5.7 disables parallax entirely under
 * Reduced_Motion_Mode.
 *
 * This component subscribes to `useScroll().sceneProgress(domId)`,
 * which returns the same `MotionValue<number>` for repeated calls with
 * the same id (so framer-motion's `useTransform` memoises correctly),
 * and threads that progress value through a set of `useTransform`
 * mappings limited to the R5.4-permitted channels:
 *
 *   - `y` (translateY) — vertical parallax envelope
 *   - `x` (translateX) — horizontal parallax envelope (less common)
 *   - `scale`         — uniform scale envelope
 *   - `rotate`        — rotation envelope (degrees)
 *   - `opacity`       — opacity envelope
 *   - `filter`        — CSS filter envelope (e.g. blur ramp)
 *
 * No layout-affecting field is exposed. Every consumed range maps the
 * progress domain `[0, 1]` to the supplied output range, with
 * progress sampled by the shared scroll source (the only attached
 * `scroll` listener in the entire codebase).
 *
 * Reduced-motion path: when the persisted preference resolves to
 * "reduce", the component renders a plain `<div>` (no framer-motion
 * subscription, no transform pipeline) so the wrapper imposes zero
 * runtime cost beyond a single DOM node. Scene progress for the same
 * `domId` continues to be tracked by other consumers — only this
 * wrapper opts out of applying it.
 *
 * Validates: Requirements 5.2, 5.4, 5.7
 */

import {
  motion,
  useTransform,
  type MotionValue,
} from 'framer-motion';
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import {
  readReducedMotion,
  subscribeReducedMotion,
} from '../../accessibility';
import { useScroll } from '../scroll-source';

// ---------------------------------------------------------------------------
// Range type
// ---------------------------------------------------------------------------

/**
 * A 2-tuple `[from, to]` mapped over the scene progress domain
 * `[0, 1]`. The mapping is linear; non-linear shaping (e.g. an `s`
 * curve) is the caller's responsibility — pass progress through your
 * own `useTransform` first if you need it.
 */
export type ParallaxRange = readonly [number, number];

/**
 * String-valued range (e.g. for `filter: 'blur(0px)' → 'blur(8px)'`).
 * Framer-motion interpolates between matching CSS strings as long as
 * they share the same function shape.
 */
export type ParallaxStringRange = readonly [string, string];

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
// Component props
// ---------------------------------------------------------------------------

export interface ParallaxProps {
  /**
   * The scene's DOM id. Consumed verbatim by
   * `useScroll().sceneProgress(domId)`. The progress value is `0` when
   * the scene's top edge sits at the viewport bottom and `1` when its
   * bottom edge sits at the viewport top — see
   * `motion/scroll-source.ts` for the full bookend convention.
   */
  readonly domId: string;

  /**
   * Vertical parallax envelope in CSS pixels. Defaults to `[-40, 40]`,
   * a calm 80-px sweep across the scene's full progress range. Pass
   * `undefined` to disable y-axis parallax.
   */
  readonly y?: ParallaxRange;

  /** Horizontal parallax envelope in CSS pixels. */
  readonly x?: ParallaxRange;

  /** Uniform scale envelope (1 = identity). */
  readonly scale?: ParallaxRange;

  /** Rotation envelope in degrees. */
  readonly rotate?: ParallaxRange;

  /** Opacity envelope in [0, 1]. */
  readonly opacity?: ParallaxRange;

  /**
   * CSS `filter` envelope. Both ends MUST share the same function
   * shape (e.g. `'blur(0px)'` → `'blur(8px)'`); framer-motion can only
   * interpolate matching filter functions.
   */
  readonly filter?: ParallaxStringRange;

  /** Children rendered inside the parallax wrapper. */
  readonly children: ReactNode;

  /** Forwarded `className`. */
  readonly className?: string;

  /** Forwarded id (for anchor wiring). */
  readonly id?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<Parallax>` — wraps `children` with a transform/opacity/filter
 * pipeline driven by the named scene's scroll progress.
 *
 * Rules enforced here:
 *  - Every animated channel goes through `useTransform` against the
 *    shared `MotionValue<number>` from the single scroll source. No
 *    additional listeners are registered (R5.2).
 *  - Only `transform` (`x`, `y`, `scale`, `rotate`), `opacity`, and
 *    `filter` are exposed. The component intentionally omits any
 *    prop that would write to a layout property (R5.4).
 *  - Under Reduced_Motion_Mode the wrapper renders as a plain `<div>`
 *    so parallax is fully disabled (R5.7).
 */
export function Parallax(props: ParallaxProps) {
  const {
    domId,
    y,
    x,
    scale,
    rotate,
    opacity,
    filter,
    children,
    className,
    id,
  } = props;

  const reducedMotion = useReducedMotionPref();
  const { sceneProgress } = useScroll();
  const progress: MotionValue<number> = sceneProgress(domId);

  // Always invoke the same number of `useTransform` calls in the same
  // order so the hook ordering is stable across re-renders. Channels
  // not requested by the caller still allocate a `MotionValue` but the
  // resulting transform is the identity range, so the cost is a few
  // cheap subscriptions on the shared progress signal.
  //
  // `useTransform`'s overload rejects `readonly` tuples; the readonly
  // public API is preserved by spreading into mutable arrays here at
  // the boundary.
  const yMv = useTransform(progress, [0, 1], y !== undefined ? [y[0], y[1]] : [0, 0]);
  const xMv = useTransform(progress, [0, 1], x !== undefined ? [x[0], x[1]] : [0, 0]);
  const scaleMv = useTransform(progress, [0, 1], scale !== undefined ? [scale[0], scale[1]] : [1, 1]);
  const rotateMv = useTransform(progress, [0, 1], rotate !== undefined ? [rotate[0], rotate[1]] : [0, 0]);
  const opacityMv = useTransform(progress, [0, 1], opacity !== undefined ? [opacity[0], opacity[1]] : [1, 1]);
  const filterMv = useTransform(
    progress,
    [0, 1],
    filter !== undefined ? [filter[0], filter[1]] : ['none', 'none'],
  );

  // Reduced-motion fallback — a plain wrapper. We still call all
  // `useTransform` hooks above to keep React's hook-ordering stable
  // when the preference toggles at runtime; the `MotionValue`s are GC'd
  // when this branch unmounts the framer-motion node.
  if (reducedMotion) {
    return (
      <div className={className} id={id}>
        {children}
      </div>
    );
  }

  // Build the style object only with the channels the caller actually
  // requested. Omitting unrequested channels means the underlying DOM
  // element keeps its natural CSS for those properties (e.g. inherited
  // opacity) instead of being pinned to identity.
  //
  // Typed as `CSSProperties` for the TS surface; framer-motion accepts
  // `MotionValue` instances at any of these keys at runtime. The cast
  // through `unknown` quiets the strict-check on values it rightly
  // can't statically prove are CSS-string compatible.
  const style: Record<string, unknown> = {};
  if (y !== undefined) style.y = yMv;
  if (x !== undefined) style.x = xMv;
  if (scale !== undefined) style.scale = scaleMv;
  if (rotate !== undefined) style.rotate = rotateMv;
  if (opacity !== undefined) style.opacity = opacityMv;
  if (filter !== undefined) style.filter = filterMv;

  return (
    <motion.div className={className} id={id} style={style as CSSProperties}>
      {children}
    </motion.div>
  );
}
