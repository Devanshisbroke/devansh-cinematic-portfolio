/**
 * Route_Map type definitions.
 *
 * Pure types only — no runtime imports, no values.
 *
 * Validates: Requirements 6.1, 6.2, 6.6, 14.1, 16.1
 *
 * The `Route_Map` is the bijection between human-readable section slugs
 * (e.g. `compass`, `work`) and the DOM section identifiers used for in-page
 * navigation, deep-link routing, and scroll-spy.
 *
 * See `design.md` § Component architecture → `route-map/` and § Correctness
 * Properties → Property 4 (bijection round-trip) and Property 5 (size bounds
 * and validation behaviour) for the contracts that consumers of these types
 * are expected to honour.
 */

/**
 * Enumerated taxonomy of dominant layout patterns a scene may adopt.
 *
 * Property 12 (scene-adjacency layout-pattern non-repetition) is enforced
 * over this exact set: no two adjacent scenes in `scene-order.ts` may share
 * the same `dominantLayoutPattern`.
 */
export type LayoutPattern =
  | 'centered-hero'
  | 'full-bleed-media'
  | 'split-two-column'
  | 'card-grid'
  | 'vertical-list'
  | 'asymmetric-editorial'
  | 'immersive-canvas';

/**
 * Narrative role assigned to a scene in the journey.
 *
 * Validators require that each role appears at least once in the canonical
 * `routeMap` (see `route-map/validate.ts`).
 */
export type RouteRole =
  | 'opening'
  | 'identity'
  | 'work'
  | 'philosophy'
  | 'contact';

/**
 * A single entry in the Route_Map.
 *
 * Field constraints (enforced by `route-map/validate.ts`):
 * - `slug`     — `^[a-z0-9-]{1,64}$`, unique across the map
 * - `domId`    — `^[a-zA-Z][a-zA-Z0-9_-]{0,127}$`, unique across the map
 * - `role`     — one of the `RouteRole` enum values
 * - `rank`     — non-negative integer, equal to the entry's index in the
 *                ordered `RouteMap`
 * - `dominantLayoutPattern` — one of the `LayoutPattern` taxonomy values
 */
export interface RouteEntry {
  readonly slug: string;
  readonly domId: string;
  readonly role: RouteRole;
  readonly rank: number;
  readonly dominantLayoutPattern: LayoutPattern;
}

/**
 * The ordered, immutable list of `RouteEntry` records that defines the
 * Portfolio_Site's navigable scenes.
 */
export type RouteMap = readonly RouteEntry[];

/**
 * O(1) lookup interface backed by a validated `RouteMap`.
 *
 * The bijection guarantee (Property 4) means that for every `e` in the
 * underlying `RouteMap`:
 *
 *   slugFromId(idFromSlug(e.slug)!) === e.slug
 *   idFromSlug(slugFromId(e.domId)!) === e.domId
 *
 * Lookups for unknown slugs / domIds return `undefined` rather than throwing.
 */
export interface RouteLookup {
  /** Returns the DOM id for a known slug, or `undefined` if not present. */
  idFromSlug(slug: string): string | undefined;
  /** Returns the slug for a known DOM id, or `undefined` if not present. */
  slugFromId(domId: string): string | undefined;
  /**
   * Returns the first entry matching the given role, or `undefined` if no
   * entry has that role. The canonical map guarantees one entry per role.
   */
  entryByRole(role: RouteEntry['role']): RouteEntry | undefined;
  /** Returns the underlying immutable list of entries. */
  entries(): readonly RouteEntry[];
}

/**
 * Discriminated-union result of `validate(routeMap)`.
 *
 * On rejection, at least one of `slug` or `domId` identifies the offending
 * entry, and `reason` carries a deterministic, human-readable description
 * suitable for surfacing in build-time errors. Per design Property 5, the
 * shape is stable across runs for a given input.
 */
export type RouteValidationResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly slug?: string;
      readonly domId?: string;
      readonly reason: string;
    };
