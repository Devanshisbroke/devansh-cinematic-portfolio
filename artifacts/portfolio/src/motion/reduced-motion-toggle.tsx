/**
 * `<ReducedMotionToggle/>` — the in-app reduced-motion control (R13.2, R13.3, R13.12).
 *
 * Renders a `role="switch"` button that exposes the user's
 * Reduced_Motion_Mode preference, plus a sibling "Match system" button
 * that clears the explicit override and falls back to the OS-level
 * `prefers-reduced-motion` setting (see design.md → "In-app reduced-motion
 * toggle").
 *
 * Accessibility contract:
 *  - **R13.2**: `<button role="switch">` is reachable via Tab and
 *    activatable via Enter or Space (native `<button>` semantics carry
 *    those keys; `role="switch"` overlays state semantics without
 *    altering activation).
 *  - **R13.3**: state mutations are persisted via `writeReducedMotion`,
 *    which writes to `localStorage["pcr.reduced-motion"]` and survives
 *    browser sessions on the same device.
 *  - **R13.6**: the global `:focus-visible` rule in `styles/reset.css`
 *    paints a 2 px `--color-amber` ring with ≥ 3:1 non-text contrast on
 *    every supported surface tone — no per-component focus styling is
 *    required.
 *  - **R13.12**: the visible text label "Reduce motion: on" / "off" is a
 *    non-color, non-motion redundant cue alongside the toggle's visual
 *    state — the label flips with `aria-pressed` so AT and sighted
 *    users without color/motion perception both perceive the change.
 *
 * Validates: Requirements 13.1, 13.2, 13.3, 13.12
 */

import { useEffect, useState } from 'react';
import {
  readReducedMotion,
  writeReducedMotion,
  clearReducedMotionPref,
  subscribeReducedMotion,
} from '../accessibility';

export interface ReducedMotionToggleProps {
  /** Optional class applied to the wrapping `<div role="group">`. */
  className?: string;
}

/**
 * Persistent reduced-motion toggle, intended to live in the footer
 * landmark on every page (R13.2 discoverability). The component is
 * fully controlled by `accessibility/reduced-motion-store.ts` —
 * mounting it does not write to `localStorage`; only an explicit
 * click on the toggle or the "Match system" button does.
 */
export function ReducedMotionToggle({ className }: ReducedMotionToggleProps) {
  // Initial render mirrors the resolved store value (explicit override
  // first, then OS-pref, then `false` for SSR/headless).
  const [active, setActive] = useState<boolean>(() => readReducedMotion());

  // Re-sync on OS-pref changes and on writes from any tab. The store's
  // subscribe contract calls back with the freshly-resolved boolean.
  useEffect(() => subscribeReducedMotion(setActive), []);

  const handleToggle = () => {
    writeReducedMotion(!active);
  };

  const handleMatchSystem = () => {
    clearReducedMotionPref();
  };

  return (
    <div
      className={className}
      role="group"
      aria-label="Motion preference"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
      }}
    >
      <button
        type="button"
        role="switch"
        aria-pressed={active}
        aria-label="Reduce motion"
        onClick={handleToggle}
        style={toggleButtonStyle}
      >
        <span aria-hidden="true" style={trackStyle(active)}>
          <span style={thumbStyle(active)} />
        </span>
        <span style={{ fontSize: 'var(--text-small)' }}>
          Reduce motion: {active ? 'on' : 'off'}
        </span>
      </button>
      <button
        type="button"
        onClick={handleMatchSystem}
        aria-label="Match system motion preference"
        style={matchSystemButtonStyle}
      >
        Match system
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline styles — kept colocated so the component drops cleanly into the
// footer landmark without a sibling stylesheet. Tokens come from
// `styles/theme.css`. Focus ring is supplied globally by `:focus-visible`
// in `styles/reset.css`.
// ---------------------------------------------------------------------------

const toggleButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  minHeight: 44,
  padding: 'var(--space-2) var(--space-3)',
  background: 'transparent',
  border: '1px solid var(--color-neutral-400)',
  borderRadius: 'var(--radius-md)',
  color: 'inherit',
  cursor: 'pointer',
  font: 'inherit',
};

const matchSystemButtonStyle: React.CSSProperties = {
  minHeight: 44,
  padding: 'var(--space-2) var(--space-3)',
  background: 'transparent',
  border: '1px solid var(--color-neutral-300)',
  borderRadius: 'var(--radius-md)',
  color: 'inherit',
  cursor: 'pointer',
  font: 'inherit',
  fontSize: 'var(--text-small)',
};

function trackStyle(active: boolean): React.CSSProperties {
  return {
    position: 'relative',
    display: 'inline-block',
    width: 32,
    height: 18,
    borderRadius: 'var(--radius-pill)',
    background: active ? 'var(--color-amber)' : 'var(--color-neutral-300)',
  };
}

function thumbStyle(active: boolean): React.CSSProperties {
  return {
    position: 'absolute',
    top: 2,
    left: active ? 16 : 2,
    width: 14,
    height: 14,
    borderRadius: '50%',
    background: 'var(--color-neutral-0)',
  };
}
