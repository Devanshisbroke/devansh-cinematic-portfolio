#!/usr/bin/env node
// @ts-check
/**
 * Above_The_Fold payload budget assertion (R10.6, R11.7, R11.8).
 *
 * Reads `budget.json` and `dist/public/.vite/manifest.json` (relative to the
 * portfolio package root, NOT to the cwd, so the script behaves the same
 * whether it is invoked as `node scripts/budget.mjs` from the portfolio
 * directory or via `pnpm --filter @workspace/portfolio run build`).
 *
 * For every entry listed in `budget.criticalEntries`, the script:
 *   1. resolves the entry name (e.g. "main", "scenes/Threshold") to a Vite
 *      manifest key (e.g. "src/main.tsx", "src/scenes/Threshold.tsx") via a
 *      tolerant matcher described in `resolveCriticalEntry`;
 *   2. walks the manifest's `imports` graph transitively (NOT
 *      `dynamicImports`, which are by definition NOT on the critical path);
 *   3. collects every emitted `file` (JS chunk) and `css` asset along the
 *      way, deduplicated;
 *   4. gzip-sizes each emitted file via `gzip-size` and sums them.
 *
 * Per the spec:
 *   - `aboveTheFoldJsBytesGz`    bounds JS + CSS critical-path bytes (gzip).
 *   - `aboveTheFoldTotalBytesGz` bounds HTML + CSS + JS critical-path bytes
 *     (gzip), where HTML is the gzipped size of `dist/public/index.html`.
 *
 * Exit codes:
 *   0   BUDGET OK (or BUDGET SKIP when no production build is present)
 *   1   BUDGET FAIL on either limit (R10.6 hard-fail)
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { gzipSizeSync } from 'gzip-size';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// scripts/budget.mjs -> portfolio package root
const PACKAGE_ROOT = path.resolve(__dirname, '..');
const DIST_DIR = path.join(PACKAGE_ROOT, 'dist', 'public');
const MANIFEST_PATH = path.join(DIST_DIR, '.vite', 'manifest.json');
const INDEX_HTML_PATH = path.join(DIST_DIR, 'index.html');
const BUDGET_PATH = path.join(PACKAGE_ROOT, 'budget.json');

const SOURCE_EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js', '.mjs', '.cjs'];

/**
 * Resolve a `criticalEntries` name to a manifest key.
 *
 * Vite emits manifest keys that are source paths relative to the project
 * root, for example `src/main.tsx` for the entry referenced from
 * `index.html` and `src/scenes/Threshold.tsx` for a dynamically-imported
 * scene that has been hoisted onto the critical path. The names in
 * `budget.json#criticalEntries` are deliberately short ("main",
 * "scenes/Threshold") so the budget file does not lock in the on-disk
 * directory layout. Resolution proceeds through the following candidates,
 * in order, returning the first hit:
 *
 *   1. exact match: `manifest[entryName]`
 *   2. conventional source paths under `src/`:
 *      `src/{entryName}.{tsx,ts,jsx,js,mjs,cjs}`
 *   3. project-root source paths: `{entryName}.{tsx,ts,jsx,js,mjs,cjs}`
 *   4. any key ending with `/{entryName}.{ext}` for a known source ext
 *   5. for the special name "main", any chunk where `isEntry === true`
 *      whose file basename matches `main.{ext}`, falling back to the
 *      first `isEntry` chunk if none match exactly.
 *
 * Returns the manifest key or `null` if no candidate is present.
 *
 * @param {Record<string, ManifestChunk>} manifest
 * @param {string} entryName
 * @returns {string | null}
 */
function resolveCriticalEntry(manifest, entryName) {
  if (Object.prototype.hasOwnProperty.call(manifest, entryName)) {
    return entryName;
  }

  // Conventional `src/<name>.<ext>` and `<name>.<ext>` candidates.
  for (const ext of SOURCE_EXTENSIONS) {
    const srcCandidate = `src/${entryName}${ext}`;
    if (Object.prototype.hasOwnProperty.call(manifest, srcCandidate)) {
      return srcCandidate;
    }
    const rootCandidate = `${entryName}${ext}`;
    if (Object.prototype.hasOwnProperty.call(manifest, rootCandidate)) {
      return rootCandidate;
    }
  }

  // Suffix match on `/<name>.<ext>` so deeper layouts still resolve.
  for (const key of Object.keys(manifest)) {
    for (const ext of SOURCE_EXTENSIONS) {
      if (key.endsWith(`/${entryName}${ext}`)) {
        return key;
      }
    }
  }

  // Special-case "main": locate the html-referenced module entry.
  if (entryName === 'main') {
    for (const [key, chunk] of Object.entries(manifest)) {
      if (chunk.isEntry && /(^|\/)main\.[cm]?[jt]sx?$/.test(key)) {
        return key;
      }
    }
    for (const [key, chunk] of Object.entries(manifest)) {
      if (chunk.isEntry) return key;
    }
  }

  return null;
}

