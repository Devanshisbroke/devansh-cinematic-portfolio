/**
 * Responsive_Engine React hooks.
 *
 * The pure tier resolvers in `resolve.ts` are the contract; this
 * module is the runtime adapter that lets React components subscribe
 * to tier and pointer-coarseness transitions without each component
 * spinning up its own observer or listener.
 *
 * Sourced from `requirements.md` Requirements 12.1, 12.2, 12.5, 12.8,
 * 17.1, and `design.md` § Component architecture →
 * `responsive-engine/useBreakpoint.ts` ("React hook over
 * window.matchMedia + ResizeObserver (single instance)") and § Code
 * splitting and lazy boundaries.
 *
 * Architectural decisions:
 *
 *  1. **`matchMedia`-only, no `ResizeObserver`.** R12.1 partitions
 *     the viewport into four tiers; tier transitions happen at
 *     viewport-width boundaries that the four tier-range media
 *     queries already cover. A `ResizeObserver` would re-fire on
 *     every fractional pixel change inside a tier, producing wasted
 *     state updates that the resolver maps to the same tier value.
 *     `motion/scroll-source.ts` additionally documents itself as the
 *     sole permitted holder of a `ResizeObserver` on
 *     `document.documentElement`; not adding a second one keeps that
 *     invariant intact.
 *
 *  2. **One `matchMedia` listener per tier range, shared across
 *     hook callers.** A module-scoped `mediaState` singleton owns
 *     the four `MediaQueryList`s and their `change` handler. Every
 *     `useBreakpoint()` invocation registers a callback in a `Set`
 *     and shares the underlying handler; the listeners attach on the
 *     first subscriber and detach when the last subscriber leaves so
 *     the module never leaks a listener across an idle test or an
 *     unmounted page. A 16 ms debounce coalesces the rapid
 *     `change` storm a browser fires when the user drags the
 *     viewport boundary across a tier breakpoint.
 *
 *  3. **`useCoarsePointer()` mirrors the same singleton shape on
 *     `(pointer: coarse)`.** R12.5 requires hover-only affordances
 *     to degrade to tap or focus equivalents on touch-primary
 *     devices, and R12.8 mandates a 44×44 CSS-pixel minimum hit area
 *     on those devices. The hook lets a component flip its rendered
 *     affordance set declaratively rather than each component
 *     sniffing `matchMedia` separately.
 *
 *  4. **SSR-safe.** Both hooks resolve a sensible initial value
 *     during first render (`'desktop'` for breakpoint; `false` for
 *     coarse pointer) when `window` is absent, then subscribe inside
 *     `useEffect` so hydration flips to the live value without a
 *     mismatch.
 *
 * Validates: Requirements 12.1, 12.2, 12.5, 12.8, 17.1
 */

import { useEffect, useState } from 'react';
import type { Breakpoint } from './types';
import { resolveBreakpoint, resolveLayoutTier } from './resolve';
import type { LayoutTier } from './types';

// ---------------------------------------------------------------------------
// Tier-range media queries (R12.1)
// ---------------------------------------------------------------------------
//
// One query per tier, partitioning the viewport-width axis into the
// same contiguous ranges that `resolveBreakpoint(width)` partitions
// numerically. We only need to listen on the three boundary
// transitions (mobile↔tablet, tablet↔desktop, desktop↔ultrawide), but
// listening on every range query keeps the module's contract
// symmetric and lets the handler use `window.innerWidth` (single
// source of truth) instead of consulting `MediaQueryList.matches`.

const TIER_QUERIES: readonly string[] = [
  '(max-width: 767px)',
  '(min-width: 768px) and (max-width: 1023px)',
  '(min-width: 1024px) and (max-width: 1919px)',
  '(min-width: 1920px)',
] as const;

// Default for SSR / non-browser callers. `desktop` is the most common
// viewport bucket on the public web and matches `LayoutTier`'s
// twelve-column default, so server-rendered markup hydrates with a
// reasonable layout instead of `mobile`'s single column.
const SSR_DEFAULT_TIER: Breakpoint = 'desktop';

// 16 ms ≈ one animation frame at 60 Hz. R5.4 forbids layout-affecting
// updates at scroll/pointer cadence; debouncing tier transitions to
// one frame keeps `useBreakpoint()` consumers from re-rendering more
// than 60 times per second under a drag-resize storm.
const DEBOUNCE_MS = 16;

// ---------------------------------------------------------------------------
// Module-scoped breakpoint singleton (R17.1)
// ---------------------------------------------------------------------------
//
// All four `MediaQueryList`s, their shared `change` handler, the
// debounce timer, and the cached current tier live here. `subscribe`
// lazy-attaches on the first subscriber and `detach`s when the last
// subscriber unsubscribes, so the module never holds onto listeners
// across an unmounted page in long-lived test environments.

