/**
 * BootSequence — the cinematic boot screen.
 *
 * Plays once per session (gated by `sessionStorage`). Three phases:
 *
 *   Phase 1 (0–600 ms)   "boot.init" mono-text typewriter on a black void
 *   Phase 2 (600–1500ms) Particle field assembles into the wordmark
 *   Phase 3 (1500–2500)  Wordmark settles, system-status lines flash,
 *                        bottom progress bar fills, then everything
 *                        cross-dissolves out and the portal unmounts.
 *
 * Skipped when reduced-motion is active. Click anywhere to skip mid-sequence.
 */

import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { readReducedMotion } from '../accessibility';

const BOOT_KEY = 'pcr.boot-played';

type Phase = 'init' | 'assemble' | 'identify' | 'commit' | 'fade';

interface KeystrokeGhost {
  ch: string;
  x: number;
  y: number;
  id: number;
}

const STATUS_LINES = [
  '> initialising identity layer',
  '> linking iit-madras :: iim-bangalore',
  '> loading projects (4)',
  '> compiling shaders',
  '> ambient system online',
  '> presence established',
] as const;

interface Particle {
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  delay: number;
}

/**
 * Pre-compute particle assembly: 220 dust particles spawn from random
 * positions within a square void and converge on a target text-glyph
 * sample of "DB". Targets are sampled from an offscreen canvas where we
 * paint the wordmark and read black pixel positions.
 */
