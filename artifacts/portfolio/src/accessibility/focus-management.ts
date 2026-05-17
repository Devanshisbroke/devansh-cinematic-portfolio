import { useEffect, type RefObject } from 'react';

/**
 * Singleton ref to the `<main>` landmark. Initialised by App.tsx on mount.
 */
let mainRef: HTMLElement | null = null;

/**
 * Register the `<main>` element ref. Called by App.tsx on mount.
 */
export function setMainContentRef(el: HTMLElement | null): void {
  mainRef = el;
}

/**
 * Returns the registered `<main>` element, or null if not yet registered.
 */
export function getMainContent(): HTMLElement | null {
  return mainRef;
}

/**
 * Move keyboard focus to the start of `<main>`. Used by the skip-to-content
 * link (R13.5, R13.7).
 */
export function focusMain(): void {
  if (mainRef) {
    mainRef.focus({ preventScroll: false });
  }
}

/**
 * Hook that returns a callback ref to attach to the `<main>` element. The
 * hook ensures `setMainContentRef` is called whenever the element mounts or
 * unmounts.
 */
export function useMainContentRef(): (el: HTMLElement | null) => void {
  return (el) => {
    setMainContentRef(el);
  };
}

/**
 * Runtime assertion: walk the DOM and flag any heading-level skip (h1 → h3
 * without h2, etc.) (R13.8). Returns null on success or an error message.
 *
 * Intended for development only — App.tsx should call this once on mount in
 * non-production builds.
 */
export function checkHeadingHierarchy(root: HTMLElement = document.body): string | null {
  const headings = root.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6');
  let h1Count = 0;
  let prevLevel = 0;

  for (const h of Array.from(headings)) {
    const level = parseInt(h.tagName.charAt(1), 10);
    if (level === 1) h1Count += 1;

    if (prevLevel === 0) {
      if (level !== 1) {
        return `Heading hierarchy must start at h1 (found h${level} as first heading: "${h.textContent?.slice(0, 60)}")`;
      }
    } else if (level > prevLevel + 1) {
      return `Heading hierarchy skipped from h${prevLevel} to h${level} (heading "${h.textContent?.slice(0, 60)}")`;
    }

    prevLevel = level;
  }

  if (h1Count === 0) {
    return 'No h1 found in document';
  }
  if (h1Count > 1) {
    return `Multiple h1 headings found (${h1Count}); expected exactly 1`;
  }

  return null;
}

/**
 * Hook variant: validates the heading hierarchy on mount, in development.
 */
export function useHeadingHierarchyAssertion(): void {
  useEffect(() => {
    if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') return;
    if (typeof document === 'undefined') return;

    // Wait one tick for the tree to mount
    const id = setTimeout(() => {
      const error = checkHeadingHierarchy();
      if (error !== null) {
        console.warn(`[a11y] Heading hierarchy violation: ${error}`);
      }
    }, 100);
    return () => clearTimeout(id);
  }, []);
}

/**
 * No-op focus trap. The portfolio has no modals or overlays that require
 * trapping focus — content is always reachable via standard tab order. This
 * export exists so future overlay components can register a focus trap
 * implementation here without scattering trap logic across the codebase.
 */
export function useFocusTrap(_ref: RefObject<HTMLElement>): void {
  // intentional no-op
}

/**
 * Tracks the canonical h1 id for testing assertions.
 */
export function manageHeadingOrder(opts: { h1Id: string }): { h1Id: string } {
  return opts;
}