type BreakpointListener = (bp: Breakpoint) => void;

interface MediaState {
  mqls: readonly MediaQueryList[];
  detach: () => void;
}

let breakpointMediaState: MediaState | null = null;
const breakpointListeners = new Set<BreakpointListener>();
let cachedBreakpoint: Breakpoint | null = null;
let breakpointDebounceTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Read the live tier from `window.innerWidth` via the pure resolver.
 * Falls back to the SSR default outside the browser. Used both for
 * the initial cached value when the singleton attaches and for every
 * subsequent debounced re-evaluation.
 */
function readCurrentBreakpoint(): Breakpoint {
  if (typeof window === 'undefined') return SSR_DEFAULT_TIER;
  return resolveBreakpoint(window.innerWidth);
}

/**
 * Lazily attach the four `matchMedia` listeners. No-op on subsequent
 * calls, on the server, and on environments without `matchMedia`
 * (the hook will simply return its initial value, which is the
 * correct degradation path).
 */
function attachBreakpointMediaState(): void {
  if (breakpointMediaState !== null) return;
  if (typeof window === 'undefined') return;
  if (typeof window.matchMedia !== 'function') return;

  const mqls = TIER_QUERIES.map((q) => window.matchMedia(q));
  cachedBreakpoint = readCurrentBreakpoint();

  // The shared `change` handler. Browsers fire `change` on every
  // boundary-crossing media query during a drag-resize burst; we
  // collapse that into at most one update per 16 ms frame and one
  // notification per *actual* tier transition (cached compare).
  const onChange = (): void => {
    if (breakpointDebounceTimer !== null) return;
    breakpointDebounceTimer = setTimeout(() => {
      breakpointDebounceTimer = null;
      const next = readCurrentBreakpoint();
      if (next === cachedBreakpoint) return;
      cachedBreakpoint = next;
      // Snapshot listeners to a local array first so a callback that
      // unsubscribes itself doesn't skip a sibling listener mid-pass.
      for (const cb of Array.from(breakpointListeners)) {
        cb(next);
      }
    }, DEBOUNCE_MS);
  };

  for (const mql of mqls) {
    mql.addEventListener('change', onChange);
  }

  breakpointMediaState = {
    mqls,
    detach: () => {
      for (const mql of mqls) {
        mql.removeEventListener('change', onChange);
      }
      if (breakpointDebounceTimer !== null) {
        clearTimeout(breakpointDebounceTimer);
        breakpointDebounceTimer = null;
      }
      cachedBreakpoint = null;
    },
  };
}

/**
 * Subscribe to tier-transition notifications. Returns an unsubscribe
 * function; the singleton detaches its `matchMedia` listeners as
 * soon as the last subscriber leaves.
 */
function subscribeToBreakpoint(cb: BreakpointListener): () => void {
  attachBreakpointMediaState();
  breakpointListeners.add(cb);
  return () => {
    breakpointListeners.delete(cb);
    if (breakpointListeners.size === 0 && breakpointMediaState !== null) {
      breakpointMediaState.detach();
      breakpointMediaState = null;
    }
  };
}

// ---------------------------------------------------------------------------
// useBreakpoint hook (R12.1, R12.2, R17.1)
// ---------------------------------------------------------------------------

/**
 * React hook returning the current Breakpoint_Tier.
 *
 * Subscribes to the module-scoped singleton, so an arbitrary number
 * of components calling `useBreakpoint()` share a single set of
 * `matchMedia` listeners (one per tier range, four total). The
 * returned value updates only when the resolver maps to a *different*
 * tier — same-tier viewport changes do not re-render consumers.
 *
 * SSR: returns `SSR_DEFAULT_TIER` (`'desktop'`) during first render
 * when `window` is absent, then settles to the live value on the
 * post-mount effect pass.
 *
 * @returns The current Breakpoint_Tier name.
 */
export function useBreakpoint(): Breakpoint {
  // Initial value is computed lazily so the resolver runs at most
  // once per consumer mount. Using a function form of `useState`
  // avoids re-computing on every render.
  const [bp, setBp] = useState<Breakpoint>(() => readCurrentBreakpoint());

  useEffect(() => {
    // Reconcile to the live value on mount in case the initial render
    // happened on the server (where `window.innerWidth` is unavailable
    // and we fell back to `SSR_DEFAULT_TIER`).
    const live = readCurrentBreakpoint();
    setBp((prev) => (prev === live ? prev : live));

    return subscribeToBreakpoint((next) => {
      setBp((prev) => (prev === next ? prev : next));
    });
  }, []);

  return bp;
}

// ---------------------------------------------------------------------------
// useLayoutTier hook (Property 7)
// ---------------------------------------------------------------------------

