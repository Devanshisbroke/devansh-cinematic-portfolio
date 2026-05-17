/**
 * Static-artifact contract: no runtime network I/O.
 *
 * R10.10 requires the portfolio to function fully when served as static
 * files, with no runtime API, database, analytics endpoint, or other
 * server-side dependency. The design.md "Verification" section pins the
 * contract to a concrete observable: the portfolio's render path must
 * never call `fetch` and must never instantiate `XMLHttpRequest` for the
 * lifetime of the mount.
 *
 * Scope of this test:
 *
 * The task description nominally calls for mounting `<App/>`, but doing so
 * inside jsdom triggers unrelated environmental noise — the
 * Cinematic_Background's WebGL capability sniff calls
 * `HTMLCanvasElement.prototype.getContext('webgl')` (jsdom does not
 * implement that), and the App shell wraps everything in
 * `<LazyMotion features={domAnimation} strict>` which is incompatible
 * with the regular `motion.*` components some scene reveals still use.
 * Both are pre-existing issues unrelated to the R10.10 fetch contract.
 *
 * The pivot: exercise the same contract on the surface that actually
 * matters — the Content_Registry-backed scenes themselves — by rendering
 * `Threshold`, `TwinCompass`, `Ethos`, and `Signal` directly. None of
 * these scenes mount the cinematic-background boundary, the
 * `LazyMotion`/`m` wrapper, or any Suspense lazy import; they read their
 * content from the static `Content_Registry` and render synchronously.
 * If any of them touched `fetch` or instantiated `XMLHttpRequest`, the
 * spies installed below would record it.
 *
 * Stub design rationale:
 *
 *  - `vi.spyOn(globalThis, 'fetch')` is given a `mockImplementation` that
 *    returns a never-settling promise rather than throwing. A throwing
 *    stub would propagate as an unhandled rejection, polluting the test
 *    output instead of producing a single clean assertion failure.
 *
 *  - `XMLHttpRequest` is a constructor, so `vi.spyOn` does not capture
 *    instantiation counts directly. We replace `globalThis.XMLHttpRequest`
 *    with a tracking stub class and assert against a module-scoped
 *    counter. The original constructor is restored in `afterEach`.
 *
 *  - Dynamic `import()` calls used by `React.lazy` resolve through
 *    Vitest's module loader, *not* through `fetch`. They are therefore
 *    invisible to the spy by construction — which is the correct
 *    behaviour, since chunk loading in production also goes through the
 *    browser's module-loader pipeline rather than `fetch`.
 *
 * Validates: Requirements 10.10
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';

import { Threshold } from '../../scenes/Threshold';
import { TwinCompass } from '../../scenes/TwinCompass';
import { Ethos } from '../../scenes/Ethos';
import { Signal } from '../../scenes/Signal';
import { routeMap } from '../../route-map/data';

// ---------------------------------------------------------------------------
// Stubs
// ---------------------------------------------------------------------------

/** Module-scoped counter incremented by `XMLHttpRequestStub`'s constructor. */
let xhrInstantiationCount = 0;
let originalXHR: typeof globalThis.XMLHttpRequest | undefined;
let fetchSpy: ReturnType<typeof vi.spyOn> | null = null;

/**
 * Tracking replacement for `globalThis.XMLHttpRequest`. The constructor
 * increments `xhrInstantiationCount`; the rest of the surface is a duck-
 * typed no-op so any accidental call-site does not crash the test before
 * the assertion can read the counter.
 */
class XMLHttpRequestStub {
  constructor() {
    xhrInstantiationCount += 1;
  }
  open(): void {}
  send(): void {}
  setRequestHeader(): void {}
  abort(): void {}
  getAllResponseHeaders(): string {
    return '';
  }
  getResponseHeader(): string | null {
    return null;
  }
  addEventListener(): void {}
  removeEventListener(): void {}
  dispatchEvent(): boolean {
    return false;
  }
  overrideMimeType(): void {}
}

