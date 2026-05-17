/**
 * Route_Map validator.
 *
 * Validates: Requirements 6.1, 6.6, 14.1, 16.1, 16.2, 16.3, 16.4, 16.6
 *
 * Enforces the contracts named in `design.md` § "Route_Map":
 *
 *   - **Size bounds (R16.6).** 1..1000 entries inclusive.
 *   - **Slug shape (R16.2).** `^[a-z0-9-]{1,64}$`.
 *   - **DOM id shape (R16.3).** `^[a-zA-Z][a-zA-Z0-9_-]{0,127}$`.
 *   - **Bijection (R16.4 / Property 4).** Every slug and every domId is
 *     unique across the map.
 *   - **Role coverage (R6.1, R14.1).** Each of the five narrative roles
 *     (`opening`, `identity`, `work`, `philosophy`, `contact`) must appear
 *     at least once.
 *
 * Check ordering matters for the deterministic rejection-shape contract
 * (Property 5): per-entry format and duplicate checks run *during* a single
 * pass over the entries, so when the input is `[...rm, dup]` the rejection
 * surfaces with the offending `slug` or `domId` set, regardless of whether
 * `rm` happens to be at the maximum allowed length. Only after every entry
 * has been examined do the holistic size-cap and role-coverage checks fire,
 * neither of which carries a slug/domId field.
 */

import type {
  RouteEntry,
  RouteMap,
  RouteRole,
  RouteValidationResult,
} from './types';

/** R16.2 — slug shape. */
const SLUG_PATTERN = /^[a-z0-9-]{1,64}$/;
/** R16.3 — DOM id shape. */
const DOMID_PATTERN = /^[a-zA-Z][a-zA-Z0-9_-]{0,127}$/;
/** R16.6 — upper size bound (lower bound enforced separately for clarity). */
const MAX_ROUTE_MAP_SIZE = 1000;

/**
 * The five narrative roles the canonical Route_Map must cover at least once
 * each (R6.1 + R14.1). Missing any of these is a hard rejection.
 */
const REQUIRED_ROLES: ReadonlyArray<RouteRole> = [
  'opening',
  'identity',
  'work',
  'philosophy',
  'contact',
];

/**
 * Validate a Route_Map against its full set of structural contracts.
 *
 * Returns `{ ok: true }` on success; on failure, returns
 * `{ ok: false, slug?, domId?, reason }` where at least one of `slug` or
 * `domId` is populated whenever the offending entry is identifiable.
 */
export function validate(rm: RouteMap): RouteValidationResult {
  // R16.6 lower bound — empty maps are rejected. No offending entry exists,
  // so neither `slug` nor `domId` is set on the rejection.
  if (rm.length === 0) {
    return {
      ok: false,
      reason: 'Route_Map must contain at least 1 entry',
    };
  }

  const seenSlugs = new Set<string>();
  const seenDomIds = new Set<string>();

  // Per-entry pass. Order inside the loop is intentional:
  //   1. slug shape  -> identifies entry by slug
  //   2. domId shape -> identifies entry by domId
  //   3. duplicate slug -> identifies entry by slug
  //   4. duplicate domId -> identifies entry by domId
  // Each rejection therefore satisfies the Property 5 deterministic-shape
  // assertion (`slug !== undefined || domId !== undefined`).
  for (let i = 0; i < rm.length; i++) {
    const entry: RouteEntry = rm[i]!;

    if (!SLUG_PATTERN.test(entry.slug)) {
      return {
        ok: false,
        slug: entry.slug,
        reason: `slug "${entry.slug}" at index ${i} violates pattern ${SLUG_PATTERN.source}`,
      };
    }

    if (!DOMID_PATTERN.test(entry.domId)) {
      return {
        ok: false,
        domId: entry.domId,
        reason: `domId "${entry.domId}" at index ${i} violates pattern ${DOMID_PATTERN.source}`,
      };
    }

    if (seenSlugs.has(entry.slug)) {
      return {
        ok: false,
        slug: entry.slug,
        reason: `duplicate slug "${entry.slug}" at index ${i}`,
      };
    }

    if (seenDomIds.has(entry.domId)) {
      return {
        ok: false,
        domId: entry.domId,
        reason: `duplicate domId "${entry.domId}" at index ${i}`,
      };
    }

    seenSlugs.add(entry.slug);
    seenDomIds.add(entry.domId);
  }

  // R16.6 upper bound — runs after the per-entry pass so that a duplicate
  // appended to an already-maximal map is reported as a duplicate (with the
  // offending slug/domId) rather than as a size violation.
  if (rm.length > MAX_ROUTE_MAP_SIZE) {
    return {
      ok: false,
      reason: `Route_Map must contain at most ${MAX_ROUTE_MAP_SIZE} entries (got ${rm.length})`,
    };
  }

  // Role coverage (R6.1, R14.1). The PBT generator `arbRouteMap` does not
  // guarantee role coverage, so Property 4's round-trip test wraps in
  // `if (!result.ok) return;` to skip generator outputs that miss a role.
  // Property 5 does not exercise this path. The canonical `routeMap` in
  // `data.ts` (task 4.5) is asserted to cover every role at module load.
  const seenRoles = new Set<RouteRole>();
  for (const entry of rm) {
    seenRoles.add(entry.role);
  }
  for (const role of REQUIRED_ROLES) {
    if (!seenRoles.has(role)) {
      return {
        ok: false,
        reason: `Route_Map must contain at least one entry with role "${role}"`,
      };
    }
  }

  return { ok: true };
}
