/**
 * Motion variant registry — funnels every animated variant in the
 * portfolio through the reduced-motion gate (R5.7) and memoises the
 * original keyframes so the involution closure from
 * `./reduced-motion.ts` can restore them later (R8.10, R18.1).
 *
 * Design.md, §6.5 wiring:
 *  - `registerVariant(v)` records the variant's original keyframes
 *    under its `id` and returns the variant unchanged. Components
 *    register at module-evaluation time so the registry is populated
 *    before any render reads from it.
 *  - `getResolvedVariant(id, reducedMotion)` is the SOLE supported
 *    read path. When `reducedMotion === true`, the variant is funnelled
 *    through `applyReducedMotion`; otherwise the registered original
 *    is returned verbatim. Primitive components (`motion/primitives/*`)
 *    never reach into the registry directly — they call this function.
 *
 * Validates: Requirements 5.1, 5.7
 *
 * Rules:
 *  - No DOM, React, or framer-motion imports — this is pure data.
 *  - `registerVariant` MUST NOT mutate its argument.
 *  - Re-registering the same `id` overwrites the prior entry. That is
 *    deliberate: hot-module reloads in dev re-evaluate variant
 *    modules, and we want the latest definition to win rather than
 *    silently keeping a stale closure.
 *  - `getResolvedVariant` MUST throw when the `id` is unknown so the
 *    reduced-motion gate can never be silently bypassed by a typo.
 */

import type { MotionVariant } from './variant-types';
import { applyReducedMotion } from './reduced-motion';

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/**
 * Module-scoped variant registry keyed by `MotionVariant.id`.
 *
 * Storing the original variant (not just its keyframes) lets the
 * resolver return either form by reference: full-motion callers get
 * the exact registered object back, which lets framer-motion memoise
 * downstream `useTransform` consumers by identity.
 */
const registry = new Map<string, MotionVariant>();

// ---------------------------------------------------------------------------
// registerVariant
// ---------------------------------------------------------------------------

/**
 * Register a variant under its `id` and return it unchanged.
 *
 * The "memoises the original for involution" contract from task 6.5:
 * the registry holds the full-motion variant verbatim so
 * `applyFullMotion(v.keyframes)` (see `./reduced-motion.ts`) can
 * restore it after `applyReducedMotion` has stripped it.
 *
 * Returning the variant lets callers write the idiomatic one-liner:
 *
 *   const FADE_IN = registerVariant({ id: 'fade-in', keyframes: [...] });
 *
 * so the component module exports the same reference it registered.
 */
export function registerVariant(v: MotionVariant): MotionVariant {
  registry.set(v.id, v);
  return v;
}

// ---------------------------------------------------------------------------
// getResolvedVariant
// ---------------------------------------------------------------------------

/**
 * Resolve a registered variant by `id`, funnelling through the
 * reduced-motion gate when the `reducedMotion` flag is set.
 *
 * This is the single supported read path from the registry — every
 * `motion/primitives/*` component calls it. Routing all reads through
 * here keeps R5.7 (reduced-motion disables parallax, scroll-linked
 * transforms, decorative loops) enforceable in one place: changing
 * the gate's behaviour is a one-line edit, not a codebase-wide audit.
 *
 * Throws when `id` is unknown rather than falling back to a no-op
 * variant. A missing registration is a programming error — silently
 * returning an empty variant would hide it.
 */
export function getResolvedVariant(
  id: string,
  reducedMotion: boolean,
): MotionVariant {
  const original = registry.get(id);
  if (original === undefined) {
    throw new Error(
      `Motion variant "${id}" was never registered. ` +
        `Call registerVariant(...) at module-evaluation time before resolving.`,
    );
  }
  return reducedMotion ? applyReducedMotion(original) : original;
}

// ---------------------------------------------------------------------------
// _resetRegistry — test-only
// ---------------------------------------------------------------------------

/**
 * Clear the module-scoped registry. Test-only — used by vitest's
 * `afterEach` to keep tests hermetic across files that register the
 * same `id`. The leading underscore signals "do not use from app
 * code"; the variant registry is intentionally append-only at runtime.
 */
export function _resetRegistry(): void {
  registry.clear();
}
