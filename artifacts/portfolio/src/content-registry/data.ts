/**
 * Content_Registry — canonical Devansh Barai content.
 *
 * Single source of truth for every user-visible primary content
 * string rendered by the Portfolio_Site (R15.8). Every prose string
 * here has been written against the copy-hygiene contract — no entry
 * in `BANNED_PHRASES` appears as a substring (R9.2) and no entry
 * normalises to a member of `BASELINE_PROSE` (R9.1).
 *
 * The module top runs `validateRegistry` and throws on failure, which
 * turns content drift into a build-time error (R1.8, R1.9, R1.10,
 * R15.9). Vite evaluates the module during `build` and `dev`, so a
 * failing record never reaches the client bundle.
 *
 * Supports:
 *   - R1.1, R1.2, R1.3 — owner identity, two co-primary affiliations.
 *   - R1.4 — exactly four flagship projects, in a fixed order.
 *   - R1.5, R1.6 — Project_Record field bounds and primary-link shape.
 *   - R1.7 — verified contacts (email + LinkedIn + GitHub).
 *   - R8.3, R8.5, R8.6 — per-project showcase data points and a
 *     deterministic ordering driven by this module.
 *   - R9.5, R9.6, R9.7, R9.8 — first-person + conviction voice and
 *     structured-claim hygiene (no claim records authored here yet).
 *   - R10.7 — keep this module within the Above_The_Fold critical
 *     path budget by storing strings only (no images, no inline JSON
 *     blobs).
 *   - R15.8 — single source of truth for primary content strings.
 */

import type {
  Contact_Channel,
  Identity_Profile,
  Project_Record,
} from './types';
import { validateRegistry } from './validate';

// ---------------------------------------------------------------------------
// Identity_Profile
// ---------------------------------------------------------------------------

/**
 * Canonical Identity_Profile for Devansh Barai (R1.1, R1.2, R1.3,
 * R1.7, R15.7).
 *
 * Two `currentInstitutions` entries with `role: 'primary'` encode the
 * "two co-primary affiliations of equal standing" contract directly
 * in the type system — there is no shape that expresses a
 * "secondary" affiliation, so a future maintainer cannot demote one
 * institution by accident.
 *
 * `crossReferences` carry the first-person prose paragraphs the
 * `TwinCompass` scene renders next to each institution (R9.5, R9.6).
 */
export const identity: Identity_Profile = {
  displayName: 'Devansh Barai',
  tagline:
    'Computer science, AI/ML, and product-oriented builder focused on turning ideas into useful software.',
  currentInstitutions: [
    {
      institution: 'IIT Madras',
      program: 'BS in Data Science and Applications',
      years: '2024–2028',
      role: 'primary',
    },
    {
      institution: 'IIM Bangalore',
      program: 'BBA in Digital Business & Entrepreneurship',
      years: '2025–2028',
      role: 'primary',
    },
  ],
  crossReferences: [
    {
      id: 'iit-madras',
      body:
        "At IIT Madras I'm rebuilding my intuition for systems from the ground up — distributions, gradients, and the messy real-world data that breaks the textbook examples.",
    },
    {
      id: 'iim-bangalore',
      body:
        "At IIM Bangalore I'm learning to translate that technical instinct into product decisions — what a founder should ship next, and why that question matters more than how.",
    },
  ],
  email: 'devanshbarai.official@gmail.com',
  socials: [
    { label: 'LinkedIn', url: 'https://linkedin.com/in/devansh-barai' },
    { label: 'GitHub', url: 'https://github.com/Devanshisbroke' },
  ],
} as const;

// ---------------------------------------------------------------------------
// Project_Record list (R1.4: exactly four, in this order)
// ---------------------------------------------------------------------------

/**
 * The four flagship Project_Records, in the deterministic order the
 * `Project_Showcase` will render them (R1.4, R8.5, R8.6):
 *   1. GlobeID
 *   2. Khetech
 *   3. SupportDeskOps-v6
 *   4. Last-Minute PDF
 *
 * Each record satisfies the field bounds enforced by `validateProject`
 * and carries a `voice.firstPersonSentence` + `voice.convictionSentence`
 * pair (R9.5, R9.6). Each `primaryLink.url` points at that project's
 * live destination where one exists (GlobeID → theglobeid.in, Khetech →
 * khetech.in, Last-Minute PDF → lastminutenotes.in); SupportDeskOps-v6
 * links to its repository until a dedicated deployment lands.
 */
