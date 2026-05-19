import { useEffect, useRef } from 'react';
import { readReducedMotion } from '../../accessibility';
import { routeMap } from '../../route-map/data';
import { play } from '../../audio/sound-engine';

/**
 * CursorAura — a custom dual-ring cursor with per-scene identity.
 *
 * Architecture (the third time around — and finally correct):
 *
 *   • A single rAF loop owns:
 *       1. Inertial pointer tracking (ring lags 18% per frame, dot is 1:1)
 *       2. Scene observation via `getBoundingClientRect` polling on the
 *          five canonical scene anchors from `routeMap`
 *       3. Hover detection on `[data-cursor-magnet]`, links, buttons,
 *          switches.
 *
 *   • Per-scene visual identity is published as **CSS custom properties on
 *     `<html>`** (`--cursor-color`, `--cursor-glow`, `--cursor-radius`,
 *     `--cursor-clip`, `--cursor-ring-bg`, `--cursor-ring-shadow`).
 *
 *   • The ring + dot read those variables from their inline `style` prop.
 *
 *   This decouples scene identity from React's reconciliation: when React
 *   re-renders the component for any reason (hash route change, Suspense
 *   resolving, theme cycle, parent state churn) it rewrites the `style`
 *   prop, but the rewritten value is still `var(--cursor-color)` which
 *   continues to resolve to whatever the cascade currently holds. Direct
 *   `el.style.borderColor = '#X'` writes used to be silently undone by the
 *   next render — that bug is the reason the cursor flashed the right
 *   colour for a few frames on refresh and then snapped back to amber.
 *
 *   IntersectionObserver is intentionally avoided because Lenis smooth
 *   scroll translates the page via `transform`, which means the viewport
 *   sees scene anchors as stationary after first mount and IO callbacks
 *   never fire again. Polling `getBoundingClientRect` every 4 frames is
 *   ≈15Hz × 5 reads — cheap, race-free, and works regardless of how
 *   scrolling is implemented.
 *
 *   threshold → amber circle
 *   compass   → cyan circle
 *   work      → plasma square
 *   ethos     → moss diamond (clip-path)
 *   signal    → amber filled disc with denser glow
 *
 * On coarse pointer (touch) it never mounts. On reduced motion it
 * renders as a static reticle around the actual pointer (no smoothing).
 */

interface SceneStyle {
  /** Primary glow / fill colour. */
  color: string;
  /** Border-radius for both ring and dot. */
  radius: string;
  /** Background of the (otherwise hollow) ring. */
  ringBg: string;
  /** Outer glow for the dot. */
  dotGlow: string;
  /** Inner shadow for the ring (only signal uses this). */
  ringShadow: string;
  /** Clip-path applied to both ring and dot. */
  clip: string;
}

const SCENE_STYLE: Readonly<Record<string, SceneStyle>> = {
  threshold: {
    color: '#FFB347',
    radius: '50%',
    ringBg: 'transparent',
    dotGlow: '0 0 10px #FFB347, 0 0 28px rgba(255,179,71,0.65)',
    ringShadow: 'none',
    clip: 'none',
  },
  compass: {
    color: '#6FD4FF',
    radius: '50%',
    ringBg: 'transparent',
    dotGlow: '0 0 10px #6FD4FF, 0 0 28px rgba(111,212,255,0.65)',
    ringShadow: 'none',
    clip: 'none',
  },
  work: {
    color: '#B388FF',
    radius: '4px',
    ringBg: 'transparent',
    dotGlow: '0 0 10px #B388FF, 0 0 28px rgba(179,136,255,0.65)',
    ringShadow: 'none',
    clip: 'none',
  },
  ethos: {
    color: '#8EB58A',
    radius: '0px',
    ringBg: 'transparent',
    dotGlow: '0 0 10px #8EB58A, 0 0 28px rgba(142,181,138,0.65)',
    ringShadow: 'none',
    clip: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
  },
  signal: {
    color: '#FFB347',
    radius: '50%',
    ringBg: 'rgba(255,179,71,0.08)',
    dotGlow: '0 0 14px #FFB347, 0 0 40px rgba(255,179,71,0.75)',
    ringShadow: 'inset 0 0 18px rgba(255,179,71,0.10)',
    clip: 'none',
  },
};

const FALLBACK = SCENE_STYLE.threshold!;

/** Push the active scene's identity into `<html>` as CSS variables. */
function publishSceneVars(slug: string) {
  const s = SCENE_STYLE[slug] ?? FALLBACK;
  const root = document.documentElement;
  root.style.setProperty('--cursor-color', s.color);
  root.style.setProperty('--cursor-radius', s.radius);
  root.style.setProperty('--cursor-glow', s.dotGlow);
  root.style.setProperty('--cursor-ring-bg', s.ringBg);
  root.style.setProperty('--cursor-ring-shadow', s.ringShadow);
  root.style.setProperty('--cursor-clip', s.clip);
  root.setAttribute('data-cursor-scene', slug);
}

