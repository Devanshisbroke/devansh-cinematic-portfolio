import { useEffect, useRef, type ReactNode, type CSSProperties } from 'react';
import { readReducedMotion } from '../../accessibility';

/**
 * MagneticButton — anchor or button with magnetic pull on hover.
 *
 * Inertial smoothing follows pointer position within the element's
 * bounding box; on leave, the button springs back to centre.
 * Reduced-motion clients get a static element with full hover styling
 * intact (R5.7).
 */
export interface MagneticButtonProps {
  href?: string;
  onClick?: () => void;
  variant?: 'primary' | 'ghost';
  ariaLabel?: string;
  children: ReactNode;
  style?: CSSProperties;
  external?: boolean;
}

export function MagneticButton({
  href,
  onClick,
  variant = 'primary',
  ariaLabel,
  children,
  style,
  external,
}: MagneticButtonProps) {
  const wrapRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    if (readReducedMotion()) return;

    let raf = 0;
    let targetX = 0, targetY = 0;
    let curX = 0, curY = 0;
    let inside = false;

    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      targetX = (e.clientX - cx) * 0.25;
      targetY = (e.clientY - cy) * 0.25;
    };
    const onEnter = () => { inside = true; };
    const onLeave = () => { inside = false; targetX = 0; targetY = 0; };

    const tick = () => {
      curX += (targetX - curX) * 0.18;
      curY += (targetY - curY) * 0.18;
      el.style.transform = `translate3d(${curX}px, ${curY}px, 0)`;
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
  }, []);

  const className = variant === 'primary' ? 'cta-primary' : 'cta-ghost';

  if (href) {
    return (
      <a
        ref={wrapRef as React.RefObject<HTMLAnchorElement>}
        href={href}
        target={external ? '_blank' : undefined}
        rel={external ? 'noopener noreferrer' : undefined}
        aria-label={ariaLabel}
        className={className}
        data-cursor-magnet
        style={{ ...style, willChange: 'transform' }}
      >
        {children}
      </a>
    );
  }

  return (
    <button
      ref={wrapRef as React.RefObject<HTMLButtonElement>}
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={className}
      data-cursor-magnet
      style={{ ...style, willChange: 'transform' }}
    >
      {children}
    </button>
  );
}
