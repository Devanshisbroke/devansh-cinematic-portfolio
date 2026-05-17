import type { LayoutPattern, RouteEntry } from '../route-map/types';

export interface SceneOrderEntry {
  readonly domId: string;
  readonly role: RouteEntry['role'];
  readonly dominantLayoutPattern: LayoutPattern;
}

/**
 * The narrative order of scenes in the portfolio.
 *
 * Property 12 (scene-adjacency layout-pattern non-repetition) requires that
 * no two adjacent scenes share the same `dominantLayoutPattern`. This export
 * is the canonical input to that property — adjustments here MUST keep the
 * adjacency invariant intact.
 *
 * The values mirror `route-map/data.ts` exactly, but the file is separated
 * so the scene-adjacency PBT (`tests/pbt/scene-adjacency.pbt.test.ts`) can
 * import this without dragging in the full route-map module.
 */
export const sceneOrder: readonly SceneOrderEntry[] = [
  { domId: 'scene-threshold', role: 'opening', dominantLayoutPattern: 'asymmetric-editorial' },
  { domId: 'scene-compass', role: 'identity', dominantLayoutPattern: 'split-two-column' },
  { domId: 'scene-work', role: 'work', dominantLayoutPattern: 'asymmetric-editorial' },
  { domId: 'scene-ethos', role: 'philosophy', dominantLayoutPattern: 'centered-hero' },
  { domId: 'scene-signal', role: 'contact', dominantLayoutPattern: 'vertical-list' },
] as const;
