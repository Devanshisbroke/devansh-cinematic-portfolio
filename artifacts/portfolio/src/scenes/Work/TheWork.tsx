/**
 * TheWork — chapter header + cinematic intro for the four project reveals.
 *
 * Stacks the four `<ProjectReveal>` components in canonical order
 * (R8.5/R8.6) and prefaces them with a chapter title, a counter,
 * and a sticky scrub-bar that previews the four projects.
 */

import { motion } from 'framer-motion';
import { projects } from '../../content-registry/data';
import { validateProject } from '../../content-registry/validate';
import { Surface } from '../../design-system/primitives/Surface';
import { ProjectReveal } from './ProjectReveal';
import { TiltCard } from '../../design-system/primitives/TiltCard';

const EASE: [number, number, number, number] = [0.19, 1, 0.22, 1];

export function TheWork() {
  return (
    <>
      {/* Chapter header — its own scene */}
      <Surface
        as="section"
        id="scene-work"
        aria-labelledby="work-h2"
        tone="base"
        data-scene="work"
        style={{
          position: 'relative',
          minHeight: '60dvh',
          paddingBlock: 'clamp(var(--space-8), 8vw, var(--space-10))',
          paddingInline: 'clamp(var(--space-5), 4vw, var(--space-9))',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 'var(--space-7)',
          backgroundColor: 'transparent',
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.8, ease: EASE }}
        >
          <div className="eyebrow" style={{ marginBottom: 'var(--space-4)' }}>
            03 · The Work
          </div>
          <h2
            id="work-h2"
            data-kinetic
            data-kinetic-weight-min="400"
            data-kinetic-weight-max="640"
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
            Four projects, <span className="gradient-text-amber" style={{ fontStyle: 'italic' }}>four worlds</span>.
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
            Each project below is shaped by the problem it set out to solve —
            its visual treatment, motion, and layout follow the work, not a
            shared template. Scroll to enter each one in turn.
          </p>
        </motion.div>

        {/* Project index strip */}
        <motion.ol
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 'var(--space-4)',
          }}
          aria-label="Projects"
        >
          {projects.map((p, i) => (
            <motion.li
              key={p.id}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.5 + i * 0.08, ease: EASE }}
              style={{ listStyle: 'none' }}
            >
              <TiltCard
                href={`#scene-work-${p.id}`}
                ariaLabel={`${p.name} — ${p.tagline}`}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-2)',
                  padding: 'var(--space-5) var(--space-5)',
                  borderTop: '1px solid rgba(180,175,165,0.18)',
                  background: 'rgba(0,0,0,0.4)',
                  borderRadius: 'var(--radius-md)',
                  transition: 'border-color 280ms cubic-bezier(0.19,1,0.22,1), background 280ms cubic-bezier(0.19,1,0.22,1)',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--text-caption)',
                    letterSpacing: '0.16em',
                    textTransform: 'uppercase',
                    color: 'var(--color-text-subtle)',
                  }}
                >
                  {String(i + 1).padStart(2, '0')} · {typeof p.year === 'number' ? p.year : `${p.year[0]}–${p.year[1]}`}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 'var(--text-title)',
                    lineHeight: 1.0,
                    fontWeight: 500,
                    color: 'var(--color-text)',
                  }}
                >
                  {p.name}
                </span>
                <span
                  style={{
                    fontSize: 'var(--text-small)',
                    color: 'var(--color-text-muted)',
                    lineHeight: 1.4,
                  }}
                >
                  {p.tagline}
                </span>
              </TiltCard>
            </motion.li>
          ))}
        </motion.ol>
      </Surface>

      {/* Reveals — stacked, each occupies its own viewport */}
      {projects.map((project) => {
        const v = validateProject(project);
        if (!v.ok) {
          return (
            <aside
              key={project.id}
              role="status"
              aria-live="polite"
              data-scene-work-skipped={project.id}
              style={{
                margin: 'var(--space-7) auto',
                padding: 'var(--space-5) var(--space-6)',
                border: '1px dashed var(--color-neutral-400)',
                borderRadius: 'var(--radius-md)',
                maxWidth: '64ch',
                color: 'var(--color-text-muted)',
                fontSize: 'var(--text-small)',
              }}
            >
              Project "{project.name}" was omitted from the showcase because the entry is missing a required data point ({v.field}: {v.reason}).
            </aside>
          );
        }
        return <ProjectReveal key={project.id} project={project} />;
      })}
    </>
  );
}
