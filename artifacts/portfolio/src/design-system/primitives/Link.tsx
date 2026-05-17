/**
 * Link.tsx — anchor primitive that auto-detects off-origin URLs and
 * applies the safe-target attributes plus a redundant trailing-arrow
 * glyph required by R8.8.
 *
 * Behaviour:
 *  - When `href`'s host differs from `window.location.host`, sets
 *    `target="_blank"` + `rel="noopener noreferrer"` (security default
 *    for cross-origin links) and renders a trailing `↗` glyph as the
 *    non-color redundant cue (R8.8, R7.8).
 *  - On the server (no `window`) the link is treated as same-origin to
 *    avoid leaking a hydration mismatch; the App.tsx tree only renders
 *    in the browser today, so this is a forward-compatibility hedge.
 *  - The `external` prop overrides the auto-detection for the (rare)
 *    cases where a same-host URL must still open in a new tab (e.g.
 *    a downloadable PDF).
 *
 * Validates: Requirements 7.8, 8.8, 13.5, 13.9.
 */

import { type AnchorHTMLAttributes, type ReactNode } from 'react';

function isExternalUrl(href: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const url = new URL(href, window.location.href);
    return url.host !== '' && url.host !== window.location.host;
  } catch {
    return false;
  }
}

export interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'children'> {
  href: string;
  children: ReactNode;
  /** Override the automatic external detection. Defaults to host-comparison. */
  external?: boolean;
  /** Show the ↗ glyph for external links. Defaults to true. */
  showExternalGlyph?: boolean;
}

export function Link({
  href,
  children,
  external,
  showExternalGlyph = true,
  ...rest
}: LinkProps) {
  const isExternal = external ?? isExternalUrl(href);

  if (isExternal) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" {...rest}>
        {children}
        {showExternalGlyph && (
          <span aria-hidden="true" style={{ marginInlineStart: '0.25em' }}>
            ↗
          </span>
        )}
      </a>
    );
  }

  return (
    <a href={href} {...rest}>
      {children}
    </a>
  );
}
