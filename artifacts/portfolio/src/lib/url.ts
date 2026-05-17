/**
 * URL helpers (Requirements 1.8, 15.3).
 *
 * `isAbsoluteHttpsUrl` is the canonical "is this a safe outbound link?"
 * predicate used by `validateProject` / `validateIdentity` /
 * `validateContact` (Content_Registry validators) and by any future
 * runtime renderer that needs to decide whether a URL is safe to put
 * in an `href`.
 *
 * Contract:
 *   - Input MUST be a string.
 *   - Length MUST be 1..2048 (R1.8, R15.3 — outbound URL length cap).
 *   - The URL MUST parse via the WHATWG URL constructor.
 *   - The scheme MUST be exactly `https:` (lowercase, no upgrade from
 *     `http:` is permitted).
 *   - The hostname MUST be non-empty after parsing.
 *
 * The function is total — it returns `false` (never throws) for any
 * input that is not a string or that fails URL parsing — so callers
 * can use it as a one-shot guard without wrapping in their own
 * try/catch.
 */
export function isAbsoluteHttpsUrl(s: string): boolean {
  if (typeof s !== 'string' || s.length === 0 || s.length > 2048) {
    return false;
  }
  try {
    const url = new URL(s);
    return url.protocol === 'https:' && url.hostname.length > 0;
  } catch {
    return false;
  }
}
