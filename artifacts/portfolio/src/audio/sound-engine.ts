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

type SoundName = 'boot' | 'enter' | 'tick' | 'burst' | 'dump' | 'meltdown';

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let droneOsc1: OscillatorNode | null = null;
let droneOsc2: OscillatorNode | null = null;
let droneGain: GainNode | null = null;

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
  if (isAudioEnabled()) {
    startAmbientDrone(ctx);
  }
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
    if (c) {
      if (c.state === 'suspended') void c.resume();
      startAmbientDrone(c);
    }
  } else {
    stopAmbientDrone();
    if (ctx && ctx.state === 'running') {
      void ctx.suspend();
    }
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

// === Ambient Drone ========================================================
//
// A two-oscillator sub-bass bed (55 Hz sine + 110 Hz triangle). Rather
// than coupling the drone to scroll position — which would require a
// second `window` scroll listener and violate the single-shared-scroll
// -source invariant (R5.2) — the drone breathes on its own slow LFO:
// a third oscillator at 0.05 Hz gently detunes the pair via a
// GainNode-scaled frequency offset. The result is an organic, evolving
// pad that needs zero scroll wiring and runs entirely on the audio
// thread (no per-frame JS).

let droneLfo: OscillatorNode | null = null;
let droneLfoGain: GainNode | null = null;

function startAmbientDrone(c: AudioContext) {
  if (droneOsc1) return;
  if (!masterGain) return;

  droneGain = c.createGain();
  droneGain.gain.value = 0.05;
  droneGain.connect(masterGain);

  droneOsc1 = c.createOscillator();
  droneOsc1.type = 'sine';
  droneOsc1.frequency.value = 55;
  droneOsc1.connect(droneGain);
  droneOsc1.start();

  droneOsc2 = c.createOscillator();
  droneOsc2.type = 'triangle';
  droneOsc2.frequency.value = 110;
  droneOsc2.connect(droneGain);
  droneOsc2.start();

  // Slow breathing LFO — modulates both oscillators' detune on the audio
  // thread so the pad evolves without any main-thread / scroll wiring.
  droneLfo = c.createOscillator();
  droneLfo.type = 'sine';
  droneLfo.frequency.value = 0.05; // one cycle every 20s
  droneLfoGain = c.createGain();
  droneLfoGain.gain.value = 6; // ±6 cents of detune sweep
  droneLfo.connect(droneLfoGain);
  droneLfoGain.connect(droneOsc1.detune);
  droneLfoGain.connect(droneOsc2.detune);
  droneLfo.start();
}

function stopAmbientDrone() {
  if (droneLfo) {
    droneLfo.stop();
    droneLfo.disconnect();
    droneLfo = null;
  }
  if (droneLfoGain) {
    droneLfoGain.disconnect();
    droneLfoGain = null;
  }
  if (droneOsc1) {
    droneOsc1.stop();
    droneOsc1.disconnect();
    droneOsc1 = null;
  }
  if (droneOsc2) {
    droneOsc2.stop();
    droneOsc2.disconnect();
    droneOsc2 = null;
  }
  if (droneGain) {
    droneGain.disconnect();
    droneGain = null;
  }
}

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
    case 'meltdown': {
      const c = ensureContext();
      if (!c || !masterGain) return;
      const t0 = c.currentTime;
      const duration = 2.0;

      const osc = c.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(380, t0);
      osc.frequency.exponentialRampToValueAtTime(30, t0 + duration);

      const filter = c.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, t0);
      filter.frequency.exponentialRampToValueAtTime(80, t0 + duration);

      const env = c.createGain();
      env.gain.setValueAtTime(0.25, t0);
      env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

      osc.connect(filter);
      filter.connect(env);
      env.connect(masterGain);

      osc.start(t0);
      osc.stop(t0 + duration + 0.1);

      playTone({
        freq: 45,
        durationMs: 2000,
        type: 'sine',
        attack: 0.2,
        release: 0.8,
        gain: 0.3,
      });

      // crackling static bursts
      for (let i = 0; i < 15; i++) {
        const start = Math.random() * 1.5;
        const dur = 10 + Math.random() * 40;
        setTimeout(() => {
          if (isAudioEnabled()) {
            playNoiseBurst(dur, 0.08);
          }
        }, start * 1000);
      }
      break;
    }
  }
}

export function playKeystroke(keyChar: string): void {
  if (!isAudioEnabled()) return;
  const c = ensureContext();
  if (!c || !masterGain) return;

  const SCALE = [
    196.00, // G3
    220.00, // A3
    246.94, // B3
    293.66, // D4
    329.63, // E4
    392.00, // G4
    440.00, // A4
    493.88, // B4
    587.33, // D5
    659.25, // E5
    783.99, // G5
    880.00, // A5
  ];

  const code = keyChar.toLowerCase().charCodeAt(0);
  if (isNaN(code) || code < 32 || code > 126) return; // only play printable ASCII

  // Read config from local storage dynamically
  let waveform: OscillatorType = 'triangle';
  let attackMs = 3;
  let releaseMs = 120;

  if (typeof window !== 'undefined') {
    try {
      const storedWave = window.localStorage.getItem('pcr.bios-waveform') as OscillatorType | null;
      if (storedWave) waveform = storedWave;

      const storedAttack = window.localStorage.getItem('pcr.bios-attack');
      if (storedAttack === 'fast') attackMs = 3;
      else if (storedAttack === 'medium') attackMs = 8;
      else if (storedAttack === 'slow') attackMs = 20;

      const storedRelease = window.localStorage.getItem('pcr.bios-release');
      if (storedRelease === 'fast') releaseMs = 60;
      else if (storedRelease === 'medium') releaseMs = 120;
      else if (storedRelease === 'slow') releaseMs = 250;
    } catch {
      // noop
    }
  }

  // Map to scale index
  const idx = code % SCALE.length;
  const freq = SCALE[idx]!;

  // 1. Dynamic oscillator for warm fundamental
  playTone({
    freq,
    durationMs: 100 + releaseMs,
    type: waveform,
    attack: attackMs / 1000,
    release: releaseMs / 1000,
    gain: 0.07,
  });

  // 2. Harmonic overtone oscillator
  playTone({
    freq: freq * 2,
    durationMs: 40 + releaseMs / 2,
    type: waveform === 'sine' ? 'triangle' : 'sine', // contrast wave
    attack: 0.001,
    release: (releaseMs / 2) / 1000,
    gain: 0.02,
  });

  // 3. Short mechanical click (noise burst)
  playNoiseBurst(12, 0.04);
}

