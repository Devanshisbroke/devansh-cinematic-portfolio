/**
 * `<Reveal>` — once-per-page-session entrance animation primitive.
 *
 * R5.3 mandates that an element's entrance animation play exactly once
 * per page session, where a "page session" is the interval from page
 * load until the next full document reload. R5.4 mandates that
 * scroll-linked or pointer-linked effects animate only `transform`,
 * `opacity`, and `filter`. R5.7 mandates Reduced_Motion_Mode behaviour.
 *
 * This component is the primitive that satisfies R5.3 directly. Every
 * scene below the fold wraps its hero block in a `<Reveal variantId="…">`,
 * supplies a `MotionVariant` registered via `registerVariant(...)` at
 * module-evaluation time, and the primitive handles the rest:
 *
 *   1. An `IntersectionObserver` with `threshold: 0.1` (matching the
 *      "at least 10% visible" R5.3 wording exactly) is attached to the
 *      wrapper element.
 *   2. The first time the wrapper crosses the threshold, the variant is
 *      resolved through `getResolvedVariant(id, reducedMotion)` — the
 *      sole supported registry read path — and the animation runs.
 *   3. The wrapper element is added to a module-level `WeakSet`, so any
 *      future re-mount of the SAME element (e.g. via `<Suspense>`
 *      hydration churn) sees the entry already played and skips
 *      re-animating. Together with the `useRef` guard against double-fire
 *      within a single mount, this delivers the "exactly once per page
 *      session" contract.
 *
 * Variant interpretation convention: a `MotionKeyframe` describes the
 * pre-reveal OFFSET STATE — the element starts at the keyframe's
 * `transform`/`opacity` values and animates to identity (no transform,
 * full opacity). Property 8c's reduced-motion guarantee then collapses
 * the offset to identity, leaving only an opacity/colour cross-fade ≤
 * 120 ms. Multi-keyframe variants use the first keyframe for the wrapper
 * envelope; per-layer orchestration is the job of project-specific
 * reveal renderers (tasks 11.5–11.8) which compose `<Reveal>` with
 * `<Stagger>` and bespoke layered timelines.
 *
 * Validates: Requirements 5.3, 5.4, 5.7
 */

import {
  motion,
  type Easing,
  type Transition,
  type Variants,
} from 'framer-motion';
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  readReducedMotion,
  subscribeReducedMotion,
} from '../../accessibility';
import { getResolvedVariant } from '../motion-create';
import type {
  MotionKeyframe,
  MotionTransform,
  MotionVariant,
} from '../variant-types';
import type { EaseToken } from '../../design-system/tokens.types';

// ---------------------------------------------------------------------------
// Once-per-session bookkeeping (R5.3)
// ---------------------------------------------------------------------------

/**
 * Module-level `WeakSet` of wrapper elements that have already played
 * their reveal in the current page session. A `WeakSet` (rather than a
 * `Set`) lets the entry be GC'd once the element is detached from the
 * DOM permanently, so we do not leak references for unmounted scenes.
 *
 * The contract: an element added to this set has fired its variant at
 * least once during this page session and MUST NOT fire again until a
 * full document reload clears module state. The `useRef<boolean>` guard
 * inside the component handles the same-render double-fire case (e.g.
 * React 18 strict-mode double-invocation in development).
 */
const FIRED_VARIANTS: WeakSet<Element> = new WeakSet();

// ---------------------------------------------------------------------------
// Easing token → framer-motion easing
// ---------------------------------------------------------------------------

/**
 * Mapping from the design's named easing tokens (R5.1) to the
 * 4-tuple cubic-bezier form framer-motion accepts. Mirrors
 * `easingScale` in `design-system/tokens.ts` exactly; kept inline here
 * to avoid pulling the full token module onto the critical reveal path.
 *
 * `linear` is a string keyword; the others are unbounded bezier control
 * tuples (note the `1.56` overshoot in `ease-in-decisive`, intentional
 * per the design's spring-like assertive curve).
 */
const EASE_BEZIER: Readonly<Record<EaseToken, Easing>> = {
  linear: 'linear',
  'ease-out-soft': [0.16, 1, 0.3, 1],
  'ease-in-out-quiet': [0.6, -0.05, 0.01, 0.99],
  'ease-in-decisive': [0.34, 1.56, 0.64, 1],
};

// ---------------------------------------------------------------------------
// Variant → framer-motion target shape
// ---------------------------------------------------------------------------

