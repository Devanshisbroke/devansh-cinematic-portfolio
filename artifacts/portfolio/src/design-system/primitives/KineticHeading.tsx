/**
 * KineticHeading — a heading whose Fraunces variable-font axes
 * (wght + opsz) interpolate based on its viewport position.
 *
 * As the heading approaches the centre of the viewport, weight rises
 * from `weightMin` → `weightMax` and optical size jumps from
 * `opszMin` → `opszMax`. Past the centre, both decay back. The result:
 * each headline gains "confidence" exactly when the user is reading
 * it, then relaxes as it scrolls away.
 *
 * The interpolation runs on a single rAF loop driven by the viewport
 * intersection — no per-frame React renders, no scroll listeners.
 *
 * Validates: variable-font kinetic typography (Tier-A item 6).
 */

import { useEffect, useRef, type CSSProperties, type ElementType, type ReactNode } from 'react';
import { readReducedMotion } from '../../accessibility';

export interface KineticHeadingProps {
  as?: ElementType;
  weightMin?: number;
  weightMax?: number;
  opszMin?: number;
  opszMax?: number;
  children: ReactNode;
  id?: string;
  className?: string;
  style?: CSSProperties;
  ariaLabelledBy?: string;
}

export function KineticHeading({
  as,
  weightMin = 400,
  weightMax = 700,
  opszMin = 36,
  opszMax = 144,
  children,
  id,
  className,
  style,
  ariaLabelledBy,
}: KineticHeadingProps) {
  const ref = useRef<HTMLElement>(null);
  const Component: ElementType = as ?? 'h1';

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (readReducedMotion()) return;

    let raf = 0;
    let stopped = false;

    const tick = () => {
      if (stopped) return;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const elCentre = r.top + r.height / 2;
      const viewportCentre = vh / 2;
      const distance = Math.abs(elCentre - viewportCentre);
      // Normalised: 0 at centre, 1 at viewport edge
      const t = Math.min(1, distance / (vh * 0.55));
      // Inverted ease — heaviest at centre
      const k = 1 - t;
      const eased = k * k;

      const w = weightMin + (weightMax - weightMin) * eased;
      const o = opszMin + (opszMax - opszMin) * eased;

      el.style.fontVariationSettings = `"wght" ${w.toFixed(0)}, "opsz" ${o.toFixed(0)}`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
    };
  }, [weightMin, weightMax, opszMin, opszMax]);

  const composedStyle: CSSProperties = {
    fontFamily: 'var(--font-display)',
    fontVariationSettings: `"wght" ${weightMin}, "opsz" ${opszMin}`,
    ...style,
  };

  return (
    <Component
      ref={ref}
      id={id}
      className={className}
      style={composedStyle}
      aria-labelledby={ariaLabelledBy}
    >
      {children}
    </Component>
  );
}
