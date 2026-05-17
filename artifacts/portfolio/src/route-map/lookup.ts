/**
 * O(1) Route_Map lookup.
 *
 * Validates: Requirements 6.1, 6.6, 14.1, 16.1
 *
 * `createRouteLookup(rm)` builds three indexes off a single linear pass over
 * the entries — `slug → domId`, `domId → slug`, and `role → first entry` —
 * so every lookup operation runs in expected O(1) time. The function makes
 * no validity assumption about its input; callers are expected to invoke
 * `validate(rm)` first when they need the bijection invariant (Property 4)
 * to hold. When duplicates do exist, the indexes record the *last* writer
 * for a given key, matching JavaScript `Map` semantics, so a downstream
 * inconsistency surfaces as `idFromSlug ∘ slugFromId ≠ id` rather than as a
 * runtime exception.
 *
 * See `route-map/types.ts` for the `RouteLookup` contract.
 */

import type { RouteEntry, RouteLookup, RouteMap, RouteRole } from './types';

/**
 * Build an O(1) lookup index over an arbitrary `RouteMap`.
 *
 * Property 4 round-trip identity holds whenever the input has already
 * satisfied `validate(rm).ok === true`.
 */
export function createRouteLookup(rm: RouteMap): RouteLookup {
  const slugToId = new Map<string, string>();
  const idToSlug = new Map<string, string>();
  const roleToEntry = new Map<RouteRole, RouteEntry>();

  for (const entry of rm) {
    slugToId.set(entry.slug, entry.domId);
    idToSlug.set(entry.domId, entry.slug);
    // First-write-wins for role lookup: the canonical map promises one entry
    // per role, but generated maps in PBT may have collisions; we keep the
    // earliest entry to match a stable narrative ordering.
    if (!roleToEntry.has(entry.role)) {
      roleToEntry.set(entry.role, entry);
    }
  }

  // Snapshot the entries so subsequent mutation of the caller's array (if
  // any) cannot leak into the lookup; callers receive a `readonly` view.
  const snapshot: readonly RouteEntry[] = [...rm];

  return {
    idFromSlug(slug: string): string | undefined {
      return slugToId.get(slug);
    },
    slugFromId(domId: string): string | undefined {
      return idToSlug.get(domId);
    },
    entryByRole(role: RouteRole): RouteEntry | undefined {
      return roleToEntry.get(role);
    },
    entries(): readonly RouteEntry[] {
      return snapshot;
    },
  };
}
