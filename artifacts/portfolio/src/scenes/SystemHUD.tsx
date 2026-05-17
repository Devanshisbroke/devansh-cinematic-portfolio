/**
 * SystemHUD — ambient AI / OS presence.
 *
 * A small corner HUD that surfaces contextual signal as the user moves
 * through the experience: which scene is active, scroll velocity,
 * pointer presence, current "operating mode". Reads from scroll-spy and
 * route-map; never blocks pointer events; collapses on mobile to a thin
 * status bar.
 *
 * The intent: replace a chatbot with an ambient presence that feels
 * like the site is *aware* without ever pestering the user.
 */

import { motion, useScroll, useSpring } from 'framer-motion';
import { useEffect, useState } from 'react';
import { routeMap } from '../route-map/data';

interface SceneMeta {
  slug: string;
  label: string;
  mode: string;
  hue: string;
}

const SCENE_META: Readonly<Record<string, SceneMeta>> = {
  'scene-threshold': { slug: 'threshold', label: 'Threshold', mode: 'identity.boot', hue: '#FFB347' },
  'scene-compass':   { slug: 'compass',   label: 'Compass',   mode: 'dual.track',     hue: '#6FD4FF' },
  'scene-work':      { slug: 'work',      label: 'Work',      mode: 'system.exec',    hue: '#B388FF' },
  'scene-ethos':     { slug: 'ethos',     label: 'Ethos',     mode: 'reasoning',      hue: '#8EB58A' },
  'scene-signal':    { slug: 'signal',    label: 'Signal',    mode: 'transmit',       hue: '#FFB347' },
};

const FALLBACK: SceneMeta = { slug: '—', label: '—', mode: 'idle', hue: '#FFB347' };

export function SystemHUD() {
  const [activeId, setActiveId] = useState<string>('scene-threshold');
  const [pointerActive, setPointerActive] = useState(false);
  const [time, setTime] = useState<string>('');

  const { scrollYProgress } = useScroll();
  const smoothScroll = useSpring(scrollYProgress, { stiffness: 200, damping: 30 });
  const [percent, setPercent] = useState(0);

  // Active-scene observer — single IntersectionObserver across all scenes
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const ids = routeMap.map((r) => r.domId);
    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (elements.length === 0) return;

    const seen = new Map<string, number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          seen.set(entry.target.id, entry.intersectionRatio);
        }
        // Pick the entry with the highest visibility ratio
        let bestId = activeId;
        let bestRatio = -1;
        for (const [id, ratio] of seen) {
          if (ratio > bestRatio) {
            bestRatio = ratio;
            bestId = id;
          }
        }
        if (bestId !== activeId) setActiveId(bestId);
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    elements.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [activeId]);

  // Pointer detection
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const onMove = () => {
      setPointerActive(true);
      clearTimeout(timeout);
      timeout = setTimeout(() => setPointerActive(false), 1800);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      clearTimeout(timeout);
      window.removeEventListener('pointermove', onMove);
    };
  }, []);

  // Clock — updates once per second
  useEffect(() => {
    const update = () => {
      const d = new Date();
      const hh = d.getHours().toString().padStart(2, '0');
      const mm = d.getMinutes().toString().padStart(2, '0');
      const ss = d.getSeconds().toString().padStart(2, '0');
      setTime(`${hh}:${mm}:${ss}`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  // Scroll progress text
  useEffect(() => {
    const unsub = smoothScroll.on('change', (v) => {
      setPercent(Math.round(v * 100));
    });
    return () => unsub();
  }, [smoothScroll]);

  const meta = SCENE_META[activeId] ?? FALLBACK;

  return (
    <motion.aside
      role="status"
      aria-label="System status"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 1.0, ease: [0.16, 1, 0.3, 1] }}
      style={{
        position: 'fixed',
        bottom: 'clamp(var(--space-3), 2vw, var(--space-5))',
        right: 'clamp(var(--space-3), 2vw, var(--space-5))',
        zIndex: 90,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 6,
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: '#8E8B82',
        userSelect: 'none',
      }}
    >
      {/* Top: signal indicator + scene label */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(20px) saturate(160%)',
          WebkitBackdropFilter: 'blur(20px) saturate(160%)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 999,
        }}
      >
        <SignalDot hue={meta.hue} />
        <span style={{ color: '#DCD9D2' }}>scene</span>
        <span style={{ color: meta.hue, textShadow: `0 0 8px ${meta.hue}` }}>
          {meta.label.toUpperCase()}
        </span>
        <span style={{ opacity: 0.4, marginInline: 4 }}>::</span>
        <span>{meta.mode}</span>
      </div>

      {/* Middle: progress + clock + cursor presence */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 12px',
          background: 'rgba(0,0,0,0.45)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.05)',
          borderRadius: 999,
          fontSize: 9,
        }}
      >
        <span style={{ width: 36, textAlign: 'right' }}>{percent.toString().padStart(2, '0')}%</span>
        <span style={{ opacity: 0.3 }}>|</span>
        <span style={{ width: 64, color: '#DCD9D2' }}>{time}</span>
        <span style={{ opacity: 0.3 }}>|</span>
        <span style={{ color: pointerActive ? '#FFB347' : '#3F3D36', width: 16 }}>
          {pointerActive ? '◉' : '○'}
        </span>
      </div>
    </motion.aside>
  );
}

function SignalDot({ hue }: { hue: string }) {
  return (
    <span
      aria-hidden="true"
      style={{ position: 'relative', width: 8, height: 8, display: 'inline-block' }}
    >
      <span
        style={{
          position: 'absolute',
          inset: 0,
          background: hue,
          borderRadius: '50%',
          boxShadow: `0 0 8px ${hue}, 0 0 24px ${hue}80`,
        }}
      />
      <motion.span
        animate={{ scale: [1, 2.6], opacity: [0.6, 0] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'transparent',
          border: `1px solid ${hue}`,
          borderRadius: '50%',
        }}
      />
    </span>
  );
}
