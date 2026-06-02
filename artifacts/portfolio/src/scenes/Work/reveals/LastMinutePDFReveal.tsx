/**
 * Last-Minute PDF reveal — full-width banded-typographic.
 *
 * Brutalist editorial: a giant kinetic "PDF" cipher fills the upper
 * band, with the operational manifesto running as right-aligned
 * monospace cards in the lower band. Optimised for the operational
 * design language called for in the project description.
 */

import { motion, useInView } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import type { Project_Record } from '../../../content-registry/types';
import { Surface } from '../../../design-system/primitives/Surface';
import { Link } from '../../../design-system/primitives/Link';
import { readReducedMotion, subscribeReducedMotion } from '../../../accessibility';

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

export function LastMinutePDFReveal({ project }: { project: Project_Record }) {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.15 });
  const [reduced, setReduced] = useState<boolean>(() =>
    typeof window === 'undefined' ? false : readReducedMotion(),
  );
  useEffect(() => subscribeReducedMotion(setReduced), []);

  const lines = project.summary.split(/\.\s+/).filter((s) => s.trim().length > 0).slice(0, 3);

  return (
    <Surface
      as="section"
      ref={ref}
      id={`scene-work-${project.id}`}
      aria-labelledby={`reveal-${project.id}-h3`}
      tone="sunken"
      data-reveal-layout="full-width-banded-typographic"
      data-warp-trigger="lastminutepdf"
      style={{
        position: 'relative',
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'transparent',
        overflow: 'hidden',
      }}
    >
      {/* Top: cipher band */}
      <div
        style={{
          flex: '0 0 60vh',
          minHeight: 360,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          padding: 'var(--space-5)',
          background:
            'radial-gradient(50% 60% at 50% 60%, rgba(184,82,30,0.18), transparent 70%)',
        }}
      >
        {/* Eyebrow */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={inView ? { opacity: 1, y: 0 } : undefined}
          transition={{ duration: reduced ? 0.12 : 0.6, ease: EASE }}
          className="eyebrow"
          style={{
            position: 'absolute',
            top: 'clamp(var(--space-5), 3vw, var(--space-7))',
            left: 'clamp(var(--space-5), 4vw, var(--space-9))',
          }}
        >
          04 · Last-Minute PDF · Revision notes
        </motion.div>

        {/* Status code */}
        <div
          style={{
            position: 'absolute',
            top: 'clamp(var(--space-5), 3vw, var(--space-7))',
            right: 'clamp(var(--space-5), 4vw, var(--space-9))',
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-eyebrow)',
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: 'var(--color-amber-deep)',
            textAlign: 'right',
          }}
        >
          10-PAGE NOTES<br />
          <span style={{ color: 'var(--color-text-subtle)' }}>instant delivery · ₹29</span>
        </div>

        <svg
          viewBox="0 0 800 360"
          preserveAspectRatio="xMidYMid meet"
          style={{ width: '90%', maxWidth: 1200, maxHeight: '100%' }}
          aria-hidden="true"
          className="glitch-hover"
        >
          {(['P', 'D', 'F'] as const).map((letter, i) => (
            <motion.text
              key={letter}
              x={150 + i * 250}
              y="280"
              fontFamily="var(--font-display)"
              fontSize="320"
              fontWeight="600"
              textAnchor="middle"
              fill={i === 1 ? 'var(--color-amber-deep)' : 'transparent'}
              stroke="var(--color-text)"
              strokeWidth={i === 1 ? '0' : '2.5'}
              initial={{ scale: reduced ? 1 : 0.92, opacity: 0 }}
              animate={inView ? { scale: 1, opacity: 1 } : undefined}
              transition={{
                duration: reduced ? 0.12 : 0.7,
                delay: reduced ? 0 : i * 0.18,
                ease: EASE,
              }}
              style={{ transformOrigin: 'center', transformBox: 'fill-box' }}
            >
              {letter}
            </motion.text>
          ))}
          {/* Tag line under cipher */}
          <motion.text
            x="400"
            y="340"
            fontFamily="var(--font-mono)"
            fontSize="14"
            fill="rgba(180,175,165,0.5)"
            letterSpacing="6"
            textAnchor="middle"
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : undefined}
            transition={{ duration: reduced ? 0.12 : 0.6, delay: reduced ? 0 : 1.2 }}
          >
            REVISION · EXAM READY
          </motion.text>
        </svg>
      </div>

      {/* Bottom band */}
      <div
        style={{
          flex: '1',
          padding: 'clamp(var(--space-7), 4vw, var(--space-9))',
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.2fr)',
          gap: 'clamp(var(--space-6), 4vw, var(--space-8))',
          alignItems: 'flex-start',
          borderTop: '1px solid rgba(180,175,165,0.08)',
          background: 'rgba(15,18,28,0.4)',
        }}
      >
        {/* Left: title + tagline */}
        <div>
          <motion.h3
            id={`reveal-${project.id}-h3`}
            initial={{ opacity: 0, y: 12 }}
            animate={inView ? { opacity: 1, y: 0 } : undefined}
            transition={{ duration: reduced ? 0.12 : 0.5, delay: reduced ? 0 : 0.8, ease: EASE }}
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(1.75rem, 1rem + 3vw, 3rem)',
              lineHeight: 1.0,
              letterSpacing: '-0.03em',
              fontWeight: 600,
              margin: 0,
              color: 'var(--color-text)',
            }}
          >
            {project.name}
          </motion.h3>
          <motion.p
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : undefined}
            transition={{ duration: reduced ? 0.12 : 0.6, delay: reduced ? 0 : 1.0 }}
            style={{
              margin: 'var(--space-4) 0 0',
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-title)',
              lineHeight: 1.3,
              fontStyle: 'italic',
              color: 'var(--color-text-muted)',
              maxWidth: '32ch',
            }}
          >
            {project.tagline}
          </motion.p>

          <motion.div
            initial={{ x: reduced ? 0 : 24, opacity: 0 }}
            animate={inView ? { x: 0, opacity: 1 } : undefined}
            transition={{ duration: reduced ? 0.12 : 0.4, delay: reduced ? 0 : 1.7, ease: EASE }}
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
                background: 'var(--color-amber-deep)',
                color: '#fff',
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-small)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                textDecoration: 'none',
                border: 'none',
              }}
            >
              {project.primaryLink.label} →
            </Link>
          </motion.div>
        </div>

        {/* Right: operational manifesto */}
        <div
          style={{
            display: 'grid',
            gap: 'var(--space-3)',
          }}
        >
          {lines.map((l, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: reduced ? 0 : 8 }}
              animate={inView ? { opacity: 1, y: 0 } : undefined}
              transition={{ duration: reduced ? 0.12 : 0.5, delay: reduced ? 0 : 1.0 + i * 0.18, ease: EASE }}
              style={{
                padding: 'var(--space-4) var(--space-5)',
                borderLeft: '2px solid var(--color-amber-deep)',
                background: 'rgba(184,82,30,0.05)',
              }}
            >
              <span
                style={{
                  display: 'block',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--text-caption)',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: 'var(--color-amber-deep)',
                  marginBottom: 'var(--space-2)',
                }}
              >
                Beat {String(i + 1).padStart(2, '0')}
              </span>
              <span
                style={{
                  fontSize: 'var(--text-body)',
                  lineHeight: 1.5,
                  color: 'var(--color-text)',
                }}
              >
                {l}{i < lines.length - 1 ? '.' : ''}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </Surface>
  );
}
