/**
 * SupportDeskOps-v6 reveal — full-bleed canvas, RL telemetry aesthetic.
 *
 * A flowing reward-curve fills the canvas while step-by-step decision
 * markers, agent state, and a live counter materialise around the prose.
 * This reveal is the most cinematic of the four — feels like watching
 * a training run.
 */

import { motion, useInView } from 'framer-motion';
import { useEffect, useRef, useState, useMemo } from 'react';
import type { Project_Record } from '../../../content-registry/types';
import { Surface } from '../../../design-system/primitives/Surface';
import { Link } from '../../../design-system/primitives/Link';
import { readReducedMotion, subscribeReducedMotion } from '../../../accessibility';
import { RevealConviction } from '../RevealConviction';

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

/** Build a smooth reward curve and an array of decision-point markers. */
function buildCurve() {
  const points: { x: number; y: number }[] = [];
  for (let x = 0; x <= 100; x += 1) {
    const baseY = 75 - x * 0.55;
    const variation = Math.sin(x * 0.18) * 6 + Math.sin(x * 0.42) * 2;
    points.push({ x, y: baseY + variation });
  }
  const path = `M ${points.map((p) => `${p.x},${p.y}`).join(' L ')}`;

  // Pick markers at 20, 40, 60, 80
  const markers = [20, 40, 60, 80].map((mx) => {
    const p = points[mx]!;
    return { x: mx, y: p.y };
  });

  return { path, markers };
}

