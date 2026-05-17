/**
 * Project_Showcase render — DOM tests for The Work scene.
 *
 * Validates: Requirements 8.5, 8.6, 8.8, 8.9
 *
 * Harness choice — why this mounts `<TheWork/>` rather than `<App/>`:
 *
 *   The orchestrator's task spec allows mounting the parent scene
 *   directly when full-`<App/>` mounts are too brittle, and they are
 *   here. The App shell wraps everything in
 *   `<LazyMotion features={domAnimation} strict>`, but several
 *   per-project reveal modules (KhetechReveal, SupportDeskOpsReveal,
 *   LastMinutePDFReveal) use raw `motion.*` components rather than
 *   the mini-feature `m.*` exports — the same pre-existing
 *   inconsistency called out in `no-runtime-fetch.test.tsx`'s header
 *   comment, which crashes under strict in jsdom.
 *
 *   `TheWork` is the canonical parent that renders the four reveals
 *   in Content_Registry order and owns the skip-on-incomplete
 *   behaviour. R8.5 / R8.6 / R8.8 / R8.9 are all governed by its
 *   render path, so it is the right surface for this contract test.
 *
 * R8.5 / R8.6 — canonical project order from the Content_Registry,
 *   identical across two consecutive remounts.
 * R8.8       — every external project link carries `target="_blank"`
 *   and `rel="noopener noreferrer"` in the DOM **before** any
 *   pointer/keyboard interaction.
 * R8.9       — when a single fixture project is mutated to drop a
 *   required R8.3 field, a non-blocking `<aside role="status">`
 *   skip indicator appears in that slot while the remaining three
 *   still render in canonical order.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import type { Project_Record } from '../../content-registry/types';

// ---------------------------------------------------------------------------
// Mocking strategy
// ---------------------------------------------------------------------------
//
// `vi.mock` is hoisted, so the mock factory below is in place before
// `TheWork` (which imports `projects` from the registry) is loaded.
// The factory falls back to the real module via `vi.importActual` so
// the canonical Content_Registry validation runs at import time
// (R1.8 / R15.9) — that gate must succeed for the test to be
// meaningful.
//
// The exported `projects` is a getter so each render of `<TheWork/>`
// reads the latest `mockState` value. Tests that need a mutated
// fixture (R8.9) assign `mockState.override`; tests that exercise
// the canonical path leave it `undefined` and get the real fixture
// untouched.

const mockState = vi.hoisted(() => ({
  override: undefined as readonly Project_Record[] | undefined,
}));

vi.mock('../../content-registry/data', async () => {
  const actual = await vi.importActual<
    typeof import('../../content-registry/data')
  >('../../content-registry/data');
  return {
    ...actual,
    get projects() {
      return mockState.override ?? actual.projects;
    },
  };
});

// Imports below this line resolve through the mocked module. The
// `projects` binding is a live reference to the getter — the canonical
// snapshot below is taken before any test toggles `mockState.override`,
// so it is safe to use as the "before-mutation" baseline throughout.
import { TheWork } from '../../scenes/Work/TheWork';
import { projects as registryProjects } from '../../content-registry/data';

// ---------------------------------------------------------------------------
// Canonical reference data
// ---------------------------------------------------------------------------

/** Canonical project ids per R8.5 / R8.6, frozen at module load. */
const CANONICAL_IDS = [
  'globeid',
  'khetech',
  'supportdeskops-v6',
  'last-minute-pdf',
] as const;

/** Canonical project display names per R1.4. */
const CANONICAL_NAMES = [
  'GlobeID',
  'Khetech',
  'SupportDeskOps-v6',
  'Last-Minute PDF',
] as const;

/**
 * Deep snapshot of the canonical fixture. Taken at module load — when
 * `mockState.override` is still `undefined` and the getter therefore
 * returns the real registry — so the reference value cannot drift
 * mid-suite when a later test installs a mutated override.
 */
