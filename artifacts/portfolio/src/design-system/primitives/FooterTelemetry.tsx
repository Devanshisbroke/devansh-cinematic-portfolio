/**
 * FooterTelemetry — live system telemetry strip.
 *
 * Replaces the static "all systems operational" line with a row of
 * monospace metrics that read like a real-time deploy dashboard:
 *   • build hash   (from import.meta env or fallback)
 *   • last commit  (build-time injected via Vite define; falls back
 *                   to "session" so dev never shows nothing)
 *   • status pill  (online · synthetic ping)
 *   • visitor uptime (time since first paint)
 *   • bundle size  (an approximate static value)
 *
 * Everything is computed client-side from real signals; nothing is
 * fetched or external. Reads as "this site reports its own health."
 */

import { useEffect, useRef, useState } from 'react';

interface Metric {
  label: string;
  value: string;
  hue?: string;
  event: string;
  title: string;
}

function fmtUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

function getHash(): string {
  const buildHash = (typeof globalThis !== 'undefined'
    ? (globalThis as unknown as { __PCR_BUILD_HASH__?: string }).__PCR_BUILD_HASH__
    : undefined) ?? '';
  if (buildHash && buildHash.length > 0) return buildHash.slice(0, 7);
  if (typeof window === 'undefined') return 'dev----';
  const cached = (window as unknown as { __pcrSessionHash__?: string }).__pcrSessionHash__;
  if (cached) return cached;
  const h = Math.random().toString(36).slice(2, 9);
  (window as unknown as { __pcrSessionHash__?: string }).__pcrSessionHash__ = h;
  return h;
}

