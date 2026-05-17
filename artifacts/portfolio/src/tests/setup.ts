/**
 * Vitest setup for `@workspace/portfolio`.
 *
 * Responsibilities:
 *   - Register `@testing-library/jest-dom` matchers on Vitest's `expect`.
 *   - Configure `fast-check` so every property-based test runs ≥ 200
 *     iterations (Requirement 19.3).
 *   - Install polyfills/stubs for browser APIs that jsdom does not implement
 *     (or implements partially) but that the cinematic-redesign code paths
 *     touch when running in the test environment (Requirement 13.1, 13.2 —
 *     reduced-motion plumbing, observer-driven scroll choreography, idle
 *     deferral of the Cinematic_Background, and the WebGL2 capability sniff).
 *
 * Polyfills are guarded with `typeof window !== 'undefined'` and only
 * installed when the API is absent, so tests that need a real implementation
 * (or that intentionally override `window.matchMedia` to simulate
 * `prefers-reduced-motion: reduce`) are not clobbered.
 *
 * Fake timers are intentionally NOT enabled globally — individual tests opt
 * in with `vi.useFakeTimers()` when they need deterministic time control.
 */

import "@testing-library/jest-dom/vitest";
import * as fc from "fast-check";
import { afterEach } from "vitest";

// ---------------------------------------------------------------------------
// fast-check global configuration (Requirement 19.3).
// ---------------------------------------------------------------------------
fc.configureGlobal({ numRuns: 200 });