export function SupportDeskOpsReveal({ project }: { project: Project_Record }) {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.15 });
  const [reduced, setReduced] = useState<boolean>(() =>
    typeof window === 'undefined' ? false : readReducedMotion(),
  );
  const [counter, setCounter] = useState(0);
  const [flash, setFlash] = useState(false);
  useEffect(() => subscribeReducedMotion(setReduced), []);

  const { path, markers } = useMemo(() => buildCurve(), []);

  // Counter animation
  useEffect(() => {
    if (!inView) return;
    if (reduced) {
      setCounter(94);
      return;
    }
    const start = performance.now();
    const startDelay = 600;
    const dur = 1400;
    let raf = 0;
    const tick = (now: number) => {
      const t = now - start - startDelay;
      if (t < 0) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const p = Math.min(1, t / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setCounter(Math.round(eased * 94));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, reduced]);

  // Flash
  useEffect(() => {
    if (!inView || reduced) return;
    const t = setTimeout(() => {
      setFlash(true);
      setTimeout(() => setFlash(false), 220);
    }, 2400);
    return () => clearTimeout(t);
  }, [inView, reduced]);

  return (
    <Surface
      as="section"
      ref={ref}
      id={`scene-work-${project.id}`}
      aria-labelledby={`reveal-${project.id}-h3`}
      tone="base"
      data-reveal-layout="full-bleed-canvas"
      data-warp-trigger="supportdeskops"
      style={{
        position: 'relative',
        minHeight: '100dvh',
        padding: 'clamp(var(--space-7), 5vw, var(--space-9))',
        overflow: 'hidden',
        backgroundColor: 'transparent',
        background:
          'radial-gradient(120% 80% at 100% 0%, rgba(184,82,30,0.10), transparent 60%), radial-gradient(120% 80% at 0% 100%, rgba(232,165,71,0.08), transparent 60%)',
      }}
    >
      {/* Reward-curve canvas */}
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
        className="glitch-hover"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          opacity: 0.6,
        }}
      >
        <defs>
          <linearGradient id="curve-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(184,82,30,0.0)" />
            <stop offset="40%" stopColor="rgba(184,82,30,0.6)" />
            <stop offset="100%" stopColor="rgba(232,165,71,1)" />
          </linearGradient>
          <linearGradient id="area-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(232,165,71,0.18)" />
            <stop offset="100%" stopColor="rgba(232,165,71,0)" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {[20, 40, 60, 80].map((x) => (
          <line key={`v-${x}`} x1={x} y1="0" x2={x} y2="100" stroke="rgba(180,175,165,0.06)" strokeWidth="0.1" />
        ))}
        {[20, 40, 60, 80].map((y) => (
          <line key={`h-${y}`} x1="0" y1={y} x2="100" y2={y} stroke="rgba(180,175,165,0.06)" strokeWidth="0.1" />
        ))}

        {/* Curve area */}
        <motion.path
          d={`${path} L 100,100 L 0,100 Z`}
          fill="url(#area-grad)"
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : undefined}
          transition={{ duration: reduced ? 0.12 : 1.6, ease: 'linear' }}
        />

        {/* Curve line */}
        <motion.path
          d={path}
          fill="none"
          stroke="url(#curve-grad)"
          strokeWidth="0.6"
          initial={{ pathLength: 0 }}
          animate={inView ? { pathLength: 1 } : undefined}
          transition={{ duration: reduced ? 0.12 : 1.6, ease: 'linear' }}
        />

        {/* Decision markers */}
        {markers.map((m, i) => (
          <g key={i}>
            <motion.circle
              cx={m.x}
              cy={m.y}
              r="0.8"
              fill="var(--color-amber)"
              initial={{ opacity: 0, scale: reduced ? 1 : 0 }}
              animate={inView ? { opacity: 1, scale: 1 } : undefined}
              transition={{
                duration: reduced ? 0.12 : 0.4,
                delay: reduced ? 0 : 0.3 + i * 0.32,
                ease: EASE,
              }}
            />
          </g>
        ))}
      </svg>

      {/* Flash overlay */}
      <motion.div
        animate={{ opacity: flash ? 0.18 : 0 }}
        transition={{ duration: 0.22 }}
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(60% 50% at 80% 20%, rgba(232,165,71,1), transparent 70%)',
          pointerEvents: 'none',
        }}
        aria-hidden="true"
      />

      {/* Top-left: status pill */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={inView ? { opacity: 1, y: 0 } : undefined}
        transition={{ duration: reduced ? 0.12 : 0.6, ease: EASE }}
        className="eyebrow"
        style={{ position: 'relative', zIndex: 2 }}
      >
        03 · SupportDeskOps-v6 · Reinforcement learning
      </motion.div>

      {/* Bottom-left: headline + summary */}
      <div
        style={{
          position: 'absolute',
          bottom: 'clamp(var(--space-7), 5vw, var(--space-9))',
          left: 'clamp(var(--space-5), 4vw, var(--space-9))',
          right: 'clamp(var(--space-5), 4vw, var(--space-9))',
          maxWidth: '60ch',
          zIndex: 2,
        }}
      >
        <motion.div
          initial={{ y: reduced ? 0 : 32, opacity: 0 }}
          animate={inView ? { y: 0, opacity: 1 } : undefined}
          transition={{
            duration: reduced ? 0.12 : 0.7,
            delay: reduced ? 0 : 0.2,
            ease: EASE,
          }}
        >
          <h3
            id={`reveal-${project.id}-h3`}
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-headline)',
              lineHeight: 1.0,
              letterSpacing: '-0.03em',
              fontWeight: 600,
              margin: 0,
              color: 'var(--color-text)',
            }}
          >
            {project.name}
          </h3>
          <p
            style={{
              margin: 'var(--space-4) 0 0',
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(1.25rem, 0.8rem + 1.6vw, 1.75rem)',
              lineHeight: 1.3,
              fontStyle: 'italic',
              color: 'var(--color-text-muted)',
              maxWidth: '32ch',
            }}
          >
            {project.tagline}
          </p>
          <p
            style={{
              margin: 'var(--space-5) 0 0',
              fontSize: 'var(--text-body)',
              lineHeight: 'var(--leading-body)',
              color: 'var(--color-text-muted)',
              maxWidth: '54ch',
            }}
          >
            {project.summary}
          </p>
          <RevealConviction project={project} accent="var(--color-amber)" maxWidthCh={54} />
        </motion.div>
      </div>

      {/* Top-right: HUD telemetry */}
      <div
        style={{
          position: 'absolute',
          top: 'clamp(var(--space-7), 5vw, var(--space-9))',
          right: 'clamp(var(--space-5), 4vw, var(--space-9))',
          textAlign: 'right',
          zIndex: 2,
          fontFamily: 'var(--font-mono)',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            flexDirection: 'column',
            gap: 'var(--space-2)',
            padding: 'var(--space-4) var(--space-5)',
            border: '1px solid rgba(232,165,71,0.25)',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(15,18,28,0.55)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <span
            style={{
              fontSize: 'var(--text-caption)',
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: 'var(--color-text-subtle)',
            }}
          >
            Scoring coverage
          </span>
          <span
            style={{
              fontSize: 'clamp(2.5rem, 1.5rem + 4vw, 4.5rem)',
              fontWeight: 500,
              color: 'var(--color-amber)',
              lineHeight: 1,
              letterSpacing: '-0.04em',
            }}
          >
            {counter}
            <span style={{ fontSize: '0.5em', verticalAlign: 'super', marginLeft: 4 }}>%</span>
          </span>
          {project.outcomes && project.outcomes[0] && (
            <span
              style={{
                fontSize: 'var(--text-small)',
                color: 'var(--color-text-muted)',
                fontFamily: 'var(--font-body)',
                maxWidth: '24ch',
              }}
            >
              {project.outcomes[0]}
            </span>
          )}
        </div>
      </div>

      {/* Bottom-right: CTA */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={inView ? { opacity: 1 } : undefined}
        transition={{ duration: reduced ? 0.12 : 0.4, delay: reduced ? 0 : 1.4 }}
        style={{
          position: 'absolute',
          bottom: 'clamp(var(--space-7), 5vw, var(--space-9))',
          right: 'clamp(var(--space-5), 4vw, var(--space-9))',
          zIndex: 2,
        }}
      >
        <Link
          href={project.primaryLink.url}
          external
          aria-label={`${project.primaryLink.label}: ${project.name}`}
          data-cursor-magnet
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            padding: 'var(--space-4) var(--space-6)',
            minHeight: 52,
            border: '1px solid var(--color-amber)',
            borderRadius: 'var(--radius-pill)',
            color: 'var(--color-amber)',
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-body)',
            textDecoration: 'none',
            background: 'rgba(232,165,71,0.06)',
            transition: 'all 320ms cubic-bezier(0.19, 1, 0.22, 1)',
          }}
        >
          {project.primaryLink.label}
        </Link>
      </motion.div>
    </Surface>
  );
}