export function CursorAura() {
  const ringRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(pointer: coarse)').matches) return;

    const reduced = readReducedMotion();
    const ring = ringRef.current;
    const dot = dotRef.current;
    if (!ring || !dot) return;

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let ringX = mouseX;
    let ringY = mouseY;
    let scale = 1;
    let targetScale = 1;
    let raf = 0;

    // === Scene tracking ==================================================
    let currentSlug: string = routeMap[0]?.slug ?? 'threshold';
    publishSceneVars(currentSlug);

    const recomputeScene = () => {
      const vh = window.innerHeight || 1;
      const focusY = vh * 0.4; // 40% from top — where the user's eye sits
      let bestSlug = currentSlug;
      let bestDistance = Infinity;
      for (const r of routeMap) {
        const el = document.getElementById(r.domId);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (rect.top <= focusY && rect.bottom >= focusY) {
          // Definitive winner: this section straddles the focus line.
          bestSlug = r.slug;
          bestDistance = 0;
          break;
        }
        const sectionCentre = rect.top + rect.height / 2;
        const distance = Math.abs(sectionCentre - focusY);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestSlug = r.slug;
        }
      }
      if (bestSlug !== currentSlug) {
        currentSlug = bestSlug;
        publishSceneVars(bestSlug);
      }
    };

    // === Pointer state ===================================================
    let isHoveringMagnet = false;
    const onMove = (e: PointerEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      const target = e.target as HTMLElement | null;
      const magnet = target?.closest<HTMLElement>(
        '[data-cursor-magnet], a, button, [role="button"], [role="switch"]',
      );
      
      const nextHover = !!magnet;
      if (nextHover && !isHoveringMagnet) {
        play('tick');
      }
      isHoveringMagnet = nextHover;

      // Tighter hover scaling — 1.6× on explicit magnets, 1.3× on bare links
      // so the cursor reads "alive" without ballooning across CTAs.
      targetScale = magnet
        ? magnet.hasAttribute('data-cursor-magnet')
          ? 1.6
          : 1.3
        : 1;
    };
    const onDown = () => { targetScale *= 0.7; };
    const onUp = () => { if (targetScale < 1) targetScale = 1; };

    // === Render loop ====================================================
    let frame = 0;
    let visible = !document.hidden;
    const onVisibility = () => { visible = !document.hidden; };
    document.addEventListener('visibilitychange', onVisibility);

    const tick = () => {
      if (!visible) {
        raf = requestAnimationFrame(tick);
        return;
      }
      if (reduced) {
        ringX = mouseX;
        ringY = mouseY;
        scale = targetScale;
      } else {
        ringX += (mouseX - ringX) * 0.18;
        ringY += (mouseY - ringY) * 0.18;
        scale += (targetScale - scale) * 0.18;
      }
      ring.style.transform = `translate3d(${ringX - 20}px, ${ringY - 20}px, 0) scale(${scale})`;
      dot.style.transform = `translate3d(${mouseX - 3}px, ${mouseY - 3}px, 0)`;
      // Re-poll scene anchors every 4 frames (~15Hz). 5 reads * 15 = 75/s
      // — negligible cost, immune to scroll source.
      if (frame++ % 4 === 0) recomputeScene();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('pointerup', onUp, { passive: true });

    // Recompute once after a short delay so lazy scenes that mount post-FCP
    // are picked up if the user refreshed deep in the page.
    const settleTimeout = window.setTimeout(recomputeScene, 800);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(settleTimeout);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return (
    <>
      <div
        ref={ringRef}
        aria-hidden="true"
        data-cursor-aura="ring"
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          width: 40,
          height: 40,
          // Per-scene identity is owned by CSS variables on <html>.
          // React re-renders cannot undo these because they resolve via
          // the cascade, not via direct .style writes.
          borderRadius: 'var(--cursor-radius, 50%)',
          borderWidth: 1.5,
          borderStyle: 'solid',
          borderColor: 'var(--cursor-color, #FFB347)',
          background: 'var(--cursor-ring-bg, transparent)',
          boxShadow: 'var(--cursor-ring-shadow, none)',
          clipPath: 'var(--cursor-clip, none)',
          pointerEvents: 'none',
          zIndex: 9999,
          transition:
            'border-color 320ms cubic-bezier(0.16, 1, 0.3, 1), border-radius 320ms cubic-bezier(0.16, 1, 0.3, 1), background 320ms cubic-bezier(0.16, 1, 0.3, 1), clip-path 320ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 320ms cubic-bezier(0.16, 1, 0.3, 1)',
          willChange: 'transform',
        }}
      />
      <div
        ref={dotRef}
        aria-hidden="true"
        data-cursor-aura="dot"
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          width: 6,
          height: 6,
          borderRadius: 'var(--cursor-radius, 50%)',
          background: 'var(--cursor-color, #FFB347)',
          boxShadow: 'var(--cursor-glow, 0 0 10px #FFB347, 0 0 28px rgba(255,179,71,0.65))',
          clipPath: 'var(--cursor-clip, none)',
          pointerEvents: 'none',
          zIndex: 10000,
          transition:
            'background 320ms cubic-bezier(0.16, 1, 0.3, 1), border-radius 320ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 320ms cubic-bezier(0.16, 1, 0.3, 1), clip-path 320ms cubic-bezier(0.16, 1, 0.3, 1)',
          willChange: 'transform',
        }}
      />
    </>
  );
}
