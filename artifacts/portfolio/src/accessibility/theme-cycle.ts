/**
 * theme-cycle.ts — extends the existing dark/light theme store with a
 * third "studio" mode (high-contrast greyscale, no shader) for
 * screenshotting and press kits.
 *
 * The base store (`theme-store.ts`) only supports `'dark' | 'light'`.
 * This module persists a separate `pcr.theme-mode` key for the cycle:
 *   dark → light → studio → dark
 *
 * The `studio` value sets `<html data-theme="light" data-studio="on">`
 * which the cinema layer reads to suppress the WebGL canvas + cursor
 * effects.
 */

import {
  readTheme,
  writeTheme,
  type Theme,
} from './theme-store';

export type ThemeMode = 'dark' | 'light' | 'studio';

const STUDIO_KEY = 'pcr.theme-mode';

function safeGet(): string | null {
  if (typeof window === 'undefined') return null;
  try { return window.localStorage?.getItem(STUDIO_KEY) ?? null; }
  catch { return null; }
}
function safeSet(value: ThemeMode): void {
  if (typeof window === 'undefined') return;
  try { window.localStorage?.setItem(STUDIO_KEY, value); } catch { /* noop */ }
}

const subscribers = new Set<(mode: ThemeMode) => void>();

export function readThemeMode(): ThemeMode {
  const stored = safeGet();
  if (stored === 'studio') return 'studio';
  return readTheme();
}

export function writeThemeMode(mode: ThemeMode): void {
  safeSet(mode);
  // Apply data-attributes on <html>
  if (typeof document !== 'undefined') {
    if (mode === 'studio') {
      document.documentElement.setAttribute('data-theme', 'light');
      document.documentElement.setAttribute('data-studio', 'on');
      writeTheme('light' satisfies Theme);
    } else {
      document.documentElement.removeAttribute('data-studio');
      writeTheme(mode);
    }
  }
  for (const cb of subscribers) cb(mode);
}

export function cycleThemeMode(): ThemeMode {
  const cur = readThemeMode();
  const next: ThemeMode = cur === 'dark' ? 'light' : cur === 'light' ? 'studio' : 'dark';
  writeThemeMode(next);
  return next;
}

export function subscribeThemeMode(cb: (mode: ThemeMode) => void): () => void {
  subscribers.add(cb);
  return () => { subscribers.delete(cb); };
}
