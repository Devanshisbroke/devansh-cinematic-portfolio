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
  // Vite injects a build-time signature via define; fall back to a
  // session-stable random for dev so the value isn't blank.
  const buildHash = (typeof globalThis !== 'undefined'
    ? (globalThis as unknown as { __PCR_BUILD_HASH__?: string }).__PCR_BUILD_HASH__
    : undefined) ?? '';
  if (buildHash && buildHash.length > 0) return buildHash.slice(0, 7);
  // Ephemeral session hash — same per page load
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

  useEffect(() => {
    const id = setInterval(() => {
      setUptime(fmtUptime(performance.now() - startRef.current));
      setPulseTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(id);
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
          color: '#FFB347',
          background: 'transparent',
          border: 'none',
          padding: 0,
          margin: 0,
          font: 'inherit',
          cursor: 'none',
          textTransform: 'uppercase',
          letterSpacing: 'inherit',
          transition: 'opacity 200ms ease',
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
            background: '#FFB347',
            boxShadow: '0 0 8px #FFB347, 0 0 24px rgba(255,179,71,0.6)',
            opacity: pulseTick % 2 === 0 ? 1 : 0.7,
            transition: 'opacity 240ms ease',
          }}
        />
        ● online
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
          {i < metrics.length - 1 && <span style={{ opacity: 0.25, marginInlineStart: 8 }}>·</span>}
        </span>
      ))}
    </div>
  );
}
