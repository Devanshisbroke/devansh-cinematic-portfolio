/**
 * `<ThemeToggle/>` — the in-app dark/light theme control (R3.5, R3.6, R13.2, R13.12).
 *
 * Renders a `role="switch"` button that exposes the user's theme choice
 * and persists it via `accessibility/theme-store.ts` (storage key
 * `pcr.theme`). Activating the control flips the resolved theme and the
 * store synchronously writes the `data-theme` attribute onto
 * `<html>` so `styles/theme.css`'s `:root[data-theme="…"]` cascade
 * picks up the new value on the next paint.
 *
 * Accessibility contract:
 *  - **R3.5**: a default theme (dark) is rendered before any user
 *    interaction; the store's `readTheme()` falls back to `'dark'`
 *    when no override is persisted.
 *  - **R3.6**: writes go through `writeTheme()`, which mirrors the
 *    selection to `localStorage["pcr.theme"]` so it survives across
 *    browser sessions on the same device. The companion
 *    `THEME_HYDRATION_SCRIPT` (already wired into `index.html` via
 *    `main.tsx`) applies the persisted `data-theme` attribute before
 *    first paint, preventing a flash of wrong theme on subsequent
 *    visits.
 *  - **R13.2**: a `<button role="switch">` is reachable via Tab and
 *    activatable via Enter or Space (native `<button>` semantics
 *    carry those keys; `role="switch"` overlays state semantics
 *    without altering activation). The control lives in the
 *    persistent footer landmark so it is discoverable on every
 *    route.
 *  - **R13.12**: a visible text label `"Theme: dark"` / `"Theme: light"`
 *    flips alongside the `aria-pressed` state — a non-color, non-motion
 *    redundant cue so users without color/motion perception still
 *    perceive the toggle's state.
 *
 * Validates: Requirements 3.5, 3.6, 13.2, 13.12
 */

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import {
  readTheme,
  writeTheme,
  subscribeTheme,
  type Theme,
} from '../../accessibility/theme-store';

export interface ThemeToggleProps {
  /** Optional class applied to the wrapping `<button>`. */
  className?: string;
}

/**
 * Persistent theme toggle, intended to live in the footer landmark on
 * every page (R13.2 discoverability). The component is fully
 * controlled by `accessibility/theme-store.ts` — mounting it does not
 * write to `localStorage`; only an explicit click on the toggle does.
 */
export function ThemeToggle({ className }: ThemeToggleProps = {}) {
  // Initial render mirrors the resolved store value (persisted override
  // first, then default `'dark'` per R3.5).
  const [theme, setTheme] = useState<Theme>(() => readTheme());

  // Re-sync on writes from any other tab. The store's subscribe
  // contract calls back with the freshly-resolved theme.
  useEffect(() => subscribeTheme(setTheme), []);

  const handleToggle = useCallback(() => {
    writeTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme]);

  // `aria-pressed` reflects the "light theme is active" state — the
  // boolean polarity matches the codebase's `<ReducedMotionToggle/>`
  // convention (`aria-pressed={active}`), so AT users perceive a
  // consistent on/off mental model across the footer's two switches.
  const isLight = theme === 'light';

  return (
    <button
      type="button"
      role="switch"
      aria-pressed={isLight}
      aria-label="Theme"
      onClick={handleToggle}
      className={className}
      style={themeToggleStyle}
    >
      <span aria-hidden="true">{isLight ? '☀' : '☾'}</span>
      <span style={{ fontSize: 'var(--text-small)' }}>
        Theme: {theme}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Inline styles — kept colocated so the component drops cleanly into the
// footer landmark without a sibling stylesheet. Tokens come from
// `styles/theme.css`. Focus ring is supplied globally by `:focus-visible`
// in `styles/reset.css`.
// ---------------------------------------------------------------------------

const themeToggleStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  minHeight: 44,
  padding: 'var(--space-2) var(--space-3)',
  background: 'transparent',
  border: '1px solid var(--color-neutral-300)',
  borderRadius: 'var(--radius-md)',
  color: 'inherit',
  font: 'inherit',
  fontSize: 'var(--text-small)',
  cursor: 'pointer',
};
