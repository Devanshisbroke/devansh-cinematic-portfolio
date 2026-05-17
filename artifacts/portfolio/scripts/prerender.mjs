#!/usr/bin/env node
/**
 * scripts/prerender.mjs — minimal SSR shell injector for R10.11.
 *
 * Renders a small React tree containing the maintainer's name, the role
 * headline, the two co-primary affiliations, and each flagship project's
 * name + tagline through `react-dom/server.renderToString`, then injects
 * the resulting HTML into `dist/public/index.html` as a visually-hidden
 * (but DOM-extractable) block right before `</body>`.
 *
 * Crawlers and link-preview bots that fetch the static artifact with
 * JavaScript disabled SHALL therefore see the SEO-relevant content as
 * text in the document body without any client runtime executing
 * (R10.11). The block uses the off-screen "clip" pattern rather than
 * `display:none` so it is also reachable by assistive tech when JS is
 * blocked, and it is idempotent: re-running this script replaces the
 * existing `id="seo-prerender"` block instead of appending a duplicate.
 *
 * Inputs:
 *   - `scripts/seo-snapshot.json` — static mirror of the SEO-relevant
 *     fields of `src/content-registry/data.ts`. The registry is a TS
 *     module and cannot be imported directly from a pure-ESM Node script
 *     without a transpile dependency; the snapshot keeps this script
 *     dependency-free. Maintainers MUST update both files in the same
 *     commit when registry content changes — this script emits a
 *     `WARN_SNAPSHOT_STALE` line if the snapshot's mtime is older than
 *     `data.ts` so a drift never goes silent.
 *   - `dist/public/index.html` — the Vite build output.
 *
 * Outputs:
 *   - Mutates `dist/public/index.html` in place.
 *   - Stdout: `PRERENDER OK: injected <N> project entries`.
 *   - Exit 0 on success, 1 on any failure (missing files, write errors).
 */

import { readFileSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToString } from 'react-dom/server';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// `__dirname` is `artifacts/portfolio/scripts/`. The Vite outDir is
// `artifacts/portfolio/dist/public/`.
const PORTFOLIO_ROOT = resolve(__dirname, '..');
const SNAPSHOT_PATH = resolve(__dirname, 'seo-snapshot.json');
const REGISTRY_PATH = resolve(PORTFOLIO_ROOT, 'src/content-registry/data.ts');
const HTML_PATH = resolve(PORTFOLIO_ROOT, 'dist/public/index.html');

const SEO_BLOCK_ID = 'seo-prerender';

// Visually-hidden but extractable. Crawlers and accessibility tools both
// receive the text. Avoids `display:none` which some link-preview engines
// strip silently.
//
// React's `style` prop is an object; the renderer serialises it to a
// CSS string in the output HTML.
const SEO_BLOCK_STYLE = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  overflow: 'hidden',
  clip: 'rect(0,0,0,0)',
  clipPath: 'inset(50%)',
  whiteSpace: 'nowrap',
};

function fail(message) {
  console.error(`PRERENDER FAIL: ${message}`);
  process.exit(1);
}

function loadSnapshot() {
  if (!existsSync(SNAPSHOT_PATH)) {
    fail(`SEO snapshot not found at ${SNAPSHOT_PATH}`);
  }
  let raw;
  try {
    raw = readFileSync(SNAPSHOT_PATH, 'utf8');
  } catch (err) {
    fail(`could not read ${SNAPSHOT_PATH}: ${err.message}`);
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    fail(`invalid JSON in ${SNAPSHOT_PATH}: ${err.message}`);
  }
  // Soft-validate snapshot shape so a typo surfaces here, not in a
  // search-engine cache.
  const required = ['displayName', 'roleHeadline', 'affiliations', 'projects'];
  for (const key of required) {
    if (data[key] === undefined) {
      fail(`SEO snapshot is missing required field "${key}"`);
    }
  }
  if (!Array.isArray(data.projects) || data.projects.length === 0) {
    fail('SEO snapshot "projects" must be a non-empty array');
  }
  for (const p of data.projects) {
    if (!p || typeof p.name !== 'string' || typeof p.tagline !== 'string') {
      fail('every entry in SEO snapshot "projects" requires {name, tagline} strings');
    }
  }
  return data;
}