/**
 * Build the framer-motion `initial` / `animate` / `transition` objects
 * for a given keyframe. The keyframe describes the OFFSET STATE; we
 * animate from that offset back to identity. Only `transform`-style
 * fields and `opacity` are emitted — R5.4 forbids layout-affecting
 * properties at scroll/pointer cadence. Reveal also runs only on
 * intersection (not at scroll cadence), so this stays well inside the
 * R5.4 envelope.
 */
function buildEntranceShape(k: MotionKeyframe): {
  initial: Record<string, number>;
  animate: Record<string, number>;
  transition: Transition;
} {
  const initial: Record<string, number> = {};
  const animate: Record<string, number> = {};

  // Opacity — start at the keyframe's value (0 by convention for a
  // fade-in entrance), end at 1.
  if (k.opacity !== undefined) {
    initial.opacity = k.opacity;
    animate.opacity = 1;
  }

  // Transform channels. Framer-motion uses short field names: `x`, `y`,
  // `scale`, `rotate`. The convention is "start at offset, end at
  // identity": initial = keyframe value, animate = 0 (or 1 for scale).
  const t: MotionTransform = k.transform;
  if (t.translateX !== undefined) {
    initial.x = t.translateX;
    animate.x = 0;
  }
  if (t.translateY !== undefined) {
    initial.y = t.translateY;
    animate.y = 0;
  }
  if (t.scale !== undefined) {
    initial.scale = t.scale;
    animate.scale = 1;
  }
  if (t.rotate !== undefined) {
    initial.rotate = t.rotate;
    animate.rotate = 0;
  }

  const transition: Transition = {
    duration: Math.max(0, k.durationMs) / 1000,
    delay: Math.max(0, k.delayMs ?? 0) / 1000,
    ease: EASE_BEZIER[k.easing],
  };

  return { initial, animate, transition };
}

/**
 * Default fallback when a variant is unregistered or empty: a minimal
 * "fade up by 12 px" reveal. Keeps the primitive testable in isolation
 * (consumers without a registered variant still get something
 * reasonable) without bypassing the registry for properly-wired scenes.
 */
const FALLBACK_VARIANT: MotionVariant = {
  id: '__reveal_fallback__',
  keyframes: [
    {
      transform: { translateY: 12 },
      opacity: 0,
      durationMs: 600,
      easing: 'ease-out-soft',
    },
  ],
};

/**
 * Resolve a variant by id, falling back to {@link FALLBACK_VARIANT} on
 * any registry miss. The registry intentionally `throws` for unknown
 * ids (`motion-create.ts`, by design — programming errors should be
 * loud). For the Reveal primitive specifically, an absent variant is
 * recoverable: scenes still mount during early development before the
 * full variant registry is wired, and tests that exercise the primitive
 * without registering anything should still render. We catch the throw
 * here and substitute the fallback.
 */
function safeResolveVariant(
  variantId: string | undefined,
  reducedMotion: boolean,
): MotionVariant {
  if (variantId === undefined) {
    return reducedMotion ? reduceFallback(FALLBACK_VARIANT) : FALLBACK_VARIANT;
  }
  try {
    return getResolvedVariant(variantId, reducedMotion);
  } catch {
    return reducedMotion ? reduceFallback(FALLBACK_VARIANT) : FALLBACK_VARIANT;
  }
}

/**
 * Inline reduced-motion shape for the fallback variant. Mirrors
 * `applyReducedMotion` (transform → identity, drop delay, clamp
 * duration to 120 ms, retain opacity/colour). Kept inline so the
 * fallback path does not invoke the full transformer for a constant.
 */
function reduceFallback(v: MotionVariant): MotionVariant {
  return {
    id: v.id,
    keyframes: v.keyframes.map((k) => ({
      transform: {},
      durationMs: Math.min(k.durationMs, 120),
      easing: k.easing,
      ...(k.opacity !== undefined ? { opacity: k.opacity } : {}),
      ...(k.color !== undefined ? { color: k.color } : {}),
    })),
  };
}

// ---------------------------------------------------------------------------
// React hook: live reduced-motion preference
// ---------------------------------------------------------------------------

/**
 * Subscribe to the persisted Reduced_Motion_Mode flag. Re-renders the
 * consumer whenever the user toggles the in-app preference or the OS
 * `prefers-reduced-motion` media query fires a change event. The
 * initial value is read synchronously so the first render already
 * reflects the persisted preference (R13.1 / R13.2).
 */
