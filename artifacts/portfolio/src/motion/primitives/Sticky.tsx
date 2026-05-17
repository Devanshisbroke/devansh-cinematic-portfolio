/**
 * `<Sticky>` — pins its child for the duration of its scene's progress.
 *
 * Used by the SupportDeskOps reveal (task 11.7) to hold the reward-curve
 * canvas in place while the scene's text columns animate over it. The
 * pin lasts for as long as the named scene occupies the viewport;
 * scene progress is read from the single shared scroll source
 * (`motion/scroll-source.ts`) so this component adds zero scroll
 * listeners on its own (R5.2).
 *
 * Implementation strategy: CSS `position: sticky` is the right tool for
 * the "pin while parent scrolls" semantic. The browser handles the
 * actual pinning at native speed, with no JS animation loop, no scroll
 * listener of our own, and no layout thrash. The only knobs we expose
 * are the `top` offset (so callers can clear a sticky header) and the
 * z-index (so callers can layer the pinned child over or under
 * subsequent scenes).
 *
 * The `domId` prop is accepted for API symmetry with `<Parallax>` and
 * for future extension (e.g. logging the active scene's progress for
 * dev tooling). Today the prop is unused at runtime — the pin's range
 * is implicitly the parent's height, which is the correct semantic for
 * "pin while the scene is on screen". Keeping the prop in the public
 * surface lets future versions thread the progress value through
 * without breaking callers.
 *
 * Validates: Requirements 5.2, 5.4
 */

import { type CSSProperties, type ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Component props
// ---------------------------------------------------------------------------

export interface StickyProps {
  /**
   * The scene id this sticky belongs to. Currently advisory — see the
   * file header — but consumers MUST pass the parent scene's id so the
   * intent is captured and so future internal changes (e.g. switching
   * to a JS-driven pin for browsers without `position: sticky`) can
   * read it without an API break.
   */
  readonly domId: string;

  /**
   * Children rendered inside the sticky container. Single child by
   * convention; multiple children are accepted but the caller is
   * responsible for their layout inside the pinned box.
   */
  readonly children: ReactNode;

  /**
   * CSS top offset for the pin, in pixels. Defaults to `0`. Pass a
   * positive value to clear a sticky page header (e.g. `topOffsetPx={64}`
   * when the header is 64 px tall).
   */
  readonly topOffsetPx?: number;

  /**
   * Stack-order index for the pinned child. Defaults to `1` so the pin
   * sits above the scene's flow content but below scene-level overlays
   * (which conventionally use `z-index: 10` and above).
   */
  readonly zIndex?: number;

  /** Forwarded `className`. */
  readonly className?: string;

  /** Forwarded id (rarely needed; the parent scene normally owns the anchor). */
  readonly id?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<Sticky>` — pins `children` for the duration of the parent scene.
 *
 * Renders a single `<div>` with `position: sticky`. The pin range is
 * implicitly the height of the nearest scrolling ancestor (typically
 * the scene `<section>`), so siblings rendered before and after the
 * sticky child move past it as the viewport scrolls.
 *
 * No animation, no scroll listener, no JavaScript-driven layout. Native
 * sticky positioning is the implementation, R5.4-compliant by
 * construction (the browser pins via translation; layout properties
 * are not updated at scroll cadence).
 */
export function Sticky(props: StickyProps) {
  const {
    children,
    topOffsetPx = 0,
    zIndex = 1,
    className,
    id,
  } = props;

  const style: CSSProperties = {
    position: 'sticky',
    top: topOffsetPx,
    zIndex,
  };

  return (
    <div className={className} id={id} style={style}>
      {children}
    </div>
  );
}
