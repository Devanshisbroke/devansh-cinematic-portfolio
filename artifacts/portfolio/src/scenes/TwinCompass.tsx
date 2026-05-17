/**
 * Twin Compass — dual-track convergence visualization.
 *
 * Two parallel rails (technical + business) that visually converge over
 * the scene's scroll progress. Each rail carries an institution card with
 * its program, year-range, and a first-person paragraph. A glowing seam
 * runs between them to communicate "two disciplines, one mind."
 *
 * Validates: R1.2, R1.3, R2.6, R6.1, R6.2, R9.5
 */

import { motion, useTransform } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { identity } from '../content-registry/data';
import { Surface } from '../design-system/primitives/Surface';
import { readReducedMotion, subscribeReducedMotion } from '../accessibility';
import { useBreakpoint } from '../responsive-engine/useBreakpoint';
import { useScroll as useSharedScroll } from '../motion/scroll-source';

const EASE: [number, number, number, number] = [0.19, 1, 0.22, 1];

const TRACK_META = [
  { glyph: 'TECH', accent: 'var(--color-signal)', glow: 'var(--glow-signal)', tagline: 'systems · models · code' },
  { glyph: 'BIZ', accent: 'var(--color-amber)', glow: 'var(--glow-amber)', tagline: 'product · markets · founders' },
] as const;

function institutionToRefId(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-');
}

