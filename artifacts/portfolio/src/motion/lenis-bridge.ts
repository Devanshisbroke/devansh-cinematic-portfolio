/**
 * Lenis smooth-scroll bridge — lazy, capability-gated.
 *
 * Lenis layers inertial easing on top of native scroll. Whether we
 * enable it is gated by three rules:
 *  - R5.7: never when Reduced_Motion_Mode is active (smoothing IS
 *    motion; reduced-motion forbids decorative motion).
 *  - R12.7: never when `navigator.hardwareConcurrency ≤ 4` OR
 *    `navigator.deviceMemory ≤ 4`. The same disjunction the
 *    Cinematic_Background uses to skip its WebGL path.
 *  - R12.6: never when `prefers-reduced-data: reduce` is set —
 *    treated as a fourth gate so low-data clients drop the bridge
 *    even on capable hardware.
 *
 * The bridge is a lazy default-export factory: the Lenis package is
 * `import()`-ed only inside `startLenis` and only after the gate
 * resolves to `enabled: true`. That keeps Lenis out of the
 * Above_The_Fold critical-path bundle (design.md §"Lazy chunks") so
 * incapable or reduced-motion clients pay no JS cost.
 *
 * R5.2 invariant — exactly one shared scroll source — is preserved
 * because Lenis owns its own internal scroll listener AND the
 * `motion/scroll-source.ts` provider is the SOLE consumer of native
 * `window.scroll` events in the app. When Lenis is enabled, the
 * provider's listener still fires (Lenis doesn't suppress native
 * scroll); the bridge therefore adds zero new `scroll` listeners on
 * `window`/`document` from the application's perspective. Lenis's
 * own internals are out of scope of the audit (they listen to wheel,
 * touchstart, touchmove — not to `scroll`).
 *
 * Validates: Requirements 5.1, 5.7, 12.6, 12.7
 *
 * Rules:
 *  - No top-level `import` of the `lenis` package — keep it dynamic.
 *  - The factory MUST always return a teardown function so callers
 *    can wire it into a `useEffect` cleanup unconditionally.
 *  - The gate decision MUST be observable via `resolveLenisGate` so
 *    DOM tests can assert it without spinning up Lenis itself.
 */

// ---------------------------------------------------------------------------
// Gate
// ---------------------------------------------------------------------------

/**
 * Result of the capability gate. Carries enough detail for tests and
 * dev-tools overlays to surface *why* the bridge was skipped without
 * re-deriving it.
 */
export interface LenisGate {
  /** True iff Lenis is suitable for this client. */
  readonly enabled: boolean;
  /** True iff `Reduced_Motion_Mode` blocked the bridge. */
  readonly reasonReducedMotion: boolean;
  /**
   * True iff `hardwareConcurrency ≤ 4` or `deviceMemory ≤ 4` blocked
   * the bridge. Mirrors R12.7's disjunction.
   */
  readonly reasonLowEnd: boolean;
  /**
   * True iff `prefers-reduced-data: reduce` blocked the bridge
   * (R12.6). Independent of `reasonLowEnd` so the dev overlay can
   * show the actual cause.
   */
  readonly reasonReducedData: boolean;
}

/**
 * Decide whether the Lenis bridge should run on this client.
 *
 * The reduced-motion flag is passed in by the caller (rather than
 * read from `matchReducedMotion()` inline) so the gate stays a pure
 * function of its arguments — easy to test, easy to reason about,
 * and consistent with however the caller resolved reduced-motion
 * (OS preference vs. persisted in-app toggle, R13.1).
 *
 * Pure-thresholds (no inequality drift):
 *  - R12.7 fails the cinematic background and Lenis on `≤ 4` cores
 *    OR `≤ 4` GB. We test `cores <= 4 || mem <= 4` so the same
 *    disjunction holds here. Missing values default to the high
 *    end (`8`) — see comment block below.
 *  - SSR / non-browser environments resolve to `enabled: false` with
 *    no flagged reason, because the bridge can't run server-side
 *    regardless.
 */
