/**
 * Canonical Route_Map for the Portfolio_Site.
 *
 * Validates: Requirements 6.1, 6.6, 14.1, 16.1, 16.6
 *
 * This module is the single source of truth for the navigable scenes of the
 * redesigned portfolio. The five entries below map slug ↔ DOM id and pin a
 * narrative role plus a dominant layout pattern (consumed by Property 12 in
 * `tests/pbt/scene-adjacency.pbt.test.ts`).
 *
 * The five scenes, in narrative order, are:
 *
 *   1. `threshold` — opening / Above_The_Fold (R6.1, R6.4)
 *   2. `compass`   — paired-credentials identity scene (R6.1, R1.2, R1.3)
 *   3. `work`      — Project_Showcase with four differentiated reveals (R8.x)
 *   4. `ethos`     — short philosophy beats (R6.1)
 *   5. `signal`    — contact / closing (R6.1)
 *
 * Layout patterns are chosen so no two adjacent scenes repeat — the
 * adjacency invariant required by Property 12. The four per-project sub
 * anchors discussed in `design.md` (`scene-work-globeid`, `scene-work-khetech`,
 * `scene-work-supportdeskops`, `scene-work-last-minute-pdf`) are DOM ids
 * nested inside the `scene-work` section, not first-class Route_Map entries.
 *
 * The module top-level `validate(routeMap)` invocation hardens the build:
 * any future edit that breaks bijection, role coverage, or the slug/domId
 * shape rules surfaces as a build-time error rather than a runtime bug
 * (per design § Error handling, R16.4 / R16.6 row).
 */

import type { RouteMap } from './types';
import { validate } from './validate';

/**
 * The canonical, immutable Route_Map for the Portfolio_Site.
 *
 * Order of the array is the canonical narrative order; `rank` mirrors the
 * array index so consumers may use either accessor without ambiguity.
 */
export const routeMap: RouteMap = [
  {
    slug: 'threshold',
    domId: 'scene-threshold',
    role: 'opening',
    rank: 0,
    dominantLayoutPattern: 'asymmetric-editorial',
  },
  {
    slug: 'compass',
    domId: 'scene-compass',
    role: 'identity',
    rank: 1,
    dominantLayoutPattern: 'split-two-column',
  },
  {
    slug: 'work',
    domId: 'scene-work',
    role: 'work',
    rank: 2,
    dominantLayoutPattern: 'asymmetric-editorial',
  },
  {
    slug: 'ethos',
    domId: 'scene-ethos',
    role: 'philosophy',
    rank: 3,
    dominantLayoutPattern: 'centered-hero',
  },
  {
    slug: 'signal',
    domId: 'scene-signal',
    role: 'contact',
    rank: 4,
    dominantLayoutPattern: 'vertical-list',
  },
] as const;

// Build-time validation. A failure here blocks bundle emission and surfaces
// the first violating slug/domId + reason — exactly the deterministic
// contract documented for Property 5.
const _routeMapValidation = validate(routeMap);
if (!_routeMapValidation.ok) {
  const offender =
    _routeMapValidation.slug !== undefined
      ? ` (slug="${_routeMapValidation.slug}")`
      : _routeMapValidation.domId !== undefined
        ? ` (domId="${_routeMapValidation.domId}")`
        : '';
  throw new Error(
    `Route_Map validation failed${offender}: ${_routeMapValidation.reason}`,
  );
}
