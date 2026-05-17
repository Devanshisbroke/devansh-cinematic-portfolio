/**
 * NowReading — a small "currently reading" island.
 *
 * Curated, rotating list of books / essays Devansh is engaging with.
 * The selection rotates by ISO week so the page feels alive without
 * needing a CMS or API. Each entry carries author + title + a single
 * sentence on why it matters right now.
 *
 * Edit `READING_LIST` to update — that's the entire content surface.
 */

import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';

interface ReadingEntry {
  title: string;
  author: string;
  why: string;
  category: 'book' | 'essay' | 'paper' | 'thread';
}

const READING_LIST: readonly ReadingEntry[] = [
  {
    title: 'The Beginning of Infinity',
    author: 'David Deutsch',
    why: 'Knowledge as the only thing capable of compounding without bound — a useful frame for product.',
    category: 'book',
  },
  {
    title: 'Reinforcement Learning, an Introduction',
    author: 'Sutton & Barto',
    why: 'Re-reading the policy-gradient chapters before the next SupportDeskOps milestone.',
    category: 'book',
  },
  {
    title: 'Inadequate Equilibria',
    author: 'Eliezer Yudkowsky',
    why: 'On when broken systems are improvable. Relevant when scoping any "small utility" project.',
    category: 'book',
  },
  {
    title: 'High Output Management',
    author: 'Andrew Grove',
    why: 'How to think about leverage when you are also doing the work yourself.',
    category: 'book',
  },
  {
    title: 'Working in Public',
    author: 'Nadia Eghbal',
    why: 'How online identity, attention, and contribution actually behave at scale — feeds my identity-graph thinking.',
    category: 'book',
  },
  {
    title: 'The Bitter Lesson',
    author: 'Rich Sutton',
    why: 'A short essay that re-shapes how I weight clever architectures vs. compute + data.',
    category: 'essay',
  },
] as const;

function isoWeek(d = new Date()): number {
  const target = new Date(d.valueOf());
  const dayNumber = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNumber + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / (7 * 24 * 60 * 60 * 1000));
}

function pickEntry(): ReadingEntry {
  // Rotate weekly so the page feels alive without a CMS.
  const week = isoWeek();
  return READING_LIST[week % READING_LIST.length]!;
}

const CATEGORY_HUE: Readonly<Record<ReadingEntry['category'], string>> = {
  book: '#FFB347',
  essay: '#B388FF',
  paper: '#6FD4FF',
  thread: '#8EB58A',
};

export function NowReading() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const entry = pickEntry();
  const hue = CATEGORY_HUE[entry.category];

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 16 }}
      animate={inView ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      style={{
        marginTop: 'clamp(var(--space-8), 6vw, var(--space-9))',
        padding: 'clamp(var(--space-5), 3vw, var(--space-6))',
        background: 'rgba(0,0,0,0.45)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: `1px solid ${hue}28`,
        borderRadius: 'var(--radius-lg)',
        maxWidth: 720,
        marginInline: 'auto',
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--text-eyebrow)',
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: hue,
          marginBottom: 'var(--space-3)',
          textShadow: `0 0 8px ${hue}40`,
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: hue,
            boxShadow: `0 0 6px ${hue}, 0 0 18px ${hue}80`,
            display: 'inline-block',
          }}
        />
        currently reading · {entry.category}
      </div>

      <h3
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(1.25rem, 0.8rem + 1.6vw, 1.75rem)',
          lineHeight: 1.2,
          letterSpacing: '-0.02em',
          fontWeight: 500,
          margin: 0,
          color: '#FFFFFF',
        }}
      >
        {entry.title}
      </h3>
      <p
        style={{
          margin: 'var(--space-2) 0 0',
          fontFamily: 'var(--font-display)',
          fontStyle: 'italic',
          fontSize: 'var(--text-body)',
          lineHeight: 1.4,
          color: '#DCD9D2',
        }}
      >
        {entry.author}
      </p>
      <p
        style={{
          margin: 'var(--space-4) 0 0',
          fontSize: 'var(--text-body)',
          lineHeight: 'var(--leading-body)',
          color: '#C8C5BC',
        }}
      >
        {entry.why}
      </p>
    </motion.div>
  );
}
