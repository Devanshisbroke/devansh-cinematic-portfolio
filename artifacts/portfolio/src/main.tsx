/**
 * main.tsx — entry point for the Portfolio_Site SPA.
 *
 * Mounts the `<App/>` shell into the pre-rendered `#root` element shipped by
 * `index.html` and pulls the design-system style entry (`./index.css`) into
 * the bundle.
 *
 * The pre-paint hydration scripts that flip `<html data-theme>` and
 * `<html data-reduced-motion>` *before* first paint run inline in
 * `index.html`'s `<head>` (sourced from `THEME_HYDRATION_SCRIPT` and
 * `REDUCED_MOTION_HYDRATION_SCRIPT` in `src/accessibility/*-store.ts`). They
 * have to execute before the JS bundle loads, otherwise the user sees a flash
 * of the wrong theme — so they cannot live here. Re-exporting the constants
 * from this module makes the contract explicit and gives a stable import path
 * for the prerender script (task 15.4) that injects them into the built
 * `dist/public/index.html`.
 *
 * Validates / Supports: Requirements 4.8, 10.11, 13.13.
 */

import { createRoot } from 'react-dom/client';

import App from './App';
import './index.css';

export {
  THEME_HYDRATION_SCRIPT,
  REDUCED_MOTION_HYDRATION_SCRIPT,
} from './accessibility';

const rootElement = document.getElementById('root');

if (rootElement === null) {
  throw new Error(
    'main.tsx: expected `#root` element in the document — index.html is missing the pre-rendered mount point.',
  );
}

createRoot(rootElement).render(<App />);
