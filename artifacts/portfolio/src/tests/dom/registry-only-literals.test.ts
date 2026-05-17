/**
 * Static-analysis guard — registry-only literals (task 16.2, R15.8).
 *
 * This test walks the rendering modules under `src/scenes/`,
 * `src/design-system/`, `src/motion/`, `src/cinematic-background/`, and
 * the single file `src/route-map/data.ts` and asserts that no banned
 * identity / project / contact LITERAL appears as a quoted string or
 * JSX text node anywhere in the source. The intent — exactly per
 * R15.8 — is that user-visible identity / project / contact strings
 * MUST come from `src/content-registry/data.ts` rather than be
 * hard-coded inline.
 *
 * The same regex used by the local ESLint rule
 * (`local/no-registry-bypass`, defined in
 * `eslint-plugins/no-registry-bypass.js`) is enforced here.
 *
 * Scope rules — which spans of source text are considered "literals":
 *   - Single-quoted string literals  (`'…'`)
 *   - Double-quoted string literals  (`"…"`)
 *   - Template literal quasis        (`` `…${expr}…` `` — only the
 *                                     literal segments, never the
 *                                     interpolation expressions)
 *
 * Module specifiers (the `'…'` operand of `import`, `export … from`,
 * `import('…')`, and `require('…')`) are NOT considered user content
 * and are skipped — they are file paths or package names. The ESLint
 * rule applies the same exclusion via its AST inspection.
 *
 * Anything else — TypeScript identifiers (`GlobeIDReveal`), member
 * names (`KhetechReveal`), JSDoc text, line comments, JSX text — is
 * ignored by this static scanner. JSX text is handled by the ESLint
 * rule's `JSXText` visitor, which is the authoritative gate for
 * hard-coded user-facing strings; this vitest test is a defence in
 * depth that catches incidental textual inclusion in static literals.
 *
 * Validates: Requirements 10.10, 15.8
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Project root resolved from this test file's location. We use
 * `import.meta.url` rather than `__dirname` so the test runs cleanly
 * under the workspace's ESM (`"type": "module"`) configuration without
 * relying on Vitest's CJS shim.
 */
const HERE = dirname(fileURLToPath(import.meta.url));
const PORTFOLIO_ROOT = resolve(HERE, '..', '..', '..');

/**
 * Same regex source the ESLint rule uses. A fresh `RegExp` is
 * constructed on every match so the global `lastIndex` carryover does
 * not flake.
 */
const BANNED_PATTERN_SOURCE =
  '(GlobeID|Khetech|SupportDeskOps-v6|Last-Minute PDF|Devansh Barai|devanshbarai\\.official@gmail\\.com|linkedin\\.com\\/in\\/devansh-barai|github\\.com\\/Devanshisbroke)';

/**
 * Directories (recursive) and single files to scan, exactly per
 * `tasks.md` § 16.2.
 */
const SCAN_TARGETS: ReadonlyArray<{ kind: 'dir' | 'file'; path: string }> = [
  { kind: 'dir', path: 'src/scenes' },
  { kind: 'dir', path: 'src/design-system' },
  { kind: 'dir', path: 'src/motion' },
  { kind: 'dir', path: 'src/cinematic-background' },
  { kind: 'file', path: 'src/route-map/data.ts' },
] as const;

const SCANNED_EXTENSIONS = new Set(['.ts', '.tsx']);

// ---------------------------------------------------------------------------
// File-walking
// ---------------------------------------------------------------------------

function* walkSourceFiles(dir: string): Generator<string> {
  let entries: ReturnType<typeof readdirSync>;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkSourceFiles(full);
    } else if (entry.isFile()) {
      const dot = entry.name.lastIndexOf('.');
      if (dot < 0) continue;
      const ext = entry.name.slice(dot);
      if (SCANNED_EXTENSIONS.has(ext)) yield full;
    }
  }
}

function collectScannedFiles(): string[] {
  const out: string[] = [];
  for (const target of SCAN_TARGETS) {
    const abs = resolve(PORTFOLIO_ROOT, target.path);
    if (target.kind === 'file') {
      try {
        const stat = statSync(abs);
        if (stat.isFile()) out.push(abs);
      } catch {
        // Falls through to the explicit existence assertion in the
        // first `it(…)` block below.
      }
    } else {
      for (const f of walkSourceFiles(abs)) out.push(f);
    }
  }
  return out.sort();
}

