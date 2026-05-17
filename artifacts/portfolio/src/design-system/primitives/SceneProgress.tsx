/**
 * SceneProgress — segmented top-of-page progress bar + nav-link sync.
 *
 * Five segments, one per scene. Each segment fills as the corresponding
 * scene's #-anchor crosses the viewport. The active segment glows
 * brighter; completed segments stay fully colored; future segments
 * stay dim.
 *
 * Side-effect: this component is also the single source of truth for
 * which nav link is "active". It writes `data-active="true"` onto the
 * `[data-nav-slug="..."]` anchor matching the scene that currently
 * owns the viewport, so the header navigation can highlight without
 * adding its own scroll listener (R5.2).
 *
 * Pure rAF + getBoundingClientRect; no scroll listeners.
 */

import { useEffect, useRef, useState } from 'react';
import { routeMap } from '../../route-map/data';
import { readReducedMotion } from '../../accessibility';

const HUES = ['#FFB347', '#6FD4FF', '#B388FF', '#8EB58A', '#FFB347'];

export function SceneProgress() {
  const [progress, setProgress] = useState<number[]>(() => routeMap.map(() => 0));
  const rafRef = useRef(0);
  const lastActiveSlugRef = useRef<string>('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const reduced = readReducedMotion();

    let stopped = false;

    const writeActiveNavLink = (slug: string) => {
      if (slug === lastActiveSlugRef.current) return;
      lastActiveSlugRef.current = slug;
      const links = document.querySelectorAll<HTMLAnchorElement>('[data-nav-slug]');
      links.forEach((a) => {
        const isActive = a.dataset.navSlug === slug;
        if (isActive) {
          a.setAttribute('data-active', 'true');
          a.setAttribute('aria-current', 'location');
        } else {
          a.removeAttribute('data-active');
          a.removeAttribute('aria-current');
        }
      });
    };

    const tick = () => {
      if (stopped) return;
      const vh = window.innerHeight || 1;
      const focusY = vh * 0.35;
      const next: number[] = [];
      let activeSlug = routeMap[0]?.slug ?? '';
      let bestDistance = Infinity;
      for (const entry of routeMap) {
        const el = document.getElementById(entry.domId);
        if (!el) {
          next.push(0);
          continue;
        }
        const r = el.getBoundingClientRect();
        // Per-segment fill — biased so the bar reads "elapsed" not "intersecting".
        const visibleTop = Math.max(0, -r.top);
        const total = Math.max(1, r.height);
        next.push(Math.min(1, visibleTop / total));
        // Active scene: closest-centre to focusY, with hard win when the
        // focus line is inside the section.
        if (r.top <= focusY && r.bottom >= focusY) {
          activeSlug = entry.slug;
          bestDistance = 0;
        } else {
          const d = Math.abs(r.top + r.height / 2 - focusY);
          if (d < bestDistance) {
            bestDistance = d;
            activeSlug = entry.slug;
          }
        }
      }
      writeActiveNavLink(activeSlug);
      setProgress((prev) => {
        if (reduced) return next;
        return prev.map((p, i) => p + (next[i]! - p) * 0.18);
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      stopped = true;
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 2,
        zIndex: 100,
        display: 'grid',
        gridTemplateColumns: `repeat(${routeMap.length}, 1fr)`,
        gap: 2,
        padding: '0 2px',
        pointerEvents: 'none',
      }}
    >
      {routeMap.map((entry, i) => {
        const p = progress[i] ?? 0;
        const hue = HUES[i] ?? '#FFB347';
        const isActive = p > 0 && p < 1;
        return (
          <div
            key={entry.slug}
            style={{
              position: 'relative',
              height: 2,
              background: 'rgba(255,255,255,0.04)',
              borderRadius: 999,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                width: `${(p * 100).toFixed(2)}%`,
                background: `linear-gradient(90deg, ${hue}80, ${hue})`,
                boxShadow: isActive
                  ? `0 0 8px ${hue}, 0 0 24px ${hue}80`
                  : 'none',
                transition: 'box-shadow 240ms cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
