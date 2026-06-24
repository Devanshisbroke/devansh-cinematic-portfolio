import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { isAudioEnabled } from '../../audio/sound-engine';

const MORSE_MAP: Record<string, string> = {
  a: '.-', b: '-...', c: '-.-.', d: '-..', e: '.', f: '..-.', g: '--.', h: '....',
  i: '..', j: '.---', k: '-.-', l: '.-..', m: '--', n: '-.', o: '---', p: '.--.',
  q: '--.-', r: '.-.', s: '...', t: '-', u: '..-', v: '...-', w: '.--', x: '-..-',
  y: '-.--', z: '--..',
  '1': '.----', '2': '..---', '3': '...--', '4': '....-', '5': '.....',
  '6': '-....', '7': '--...', '8': '---..', '9': '----.', '0': '-----',
  ' ': ' ',
};

export function MorseTranslator({
  active,
  onClose,
}: {
  active: boolean;
  onClose: () => void;
}) {
  const [inputText, setInputText] = useState('sos');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSymbol, setCurrentSymbol] = useState('');
  const audioCtxRef = useRef<AudioContext | null>(null);
  const playTimeoutRef = useRef<number | null>(null);

  const getMorseString = (text: string): string => {
    return Array.from(text.toLowerCase())
      .map((char) => MORSE_MAP[char] ?? '')
      .filter((code) => code.length > 0)
      .join(' ');
  };

  const playMorse = async () => {
    if (isPlaying) return;
    setIsPlaying(true);

    const codes = getMorseString(inputText);
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) {
      setIsPlaying(false);
      return;
    }

    const ctx = audioCtxRef.current || new Ctor();
    audioCtxRef.current = ctx;

    const dotDuration = 80; // ms
    const dashDuration = 240; // ms
    const symbolSpacing = 80; // ms
    const letterSpacing = 240; // ms

    const playBeep = (duration: number): Promise<void> => {
      return new Promise((resolve) => {
        if (!isAudioEnabled()) {
          // If sound is disabled, still flash visually
          window.dispatchEvent(new CustomEvent('pcr.morse-flash', { detail: { active: true } }));
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('pcr.morse-flash', { detail: { active: false } }));
            resolve();
          }, duration);
          return;
        }

        try {
          const t0 = ctx.currentTime;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(800, t0); // high frequency morse pitch

          gain.gain.setValueAtTime(0.06, t0);
          gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration / 1000 - 0.005);

          osc.connect(gain);
          gain.connect(ctx.destination);

          // Dispatch visual flash event sync'd with audio beep
          window.dispatchEvent(new CustomEvent('pcr.morse-flash', { detail: { active: true } }));

          osc.start();
          osc.stop(t0 + duration / 1000);

          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('pcr.morse-flash', { detail: { active: false } }));
            resolve();
          }, duration);
        } catch {
          resolve();
        }
      });
    };

    // Play loop
    for (let i = 0; i < codes.length; i++) {
      if (!isPlaying && isPlaying === false) break; // guard exit
      const char = codes[i];
      setCurrentSymbol(char ?? '');

      if (char === '.') {
        await playBeep(dotDuration);
        await new Promise((r) => {
          playTimeoutRef.current = window.setTimeout(r, symbolSpacing);
        });
      } else if (char === '-') {
        await playBeep(dashDuration);
        await new Promise((r) => {
          playTimeoutRef.current = window.setTimeout(r, symbolSpacing);
        });
      } else if (char === ' ') {
        await new Promise((r) => {
          playTimeoutRef.current = window.setTimeout(r, letterSpacing);
        });
      }
    }

    setIsPlaying(false);
    setCurrentSymbol('');
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  useEffect(() => {
    if (active) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (playTimeoutRef.current !== null) {
        clearTimeout(playTimeoutRef.current);
      }
      if (audioCtxRef.current) {
        void audioCtxRef.current.close();
      }
      // Make sure we clear the flash status on exit
      window.dispatchEvent(new CustomEvent('pcr.morse-flash', { detail: { active: false } }));
    };
  }, [active, onClose]);

  if (!active || typeof document === 'undefined') return null;

  const morseCode = getMorseString(inputText);

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.82)',
        backdropFilter: 'blur(10px)',
        zIndex: 999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#FFFFFF',
        fontFamily: 'var(--font-mono)',
      }}
    >
      <div
        style={{
          width: 'min(90vw, 480px)',
          backgroundColor: '#0A0A0A',
          border: '1px solid rgba(255, 179, 71, 0.25)',
          borderRadius: 12,
          padding: 24,
          boxShadow: 'var(--glow-amber)',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#FFB347', fontSize: 13, fontWeight: 'bold' }}>📡 MORSE TELEMETRY TRANSMITTER</span>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#8E8B82',
              cursor: 'none',
              fontSize: 16,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label htmlFor="morse-input" style={{ fontSize: 10, color: '#8E8B82', textTransform: 'uppercase' }}>Text Directive</label>
          <input
            id="morse-input"
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value.slice(0, 36))}
            disabled={isPlaying}
            style={{
              background: '#151515',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 6,
              padding: '8px 12px',
              color: '#FFFFFF',
              fontFamily: 'inherit',
              fontSize: 14,
              outline: 'none',
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 10, color: '#8E8B82', textTransform: 'uppercase' }}>Morse Code Result</span>
          <div
            style={{
              background: '#151515',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 6,
              padding: '12px',
              minHeight: 48,
              fontSize: 18,
              letterSpacing: 2,
              color: '#FFB347',
              wordBreak: 'break-all',
              lineHeight: 1.4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {morseCode || '[no input]'}
          </div>
        </div>

        {isPlaying && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, fontSize: 12, color: '#00FF41' }}>
            <span>TRANSMITTING SYMBOL:</span>
            <span style={{ fontSize: 24, fontWeight: 'bold' }}>{currentSymbol}</span>
          </div>
        )}

        <button
          onClick={playMorse}
          disabled={isPlaying || !inputText}
          style={{
            background: 'linear-gradient(135deg, var(--color-amber), var(--color-amber-deep))',
            color: '#0A0C13',
            border: 'none',
            borderRadius: 6,
            padding: '12px',
            fontFamily: 'inherit',
            fontWeight: 'bold',
            fontSize: 12,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            cursor: 'none',
            boxShadow: isPlaying ? 'none' : 'var(--glow-amber)',
            opacity: isPlaying ? 0.5 : 1,
            transition: 'all 200ms ease',
          }}
        >
          {isPlaying ? 'Beeping...' : 'Play Morse Signal'}
        </button>
      </div>
    </div>,
    document.body
  );
}
