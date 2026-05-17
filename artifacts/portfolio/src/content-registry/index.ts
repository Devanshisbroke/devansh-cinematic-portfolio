/**
 * Content_Registry barrel export.
 *
 * Single import surface for consumers (`@workspace/portfolio/src/...`)
 * that need the canonical types, copy-hygiene tables, and runtime
 * validators. Keeping the surface here lets `data.ts` (task 3.7) and
 * the rendering scenes import from one place rather than reaching
 * into individual files, which keeps the module graph clean
 * (Property 14 — Module-graph cleanliness).
 *
 * Supports:
 *   - Requirement 1.8, 1.9, 1.10 — build-time integrity gate.
 *   - Requirement 9.1, 9.2 — copy-hygiene contract.
 *   - Requirement 15 — Content_Registry integrity envelope.
 */

export * from './types';
export { BANNED_PHRASES } from './banned-phrases';
export type { BannedPhrase } from './banned-phrases';
export { BASELINE_PROSE } from './baseline-prose';
export type { BaselineProse } from './baseline-prose';
export {
  validateProject,
  validateIdentity,
  validateContact,
  validateRegistry,
} from './validate';
