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

    let elements: KineticElement[] = collect();
    let raf = 0;
    let stopped = false;
    let visible = !document.hidden;

    // Debounced re-collect — coalesces successive lazy scene mounts into
    // a single pass per frame instead of one per insertion.
    let recollectTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleRecollect = () => {
      if (recollectTimer !== null) return;
      recollectTimer = setTimeout(() => {
        recollectTimer = null;
        elements = collect();
      }, 80);
    };
    const mo = new MutationObserver(scheduleRecollect);
    mo.observe(document.body, { childList: true, subtree: true });

    const tick = () => {
      if (stopped) return;
      if (!visible) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const vh = window.innerHeight || 1;
      const viewportCentre = vh / 2;
      const cull = vh * 0.6;
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
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return null;
}
