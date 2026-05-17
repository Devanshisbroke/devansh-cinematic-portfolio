/**
 * Hash-routing DOM smoke tests for `useHashRouter()` + `<HashNotFoundToast/>`.
 *
 * Validates: Requirements 6.7, 14.2, 14.3, 14.4, 14.5
 *
 * Rather than booting the full `<App/>` shell (which lazy-loads four scenes
 * plus the cinematic background, and is exercised end-to-end in
 * `no-runtime-fetch.test.tsx`), this suite mounts a minimal harness:
 *
 *   <ScrollSourceProvider>
 *     <section id="scene-threshold" .../>
 *     <section id="scene-compass"   .../>
 *     <section id="scene-work"      .../>
 *     <section id="scene-ethos"     .../>
 *     <section id="scene-signal"    .../>
 *     <HashNotFoundToast .../>
 *   </ScrollSourceProvider>
 *
 * with a sibling component that wires `useHashRouter()`. That keeps the
 * test focused on the routing contract (deep-link scroll, unknown-hash
 * fallback, reduced-motion instant jump) without the noise of unrelated
 * scenes.
 *
 * Two test-environment notes:
 *
 *  1. jsdom does not implement `window.scrollTo`; calling it logs a
 *     `Not implemented` warning to stderr. Every test in this file
 *     installs a `vi.spyOn(window, 'scrollTo')` no-op stub so the spy
 *     captures the call's `behavior` option (R14.2 / R14.3) and the
 *     stderr stays clean.
 *
 *  2. Fake timers are enabled *only* in the auto-dismiss test that
 *     advances the toast's 4-second timeout. Faking `setTimeout`
 *     globally would break `findByRole` / `waitFor` (Testing Library's
 *     poll loop relies on real `setTimeout`). Each test that needs
 *     deterministic time control opts in locally.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  render,
  screen,
  cleanup,
  waitFor,
  act,
} from '@testing-library/react';
import { ScrollSourceProvider } from '../../motion/scroll-source';
import { useHashRouter, HashNotFoundToast } from '../../route-map/hash-router';
import { routeMap } from '../../route-map/data';

const REDUCED_MOTION_KEY = 'pcr.reduced-motion';

function HashRouterHarness() {
  const { notFoundActive, dismissNotFound } = useHashRouter();
  return (
    <>
      {routeMap.map((entry) => (
        <section
          key={entry.slug}
          id={entry.domId}
          aria-labelledby={`${entry.domId}-h2`}
          style={{ minHeight: '500px' }}
          data-testid={`section-${entry.slug}`}
        >
          <h2 id={`${entry.domId}-h2`}>{entry.slug}</h2>
        </section>
      ))}
      <HashNotFoundToast active={notFoundActive} onDismiss={dismissNotFound} />
    </>
  );
}

function renderHarness() {
  return render(
    <ScrollSourceProvider>
      <HashRouterHarness />
    </ScrollSourceProvider>,
  );
}

let scrollToSpy: ReturnType<typeof vi.spyOn> | null = null;

beforeEach(() => {
  // Reset hash + storage so each test starts from a clean slate.
  window.history.replaceState(null, '', '#');
  localStorage.clear();
  // jsdom does not implement scrollTo. Stubbing per-test (a) silences
  // the "Not implemented" stderr noise and (b) lets tests assert on
  // the call's `behavior` option (R14.2 / R14.3).
  scrollToSpy = vi
    .spyOn(window, 'scrollTo')
    .mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  scrollToSpy?.mockRestore();
  scrollToSpy = null;
  // Defensive: any test that opted into fake timers must restore them
  // before the next test runs. `useRealTimers` is a no-op when timers
  // are already real.
  vi.useRealTimers();
});

describe('Hash routing', () => {
  // Validates: Requirements 6.7, 14.2, 14.3, 14.4, 14.5

  it('initial mount with no hash does not trigger toast', () => {
    renderHarness();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('unknown hash surfaces non-blocking toast (R6.7, R14.5)', async () => {
    window.history.replaceState(null, '', '#nonexistent');
    renderHarness();

    const toast = await screen.findByRole('status');
    expect(toast).toBeInTheDocument();
    expect(toast.textContent).toMatch(/not found/i);
  });

  it('toast auto-dismisses after the 4-second window (R14.5)', async () => {
    // Switch to fake timers *only* for this test — the dismiss timeout
    // is 4 s of wall time, which we advance synchronously.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      window.history.replaceState(null, '', '#nonexistent');
      renderHarness();

      // Effects flush during render under React 19's act semantics, so
      // the toast is already mounted. `queryByRole` rather than
      // `findByRole` because `findByRole`'s polling loop relies on a
      // real `setTimeout` that is now faked.
      expect(screen.queryByRole('status')).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(4001);
      });

      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('Escape dismisses the toast', async () => {
    window.history.replaceState(null, '', '#nonexistent');
    renderHarness();

    expect(await screen.findByRole('status')).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('known hash scrolls with smooth behaviour (R14.2)', async () => {
    window.history.replaceState(null, '', '#work');
    renderHarness();

    await waitFor(() => {
      expect(scrollToSpy!).toHaveBeenCalled();
    });

    const calls = scrollToSpy!.mock.calls;
    const lastCall = calls[calls.length - 1];
    expect(lastCall?.[0]).toMatchObject({ behavior: 'smooth' });

    // R14.4: the requested top edge must land within ±2 px of the
    // section's offset minus the sticky-header height. With no header
    // mounted in the harness, the target offset reduces to the
    // section's `getBoundingClientRect().top + window.scrollY`. jsdom
    // reports zero-height rects for layout-less elements so the value
    // is bounded by ±2 px around 0 by construction.
    const requestedTop = (lastCall?.[0] as ScrollToOptions | undefined)?.top;
    expect(typeof requestedTop).toBe('number');
    expect(Math.abs(requestedTop as number)).toBeLessThanOrEqual(2);
  });

  it('reduced-motion mode scrolls instantly with behavior:"auto" (R14.3)', async () => {
    localStorage.setItem(REDUCED_MOTION_KEY, 'on');
    window.history.replaceState(null, '', '#work');
    renderHarness();

    await waitFor(() => {
      expect(scrollToSpy!).toHaveBeenCalled();
    });

    const calls = scrollToSpy!.mock.calls;
    const lastCall = calls[calls.length - 1];
    expect(lastCall?.[0]).toMatchObject({ behavior: 'auto' });
  });

  it('unknown hash does not unload the document (R6.7)', async () => {
    window.history.replaceState(null, '', '#totally-bogus');
    renderHarness();

    // Toast indicates the unknown-hash path executed without throwing.
    expect(await screen.findByRole('status')).toBeInTheDocument();

    // All registered Route_Map sections must still be in the document.
    for (const entry of routeMap) {
      expect(document.getElementById(entry.domId)).toBeInTheDocument();
    }
  });
});