// ---------------------------------------------------------------------------
// Browser API polyfills (Requirements 13.1, 13.2, plus jsdom gaps used by
// the Cinematic_Background and Motion_System code paths).
// ---------------------------------------------------------------------------
if (typeof window !== "undefined") {
  // -- matchMedia ----------------------------------------------------------
  // jsdom does not implement `matchMedia`. We install a permissive stub that
  // reports `matches: false` for every query. Tests that need
  // `prefers-reduced-motion: reduce` to evaluate true (Requirement 13.1)
  // override `window.matchMedia` themselves before mounting components.
  if (typeof window.matchMedia !== "function") {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: (query: string): MediaQueryList => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  }

  // -- IntersectionObserver ------------------------------------------------
  // The Motion_System uses IntersectionObserver to gate scene reveals. jsdom
  // does not provide one. We expose the constructor callback as a property
  // so individual tests can manually fire entries, e.g.
  //   const obs = new IntersectionObserver(cb);
  //   obs.callback([{ isIntersecting: true, ... }], obs);
  if (typeof window.IntersectionObserver === "undefined") {
    class StubIntersectionObserver implements IntersectionObserver {
      readonly root: Element | Document | null = null;
      readonly rootMargin: string = "0px";
      readonly thresholds: ReadonlyArray<number> = [0];
      callback: IntersectionObserverCallback;

      constructor(
        callback: IntersectionObserverCallback,
        options?: IntersectionObserverInit,
      ) {
        this.callback = callback;
        if (options?.root) {
          // `root` is `Element | Document | null` per spec; jsdom's typing
          // accepts `Element | null`, so we widen via assignment.
          (this as { root: Element | Document | null }).root =
            options.root as Element | Document | null;
        }
        if (typeof options?.rootMargin === "string") {
          (this as { rootMargin: string }).rootMargin = options.rootMargin;
        }
        if (options?.threshold !== undefined) {
          const t = options.threshold;
          (this as { thresholds: ReadonlyArray<number> }).thresholds =
            Array.isArray(t) ? t : [t];
        }
      }

      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
      takeRecords(): IntersectionObserverEntry[] {
        return [];
      }
    }

    Object.defineProperty(window, "IntersectionObserver", {
      configurable: true,
      writable: true,
      value: StubIntersectionObserver,
    });
    Object.defineProperty(globalThis, "IntersectionObserver", {
      configurable: true,
      writable: true,
      value: StubIntersectionObserver,
    });
  }

  // -- ResizeObserver ------------------------------------------------------
  // The Responsive_Engine reads viewport size on resize. jsdom does not
  // dispatch resize observations; a no-op stub is sufficient for tests that
  // do not assert layout reflow behaviour.
  if (typeof window.ResizeObserver === "undefined") {
    class StubResizeObserver implements ResizeObserver {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }

    Object.defineProperty(window, "ResizeObserver", {
      configurable: true,
      writable: true,
      value: StubResizeObserver,
    });
    Object.defineProperty(globalThis, "ResizeObserver", {
      configurable: true,
      writable: true,
      value: StubResizeObserver,
    });
  }

  // -- requestIdleCallback / cancelIdleCallback ----------------------------
  // The Cinematic_Background defers mount until the browser is idle. jsdom
  // does not implement this API; we approximate with `setTimeout` so tests
  // can advance time deterministically with fake timers if needed.
  if (typeof (window as Window).requestIdleCallback !== "function") {
    type IdleDeadline = {
      didTimeout: boolean;
      timeRemaining: () => number;
    };
    type IdleRequestCallback = (deadline: IdleDeadline) => void;
    type IdleRequestOptions = { timeout?: number };

    const requestIdleCallback = (
      cb: IdleRequestCallback,
      opts?: IdleRequestOptions,
    ): number => {
      return setTimeout(
        () => cb({ didTimeout: false, timeRemaining: () => 50 }),
        opts?.timeout ?? 1,
      ) as unknown as number;
    };

    const cancelIdleCallback = (id: number): void => {
      clearTimeout(id as unknown as ReturnType<typeof setTimeout>);
    };

    Object.defineProperty(window, "requestIdleCallback", {
      configurable: true,
      writable: true,
      value: requestIdleCallback,
    });
    Object.defineProperty(window, "cancelIdleCallback", {
      configurable: true,
      writable: true,
      value: cancelIdleCallback,
    });
    Object.defineProperty(globalThis, "requestIdleCallback", {
      configurable: true,
      writable: true,
      value: requestIdleCallback,
    });
    Object.defineProperty(globalThis, "cancelIdleCallback", {
      configurable: true,
      writable: true,
      value: cancelIdleCallback,
    });
  }

  // -- requestAnimationFrame ----------------------------------------------
  // jsdom 26 provides this, but older test runners do not. Polyfill only if
  // missing so we do not override jsdom's higher-fidelity implementation.
  if (typeof window.requestAnimationFrame !== "function") {
    const requestAnimationFrame = (cb: FrameRequestCallback): number => {
      return setTimeout(
        () => cb(performance.now()),
        16,
      ) as unknown as number;
    };
    const cancelAnimationFrame = (id: number): void => {
      clearTimeout(id as unknown as ReturnType<typeof setTimeout>);
    };

    Object.defineProperty(window, "requestAnimationFrame", {
      configurable: true,
      writable: true,
      value: requestAnimationFrame,
    });
    Object.defineProperty(window, "cancelAnimationFrame", {
      configurable: true,
      writable: true,
      value: cancelAnimationFrame,
    });
  }

  // -- localStorage --------------------------------------------------------
  // jsdom 26 ships a working `Storage` implementation. The polyfill below
  // only runs in unusual environments where it is absent (e.g., a custom
  // Vitest environment) and is intentionally minimal.
  if (typeof window.localStorage === "undefined") {
    const createMemoryStorage = (): Storage => {
      const store = new Map<string, string>();
      return {
        get length() {
          return store.size;
        },
        clear: () => {
          store.clear();
        },
        getItem: (key: string) =>
          store.has(key) ? (store.get(key) as string) : null,
        key: (index: number) => {
          const keys = Array.from(store.keys());
          return index >= 0 && index < keys.length ? keys[index] : null;
        },
        removeItem: (key: string) => {
          store.delete(key);
        },
        setItem: (key: string, value: string) => {
          store.set(key, String(value));
        },
      } satisfies Storage;
    };

    Object.defineProperty(window, "localStorage", {
      configurable: true,
      writable: false,
      value: createMemoryStorage(),
    });
    Object.defineProperty(window, "sessionStorage", {
      configurable: true,
      writable: false,
      value: createMemoryStorage(),
    });
  }

  // -- WebGL2RenderingContext ---------------------------------------------
  // The Cinematic_Background performs a capability sniff via
  // `instanceof WebGL2RenderingContext`. jsdom's canvas does not provide a
  // WebGL2 context (`getContext('webgl2')` returns `null`), which is the
  // correct failure mode — code under test should fall through to the
  // static fallback path. We only install a stub class so `instanceof`
  // checks compile and evaluate to `false` for the `null` context value.
  if (typeof (globalThis as { WebGL2RenderingContext?: unknown })
    .WebGL2RenderingContext === "undefined") {
    class StubWebGL2RenderingContext {}
    Object.defineProperty(globalThis, "WebGL2RenderingContext", {
      configurable: true,
      writable: true,
      value: StubWebGL2RenderingContext,
    });
    Object.defineProperty(window, "WebGL2RenderingContext", {
      configurable: true,
      writable: true,
      value: StubWebGL2RenderingContext,
    });
  }
}

// ---------------------------------------------------------------------------
// Per-test cleanup: reset web storage so tests cannot leak state via
// persisted Reduced_Motion_Mode / theme preferences (Requirement 13.2/13.3).
// ---------------------------------------------------------------------------
afterEach(() => {
  if (typeof window !== "undefined") {
    try {
      window.localStorage?.clear();
    } catch {
      // Some tests may replace `localStorage` with a stub that throws on
      // `clear()`; swallow so cleanup never fails the suite.
    }
    try {
      window.sessionStorage?.clear();
    } catch {
      // See above.
    }
  }
});
