import { lazy, Suspense, useEffect, useState, type CSSProperties } from 'react';
import { resolveCinematicMode, type CinematicMode } from './capabilities';

/**
 * Public boundary for the Cinematic_Background.
 *
 * R10.4: this module is the only entry point the rest of the application
 * imports. It does NOT statically import anything from `./webgl/*`; the
 * GPU-touching `WebGLLayer` is brought in via `React.lazy` so its source,
 * shader strings, and `WebGLRenderingContext` types stay out of the
 * initial JS bundle.
 *
 * R3.7: rendered behind all foreground content (`z-index: -1`,
 * `position: fixed`, `inset: 0`) and non-interactive (`pointer-events:
 * none`, `aria-hidden`).
 *
 * R3.8: when the layer is removed or disabled (mode !== 'webgl'), the
 * static fallback `<div data-cinematic="static" />` occupies the same
 * fixed, behind-everything position so removing the cinematic layer
 * does not collapse, clip, or reflow foreground sections.
 */
const WebGLLayer = lazy(() => import('./webgl/WebGLLayer'));

const layerStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: -1,
  pointerEvents: 'none',
  background:
    'radial-gradient(ellipse at top, var(--surface-elevated-1) 0%, var(--surface-base) 70%)',
};

function StaticBackground() {
  return <div data-cinematic="static" aria-hidden="true" style={layerStyle} />;
}

export function CinematicBackground() {
  // Resolve mode on the client only. `resolveCinematicMode` returns
  // 'off' under SSR; the initial render therefore matches a static
  // placeholder, and the effect upgrades to 'webgl' if the runtime
  // is capable and the user has not opted out.
  const [mode, setMode] = useState<CinematicMode>('off');

  useEffect(() => {
    setMode(resolveCinematicMode());
  }, []);

  if (mode !== 'webgl') {
    return <StaticBackground />;
  }

  return (
    <Suspense fallback={<StaticBackground />}>
      <WebGLLayer />
    </Suspense>
  );
}

export default CinematicBackground;