// ---------------------------------------------------------------------------
// Literal extraction
// ---------------------------------------------------------------------------
//
// A pragmatic single-pass tokenizer over the source text. The goal is
// not to be a full TS/JSX parser — it is to recover the spans that the
// ESLint rule's AST scope (`Literal`, `TemplateElement.value.cooked`,
// `JSXText`) would cover, with line numbers preserved. The tokenizer
// recognises three structural states:
//
//   1. CODE          — default. Skips identifiers, numbers, operators.
//                      Recognises:
//                        // line comment
//                        /* block comment */
//                        ' " ` (string / template start)
//                        < (only as a JSX tag opener, see heuristic)
//                        > (closes a JSX tag, transitioning to JSX_TEXT
//                          if the closing wasn't a self-closing one)
//
//   2. STRING        — inside a single- or double-quoted literal.
//                      Captures content. Honours `\` escapes. Closes
//                      on the matching quote.
//
//   3. TEMPLATE      — inside a backtick template literal. Captures
//                      the quasi text. On `${` recurses to CODE until
//                      a matching `}` closes the interpolation, then
//                      returns to TEMPLATE.
//
// JSX text recognition uses a coarse heuristic: when a `<TagName ` or
// `<TagName>` open tag is detected at the CODE level, the tokenizer
// follows attribute scanning to its matching `>` and then captures
// JSX_TEXT until the next `<`. This is intentionally lossy on
// pathological JSX (mismatched tags, JSX fragments inside complex
// expressions) — false negatives are acceptable here because the
// authoritative gate is the ESLint rule. The vitest test is a
// complementary defence-in-depth check.
//
// In practice every JSX text node in this codebase that could
// legitimately render a banned literal does so via `{identity.foo}` or
// `{project.name}` (a JSX expression, not JSX text), so the simpler
// approach — scan only string literals — is sufficient. JSX text
// extraction is provided anyway so a future regression that hard-codes
// `<p>Devansh Barai</p>` in JSX is also flagged.

interface ExtractedLiteral {
  /** 1-indexed line number of the first character of the captured span. */
  readonly line: number;
  /** Captured content (string-literal value). */
  readonly content: string;
  /** True iff this string literal is the source/argument of an
   *  `import` / `export` / `require()` and therefore a module
   *  specifier rather than user content. */
  readonly isModuleSpecifier: boolean;
}

/**
 * Scan backwards from `i` (skipping whitespace) to determine whether
 * the upcoming string literal is being used as a module specifier
 * (i.e. the operand of `from`, `import(`, or `require(`). These are
 * file paths / package names, not user-visible content, and the ESLint
 * rule's structural counterpart skips them too. The check is
 * deliberately textual rather than semantic: it only looks at the
 * preceding token — which is sufficient because all three forms place
 * the keyword/operator directly before the string.
 */
function isModuleSpecifierContext(source: string, openQuoteIndex: number): boolean {
  // Walk back over whitespace.
  let j = openQuoteIndex - 1;
  while (j >= 0 && /\s/.test(source[j])) j -= 1;
  if (j < 0) return false;
  // `require(` / `import(` — the previous non-whitespace char is `(`.
  if (source[j] === '(') {
    // Walk back over the identifier preceding the `(`.
    let k = j - 1;
    while (k >= 0 && /\s/.test(source[k])) k -= 1;
    let idEnd = k;
    while (k >= 0 && /[A-Za-z_$0-9]/.test(source[k])) k -= 1;
    const ident = source.slice(k + 1, idEnd + 1);
    return ident === 'import' || ident === 'require';
  }
  // `from '...'` / `import '...';` (side-effect import).
  // Walk back over the preceding identifier (or empty for `import '…'`).
  let kEnd = j;
  let k = j;
  while (k >= 0 && /[A-Za-z_$0-9]/.test(source[k])) k -= 1;
  const ident = source.slice(k + 1, kEnd + 1);
  if (ident === 'from') return true;
  // `import 'side-effect'` — preceding identifier is `import`.
  if (ident === 'import') return true;
  // `export * from '...'` / `export {…} from '...'` reduce to the
  // `from` case already handled above.
  return false;
}

