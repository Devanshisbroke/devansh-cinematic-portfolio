/**
 * Hash-driven deep-link router and scroll-spy.
 *
 * Validates: Requirements 5.2, 6.6, 6.7, 14.2, 14.3, 14.4, 14.5, 14.6
 *
 * Two responsibilities, one module:
 *
 *  1. **Inbound deep links** (R6.6, R14.2-14.5). On mount and on every
 *     `hashchange` event, the router resolves `window.location.hash` against
 *     the canonical Route_Map. A known slug scrolls the matching DOM section
 *     so its top edge sits inside a ±2 px tolerance below any sticky header
 *     (read live from `[data-sticky-header]`). Smooth-scroll completes within
 *     800 ms by default; when Reduced_Motion_Mode is active the router uses
 *     `behavior: 'auto'` so the jump is instant (≤ 50 ms — single sync write
 *     per R14.3). An unknown slug falls back to the opening scene's `domId`
 *     and surfaces a non-blocking 4-second `[role="status"]` toast
 *     `"That section was not found."`. The toast is dismissable with Escape
 *     and never unloads the document (R6.7, R14.5).
 *
 *  2. **Outbound scroll-spy** (R5.2, R14.6). The router subscribes to the
 *     single shared scroll source exposed by `motion/scroll-source.ts`. R5.2
 *     forbids any module other than `scroll-source.ts` from registering a
 *     `scroll` listener on `window` or `document`, so the router *must* go
 *     through the provider's `subscribe(cb)` API. On every coalesced scroll
 *     sample, a trailing-edge timer throttles updates to at most one every
 *     250 ms (≤ 4 updates/sec — R14.6). When a Route_Map scene occupies the
 *     largest visible viewport area *and* covers at least 50 % of the
 *     viewport height, the router calls `history.replaceState` to update the
 *     hash without producing a back-stack entry.
 *
 * The module ships two public exports:
 *
 *  - `useHashRouter()` — a React hook that wires the listeners on mount
 *    and returns `{ notFoundActive, dismissNotFound }` for the toast UI.
 *    The hook reads from `<ScrollSourceProvider>` (it calls `useScroll()`),
 *    so the App shell must mount the provider above any consumer of this
 *    hook. There is no fallback path — that asymmetry is intentional;
 *    silently dropping scroll-spy would produce a stale URL hash.
 *
 *  - `<HashNotFoundToast>` — a tiny presentational component that renders
 *    nothing when inactive and a single `[role="status"]` node when active.
 *    Kept as a sibling export rather than baked into the hook so consumers
 *    can place the toast anywhere in the tree (typically next to the App
 *    landmark).
 */

import {
  createElement,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { routeMap } from './data';
import { createRouteLookup } from './lookup';
import { useScroll } from '../motion/scroll-source';
import { readReducedMotion } from '../accessibility/reduced-motion-store';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Trailing-edge throttle window for scroll-spy `history.replaceState` calls.
 * 1000 ms / 250 ms = 4 updates/sec, the upper bound R14.6 allows.
 */
const SCROLL_SPY_MIN_INTERVAL_MS = 250;

/**
 * Lifetime of the not-found toast. R6.7 / R14.5 specify exactly 4 seconds.
 */
const NOT_FOUND_TOAST_DURATION_MS = 4000;

/**
 * Minimum fraction of viewport height a scene must cover to be considered
 * "active" for scroll-spy. R14.6 names 50 %.
 */
const ACTIVE_SCENE_VIEWPORT_FRACTION = 0.5;

/**
 * Module-scoped lookup. The route-map is immutable and module-scoped, so the
 * lookup index can be built once and reused across every hook mount. This
 * avoids paying the linear-scan cost on every hash navigation.
 */
const lookup = createRouteLookup(routeMap);

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Read the current sticky-header height in CSS pixels.
 *
 * The header is identified by the `[data-sticky-header]` attribute so the
 * router stays decoupled from the eventual header component file path. If no
 * sticky header is mounted (e.g. during the Above_The_Fold-only Threshold
 * scene), the function returns 0 and the deep-link target lands at the
 * literal viewport top — still inside the ±2 px tolerance of R14.4.
 */
function getStickyHeaderHeight(): number {
  if (typeof document === 'undefined') return 0;
  const header = document.querySelector<HTMLElement>('[data-sticky-header]');
  if (header === null) return 0;
  return header.getBoundingClientRect().height;
}

/**
 * Scroll the document so the named DOM element's top edge aligns with the
 * bottom of any sticky header.
 *
 * Math: `el.getBoundingClientRect().top` is the element's top relative to
 * the current viewport. Adding `window.scrollY` lifts that into the document
 * coordinate space. Subtracting the sticky header's height shifts the target
 * down by exactly the header's footprint, so after the scroll the element's
 * top edge sits at `headerHeight` from the viewport top — i.e. flush with
 * the bottom edge of the header (R14.4).
 *
 * The `instant` parameter switches between R14.2 (smooth, ≤ 800 ms — provided
 * by the browser's native smooth-scroll algorithm) and R14.3 (synchronous
 * jump, ≤ 50 ms — a single non-animated write to `scrollY`).
 */
function scrollToDomId(domId: string, instant: boolean): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  const el = document.getElementById(domId);
  if (el === null) return;
  const headerOffset = getStickyHeaderHeight();
  const targetTop = el.getBoundingClientRect().top + window.scrollY - headerOffset;
  window.scrollTo({
    top: targetTop,
    behavior: instant ? 'auto' : 'smooth',
  });
}

