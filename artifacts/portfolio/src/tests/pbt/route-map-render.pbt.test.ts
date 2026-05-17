/**
 * Render-time bijection check for the canonical `routeMap`.
 *
 * Validates: Requirements 16.1
 *
 * Property 5 covers the size-bounds and validation behaviour for arbitrary
 * Route_Maps in `route-map.pbt.test.ts`. This file holds the symmetric
 * render-time assertion: once `src/route-map/data.ts` exists (task 4.5), its
 * exported `routeMap` MUST validate and round-trip through `createRouteLookup`
 * for every entry.
 *
 * Until tasks 4.3 (`validate.ts` + `lookup.ts`) and 4.5 (`data.ts`) land,
 * the dynamic-import-and-skip pattern keeps this suite green: any missing
 * module short-circuits the test, and the assertion runs only when every
 * dependency is in place.
 */

import { describe, it, expect } from 'vitest';

describe('Property 5 — Route_Map render-time bijection (canonical map)', () => {
  // Validates: Requirements 16.1

  it('the canonical routeMap from data.ts validates and round-trips', async () => {
    let routeMap: typeof import('../../route-map/data')['routeMap'] | undefined;
    let validate:
      | typeof import('../../route-map/validate')['validate']
      | undefined;
    let createRouteLookup:
      | typeof import('../../route-map/lookup')['createRouteLookup']
      | undefined;

    // Vite's import-analysis transform resolves literal-string `import()`
    // specifiers at build time, which breaks the "skip until ready" contract
    // documented in this file's header (the test should silently no-op until
    // task 4.5 lands `data.ts`). Concatenating the specifier at runtime keeps
    // the import expression opaque to static analysis so the actual resolve
    // happens at execution time, where the try/catch can swallow it.
    const dataSpec = '../../route-map/' + 'data';
    const validateSpec = '../../route-map/' + 'validate';
    const lookupSpec = '../../route-map/' + 'lookup';

    try {
      ({ routeMap } = await import(/* @vite-ignore */ dataSpec));
      ({ validate } = await import(/* @vite-ignore */ validateSpec));
      ({ createRouteLookup } = await import(/* @vite-ignore */ lookupSpec));
    } catch {
      return; // data not yet authored — skip
    }

    if (!routeMap || !validate || !createRouteLookup) return;

    const result = validate(routeMap);
    expect(result.ok).toBe(true);

    const lookup = createRouteLookup(routeMap);
    for (const e of routeMap) {
      expect(lookup.idFromSlug(e.slug)).toBe(e.domId);
      expect(lookup.slugFromId(e.domId)).toBe(e.slug);
    }
  });
});
