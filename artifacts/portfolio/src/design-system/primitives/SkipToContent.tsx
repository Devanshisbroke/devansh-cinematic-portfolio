/**
 * SkipToContent.tsx — visually-hidden-until-focused link that jumps
 * keyboard users past the site chrome to the `<main>` landmark
 * (R13.5, R13.7).
 *
 * Contract:
 *  - Renders a single `<a href="#{targetId}">`; the visual hide-then-
 *    reveal treatment is provided by the global `.skip-to-content`
 *    class in `styles/reset.css`.
 *  - On activation, defers to `focusMain()` from
 *    `accessibility/focus-management.ts` so the registered `<main>`
 *    element receives keyboard focus deterministically (the native
 *    hash-jump alone leaves focus on the `<a>`, breaking screen-
 *    reader narration).
 *  - Must be rendered as the first focusable element on every page
 *    (App.tsx mounts it before the header).
 *
 * Validates: Requirements 13.5, 13.7, 14.7.
 */

import { type MouseEvent as ReactMouseEvent } from 'react';
import { focusMain, getMainContent } from '../../accessibility';

export interface SkipToContentProps {
  className?: string;
  label?: string;
  /** DOM id of the activation target. Defaults to `main-content`. */
  targetId?: string;
}

export function SkipToContent({
  className,
  label = 'Skip to content',
  targetId = 'main-content',
}: SkipToContentProps) {
  const onClick = (e: ReactMouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const explicit = typeof document !== 'undefined' ? document.getElementById(targetId) : null;
    const target = explicit ?? getMainContent();
    if (target) {
      target.focus({ preventScroll: false });
      // Keep the URL hash synced so back-button + reload land on
      // `#main-content` instead of an empty fragment.
      if (typeof history !== 'undefined' && history.replaceState) {
        history.replaceState(null, '', `#${targetId}`);
      }
    } else {
      focusMain();
    }
  };

  const composedClassName = ['skip-to-content', className].filter(Boolean).join(' ');

  return (
    <a href={`#${targetId}`} className={composedClassName} onClick={onClick}>
      {label}
    </a>
  );
}
