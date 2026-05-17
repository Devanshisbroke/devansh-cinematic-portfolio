import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

const rawPort = process.env.PORT;

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH;

if (!basePath) {
  throw new Error(
    "BASE_PATH environment variable is required but was not provided.",
  );
}

// ---------------------------------------------------------------------------
// Critical-path / lazy-chunk strategy (R10.5, R11.7, R11.8; design § Code
// splitting and lazy boundaries).
//
// `manualChunks` partitions the production bundle into a small critical-path
// surface and a set of standalone lazy chunks. The Above_The_Fold budget is
// 180 KB gzipped JS / 350 KB gzipped total (budget.json). Returning a chunk
// name forces Rollup to emit a dedicated chunk; returning `undefined`
// preserves Rollup's default chunking (Vite then merges the module into the
// caller's chunk graph, typically the dynamic-import boundary that owns it).
//
// Critical-path chunks (always loaded with the entry):
//   • react-vendor       — react, react-dom, jsx-runtime
//   • framer-motion-mini — framer-motion entry. The app imports only
//     `LazyMotion` + `domAnimation` + `m`/`motion` from the package's mini
//     surface; tree-shaking drops the heavier `domMax` features at build
//     time. Isolating the package in its own chunk makes the budget script
//     able to attribute the cost precisely.
//
// Lazy chunks (loaded on demand by `React.lazy` boundaries in App.tsx /
// post-FCP loader):
//   • scene-twin-compass, scene-work, scene-ethos, scene-signal — one
//     chunk per below-the-fold scene module tree (R10.5).
//   • cinematic-bg                                              — the WebGL
//     atmosphere isolated behind the single React boundary defined by
//     R10.4 / design § Cinematic_Background.
//   • lenis-bridge                                              — the
//     capability-gated smooth-scroll bridge (motion/lenis-bridge.ts).
//
// `id` is the absolute module path that Rollup resolves; on Windows the
// path uses forward slashes by the time it reaches `manualChunks`, so the
// substring tests below are portable.
// ---------------------------------------------------------------------------

function manualChunks(id: string): string | undefined {
  // node_modules — vendor partitioning.
  if (id.includes("node_modules")) {
    // React + the JSX runtime stay on the critical path with the entry.
    if (
      /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id) ||
      /[\\/]node_modules[\\/]react[\\/]jsx-runtime/.test(id) ||
      /[\\/]node_modules[\\/]react[\\/]jsx-dev-runtime/.test(id)
    ) {
      return "react-vendor";
    }
    // Framer Motion — the app uses only the LazyMotion + `m` mini surface.
    // Tree-shaking removes the unused heavy features; isolating the
    // package gives the budget script a clean attribution lane.
    if (/[\\/]node_modules[\\/]framer-motion[\\/]/.test(id)) {
      return "framer-motion-mini";
    }
    // Everything else from node_modules falls through to default chunking.
    return undefined;
  }

  // Application source — force lazy scenes / cinematic-bg / lenis bridge
  // into their own chunks regardless of which boundary import-pulls them.

  // Normalise to forward-slash so the substring tests work on Windows
  // builds too. (Rollup already does this in practice; the replace is a
  // defensive belt-and-braces.)
  const norm = id.replace(/\\/g, "/");

  if (norm.includes("/src/scenes/Work/")) {
    return "scene-work";
  }
  if (norm.includes("/src/scenes/TwinCompass")) {
    return "scene-twin-compass";
  }
  if (norm.includes("/src/scenes/Ethos")) {
    return "scene-ethos";
  }
  if (norm.includes("/src/scenes/Signal")) {
    return "scene-signal";
  }
  if (norm.includes("/src/cinematic-background/")) {
    return "cinematic-bg";
  }
  if (norm.includes("/src/motion/lenis-bridge")) {
    return "lenis-bridge";
  }

  // Default: let Rollup decide (entry chunks merge under the importing
  // dynamic boundary; static imports merge into the entry chunk).
  return undefined;
}

