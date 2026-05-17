/**
 * Redundant-cue registry (R13.12).
 *
 * For every interactive state that conveys information, this registry
 * documents the redundant non-color, non-motion channel. The DOM smoke tests
 * read this registry to confirm that the actual rendered output exposes
 * each state's redundant channel.
 */

export type CueChannel =
  | 'text-label'
  | 'iconography'
  | 'shape'
  | 'pattern'
  | 'aria-attribute'
  | 'border'
  | 'underline'
  | 'bold-weight';

export interface RedundantCueEntry {
  /** Human-readable name of the state */
  readonly state: string;
  /** What the state conveys */
  readonly meaning: string;
  /** The non-color, non-motion channels the state uses redundantly */
  readonly channels: readonly CueChannel[];
}

/**
 * Canonical cue table. Each entry says: when this state holds, the rendered
 * UI MUST present at least one of these channels.
 */
export const REDUNDANT_CUES: readonly RedundantCueEntry[] = [
  {
    state: 'active scene in nav',
    meaning: 'which scene the user is currently viewing',
    channels: ['bold-weight', 'aria-attribute'], // aria-current
  },
  {
    state: 'hovered project in showcase',
    meaning: 'which project link the pointer is over',
    channels: ['underline', 'aria-attribute'], // aria-describedby for the rich tooltip
  },
  {
    state: 'reduced-motion toggle on',
    meaning: 'whether reduced motion is active',
    channels: ['text-label', 'aria-attribute'], // aria-pressed
  },
  {
    state: 'magnetic primary CTA',
    meaning: 'a primary call-to-action that is interactive',
    channels: ['border', 'text-label'], // persistent border + label
  },
  {
    state: 'external link',
    meaning: 'link opens in a new browsing context',
    channels: ['iconography', 'aria-attribute'], // ↗ glyph + rel
  },
  {
    state: 'theme toggle (dark/light)',
    meaning: 'which theme is active',
    channels: ['text-label', 'aria-attribute'], // aria-pressed
  },
] as const;

/**
 * Assertion helper for tests: confirms that a given state has at least one
 * registered redundant channel and that one of those channels is present
 * in the supplied channels list.
 *
 * Throws (used in `expect(...).not.toThrow()`) when the state is missing
 * from the registry or none of its channels appear in the rendered output.
 */
export function assertRedundantCue(opts: {
  state: string;
  channels: ReadonlyArray<CueChannel>;
}): void {
  const entry = REDUNDANT_CUES.find((e) => e.state === opts.state);
  if (!entry) {
    throw new Error(`Redundant-cue assertion failed: state "${opts.state}" is not registered`);
  }
  const intersection = entry.channels.filter((c) => opts.channels.includes(c));
  if (intersection.length === 0) {
    throw new Error(
      `Redundant-cue assertion failed for "${opts.state}": expected one of [${entry.channels.join(', ')}] but rendered channels were [${opts.channels.join(', ')}]`,
    );
  }
}
