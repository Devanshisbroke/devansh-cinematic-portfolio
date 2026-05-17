import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import jsxA11yPlugin from 'eslint-plugin-jsx-a11y';
// Task 16.2 — registry-only literals (R15.8). The rule lives in a sibling
// file so the config stays focused on plugin wiring; merging happens in
// `localPlugin.rules` below.
import { noRegistryBypass } from './eslint-plugins/no-registry-bypass.js';

// ---------------------------------------------------------------------------
// Architectural-invariant custom rules (task 16.1)
// ---------------------------------------------------------------------------
//
// These rules are inlined here as a private plugin (`local/*`) rather than
// extracted to a separate package. They enforce two invariants from the
// design document:
//
//   1. R5.2 — exactly one shared scroll source. Only `motion/scroll-source.ts`
//      may register a `scroll` listener on `window` or `document`. The
//      `WebGLLayer.tsx` GPU draw-rate throttle is a documented exception
//      (see the JSDoc on that module).
//
//   2. R3.3 / R10.2 — spacing must come from `tokens.ts` via `var(--space-N)`
//      references. Raw `px` / `rem` literals in `margin*`, `padding*`, or
//      `gap` declarations are rejected.
//
// Both rules use `context.filename` (ESLint v9) to determine the current
// file and normalize to forward slashes for cross-platform path matching.

/** Normalize an absolute or relative path to forward slashes. */
function normalize(p) {
  return p.replace(/\\/g, '/');
}

/** True iff `filePath` ends with one of `suffixes` (forward-slash form). */
function endsWithAny(filePath, suffixes) {
  const norm = normalize(filePath);
  return suffixes.some((s) => norm.endsWith(s));
}

/**
 * Files that are explicitly permitted to register a `scroll` listener
 * directly on `window` or `document`. Every other file must subscribe
 * through the shared scroll source instead.
 */
const SCROLL_LISTENER_ALLOWLIST = [
  'src/motion/scroll-source.ts',
  'src/cinematic-background/webgl/WebGLLayer.tsx',
];

/**
 * Files where raw `px` / `rem` spacing literals are intentionally allowed
 * (the token sources of truth themselves).
 */
const RAW_SPACING_ALLOWLIST = [
  'src/design-system/tokens.ts',
  'src/styles/theme.css',
];

/**
 * Property-key matcher for spacing declarations. Covers shorthand
 * (`margin`, `padding`, `gap`) and the full set of logical / physical
 * variants (`marginTop`, `marginBlock`, `marginInline`, `marginInlineStart`,
 * `paddingBlockEnd`, `rowGap`, `columnGap`, etc.).
 */
const SPACING_KEY_RE = /^(margin|padding|gap|rowGap|columnGap)(?:[A-Z][a-zA-Z]*)?$/;

/**
 * Detects a raw `px` or `rem` literal anywhere in a string value. The
 * single-pixel `0` exception is handled by the caller — anything matching
 * a non-zero numeric prefix (including `0.5px`) is reported.
 */
const RAW_PX_REM_RE = /(?<!\d)(\d+(?:\.\d+)?)(px|rem)\b/i;

/**
 * Returns the literal property-key name as a string, regardless of whether
 * the key is an `Identifier` (`{ padding: ... }`) or a `Literal`
 * (`{ 'padding': ... }`). Returns `null` for computed or symbol keys.
 */
function readPropertyKeyName(node) {
  if (node.computed) return null;
  if (node.key.type === 'Identifier') return node.key.name;
  if (node.key.type === 'Literal' && typeof node.key.value === 'string') {
    return node.key.value;
  }
  return null;
}

/**
 * Returns the string content of a node usable as a CSS value, or `null`
 * if the node is dynamic (variable, expression, computed). Handles both
 * string `Literal`s and zero-expression `TemplateLiteral`s.
 */
function readStaticCssValue(node) {
  if (node.type === 'Literal' && typeof node.value === 'string') {
    return node.value;
  }
  if (
    node.type === 'TemplateLiteral' &&
    node.expressions.length === 0 &&
    node.quasis.length === 1
  ) {
    return node.quasis[0].value.cooked ?? node.quasis[0].value.raw;
  }
  return null;
}

const noWindowScrollListenersRule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow `window.addEventListener("scroll", ...)` / `document.addEventListener("scroll", ...)` outside the shared scroll source (R5.2).',
    },
    schema: [],
    messages: {
      forbidden:
        'Only `src/motion/scroll-source.ts` may register a window/document scroll listener (R5.2). Subscribe to the shared scroll source via `useScroll()` or `subscribeScroll()` instead.',
    },
  },
  create(context) {
    const filename = context.filename ?? context.getFilename?.() ?? '';
    if (endsWithAny(filename, SCROLL_LISTENER_ALLOWLIST)) {
      return {};
    }

    return {
      CallExpression(node) {
        const { callee, arguments: args } = node;
        if (callee.type !== 'MemberExpression' || callee.computed) return;
        if (callee.property.type !== 'Identifier') return;
        if (callee.property.name !== 'addEventListener') return;

        // Only flag when the receiver is the global `window`, `document`,
        // or `globalThis`. Listeners attached to specific elements
        // (e.g. `mql.addEventListener('change', ...)`) are unaffected.
        const obj = callee.object;
        if (obj.type !== 'Identifier') return;
        if (obj.name !== 'window' && obj.name !== 'document' && obj.name !== 'globalThis') {
          return;
        }

        if (args.length === 0) return;
        const eventArg = args[0];
        const eventName = readStaticCssValue(eventArg);
        if (eventName !== 'scroll') return;

        context.report({ node, messageId: 'forbidden' });
      },
    };
  },
};

