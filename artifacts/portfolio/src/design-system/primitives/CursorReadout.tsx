/**
 * CursorReadout — a hovering label that follows the cursor with a brief
 * action description when the user hovers an interactive element.
 *
 * Reads `data-cursor-label` from the hovered element; falls back to a
 * sensible default based on element type (anchor → "open external" or
 * "scroll to", button → "activate"). Decays in 600ms after pointer leaves.
 *
 * Tiny, dim, monospace — designed to be felt rather than read.
 */

import { useEffect, useRef, useState } from 'react';
import { readReducedMotion } from '../../accessibility';

export function CursorReadout() {
  const [label, setLabel] = useState<string>('');
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(pointer: coarse)').matches) return;

    const reduced = readReducedMotion();
    let raf = 0;
    let mouseX = 0;
    let mouseY = 0;
    let renderX = 0;
    let renderY = 0;

    const computeLabel = (target: HTMLElement | null): string => {
      if (!target) return '';
      const cur = target.closest<HTMLElement>(
        '[data-cursor-label], a, button, [role="button"], [role="switch"]',
      );
      if (!cur) return '';
      const explicit = cur.getAttribute('data-cursor-label');
      if (explicit) return explicit;
      if (cur.tagName === 'A') {
        const href = cur.getAttribute('href') ?? '';
        if (href.startsWith('#')) return `→ scroll · ${href.slice(1)}`;
        if (href.startsWith('mailto:')) return '→ compose · email';
        if (href.startsWith('http')) {
          try {
            const u = new URL(href);
            return `→ open · ${u.hostname.replace(/^www\./, '')}`;
          } catch {
            return '→ open external';
          }
        }
        return '→ navigate';
      }
      const role = cur.getAttribute('role');
      if (role === 'switch') return '→ toggle';
      if (cur.tagName === 'BUTTON') return '→ activate';
      return '';
    };

    const onMove = (e: PointerEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      const target = e.target as HTMLElement | null;
      const newLabel = computeLabel(target);
      setLabel(newLabel);
      setVisible(newLabel.length > 0);
    };
    const onLeave = () => setVisible(false);

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerleave', onLeave);

    const tick = () => {
      const el = ref.current;
      if (el) {
        if (reduced) {
          renderX = mouseX;
          renderY = mouseY;
        } else {
          renderX += (mouseX - renderX) * 0.18;
          renderY += (mouseY - renderY) * 0.18;
        }
        // Offset to bottom-right of cursor (avoid cursor occlusion)
        el.style.transform = `translate3d(${renderX + 18}px, ${renderY + 14}px, 0)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        zIndex: 9997,
        pointerEvents: 'none',
        opacity: visible ? 0.85 : 0,
        transition: 'opacity 240ms cubic-bezier(0.16, 1, 0.3, 1)',
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        color: '#FFB347',
        textShadow: '0 0 6px rgba(0,0,0,0.8), 0 0 16px rgba(255,179,71,0.3)',
        whiteSpace: 'nowrap',
        willChange: 'transform, opacity',
      }}
    >
      {label}
    </div>
  );
}