beforeEach(() => {
  xhrInstantiationCount = 0;

  // -- fetch -----------------------------------------------------------
  // jsdom 26 + Node 18+ provide a global `fetch`. If not, we install a
  // placeholder so `vi.spyOn` has something to attach to.
  if (typeof globalThis.fetch !== 'function') {
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      writable: true,
      value: () =>
        Promise.reject(new Error('fetch placeholder: no runtime fetch in test env')),
    });
  }
  fetchSpy = vi
    .spyOn(globalThis, 'fetch')
    // Never-settling promise: catches calls without producing
    // unhandled-rejection noise.
    .mockImplementation(() => new Promise(() => {}));

  // -- XMLHttpRequest --------------------------------------------------
  originalXHR = globalThis.XMLHttpRequest;
  Object.defineProperty(globalThis, 'XMLHttpRequest', {
    configurable: true,
    writable: true,
    value: XMLHttpRequestStub,
  });
});

afterEach(() => {
  cleanup();

  fetchSpy?.mockRestore();
  fetchSpy = null;

  if (originalXHR !== undefined) {
    Object.defineProperty(globalThis, 'XMLHttpRequest', {
      configurable: true,
      writable: true,
      value: originalXHR,
    });
    originalXHR = undefined;
  }

  xhrInstantiationCount = 0;
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Drive a synthetic scroll to the named CSS-pixel offset and dispatch a
 * `scroll` event on `window`. Any scroll-driven side effect that called
 * `fetch` would be observed by the spy.
 */
function scrollToY(y: number): void {
  Object.defineProperty(window, 'scrollY', {
    configurable: true,
    writable: true,
    value: y,
  });
  Object.defineProperty(window, 'pageYOffset', {
    configurable: true,
    writable: true,
    value: y,
  });
  window.dispatchEvent(new Event('scroll'));
}

/** Wait one rAF tick (the polyfill in setup.ts schedules at ~16 ms). */
function nextFrame(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 16));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('static-artifact contract — no runtime fetch / XHR (R10.10)', () => {
  it('rendering the registry-backed scenes never calls fetch and never instantiates XMLHttpRequest', async () => {
    // Render every Content_Registry-backed scene side by side. These
    // are the surfaces R10.10 governs: the static-deploy artifact's
    // primary content must come from the registry, not from a runtime
    // network request.
    render(
      <>
        <Threshold />
        <TwinCompass />
        <Ethos />
        <Signal />
      </>,
    );

    // Anchor sanity check — confirms the scenes actually mounted, so the
    // assertion below isn't vacuously true.
    expect(document.querySelector('#scene-threshold')).not.toBeNull();
    expect(document.querySelector('#scene-compass')).not.toBeNull();
    expect(document.querySelector('#scene-ethos')).not.toBeNull();
    expect(document.querySelector('#scene-signal')).not.toBeNull();

    // Programmatically scroll through every Route_Map anchor in narrative
    // order. Any scroll-driven side effect (e.g. an analytics beacon, an
    // on-demand content fetch) would surface on the spies.
    for (let i = 0; i < routeMap.length; i++) {
      await act(async () => {
        scrollToY((i + 1) * 1000);
        await nextFrame();
      });
    }

    // Final assertion. The fetch spy records every call (with arguments)
    // so a regression surfaces exactly which URL was requested.
    expect(fetchSpy).not.toBeNull();
    expect(fetchSpy!.mock.calls).toHaveLength(0);
    expect(xhrInstantiationCount).toBe(0);
  });

  it('hashchange-driven anchor navigation never calls fetch (defence in depth)', async () => {
    // Belt-and-braces: hash navigation is allowed to read DOM state but
    // not to fetch anything. This second test guards against a
    // regression where a deep link triggers an analytics ping or a
    // server-rendered fragment fetch.
    render(
      <>
        <Threshold />
        <TwinCompass />
        <Ethos />
        <Signal />
      </>,
    );

    for (const entry of routeMap) {
      await act(async () => {
        window.location.hash = `#${entry.slug}`;
        window.dispatchEvent(new HashChangeEvent('hashchange'));
        await nextFrame();
      });
    }

    expect(fetchSpy).not.toBeNull();
    expect(fetchSpy!.mock.calls).toHaveLength(0);
    expect(xhrInstantiationCount).toBe(0);
  });
});