const noRawSpacingRule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow raw `px` or `rem` literals in `margin*`, `padding*`, or `gap` declarations outside `tokens.ts` and `theme.css` (R3.3, R10.2).',
    },
    schema: [],
    messages: {
      forbidden:
        'Use design tokens for spacing instead of raw `px`/`rem` literals (R3.3, R10.2). Reference `var(--space-N)` from `design-system/tokens.ts` instead of `{{value}}`.',
      forbiddenNumeric:
        'Numeric literal {{value}} on `{{key}}` becomes a raw `px` value at runtime. Use a `var(--space-N)` token string instead (R3.3, R10.2).',
    },
  },
  create(context) {
    const filename = context.filename ?? context.getFilename?.() ?? '';
    if (endsWithAny(filename, RAW_SPACING_ALLOWLIST)) {
      return {};
    }

    return {
      Property(node) {
        const keyName = readPropertyKeyName(node);
        if (keyName === null) return;
        if (!SPACING_KEY_RE.test(keyName)) return;

        const value = node.value;

        // Numeric literal: React renders as raw px.
        if (
          value.type === 'Literal' &&
          typeof value.value === 'number' &&
          value.value !== 0
        ) {
          context.report({
            node: value,
            messageId: 'forbiddenNumeric',
            data: { value: String(value.value), key: keyName },
          });
          return;
        }

        // String literal (or zero-expression template): scan for raw
        // `px` / `rem` substrings. `0`, `0px`, `auto`, percentages,
        // `calc(...)`, and `var(--...)` references are unaffected.
        const stringValue = readStaticCssValue(value);
        if (stringValue === null) return;
        const match = RAW_PX_REM_RE.exec(stringValue);
        if (match === null) return;

        // Allow `0px` / `0rem` (and `0.0px`) as a degenerate zero-spacing
        // shorthand. Anything with a non-zero magnitude is reported.
        const magnitude = Number.parseFloat(match[1]);
        if (magnitude === 0) return;

        context.report({
          node: value,
          messageId: 'forbidden',
          data: { value: JSON.stringify(stringValue) },
        });
      },
    };
  },
};

const localPlugin = {
  rules: {
    'no-window-scroll-listeners': noWindowScrollListenersRule,
    'no-raw-spacing': noRawSpacingRule,
    // Task 16.2 — block hard-coded identity / project / contact literals
    // outside the Content_Registry (R15.8). Implementation lives in
    // `eslint-plugins/no-registry-bypass.js`; merged here so the same
    // `local/*` plugin namespace surfaces all architectural rules.
    'no-registry-bypass': noRegistryBypass,
  },
};

// ---------------------------------------------------------------------------
// Flat config
// ---------------------------------------------------------------------------

export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'src/.generated/**',
      'mockupPreviewPlugin.ts',
      'vite.config.ts',
      'vitest.config.ts',
    ],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      'jsx-a11y': jsxA11yPlugin,
      local: localPlugin,
    },
    settings: { react: { version: 'detect' } },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      ...jsxA11yPlugin.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      // Architectural-invariant rules — task 16.1 (R3.3, R5.2, R10.2).
      'local/no-window-scroll-listeners': 'error',
      'local/no-raw-spacing': 'error',
      // Architectural-invariant rules — task 16.2 (R10.10, R15.8).
      // R10.10 — portfolio is a static site. The `@workspace/api-server`
      // and `@workspace/api-client-react` packages exist in the workspace
      // but MUST NOT be reachable from any portfolio source file: there
      // is no runtime API to talk to. `no-restricted-imports` is a
      // built-in ESLint rule, no custom plugin needed. Both `paths`
      // (exact matches) and `patterns` (deep imports) are blocked so an
      // import like `@workspace/api-client-react/hooks` is also rejected.
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@workspace/api-server',
              message:
                'R10.10: portfolio is static — runtime API forbidden.',
            },
            {
              name: '@workspace/api-client-react',
              message:
                'R10.10: portfolio is static — runtime API forbidden.',
            },
          ],
          patterns: [
            '@workspace/api-server/*',
            '@workspace/api-client-react/*',
          ],
        },
      ],
      // R15.8 — banned literal regex enforced inside the local rule.
      'local/no-registry-bypass': 'error',
    },
  },
  {
    files: ['src/tests/**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        global: 'readonly',
        globalThis: 'readonly',
      },
    },
    rules: {
      // Tests can register imports the architectural rules normally forbid
      // (e.g. importing from `content-registry/data` to drive registry-only
      // literal checks). The rules in tasks 16.1/16.2 specifically allow
      // src/tests/** as overrides where appropriate. Spacing and scroll
      // rules still apply: tests should not register window scroll
      // listeners or hard-code raw spacing literals.
    },
  },
];
