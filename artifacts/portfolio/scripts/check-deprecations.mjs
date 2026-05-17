#!/usr/bin/env node
/**
 * scripts/check-deprecations.mjs — production-tree deprecation gate (R19.6).
 *
 * Spawns `pnpm install --reporter=ndjson` from the workspace root and
 * parses stdout + stderr line-by-line. Every line is treated as an
 * NDJSON event and inspected for deprecation signals; the first hit on
 * a *production* (non-dev, non-optional) dependency exits the process
 * with code 1 and a `DEPS FAIL: …` message. A clean run emits
 * `DEPS OK: no production deprecations` and exits 0.
 *
 * Defensive parsing
 * -----------------
 * pnpm versions emit slightly different shapes; this script treats any
 * of the following as a deprecation hit:
 *   - `event.name === 'pnpm:deprecation'`
 *   - `event.deprecated === true`
 *   - `event.level === 'warn'` AND its message/prefix mentions
 *     `'deprecated'` (case-insensitive)
 *   - `event.name` contains `'deprecat'` (case-insensitive)
 *   - any non-JSON line whose text contains `' deprecated'`
 *
 * Production-tree filter
 * ----------------------
 * A hit is suppressed when the originating event is unambiguously a dev
 * or optional dependency:
 *   - `event.dev === true`
 *   - `event.optional === true`
 *   - `event.depType === 'devDependencies'` or `'optionalDependencies'`
 * If the event lacks dev/optional metadata, it is treated as
 * production by default (fail-loud).
 *
 * Exit codes
 * ----------
 *   0 — clean install, no production deprecations.
 *   1 — at least one production-tree deprecation, or a setup error
 *       (workspace root missing, pnpm not on PATH, child crashed).
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// `__dirname` is `<workspace>/artifacts/portfolio/scripts/`.
// Workspace root is three levels up.
const WORKSPACE_ROOT = resolve(__dirname, '..', '..', '..');

function ok(message) {
  console.log(`DEPS OK: ${message}`);
  process.exit(0);
}

function fail(message) {
  console.error(`DEPS FAIL: ${message}`);
  process.exit(1);
}

function isDevOrOptional(event) {
  if (!event || typeof event !== 'object') return false;
  if (event.dev === true) return true;
  if (event.optional === true) return true;
  if (
    event.depType === 'devDependencies' ||
    event.depType === 'optionalDependencies'
  ) {
    return true;
  }
  // Some pnpm versions nest these under `dependency`.
  const nested = event.dependency;
  if (nested && typeof nested === 'object') {
    if (nested.dev === true) return true;
    if (nested.optional === true) return true;
  }
  return false;
}

function extractDeprecationHit(event) {
  if (!event || typeof event !== 'object') return null;

  const nameStr = typeof event.name === 'string' ? event.name : '';
  const messageStr =
    typeof event.message === 'string'
      ? event.message
      : typeof event.reason === 'string'
        ? event.reason
        : '';
  const prefixStr = typeof event.prefix === 'string' ? event.prefix : '';

  const nameSaysDeprecated = /deprecat/i.test(nameStr);
  const messageSaysDeprecated =
    /deprecated/i.test(messageStr) || /deprecated/i.test(prefixStr);
  const flaggedDeprecated = event.deprecated === true;
  const isWarn = event.level === 'warn';

  const isHit =
    nameStr === 'pnpm:deprecation' ||
    flaggedDeprecated ||
    nameSaysDeprecated ||
    (isWarn && messageSaysDeprecated);

  if (!isHit) return null;

  // Best-effort package + version + reason extraction.
  let pkg = '';
  if (typeof event.package === 'string') pkg = event.package;
  else if (typeof event.pkgName === 'string') {
    pkg = event.pkgName;
    if (typeof event.pkgVersion === 'string') pkg += `@${event.pkgVersion}`;
  } else if (event.dependency && typeof event.dependency === 'object') {
    const d = event.dependency;
    if (typeof d.name === 'string') {
      pkg = d.name;
      if (typeof d.version === 'string') pkg += `@${d.version}`;
    }
  } else if (messageStr) {
    const m = messageStr.match(/([A-Za-z0-9@/_\-.]+@[\w.\-+]+)/);
    if (m) pkg = m[1];
  }

  const reason =
    (typeof event.reason === 'string' && event.reason) ||
    messageStr ||
    'no reason reported';

  return { pkg: pkg || '<unknown>', reason };
}

function processLine(line, onHit) {
  const trimmed = line.trim();
  if (trimmed.length === 0) return;

  // Try NDJSON first.
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const event = JSON.parse(trimmed);
      if (isDevOrOptional(event)) return;
      const hit = extractDeprecationHit(event);
      if (hit) onHit(hit);
      return;
    } catch {
      // Fall through to text-mode handling.
    }
  }

  // Text fallback: catch deprecation lines pnpm prints outside the
  // ndjson stream (rare, but observed when a sub-resolver fails). We
  // cannot tell dev from prod here, so treat as prod (fail-loud).
  if (/\bdeprecated\b/i.test(trimmed)) {
    const m = trimmed.match(/([A-Za-z0-9@/_\-.]+@[\w.\-+]+)/);
    onHit({
      pkg: m ? m[1] : '<unknown>',
      reason: trimmed,
    });
  }
}

function runPnpmInstall(onHit, onDone, onError) {
  // On Windows the shell launcher for pnpm is `pnpm.cmd`. `shell: true`
  // sidesteps the platform difference without losing argv quoting.
  const child = spawn('pnpm', ['install', '--reporter=ndjson'], {
    cwd: WORKSPACE_ROOT,
    shell: true,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stdoutBuf = '';
  let stderrBuf = '';
  let resolved = false;

  const consume = (chunk, which) => {
    if (resolved) return;
    const text = chunk.toString('utf8');
    let buf = which === 'out' ? stdoutBuf + text : stderrBuf + text;
    let nl;
    while ((nl = buf.indexOf('\n')) !== -1) {
      const line = buf.slice(0, nl);
      buf = buf.slice(nl + 1);
      processLine(line, onHit);
      if (resolved) break;
    }
    if (which === 'out') stdoutBuf = buf;
    else stderrBuf = buf;
  };

  child.stdout.on('data', (c) => consume(c, 'out'));
  child.stderr.on('data', (c) => consume(c, 'err'));

  child.on('error', (err) => {
    if (resolved) return;
    resolved = true;
    onError(`failed to spawn pnpm install: ${err.message}`);
  });

  child.on('close', (code) => {
    if (resolved) return;
    resolved = true;
    // Drain any trailing partial line.
    if (stdoutBuf.trim().length > 0) processLine(stdoutBuf, onHit);
    if (stderrBuf.trim().length > 0) processLine(stderrBuf, onHit);
    onDone(code ?? 0);
  });

  return child;
}

function main() {
  if (!existsSync(resolve(WORKSPACE_ROOT, 'pnpm-workspace.yaml'))) {
    fail(
      `workspace root not found (expected pnpm-workspace.yaml at ${WORKSPACE_ROOT})`,
    );
  }

  let firedHit = false;
  let child;

  const onHit = (hit) => {
    if (firedHit) return;
    firedHit = true;
    // Try to terminate the child install so we exit promptly.
    try {
      child?.kill();
    } catch {
      // best-effort
    }
    fail(`${hit.pkg} is deprecated: ${hit.reason}`);
  };

  const onError = (msg) => {
    fail(msg);
  };

  const onDone = (code) => {
    if (firedHit) return; // already exited
    if (code !== 0) {
      fail(`pnpm install exited with code ${code}`);
    }
    ok('no production deprecations');
  };

  child = runPnpmInstall(onHit, onDone, onError);
}

main();