export function TwinCompass() {
  const sectionRef = useRef<HTMLElement>(null);
  const sharedScroll = useSharedScroll();
  const sceneProgress = sharedScroll.sceneProgress('scene-compass');

  const seamScale = useTransform(sceneProgress, [0.1, 0.7], [0.2, 1]);
  const seamOpacity = useTransform(sceneProgress, [0.0, 0.3, 0.8, 1], [0, 1, 1, 0.4]);

  const [reducedMotion, setReducedMotion] = useState<boolean>(() =>
    typeof window === 'undefined' ? false : readReducedMotion(),
  );
  useEffect(() => subscribeReducedMotion(setReducedMotion), []);
  const breakpoint = useBreakpoint();
  const isStacked = breakpoint === 'mobile';

  const refs: Record<string, string> = {};
  for (const cr of identity.crossReferences ?? []) refs[cr.id] = cr.body;

  return (
    <Surface
      as="section"
      ref={sectionRef}
      id="scene-compass"
      aria-labelledby="compass-h2"
      tone="base"
      data-scene="compass"
      style={{
        position: 'relative',
        minHeight: '120dvh',
        paddingBlock: 'clamp(var(--space-9), 10vw, var(--space-10))',
        paddingInline: 'clamp(var(--space-5), 4vw, var(--space-9))',
        overflow: 'hidden',
        backgroundColor: 'transparent',
      }}
    >
      {/* Eyebrow + h2 */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: reducedMotion ? 0.12 : 0.8, ease: EASE }}
        style={{ position: 'relative', zIndex: 2, marginBottom: 'clamp(var(--space-7), 6vw, var(--space-9))' }}
      >
        <div className="eyebrow" style={{ marginBottom: 'var(--space-4)' }}>
          02 · Education
        </div>
        <h2
          id="compass-h2"
          data-kinetic
          data-kinetic-weight-min="400"
          data-kinetic-weight-max="640"
          data-kinetic-opsz-min="36"
          data-kinetic-opsz-max="120"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-headline)',
            lineHeight: 'var(--leading-headline)',
            letterSpacing: 'var(--tracking-headline)',
            fontWeight: 500,
            margin: 0,
            color: 'var(--color-text)',
            maxWidth: '20ch',
          }}
        >
          Twin compass — <span className="gradient-text-plasma" style={{ fontStyle: 'italic' }}>two disciplines</span>, one mind.
        </h2>
        <p
          style={{
            marginTop: 'var(--space-5)',
            maxWidth: '60ch',
            fontSize: 'var(--text-body)',
            lineHeight: 'var(--leading-body)',
            color: 'var(--color-text-muted)',
          }}
        >
          Two co-primary programs running in parallel — one shapes my technical
          instinct, the other shapes how I translate it into product and
          decisions. Neither is secondary.
        </p>
      </motion.div>

      {/* Track grid: technical rail | seam | business rail */}
      <div
        style={{
          position: 'relative',
          display: 'grid',
          gridTemplateColumns: isStacked
            ? 'minmax(0, 1fr)'
            : 'minmax(0, 1fr) auto minmax(0, 1fr)',
          gap: 'clamp(var(--space-5), 4vw, var(--space-8))',
          alignItems: 'stretch',
        }}
      >
        {/* Glowing seam between rails — only meaningful in two-column layout */}
        {!isStacked && (
        <motion.div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: '50%',
            width: 2,
            transform: 'translateX(-50%)',
            background: 'linear-gradient(to bottom, transparent 0%, var(--color-amber) 30%, var(--color-plasma) 70%, transparent 100%)',
            filter: 'blur(0.5px)',
            transformOrigin: 'top',
            scaleY: reducedMotion ? 1 : seamScale,
            opacity: reducedMotion ? 0.6 : seamOpacity,
            boxShadow: '0 0 24px rgba(232, 165, 71, 0.4)',
          }}
        />
        )}

        {identity.currentInstitutions.map((inst, index) => {
          const meta = TRACK_META[index] ?? TRACK_META[0];
          const refBody = refs[institutionToRefId(inst.institution)];
          const isLeft = index === 0;
          const alignRight = !isStacked && !isLeft;
          return (
            <motion.div
              key={inst.institution}
              initial={{ opacity: 0, x: reducedMotion ? 0 : (isLeft ? -40 : 40) }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: reducedMotion ? 0.12 : 0.9, ease: EASE, delay: reducedMotion ? 0 : 0.15 * index }}
              style={{
                gridColumn: isStacked ? 1 : (isLeft ? 1 : 3),
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-5)',
              }}
            >
              {/* Track label */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  alignSelf: alignRight ? 'flex-end' : 'flex-start',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--text-eyebrow)',
                  letterSpacing: 'var(--tracking-eyebrow)',
                  textTransform: 'uppercase',
                  color: meta.accent,
                }}
              >
                {alignRight ? (
                  <>
                    <span style={{ fontWeight: 600 }}>{meta.glyph}</span>
                    <span>Track {index + 1} ——</span>
                  </>
                ) : (
                  <>
                    <span>—— Track {index + 1}</span>
                    <span style={{ fontWeight: 600 }}>{meta.glyph}</span>
                  </>
                )}
              </div>

              {/* Card */}
              <div
                className="glass-card"
                style={{
                  padding: 'clamp(var(--space-5), 3vw, var(--space-7))',
                  borderRadius: 'var(--radius-lg)',
                  borderColor: `color-mix(in srgb, ${meta.accent} 22%, transparent)`,
                  textAlign: alignRight ? 'right' : 'left',
                }}
              >
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--text-caption)',
                    letterSpacing: '0.16em',
                    textTransform: 'uppercase',
                    color: 'var(--color-text-subtle)',
                    marginBottom: 'var(--space-3)',
                  }}
                >
                  {inst.years}
                </div>
                <h3
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 'var(--text-title)',
                    lineHeight: 1.1,
                    letterSpacing: '-0.02em',
                    fontWeight: 600,
                    margin: 0,
                    color: 'var(--color-text)',
                  }}
                >
                  {inst.institution}
                </h3>
                <p
                  style={{
                    margin: 'var(--space-3) 0 var(--space-5)',
                    fontSize: 'var(--text-body)',
                    lineHeight: 1.4,
                    color: 'var(--color-text-muted)',
                  }}
                >
                  {inst.program}
                </p>
                <p
                  style={{
                    margin: 0,
                    fontSize: 'var(--text-small)',
                    lineHeight: 'var(--leading-body)',
                    color: 'var(--color-text)',
                    opacity: 0.85,
                  }}
                >
                  {refBody}
                </p>
                <div
                  style={{
                    marginTop: 'var(--space-5)',
                    display: 'flex',
                    justifyContent: alignRight ? 'flex-end' : 'flex-start',
                    gap: 'var(--space-2)',
                  }}
                >
                  <span
                    className="eyebrow"
                    style={{
                      fontSize: 'var(--text-caption)',
                      color: meta.accent,
                    }}
                  >
                    {meta.tagline}
                  </span>
                </div>
              </div>
            </motion.div>
          );
        })}

        {/* Center column intentionally empty — seam handles the visual */}
        {!isStacked && <div style={{ gridColumn: 2 }} aria-hidden="true" />}
      </div>

      {/* Convergence statement */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: reducedMotion ? 0.12 : 1, delay: reducedMotion ? 0 : 0.4, ease: EASE }}
        style={{
          marginTop: 'clamp(var(--space-9), 8vw, var(--space-10))',
          textAlign: 'center',
          maxWidth: '60ch',
          marginInline: 'auto',
          position: 'relative',
          zIndex: 2,
        }}
      >
        <p
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-title)',
            lineHeight: 1.3,
            letterSpacing: '-0.01em',
            color: 'var(--color-text)',
            fontStyle: 'italic',
            margin: 0,
          }}
        >
          The interesting work lives where these two converge — where{' '}
          <span className="gradient-text-amber">conviction</span> meets{' '}
          <span className="gradient-text-plasma">computation</span>.
        </p>
      </motion.div>
    </Surface>
  );
}
