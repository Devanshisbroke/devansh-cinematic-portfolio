/**
 * PresenceWatermark — appears when the user has spent meaningful time
 * inside the experience.
 *
 * After 90 seconds on the page (across the whole session, not per
 * scene), a faint mono line fades in beneath the contact links. It
 * acknowledges the user's presence with humanity — "you've been here
 * for X · that's worth a real reply when you write."
 *
 * Pulled from a curated rotation of warm sentences so the same person
 * sees a slightly different one on subsequent loads (driven by a
 * stable session hash).
 */

import { useEffect, useState } from 'react';

const LINES = [
  'that earns a real reply when you write.',
  'thank you for actually reading.',
  "let's do a real conversation when you write.",
  "this much attention deserves a thoughtful answer.",
  "you have my full attention back when you write.",
] as const;

function pickLine(): string {
  // Stable per session; avoid flicker if the watermark re-mounts.
  if (typeof window !== 'undefined') {
    const cached = (window as unknown as { __pcrWatermarkLine__?: string })
      .__pcrWatermarkLine__;
    if (cached) return cached;
    const line = LINES[Math.floor(Math.random() * LINES.length)]!;
    (window as unknown as { __pcrWatermarkLine__?: string }).__pcrWatermarkLine__ = line;
    return line;
  }
  return LINES[0]!;
}

function fmtElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m === 0) return `${s} second${s === 1 ? '' : 's'}`;
  if (r === 0) return `${m} minute${m === 1 ? '' : 's'}`;
  return `${m}m ${r}s`;
}

export function PresenceWatermark({ thresholdMs = 90_000 }: { thresholdMs?: number }) {
  const [reveal, setReveal] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (typeof performance === 'undefined') return;
    const start = performance.now();
    const tick = setInterval(() => {
      const e = performance.now() - start;
      setElapsed(e);
      if (e >= thresholdMs) setReveal(true);
    }, 1000);
    return () => clearInterval(tick);
  }, [thresholdMs]);

  if (!reveal) return null;

  const line = pickLine();
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        marginTop: 'var(--space-7)',
        textAlign: 'center',
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        color: '#8E8B82',
        opacity: 0,
        animation: 'presence-fade 1.2s ease-out 0.2s forwards',
      }}
    >
      <style>{`
        @keyframes presence-fade {
          to { opacity: 0.7; }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-presence-watermark] { animation: none !important; opacity: 0.7 !important; }
        }
      `}</style>
      <span data-presence-watermark>
        you've been here for{' '}
        <span style={{ color: '#FFB347' }}>{fmtElapsed(elapsed)}</span>
        {' '}— {line}
      </span>
    </div>
  );
}