function useReducedMotionPref(): boolean {
  const [reduced, setReduced] = useState<boolean>(() => readReducedMotion());
  useEffect(() => {
    return subscribeReducedMotion(setReduced);
  }, []);
  return reduced;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface RevealProps {
  /**
   * Identifier of a `MotionVariant` registered via
   * `registerVariant(...)` at module-evaluation time. When the wrapper
   * crosses the intersection threshold, the variant is resolved through
   * `getResolvedVariant(variantId, reducedMotion)` and animated.
   *
   * Optional: omitting the id yields a sensible default fade-up reveal
   * so the primitive remains useful before the per-scene variant
   * registry is wired up. Production scenes always supply an id.
   */
  readonly variantId?: string;

  /**
   * Intersection threshold in [0, 1]. Defaults to `0.1` to match R5.3's
   * "at least 10% visible" wording. Override only for special-case
   * scenes (e.g. ultra-tall canvases that should reveal earlier).
   */
  readonly threshold?: number;

  /** Children rendered inside the animated wrapper. */
  readonly children: ReactNode;

  /**
   * Forwarded `className` so callers can apply layout / spacing tokens
   * to the animated wrapper without an extra DOM node.
   */
  readonly className?: string;

  /**
   * Optional id forwarded to the underlying DOM element. Useful when
   * the reveal wrapper IS the scene anchor referenced by the route map.
   */
  readonly id?: string;
}

/**
 * `<Reveal>` — observe-once entrance animation.
 *
 * Forwards a ref to the underlying `motion.div` so callers can compose
 * with focus management / measurement utilities without a second
 * wrapper.
 */
export const Reveal = forwardRef<HTMLDivElement, RevealProps>(function Reveal(
  { variantId, threshold = 0.1, children, className, id },
  forwardedRef,
) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  // Forward the same ref node we observe so consumers can read it.
  useImperativeHandle(forwardedRef, () => wrapperRef.current as HTMLDivElement);

  const reducedMotion = useReducedMotionPref();

  // Played-state drives whether framer-motion is in `initial` or
  // `animate`. Once `true`, the element stays in `animate` for the rest
  // of the session; the `WeakSet` guard prevents re-running on
  // re-intersection.
  const [played, setPlayed] = useState<boolean>(() => false);

  // Per-mount guard against the IntersectionObserver firing twice for
  // the same crossing (e.g. when both `entry.isIntersecting` and a
  // subsequent threshold callback land in the same batch).
  const firedThisMountRef = useRef<boolean>(false);

  useEffect(() => {
    const el = wrapperRef.current;
    if (el === null) return undefined;

    // If THIS element already fired in a prior render of this mount —
    // for example on a route revisit that re-uses the same DOM node —
    // skip straight to played.
    if (FIRED_VARIANTS.has(el)) {
      firedThisMountRef.current = true;
      setPlayed(true);
      return undefined;
    }

    // SSR / non-browser guard. The provider's effect body is the only
    // place that touches `IntersectionObserver`.
    if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          // R5.3 requires "at least 10% visible". Both `isIntersecting`
          // and `intersectionRatio >= threshold` are checked because
          // some observer implementations report `isIntersecting=true`
          // at sub-threshold ratios depending on rootMargin maths.
          if (
            entry.isIntersecting &&
            entry.intersectionRatio >= threshold &&
            !firedThisMountRef.current &&
            !FIRED_VARIANTS.has(el)
          ) {
            firedThisMountRef.current = true;
            FIRED_VARIANTS.add(el);
            setPlayed(true);
            // Stop observing — we never need to fire again.
            observer.disconnect();
            return;
          }
        }
      },
      { threshold },
    );
    observer.observe(el);

    return () => {
      observer.disconnect();
    };
  }, [threshold]);

  // Resolve the variant via the registry funnel (R5.7). The resolved
  // variant is already collapsed to its reduced form when
  // `reducedMotion` is true.
  const variant = safeResolveVariant(variantId, reducedMotion);

  // Build the framer-motion shape from the FIRST keyframe. Multi-layer
  // orchestration (per the four project reveals) is handled by
  // composing `<Reveal>` with `<Stagger>` and bespoke per-layer renderers.
  const shape =
    variant.keyframes.length > 0
      ? buildEntranceShape(variant.keyframes[0]!)
      : { initial: {}, animate: {}, transition: { duration: 0 } };

  // Variants object lets framer-motion drive the transition declaratively
  // off the `played` boolean, which is the desired pattern for
  // intersection-once reveals (avoids imperative `controls.start()`).
  const variants: Variants = {
    hidden: shape.initial,
    visible: shape.animate,
  };

  return (
    <motion.div
      ref={wrapperRef}
      id={id}
      className={className}
      variants={variants}
      initial="hidden"
      animate={played ? 'visible' : 'hidden'}
      transition={shape.transition}
    >
      {children}
    </motion.div>
  );
});
