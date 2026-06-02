/**
 * RevealConviction — shared closing beat for every project reveal.
 *
 * Surfaces two strings from the Content_Registry that the individual
 * reveals were dropping on the floor:
 *
 *   • `project.problem`               — the "why this exists" framing,
 *                                       rendered as a quiet context line.
 *   • `project.voice.convictionSentence` — the single most human line in
 *                                       each record, rendered as a large
 *                                       editorial pull-quote.
 *
 * Both are real, registry-authored content (R9.5/R9.6 conviction voice),
 * so this adds substance without inventing anything. The component is
 * presentation-only and reads the live Reduced_Motion flag so its
 * entrance respects R5.7.
 *
 * Layout is intentionally restrained — a hairline rule, a mono "premise"
 * label, the problem framing, then the conviction quote in display
 * italic. The `accent` prop lets each reveal tint the rule + label to
 * match its scene hue so the beat feels native rather than bolted on.
 */

import { motion, useInView } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import type { Project_Record } from '../../content-registry/types';
import { readReducedMotion, subscribeReducedMotion } from '../../accessibility';

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

export interface RevealConvictionProps {
  readonly project: Project_Record;
  /** Scene hue used for the rule + premise label (defaults to amber). */
  readonly accent?: string;
  /** Right-align the block (used by reveals whose prose sits on the right). */
  readonly align?: 'left' | 'center';
  /** Max measure in ch — keeps the quote within an editorial line length. */
  readonly maxWidthCh?: number;
}

export function RevealConviction({
  project,
  accent = 'var(--color-amber)',
  align = 'left',
  maxWidthCh = 60,
}: RevealConvictionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const [reduced, setReduced] = useState<boolean>(() =>
    typeof window === 'undefined' ? false : readReducedMotion(),
  );
  useEffect(() => subscribeReducedMotion(setReduced), []);

  const conviction = project.voice?.convictionSentence;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: reduced ? 0 : 16 }}
      animate={inView ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: reduced ? 0.12 : 0.7, ease: EASE }}
      style={{
        position: 'relative',
        zIndex: 2,
        marginTop: 'clamp(var(--space-7), 5vw, var(--space-9))',
        maxWidth: `${maxWidthCh}ch`,
        marginInline: align === 'center' ? 'auto' : undefined,
        textAlign: align === 'center' ? 'center' : 'left',
      }}
    >
      {/* Hairline + premise label */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
          justifyContent: align === 'center' ? 'center' : 'flex-start',
          marginBottom: 'var(--space-4)',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: align === 'center' ? 32 : 40,
            height: 1,
            background: accent,
            boxShadow: `0 0 8px ${accent}`,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-caption)',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: accent,
          }}
        >
          The premise
        </span>
      </div>

      {/* Problem framing — quiet context */}
      <p
        style={{
          margin: 0,
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--text-small)',
          lineHeight: 'var(--leading-body)',
          color: 'var(--color-text-subtle)',
        }}
      >
        {project.problem}
      </p>

      {/* Conviction pull-quote — the human line */}
      {conviction && (
        <motion.blockquote
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : undefined}
          transition={{ duration: reduced ? 0.12 : 0.6, delay: reduced ? 0 : 0.2, ease: EASE }}
          style={{
            margin: 'var(--space-5) 0 0',
            padding: 0,
            border: 'none',
            fontFamily: 'var(--font-display)',
            fontStyle: 'italic',
            fontSize: 'clamp(1.35rem, 0.9rem + 1.8vw, 2rem)',
            lineHeight: 1.32,
            letterSpacing: '-0.01em',
            color: 'var(--color-text)',
            textShadow: '0 0 1px rgba(255,255,255,0.35)',
          }}
        >
          “{conviction}”
        </motion.blockquote>
      )}
    </motion.div>
  );
}