// ---------------------------------------------------------------------------
// Display-family preload helper (R4.8).
//
// The portfolio loads its three typefaces through Google Fonts CSS at
// `https://fonts.googleapis.com/css2?...` (see `src/styles/fonts.css`).
// The actual woff2 binaries are served from `fonts.gstatic.com` with
// hash-versioned URLs that change on Google's release cadence, so a
// hard-coded `<link rel="preload" as="font" href=...>` tag for the
// Fraunces woff2 would go stale within weeks. The portable equivalent is
// a `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>`
// (warms TLS + DNS so the woff2 download starts as soon as the parser
// reaches `@import url(fonts.googleapis.com/...)` inside the bundled
// CSS) plus a `<link rel="preload" as="style">` for the Fraunces
// stylesheet itself.
//
// Both tags are already authored statically in `index.html` so dev,
// preview, and prerender all carry them. This plugin runs in production
// builds only and (a) verifies the tags are present and (b) inserts them
// at the top of <head> if a future edit removes them, so the build
// keeps R4.8 even if the static markup drifts. The check is idempotent.
// ---------------------------------------------------------------------------

function fontPreloadPlugin(): Plugin {
  const FONTS_GOOGLEAPIS = "https://fonts.googleapis.com";
  const FONTS_GSTATIC = "https://fonts.gstatic.com";
  const DISPLAY_STYLESHEET =
    "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@14..144,400..600&display=swap";

  return {
    name: "portfolio-font-preload",
    apply: "build",
    transformIndexHtml: {
      order: "pre",
      handler(html) {
        const tagsToEnsure: { match: RegExp; tag: string }[] = [
          {
            match: /rel=["']preconnect["']\s+href=["']https:\/\/fonts\.googleapis\.com["']/,
            tag: `<link rel="preconnect" href="${FONTS_GOOGLEAPIS}" />`,
          },
          {
            match: /rel=["']preconnect["']\s+href=["']https:\/\/fonts\.gstatic\.com["'][^>]*\bcrossorigin\b/,
            tag: `<link rel="preconnect" href="${FONTS_GSTATIC}" crossorigin />`,
          },
          {
            match: /rel=["']preload["']\s+as=["']style["']\s+href=["']https:\/\/fonts\.googleapis\.com\/css2\?family=Fraunces/,
            tag: `<link rel="preload" as="style" href="${DISPLAY_STYLESHEET}" />`,
          },
        ];

        const missing = tagsToEnsure
          .filter(({ match }) => !match.test(html))
          .map(({ tag }) => tag);

        if (missing.length === 0) {
          return html;
        }

        // Insert immediately after <head>. Falls through unchanged if the
        // document has no <head> tag (which would be a separate authoring
        // bug surfaced elsewhere by the prerender step).
        return html.replace(/<head(\s[^>]*)?>/i, (m) => `${m}\n    ${missing.join("\n    ")}`);
      },
    },
  };
}

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    fontPreloadPlugin(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    // Manifest is required by `scripts/budget.mjs` (task 15.2) which walks
    // the manifest entries to gzip-size the Above_The_Fold critical chunks.
    manifest: true,
    // Modern target: every browser the portfolio supports ships native
    // ES2022 (top-level await, class fields, error cause). Skipping the
    // legacy transform shaves the entry chunk noticeably.
    target: "es2022",
    // Per-route CSS chunking so a lazy scene's CSS travels with its JS
    // chunk instead of inflating the critical-path stylesheet (R10.5).
    cssCodeSplit: true,
    // No inlined assets — every binary keeps its hashed URL so the budget
    // script can account for it and the browser cache keys correctly
    // across deploys.
    assetsInlineLimit: 0,
    // Source maps balloon the deployed bundle and aren't needed for the
    // public build; the prerender + budget assertions run on the
    // unminified manifest, not on map output.
    sourcemap: false,
    // `assetsDir: 'assets'` is the Vite default — declared here so the
    // hashed-filename pattern (`[name]-[hash].[ext]`) stays explicit and
    // the budget script knows exactly where to look.
    assetsDir: "assets",
    rollupOptions: {
      // R19.2 hard-fail discipline: any Rollup warning emitted by the
      // production bundle must terminate the build with a non-zero exit
      // code so the maintainer notices it before deploy. Vite forwards
      // anything that reaches Rollup's logger through this callback; the
      // default handler would print and continue, so we re-throw instead.
      // No exceptions are whitelisted — if a future warning class proves
      // genuinely unavoidable (e.g. a transitively-vendored library
      // emitting a benign `MODULE_LEVEL_DIRECTIVE` for "use client") the
      // exemption must be added here with a documented reference and a
      // narrow code-equality check, not as a broad bypass.
      onwarn(warning) {
        const code = warning.code ?? "UNKNOWN";
        throw new Error(
          `Vite/Rollup warning treated as error [${code}]: ${warning.message}`,
        );
      },
      output: {
        manualChunks,
      },
    },
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
