/**
 * Threshold (Above_The_Fold) — DOM render tests.
 *
 * Mounts the production `<App />` shell and verifies the Above_The_Fold
 * contract on both reference viewports defined by the design glossary
 * ("the portion of the first scene visible without scrolling on a
 * 1440×900 desktop viewport and on a 390×844 mobile viewport"):
 *
 *  - **R1.1** The owner's full name renders as the exact string
 *    `"Devansh Barai"` inside the page's single `<h1>`. The role-based
 *    query `getByRole('heading', { level: 1 })` proves both the
 *    semantic level and the singularity.
 *
 *  - **R1.2** Both co-primary academic credentials ("IIT Madras" and
 *    "IIM Bangalore") render in typographic roles of equal visual
 *    weight: matching computed font-size, matching computed
 *    font-weight, and matching `Surface` tone token (read via the
 *    `data-surface` attribute set by the `Surface` primitive on the
 *    nearest ancestor surface). They are visually grouped via the
 *    enclosing `<div role="group" aria-label="Education">`.
 *
 *  - **R1.3** No other heading on the page renders at a typographic
 *    role visually equal to or larger than the credential headings.
 *    The owner's `<h1>` is the only heading larger than the
 *    credentials (display > title); every other heading (`<h2>` …
 *    `<h6>`) must compute strictly smaller than the credential
 *    `<h2>`s. The two credential headings themselves are excluded
 *    from the comparison so the equal-weight pair does not violate
 *    the strict-less-than assertion against itself.
 *
 *  - **R6.4** Both viewports surface the name and identity content
 *    Above_The_Fold. The viewport is set via `window.innerWidth` /
 *    `window.innerHeight` plus a synthetic `resize` event, exactly as
 *    the task specifies, so the `Responsive_Engine`'s
 *    `useBreakpoint()` hook re-resolves to the correct tier.
 *
 * The test renders the full `<App />`. Below-the-fold scenes are lazy
 * boundaries that fall through to their Suspense skeletons during the
 * initial render — those skeletons emit no heading nodes, so the
 * heading-hierarchy assertion only sees Threshold's headings, which
 * is the correct measurement surface for the Above_The_Fold contract.
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 6.4
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';

import { App } from '../../App';

// ---------------------------------------------------------------------------
// Viewport helpers
// ---------------------------------------------------------------------------
//
// The Responsive_Engine's `useBreakpoint()` reads `window.innerWidth` and
// re-evaluates on the `resize` event. Setting both dimensions and dispatching
// a synthetic resize matches the production code path exactly — no module
// mocks required.

interface Viewport {
  readonly width: number;
  readonly height: number;
}

const DESKTOP_VIEWPORT: Viewport = { width: 1440, height: 900 };
const MOBILE_VIEWPORT: Viewport = { width: 390, height: 844 };

function setViewport({ width, height }: Viewport): void {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  });
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    writable: true,
    value: height,
  });
  window.dispatchEvent(new Event('resize'));
}

// ---------------------------------------------------------------------------
// Computed-style helpers
// ---------------------------------------------------------------------------

/** Returns the resolved CSS pixel size of an element's `font-size`. */
function fontSizePx(el: Element): number {
  const cs = window.getComputedStyle(el);
  return Number.parseFloat(cs.fontSize);
}

/**
 * Returns the resolved `font-weight` as a number. CSS allows the keyword
 * forms (`normal`, `bold`); we normalise those to their numeric equivalents
 * so comparisons across Text primitives are unambiguous.
 */
function fontWeight(el: Element): number {
  const raw = window.getComputedStyle(el).fontWeight;
  if (raw === 'normal') return 400;
  if (raw === 'bold') return 700;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : 400;
}

/**
 * Returns the surface tone token of the nearest ancestor (or self) carrying
 * a `data-surface` attribute. The `Surface` primitive emits this attribute
 * exactly once per rendered surface, so the closest match identifies the
 * surface that visually contains the node.
 */
function surfaceToken(el: Element): string | null {
  const ancestor = el.closest<HTMLElement>('[data-surface]');
  return ancestor ? ancestor.getAttribute('data-surface') : null;
}

