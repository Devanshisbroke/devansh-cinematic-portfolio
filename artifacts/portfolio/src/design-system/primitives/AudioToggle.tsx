/**
 * AudioToggle — a small footer switch to enable/disable the synthesised
 * sound layer. Off by default; persists in localStorage via sound-engine.
 */

import { useEffect, useState } from 'react';
import { isAudioEnabled, setAudio, subscribeAudio, play } from '../../audio/sound-engine';

export function AudioToggle({ className }: { className?: string }) {
  const [on, setOn] = useState<boolean>(() => isAudioEnabled());

  useEffect(() => {
    const unsub = subscribeAudio(setOn);
    return () => { unsub(); };
  }, []);

  const handleToggle = () => {
    const next = !on;
    setAudio(next);
    if (next) {
      // Tiny ack so users know it worked
      setTimeout(() => play('tick'), 40);
    }
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label="Toggle sound"
      onClick={handleToggle}
      data-cursor-magnet
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        padding: 'var(--space-2) var(--space-3)',
        minHeight: 36,
        background: 'transparent',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 'var(--radius-pill)',
        color: 'inherit',
        fontFamily: 'var(--font-body)',
        fontSize: 'var(--text-small)',
        cursor: 'none',
      }}
    >
      <span aria-hidden="true" style={{ color: on ? '#FFB347' : '#8E8B82' }}>
        {on ? '◉' : '○'}
      </span>
      <span>Sound: {on ? 'on' : 'off'}</span>
    </button>
  );
}
