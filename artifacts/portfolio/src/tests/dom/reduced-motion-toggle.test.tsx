/**
 * `<ReducedMotionToggle/>` DOM-level integration tests.
 *
 * These tests exercise the toggle component end-to-end against the real
 * `accessibility/reduced-motion-store.ts` persistence layer (no module
 * mocks): the wiring between user input, `localStorage["pcr.reduced-motion"]`,
 * `applyReducedMotion`, and `getResolvedVariant` is validated against the
 * same code path the production app runs.
 *
 * Acceptance criteria covered (Requirement 13.1, 13.2, 13.3):
 *
 *  - **R13.2** discoverability and keyboard operation: a `role="switch"`
 *    with an accessible name is rendered, focusable via Tab, and
 *    activatable via Enter and Space (native `<button>` carries those
 *    keys; `role="switch"` overlays state semantics).
 *  - **R13.2** redundant cue: a non-color, non-motion text label
 *    `"Reduce motion: on" / "off"` flips alongside the visual switch
 *    so that AT users and sighted users without color/motion
 *    perception both perceive state.
 *  - **R13.3** persistence: clicking the switch writes `'on'` / `'off'`
 *    to `localStorage["pcr.reduced-motion"]` and the value survives a
 *    full unmount → remount cycle (the second mount reads back the
 *    stored value as its initial state).
 *  - **R13.1** OS-preference fallback via the "Match system" button:
 *    activating it removes the explicit override from `localStorage`
 *    and the resolved value reverts to whatever `matchMedia('(prefers-
 *    reduced-motion: reduce)')` reports — proven by overriding
 *    `window.matchMedia` to report `matches: true` and observing that
 *    `readReducedMotion()` returns `true` after the clear.
 *  - Variant registry observation: with a `MotionVariant` registered
 *    via `registerVariant`, after the toggle is flipped on,
 *    `getResolvedVariant(id, readReducedMotion())` returns the
 *    `applyReducedMotion`-collapsed shape (identity transform,
 *    duration ≤ 120 ms, no delay) — the toggle's effect is observable
 *    through the registry's read path, not just localStorage.
 *
 * Validates: Requirements 13.1, 13.2, 13.3
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ReducedMotionToggle } from '../../motion/reduced-motion-toggle';
import { readReducedMotion } from '../../accessibility/reduced-motion-store';
import {
  registerVariant,
  getResolvedVariant,
  _resetRegistry,
} from '../../motion/motion-create';
import { applyReducedMotion } from '../../motion/reduced-motion';
import type { MotionVariant } from '../../motion/variant-types';

const STORAGE_KEY = 'pcr.reduced-motion';

// ---------------------------------------------------------------------------
// matchMedia override helper
// ---------------------------------------------------------------------------
//
// jsdom's setup stub (see `src/tests/setup.ts`) reports `matches: false` for
// every query. To exercise R13.1's "revert to matchMedia value" path we need
// to swap in a controllable stub that reports `matches: true` for the
// `prefers-reduced-motion: reduce` query. The captured original reference is
// restored in `afterEach` so the override never leaks across tests.

let originalMatchMedia: typeof window.matchMedia | undefined;

function overrideMatchMedia(reducedMotionPrefers: boolean): void {
  originalMatchMedia = window.matchMedia;
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string): MediaQueryList =>
      ({
        matches:
          query === '(prefers-reduced-motion: reduce)'
            ? reducedMotionPrefers
            : false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList,
  });
}

function restoreMatchMedia(): void {
  if (originalMatchMedia !== undefined) {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: originalMatchMedia,
    });
    originalMatchMedia = undefined;
  }
}

// ---------------------------------------------------------------------------
// Test harness lifecycle
// ---------------------------------------------------------------------------

beforeEach(() => {
  localStorage.clear();
  _resetRegistry();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  _resetRegistry();
  restoreMatchMedia();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('<ReducedMotionToggle/> — R13.1 / R13.2 / R13.3', () => {
  it('renders a role="switch" with an accessible name (R13.2 discoverability)', () => {
    render(<ReducedMotionToggle />);
    const sw = screen.getByRole('switch', { name: /reduce motion/i });
    expect(sw).toBeInTheDocument();
    expect(sw).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows a redundant text label "on"/"off" alongside the visual switch (R13.12 redundant cue)', () => {
    render(<ReducedMotionToggle />);
    expect(screen.getByText(/reduce motion: off/i)).toBeInTheDocument();
  });

  it('toggling persists "on"/"off" to localStorage["pcr.reduced-motion"] (R13.3)', async () => {
    const user = userEvent.setup();
    render(<ReducedMotionToggle />);
    const sw = screen.getByRole('switch', { name: /reduce motion/i });

    await user.click(sw);

    expect(localStorage.getItem(STORAGE_KEY)).toBe('on');
    expect(sw).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/reduce motion: on/i)).toBeInTheDocument();

    await user.click(sw);

    expect(localStorage.getItem(STORAGE_KEY)).toBe('off');
    expect(sw).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText(/reduce motion: off/i)).toBeInTheDocument();
  });

  it('persists across remount (R13.3 — survives unmount/remount cycle)', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<ReducedMotionToggle />);
    const sw = screen.getByRole('switch', { name: /reduce motion/i });

    await user.click(sw);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('on');

    unmount();

    render(<ReducedMotionToggle />);
    const swRemount = screen.getByRole('switch', { name: /reduce motion/i });
    expect(swRemount).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/reduce motion: on/i)).toBeInTheDocument();
  });

  it('respects a pre-existing localStorage value on first render (R13.3)', () => {
    localStorage.setItem(STORAGE_KEY, 'on');
    render(<ReducedMotionToggle />);
    const sw = screen.getByRole('switch', { name: /reduce motion/i });
    expect(sw).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/reduce motion: on/i)).toBeInTheDocument();
  });

  it('"Match system" clears the override and reverts to matchMedia value (R13.1)', async () => {
    // Arrange: OS reports `prefers-reduced-motion: reduce`. The user has
    // set an explicit override of "off" in a prior session — they want
    // motion despite the OS setting.
    overrideMatchMedia(true);
    localStorage.setItem(STORAGE_KEY, 'off');

    const user = userEvent.setup();
    render(<ReducedMotionToggle />);

    // Sanity: explicit override wins over OS pref while it is set.
    expect(readReducedMotion()).toBe(false);

    // Act: click "Match system" to remove the override.
    const matchBtn = screen.getByRole('button', {
      name: /match system motion preference/i,
    });
    await user.click(matchBtn);

    // Assert: the override is gone, and the resolved value now reflects
    // `matchMedia('(prefers-reduced-motion: reduce)') → true`.
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(readReducedMotion()).toBe(true);
  });

  it('toggle is keyboard-activatable via Enter and Space (R13.2)', async () => {
    const user = userEvent.setup();
    render(<ReducedMotionToggle />);
    const sw = screen.getByRole('switch', { name: /reduce motion/i });

    sw.focus();
    expect(document.activeElement).toBe(sw);

    await user.keyboard('{Enter}');
    expect(sw).toHaveAttribute('aria-pressed', 'true');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('on');

    await user.keyboard(' ');
    expect(sw).toHaveAttribute('aria-pressed', 'false');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('off');
  });

  it('when toggled on, applyReducedMotion is observed through getResolvedVariant', async () => {
    // Arrange: register a full-motion variant with the motion registry.
    // After the toggle flips on, `getResolvedVariant(id, readReducedMotion())`
    // funnels the variant through `applyReducedMotion`, so the
    // resolved shape must equal the transformer's collapsed output.
    const fullMotionVariant: MotionVariant = {
      id: 'reduced-motion-toggle.test/fade-up',
      keyframes: [
        {
          transform: { translateY: 24, scale: 1.02 },
          durationMs: 600,
          easing: 'easeOut',
          opacity: 0,
        },
        {
          transform: { translateY: 0, scale: 1 },
          durationMs: 400,
          easing: 'easeOut',
          opacity: 1,
        },
      ],
    };
    registerVariant(fullMotionVariant);

    // Sanity: with reduced-motion off, the registry returns the original.
    expect(getResolvedVariant(fullMotionVariant.id, false)).toBe(
      fullMotionVariant,
    );

    const user = userEvent.setup();
    render(<ReducedMotionToggle />);
    const sw = screen.getByRole('switch', { name: /reduce motion/i });

    await user.click(sw);

    // Toggle on → readReducedMotion() === true → registry funnels
    // through applyReducedMotion. Compare structurally against the
    // transformer's own output so the test pins the contract, not an
    // accidentally-matching shape.
    expect(readReducedMotion()).toBe(true);
    const resolved = getResolvedVariant(
      fullMotionVariant.id,
      readReducedMotion(),
    );
    expect(resolved).toStrictEqual(applyReducedMotion(fullMotionVariant));

    // And the collapse is observable directly on the keyframes:
    // identity transform, duration clamped to ≤ 120 ms, no delay.
    for (const k of resolved.keyframes) {
      expect(k.transform).toStrictEqual({});
      expect(k.durationMs).toBeLessThanOrEqual(120);
      expect((k as { delayMs?: number }).delayMs).toBeUndefined();
    }
  });
});
