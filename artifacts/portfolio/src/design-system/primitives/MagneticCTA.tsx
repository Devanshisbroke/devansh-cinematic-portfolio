/**
 * MagneticCTA.tsx — primary call-to-action primitive with a
 * pointer-bounded magnetic translate effect (R7.2).
 *
 * Behaviour:
 *  - The CTA translates toward the pointer while the pointer is inside
 *    its hit-area, capped at `maxOffset` (default 16 CSS px) on each
 *    axis so the visual displacement never exceeds the design budget
 *    set in §12.
 *  - On `pointerleave` the offset returns to (0, 0) within ~100 ms via
 *    a framer-motion spring; this satisfies "released within 100 ms of
 *    pointer leaving the hit-area".
 *  - Under Reduced_Motion_Mode the effect is suppressed (the offset
 *    remains (0, 0) and the transition duration collapses to 0).
 *  - A persistent amber border + an off-screen "Hold for action" label
 *    serve as the non-motion redundant cue required by §12 redundant-
 *    cue table.
 *  - Minimum 44 × 44 CSS-px hit-area (R12.5, R12.8 — coarse-pointer
 *    safe).
 *
 * Validates: Requirements 7.1, 7.2, 7.4, 7.6, 12.5, 12.8, 13.12.
 */

import { motion } from 'framer-motion';
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react';
import { readReducedMotion, subscribeReducedMotion } from '../../accessibility';

const MIN_HIT_PX = 44;
const RELEASE_MS = 100;
const REDUNDANT_CUE_LABEL = 'Hold for action';

export interface MagneticCTAProps {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  className?: string;
  /** Maximum pixels of magnetic translation. Default 16. */
  maxOffset?: number;
  /** Override the redundant-cue label surfaced to AT users. */
  cueLabel?: string;
}

function clampUnit(v: number): number {
  return Math.max(-1, Math.min(1, v));
}

export function MagneticCTA({
  children,
  href,
  onClick,
  className,
  maxOffset = 16,
  cueLabel = REDUNDANT_CUE_LABEL,
}: MagneticCTAProps) {
  const elRef = useRef<HTMLElement | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [reducedMotion, setReducedMotion] = useState<boolean>(() =>
    typeof window === 'undefined' ? false : readReducedMotion(),
  );

  useEffect(() => {
    setReducedMotion(readReducedMotion());
    const unsubscribe = subscribeReducedMotion((active) => {
      setReducedMotion(active);
      if (active) setOffset({ x: 0, y: 0 });
    });
    return unsubscribe;
  }, []);

  const onMouseMove = (e: ReactMouseEvent<HTMLElement>) => {
    if (reducedMotion) return;
    const el = elRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) / (rect.width / 2);
    const dy = (e.clientY - cy) / (rect.height / 2);
    setOffset({
      x: clampUnit(dx) * maxOffset,
      y: clampUnit(dy) * maxOffset,
    });
  };

  const onMouseLeave = () => {
    setOffset({ x: 0, y: 0 });
  };

  const sharedStyle: CSSProperties = {
    minWidth: MIN_HIT_PX,
    minHeight: MIN_HIT_PX,
    border: '2px solid var(--color-amber)',
    borderRadius: 'var(--radius-md)',
    padding: 'var(--space-3) var(--space-5)',
    background: 'transparent',
    color: 'inherit',
    fontFamily: 'var(--font-body)',
    fontWeight: 500,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--space-2)',
    textDecoration: 'none',
  };

  const transition = {
    type: 'spring' as const,
    stiffness: 350,
    damping: 30,
    mass: 0.6,
    restDelta: 0.5,
    duration: reducedMotion ? 0 : RELEASE_MS / 1000,
  };

  const animate = reducedMotion ? { x: 0, y: 0 } : { x: offset.x, y: offset.y };

  // Visually-hidden label so AT users receive the redundant cue without
  // disturbing the visible CTA copy. Sighted users still get the
  // persistent amber border + native `title` tooltip.
  const srOnly: CSSProperties = {
    position: 'absolute',
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    whiteSpace: 'nowrap',
    border: 0,
  };

  if (href) {
    return (
      <motion.a
        ref={(el) => {
          elRef.current = el;
        }}
        href={href}
        className={className}
        style={sharedStyle}
        title={cueLabel}
        animate={animate}
        transition={transition}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        data-cue="magnetic-cta"
      >
        {children}
        <span style={srOnly}>{cueLabel}</span>
      </motion.a>
    );
  }

  return (
    <motion.button
      ref={(el) => {
        elRef.current = el;
      }}
      type="button"
      className={className}
      style={sharedStyle}
      title={cueLabel}
      animate={animate}
      transition={transition}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      data-cue="magnetic-cta"
    >
      {children}
      <span style={srOnly}>{cueLabel}</span>
    </motion.button>
  );
}
