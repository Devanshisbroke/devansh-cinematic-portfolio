import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

/**
 * Vitest configuration for `@workspace/portfolio`.
 *
 * - Uses jsdom so Testing Library and DOM smoke tests can render React trees.
 * - `globals: false` keeps test runtime explicit (`expect`, `describe`, etc. are imported).
 * - Coverage uses the v8 provider; HTML output is convenient locally, text output
 *   is what CI greps.
 * - fast-check `numRuns` is configured inside `./src/tests/setup.ts` so the
 *   property-test default (≥ 200 iterations per Requirement 19.3) is enforced
 *   before any property test executes.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    setupFiles: ["./src/tests/setup.ts"],
    include: ["src/tests/**/*.test.{ts,tsx}"],
    exclude: ["dist", "node_modules"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/tests/**",
        "src/**/*.d.ts",
        "src/**/*.types.ts",
      ],
    },
  },
});