/**
 * Emit a non-fatal staleness warning if the registry has been touched
 * more recently than the snapshot. Drift is detected, never silently
 * tolerated, but does not block the build — the snapshot may legitimately
 * predate non-SEO registry edits (e.g. a new `outcomes` entry).
 */
function warnIfSnapshotStale() {
  if (!existsSync(REGISTRY_PATH)) return;
  try {
    const snap = statSync(SNAPSHOT_PATH).mtimeMs;
    const reg = statSync(REGISTRY_PATH).mtimeMs;
    if (reg > snap) {
      console.warn(
        `PRERENDER WARN_SNAPSHOT_STALE: ${REGISTRY_PATH} was modified after ${SNAPSHOT_PATH}; ` +
          'verify the SEO snapshot still mirrors the registry.',
      );
    }
  } catch {
    // mtime checks are advisory only.
  }
}

/**
 * Build the React element tree for the SSR shell. No JSX (this is .mjs);
 * `React.createElement` is the canonical no-transform form.
 */
function buildSeoElement(snapshot) {
  const h = React.createElement;

  const heading = h('h1', null, snapshot.displayName);
  const role = h('p', null, snapshot.roleHeadline);

  const affiliationItems = snapshot.affiliations.map((line, i) =>
    h('li', { key: `aff-${i}` }, line),
  );
  const affiliations = h(
    'ul',
    { 'aria-label': 'Education' },
    affiliationItems,
  );

  const projectItems = snapshot.projects.map((p, i) =>
    h(
      'li',
      { key: `proj-${i}` },
      h('strong', null, p.name),
      ' — ',
      h('span', null, p.tagline),
    ),
  );
  const projects = h(
    'ul',
    { 'aria-label': 'Flagship projects' },
    projectItems,
  );

  return h(
    'div',
    {
      id: SEO_BLOCK_ID,
      'aria-label': 'Pre-rendered summary',
      style: SEO_BLOCK_STYLE,
    },
    heading,
    role,
    affiliations,
    projects,
  );
}

/**
 * Insert or replace the SEO block in the HTML. Idempotent.
 */
function injectIntoHtml(html, blockHtml) {
  // Match the existing block by id, regardless of attribute order.
  // Non-greedy match; the block contains no nested <div id="seo-prerender">.
  const existingPattern = new RegExp(
    `<div\\b[^>]*\\bid=["']${SEO_BLOCK_ID}["'][^>]*>[\\s\\S]*?</div>`,
    'i',
  );
  if (existingPattern.test(html)) {
    return html.replace(existingPattern, blockHtml);
  }
  // Otherwise, insert right before </body>.
  const bodyClose = /<\/body>/i;
  if (!bodyClose.test(html)) {
    fail('dist/public/index.html has no </body> tag to inject before');
  }
  return html.replace(bodyClose, `${blockHtml}\n  </body>`);
}

function main() {
  const snapshot = loadSnapshot();
  warnIfSnapshotStale();

  if (!existsSync(HTML_PATH)) {
    fail(
      `expected ${HTML_PATH} to exist (run \`vite build\` before \`node scripts/prerender.mjs\`)`,
    );
  }

  let html;
  try {
    html = readFileSync(HTML_PATH, 'utf8');
  } catch (err) {
    fail(`could not read ${HTML_PATH}: ${err.message}`);
  }

  const element = buildSeoElement(snapshot);
  const rendered = renderToString(element);

  let nextHtml;
  try {
    nextHtml = injectIntoHtml(html, rendered);
  } catch (err) {
    fail(`injection failed: ${err.message}`);
  }

  try {
    writeFileSync(HTML_PATH, nextHtml, 'utf8');
  } catch (err) {
    fail(`could not write ${HTML_PATH}: ${err.message}`);
  }

  console.log(
    `PRERENDER OK: injected ${snapshot.projects.length} project entries`,
  );
}

main();