export function FooterTelemetry() {
  const startRef = useRef<number>(typeof performance !== 'undefined' ? performance.now() : 0);
  const [uptime, setUptime] = useState('0s');
  const [pulseTick, setPulseTick] = useState(0);
  const [morseActive, setMorseActive] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const id = setInterval(() => {
      setUptime(fmtUptime(performance.now() - startRef.current));
      setPulseTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Listen for Morse code transmissions to flash status dot
  useEffect(() => {
    const handleMorseFlash = (e: Event) => {
      const customEv = e as CustomEvent<{ active: boolean }>;
      setMorseActive(!!customEv.detail?.active);
    };
    window.addEventListener('pcr.morse-flash', handleMorseFlash);
    return () => window.removeEventListener('pcr.morse-flash', handleMorseFlash);
  }, []);

  // Live scroll/mouse telemetry oscilloscope
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (typeof window !== 'undefined' && window.navigator.userAgent.includes('jsdom')) {
      return;
    }
    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = canvas.getContext('2d');
    } catch {
      return;
    }
    if (!ctx) return;

    // Handle high DPI crispness
    const dpr = window.devicePixelRatio || 1;
    const width = 60;
    const height = 12;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    let lastScrollY = window.scrollY;
    let scrollVel = 0;
    let lastMouseX = 0;
    let lastMouseY = 0;
    let mouseVel = 0;
    let firstMouse = true;

    const handleScroll = () => {
      const sy = window.scrollY;
      scrollVel += Math.abs(sy - lastScrollY);
      lastScrollY = sy;
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (firstMouse) {
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
        firstMouse = false;
        return;
      }
      mouseVel += Math.hypot(e.clientX - lastMouseX, e.clientY - lastMouseY);
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    const points = new Array(40).fill(0);
    let rafId = 0;

    const draw = () => {
      // Calculate current combined velocity
      const inputVal = (scrollVel + mouseVel) * 0.12;
      // Decay velocity
      scrollVel *= 0.88;
      mouseVel *= 0.88;

      // Add to points history
      points.shift();
      const jitter = (Math.random() - 0.5) * 0.3;
      points.push(inputVal + jitter);

      // Draw
      ctx.clearRect(0, 0, width, height);

      // Grid lines (subtle dark green background grid)
      ctx.strokeStyle = 'rgba(0, 255, 65, 0.12)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      // Center line
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      // Vertical grid ticks
      for (let x = 10; x < width; x += 10) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      ctx.stroke();

      // Oscilloscope line
      ctx.strokeStyle = '#00FF41';
      ctx.lineWidth = 1;
      ctx.shadowBlur = 3;
      ctx.shadowColor = '#00FF41';
      ctx.beginPath();
      for (let i = 0; i < points.length; i++) {
        const x = (i / (points.length - 1)) * width;
        const val = points[i];
        const angle = i * 0.8 + performance.now() * 0.04;
        const yOffset = Math.sin(angle) * Math.min(height / 2 - 1, val);
        const y = height / 2 + yOffset;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      ctx.shadowBlur = 0; // reset glow

      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(rafId);
    };
  }, []);

  const hash = getHash();

  const metrics: Metric[] = [
    { label: 'build',  value: hash,       hue: '#FFB347', event: 'pcr.toggle-bios',       title: 'Run BIOS setup utility' },
    { label: 'origin', value: 'static',   hue: '#8E8B82', event: 'pcr.toggle-timetravel', title: 'Travel through career timeline' },
    { label: 'react',  value: '19.x',     hue: '#8E8B82', event: 'pcr.toggle-game',       title: 'Play brick break minigame' },
    { label: 'vite',   value: '7.3',      hue: '#8E8B82', event: 'pcr.toggle-game',       title: 'Play brick break minigame' },
    { label: 'uptime', value: uptime,     hue: '#8EB58A', event: 'pcr.toggle-glitch',     title: 'Trigger cybernetic telemetry diagnostics' },
  ];

  return (
    <div
      role="status"
      aria-label="System telemetry"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 'var(--space-5)',
        alignItems: 'center',
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
      }}
    >
      <button
        type="button"
        onClick={() => window.dispatchEvent(new CustomEvent('pcr.toggle-shell'))}
        title="Open AI developer shell"
        data-cursor-magnet
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          color: morseActive ? '#00FF41' : '#FFB347',
          background: 'transparent',
          border: 'none',
          padding: 0,
          margin: 0,
          font: 'inherit',
          cursor: 'none',
          textTransform: 'uppercase',
          letterSpacing: 'inherit',
          transition: 'opacity 200ms ease, color 120ms ease',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.75'; }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: morseActive ? '#00FF41' : '#FFB347',
            boxShadow: morseActive
              ? '0 0 12px #00FF41, 0 0 24px rgba(0,255,65,0.8)'
              : '0 0 8px #FFB347, 0 0 24px rgba(255,179,71,0.6)',
            opacity: morseActive ? 1 : (pulseTick % 2 === 0 ? 1 : 0.7),
            transition: 'opacity 120ms ease, background-color 120ms ease, box-shadow 120ms ease',
          }}
        />
        {morseActive ? '● morse tx' : '● online'}
      </button>
      <span style={{ opacity: 0.3 }}>::</span>
      {metrics.map((m, i) => (
        <span
          key={m.label}
          style={{
            display: 'inline-flex',
            alignItems: 'baseline',
            gap: 6,
            color: '#8E8B82',
          }}
        >
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent(m.event))}
            title={m.title}
            data-cursor-magnet
            style={{
              display: 'inline-flex',
              alignItems: 'baseline',
              gap: 6,
              color: 'inherit',
              background: 'transparent',
              border: 'none',
              padding: 0,
              margin: 0,
              font: 'inherit',
              cursor: 'none',
              textTransform: 'uppercase',
              letterSpacing: 'inherit',
              transition: 'opacity 200ms ease, color 200ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#FFFFFF';
              const valEl = e.currentTarget.querySelector('.telemetry-value') as HTMLElement;
              if (valEl) valEl.style.textDecoration = 'underline';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'inherit';
              const valEl = e.currentTarget.querySelector('.telemetry-value') as HTMLElement;
              if (valEl) valEl.style.textDecoration = 'none';
            }}
          >
            <span style={{ opacity: 0.55 }}>{m.label}</span>
            <span
              className="telemetry-value"
              style={{
                color: m.hue ?? '#DCD9D2',
                transition: 'text-decoration 200ms ease',
              }}
            >
              {m.value}
            </span>
          </button>
          <span style={{ opacity: 0.25, marginInlineStart: 8 }}>·</span>
        </span>
      ))}
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          color: '#8E8B82',
        }}
      >
        <span style={{ opacity: 0.55 }}>OSC</span>
        <canvas
          ref={canvasRef}
          style={{
            width: 60,
            height: 12,
            background: '#070707',
            border: '1px solid rgba(0, 255, 65, 0.15)',
            borderRadius: 2,
            display: 'block',
          }}
        />
      </span>
    </div>
  );
}
