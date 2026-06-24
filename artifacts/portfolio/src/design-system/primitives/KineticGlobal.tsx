/**
 * KineticGlobal — single global rAF loop that drives variable-font
 * weight + opsz on every element marked `data-kinetic`.
 *
 * Each element is tracked by its bounding-box centre relative to the
 * viewport centre. As elements approach the centre of the viewport,
 * font weight rises smoothly. Off under reduced motion. Pauses when
 * the tab is hidden so we don't burn battery on a backgrounded page.
 *
 * The element list is refreshed via a debounced MutationObserver so
 * lazy scenes are picked up as they mount; frame-time DOM walks stay
 * O(visible elements) using `getBoundingClientRect` skip logic.
 */

import { useEffect } from 'react';
import { readReducedMotion } from '../../accessibility';

interface KineticElement {
  el: HTMLElement;
  weightMin: number;
  weightMax: number;
  opszMin: number;
  opszMax: number;
}

interface KineticJellyElement {
  el: HTMLElement;
  skewFactor: number;
}

export function KineticGlobal() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (readReducedMotion()) return;

    const collect = (): KineticElement[] =>
      Array.from(document.querySelectorAll<HTMLElement>('[data-kinetic]')).map((el) => ({
        el,
        weightMin: Number(el.dataset.kineticWeightMin ?? 400),
        weightMax: Number(el.dataset.kineticWeightMax ?? 700),
        opszMin: Number(el.dataset.kineticOpszMin ?? 36),
        opszMax: Number(el.dataset.kineticOpszMax ?? 144),
      }));

    const collectJelly = (): KineticJellyElement[] =>
      Array.from(document.querySelectorAll<HTMLElement>('[data-kinetic-jelly]')).map((el) => ({
        el,
        skewFactor: Number(el.dataset.kineticJellyFactor ?? 8),
      }));

    let elements: KineticElement[] = collect();
    let jellyElements: KineticJellyElement[] = collectJelly();
    let raf = 0;
    let stopped = false;
    let visible = !document.hidden;

    let lastScrollY = window.scrollY;
    let lastTime = performance.now();
    let scrollVelocity = 0;

    // Mouse velocity tracking
    let mouseX = 0;
    let mouseY = 0;
    let lastMouseX = 0;
    let lastMouseY = 0;
    let hasMouseMoved = false;
    let smoothedMouseVx = 0;
    let smoothedMouseVy = 0;

    const onPointerMove = (e: PointerEvent) => {
      if (!hasMouseMoved) {
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
        hasMouseMoved = true;
      }
      mouseX = e.clientX;
      mouseY = e.clientY;
    };
    window.addEventListener('pointermove', onPointerMove, { passive: true });

    // Debounced re-collect — coalesces successive lazy scene mounts
    let recollectTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleRecollect = () => {
      if (recollectTimer !== null) return;
      recollectTimer = setTimeout(() => {
        recollectTimer = null;
        elements = collect();
        jellyElements = collectJelly();
      }, 80);
    };
    const mo = new MutationObserver(scheduleRecollect);
    mo.observe(document.body, { childList: true, subtree: true });

    const tick = (now: number) => {
      if (stopped) return;
      if (!visible) {
        lastTime = performance.now();
        lastScrollY = window.scrollY;
        if (hasMouseMoved) {
          lastMouseX = mouseX;
          lastMouseY = mouseY;
          hasMouseMoved = false;
        }
        raf = requestAnimationFrame(tick);
        return;
      }

      const dt = Math.max(8, now - lastTime);
      
      // Scroll velocity
      const dy = window.scrollY - lastScrollY;
      const rawVelocity = dy / dt;
      scrollVelocity += (rawVelocity - scrollVelocity) * 0.15;

      // Mouse velocity
      let mouseVx = 0;
      let mouseVy = 0;
      if (hasMouseMoved) {
        mouseVx = (mouseX - lastMouseX) / dt;
        mouseVy = (mouseY - lastMouseY) / dt;
        lastMouseX = mouseX;
        lastMouseY = mouseY;
        hasMouseMoved = false;
      }
      
      smoothedMouseVx += (mouseVx - smoothedMouseVx) * 0.12;
      smoothedMouseVy += (mouseVy - smoothedMouseVy) * 0.12;

      // Apply decel spring dampening
      smoothedMouseVx *= 0.92;
      smoothedMouseVy *= 0.92;

      lastTime = now;
      lastScrollY = window.scrollY;

      // Fast-path check: if stationary and velocities are decayed, bypass layout reads
      const isScrollActive = Math.abs(scrollVelocity) > 0.001 || Math.abs(dy) > 0.01;
      const isMouseActive = Math.abs(smoothedMouseVx) > 0.001 || Math.abs(smoothedMouseVy) > 0.001;

      if (!isScrollActive && !isMouseActive) {
        raf = requestAnimationFrame(tick);
        return;
      }

      const skew = Math.max(-4, Math.min(4, scrollVelocity * 1.5));
      const mSkewX = Math.max(-10, Math.min(10, smoothedMouseVx * 8));
      const mSkewY = Math.max(-10, Math.min(10, smoothedMouseVy * 8));

      const vh = window.innerHeight || 1;
      const viewportCentre = vh / 2;
      const cull = vh * 0.6;

      // 1. Update font-weight animation (data-kinetic)
      for (const k of elements) {
        const r = k.el.getBoundingClientRect();
        if (r.bottom < -cull || r.top > vh + cull) continue;
        const elCentre = r.top + r.height / 2;
        const distance = Math.abs(elCentre - viewportCentre);
        const t = Math.min(1, distance / (vh * 0.55));
        const k2 = (1 - t) * (1 - t);
        const w = k.weightMin + (k.weightMax - k.weightMin) * k2;
        const o = k.opszMin + (k.opszMax - k.opszMin) * k2;
        k.el.style.fontVariationSettings = `"wght" ${w.toFixed(0)}, "opsz" ${o.toFixed(0)}`;
        if (Math.abs(skew) > 0.1) {
          k.el.style.transform = `skewY(${skew.toFixed(2)}deg)`;
        } else {
          k.el.style.transform = '';
        }
      }

      // 2. Update jelly layout distortion (data-kinetic-jelly)
      for (const k of jellyElements) {
        const r = k.el.getBoundingClientRect();
        if (r.bottom < -cull || r.top > vh + cull) continue;
        
        const finalSkewX = mSkewX * (k.skewFactor / 8);
        const finalSkewY = (mSkewY + skew) * (k.skewFactor / 8);

        if (Math.abs(finalSkewX) > 0.05 || Math.abs(finalSkewY) > 0.05) {
          k.el.style.transform = `skewX(${finalSkewX.toFixed(2)}deg) skewY(${finalSkewY.toFixed(2)}deg) translate3d(0,0,0)`;
        } else {
          k.el.style.transform = '';
        }
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const onVisibility = () => {
      visible = !document.hidden;
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      mo.disconnect();
      if (recollectTimer !== null) clearTimeout(recollectTimer);
      window.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return null;
}