function buildParticles(width: number, height: number, count: number): Particle[] {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);

  ctx.font = `700 ${Math.floor(height * 0.6)}px "Fraunces", serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.fillText('DB', width / 2, height / 2);

  const img = ctx.getImageData(0, 0, width, height).data;
  const targets: { x: number; y: number }[] = [];
  for (let y = 0; y < height; y += 4) {
    for (let x = 0; x < width; x += 4) {
      const idx = (y * width + x) * 4;
      if (img[idx]! > 100) targets.push({ x, y });
    }
  }
  if (targets.length === 0) return [];

  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const t = targets[Math.floor(Math.random() * targets.length)]!;
    particles.push({
      startX: Math.random() * width,
      startY: Math.random() * height,
      targetX: t.x,
      targetY: t.y,
      delay: Math.random() * 0.6,
    });
  }
  return particles;
}

export function BootSequence({ onComplete, onPlaySound }: { onComplete: () => void; onPlaySound?: () => void }) {
  const reducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return true;
    if (sessionStorage.getItem(BOOT_KEY)) return true;
    return readReducedMotion();
  }, []);

  const [phase, setPhase] = useState<Phase>('init');
  const phaseRef = useRef<Phase>('init');
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  const [statusIndex, setStatusIndex] = useState(0);
  const [ghosts, setGhosts] = useState<KeystrokeGhost[]>([]);
  const ghostIdRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const progress = useMotionValue(0);
  const progressWidth = useTransform(progress, (v) => `${v * 100}%`);

  const [particles, setParticles] = useState<Particle[]>([]);

  // Keystroke ghosts — type during boot to inject characters into the
  // assembly. Bound once at mount; phase is read via ref so the handler
  // never has a stale closure across phase transitions.
  useEffect(() => {
    if (reducedMotion) return;
    const onKey = (e: KeyboardEvent) => {
      // Skip-keys (Escape / Enter / Space) belong to the skip handler.
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') return;
      if (phaseRef.current === 'fade') return;
      // Only a single visible character — letters, digits, punctuation.
      if (e.key.length !== 1) return;
      const code = e.key.charCodeAt(0);
      if (code < 32 || code > 126) return;
      e.preventDefault();
      const id = ++ghostIdRef.current;
      // Place ghosts near the screen centre (where the user's eye is during boot)
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      const x = cx + (Math.random() - 0.5) * Math.min(window.innerWidth * 0.7, 720);
      const y = cy + (Math.random() - 0.5) * Math.min(window.innerHeight * 0.5, 480);
      setGhosts((g) => {
        const next = [...g, { ch: e.key, x, y, id }];
        return next.slice(-48);
      });
      // Reap after the animation completes (2.0s + small buffer)
      setTimeout(() => {
        setGhosts((g) => g.filter((it) => it.id !== id));
      }, 2200);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [reducedMotion]);

  // Skip + record
  useEffect(() => {
    if (reducedMotion) {
      sessionStorage.setItem(BOOT_KEY, '1');
      onComplete();
    }
  }, [reducedMotion, onComplete]);

  // Build particles after first paint of the canvas size
  useEffect(() => {
    if (reducedMotion) return;
    const w = 320;
    const h = 320;
    setParticles(buildParticles(w, h, 240));
  }, [reducedMotion]);

  // Phase scheduler
  useEffect(() => {
    if (reducedMotion) return;
    onPlaySound?.();
    const t1 = setTimeout(() => setPhase('assemble'), 600);
    const t2 = setTimeout(() => setPhase('identify'), 1500);
    const t3 = setTimeout(() => setPhase('commit'), 2300);
    const t4 = setTimeout(() => setPhase('fade'), 2700);
    const t5 = setTimeout(() => {
      sessionStorage.setItem(BOOT_KEY, '1');
      onComplete();
    }, 3100);
    return () => { [t1, t2, t3, t4, t5].forEach(clearTimeout); };
  }, [reducedMotion, onComplete, onPlaySound]);

  // Status-line stagger (one per 200ms once identify phase begins)
  useEffect(() => {
    if (phase !== 'identify' && phase !== 'commit') return;
    const id = setInterval(() => {
      setStatusIndex((i) => Math.min(i + 1, STATUS_LINES.length));
    }, 130);
    return () => clearInterval(id);
  }, [phase]);

  // Progress bar — animate 0→1 over 2.5s
  useEffect(() => {
    if (reducedMotion) return;
    const controls = animate(progress, 1, { duration: 2.5, ease: 'easeInOut' });
    return () => controls.stop();
  }, [progress, reducedMotion]);

  // Click-to-skip — only on click, plus Esc / Space / Enter for keyboard
  // skip. Other keystrokes are reserved for the ghost handler below.
  useEffect(() => {
    if (reducedMotion) return;
    const onSkip = () => {
      sessionStorage.setItem(BOOT_KEY, '1');
      onComplete();
    };
    const onSkipKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        onSkip();
      }
    };
    window.addEventListener('click', onSkip);
    window.addEventListener('keydown', onSkipKey);
    return () => {
      window.removeEventListener('click', onSkip);
      window.removeEventListener('keydown', onSkipKey);
    };
  }, [onComplete, reducedMotion]);

  if (reducedMotion) return null;

  return createPortal(
    <motion.div
      ref={containerRef}
      role="dialog"
      aria-label="System boot sequence"
      initial={{ opacity: 1 }}
      animate={{ opacity: phase === 'fade' ? 0 : 1 }}
      transition={{ duration: 0.4, ease: [0.6, 0, 0.4, 1] }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: '#000',
        display: 'grid',
        placeItems: 'center',
        fontFamily: 'var(--font-mono)',
        color: '#FFB347',
        overflow: 'hidden',
        cursor: 'none',
      }}
    >
      {/* Phase 1: boot text */}
      <motion.div
        animate={{ opacity: phase === 'init' ? 1 : 0.0 }}
        transition={{ duration: 0.3 }}
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          fontSize: 14,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          opacity: 0.8,
        }}
      >
        boot.init
        <BlinkCaret />
      </motion.div>

      {/* Phase 2-3: particle assembly */}
      <div
        style={{
          position: 'relative',
          width: 320,
          height: 320,
          opacity: phase === 'init' ? 0 : 1,
          transition: 'opacity 0.6s ease',
        }}
      >
        <svg
          viewBox="0 0 320 320"
          style={{ width: '100%', height: '100%', overflow: 'visible' }}
        >
          {particles.map((p, i) => (
            <motion.circle
              key={i}
              r="1.2"
              fill="#FFB347"
              initial={{ cx: p.startX, cy: p.startY, opacity: 0 }}
              animate={
                phase === 'assemble' || phase === 'identify' || phase === 'commit'
                  ? { cx: p.targetX, cy: p.targetY, opacity: 0.9 }
                  : phase === 'fade'
                    ? { opacity: 0 }
                    : undefined
              }
              transition={{
                duration: 1.0,
                delay: 0.6 + p.delay,
                ease: [0.16, 1, 0.3, 1],
              }}
              style={{ filter: 'drop-shadow(0 0 3px #FFB347)' }}
            />
          ))}
        </svg>
      </div>

      {/* Keystroke ghosts — characters typed during boot.
          Outer div handles positioning + centre offset.
          Inner motion.span animates opacity + scale only (no transform
          conflict), so the centring stays fixed for the full lifetime. */}
      {ghosts.map((g) => (
        <div
          key={g.id}
          aria-hidden="true"
          style={{
            position: 'fixed',
            left: g.x,
            top: g.y,
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
            zIndex: 10000,
          }}
        >
          <motion.span
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: [0, 1, 0], scale: [0.4, 1.6, 0.7] }}
            transition={{ duration: 2.0, ease: [0.16, 1, 0.3, 1], times: [0, 0.18, 1] }}
            style={{
              display: 'inline-block',
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(48px, 8vw, 96px)',
              fontWeight: 600,
              color: '#FFB347',
              textShadow:
                '0 0 6px rgba(255,179,71,1), 0 0 24px rgba(255,179,71,0.7), 0 0 64px rgba(255,179,71,0.4)',
              willChange: 'transform, opacity',
            }}
          >
            {g.ch}
          </motion.span>
        </div>
      ))}

      {/* Hint pill: tells the user typing during boot does something */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: phase === 'init' ? 0 : 0.6 }}
        transition={{ duration: 0.4, delay: 0.4 }}
        style={{
          position: 'absolute',
          bottom: 'calc(7vh + 32px)',
          left: '50%',
          transform: 'translateX(-50%)',
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: '#8E8B82',
          padding: '6px 14px',
          border: '1px solid rgba(255,179,71,0.2)',
          borderRadius: 999,
          pointerEvents: 'none',
        }}
      >
        type to inject · esc · enter · space to skip
      </motion.div>

      {/* Status lines (top-left HUD) */}
      <div
        style={{
          position: 'absolute',
          top: '7vh',
          left: '7vw',
          fontSize: 11,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: '#8E8B82',
          lineHeight: 1.8,
        }}
      >
        {STATUS_LINES.slice(0, statusIndex).map((line, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
            style={{ color: i === statusIndex - 1 ? '#FFB347' : '#8E8B82' }}
          >
            {line}
          </motion.div>
        ))}
      </div>

      {/* Top-right metadata */}
      <div
        style={{
          position: 'absolute',
          top: '7vh',
          right: '7vw',
          fontSize: 10,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: '#8E8B82',
          textAlign: 'right',
          lineHeight: 1.7,
        }}
      >
        v.6.2.0<br />
        devansh.barai/sys<br />
        <span style={{ color: '#FFB347' }}>● online</span>
      </div>

      {/* Bottom progress bar */}
      <div
        style={{
          position: 'absolute',
          bottom: '7vh',
          left: '7vw',
          right: '7vw',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 10,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: '#8E8B82',
          }}
        >
          <span>establishing presence</span>
          <span style={{ color: '#FFB347' }}>click to skip</span>
        </div>
        <div
          style={{
            height: 1,
            width: '100%',
            background: 'rgba(255,179,71,0.15)',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <motion.div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: progressWidth,
              background: 'linear-gradient(90deg, #FF8A2E, #FFB347, #FFE2A8)',
              boxShadow: '0 0 8px #FFB347, 0 0 24px rgba(255,179,71,0.6)',
            }}
          />
        </div>
      </div>

      {/* Crosshair tick marks at corners */}
      {[
        { top: '4vh', left: '4vw', rotate: 0 },
        { top: '4vh', right: '4vw', rotate: 90 },
        { bottom: '4vh', left: '4vw', rotate: 270 },
        { bottom: '4vh', right: '4vw', rotate: 180 },
      ].map((pos, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: phase === 'init' ? 0 : 0.5, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.6 }}
          style={{
            position: 'absolute',
            ...pos,
            width: 16,
            height: 16,
            borderTop: '1px solid #FFB347',
            borderLeft: '1px solid #FFB347',
            transform: `rotate(${pos.rotate}deg)`,
          }}
          aria-hidden="true"
        />
      ))}
    </motion.div>,
    document.body,
  );
}

function BlinkCaret() {
  return (
    <motion.span
      animate={{ opacity: [1, 0, 1] }}
      transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
      style={{ marginLeft: 4 }}
    >
      ▍
    </motion.span>
  );
}