/**
 * Pick the Route_Map entry whose DOM section currently owns the viewport.
 *
 * A scene "owns" the viewport when its visible vertical extent is the
 * largest among all candidates *and* covers at least 50 % of the viewport
 * height (R14.6). Scenes with insufficient visible extent are ignored, so
 * the URL hash does not flicker between two adjacent scenes during long
 * margins or transitions.
 *
 * Returns `undefined` when no scene meets the threshold (e.g. very tall
 * single scene with viewport entirely inside it — vacuously the scene
 * itself wins; the multi-scene rare case where every scene's visible
 * area falls short is the documented null result).
 *
 * O(n) over the (≤ 1000) Route_Map entries, called at most 4×/sec via the
 * trailing-edge throttle below.
 */
function findActiveSceneDomId(): string | undefined {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return undefined;
  }
  const viewport = window.innerHeight;
  const minVisible = viewport * ACTIVE_SCENE_VIEWPORT_FRACTION;
  let bestDomId: string | undefined;
  let bestVisibleArea = 0;
  for (const entry of routeMap) {
    const el = document.getElementById(entry.domId);
    if (el === null) continue;
    const rect = el.getBoundingClientRect();
    const top = Math.max(0, rect.top);
    const bottom = Math.min(viewport, rect.bottom);
    const visible = Math.max(0, bottom - top);
    if (visible >= minVisible && visible > bestVisibleArea) {
      bestVisibleArea = visible;
      bestDomId = entry.domId;
    }
  }
  return bestDomId;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseHashRouterResult {
  /**
   * `true` while the not-found toast is visible. Flips back to `false` after
   * the 4-second timeout or on Escape / explicit dismiss.
   */
  readonly notFoundActive: boolean;
  /**
   * Imperative dismiss for the not-found toast. Idempotent — calling it
   * while the toast is already inactive is a no-op. Stable across renders.
   */
  readonly dismissNotFound: () => void;
}

/**
 * Wire deep-link routing and scroll-spy for the lifetime of the host
 * component. Mount this hook *exactly once* in the App shell — typically in
 * the same component that renders the `[role="main"]` landmark and the
 * `<HashNotFoundToast>` sibling.
 */
