/**
 * KonamiListener — listens for the classic Konami code and triggers
 * a callback. Off by default; mounts at the App level once.
 *
 * Sequence: ↑ ↑ ↓ ↓ ← → ← → B A
 */

import { useEffect } from 'react';

const SEQUENCE = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'b',
  'a',
] as const;

export function KonamiListener({ onActivate }: { onActivate: () => void }) {
  useEffect(() => {
    let pos = 0;
    const onKey = (e: KeyboardEvent) => {
      const expected = SEQUENCE[pos];
      const got = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (got === expected) {
        pos++;
        if (pos === SEQUENCE.length) {
          pos = 0;
          onActivate();
        }
      } else {
        // Be generous: accept the first key as a restart, otherwise reset.
        pos = got === SEQUENCE[0] ? 1 : 0;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onActivate]);

  return null;
}
