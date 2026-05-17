# Devansh Barai — Cinematic Portfolio

A full-stack cinematic identity engine. React 19 + Vite 7 + Tailwind v4 + Framer Motion 12 + custom WebGL plasma shader + Lenis smooth-scroll + Three.js (lazy). Property-based-tested. Built spec-first.

Live at the deployed site • Five scenes — `Threshold` · `Compass` · `Work` · `Ethos` · `Signal` — choreographed as a single continuous experience.

## What's in here

This is a pnpm workspace. The interesting code lives in `artifacts/portfolio/`.

```
.
├── artifacts/
│   ├── portfolio/          # The site itself — React 19 + Vite 7
│   ├── api-server/         # Optional Express server (unused by the portfolio)
│   └── mockup-sandbox/     # Component playground
├── .kiro/
│   └── specs/portfolio-cinematic-redesign/
│       ├── requirements.md # Spec-first authoring — every R-number maps to behaviour
│       ├── design.md
│       └── tasks.md        # 88 tasks, all shipped
└── pnpm-workspace.yaml
```

## Architecture highlights

- **Single shared scroll source.** `motion/scroll-source.ts` owns the only `window.scroll` listener in the app. Everything that reacts to scroll — parallax, sticky, hash routing, scene progress, kinetic typography — subscribes to it via `useScroll()`.
- **Capability-gated GPU layer.** `cinematic-background/CinematicBackground.tsx` is a lazy boundary; the WebGL plasma shader only ships to clients with `hardwareConcurrency > 4`, `deviceMemory > 4`, no `prefers-reduced-data`, no `prefers-reduced-motion`. Static gradient fallback otherwise.
- **OLED-tuned palette.** Every text-on-surface pair in `design-system/contrast-pairs.ts` is verified against WCAG AA via property-based test.
- **Per-scene cursor identity.** `CursorAura` writes CSS variables on `<html>` so React reconciliation can never undo them. The cursor morphs amber circle → cyan circle → plasma square → moss diamond → amber filled disc as you scroll the five scenes.
- **Command palette (⌘K).** Fuzzy search across scenes, projects, contacts, system actions, and "ask the system" answers.
- **Boot sequence.** Once-per-session particle assembly with typing-injects-glyphs interaction. `⌘+Shift+K` replays it.
- **Konami code → core dump.** Live developer telemetry overlay with FPS, scroll velocity, pointer state, build hash.

## Run it locally

Requires Node 20+ and pnpm 9+.

```bash
pnpm install

# Dev server (PowerShell)
$env:PORT="5173"; $env:BASE_PATH="/"; pnpm --filter @workspace/portfolio run dev

# Or bash / zsh
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/portfolio run dev
```

Open http://localhost:5173.

## Build for production

```bash
PORT=4173 BASE_PATH=/ pnpm --filter @workspace/portfolio run build
```

The build runs:

1. `vite build` — emits hashed assets under `artifacts/portfolio/dist/public/`
2. `prerender.mjs` — bakes a static index.html + a hidden SEO block
3. `budget.mjs` — fails the build if the Above_The_Fold critical-path JS exceeds 180KB gzipped or total exceeds 350KB gzipped

## Tests

```bash
pnpm --filter @workspace/portfolio run test         # 80 tests
pnpm --filter @workspace/portfolio run typecheck
pnpm --filter @workspace/portfolio run lint
```

The test suite is split between:
- **Property-based tests** (`src/tests/pbt/`) — `fast-check` properties over the route map, content registry, contrast pairs, copy hygiene, reduced-motion, responsive engine.
- **DOM tests** (`src/tests/dom/`) — JSDOM-rendered scene assertions (focus management, hash routing, no-runtime-fetch contract, threshold above-the-fold structure).

## Deploy

Configured for Vercel. Project root: `artifacts/portfolio/`. The included `vercel.json` sets the build command, SPA rewrites, immutable cache headers for hashed assets, and security headers (HSTS, X-Frame-Options, Permissions-Policy disabling FLoC).

## Identity

Devansh Barai · IIT Madras (BS, Data Science & Applications, 2024–2028) · IIM Bangalore (BBA, Digital Business & Entrepreneurship, 2025–2028).

Reach me: `devanshbarai.official@gmail.com` · [LinkedIn](https://linkedin.com/in/devansh-barai) · [GitHub](https://github.com/Devanshisbroke)

---

© Devansh Barai · designed and built in this browser
