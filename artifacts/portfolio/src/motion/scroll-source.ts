/**
 * The single shared scroll source for the entire portfolio.
 *
 * R5.2 mandates that every scroll-linked effect on the site reads from
 * exactly one shared scroll progress source and that the application
 * register zero additional `scroll` listeners on `window` or
 * `document` beyond that source. This module is that source. It is
 * the *only* file in `src/` permitted to call
 * `window.addEventListener('scroll', …)` or to instantiate a
 * `ResizeObserver` against `document.documentElement`. The custom
 * ESLint rule `no-window-scroll-listeners` (task 16.1) enforces the
 * invariant; this file is the rule's documented exception.
 *
 * Architecture:
 *  1. `<ScrollSourceProvider>` mounts once at the App shell. It owns
 *     a single `MotionValue<number>` for `scrollY` and a single
 *     `ResizeObserver`. Both are torn down on unmount.
 *  2. `useScroll()` reads the provider's value and returns the same
 *     `MotionValue` plus a `sceneProgress(domId)` factory that
 *     memoises a derived `MotionValue<number>` per scene (0 when the
 *     scene's top is at the viewport bottom, 1 when its bottom is at
 *     the viewport top, 0.5 at center — the standard convention).
 *  3. `subscribe(cb)` lets non-Framer consumers (e.g. the hash router
 *     in `route-map/hash-router.ts`) read `scrollY` without adding a
 *     second listener.
 *  4. All updates pass through `requestAnimationFrame`, so a burst of
 *     native scroll events collapses into at most one frame's worth
 *     of work. The provider also re-samples scene progress on layout
 *     changes via the shared `ResizeObserver`, which is required
 *     because `getBoundingClientRect` outputs depend on layout.
 *
 * Validates: Requirements 5.2, 5.4
 */

import { motionValue, type MotionValue } from 'framer-motion';
import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';

// ---------------------------------------------------------------------------
// Public surface
// ---------------------------------------------------------------------------

/**
 * The shared scroll source returned by `useScroll()`.
 *
 * Consumers never construct this themselves; the provider owns the
 * `MotionValue`s and the listener lifecycle.
 */
export interface ScrollSource {
  /**
   * Current document scroll position in CSS pixels along the Y axis.
   * Tracks `window.scrollY`, sampled on each animation frame after a
   * native `scroll` event fires.
   */
  readonly scrollY: MotionValue<number>;

  /**
   * Returns a `MotionValue<number>` whose value is the scroll
   * progress through the named scene's vertical range, clamped to
   * [0, 1]. The progress is computed against the scene element's
   * `getBoundingClientRect()` and the current viewport height:
   *
   *   - `0` when the scene's top edge sits at the viewport bottom
   *     (scene about to enter from below).
   *   - `1` when the scene's bottom edge sits at the viewport top
   *     (scene has just exited above).
   *   - `0.5` when the scene's center is at the viewport center.
   *
   * The same `MotionValue` instance is returned for repeated calls
   * with the same `domId` so consumers can `useTransform` against a
   * stable reference. If `domId` does not resolve to a DOM element
   * (e.g. before mount), the value is `0` until the next sample.
   */
  sceneProgress(domId: string): MotionValue<number>;

  /**
   * Direct subscription for consumers that cannot use a
   * `MotionValue` (e.g. the hash router needs raw numbers to compute
   * which scene occupies the viewport). The callback fires at most
   * once per animation frame with the latest `scrollY`. Returns an
   * unsubscribe function. Subscribing here adds no `scroll`
   * listeners — it shares the provider's single one.
   */
  subscribe(cb: (scrollY: number) => void): () => void;
}

const ScrollContext = createContext<ScrollSource | null>(null);

export interface ScrollSourceProviderProps {
  readonly children?: ReactNode;
}

/**
 * Mounts the single shared scroll source for the app. Wrap once in
 * the App shell (`src/App.tsx`). Mounting more than one provider in a
 * single tree breaks R5.2's "exactly one" invariant; this is not
 * statically enforced (React allows nested providers) but the
 * codebase keeps a single mount.
 */
