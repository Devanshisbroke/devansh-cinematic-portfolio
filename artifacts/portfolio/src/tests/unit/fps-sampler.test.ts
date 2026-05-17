/**
 * fps-sampler.test.ts — unit tests for `src/perf/fps-sampler.ts`.
 *
 * Covers two layers:
 *   1. The pure `computeFpsSample` helper — percentile arithmetic on
 *      static fps arrays. This is the layer R5.5 ultimately depends on
 *      ("5th percentile over a rolling 1-second window").
 *   2. The `startFpsSampler` rAF loop — verified end-to-end with a
 *      controllable `requestAnimationFrame` stub so we can assert the
 *      sampler emits at the requested cadence and that the teardown
 *      stops further work.
 *
 * Validates: Requirements 5.5, 11.5, 11.6
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  computeFpsSample,
  startFpsSampler,
  type FpsSample,
} from '../../perf/fps-sampler';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('computeFpsSample', () => {
  it('returns null on empty input', () => {
    expect(computeFpsSample([], 1000)).toBeNull();
  });

  it('returns the single sample for a one-element input', () => {
    const s = computeFpsSample([60], 1000);
    expect(s).toEqual<FpsSample>({
      p05: 60,
      p50: 60,
      p95: 60,
      frameCount: 1,
      windowMs: 1000,
    });
  });

  it('computes percentiles on [60,60,60,30,30] with linear interpolation', () => {
    // Sorted: [30, 30, 60, 60, 60]
    //   p05 -> idx 0.20 -> sorted[0] + (sorted[1]-sorted[0])*0.20 = 30 + 0  = 30
    //   p50 -> idx 2.00 -> sorted[2]                              = 60
    //   p95 -> idx 3.80 -> sorted[3] + (sorted[4]-sorted[3])*0.80 = 60 + 0  = 60
    const s = computeFpsSample([60, 60, 60, 30, 30], 1000);
    expect(s).not.toBeNull();
    expect(s!.p05).toBe(30);
    expect(s!.p50).toBe(60);
    expect(s!.p95).toBe(60);
    expect(s!.frameCount).toBe(5);
    expect(s!.windowMs).toBe(1000);
  });

  it('interpolates between adjacent samples for non-integer indices', () => {
    // Sorted: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100] (n=10)
    //   p05 -> idx 0.45 -> 10 + (20-10) * 0.45 = 14.5
    //   p50 -> idx 4.50 -> 50 + (60-50) * 0.50 = 55
    //   p95 -> idx 8.55 -> 90 + (100-90) * 0.55 = 95.5
    const input = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    const s = computeFpsSample(input, 1000);
    expect(s).not.toBeNull();
    expect(s!.p05).toBeCloseTo(14.5, 10);
    expect(s!.p50).toBeCloseTo(55, 10);
    expect(s!.p95).toBeCloseTo(95.5, 10);
  });

  it('is order-insensitive (sorts internally)', () => {
    const a = computeFpsSample([30, 60, 30, 60, 60], 1000)!;
    const b = computeFpsSample([60, 60, 60, 30, 30], 1000)!;
    expect(a).toEqual(b);
  });
});

describe('startFpsSampler', () => {
  it('returns a no-op teardown when requestAnimationFrame is unavailable', () => {
    vi.stubGlobal('requestAnimationFrame', undefined);
    const onSample = vi.fn();
    const teardown = startFpsSampler(onSample);
    expect(typeof teardown).toBe('function');
    teardown();
    expect(onSample).not.toHaveBeenCalled();
  });

  it('emits an FpsSample after a full window has elapsed and stops on teardown', () => {
    // Drive `requestAnimationFrame` ourselves so we control the
    // timeline. Each scheduled callback gets a deterministic `now`
    // when we fire it via `flushFrame`.
    type FrameCb = (now: number) => void;
    let nextId = 1;
    const queue = new Map<number, FrameCb>();

    const raf = vi.fn((cb: FrameCb): number => {
      const id = nextId++;
      queue.set(id, cb);
      return id;
    });
    const caf = vi.fn((id: number): void => {
      queue.delete(id);
    });

    vi.stubGlobal('requestAnimationFrame', raf);
    vi.stubGlobal('cancelAnimationFrame', caf);

    const flushFrame = (now: number): void => {
      // Run the most-recently-scheduled callback, mirroring how
      // browsers process a single frame.
      const lastId = Math.max(...queue.keys());
      const cb = queue.get(lastId);
      queue.delete(lastId);
      cb?.(now);
    };

    const onSample = vi.fn();
    const teardown = startFpsSampler(onSample, 1000);

    // First tick at t=0 is the baseline (no delta yet).
    flushFrame(0);
    expect(onSample).not.toHaveBeenCalled();

    // Five frames inside the first second producing deltas of
    // 16.67 ms each (≈ 60 fps).
    for (let i = 1; i <= 5; i++) {
      flushFrame(i * (1000 / 60));
    }
    expect(onSample).not.toHaveBeenCalled();

    // Cross the window boundary on the next frame; the sampler emits.
    flushFrame(1001);
    expect(onSample).toHaveBeenCalledTimes(1);
    const sample = onSample.mock.calls[0]![0] as FpsSample;
    expect(sample.windowMs).toBe(1000);
    expect(sample.frameCount).toBeGreaterThan(0);
    expect(sample.p05).toBeGreaterThan(0);
    expect(sample.p50).toBeGreaterThan(0);
    expect(sample.p95).toBeGreaterThan(0);

    // Teardown cancels the next pending frame and prevents further
    // callbacks from executing even if a frame somehow fires.
    teardown();
    flushFrame(2002);
    expect(onSample).toHaveBeenCalledTimes(1);
    expect(caf).toHaveBeenCalled();
  });

  it('does not throw if the consumer callback throws', () => {
    type FrameCb = (now: number) => void;
    let nextId = 1;
    const queue = new Map<number, FrameCb>();
    const raf = vi.fn((cb: FrameCb): number => {
      const id = nextId++;
      queue.set(id, cb);
      return id;
    });
    vi.stubGlobal('requestAnimationFrame', raf);
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    const flushFrame = (now: number): void => {
      const lastId = Math.max(...queue.keys());
      const cb = queue.get(lastId);
      queue.delete(lastId);
      cb?.(now);
    };

    const onSample = vi.fn(() => {
      throw new Error('boom');
    });
    const teardown = startFpsSampler(onSample, 1000);

    // Baseline + a couple of frames + window crossing.
    flushFrame(0);
    flushFrame(16);
    flushFrame(32);
    expect(() => flushFrame(1001)).not.toThrow();
    expect(onSample).toHaveBeenCalled();
    teardown();
  });
});