export function useHashRouter(): UseHashRouterResult {
  const [notFoundActive, setNotFoundActive] = useState(false);

  // Mutable refs for timers — assigning to a ref does not trigger a re-render.
  const notFoundTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollSpyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Last slug we wrote to `history.replaceState`. Tracked so we don't churn
  // the back-forward cache with redundant writes when the user lingers
  // inside a single scene over many scroll samples.
  const lastReplacedSlugRef = useRef<string>('');

  // Single shared scroll source. Throws if the provider is missing — that
  // failure is surfaced eagerly because a missing provider would silently
  // disable scroll-spy and leave the URL hash stale.
  const scrollSource = useScroll();

  const dismissNotFound = useCallback((): void => {
    setNotFoundActive(false);
    if (notFoundTimerRef.current !== null) {
      clearTimeout(notFoundTimerRef.current);
      notFoundTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    /**
     * Resolve a raw hash string against the Route_Map and either scroll to
     * the target scene or fall back to the opening scene plus toast.
     *
     * Closed over `setNotFoundActive` and the timer ref; both are stable
     * across renders so the effect can register listeners that reuse this
     * function for the entire mount lifetime.
     */
    const resolveAndScroll = (rawHash: string): void => {
      const slug = rawHash.startsWith('#') ? rawHash.slice(1) : rawHash;
      if (slug.length === 0) return;
      const domId = lookup.idFromSlug(slug);
      const reducedMotion = readReducedMotion();
      if (domId !== undefined) {
        scrollToDomId(domId, reducedMotion);
        return;
      }
      // Unknown hash — R6.7 / R14.5: scroll to opening scene, surface a
      // non-blocking toast, never unload the document.
      const opening = lookup.entryByRole('opening');
      if (opening !== undefined) {
        scrollToDomId(opening.domId, reducedMotion);
      }
      setNotFoundActive(true);
      if (notFoundTimerRef.current !== null) {
        clearTimeout(notFoundTimerRef.current);
      }
      notFoundTimerRef.current = setTimeout(() => {
        setNotFoundActive(false);
        notFoundTimerRef.current = null;
      }, NOT_FOUND_TOAST_DURATION_MS);
    };

    // Initial-mount handling. The hook runs after the App shell's children
    // have mounted (effects fire in child-then-parent order, but the App
    // shell mounts the lazy scenes itself, so by the time this effect runs
    // every Route_Map domId is in the DOM). For SSR / pre-render there is
    // no `window`, so the early-return above guards us.
    if (window.location.hash.length > 0) {
      resolveAndScroll(window.location.hash);
    }

    const onHashChange = (): void => {
      resolveAndScroll(window.location.hash);
    };
    window.addEventListener('hashchange', onHashChange);

    // Escape-to-dismiss for the not-found toast. The handler reads the
    // refs and state setter directly so it does not need to be re-bound
    // when `dismissNotFound`'s identity changes.
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setNotFoundActive(false);
        if (notFoundTimerRef.current !== null) {
          clearTimeout(notFoundTimerRef.current);
          notFoundTimerRef.current = null;
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);

    // Scroll-spy via the shared scroll source. The provider already
    // coalesces native scroll events to one rAF-aligned sample per frame,
    // so this callback fires at most ~60×/sec; the trailing-edge timer
    // below throttles `history.replaceState` calls to ≤ 4×/sec (R14.6).
    //
    // Note: subscribing here adds zero `scroll` listeners to `window` —
    // R5.2 invariant preserved.
    const unsubscribeScroll = scrollSource.subscribe(() => {
      if (scrollSpyTimerRef.current !== null) return;
      scrollSpyTimerRef.current = setTimeout(() => {
        scrollSpyTimerRef.current = null;
        const activeDomId = findActiveSceneDomId();
        if (activeDomId === undefined) return;
        const slug = lookup.slugFromId(activeDomId);
        if (slug === undefined) return;
        if (slug === lastReplacedSlugRef.current) return;
        lastReplacedSlugRef.current = slug;
        const newHash = `#${slug}`;
        if (window.location.hash !== newHash) {
          // `replaceState` rather than `assign`/`pushState`: scroll-spy
          // reflects the current view but should not produce a back-stack
          // entry per scene. The user's actual navigation history stays
          // tied to deliberate clicks.
          window.history.replaceState(null, '', newHash);
        }
      }, SCROLL_SPY_MIN_INTERVAL_MS);
    });

    return () => {
      window.removeEventListener('hashchange', onHashChange);
      window.removeEventListener('keydown', onKeyDown);
      unsubscribeScroll();
      if (notFoundTimerRef.current !== null) {
        clearTimeout(notFoundTimerRef.current);
        notFoundTimerRef.current = null;
      }
      if (scrollSpyTimerRef.current !== null) {
        clearTimeout(scrollSpyTimerRef.current);
        scrollSpyTimerRef.current = null;
      }
    };
  }, [scrollSource]);

  return { notFoundActive, dismissNotFound };
}

// ---------------------------------------------------------------------------
// Toast component
// ---------------------------------------------------------------------------

export interface HashNotFoundToastProps {
  /** Mirror of `useHashRouter().notFoundActive`. */
  readonly active: boolean;
  /** Mirror of `useHashRouter().dismissNotFound`. */
  readonly onDismiss: () => void;
}

/**
 * Non-blocking 4-second status indicator surfaced when an unknown hash is
 * navigated to. Renders nothing when `active === false` so the toast adds
 * zero DOM weight outside its visible window.
 *
 * Marked with `role="status"` and `aria-live="polite"` so assistive
 * technologies announce the message without interrupting the user. Click
 * anywhere on the toast to dismiss; the keyboard Escape path is wired by
 * `useHashRouter`'s global key listener so the toast itself does not need
 * to be focused for Escape to dismiss it.
 *
 * Intentionally rendered without JSX so this file can stay a `.ts`
 * (matching the task's filename specification). `createElement` produces
 * exactly the same React node a JSX expression would.
 */
export function HashNotFoundToast(props: HashNotFoundToastProps): ReactNode {
  if (!props.active) return null;
  return createElement(
    'div',
    {
      role: 'status',
      'aria-live': 'polite',
      className: 'hash-not-found-toast',
      onClick: props.onDismiss,
      style: {
        position: 'fixed',
        right: 'var(--space-4)',
        bottom: 'var(--space-4)',
        padding: 'var(--space-3) var(--space-4)',
        background: 'var(--surface-elevated-1)',
        color: 'var(--neutral-50)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-medium)',
        zIndex: 100,
        cursor: 'pointer',
        maxWidth: '32ch',
        fontSize: 'var(--font-size-small, 0.875rem)',
      },
    },
    'That section was not found.',
  );
}
