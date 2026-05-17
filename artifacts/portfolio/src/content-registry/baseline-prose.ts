/**
 * Content_Registry · baseline prose set
 *
 * Captures every audited narrative prose string rendered by the legacy
 * `src/pages/Portfolio.tsx` implementation, normalised to lowercase with
 * leading/trailing whitespace stripped and runs of internal whitespace
 * collapsed to a single space. Each entry already follows that convention so
 * downstream callers can compare with a simple
 * `normalise(s) === entry` check.
 *
 * The set is the canonical "do not match verbatim" guard for Requirement 9.1:
 * any new copy that normalises to a member of this set is treated as a
 * regression to the pre-rewrite voice and must be rewritten.
 *
 * Scope rule: only narrative prose strings are included — taglines, summaries,
 * descriptions, paragraph copy, education-bullet copy, contact lines, and the
 * footer line. Pure UI affordances (button text, navigation labels, eyebrow
 * markers, status badges, single-word filler, proper nouns, dates) are
 * intentionally excluded.
 *
 * Consumed by:
 *   - `validateRegistry` (build-time enforcement of R9.1)
 *   - `tests/pbt/copy-hygiene.pbt.test.ts` (Property 11)
 *
 * Supports:
 *   - Requirement 9.1 — verbatim-baseline rejection (R9.1)
 *   - Requirement 9.2 — used in tandem with `BANNED_PHRASES` to enforce the
 *     full copy-hygiene contract
 */
export const BASELINE_PROSE = [
  // ─── Hero / Threshold ───────────────────────────────────────────────────
  "student at iit madras & iim bangalore. founder of three ventures. building at the intersection of technology, product, and entrepreneurship.",
  "builder.",
  "founder.",
  "product thinker.",
  "problem solver.",
  "entrepreneur.",

  // ─── About ──────────────────────────────────────────────────────────────
  "i'm a student pursuing a dual degree at iit madras (bs in data science & applications) and iim bangalore (bba in digital business & entrepreneurship).",
  "i'm deeply interested in startups, building products, and solving real-world problems. i enjoy taking ideas from zero to one — validating quickly, iterating fast, and learning through action.",
  "whether it's a product prototype at 2am or a pitch to skeptical investors, i show up with energy and clarity. i believe the best businesses come from solving problems you feel deeply.",
  "zero to one mindset",
  "rapid idea validation, fast iteration, execution-focused.",
  "problem-first approach",
  "starting with real pain points, not technology for its own sake.",
  "global ambition",
  "building for scale from day one — across markets and borders.",

  // ─── Education ──────────────────────────────────────────────────────────
  "dual-institution learning — combining data science depth with entrepreneurial breadth.",
  "bs — data science & applications",
  "bba — digital business & entrepreneurship",
  "rigorous program combining mathematical foundations with applied computing",
  "focus on machine learning, data analysis, and software engineering",
  "one of india's most competitive technology institutions",
  "entrepreneurship-focused curriculum at india's top business school",
  "emphasis on digital strategy, product thinking, and venture creation",
  "exposure to industry leaders and a strong startup ecosystem",

  // ─── Projects ───────────────────────────────────────────────────────────
  "three live products — each solving a real problem, each built from conviction.",
  "one identity. every border.",
  "global identity infrastructure enabling seamless verification, payments, and access across borders. aes-256 encrypted, gdpr-ready, built for cross-border interoperability from day one.",
  "smart revision for exam warriors.",
  "a student-focused revision platform built on one insight: most prep happens in the final 24 hours. curated concepts and summaries for speed and confidence — not panic.",
  "ai-powered plant disease detection.",
  "agricultural ai platform helping farmers identify plant diseases with high accuracy using computer vision and machine learning — reducing crop losses through early detection and treatment recommendations.",

  // ─── Ventures ───────────────────────────────────────────────────────────
  "three ventures across identity, agritech, and edtech — all live, all founder-led.",
  "building the infrastructure for digital identity in a borderless world — rethinking how people prove who they are securely, privately, and universally across platforms, services, and borders.",
  "ai that fights crop disease.",
  "ai-powered agricultural platform helping farmers detect plant diseases early using computer vision and machine learning — reducing crop loss and enabling smarter, data-driven farming.",
  "a student-focused platform built on a simple insight: most exam prep happens in the last 24 hours. curated critical concepts, summaries, and fast-track material for confident revision.",

  // ─── Skills ─────────────────────────────────────────────────────────────
  "a blend of technical foundations, product thinking, and execution speed.",

  // ─── Contact ────────────────────────────────────────────────────────────
  "whether you're a founder, investor, student, or just curious — i'd love to connect. let's build something meaningful.",
  "reach out directly. i typically respond within 24 hours.",
  "things i'm actively looking for and excited about:",
  "co-founder conversations",
  "startup collaborations",
  "mentorship & guidance",
  "internships & opportunities",
  "interesting ideas & problems",
  "based in india · available remotely",

  // ─── Footer ─────────────────────────────────────────────────────────────
  "designed & built with care",
] as const;

export type BaselineProse = (typeof BASELINE_PROSE)[number];
