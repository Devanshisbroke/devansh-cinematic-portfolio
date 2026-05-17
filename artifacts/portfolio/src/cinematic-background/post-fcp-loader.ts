/**
 * Lazy import-after-FCP scheduler for the Cinematic_Background WebGLLayer.
 *
 * R10.4 requires the Cinematic_Background to be lazy-loaded after FCP so the
 * initial HTML/CSS render is not blocked by the WebGL module's download,
 * parse, or shader compilation.
 *
 * Strategy:
 *  - Use `requestIdleCallback(cb, { timeout: 1500 })` when available.
 *  - Fall back to `setTimeout(cb, 250)` on browsers without idle callback.
 *  - The callback dynamic-imports `./webgl/WebGLLayer` to warm the chunk
 *    cache; the actual mount happens via `React.lazy` in
 *    `CinematicBackground.tsx`.
 */
export function schedulePostFCPLoad(): void {
  if (typeof window === 'undefined') return;

  const load = () => {
    // Fire-and-forget dynamic import. Errors here degrade silently to the
    // static fallback (CinematicBackground.tsx renders the static path
    // when the lazy import fails).
    import('./webgl/WebGLLayer').catch(() => {
      /* swallow — capability resolver will pick the static path */
    });
  };

  const idle = (
    window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number;
    }
  ).requestIdleCallback;
  if (typeof idle === 'function') {
    idle(load, { timeout: 1500 });
  } else {
    setTimeout(load, 250);
  }
}