export const projects: readonly Project_Record[] = [
  // ─── 1. GlobeID ────────────────────────────────────────────────────────
  {
    id: 'globeid',
    name: 'GlobeID',
    tagline:
      'A unified way to carry your online presence across every platform you use.',
    summary:
      "I'm shaping a system where identity, credentials, and digital interactions live in one consistent place — designed so that the way you appear on one platform connects cleanly to how you appear on the next.",
    problem:
      'Online presence is fragmented across platforms — your profile, your verifications, your reputation, all isolated. GlobeID treats those as facets of one identity instead of duplicates to maintain.',
    role: 'Founder and product lead',
    year: 2025,
    tags: ['identity', 'product', 'systems', 'infrastructure'],
    primaryLink: {
      label: 'Visit GlobeID',
      kind: 'live',
      url: 'https://theglobeid.in',
    },
    status: 'in-development',
    outcomes: [
      'Defined the early product surface and core flows',
      'Validated the cross-platform identity premise with founders and operators',
    ],
    technologyOrientation:
      'Identity infrastructure and cross-platform interoperability',
    voice: {
      firstPersonSentence:
        "I'm leading product direction on this one — features, flows, and the early prototypes that test the core idea.",
      convictionSentence:
        "Identity should travel with you. The internet has spent two decades teaching us to keep re-introducing ourselves, and I think that's a problem worth solving once.",
    },
  },

  // ─── 2. Khetech ────────────────────────────────────────────────────────
  {
    id: 'khetech',
    name: 'Khetech',
    tagline:
      'AI that recognises plant disease from a leaf photo, designed for actual farms.',
    summary:
      "I built a computer-vision pipeline that classifies plant diseases from leaf images and surfaces results through a workflow that doesn't assume the user reads ML papers.",
    problem:
      'Crop loss from undetected disease is enormous, and existing diagnostic tools assume access to agronomists or labs. A camera-equipped phone is more common.',
    role: 'Builder and AI lead',
    year: 2024,
    tags: ['ai', 'computer vision', 'agriculture', 'pytorch'],
    primaryLink: {
      label: 'Visit Khetech',
      kind: 'live',
      url: 'https://khetech.in',
    },
    status: 'in-development',
    outcomes: [
      'Trained and deployed a leaf-disease classifier',
      'Built an end-to-end inference workflow from upload to result',
    ],
    technologyOrientation: 'Computer vision and applied machine learning',
    voice: {
      firstPersonSentence:
        'I trained the model, designed the inference flow, and shipped a working prototype that classifies leaves end-to-end.',
      convictionSentence:
        "Useful AI looks different from impressive AI — it has to fit into someone's day, not their lab.",
    },
  },

  // ─── 3. SupportDeskOps-v6 ─────────────────────────────────────────────
  {
    id: 'supportdeskops-v6',
    name: 'SupportDeskOps-v6',
    tagline:
      'A reinforcement-learning environment for customer-support workflows with LLM-driven decisions.',
    summary:
      'I designed a production-grade RL environment that simulates customer-support conversations, scores agent decisions step by step, and exposes the whole loop through a strict-typed API.',
    problem:
      'Most LLM evaluation lives at the conversation level. The actual signal is in the per-step decisions — was that the right escalation, the right routing, the right response? SupportDeskOps-v6 makes that signal measurable.',
    role: 'Sole engineer',
    year: 2025,
    tags: ['reinforcement learning', 'llm', 'evaluation', 'api'],
    primaryLink: {
      label: 'Repository',
      kind: 'repository',
      url: 'https://github.com/Devanshisbroke',
    },
    status: 'shipped',
    outcomes: [
      'Step-wise reward design with deterministic scoring',
      'Real-time evaluation API with strict guarantees',
    ],
    technologyOrientation:
      'Reinforcement learning environments and LLM-agent evaluation',
    voice: {
      firstPersonSentence:
        'I built every layer — environment, reward shaping, evaluation pipeline, and the API that exposes it — and I optimised each one against measurable scoring guarantees.',
      convictionSentence:
        "If you can't grade an LLM agent on the right thing at the right step, you can't improve it. SupportDeskOps-v6 starts with the metric and builds backward.",
    },
  },

  // ─── 4. Last-Minute PDF ───────────────────────────────────────────────
  {
    id: 'last-minute-pdf',
    name: 'Last-Minute PDF',
    tagline:
      'Ultra-condensed exam revision notes you can download instantly — pass your exam for ₹29.',
    summary:
      'I built a platform that delivers 10-page ultra-condensed revision notes for last-minute exam prep. No fluff, no filler — just the concepts that actually show up on the paper, packaged so you can absorb them in one sitting.',
    problem:
      'Students cram from 300-page textbooks the night before an exam. The signal-to-noise ratio is terrible. LastMinutePDF distills each subject into exactly what you need to pass, delivered instantly.',
    role: 'Designer and builder',
    year: 2024,
    tags: ['edtech', 'productivity', 'content', 'automation'],
    primaryLink: {
      label: 'Visit LastMinutePDF',
      kind: 'live',
      url: 'https://lastminutenotes.in',
    },
    status: 'shipped',
    outcomes: [
      'Condensed revision notes delivering exam-ready content in 10 pages',
      'Instant digital delivery at ₹29 per subject',
    ],
    technologyOrientation: 'EdTech content delivery and digital commerce',
    voice: {
      firstPersonSentence:
        'I scoped it to one moment — the night before an exam — and built only the content and delivery that matters in that window.',
      convictionSentence:
        'The best revision material respects the student\'s time. Ten pages of the right things beat three hundred pages of everything.',
    },
  },
] as const;

// ---------------------------------------------------------------------------
// Contact_Channel
// ---------------------------------------------------------------------------

/**
 * Standalone Contact_Channel surfaced by the `Signal` scene (R1.7,
 * R1.10). Mirrors the email + socials shape of the Identity_Profile
 * so the scene and `validateContact` have a focused record to operate
 * on.
 */
export const contact: Contact_Channel = {
  email: identity.email,
  socials: identity.socials,
} as const;

// ---------------------------------------------------------------------------
// Build-time integrity gate (R1.8, R1.9, R1.10, R15.9)
// ---------------------------------------------------------------------------

/**
 * Run every per-record validator and the cross-record copy-hygiene
 * pass at module-load time. A failure raises an `Error` which Vite
 * surfaces as a build error — so the deployed bundle can never carry
 * a registry that violates R15.
 */
const _registryValidation = validateRegistry({ identity, projects, contact });
if (!_registryValidation.ok) {
  throw new Error(
    `Content_Registry validation failed: [${_registryValidation.recordId}] ${_registryValidation.field} — ${_registryValidation.reason}`,
  );
}