export function ScrollSourceProvider(
  props: ScrollSourceProviderProps,
): ReactNode {
  // The shared scroll-Y `MotionValue`. `motionValue(0)` is pure data;
  // it does not attach any DOM listeners by itself. The provider
  // feeds it from a single rAF-coalesced scroll handler below.
  const scrollY = useMemo<MotionValue<number>>(() => motionValue(0), []);

  // External subscribers (e.g. hash-router scroll-spy). A `Set` so
  // unsubscribe is O(1) and duplicate `subscribe(cb)` calls are
  // deduplicated by reference.
  const subscribersRef = useRef<Set<(scrollY: number) => void>>(new Set());

  // Per-scene progress `MotionValue` cache. Stable reference per
  // `domId` so `useTransform(sceneProgress(id), ...)` is correctly
  // memoised by Framer.
  const sceneProgressCacheRef = useRef<Map<string, MotionValue<number>>>(
    new Map(),
  );

  useEffect(() => {
    // SSR / non-browser guard. The provider's effect body is the only
    // place in the module that touches `window` or `document`.
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return undefined;
    }

    // Seed with the current scroll position so the first render of
    // any consumer sees a sensible value rather than `0` until the
    // user scrolls.
    scrollY.set(window.scrollY);
    refreshAllSceneProgress(sceneProgressCacheRef.current);

    // rAF coalescing: a burst of `scroll` events within one frame
    // collapses into a single sample. `pending` guards against
    // queueing multiple frames while one is still outstanding.
    let pending = false;
    let rafId = 0;

    const flush = (): void => {
      pending = false;
      rafId = 0;
      const y = window.scrollY;
      scrollY.set(y);
      refreshAllSceneProgress(sceneProgressCacheRef.current);
      // Notify external subscribers after the shared `MotionValue` is
      // updated so anyone reading `scrollY.get()` inside the callback
      // sees the current frame's value.
      const subs = subscribersRef.current;
      if (subs.size > 0) {
        // Iterate a snapshot so a subscriber unsubscribing during the
        // notify pass doesn't skip a sibling.
        for (const cb of Array.from(subs)) {
          cb(y);
        }
      }
    };

    const onScroll = (): void => {
      if (!pending) {
        pending = true;
        rafId = window.requestAnimationFrame(flush);
      }
    };

    // The ONE allowed `scroll` listener on `window`. R5.2.
    // `passive: true` tells the browser the handler will not call
    // `preventDefault`, letting it deliver scrolls without a
    // round-trip through the JS event handler.
    window.addEventListener('scroll', onScroll, { passive: true });

    // The ONE allowed `ResizeObserver` against `document.documentElement`.
    // Layout changes (font load, image load, viewport resize, content
    // reflow) move scene rectangles relative to the viewport without
    // firing a `scroll` event, so we re-sample progress on resize too.
    // The observer fires its callback in a microtask after layout, so
    // measurements are up to date.
    const ro = new ResizeObserver(() => {
      // Same rAF coalescing path so a resize burst doesn't produce N
      // recomputations.
      if (!pending) {
        pending = true;
        rafId = window.requestAnimationFrame(flush);
      }
    });
    ro.observe(document.documentElement);

    return () => {
      window.removeEventListener('scroll', onScroll);
      ro.disconnect();
      if (rafId !== 0) {
        window.cancelAnimationFrame(rafId);
        rafId = 0;
        pending = false;
      }
    };
  }, [scrollY]);

  const value = useMemo<ScrollSource>(
    () => ({
      scrollY,
      sceneProgress(domId: string): MotionValue<number> {
        const cache = sceneProgressCacheRef.current;
        let mv = cache.get(domId);
        if (!mv) {
          mv = motionValue(0);
          if (typeof window !== 'undefined') {
            mv.set(computeSceneProgress(domId));
          }
          cache.set(domId, mv);
        }
        return mv;
      },
      subscribe(cb): () => void {
        subscribersRef.current.add(cb);
        return () => {
          subscribersRef.current.delete(cb);
        };
      },
    }),
    [scrollY],
  );

  return createElement(ScrollContext.Provider, { value }, props.children);
}

/**
 * Hook returning the shared scroll source.
 *
 * In normal app trees this returns the provider's live `MotionValue`s.
 * Outside a provider (standalone scene tests, ad-hoc renders) the hook
 * degrades to a zero-valued source: the `MotionValue`s exist but never
 * change, and `subscribe` is a no-op. This matches the behaviour
 * consumers expect from `framer-motion`'s `useScroll` (which simply
 * never fires updates if it can't find a scroll target) while still
 * preserving R5.2: the fallback adds no `scroll` listeners on
 * `window` or `document`.
 */
export function useScroll(): ScrollSource {
  const ctx = useContext(ScrollContext);
  if (ctx === null) {
    return getDegradedScrollSource();
  }
  return ctx;
}

// Module-scoped fallback so every consumer outside a provider shares
// the same idle MotionValues — no per-call allocation.
let degradedScrollSource: ScrollSource | null = null;
function getDegradedScrollSource(): ScrollSource {
  if (degradedScrollSource !== null) return degradedScrollSource;
  const idleScrollY = motionValue(0);
  const idleProgress = motionValue(0);
  degradedScrollSource = {
    scrollY: idleScrollY,
    sceneProgress: () => idleProgress,
    subscribe: () => () => undefined,
  };
  return degradedScrollSource;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * Refresh every cached scene-progress `MotionValue` against the
 * current viewport. Called from the rAF flush path so it runs at most
 * once per frame.
 */
function refreshAllSceneProgress(
  cache: Map<string, MotionValue<number>>,
): void {
  if (cache.size === 0) return;
  for (const [domId, mv] of cache) {
    mv.set(computeSceneProgress(domId));
  }
}

/**
 * Compute a scene's scroll progress in [0, 1] from its
 * `getBoundingClientRect()` and the current viewport height.
 *
 *   progress = clamp((viewport - rect.top) / (viewport + rect.height), 0, 1)
 *
 * Bookends:
 *  - `rect.top === viewport` ⇒ elapsed = 0 ⇒ progress = 0
 *    (scene's top sits at the viewport bottom — about to enter).
 *  - `rect.top === -rect.height` ⇒ elapsed = viewport + rect.height
 *    ⇒ progress = 1 (scene's bottom sits at the viewport top — just
 *    exited above).
 *  - Roughly `progress = 0.5` when the scene's center crosses the
 *    viewport center.
 *
 * Returns `0` when the element is missing (SSR, scene not yet
 * mounted, typo'd `domId`) so consumers see a stable, in-bounds
 * value rather than `NaN`. `getBoundingClientRect()` is already
 * viewport-relative and reflects the current scroll, so we do not
 * need a `scrollY` argument.
 */
function computeSceneProgress(domId: string): number {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return 0;
  }
  const el = document.getElementById(domId);
  if (el === null) return 0;
  const rect = el.getBoundingClientRect();
  const viewport = window.innerHeight;
  const totalRange = viewport + rect.height;
  if (totalRange <= 0) return 0;
  const elapsed = viewport - rect.top;
  return clamp(elapsed / totalRange, 0, 1);
}

function clamp(n: number, min: number, max: number): number {
  if (n < min) return min;
  if (n > max) return max;
  return n;
}
