/**
 * Content_Registry · banned phrases
 *
 * Enumerates the AI-cringe / corporate-filler phrases that no rendered prose
 * string in the portfolio is permitted to contain (case-insensitive substring
 * match). The four entries listed in Requirement 9.2 are mandatory; the
 * remaining entries extend the guard to other common offenders so reviewers
 * have a single canonical list to reason about.
 *
 * Consumed by:
 *   - `validateRegistry` (build-time enforcement of R9.2)
 *   - `tests/pbt/copy-hygiene.pbt.test.ts` (Property 11)
 *
 * Supports:
 *   - Requirement 9.2 — banned-phrase list (R9.2)
 *   - Requirement 9.1 — used in tandem with `BASELINE_PROSE` to enforce the
 *     full copy-hygiene contract
 */
export const BANNED_PHRASES = [
  // The four phrases mandated verbatim by Requirement 9.2.
  "passionate about",
  "leveraging cutting-edge",
  "results-driven",
  "in today's fast-paced world",

  // Extended corporate / AI-cringe filler. Add new entries in alphabetical
  // groups to keep diffs readable; never remove an entry without an explicit
  // requirements-level discussion.
  "best in class",
  "circle back",
  "deep dive",
  "deliver outcomes",
  "game-changing",
  "innovative solutions",
  "low-hanging fruit",
  "move the needle",
  "next-generation",
  "robust solutions",
  "synergize",
  "transformative",
  "unlock value",
  "world-class",
] as const;

export type BannedPhrase = (typeof BANNED_PHRASES)[number];
