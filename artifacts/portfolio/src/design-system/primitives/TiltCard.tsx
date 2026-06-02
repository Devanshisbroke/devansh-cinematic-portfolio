/**
 * TiltCard — anchor or button with 3D pointer-tilt.
 *
 * Pointer position relative to the element's bounding box drives
 * `rotateX / rotateY` (capped at ±6°) plus a subtle translate-Z lift.
 * Inertial smoothing for buttery feel; resets on pointer-leave.
 *
 * Off on touch and reduced-motion. Lifts the element above siblings on
 * hover via `z-index: 1` so the rotated card never gets clipped.
 */

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { readReducedMotion } from '../../accessibility';

export interface TiltCardProps {
  href: string;
  children: ReactNode;
  ariaLabel?: string;
  className?: string;
  style?: CSSProperties;
  maxTilt?: number; // degrees
  liftPx?: number;
}

export function TiltCard({
  href,
  children,
  ariaLabel,
  className,
  style,
  maxTilt = 6,
  liftPx = 12,
}: TiltCardProps) {
  const ref = useRef<HTMLAnchorElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    const inner = innerRef.current;
    if (!el || !inner) return;
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(pointer: coarse)').matches) return;
    if (readReducedMotion()) return;

    let raf = 0;
    let targetX = 0;
    let targetY = 0;
    let curX = 0;
    let curY = 0;
    let targetZ = 0;
    let curZ = 0;
    let inside = false;

    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      // Normalised offset −1..1
      const nx = (e.clientX - cx) / (r.width / 2);
      const ny = (e.clientY - cy) / (r.height / 2);
      // Tilt: y-cursor rotates X axis (negative for natural feel)
      targetX = -ny * maxTilt;
      targetY = nx * maxTilt;
      targetZ = liftPx;
      
      inner.style.setProperty('--mouse-x', `${e.clientX - r.left}px`);
      inner.style.setProperty('--mouse-y', `${e.clientY - r.top}px`);
    };
    const onEnter = () => {
      inside = true;
      el.style.zIndex = '1';
      inner.style.setProperty('--spotlight-opacity', '1');
      inner.style.setProperty('--content-z', '40px');
    };
    const onLeave = () => {
      inside = false;
      targetX = 0;
      targetY = 0;
      targetZ = 0;
      inner.style.setProperty('--spotlight-opacity', '0');
      inner.style.setProperty('--content-z', '0px');
    };

    const tick = () => {
      curX += (targetX - curX) * 0.15;
      curY += (targetY - curY) * 0.15;
      curZ += (targetZ - curZ) * 0.15;
      inner.style.transform = `perspective(800px) rotateX(${curX.toFixed(2)}deg) rotateY(${curY.toFixed(2)}deg) translateZ(${curZ.toFixed(1)}px)`;
      // Drop z-index back when fully settled and not hovering
      if (!inside && Math.abs(curZ) < 0.1) {
        el.style.zIndex = '';
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    el.addEventListener('pointerenter', onEnter);
    el.addEventListener('pointerleave', onLeave);
    el.addEventListener('pointermove', onMove as EventListener);

    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('pointerenter', onEnter);
      el.removeEventListener('pointerleave', onLeave);
      el.removeEventListener('pointermove', onMove as EventListener);
    };
  }, [maxTilt, liftPx]);

  return (
    <a
      ref={ref}
      href={href}
      data-cursor-magnet
      aria-label={ariaLabel}
      className={className}
      style={{
        ...style,
        textDecoration: 'none',
        color: 'inherit',
        display: 'block',
        transformStyle: 'preserve-3d',
        position: 'relative',
      }}
    >
      <div
        ref={innerRef}
        style={{
          width: '100%',
          height: '100%',
          willChange: 'transform',
          transformStyle: 'preserve-3d',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 0,
            background: `radial-gradient(circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(255,255,255,0.06) 0%, transparent 60%)`,
            opacity: 'var(--spotlight-opacity, 0)',
            transition: 'opacity 300ms ease',
            borderRadius: 'inherit',
          }}
        />
        <div style={{ 
          position: 'relative', 
          zIndex: 1, 
          height: '100%',
          transform: 'translateZ(var(--content-z, 0px))',
          transition: 'transform 300ms cubic-bezier(0.19, 1, 0.22, 1)',
        }}>
          {children}
        </div>
      </div>
    </a>
  );
}
