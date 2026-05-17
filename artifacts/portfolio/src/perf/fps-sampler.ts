/**
 * fps-sampler.ts — development-only frame-rate sampler.
 *
 * Implements the runtime FPS sampler called for in
 * `.kiro/specs/portfolio-cinematic-redesign/design.md` § 17 (R5.5, R11.5,
 * R11.6). Samples per-frame rates via `requestAnimationFrame`, accumulates
 * instantaneous fps values into a tumbling window, and emits an
 * `{ p05, p50, p95, frameCount, windowMs }` summary every `windowMs`
 * milliseconds.
 *
 * ### Percentile method
 *
 * Percentiles are computed with **linear interpolation between sorted
 * sample positions** (the convention used by NumPy's default
 * `np.percentile`, Excel's `PERCENTILE.INC`, and most statistics
 * literature):
 *
 * ```text
 *   sorted = ascending sort of fps samples
 *   idx    = p * (n - 1)
 *   lo     = floor(idx); hi = ceil(idx)
 *   value  = sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
 * ```
 *
 * For a five-sample input `[60, 60, 60, 30, 30]` (sorted: `[30, 30, 60,
 * 60, 60]`) this yields `p05 = 30`, `p50 = 60`, `p95 = 60`.
 *
 * ### Buffer capacity
 *
 * The internal sample buffer is capped at `MAX_BUFFER = 240` entries,
 * which corresponds to one second of frames at a 240 Hz refresh rate.
 * Once the cap is reached the oldest sample is evicted (FIFO) so a single
 * stuck or unusually-long-running session cannot grow the buffer
 * unboundedly. In practice the buffer is drained every `windowMs`
 * milliseconds (default 1 s), so the cap is only relevant when an
 * `onSample` handler is exceptionally slow or `windowMs` is set to a
 * very large value.
 *
 * ### Listener footprint (R5.2)
 *
 * This module schedules work via `requestAnimationFrame` only. It does
 * **not** attach a `scroll` listener — R5.2 forbids `scroll` listeners
 * outside `motion/scroll-source.ts`, but raw `requestAnimationFrame`
 * usage is permitted everywhere.
 *
 * ### Activation gate
 *
 * The "always-on in development, opt-in in production" gate described
 * by R11.5/R11.6 lives at the **call site**, not inside this module.
 * `App.tsx` dynamic-imports `fps-sampler.ts` behind
 * `process.env.NODE_ENV !== 'production'` so the production bundle
 * tree-shakes the sampler entirely. A developer who wants to enable the
 * sampler in a production build can set `window.__PCR_FPS_DEBUG__ =
 * true` in DevTools and trigger the import manually. Keeping the gate
 * at the call site lets this module stay a pure, easily-tested
 * computation surface.
 *
 * Validates: Requirements 5.5, 11.5, 11.6
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * A single emitted sample.
 *
 * `frameCount` reports how many frames contributed to the percentile
 * computation for the most recent `windowMs` interval; useful for
 * detecting under-sampling on idle pages (where rAF tick rates fall to
 * a few Hz once the document is hidden).
 */
export type FpsSample = {
  readonly p05: number;
  readonly p50: number;
  readonly p95: number;
  readonly frameCount: number;
  readonly windowMs: number;
};

/** Consumer callback shape. */
export type FpsSampleHandler = (sample: FpsSample) => void;

// ---------------------------------------------------------------------------
// Pure percentile helper (exported for unit testing)
// ---------------------------------------------------------------------------

/**
 * Compute `p05`, `p50`, and `p95` of an unsorted fps-sample array using
 * linear interpolation between sorted positions.
 *
 * Returns `null` for an empty input so the caller can decide whether to
 * skip emission entirely (the rolling window often starts empty
 * immediately after `lastEmit` is reset).
 *
 * Exported so that `fps-sampler.test.ts` can validate the percentile
 * arithmetic without driving the full `requestAnimationFrame` loop.
 */
