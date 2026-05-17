/**
 * SceneCursorMode — switches the cursor's visual identity per scene.
 *
 * Reads the active scene via IntersectionObserver and writes
 * `data-cursor-scene="<slug>"` to `<html>`. cinema.css picks up the
 * attribute and morphs the dual-ring cursor's color + shape per scene.
 *
 *   threshold → amber circle
 *   compass   → cyan circle
 *   work      → plasma square
 *   ethos     → moss diamond
 *   signal    → amber filled disc (denser glow)
 *
 * The observer self-heals: lazy-mounted scenes (TwinCompass, TheWork,
 * Ethos, Signal) only become observable after their Suspense
 * boundaries resolve, so we run a MutationObserver on document.body
 * and re-attach until every routeMap entry has been seen at least once.
 */

import { useEffect } from 'react';
import { routeMap } from '../../route-map/data';

export function SceneCursorMode() {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (typeof IntersectionObserver === 'undefined') return;

    const slugById = new Map(routeMap.map((r) => [r.domId, r.slug] as const));
    const observed = new Set<string>();
    const seen = new Map<string, number>();
    let io: IntersectionObserver | null = null;
    let mo: MutationObserver | null = null;

    const apply = () => {
      let bestId: string | null = null;
      let bestRatio = -1;
      for (const [id, ratio] of seen) {
        if (ratio > bestRatio) {
          bestRatio = ratio;
          bestId = id;
        }
      }
      if (bestId !== null) {
        const slug = slugById.get(bestId);
        if (slug) {
          document.documentElement.setAttribute('data-cursor-scene', slug);
          // Dev-friendly: also log so we can verify the observer is firing.
          if (process.env.NODE_ENV !== 'production') {
            // eslint-disable-next-line no-console
            console.debug('[SceneCursorMode]', slug, '→', bestRatio.toFixed(2));
          }
        }
      }
    };

    const onIntersection: IntersectionObserverCallback = (entries) => {
      for (const entry of entries) {
        seen.set(entry.target.id, entry.intersectionRatio);
      }
      apply();
    };

    io = new IntersectionObserver(onIntersection, { threshold: [0, 0.25, 0.5, 0.75, 1] });

    const tryAttach = () => {
      let attached = 0;
      for (const r of routeMap) {
        if (observed.has(r.domId)) {
          attached++;
          continue;
        }
        const el = document.getElementById(r.domId);
        if (el) {
          io!.observe(el);
          observed.add(r.domId);
          attached++;
        }
      }
      if (attached === routeMap.length && mo) {
        mo.disconnect();
        mo = null;
      }
    };

    // Initial attempt
    tryAttach();

    // Self-heal: keep watching for lazy scenes to mount
    if (observed.size < routeMap.length) {
      mo = new MutationObserver(() => tryAttach());
      mo.observe(document.body, { childList: true, subtree: true });
    }

    // Set initial attribute so the cursor isn't blank before the first
    // observer callback fires
    document.documentElement.setAttribute('data-cursor-scene', routeMap[0]?.slug ?? 'threshold');

    return () => {
      if (io) io.disconnect();
      if (mo) mo.disconnect();
      document.documentElement.removeAttribute('data-cursor-scene');
    };
  }, []);

  return null;
}
