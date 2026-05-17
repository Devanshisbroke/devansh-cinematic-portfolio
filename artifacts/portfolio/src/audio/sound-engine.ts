/**
 * sound-engine.ts — opt-in WebAudio sound design.
 *
 * Synthesises every sound live (no audio assets to load). Lazy-creates a
 * single AudioContext on the first user gesture (browser autoplay
 * policy). Persists the user's enable/disable choice in localStorage
 * under `pcr.audio` so the setting survives sessions.
 *
 * Sounds:
 *   • boot     — 8-tone ascending sine chime
 *   • enter    — sub-bass whoosh on scene activation
 *   • tick     — hairline click on hover/magnetic engage
 *   • burst    — soft pluck when a facet is clicked
 *   • dump     — granular noise blip for core-dump entry
 *
 * The engine is a pure singleton; `useSound()` returns a stable hook
 * that callers can fire from event handlers.
 */

const STORAGE_KEY = 'pcr.audio';

type SoundName = 'boot' | 'enter' | 'tick' | 'burst' | 'dump';

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;

function ensureContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (ctx) return ctx;
  const Ctor =
    (window.AudioContext as typeof AudioContext | undefined) ??
    ((window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext);
  if (!Ctor) return null;
  ctx = new Ctor();
  masterGain = ctx.createGain();
  masterGain.gain.value = 0.18;
  masterGain.connect(ctx.destination);
  return ctx;
}

export function isAudioEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage?.getItem(STORAGE_KEY) === 'on';
  } catch {
    return false;
  }
}

export function setAudioEnabled(on: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage?.setItem(STORAGE_KEY, on ? 'on' : 'off');
  } catch {
    /* noop */
  }
  if (on) {
    // Resume context if it was suspended by autoplay policy
    const c = ensureContext();
    if (c && c.state === 'suspended') void c.resume();
  } else if (ctx && ctx.state === 'running') {
    void ctx.suspend();
  }
}

/** Subscribe to enable/disable changes so HUDs can re-render. */
const subscribers = new Set<(on: boolean) => void>();
export function subscribeAudio(cb: (on: boolean) => void): () => void {
  subscribers.add(cb);
  return () => subscribers.delete(cb);
}
function emit(on: boolean): void {
  for (const cb of subscribers) cb(on);
}

const baseSetAudioEnabled = setAudioEnabled;
export const setAudio = (on: boolean): void => {
  baseSetAudioEnabled(on);
  emit(on);
};

// === Synthesis primitives =================================================

interface ToneOpts {
  freq: number;
  startAt?: number;
  durationMs: number;
  type?: OscillatorType;
  attack?: number;
  release?: number;
  gain?: number;
}

function playTone({
  freq,
  startAt = 0,
  durationMs,
  type = 'sine',
  attack = 0.01,
  release = 0.12,
  gain = 0.5,
}: ToneOpts): void {
  if (!isAudioEnabled()) return;
  const c = ensureContext();
  if (!c || !masterGain) return;
  const t0 = c.currentTime + startAt;
  const t1 = t0 + durationMs / 1000;

  const osc = c.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;

  const env = c.createGain();
  env.gain.value = 0;
  env.gain.linearRampToValueAtTime(gain, t0 + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, t1 + release);

  osc.connect(env);
  env.connect(masterGain);
  osc.start(t0);
  osc.stop(t1 + release + 0.05);
}

function playNoiseBurst(durationMs: number, gain = 0.4): void {
  if (!isAudioEnabled()) return;
  const c = ensureContext();
  if (!c || !masterGain) return;
  const t0 = c.currentTime;
  const samples = Math.floor((c.sampleRate * durationMs) / 1000);
  const buffer = c.createBuffer(1, samples, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < samples; i++) {
    const t = i / samples;
    const env = (1 - t) ** 2;
    data[i] = (Math.random() * 2 - 1) * env;
  }
  const src = c.createBufferSource();
  src.buffer = buffer;
  const env = c.createGain();
  env.gain.value = gain;
  const filter = c.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 800;
  src.connect(filter);
  filter.connect(env);
  env.connect(masterGain);
  src.start(t0);
}

// === Sound library =========================================================

export function play(name: SoundName): void {
  if (!isAudioEnabled()) return;
  switch (name) {
    case 'boot':
      // 8-tone ascending pentatonic
      [261.63, 329.63, 392.0, 523.25, 587.33, 659.25, 783.99, 1046.5].forEach(
        (f, i) => {
          playTone({
            freq: f,
            startAt: i * 0.06,
            durationMs: 110,
            type: 'sine',
            gain: 0.18,
            attack: 0.005,
            release: 0.18,
          });
        },
      );
      // Sub-bass tail
      playTone({
        freq: 110,
        startAt: 0.4,
        durationMs: 600,
        type: 'sine',
        gain: 0.3,
        attack: 0.06,
        release: 0.5,
      });
      break;
    case 'enter':
      playTone({
        freq: 220,
        durationMs: 320,
        type: 'sine',
        attack: 0.03,
        release: 0.4,
        gain: 0.18,
      });
      playTone({
        freq: 110,
        durationMs: 600,
        type: 'sine',
        attack: 0.05,
        release: 0.6,
        gain: 0.22,
      });
      playNoiseBurst(180, 0.05);
      break;
    case 'tick':
      playTone({
        freq: 1800,
        durationMs: 12,
        type: 'square',
        attack: 0.001,
        release: 0.04,
        gain: 0.06,
      });
      break;
    case 'burst':
      playTone({
        freq: 440,
        durationMs: 100,
        type: 'triangle',
        attack: 0.002,
        release: 0.18,
        gain: 0.12,
      });
      playTone({
        freq: 880,
        durationMs: 80,
        type: 'sine',
        attack: 0.001,
        release: 0.14,
        gain: 0.08,
      });
      break;
    case 'dump':
      playNoiseBurst(80, 0.16);
      playTone({
        freq: 60,
        durationMs: 240,
        type: 'sawtooth',
        attack: 0.005,
        release: 0.3,
        gain: 0.22,
      });
      break;
  }
}
