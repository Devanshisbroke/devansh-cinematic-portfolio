/**
 * Public surface of the `route-map/` module.
 *
 * Validates: Requirements 6.1, 6.6, 14.1, 16.1, 16.6
 *
 * Re-exports the public types, the O(1) lookup factory, the validator, and
 * the canonical `routeMap`. The hash-router export is intentionally omitted
 * here until task 4.4 (`hash-router.ts`) lands; consumers wiring deep-link
 * routing should import from this barrel and pick it up automatically once
 * that module is committed.
 */

export type {
  LayoutPattern,
  RouteEntry,
  RouteLookup,
  RouteMap,
  RouteRole,
  RouteValidationResult,
} from './types';

export { createRouteLookup } from './lookup';
export { validate } from './validate';
export { routeMap } from './data';
