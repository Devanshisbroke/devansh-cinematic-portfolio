/**
 * Responsive_Engine public surface.
 *
 * Single barrel for downstream consumers (scenes, design-system
 * primitives, the App shell). Re-exports:
 *
 *  - The `Breakpoint` and `LayoutTier` type contracts plus the
 *    `BREAKPOINT_RANK` table (`./types`).
 *  - The pure, side-effect-free resolvers `resolveBreakpoint` and
 *    `resolveLayoutTier` (`./resolve`).
 *  - The React hooks `useBreakpoint`, `useLayoutTier`, and
 *    `useCoarsePointer` (`./useBreakpoint`).
 *
 * Sourced from `requirements.md` Requirements 12.1, 12.2, 12.5, 12.8,
 * 17.1, and `design.md` § Component architecture →
 * `responsive-engine/index.ts`.
 *
 * Validates: Requirements 12.1, 12.2, 12.5, 12.8, 17.1
 */

export type { Breakpoint, LayoutTier } from './types';
export { BREAKPOINT_RANK } from './types';
export { resolveBreakpoint, resolveLayoutTier } from './resolve';
export { useBreakpoint, useLayoutTier, useCoarsePointer } from './useBreakpoint';
