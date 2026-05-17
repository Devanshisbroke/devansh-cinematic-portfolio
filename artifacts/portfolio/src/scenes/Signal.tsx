/**
 * Signal — high-value contact.
 *
 * Mailto + LinkedIn + GitHub rendered as a curated trio of magnetic
 * cards. Cursor-reactive. Each card is its own surface with a subtle
 * gradient ring on hover.
 */

import { motion } from 'framer-motion';
import { identity } from '../content-registry/data';
import { Surface } from '../design-system/primitives/Surface';
import { Link } from '../design-system/primitives/Link';
import { PresenceWatermark } from '../design-system/primitives/PresenceWatermark';

const EASE: [number, number, number, number] = [0.19, 1, 0.22, 1];

interface ContactRow {
  label: string;
  href: string;
  display: string;
  glyph: string;
  color: string;
  external: boolean;
}

const buildRows = (): readonly ContactRow[] => [
  {
    label: 'Email',
    href: `mailto:${identity.email}`,
    display: identity.email,
    glyph: '✉',
    color: 'var(--color-amber)',
    external: false,
  },
  ...identity.socials.map<ContactRow>((s) => ({
    label: s.label,
    href: s.url,
    display: s.url.replace(/^https?:\/\//, ''),
    glyph: s.label === 'LinkedIn' ? 'in' : '⟨/⟩',
    color: s.label === 'LinkedIn' ? 'var(--color-signal)' : 'var(--color-plasma)',
    external: true,
  })),
];

export function Signal() {
  const rows = buildRows();

  return (
    <Surface
      as="section"
      id="scene-signal"
      aria-labelledby="signal-h2"
      tone="base"
      data-scene="signal"
      style={{
        position: 'relative',
        minHeight: '100dvh',
        paddingBlock: 'clamp(var(--space-9), 8vw, var(--space-10))',
        paddingInline: 'clamp(var(--space-5), 4vw, var(--space-9))',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        backgroundColor: 'transparent',
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.8, ease: EASE }}
        style={{ maxWidth: '60ch', width: '100%' }}
      >
        <div className="eyebrow" style={{ marginBottom: 'var(--space-5)' }}>
          05 · Signal
        </div>
        <h2
          id="signal-h2"
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
          }}
        >
          Reach me <span className="gradient-text-amber" style={{ fontStyle: 'italic' }}>directly.</span>
        </h2>
        <p
          style={{
            margin: 'var(--space-5) 0 0',
            maxWidth: '52ch',
            fontSize: 'var(--text-body)',
            lineHeight: 'var(--leading-body)',
            color: 'var(--color-text-muted)',
          }}
        >
          The fastest way to start a conversation is the most boring one — a
          plain email. The other two links exist for the people who want to
          look me up before they write.
        </p>
      </motion.div>

      <ul
        aria-label="Contact channels"
        style={{
          listStyle: 'none',
          padding: 0,
          margin: 'clamp(var(--space-8), 6vw, var(--space-10)) 0 0',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 'var(--space-5)',
          maxWidth: 1280,
          width: '100%',
        }}
      >
        {rows.map((row, i) => (
          <motion.li
            key={row.label}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.7, delay: 0.2 + i * 0.08, ease: EASE }}
          >
            <Link
              href={row.href}
              external={row.external}
              aria-label={`${row.label}: ${row.display}`}
              data-cursor-magnet
              data-signal-card
              style={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-3)',
                padding: 'clamp(var(--space-5), 3vw, var(--space-7))',
                minHeight: 200,
                borderRadius: 'var(--radius-lg)',
                background: 'rgba(15,18,28,0.55)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(180,175,165,0.12)',
                ['--signal-accent' as string]: row.color,
                color: 'inherit',
                textDecoration: 'none',
                overflow: 'hidden',
                transition: 'border-color 320ms cubic-bezier(0.19,1,0.22,1), transform 320ms cubic-bezier(0.19,1,0.22,1), box-shadow 320ms cubic-bezier(0.19,1,0.22,1)',
              }}
            >
              {/* Glyph */}
              <span
                aria-hidden="true"
                style={{
                  fontSize: 'clamp(2rem, 1.4rem + 2vw, 2.8rem)',
                  lineHeight: 1,
                  color: row.color,
                  fontWeight: 700,
                  fontFamily: 'var(--font-display)',
                  textShadow: `0 0 24px ${row.color}`,
                }}
              >
                {row.glyph}
              </span>

              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--text-caption)',
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: 'var(--color-text-subtle)',
                }}
              >
                {row.label}
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'clamp(1rem, 0.7rem + 0.8vw, 1.3rem)',
                  lineHeight: 1.3,
                  color: 'var(--color-text)',
                  wordBreak: 'break-word',
                  marginTop: 'auto',
                }}
              >
                {row.display}
              </span>
            </Link>
          </motion.li>
        ))}
      </ul>

      {/* Closing line */}
      <motion.p
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 0.5 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 1, delay: 0.6 }}
        style={{
          marginTop: 'clamp(var(--space-9), 6vw, var(--space-10))',
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--text-caption)',
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color: 'var(--color-text-subtle)',
          textAlign: 'center',
        }}
      >
        ⌘ — devansh barai · 2026 · making things that work
      </motion.p>

      {/* Presence watermark — appears after 90s in-page */}
      <PresenceWatermark />
    </Surface>
  );
}