export function computeFpsSample(
  fpsSamples: readonly number[],
  windowMs: number,
): FpsSample | null {
  if (fpsSamples.length === 0) return null;
  const sorted = [...fpsSamples].sort((a, b) => a - b);
  return {
    p05: percentile(sorted, 0.05),
    p50: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    frameCount: fpsSamples.length,
    windowMs,
  };
}

/**
 * Linear-interpolated percentile of an already-sorted array.
 *
 * Pre-condition: `sorted` is in ascending order. The function tolerates
 * a single-element array (returns that element) and never reads out of
 * bounds.
 */
function percentile(sorted: readonly number[], p: number): number {
  const n = sorted.length;
  if (n === 0) return 0;
  if (n === 1) return sorted[0] as number;
  const idx = p * (n - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower] as number;
  const weight = idx - lower;
  const lo = sorted[lower] as number;
  const hi = sorted[upper] as number;
  return lo + (hi - lo) * weight;
}

// ---------------------------------------------------------------------------
// rAF-driven sampler
// ---------------------------------------------------------------------------

/**
 * Hard cap on the internal sample buffer; see the file-level "Buffer
 * capacity" note. 240 frames covers one second at 240 Hz, which is the
 * highest refresh rate the sampler is expected to observe in 2025.
 */
const MAX_BUFFER = 240;

/**
 * Start sampling frame rates and emit `FpsSample`s every `windowMs`
 * milliseconds.
 *
 * Returns a teardown function that cancels the next pending animation
 * frame and stops further emissions. Calling the teardown more than
 * once is safe (subsequent calls are no-ops).
 *
 * In a non-browser environment (SSR, Node, prerender) — detected by the
 * absence of `window` or `requestAnimationFrame` — this function returns
 * a no-op teardown without scheduling any work. That keeps the module
 * safe to import from code that runs in both jsdom tests and the
 * build-time prerender script.
 *
 * @param onSample  Called with the latest `{p05, p50, p95, frameCount,
 *                  windowMs}` summary at the end of every `windowMs`
 *                  interval. The caller is responsible for the
 *                  development-vs-production gate (see file header).
 * @param windowMs  Length of the tumbling window in milliseconds.
 *                  Defaults to `1000` to match R5.5's "5th percentile
 *                  over a rolling 1-second window" definition.
 */
export function startFpsSampler(
  onSample: FpsSampleHandler,
  windowMs: number = 1000,
): () => void {
  if (
    typeof window === 'undefined' ||
    typeof requestAnimationFrame === 'undefined'
  ) {
    return () => {};
  }

  const buffer: number[] = [];
  let last = 0;
  let lastEmit = 0;
  let initialized = false;
  let rafId = 0;
  let cancelled = false;

  const tick = (now: number): void => {
    if (cancelled) return;

    // The first rAF tick has no previous frame to diff against, so we
    // record `now` as the baseline for both the inter-frame delta and
    // the first emission deadline, then immediately schedule the next
    // frame.
    if (!initialized) {
      last = now;
      lastEmit = now;
      initialized = true;
      rafId = requestAnimationFrame(tick);
      return;
    }

    const dt = now - last;
    last = now;
    if (dt > 0) {
      // FIFO eviction once the cap is reached. `Array.prototype.shift`
      // is O(n) but the worst-case n is 240 so the constant cost is
      // negligible compared to the per-frame work the rest of the page
      // is doing.
      if (buffer.length >= MAX_BUFFER) buffer.shift();
      buffer.push(1000 / dt);
    }

    if (now - lastEmit >= windowMs) {
      const sample = computeFpsSample(buffer, windowMs);
      if (sample) {
        try {
          onSample(sample);
        } catch {
          // A faulty consumer must never break the sampler. Swallow and
          // continue so the dev-only diagnostic does not turn into a
          // page-crashing exception.
        }
      }
      buffer.length = 0;
      lastEmit = now;
    }

    rafId = requestAnimationFrame(tick);
  };

  rafId = requestAnimationFrame(tick);

  return () => {
    if (cancelled) return;
    cancelled = true;
    if (typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(rafId);
    }
  };
}