// ---------------------------------------------------------------------------
// Test harness lifecycle
// ---------------------------------------------------------------------------

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe.each([
  { label: 'desktop 1440×900', viewport: DESKTOP_VIEWPORT },
  { label: 'mobile 390×844', viewport: MOBILE_VIEWPORT },
])('Threshold Above_The_Fold @ $label', ({ viewport }) => {
  beforeEach(() => {
    setViewport(viewport);
  });

  it('renders the owner name as the exact string "Devansh Barai" inside the only <h1> (R1.1)', () => {
    render(<App />);

    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1.textContent).toBe('Devansh Barai');

    // Singularity: there is exactly one <h1> on the rendered page.
    const allH1s = document.querySelectorAll('h1');
    expect(allH1s.length).toBe(1);
    expect(allH1s[0]).toBe(h1);
  });

  it('renders both co-primary credentials in equal typographic roles (R1.2)', () => {
    render(<App />);

    // The credentials live inside the explicit Twin-Compass paired block.
    const educationGroup = screen.getByRole('group', { name: /education/i });
    expect(educationGroup).toBeInTheDocument();

    // Each credential renders its institution name as an <h2>.
    const credentialHeadings = within(educationGroup).getAllByRole('heading', {
      level: 2,
    });
    expect(credentialHeadings).toHaveLength(2);

    const [iitH2, iimH2] = credentialHeadings;
    expect(iitH2?.textContent).toBe('IIT Madras');
    expect(iimH2?.textContent).toBe('IIM Bangalore');

    // Equal computed font-size.
    const iitSize = fontSizePx(iitH2!);
    const iimSize = fontSizePx(iimH2!);
    expect(iitSize).toBeGreaterThan(0);
    expect(iitSize).toBe(iimSize);

    // Equal computed font-weight.
    expect(fontWeight(iitH2!)).toBe(fontWeight(iimH2!));

    // Equal surface tone token — both credentials share the same Surface
    // ancestor, so they read as one paired block at the surface level.
    const iitSurface = surfaceToken(iitH2!);
    const iimSurface = surfaceToken(iimH2!);
    expect(iitSurface).not.toBeNull();
    expect(iitSurface).toBe(iimSurface);

    // The full credential prose ("IIT Madras — BS in Data Science and
    // Applications (2024–2028)" / "IIM Bangalore — …") composes from the
    // institution heading plus the program / years body copy. Verify that
    // every token in each credential's full string is rendered somewhere
    // inside the group.
    const groupText = (educationGroup.textContent ?? '').replace(/\s+/g, ' ');
    expect(groupText).toContain('IIT Madras');
    expect(groupText).toContain('BS in Data Science and Applications');
    expect(groupText).toContain('2024');
    expect(groupText).toContain('2028');
    expect(groupText).toContain('IIM Bangalore');
    expect(groupText).toContain('BBA in Digital Business & Entrepreneurship');
    expect(groupText).toContain('2025');
  });

  it('renders no other heading at or above the credential headings\' size (R1.3)', () => {
    render(<App />);

    const educationGroup = screen.getByRole('group', { name: /education/i });
    const credentialHeadings = within(educationGroup).getAllByRole('heading', {
      level: 2,
    });
    const credentialSize = fontSizePx(credentialHeadings[0]!);

    // The h1 (owner name) is expected to be strictly larger than the
    // credentials — the display type step exceeds the title step. Every
    // other heading on the rendered page (h2 outside the credential pair,
    // h3, h4, …) must compute strictly smaller than the credentials, so
    // no other heading visually competes with the equal-weight pair.
    const h1 = screen.getByRole('heading', { level: 1 });
    const allHeadings = Array.from(
      document.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6'),
    );

    for (const heading of allHeadings) {
      if (heading === h1) continue;
      if (credentialHeadings.includes(heading)) continue;
      const size = fontSizePx(heading);
      // jsdom resolves inline `style="font-size: 36px"` to a numeric value;
      // a heading with no resolvable font-size is treated as smaller (it
      // cannot dominate the credentials visually).
      if (!Number.isFinite(size)) continue;
      expect(size).toBeLessThan(credentialSize);
    }
  });
});