/**
 * React hook returning the current `LayoutTier` payload.
 *
 * Composed on top of `useBreakpoint()`, so it inherits the singleton
 * subscription and never adds its own listener. Property 7 (deep-
 * equal idempotence within a tier) is preserved by reference:
 * `resolveLayoutTier` returns the same module-scoped constant for
 * any width in the same tier.
 *
 * Implemented as a switch on the tier name (rather than a fresh
 * `resolveLayoutTier(window.innerWidth)` call) so a future code
 * path that reads `useLayoutTier()` without a live `window` still
 * gets a consistent value via the SSR-default tier.
 */
export function useLayoutTier(): LayoutTier {
  const bp = useBreakpoint();
  return layoutTierForBreakpoint(bp);
}

/**
 * Map a `Breakpoint` to its representative width and resolve the
 * layout tier. We pick a width strictly inside each tier's range so
 * the resolver returns the canonical `LayoutTier` constant for that
 * tier without depending on the exact partition boundaries.
 */
function layoutTierForBreakpoint(bp: Breakpoint): LayoutTier {
  switch (bp) {
    case 'mobile':
      return resolveLayoutTier(400);
    case 'tablet':
      return resolveLayoutTier(900);
    case 'desktop':
      return resolveLayoutTier(1440);
    case 'ultrawide':
      return resolveLayoutTier(2400);
  }
}

// ---------------------------------------------------------------------------
// Coarse-pointer singleton (R12.5)
// ---------------------------------------------------------------------------
//
// Mirrors the breakpoint singleton's shape but on a single
// `MediaQueryList` (`(pointer: coarse)`). One module-scoped listener
// drives every `useCoarsePointer()` consumer.

type CoarsePointerListener = (coarse: boolean) => void;

let coarseMediaState: { mql: MediaQueryList; detach: () => void } | null = null;
const coarseListeners = new Set<CoarsePointerListener>();
let cachedCoarse: boolean | null = null;

const COARSE_QUERY = '(pointer: coarse)';

/**
 * Read the live coarse-pointer flag from the `MediaQueryList`. Falls
 * back to `false` (fine pointer) when `matchMedia` is unavailable or
 * we are outside the browser — the safer assumption for SSR is that
 * hover affordances *are* meaningful, since stripping them on a
 * desktop hydration mismatch degrades the experience.
 */
function readCurrentCoarse(): boolean {
  if (typeof window === 'undefined') return false;
  if (typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(COARSE_QUERY).matches;
}

function attachCoarseMediaState(): void {
  if (coarseMediaState !== null) return;
  if (typeof window === 'undefined') return;
  if (typeof window.matchMedia !== 'function') return;

  const mql = window.matchMedia(COARSE_QUERY);
  cachedCoarse = mql.matches;

  const onChange = (): void => {
    const next = mql.matches;
    if (next === cachedCoarse) return;
    cachedCoarse = next;
    for (const cb of Array.from(coarseListeners)) {
      cb(next);
    }
  };

  mql.addEventListener('change', onChange);

  coarseMediaState = {
    mql,
    detach: () => {
      mql.removeEventListener('change', onChange);
      cachedCoarse = null;
    },
  };
}

function subscribeToCoarse(cb: CoarsePointerListener): () => void {
  attachCoarseMediaState();
  coarseListeners.add(cb);
  return () => {
    coarseListeners.delete(cb);
    if (coarseListeners.size === 0 && coarseMediaState !== null) {
      coarseMediaState.detach();
      coarseMediaState = null;
    }
  };
}

// ---------------------------------------------------------------------------
// useCoarsePointer hook (R12.5)
// ---------------------------------------------------------------------------

/**
 * React hook returning `true` when the device's primary pointer is
 * coarse (touch / stylus without hover precision), `false` otherwise.
 *
 * R12.5 requires hover-only affordances — magnetic CTAs, hover-reveal
 * project chrome, parallax preview tilts — to degrade to tap or
 * focus equivalents on coarse-pointer devices. Components consuming
 * this hook should choose between hover-vs-tap variants
 * declaratively rather than each one calling `matchMedia` directly.
 *
 * The hook shares one module-scoped `(pointer: coarse)`
 * `MediaQueryList` and one shared `change` handler across every
 * consumer; the underlying listener attaches on the first subscriber
 * and detaches when the last subscriber unsubscribes.
 *
 * SSR: returns `false` during first render when `window` is absent,
 * then settles to the live value on the post-mount effect pass.
 *
 * @returns `true` if `(pointer: coarse)` matches, otherwise `false`.
 */
export function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState<boolean>(() => readCurrentCoarse());

  useEffect(() => {
    const live = readCurrentCoarse();
    setCoarse((prev) => (prev === live ? prev : live));

    return subscribeToCoarse((next) => {
      setCoarse((prev) => (prev === next ? prev : next));
    });
  }, []);

  return coarse;
}
