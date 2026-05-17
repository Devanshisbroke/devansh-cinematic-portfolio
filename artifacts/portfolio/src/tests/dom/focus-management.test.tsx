/**
 * Focus management — DOM tests for the Accessibility_Layer's keyboard
 * affordances and visible-focus contract.
 *
 * Validates: Requirements 13.5, 13.6, 13.7, 13.9
 *
 * Why mount the real `<App/>`: every clause in the task description is a
 * shell-level invariant (the skip link must be first, every interactive
 * element across the rendered shell must have an accessible name, the tab
 * order must match the canonical narrative order). Stubbing landmarks
 * would defeat the purpose, and the same `<App/>` boot path is already
 * exercised by `threshold-above-the-fold.test.tsx`, so the synchronous
 * shell mounts cleanly under jsdom.
 *
 * Test-environment notes:
 *
 *  1. The four below-the-fold scenes are `React.lazy` boundaries that
 *     mount inside `<LazyMotion strict>`. Two of those scenes pull in
 *     `motion.*` components directly (a pre-existing inconsistency with
 *     the strict feature pack — the same one called out in
 *     `no-runtime-fetch.test.tsx`'s header comment), so awaiting the
 *     lazy resolution under jsdom throws. The tests below therefore
 *     assert against the **synchronously rendered** shell: skip link,
 *     header (logo + primary nav), `<main>` with the five scene
 *     anchors (real for Threshold, Suspense skeletons for the rest —
 *     both expose the canonical `id` attributes), and the footer
 *     controls. That is the surface the four acceptance criteria
 *     actually govern.
 *  2. The `:focus-visible` outline (R13.6) is published by the global
 *     `styles/reset.css` rule. jsdom parses inline `<style>` for
 *     `getComputedStyle()` but does not resolve `:focus-visible`
 *     (cascade for that pseudo-class is unimplemented). We therefore
 *     read `reset.css` from disk, parse the static `outline-width`
 *     declaration, and assert ≥ 2 CSS px statically. The companion
 *     ≥ 3:1 non-text contrast clause is checked via `wcagContrast()`
 *     against the `huePalette.amber` / `surfacePalette.base.dark`
 *     pair — the same pair Property 10 already grades under the
 *     `dark-focus-on-base` registry entry.
 *  3. `userEvent.tab()` walks the tabbable order computed from the
 *     live DOM, so it correctly skips the `<main>` landmark
 *     (`tabindex="-1"`) and lands on the skip link as the first
 *     natural-tab-order element on the page.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  cleanup,
  render,
  screen,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { App } from '../../App';
import { routeMap } from '../../route-map/data';
import { wcagContrast } from '../../design-system/contrast-pairs';
import { huePalette, surfacePalette } from '../../design-system/tokens';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Computed accessible name approximation. Mirrors the precedence used by
 * the W3C "Accessible Name and Description Computation 1.2" recipe well
 * enough for the elements rendered by the App shell: aria-label > aria-
 * labelledby > associated <label> / placeholder for inputs > alt for
 * images > title > textContent.
 */
function accessibleName(el: Element): string {
  const ariaLabel = el.getAttribute('aria-label')?.trim();
  if (ariaLabel) return ariaLabel;
  const labelledby = el.getAttribute('aria-labelledby');
  if (labelledby) {
    const labels = labelledby
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent ?? '')
      .join(' ')
      .trim();
    if (labels) return labels;
  }
  if (el instanceof HTMLImageElement && el.alt?.trim()) return el.alt.trim();
  if (el instanceof HTMLElement && el.title?.trim()) return el.title.trim();
  return (el.textContent ?? '').replace(/\s+/g, ' ').trim();
}