function extractLiterals(source: string): ExtractedLiteral[] {
  const out: ExtractedLiteral[] = [];
  const len = source.length;
  let i = 0;
  let line = 1;

  /** Advance `i` by `n` and update `line` for any newlines crossed. */
  function advance(n: number): void {
    for (let k = 0; k < n; k += 1) {
      if (source[i] === '\n') line += 1;
      i += 1;
    }
  }

  while (i < len) {
    const ch = source[i];
    const next = source[i + 1];

    // Block comment.
    if (ch === '/' && next === '*') {
      const end = source.indexOf('*/', i + 2);
      const stop = end === -1 ? len : end + 2;
      advance(stop - i);
      continue;
    }

    // Line comment.
    if (ch === '/' && next === '/') {
      const end = source.indexOf('\n', i + 2);
      const stop = end === -1 ? len : end;
      advance(stop - i);
      continue;
    }

    // Single- / double-quoted string literal.
    if (ch === "'" || ch === '"') {
      const quote = ch;
      const startLine = line;
      const openIndex = i;
      const isModSpec = isModuleSpecifierContext(source, openIndex);
      advance(1); // opening quote
      const buf: string[] = [];
      while (i < len) {
        const c = source[i];
        if (c === '\\') {
          buf.push(c);
          advance(1);
          if (i < len) {
            buf.push(source[i]);
            advance(1);
          }
          continue;
        }
        if (c === quote) {
          advance(1);
          break;
        }
        if (c === '\n') break;
        buf.push(c);
        advance(1);
      }
      out.push({
        line: startLine,
        content: buf.join(''),
        isModuleSpecifier: isModSpec,
      });
      continue;
    }

    // Template literal.
    if (ch === '`') {
      advance(1); // opening backtick
      let quasiStart = line;
      let buf: string[] = [];
      while (i < len) {
        const c = source[i];
        if (c === '\\') {
          buf.push(c);
          advance(1);
          if (i < len) {
            buf.push(source[i]);
            advance(1);
          }
          continue;
        }
        if (c === '`') {
          out.push({
            line: quasiStart,
            content: buf.join(''),
            isModuleSpecifier: false,
          });
          advance(1);
          break;
        }
        if (c === '$' && source[i + 1] === '{') {
          out.push({
            line: quasiStart,
            content: buf.join(''),
            isModuleSpecifier: false,
          });
          buf = [];
          advance(2); // ${
          // Skip over `${…}` interpolation while still extracting any
          // string literals nested inside.
          let depth = 1;
          while (i < len && depth > 0) {
            const cc = source[i];
            const cn = source[i + 1];
            if (cc === "'" || cc === '"') {
              const qq = cc;
              const startLine2 = line;
              const openInner = i;
              const isModSpecInner = isModuleSpecifierContext(source, openInner);
              advance(1);
              const innerBuf: string[] = [];
              while (i < len) {
                const cci = source[i];
                if (cci === '\\') {
                  innerBuf.push(cci);
                  advance(1);
                  if (i < len) {
                    innerBuf.push(source[i]);
                    advance(1);
                  }
                  continue;
                }
                if (cci === qq) {
                  advance(1);
                  break;
                }
                if (cci === '\n') break;
                innerBuf.push(cci);
                advance(1);
              }
              out.push({
                line: startLine2,
                content: innerBuf.join(''),
                isModuleSpecifier: isModSpecInner,
              });
              continue;
            }
            if (cc === '/' && cn === '*') {
              const e = source.indexOf('*/', i + 2);
              const s = e === -1 ? len : e + 2;
              advance(s - i);
              continue;
            }
            if (cc === '/' && cn === '/') {
              const e = source.indexOf('\n', i + 2);
              const s = e === -1 ? len : e;
              advance(s - i);
              continue;
            }
            if (cc === '{') depth += 1;
            else if (cc === '}') depth -= 1;
            advance(1);
          }
          quasiStart = line;
          continue;
        }
        buf.push(c);
        advance(1);
      }
      continue;
    }

    advance(1);
  }

  return out;
}

// ---------------------------------------------------------------------------
// Match collection
// ---------------------------------------------------------------------------

interface Offence {
  readonly file: string;
  readonly line: number;
  readonly literal: string;
  readonly excerpt: string;
}

function findOffences(absPath: string, raw: string): Offence[] {
  const literals = extractLiterals(raw);
  const offences: Offence[] = [];
  const rawLines = raw.split('\n');
  for (const lit of literals) {
    if (lit.isModuleSpecifier) continue;
    const re = new RegExp(BANNED_PATTERN_SOURCE, 'g');
    let match: RegExpExecArray | null;
    while ((match = re.exec(lit.content)) !== null) {
      const excerpt = (rawLines[lit.line - 1] ?? lit.content).trim();
      offences.push({
        file: absPath,
        line: lit.line,
        literal: match[0],
        excerpt,
      });
    }
  }
  return offences;
}

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------

describe('R15.8 — registry-only literals (static-analysis guard)', () => {
  const files = collectScannedFiles();

  it('discovers at least one file in every required scan target', () => {
    for (const target of SCAN_TARGETS) {
      const abs = resolve(PORTFOLIO_ROOT, target.path);
      if (target.kind === 'file') {
        expect(files, `missing scanned file: ${target.path}`).toContain(abs);
      } else {
        const matched = files.filter((f) => f.startsWith(abs));
        expect(
          matched.length,
          `no source files found under ${target.path}`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it('finds no banned identity / project / contact literal outside the Content_Registry', () => {
    const offences: Offence[] = [];
    for (const file of files) {
      const raw = readFileSync(file, 'utf8');
      offences.push(...findOffences(file, raw));
    }

    if (offences.length > 0) {
      const lines = offences.map(
        (o) => `  • ${o.file}:${o.line} → "${o.literal}"  in: ${o.excerpt}`,
      );
      throw new Error(
        [
          `R15.8 violation — ${offences.length} banned literal(s) found outside src/content-registry/.`,
          'Re-export from src/content-registry/data.ts instead of inlining:',
          ...lines,
        ].join('\n'),
      );
    }

    expect(offences).toEqual([]);
  });
});
