/**
 * ThemeCycle — three-state theme switch (dark / light / studio).
 *
 * Replaces the old binary ThemeToggle. Studio mode kills the WebGL
 * shader and renders pure typography on a near-white surface — meant
 * for screenshots, press kits, and accessibility audits.
 */

import { useEffect, useState } from 'react';
import {
  cycleThemeMode,
  readThemeMode,
  subscribeThemeMode,
  type ThemeMode,
} from '../../accessibility/theme-cycle';

const LABEL: Readonly<Record<ThemeMode, string>> = {
  dark: 'Dark',
  light: 'Light',
  studio: 'Studio',
  terminal: 'Terminal',
};

const GLYPH: Readonly<Record<ThemeMode, string>> = {
  dark: '☾',
  light: '☀',
  studio: '◐',
  terminal: '⌨',
};

export function ThemeCycle({ className }: { className?: string }) {
  const [mode, setMode] = useState<ThemeMode>(() => readThemeMode());

  useEffect(() => subscribeThemeMode(setMode), []);

  return (
    <button
      type="button"
      role="switch"
      aria-checked={mode === 'light' || mode === 'studio'}
      aria-label={`Theme: ${LABEL[mode]} (click to cycle)`}
      onClick={() => cycleThemeMode()}
      data-cursor-magnet
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        padding: 'var(--space-2) var(--space-3)',
        minHeight: 36,
        background: 'transparent',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 'var(--radius-pill)',
        color: 'inherit',
        fontFamily: 'var(--font-body)',
        fontSize: 'var(--text-small)',
        cursor: 'none',
      }}
    >
      <span aria-hidden="true">{GLYPH[mode]}</span>
      <span>Theme: {LABEL[mode]}</span>
    </button>
  );
}
