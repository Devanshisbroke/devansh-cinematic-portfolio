/**
 * FocusRing.tsx — explicit focus-ring overlay primitive.
 *
 * The portfolio's primary focus indicator is the global `:focus-visible`
 * rule in `styles/reset.css`, which composes `--shadow-focus` with a
 * 2 CSS-px amber outline (R13.6 ≥ 2 CSS-px, ≥ 3:1 contrast on every
 * surface). This component is for the rare case where a child element
 * cannot itself receive focus (for example, a clickable card that
 * delegates focus to a descendant `<a>`); it forwards focus visibility
 * outward so the ring still appears on the natural focus boundary.
 *
 * It is intentionally a thin wrapper: the real visual treatment lives
 * in CSS so the ring stays consistent with every other focusable
 * surface in the document.
 *
 * Validates: Requirements 7.1, 7.3, 13.6, 13.7.
 */

import { type CSSProperties, type ReactNode } from 'react';

export interface FocusRingProps {
  children: ReactNode;
  className?: string;
  /**
   * When true the wrapper itself becomes focusable and shows the ring.
   * Defaults to false: the ring renders on whichever descendant
   * element actually receives focus.
   */
  focusable?: boolean;
}

/**
 * Renders a wrapper that participates in the global focus-ring style.
 * Children retain their own focus behaviour; the wrapper is a layout
 * box, not a focus stop, unless `focusable` is set.
 */
export function FocusRing({ children, className, focusable = false }: FocusRingProps) {
  const style: CSSProperties = {
    position: 'relative',
    display: 'inline-block',
  };

  return (
    <span
      className={className}
      style={style}
      tabIndex={focusable ? 0 : -1}
      data-focus-ring=""
    >
      {children}
    </span>
  );
}