export function resolveLenisGate(reducedMotion: boolean): LenisGate {
  if (reducedMotion) {
    return {
      enabled: false,
      reasonReducedMotion: true,
      reasonLowEnd: false,
      reasonReducedData: false,
    };
  }

  if (typeof navigator === 'undefined') {
    // SSR / non-DOM test envs. Don't flag a reason — the bridge is
    // simply not applicable. Callers see `enabled: false` and skip.
    return {
      enabled: false,
      reasonReducedMotion: false,
      reasonLowEnd: false,
      reasonReducedData: false,
    };
  }

  // R12.6: prefers-reduced-data takes effect even on high-end
  // hardware. Checked before the hardware gate so the surfaced
  // reason matches the true cause when both would have failed.
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    const reducedData = window.matchMedia('(prefers-reduced-data: reduce)');
    if (reducedData.matches) {
      return {
        enabled: false,
        reasonReducedMotion: false,
        reasonLowEnd: false,
        reasonReducedData: true,
      };
    }
  }

  // `hardwareConcurrency` is universally available; `deviceMemory`
  // is Chromium-only. When unexposed, we assume the high end (8 GB)
  // so non-Chromium clients aren't downgraded by absence of a hint —
  // R12.7's gate triggers on a *reported* low value, not on a
  // missing one.
  const cores = navigator.hardwareConcurrency ?? 8;
  const mem = (navigator as { deviceMemory?: number }).deviceMemory ?? 8;
  if (cores <= 4 || mem <= 4) {
    return {
      enabled: false,
      reasonReducedMotion: false,
      reasonLowEnd: true,
      reasonReducedData: false,
    };
  }

  return {
    enabled: true,
    reasonReducedMotion: false,
    reasonLowEnd: false,
    reasonReducedData: false,
  };
}

// ---------------------------------------------------------------------------
// Lazy factory
// ---------------------------------------------------------------------------

/**
 * Result of starting the bridge. Always carries the gate so callers
 * can branch UI affordances on it ("Smooth scroll on/off" indicator,
 * dev overlay), and always carries a `teardown` so cleanup is
 * unconditional.
 */
export interface LenisHandle {
  readonly teardown: () => void;
  readonly gate: LenisGate;
}

/**
 * Lazy default-export factory.
 *
 * Lenis is loaded with `import('lenis')` so its bytes never reach
 * clients that fail the gate. The dynamic import is wrapped in a
 * `try`/`catch` so a missing or broken Lenis dependency degrades to
 * native scroll rather than throwing into the React tree.
 *
 * The factory is bound to the single shared scroll source from
 * `motion/scroll-source.ts` in the sense that:
 *  1. Application code reads scroll via `useScroll()`, never via
 *     `window.scrollY` directly.
 *  2. The scroll-source provider's one `window.addEventListener
 *     ('scroll', …)` continues to fire normally with Lenis active —
 *     Lenis doesn't suppress native scroll, it adds inertia on top.
 *  3. The bridge therefore adds zero `scroll` listeners on
 *     `window`/`document` from the application's audit boundary.
 *
 * Returns a `LenisHandle` whose `teardown` is always callable, even
 * when the gate denied or the import failed, so the caller can write
 * a single `useEffect` cleanup without conditional logic.
 */
export default async function startLenis(
  reducedMotion: boolean,
): Promise<LenisHandle> {
  const gate = resolveLenisGate(reducedMotion);
  if (!gate.enabled) {
    return { teardown: noop, gate };
  }

  // Dynamic import isolates Lenis to its own chunk. Vite splits this
  // into a separate file so the Above_The_Fold bundle stays clean
  // (design.md task 15.5 — `motion/lenis-bridge` ends up in lazy
  // chunks).
  let LenisCtor: LenisLikeCtor | null = null;
  try {
    // The package id is held in a variable so static-analysis dead-
    // code-elimination doesn't try to inline it. If `lenis` isn't
    // installed (initial scaffolding has it as an opt-in dep), the
    // dynamic import rejects and we fall through to native scroll.
    const moduleId = 'lenis';
    const mod: { default?: LenisLikeCtor } = await import(
      /* @vite-ignore */ moduleId
    );
    LenisCtor = mod.default ?? null;
  } catch {
    // Lenis not installed or failed to load. Native scroll is a
    // valid fallback; do not throw into the React tree.
    return { teardown: noop, gate };
  }

  if (LenisCtor === null) {
    return { teardown: noop, gate };
  }

  const lenis = new LenisCtor();
  let rafId = 0;
  let stopped = false;
  const tick = (time: number): void => {
    if (stopped) return;
    lenis.raf(time);
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);

  return {
    gate,
    teardown(): void {
      stopped = true;
      if (rafId !== 0) cancelAnimationFrame(rafId);
      try {
        lenis.destroy();
      } catch {
        // Lenis may have already torn itself down (e.g. HMR). Swallow.
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * Minimal structural typing of the bits of Lenis we use. We don't
 * import `Lenis` at the type level either, so the package stays an
 * optional/lazy dependency from the type-checker's perspective.
 */
interface LenisLike {
  raf(time: number): void;
  destroy(): void;
}

interface LenisLikeCtor {
  new (options?: Record<string, unknown>): LenisLike;
}

function noop(): void {
  /* intentionally empty */
}
