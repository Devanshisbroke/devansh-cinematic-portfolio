/**
 * Ethos — philosophy beat as cinematic monologue.
 *
 * Three big paragraphs render in word-by-word reveal as the user
 * scrolls. The background carries a slow drifting plasma orb to keep
 * the scene from feeling static. Editorial measure ≤ 60ch (R6.8).
 */

import { motion, useInView, useTransform } from 'framer-motion';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Surface } from '../design-system/primitives/Surface';
import { NowReading } from '../design-system/primitives/NowReading';
import { readReducedMotion, subscribeReducedMotion } from '../accessibility';
import { useScroll as useSharedScroll } from '../motion/scroll-source';

const EASE: [number, number, number, number] = [0.19, 1, 0.22, 1];

// Lazy 3D layer — only ships to capable clients
const EthosConstellation = lazy(() => import('./EthosConstellation'));

function shouldRender3D(): boolean {
  if (typeof window === 'undefined') return false;
  if (readReducedMotion()) return false;
  // Capability gate
  const cores = navigator.hardwareConcurrency ?? 8;
  const mem = (navigator as { deviceMemory?: number }).deviceMemory ?? 8;
  if (cores <= 4 || mem <= 4) return false;
  // Save-data
  const conn = (navigator as { connection?: { saveData?: boolean } }).connection;
  if (conn?.saveData) return false;
  // WebGL
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl') || c.getContext('experimental-webgl'));
  } catch {
    return false;
  }
}

const ETHOS_BEATS: readonly string[] = [
  "I treat AI, product, and systems as one practice rather than three. The interesting work sits where they meet — a model is only useful when it lives inside a flow somebody actually has, a flow is only useful when the system underneath it doesn't drop the connection, and a system is only useful when somebody has the conviction to ship it.",
  "So I work backwards from the moment of use. Who is here, what are they trying to do, what is the smallest thing that helps them, and what breaks if I scale it. The model serves that question. The system serves that question. The product is whatever ends up on the screen when those answers line up.",
  "I'm slower than I'd like at the early steps and faster than I should be at the later ones — that order is the bug I'm working on. The fix is the same as it always is: stay with the problem long enough to feel its actual edges before you start drawing.",
] as const;

function WordReveal({ text, reduced }: { text: string; reduced: boolean }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.2 });
  const words = text.split(/\s+/);

  return (
    <p
      ref={ref}
      style={{
        fontFamily: 'var(--font-display)',
        fontSize: 'clamp(1.4rem, 0.8rem + 1.8vw, 2rem)',
        lineHeight: 1.4,
        letterSpacing: '-0.01em',
        color: 'var(--color-text)',
        margin: 0,
        fontWeight: 400,
      }}
    >
      {words.map((w, i) => (
        <motion.span
          key={`${w}-${i}`}
          initial={{ opacity: 0, y: reduced ? 0 : 6 }}
          animate={inView ? { opacity: 1, y: 0 } : undefined}
          transition={{
            duration: reduced ? 0.12 : 0.42,
            delay: reduced ? 0 : Math.min(i * 0.012, 0.6),
            ease: EASE,
          }}
          style={{ display: 'inline-block', marginRight: '0.27em' }}
        >
          {w}
        </motion.span>
      ))}
    </p>
  );
}

export function Ethos() {
  const sectionRef = useRef<HTMLElement>(null);
  const sharedScroll = useSharedScroll();
  const sceneProgress = sharedScroll.sceneProgress('scene-ethos');

  const orbX = useTransform(sceneProgress, [0, 1], [-20, 20]);
  const orbY = useTransform(sceneProgress, [0, 1], [-30, 30]);

  const [reduced, setReduced] = useState<boolean>(() =>
    typeof window === 'undefined' ? false : readReducedMotion(),
  );
  const [mount3D, setMount3D] = useState(false);
  useEffect(() => subscribeReducedMotion(setReduced), []);

  // Defer the Three.js mount until first paint so the critical-path
  // bundle stays lean and we only spin up the GPU layer if the section
  // is actually approaching the viewport.
  useEffect(() => {
    if (!shouldRender3D()) return;
    if (!sectionRef.current) return;
    if (typeof IntersectionObserver === 'undefined') {
      setMount3D(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setMount3D(true);
            io.disconnect();
          }
        }
      },
      { rootMargin: '50% 0px' },
    );
    io.observe(sectionRef.current);
    return () => io.disconnect();
  }, []);

  return (
    <Surface
      as="section"
      ref={sectionRef}
      id="scene-ethos"
      aria-labelledby="ethos-h2"
      tone="base"
      data-scene="ethos"
      style={{
        position: 'relative',
        minHeight: '120dvh',
        paddingBlock: 'clamp(var(--space-9), 12vw, var(--space-10))',
        paddingInline: 'clamp(var(--space-5), 4vw, var(--space-9))',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        backgroundColor: 'transparent',
      }}
    >
      {/* Drifting plasma orb */}
      <motion.div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '20%',
          left: '50%',
          width: 'min(700px, 80vmin)',
          height: 'min(700px, 80vmin)',
          marginLeft: 'min(-350px, -40vmin)',
          x: reduced ? 0 : orbX,
          y: reduced ? 0 : orbY,
          background:
            'radial-gradient(circle, rgba(155,111,245,0.15) 0%, rgba(91,192,232,0.08) 40%, transparent 70%)',
          filter: 'blur(40px)',
          borderRadius: '50%',
          willChange: 'transform',
        }}
      />

      {/* 3D word constellation — capability-gated, lazy-loaded */}
      {mount3D && (
        <Suspense fallback={null}>
          <EthosConstellation />
        </Suspense>
      )}

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.8, ease: EASE }}
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: '60ch',
          width: '100%',
        }}
      >
        <div className="eyebrow" style={{ marginBottom: 'var(--space-5)' }}>
          04 · Ethos
        </div>
        <h2
          id="ethos-h2"
          data-kinetic
          data-kinetic-weight-min="400"
          data-kinetic-weight-max="620"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-headline)',
            lineHeight: 'var(--leading-headline)',
            letterSpacing: 'var(--tracking-headline)',
            fontWeight: 500,
            margin: '0 0 clamp(var(--space-7), 5vw, var(--space-9))',
            color: 'var(--color-text)',
          }}
        >
          How I think about <span className="gradient-text-plasma" style={{ fontStyle: 'italic' }}>the work.</span>
        </h2>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'clamp(var(--space-6), 4vw, var(--space-8))',
          }}
        >
          {ETHOS_BEATS.map((beat, i) => (
            <div key={i} style={{ display: 'flex', gap: 'var(--space-5)', alignItems: 'baseline' }}>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--text-caption)',
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: 'var(--color-amber)',
                  flexShrink: 0,
                  width: '3ch',
                }}
                aria-hidden="true"
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <WordReveal text={beat} reduced={reduced} />
            </div>
          ))}
        </div>

        {/* Currently-reading island — what's actually feeding the thinking */}
        <NowReading />
      </motion.div>
    </Surface>
  );
}