beforeEach(() => {
  // Make every test deterministic: no leftover hash / storage from earlier
  // suites that mounted `<App/>` and let the hash router drive scrollTo.
  window.history.replaceState(null, '', '#');
  localStorage.clear();
});

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Focus management — keyboard contract for the App shell', () => {
  // -------------------------------------------------------------------------
  // R13.7 — skip link is the first focusable element
  // -------------------------------------------------------------------------

  it('the first Tab from a fresh <App/> mount lands on the skip link (R13.7)', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Sanity: nothing is focused before the first Tab. jsdom seeds
    // `document.activeElement === document.body`.
    expect(document.activeElement).toBe(document.body);

    await user.tab();

    const skipLink = screen.getByRole('link', { name: /skip to content/i });
    expect(document.activeElement).toBe(skipLink);
    // The skip link's CSS hides it offscreen until focused (`.skip-to-content`
    // in `reset.css`). The class is the only signal that proves the
    // visually-hidden-until-focused treatment is wired up.
    expect(skipLink).toHaveClass('skip-to-content');
  });

  // -------------------------------------------------------------------------
  // R13.5 / R13.7 — activation moves focus into <main id="main-content">
  // -------------------------------------------------------------------------

  it('activating the skip link moves keyboard focus into #main-content (R13.5, R13.7)', async () => {
    const user = userEvent.setup();
    render(<App />);

    const main = document.getElementById('main-content');
    expect(main).not.toBeNull();
    // R13.7 explicitly: <main> must be programmatically focusable so the
    // skip-link target can receive focus without joining the natural
    // tab order.
    expect(main).toHaveAttribute('tabindex', '-1');

    const skipLink = screen.getByRole('link', { name: /skip to content/i });
    skipLink.focus();
    expect(document.activeElement).toBe(skipLink);

    await user.click(skipLink);

    // SkipToContent.onClick → element.focus({ preventScroll: false }).
    // The activeElement must now be the <main> landmark itself; assistive
    // tech then announces the next focusable descendant on the user's
    // next Tab keypress.
    expect(document.activeElement).toBe(main);
  });

  // -------------------------------------------------------------------------
  // R13.9 — every interactive element exposes a non-empty accessible name
  // -------------------------------------------------------------------------

  it('every interactive element in the rendered shell exposes a non-empty accessible name (R13.9)', () => {
    render(<App />);

    // The synchronously rendered shell contains every interactive element
    // the redesign owns at the App level: the skip link, the header
    // logo + primary nav, the footer ReducedMotionToggle (toggle switch
    // + "Match system" button), and the footer ThemeToggle. The four
    // below-the-fold scenes are still in their Suspense skeleton state
    // (per design `<SceneSkeleton aria-hidden="true">`), which by
    // construction emits no focusable descendants. The skeletons are
    // therefore the right surface to assert against — the contract is
    // that **every interactive element rendered at all** must carry a
    // non-empty accessible name.
    const interactiveElements: HTMLElement[] = [
      ...screen.queryAllByRole('link'),
      ...screen.queryAllByRole('button'),
      ...screen.queryAllByRole('switch'),
    ];

    // Sanity: the page has at least one interactive element. A pass with
    // zero elements would be vacuously true.
    expect(interactiveElements.length).toBeGreaterThan(0);

    for (const el of interactiveElements) {
      const name = accessibleName(el);
      expect(
        name.length,
        `Interactive element missing accessible name: ${el.outerHTML.slice(0, 200)}`,
      ).toBeGreaterThan(0);
    }
  });

  // -------------------------------------------------------------------------
  // R13.6 — focus indicator: ≥ 2 CSS px outline AND ≥ 3:1 non-text contrast
  // -------------------------------------------------------------------------

  it('focus indicator declares outline ≥ 2 CSS px and the focus token clears 3:1 contrast against the base surface (R13.6)', () => {
    // The :focus-visible declaration lives in the global stylesheet, not
    // on any single component. Read the file from disk and parse the
    // static value — jsdom does not resolve `:focus-visible` cascade for
    // computed style, so the runtime cannot answer this question.
    const resetCssPath = path.resolve(
      __dirname,
      '..',
      '..',
      'styles',
      'reset.css',
    );
    const resetCss = readFileSync(resetCssPath, 'utf8');

    // Capture the body of the `:focus-visible` block.
    const focusBlock = resetCss.match(/:focus-visible\s*\{([\s\S]*?)\}/);
    expect(
      focusBlock,
      'reset.css must declare a :focus-visible rule (R13.6)',
    ).not.toBeNull();
    const body = focusBlock![1];

    // Outline thickness — accept either a unified `outline:` shorthand or
    // the longhand `outline-width:` declaration. Both express CSS pixels
    // at the redesign's chosen value.
    const outlineWidthMatch =
      body.match(/outline\s*:\s*(\d+(?:\.\d+)?)px/) ??
      body.match(/outline-width\s*:\s*(\d+(?:\.\d+)?)px/);
    expect(
      outlineWidthMatch,
      'reset.css :focus-visible must specify an outline width in CSS px (R13.6)',
    ).not.toBeNull();
    const outlineWidthPx = Number.parseFloat(outlineWidthMatch![1]);
    expect(outlineWidthPx).toBeGreaterThanOrEqual(2);

    // Non-text contrast: the focus ring colour is `--color-amber` painted
    // on top of `--surface-base`. On the dark theme (the default boot
    // surface for the redesign) this resolves to amber on near-black —
    // identical to the `dark-focus-on-base` pair already pinned by
    // Property 10 in tests/pbt/contrast.pbt.test.ts.
    const contrast = wcagContrast(
      huePalette.amber,
      surfacePalette.base.dark,
    );
    expect(contrast).toBeGreaterThanOrEqual(3);
  });

  // -------------------------------------------------------------------------
  // R13.5 — tab order matches visual order across the five canonical scenes
  // -------------------------------------------------------------------------

  it('tab order through the rendered shell tracks the canonical scene order Threshold → TwinCompass → Work → Ethos → Signal (R13.5)', async () => {
    const user = userEvent.setup();
    render(<App />);

    // The "tab order matches visual order" contract has three layers
    // that together pin every clause of R13.5:
    //
    //   1. The five scene anchors appear in canonical DOM order. The
    //      Suspense fallbacks emit the same `id` as the eventual scene
    //      (per App.tsx's `<SceneSkeleton id="scene-…">`), so the
    //      ordering is observable on the synchronously rendered shell
    //      regardless of which lazy scenes have resolved.
    //
    //   2. The header `<nav aria-label="Primary">` lists the scenes in
    //      canonical order, so the natural tab walk through the header
    //      visits them in narrative order before reaching <main>.
    //
    //   3. Every focusable element rendered inside <main> belongs to a
    //      canonical scene, and the elements appear in monotonically
    //      non-decreasing rank order through the DOM. Threshold is the
    //      only scene that mounts synchronously and currently has no
    //      interactive elements, so this assertion holds vacuously
    //      today; the rank-monotonic walk is the right structural
    //      invariant to lock in for any future scene that grows
    //      interactive surface area.

    // -- Layer 1: section DOM order ----------------------------------------
    const sceneNodes = routeMap.map((entry) => {
      const node = document.getElementById(entry.domId);
      expect(node, `#${entry.domId} must be present in the rendered DOM`).not.toBeNull();
      return { entry, node: node! };
    });
    for (let i = 1; i < sceneNodes.length; i++) {
      const previous = sceneNodes[i - 1]!.node;
      const current = sceneNodes[i]!.node;
      // Node.compareDocumentPosition: DOCUMENT_POSITION_FOLLOWING === 4.
      const followsPrevious =
        previous.compareDocumentPosition(current) &
        Node.DOCUMENT_POSITION_FOLLOWING;
      expect(
        followsPrevious,
        `#${current.id} must follow #${previous.id} in document order`,
      ).toBeTruthy();
    }

    // -- Layer 2: header nav references scenes in canonical order ----------
    const primaryNav = screen.getByRole('navigation', { name: /primary/i });
    const navLinks = within(primaryNav).getAllByRole('link');
    const navHrefs = navLinks.map((a) => a.getAttribute('href'));
    const expectedHrefs = routeMap.map((entry) => `#${entry.slug}`);
    expect(navHrefs).toStrictEqual(expectedHrefs);

    // -- Layer 3: focusable descendants under <main> -----------------------
    const main = document.getElementById('main-content')!;

    // Conservative tabbable-element selector. Mirrors the heuristic used
    // by `tabbable` / Testing Library internally well enough for the
    // shell elements we render.
    const focusableSelector = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
      '[role="switch"]',
    ].join(', ');

    const rankByDomId = new Map(
      routeMap.map((entry) => [entry.domId, entry.rank] as const),
    );

    const focusables = Array.from(
      main.querySelectorAll<HTMLElement>(focusableSelector),
    );

    let previousRank = -1;
    for (const el of focusables) {
      const sceneAncestor = el.closest<HTMLElement>(
        routeMap.map((entry) => `#${entry.domId}`).join(', '),
      );
      // Every focusable element under <main> must belong to one of the
      // five canonical scenes. A `null` ancestor would mean a stray
      // focusable element exists outside the narrative tree — a bug per
      // R6.1 / R13.5.
      expect(
        sceneAncestor,
        `Focusable element ${el.outerHTML.slice(0, 120)} is not nested inside any canonical scene`,
      ).not.toBeNull();

      const rank = rankByDomId.get(sceneAncestor!.id);
      expect(rank).toBeDefined();
      expect(
        rank!,
        `Focusable in scene "${sceneAncestor!.id}" appears before a focusable in a later scene (rank regression)`,
      ).toBeGreaterThanOrEqual(previousRank);
      previousRank = rank!;
    }

    // -- End-to-end smoke: a forward Tab walk from the skip link visits
    //    the skip link, then traverses header logo + every nav link in
    //    the same DOM order. (Stops here because reaching the footer
    //    requires the lazy scenes to mount, which we deliberately do
    //    not await — see header comment.)
    await user.tab();
    expect(document.activeElement).toBe(
      screen.getByRole('link', { name: /skip to content/i }),
    );

    await user.tab();
    expect(document.activeElement).toBe(
      screen.getByRole('link', { name: /devansh barai\s*[—-]\s*home/i }),
    );

    for (const expectedHref of expectedHrefs) {
      await user.tab();
      expect(document.activeElement).toBeInstanceOf(HTMLAnchorElement);
      expect(
        (document.activeElement as HTMLAnchorElement).getAttribute('href'),
      ).toBe(expectedHref);
    }
  });
});