const CANONICAL_SNAPSHOT: readonly Project_Record[] = registryProjects.map(
  (p) => JSON.parse(JSON.stringify(p)) as Project_Record,
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Deep-clone a Project_Record so per-test mutations cannot leak. */
function cloneProject(p: Project_Record): Project_Record {
  return JSON.parse(JSON.stringify(p)) as Project_Record;
}

/**
 * Read the rendered project slots (rendered reveal *or* skip aside) in
 * DOM order. Each rendered reveal's section root is
 * `<section id="scene-work-${project.id}">`; each skipped entry is
 * `<aside data-scene-work-skipped="${project.id}">`. Both shapes are
 * captured so the assertion observes the canonical slot order across
 * rendered + skipped projects (R8.5 / R8.6 / R8.9).
 *
 * The selector `[id^="scene-work-"]` excludes the parent scene's
 * `<section id="scene-work">` (no trailing hyphen).
 */
function readRenderedSlots(): string[] {
  const nodes = Array.from(
    document.querySelectorAll<HTMLElement>(
      '[id^="scene-work-"], [data-scene-work-skipped]',
    ),
  );
  return nodes.map((el) => {
    const skipped = el.getAttribute('data-scene-work-skipped');
    if (skipped !== null) return skipped;
    return el.id.slice('scene-work-'.length);
  });
}

/**
 * Return the project ids of every rendered reveal `<section>` in DOM
 * order — i.e., excludes any slot that turned into a skip aside. Used
 * by the canonical-order assertion which only counts successfully
 * rendered reveals.
 */
function readRenderedRevealIds(): string[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>('[id^="scene-work-"]'),
  )
    .map((el) => el.id.slice('scene-work-'.length))
    .filter((id) => id.length > 0);
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeEach(() => {
  // Default to the real registry — every test opts into a mutated
  // override explicitly.
  mockState.override = undefined;
});

afterEach(() => {
  cleanup();
  mockState.override = undefined;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TheWork — project-showcase render contracts', () => {
  // -------------------------------------------------------------------------
  // R8.5 / R8.6 — canonical order, identical across remounts
  // -------------------------------------------------------------------------

  it('renders the four canonical reveals in Content_Registry order, identical across two consecutive remounts (R8.5, R8.6)', async () => {
    // Sanity guard: the canonical fixture itself is in the order this
    // test pins. Drift here would mask a regression in the renderer.
    expect(CANONICAL_SNAPSHOT.map((p) => p.id)).toStrictEqual([
      ...CANONICAL_IDS,
    ]);

    // The four reveal modules are `React.lazy` boundaries. The first
    // mount in the suite pays the full dynamic-import cost (Vitest
    // module loader + transform), so the default 1-second `waitFor`
    // can race the slowest chunk. A 10-second budget is well below the
    // 20-second test timeout (set on the `it` call below) but
    // comfortably above the observed worst-case import cost when the
    // suite runs alongside the heavy `copy-hygiene` PBT under the
    // vitest thread pool.
    const REVEAL_RESOLVE_TIMEOUT_MS = 10_000;

    // ---- First mount ---------------------------------------------------
    const first = render(<TheWork />);

    // Each reveal renders its project name as `<Text as="h3">` once
    // the lazy chunk resolves; waiting for four h3s is the cheapest
    // proof that all four reveals have landed.
    await waitFor(
      () => {
        expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(4);
      },
      { timeout: REVEAL_RESOLVE_TIMEOUT_MS },
    );

    const firstHeadingOrder = screen
      .getAllByRole('heading', { level: 3 })
      .map((h) => (h.textContent ?? '').trim());
    expect(firstHeadingOrder).toStrictEqual([...CANONICAL_NAMES]);

    // The DOM ids on each `<section>` root match the canonical slugs
    // in the same order — proves the slot ordering is registry-driven
    // rather than alphabetical or render-completion-order.
    expect(readRenderedRevealIds()).toStrictEqual([...CANONICAL_IDS]);

    first.unmount();

    // ---- Second mount --------------------------------------------------
    const second = render(<TheWork />);

    await waitFor(
      () => {
        expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(4);
      },
      { timeout: REVEAL_RESOLVE_TIMEOUT_MS },
    );

    const secondHeadingOrder = screen
      .getAllByRole('heading', { level: 3 })
      .map((h) => (h.textContent ?? '').trim());

    // R8.6 — deterministic across repeated renders for the same
    // Content_Registry state.
    expect(secondHeadingOrder).toStrictEqual(firstHeadingOrder);
    expect(readRenderedRevealIds()).toStrictEqual([...CANONICAL_IDS]);

    second.unmount();
  }, 20_000);

  // -------------------------------------------------------------------------
  // R8.8 — preemptive target/rel on every external project link
  // -------------------------------------------------------------------------

  it('every external project link sets target="_blank" and rel="noopener noreferrer" preemptively, before any pointer interaction (R8.8)', async () => {
    render(<TheWork />);

    await waitFor(
      () => {
        expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(4);
      },
      { timeout: 5000 },
    );

    // Each project's `primaryLink.url` resolves off-origin under jsdom
    // (the default test host is `localhost`; the canonical fixture
    // points at github.com). The `<Link>` primitive auto-applies
    // `target="_blank"` + `rel="noopener noreferrer"` at render time —
    // R8.8 specifically governs the preemptive state, so we read the
    // attributes WITHOUT firing any pointer or keyboard event first.
    const expectedUrls = new Set(
      CANONICAL_SNAPSHOT.map((p) => p.primaryLink.url),
    );

    const projectLinks = Array.from(
      document.querySelectorAll<HTMLAnchorElement>('a[href]'),
    ).filter((a) => expectedUrls.has(a.getAttribute('href') ?? ''));

    // One CTA per project — four reveals → four links.
    expect(projectLinks).toHaveLength(CANONICAL_SNAPSHOT.length);

    for (const a of projectLinks) {
      expect(a).toHaveAttribute('target', '_blank');
      expect(a).toHaveAttribute('rel', 'noopener noreferrer');
    }
  });

  // -------------------------------------------------------------------------
  // R8.9 — non-blocking skip indicator for an incomplete project entry
  // -------------------------------------------------------------------------

  it('a fixture project missing a required R8.3 field is replaced by a non-blocking <aside role="status"> while the remaining three still render in canonical order (R8.9)', async () => {
    // Deep-clone the canonical fixture and mutate the second entry
    // ("Khetech") to drop a required field. `tagline` is required by
    // R1.5 / R8.3; `validateProject` rejects an empty string with a
    // stable `{ field: 'tagline', … }` diagnostic that the renderer
    // surfaces verbatim inside the skip indicator.
    //
    // Choosing `tagline` (rather than `name`) keeps `project.name`
    // populated so the skip-aside's announcement still names the
    // offending project — the operator-facing message remains
    // useful while the validator's "missing required field" path is
    // exercised.
    const KHETECH_INDEX = 1;
    const mutated = CANONICAL_SNAPSHOT.map(cloneProject) as Project_Record[];
    (mutated[KHETECH_INDEX] as { tagline: string }).tagline = '';
    mockState.override = mutated;

    render(<TheWork />);

    // Three valid reveals must still land. `findByRole` polls until
    // the lazy chunks resolve.
    await waitFor(
      () => {
        expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(3);
      },
      { timeout: 5000 },
    );

    // The skip indicator surfaces with `role="status"` (implicit
    // `aria-live="polite"`), so the announcement never interrupts
    // the user's reading — that is the "non-blocking" half of R8.9.
    const skipped = screen.getByRole('status');
    expect(skipped.tagName.toLowerCase()).toBe('aside');
    expect(skipped).toHaveAttribute('data-scene-work-skipped', 'khetech');
    // Defensive: the announcement names the offending project so an
    // operator can correlate the runtime indication with the registry
    // entry that needs fixing.
    expect(skipped.textContent ?? '').toMatch(/khetech/i);
    // R8.3 / R8.9 — the validator's `field` diagnostic is surfaced so
    // the skip reason is observable rather than opaque.
    expect(skipped.textContent ?? '').toMatch(/tagline/i);

    // Slot ordering: the aside takes Khetech's slot. The three valid
    // reveals continue to render in canonical order, with the skipped
    // entry occupying its registry-defined position rather than being
    // moved to the end.
    expect(readRenderedSlots()).toStrictEqual([...CANONICAL_IDS]);

    // The three rendered reveals' headings appear in canonical order
    // among themselves (Khetech is omitted, the surrounding three
    // hold their positions).
    const renderedNames = screen
      .getAllByRole('heading', { level: 3 })
      .map((h) => (h.textContent ?? '').trim());
    expect(renderedNames).toStrictEqual([
      'GlobeID',
      'SupportDeskOps-v6',
      'Last-Minute PDF',
    ]);
  });
});
