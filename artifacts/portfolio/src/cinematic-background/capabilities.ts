import { readReducedMotion } from '../accessibility';

export type CinematicMode = 'webgl' | 'static' | 'off';

/**
 * Probe whether the runtime can produce a WebGL context.
 * Creates a temporary canvas, attempts to obtain a `webgl` or `experimental-webgl`
 * context, and returns `true` if successful. The canvas is discarded immediately.
 */
export function hasWebGL(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('webgl') ?? canvas.getContext('experimental-webgl');
    return ctx !== null;
  } catch {
    return false;
  }
}

/**
 * Resolve the operating mode for the Cinematic_Background.
 *
 *   `off`    — server-side / SSR. Renders nothing.
 *   `static` — reduced-motion, Save-Data, low-end hardware, or no WebGL.
 *   `webgl`  — capable client without restrictive preferences.
 *
 * Source-of-truth gate for the four design constraints:
 *   R5.7  — reduced-motion forces static.
 *   R12.6 — Save-Data forces static.
 *   R12.7 — hardwareConcurrency ≤ 4 OR deviceMemory ≤ 4 forces static.
 *   R12.9 — no WebGL forces static.
 */
export function resolveCinematicMode(): CinematicMode {
  if (typeof window === 'undefined') return 'off';
  if (readReducedMotion()) return 'static';

  const conn = (navigator as { connection?: { saveData?: boolean } }).connection;
  if (conn?.saveData === true) return 'static';

  const cores = navigator.hardwareConcurrency ?? 8;
  const mem = (navigator as { deviceMemory?: number }).deviceMemory ?? 8;
  if (cores <= 4 || mem <= 4) return 'static';

  if (!hasWebGL()) return 'static';

  return 'webgl';
}
