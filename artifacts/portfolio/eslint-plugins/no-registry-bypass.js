/**
 * `no-registry-bypass` — local ESLint rule (task 16.2, R15.8).
 *
 * Forbids hard-coded identity / project / contact literals from any
 * rendering module outside `src/content-registry/`. The Content_Registry
 * (`src/content-registry/data.ts`) is the single source of truth for
 * Devansh Barai's display name, the four flagship project names
 * (GlobeID, Khetech, SupportDeskOps-v6, Last-Minute PDF), the verified
 * email, and the verified LinkedIn / GitHub URLs. Every other module
 * MUST consume those values via `import { identity, projects, contact }
 * from '@/content-registry'` so a single source-of-truth edit
 * propagates without missing a hard-coded inline literal.
 *
 * The rule visits string-valued AST nodes only — `Literal` (covers
 * `'…'`, `"…"`, and bare regex unions) and `TemplateElement.value.cooked`
 * (covers `${…}`-interpolated and tagged template literals). Comments
 * and JSDoc text are *not* AST literals, so the rule deliberately
 * leaves them alone — doc comments routinely cite project names by
 * design (e.g. `* GlobeID reveal — centered-singular layout`).
 *
 * Allow-list:
 *   - Any file inside `src/content-registry/` (the registry IS the
 *     source of truth — it MUST contain these literals).
 *   - Any file inside `src/tests/` (test fixtures legitimately reference
 *     canonical names; these are not "rendering modules" per R15.8 and
 *     are explicitly excluded by the spec text).
 *
 * The banned regex below mirrors the regex documented in
 * `tasks.md` § 16.2 verbatim so the ESLint rule and the static-analysis
 * vitest test (`src/tests/dom/registry-only-literals.test.ts`) stay in
 * lock-step. Edit one ⇒ edit both.
 */

const BANNED_PATTERN =
  /(GlobeID|Khetech|SupportDeskOps-v6|Last-Minute PDF|Devansh Barai|devanshbarai\.official@gmail\.com|linkedin\.com\/in\/devansh-barai|github\.com\/Devanshisbroke)/;

const MESSAGE =
  'R15.8: identity / project / contact literals must come from `src/content-registry/data.ts`. Re-export from the registry instead of inlining.';

/** Normalise a Windows-or-POSIX path to forward slashes for substring match. */
function toPosix(filename) {
  return typeof filename === 'string' ? filename.replace(/\\/g, '/') : '';
}

/**
 * The rule object. Exported under both the `rules.no-registry-bypass`
 * key (for the local plugin object below) and as a named export so a
 * sibling plugin file added by another task (e.g. 16.1) can merge it
 * into its own plugin object without re-implementing it.
 */
export const noRegistryBypass = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Forbid hard-coded identity/project/contact literals outside `src/content-registry/`.',
      recommended: true,
    },
    schema: [],
    messages: { banned: MESSAGE },
  },
  create(context) {
    // ESLint 9's flat-config exposes `context.filename`; older bridges
    // expose `getFilename()`. Try both for forward/backward compat.
    const filename =
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      context.filename ??
      (typeof context.getFilename === 'function' ? context.getFilename() : '');
    const posix = toPosix(filename);

    if (posix.includes('/src/content-registry/')) return {};
    if (posix.includes('/src/tests/')) return {};

    function reportIfBanned(node, value) {
      if (typeof value !== 'string') return;
      if (BANNED_PATTERN.test(value)) {
        context.report({ node, messageId: 'banned' });
      }
    }

    /**
     * True iff `node` is the `source` literal of a static import /
     * export, or the argument of a dynamic `import()` / `require()`.
     * These are module specifiers (file paths or package names), not
     * user-visible content. Skipping them keeps file names like
     * `'./reveals/GlobeIDReveal'` legal — the registry rule only cares
     * about literals that could leak identity / project / contact text
     * into the rendered UI.
     */
    function isModuleSpecifier(node) {
      const p = node.parent;
      if (!p) return false;
      if (
        p.type === 'ImportDeclaration' ||
        p.type === 'ExportAllDeclaration' ||
        p.type === 'ExportNamedDeclaration'
      ) {
        return p.source === node;
      }
      if (p.type === 'ImportExpression') {
        return p.source === node;
      }
      if (
        p.type === 'CallExpression' &&
        p.callee &&
        p.callee.type === 'Identifier' &&
        p.callee.name === 'require'
      ) {
        return p.arguments && p.arguments[0] === node;
      }
      return false;
    }

    return {
      Literal(node) {
        if (typeof node.value !== 'string') return;
        if (isModuleSpecifier(node)) return;
        reportIfBanned(node, node.value);
      },
      TemplateElement(node) {
        const cooked =
          node.value && typeof node.value.cooked === 'string'
            ? node.value.cooked
            : null;
        if (cooked !== null) reportIfBanned(node, cooked);
      },
      JSXText(node) {
        if (typeof node.value === 'string') reportIfBanned(node, node.value);
      },
    };
  },
};

/**
 * Plugin object consumed by the flat `eslint.config.js`. The key
 * `rules.no-registry-bypass` is what binds the rule id
 * `local/no-registry-bypass` (where `local` is the plugin's
 * registered name in `eslint.config.js > plugins`).
 */
const plugin = {
  rules: {
    'no-registry-bypass': noRegistryBypass,
  },
};

export default plugin;
