/**
 * CoreDump — easter egg "developer telemetry" overlay.
 *
 * Triggered by the Konami code (↑↑↓↓←→←→BA) or the command-palette entry
 * "Core dump · system telemetry". Renders a wireframe overlay with
 * scrolling system stats, dim shaded scenes, and a ticking countdown.
 * Auto-dismisses after 60s; Esc closes early.
 */

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { projects } from '../../content-registry/data';
import { routeMap } from '../../route-map/data';

export function CoreDump({
  active,
  onClose,
}: {
  active: boolean;
  onClose: () => void;
}) {
  const [remaining, setRemaining] = useState(60);
  const [fps, setFps] = useState(60);
  const [scrollY, setScrollY] = useState(0);
  const [memory, setMemory] = useState<string>('—');
  const [now, setNow] = useState<string>('');

  useEffect(() => {
    if (!active) return;
    document.documentElement.setAttribute('data-core-dump', 'on');
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const tickdown = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          onClose();
          return 60;
        }
        return r - 1;
      });
    }, 1000);
    return () => {
      window.removeEventListener('keydown', onKey);
      clearInterval(tickdown);
      document.documentElement.removeAttribute('data-core-dump');
    };
  }, [active, onClose]);

  useEffect(() => {
    if (!active) return;
    let last = performance.now();
    let frames = 0;
    let raf = 0;
    const tick = (t: number) => {
      frames++;
      if (t - last > 1000) {
        setFps(frames);
        frames = 0;
        last = t;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const onScroll = () => setScrollY(window.scrollY);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const update = () => {
      const d = new Date();
      setNow(`${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}.${d.getMilliseconds().toString().padStart(3, '0')}`);
      const perf = (performance as Performance & { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
      if (perf) {
        const used = (perf.usedJSHeapSize / 1024 / 1024).toFixed(1);
        const limit = (perf.jsHeapSizeLimit / 1024 / 1024).toFixed(0);
        setMemory(`${used} / ${limit} MB`);
      }
    };
    update();
    const id = setInterval(update, 100);
    return () => clearInterval(id);
  }, [active]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 180,
            pointerEvents: 'none',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: '#8EB58A',
            letterSpacing: '0.06em',
          }}
        >
          {/* Wireframe tint */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'repeating-linear-gradient(0deg, rgba(142,181,138,0.04) 0, rgba(142,181,138,0.04) 1px, transparent 1px, transparent 4px)',
            }}
          />
          {/* Crosshair grid */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage:
                'linear-gradient(to right, rgba(142,181,138,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(142,181,138,0.06) 1px, transparent 1px)',
              backgroundSize: '64px 64px',
            }}
          />

          {/* Top-left HUD */}
          <div
            style={{
              position: 'absolute',
              top: 'var(--space-5)',
              left: 'var(--space-5)',
              padding: '12px 16px',
              background: 'rgba(0,0,0,0.85)',
              border: '1px solid rgba(142,181,138,0.4)',
              minWidth: 320,
            }}
          >
            <div style={{ color: '#8EB58A', textTransform: 'uppercase', letterSpacing: '0.18em', marginBottom: 8, fontWeight: 600 }}>
              ∎ core dump · t-{remaining.toString().padStart(2, '0')}s
            </div>
            <Row label="time"   value={now} />
            <Row label="fps"    value={`${fps}`} />
            <Row label="scroll" value={`${Math.round(scrollY)}px`} />
            <Row label="memory" value={memory} />
            <Row label="dpr"    value={`${window.devicePixelRatio.toFixed(2)}`} />
            <Row label="vp"     value={`${window.innerWidth}×${window.innerHeight}`} />
          </div>

          {/* Top-right HUD */}
          <div
            style={{
              position: 'absolute',
              top: 'var(--space-5)',
              right: 'var(--space-5)',
              padding: '12px 16px',
              background: 'rgba(0,0,0,0.85)',
              border: '1px solid rgba(142,181,138,0.4)',
              maxWidth: 360,
              textAlign: 'right',
            }}
          >
            <div style={{ color: '#8EB58A', textTransform: 'uppercase', letterSpacing: '0.18em', marginBottom: 8, fontWeight: 600 }}>
              registry inventory
            </div>
            <Row label="scenes"   value={`${routeMap.length}`} right />
            <Row label="projects" value={`${projects.length}`} right />
            <Row label="pbt"      value="12 properties" right />
            <Row label="shaders"  value="2 active" right />
            <Row label="locks"    value="0 violations" right />
          </div>

          {/* Bottom: rolling scene log */}
          <div
            style={{
              position: 'absolute',
              bottom: 'var(--space-5)',
              left: 'var(--space-5)',
              right: 'var(--space-5)',
              padding: '12px 16px',
              background: 'rgba(0,0,0,0.88)',
              border: '1px solid rgba(142,181,138,0.4)',
              maxHeight: 180,
              overflow: 'hidden',
            }}
          >
            <div style={{ color: '#8EB58A', textTransform: 'uppercase', letterSpacing: '0.18em', marginBottom: 8, fontWeight: 600 }}>
              event stream
            </div>
            <RollingLog />
          </div>

          {/* Mid-screen sigil */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 140,
              height: 140,
              border: '1px solid rgba(142,181,138,0.5)',
              borderRadius: '50%',
              pointerEvents: 'none',
              opacity: 0.5,
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 12,
                border: '1px solid rgba(142,181,138,0.35)',
                borderRadius: '50%',
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: 0,
                right: 0,
                height: 1,
                background: 'rgba(142,181,138,0.5)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: 0,
                bottom: 0,
                width: 1,
                background: 'rgba(142,181,138,0.5)',
              }}
            />
          </div>

          {/* Esc hint */}
          <div
            style={{
              position: 'absolute',
              bottom: 'var(--space-3)',
              right: 'var(--space-5)',
              fontSize: 10,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'rgba(142,181,138,0.6)',
            }}
          >
            esc · exit
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function Row({ label, value, right = false }: { label: string; value: string; right?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 16,
        flexDirection: right ? 'row-reverse' : 'row',
        marginBottom: 3,
      }}
    >
      <span style={{ color: 'rgba(142,181,138,0.55)', textTransform: 'uppercase', letterSpacing: '0.16em' }}>{label}</span>
      <span style={{ color: '#FFFFFF', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  );
}

function RollingLog() {
  const [lines, setLines] = useState<string[]>([]);
  const counterRef = useRef(0);

  useEffect(() => {
    const events = [
      'cinematic-bg.shader uniformsUpdated',
      'scroll-source emit progress',
      'globeid.network pulse spawned',
      'route-map.hash-router observe scroll-spy',
      'reduced-motion.store subscribe ack',
      'theme.store paint synced',
      'cursor.aura raf tick',
      'systemHUD intersection observe',
      'fps-sampler emit { p05, p50, p95 }',
      'lenis-bridge raf advance',
      'project-showcase render canonical',
      'webgl.layer paused visibilityChange',
    ];
    const id = setInterval(() => {
      counterRef.current++;
      const ev = events[Math.floor(Math.random() * events.length)]!;
      const t = `+${(counterRef.current * 60).toString().padStart(5, '0')}ms`;
      setLines((l) => [`${t} ${ev}`, ...l].slice(0, 8));
    }, 220);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {lines.map((l, i) => (
        <motion.div
          key={`${l}-${i}`}
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1 - i * 0.12, x: 0 }}
          transition={{ duration: 0.2 }}
          style={{ color: i === 0 ? '#FFB347' : '#8EB58A', fontVariantNumeric: 'tabular-nums' }}
        >
          {l}
        </motion.div>
      ))}
    </div>
  );
}