/**
 * Walk the manifest's synchronous `imports` graph from `key` transitively
 * and accumulate every visited manifest key in `visited`. `dynamicImports`
 * are intentionally NOT followed: a dynamic import means the chunk loads
 * on demand and is therefore not part of the critical path.
 *
 * @param {Record<string, ManifestChunk>} manifest
 * @param {string} key
 * @param {Set<string>} visited
 */
function walkSyncImports(manifest, key, visited) {
  if (visited.has(key)) return;
  visited.add(key);
  const chunk = manifest[key];
  if (!chunk) return;
  for (const importKey of chunk.imports ?? []) {
    walkSyncImports(manifest, importKey, visited);
  }
}

/**
 * Collect deduplicated emitted JS files and CSS assets from the visited
 * chunks. A manifest chunk's `file` is the emitted JS bundle path
 * (relative to `dist/public`); its `css` array lists CSS assets emitted
 * for that chunk.
 *
 * @param {Record<string, ManifestChunk>} manifest
 * @param {Set<string>} visited
 * @returns {{ js: string[]; css: string[] }}
 */
function collectEmittedFiles(manifest, visited) {
  const js = new Set();
  const css = new Set();
  for (const key of visited) {
    const chunk = manifest[key];
    if (!chunk) continue;
    if (chunk.file) js.add(chunk.file);
    for (const cssFile of chunk.css ?? []) {
      css.add(cssFile);
    }
  }
  return { js: [...js], css: [...css] };
}

/**
 * Gzip-size every file in `relativePaths` (relative to `dist/public`) and
 * sum the byte counts.
 *
 * @param {string[]} relativePaths
 * @returns {number}
 */
function sumGzippedBytes(relativePaths) {
  let sum = 0;
  for (const rel of relativePaths) {
    const abs = path.join(DIST_DIR, rel);
    sum += gzipSizeSync(fs.readFileSync(abs));
  }
  return sum;
}

function softSkip(reason) {
  // R10.6 demands a hard-fail when the budget is exceeded. When the
  // production build has not been generated yet (e.g. someone runs
  // `node scripts/budget.mjs` directly without first running `vite
  // build`), there is no measurable payload, so the script reports a
  // soft skip and exits 0. The `build` script in 15.3 always runs
  // `vite build` before this script, so production runs always have a
  // manifest to assert against.
  console.log(`BUDGET SKIP: ${reason}`);
  process.exit(0);
}

function main() {
  /** @type {Budget} */
  const budget = JSON.parse(fs.readFileSync(BUDGET_PATH, 'utf8'));

  if (!fs.existsSync(MANIFEST_PATH)) {
    softSkip(`no build output found at ${path.relative(PACKAGE_ROOT, MANIFEST_PATH)}`);
    return;
  }

  /** @type {Record<string, ManifestChunk>} */
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));

  /** @type {Set<string>} */
  const visited = new Set();
  /** @type {string[]} */
  const unresolved = [];
  for (const entry of budget.criticalEntries) {
    const key = resolveCriticalEntry(manifest, entry);
    if (key === null) {
      unresolved.push(entry);
      continue;
    }
    walkSyncImports(manifest, key, visited);
  }

  if (unresolved.length > 0) {
    console.error(
      `BUDGET FAIL: could not resolve criticalEntries [${unresolved
        .map((e) => `"${e}"`)
        .join(', ')}] in manifest at ${path.relative(PACKAGE_ROOT, MANIFEST_PATH)}`,
    );
    process.exit(1);
    return;
  }

  const { js: jsFiles, css: cssFiles } = collectEmittedFiles(manifest, visited);
  const jsGz = sumGzippedBytes(jsFiles);
  const cssGz = sumGzippedBytes(cssFiles);
  const htmlGz = fs.existsSync(INDEX_HTML_PATH)
    ? gzipSizeSync(fs.readFileSync(INDEX_HTML_PATH))
    : 0;

  // Per spec: aboveTheFoldJsBytesGz bounds JS+CSS critical-path bytes;
  // aboveTheFoldTotalBytesGz bounds HTML+CSS+JS critical-path bytes.
  const jsMeasure = jsGz + cssGz;
  const totalMeasure = jsGz + cssGz + htmlGz;

  const overJs = jsMeasure > budget.aboveTheFoldJsBytesGz;
  const overTotal = totalMeasure > budget.aboveTheFoldTotalBytesGz;

  if (overJs || overTotal) {
    console.error(
      `BUDGET FAIL: js=${jsMeasure}B, total=${totalMeasure}B ` +
        `(limits: js=${budget.aboveTheFoldJsBytesGz}B, total=${budget.aboveTheFoldTotalBytesGz}B)`,
    );
    process.exit(1);
    return;
  }

  console.log(`BUDGET OK: js=${jsMeasure}B, total=${totalMeasure}B`);
}

main();

/**
 * @typedef {{
 *   file: string;
 *   src?: string;
 *   isEntry?: boolean;
 *   isDynamicEntry?: boolean;
 *   imports?: string[];
 *   dynamicImports?: string[];
 *   css?: string[];
 *   assets?: string[];
 * }} ManifestChunk
 */

/**
 * @typedef {{
 *   aboveTheFoldJsBytesGz: number;
 *   aboveTheFoldTotalBytesGz: number;
 *   criticalEntries: string[];
 * }} Budget
 */
