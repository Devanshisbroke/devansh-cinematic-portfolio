/**
 * Khetech reveal — AI ⨯ agriculture, organic computational aesthetic.
 *
 * Split-asymmetric layout (R8.1): a living leaf-canvas on one side,
 * editorial prose + outcome telemetry on the other. The leaf-canvas
 * is an animated SVG with breathing veins and a perceptron-style
 * "diagnosis" trace that materialises as outcomes resolve.
 */

import { motion, useInView } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import type { Project_Record } from '../../../content-registry/types';
import { Surface } from '../../../design-system/primitives/Surface';
import { Link } from '../../../design-system/primitives/Link';
import { readReducedMotion, subscribeReducedMotion } from '../../../accessibility';
import { RevealConviction } from '../RevealConviction';

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

export function KhetechReveal({ project }: { project: Project_Record }) {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.15 });
  const [reduced, setReduced] = useState<boolean>(() =>
    typeof window === 'undefined' ? false : readReducedMotion(),
  );
  useEffect(() => subscribeReducedMotion(setReduced), []);

  const words = project.summary.split(/\s+/);

  return (
    <Surface
      as="section"
      ref={ref}
      id={`scene-work-${project.id}`}
      aria-labelledby={`reveal-${project.id}-h3`}
      tone="base"
      data-reveal-layout="split-asymmetric"
      data-warp-trigger="khetech"
      style={{
        position: 'relative',
        minHeight: '100dvh',
        padding: 'clamp(var(--space-7), 6vw, var(--space-9))',
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 5fr) minmax(0, 7fr)',
        gap: 'clamp(var(--space-6), 4vw, var(--space-8))',
        alignItems: 'center',
        backgroundColor: 'transparent',
        overflow: 'hidden',
      }}
    >
      {/* LEFT — leaf canvas */}
      <motion.div
        initial={{ clipPath: reduced ? 'inset(0)' : 'inset(100% 0 0 0)' }}
        animate={inView ? { clipPath: 'inset(0)' } : undefined}
        transition={{ duration: reduced ? 0.12 : 0.9, ease: [0.6, -0.05, 0.01, 0.99] }}
        style={{
          position: 'relative',
          aspectRatio: '4 / 5',
          width: '100%',
          maxWidth: 540,
          marginInline: 'auto',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          background:
            'radial-gradient(140% 100% at 0% 0%, rgba(88,115,85,0.35), transparent 60%), linear-gradient(160deg, #0E150E 0%, #15161B 100%)',
          border: '1px solid rgba(88,115,85,0.25)',
          willChange: 'clip-path',
        }}
      >
        <svg
          viewBox="0 0 400 500"
          preserveAspectRatio="xMidYMid slice"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          aria-hidden="true"
          className="glitch-hover"
        >
          <defs>
            <radialGradient id="khe-bg" cx="40%" cy="35%" r="70%">
              <stop offset="0%" stopColor="rgba(88,115,85,0.5)" />
              <stop offset="100%" stopColor="rgba(15,16,20,0)" />
            </radialGradient>
            <linearGradient id="khe-leaf" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#587355" />
              <stop offset="60%" stopColor="#3a4a37" />
              <stop offset="100%" stopColor="#1e2520" />
            </linearGradient>
          </defs>
          <rect width="400" height="500" fill="url(#khe-bg)" />

          {/* Animated leaf */}
          <motion.path
            d="M 200 60 C 280 100, 320 200, 290 320 C 270 380, 240 420, 200 440 C 160 420, 130 380, 110 320 C 80 200, 120 100, 200 60 Z"
            fill="url(#khe-leaf)"
            initial={{ opacity: 0, scale: reduced ? 1 : 0.8 }}
            animate={inView ? { opacity: 1, scale: 1 } : undefined}
            transition={{ duration: reduced ? 0.12 : 1.2, ease: EASE }}
            style={{ transformOrigin: 'center', transformBox: 'fill-box' }}
          />

          {/* Vein system */}
          <motion.path
            d="M 200 70 L 200 430 M 200 130 Q 240 160 270 220 M 200 130 Q 160 160 130 220 M 200 220 Q 240 250 280 300 M 200 220 Q 160 250 120 300 M 200 310 Q 230 330 250 360 M 200 310 Q 170 330 150 360"
            stroke="rgba(232,165,71,0.5)"
            strokeWidth="1"
            fill="none"
            initial={{ pathLength: 0 }}
            animate={inView ? { pathLength: 1 } : undefined}
            transition={{ duration: reduced ? 0.12 : 2, delay: reduced ? 0 : 0.6, ease: 'linear' }}
          />

          {/* Diagnostic node pulse */}
          {[
            [200, 130],
            [200, 220],
            [200, 310],
            [240, 200],
            [160, 200],
          ].map(([x, y], i) => (
            <g key={i}>
              <motion.circle
                cx={x}
                cy={y}
                r="4"
                fill="var(--color-amber)"
                initial={{ opacity: 0 }}
                animate={inView ? { opacity: 1 } : undefined}
                transition={{
                  duration: reduced ? 0.12 : 0.4,
                  delay: reduced ? 0 : 1.4 + i * 0.15,
                  ease: EASE,
                }}
                style={{ filter: 'drop-shadow(0 0 6px rgba(232,165,71,0.8))' }}
              />
              {!reduced && (
                <motion.circle
                  cx={x}
                  cy={y}
                  r="4"
                  fill="none"
                  stroke="var(--color-amber)"
                  strokeWidth="1"
                  initial={{ r: 4, opacity: 0.6 }}
                  animate={{ r: 18, opacity: 0 }}
                  transition={{
                    duration: 2,
                    delay: 1.4 + i * 0.15,
                    repeat: Infinity,
                    ease: 'easeOut',
                  }}
                />
              )}
            </g>
          ))}

          {/* HUD overlay */}
          <text
            x="20"
            y="38"
            fontFamily="var(--font-mono)"
            fontSize="11"
            fill="rgba(232,165,71,0.7)"
            letterSpacing="2"
          >
            DIAGNOSIS · LIVE
          </text>
          <text
            x="20"
            y="480"
            fontFamily="var(--font-mono)"
            fontSize="10"
            fill="rgba(180,175,165,0.5)"
            letterSpacing="1.5"
          >
            CONFIDENCE 0.94
          </text>
        </svg>
      </motion.div>

      {/* RIGHT — prose + telemetry */}
      <div style={{ position: 'relative', minWidth: 0 }}>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={inView ? { opacity: 1, y: 0 } : undefined}
          transition={{ duration: reduced ? 0.12 : 0.6, ease: EASE }}
          className="eyebrow"
          style={{ marginBottom: 'var(--space-4)' }}
        >
          02 · Khetech · Computer vision
        </motion.div>

        <motion.h3
          id={`reveal-${project.id}-h3`}
          initial={{ opacity: 0, y: 12 }}
          animate={inView ? { opacity: 1, y: 0 } : undefined}
          transition={{ duration: reduced ? 0.12 : 0.6, delay: reduced ? 0 : 0.1, ease: EASE }}
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
          <span className="gradient-text-amber">{project.name}</span>
        </motion.h3>

        <motion.p
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : undefined}
          transition={{ duration: reduced ? 0.12 : 0.6, delay: reduced ? 0 : 0.2 }}
          style={{
            margin: 'var(--space-4) 0 0',
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(1.25rem, 0.8rem + 1.6vw, 1.75rem)',
            lineHeight: 1.3,
            fontStyle: 'italic',
            color: 'var(--color-text-muted)',
            maxWidth: '36ch',
          }}
        >
          {project.tagline}
        </motion.p>

        <p
          style={{
            margin: 'clamp(var(--space-5), 3vw, var(--space-6)) 0 0',
            fontSize: 'var(--text-body)',
            lineHeight: 'var(--leading-body)',
            color: 'var(--color-text-muted)',
            maxWidth: '54ch',
          }}
        >
          {words.map((w, i) => (
            <motion.span
              key={`${w}-${i}`}
              initial={{ opacity: 0, y: reduced ? 0 : 4 }}
              animate={inView ? { opacity: 1, y: 0 } : undefined}
              transition={{
                duration: reduced ? 0.12 : 0.4,
                delay: reduced ? 0 : 0.4 + (i * 0.022),
                ease: EASE,
              }}
              style={{ display: 'inline-block', marginRight: '0.27em' }}
            >
              {w}
            </motion.span>
          ))}
        </p>

        {/* Outcomes telemetry */}
        {project.outcomes && project.outcomes.length > 0 && (
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 'clamp(var(--space-6), 4vw, var(--space-7)) 0 0',
              display: 'grid',
              gap: 'var(--space-3)',
              maxWidth: '54ch',
            }}
          >
            {project.outcomes.map((o, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: reduced ? 0 : -16 }}
                animate={inView ? { opacity: 1, x: 0 } : undefined}
                transition={{
                  duration: reduced ? 0.12 : 0.5,
                  delay: reduced ? 0 : 1.1 + i * 0.12,
                  ease: EASE,
                }}
                style={{
                  display: 'flex',
                  gap: 'var(--space-4)',
                  alignItems: 'baseline',
                  padding: 'var(--space-3) var(--space-4)',
                  borderLeft: '2px solid var(--color-moss)',
                  background: 'rgba(88,115,85,0.05)',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--text-caption)',
                    color: 'var(--color-moss)',
                    letterSpacing: '0.1em',
                    flexShrink: 0,
                  }}
                >
                  →
                </span>
                <span
                  style={{
                    fontSize: 'var(--text-small)',
                    lineHeight: 1.5,
                    color: 'var(--color-text)',
                  }}
                >
                  {o}
                </span>
              </motion.li>
            ))}
          </ul>
        )}

        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : undefined}
          transition={{ duration: reduced ? 0.12 : 0.4, delay: reduced ? 0 : 1.5 }}
          style={{ marginTop: 'clamp(var(--space-6), 4vw, var(--space-7))' }}
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
              border: '1px solid var(--color-moss)',
              borderRadius: 'var(--radius-pill)',
              color: 'var(--color-moss)',
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--text-body)',
              textDecoration: 'none',
              transition: 'all 320ms cubic-bezier(0.19, 1, 0.22, 1)',
            }}
          >
            {project.primaryLink.label}
          </Link>
        </motion.div>

        <RevealConviction project={project} accent="var(--color-moss)" maxWidthCh={54} />
      </div>
    </Surface>
  );
}
