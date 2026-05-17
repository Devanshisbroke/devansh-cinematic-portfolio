const STORAGE_KEY = 'pcr.theme';

export type Theme = 'dark' | 'light';
type Subscriber = (theme: Theme) => void;

const subscribers = new Set<Subscriber>();

function safeGet(): string | null {
  if (typeof window === 'undefined') return null;
  try { return window.localStorage?.getItem(STORAGE_KEY) ?? null; }
  catch { return null; }
}

function safeSet(value: Theme | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (value === null) window.localStorage?.removeItem(STORAGE_KEY);
    else window.localStorage?.setItem(STORAGE_KEY, value);
  } catch {}
}

/**
 * Read the active theme. Default: `dark`.
 */
export function readTheme(): Theme {
  const stored = safeGet();
  if (stored === 'dark' || stored === 'light') return stored;
  return 'dark';
}

/**
 * Persist the user's theme choice. Updates `<html data-theme>` synchronously so
 * the next paint reflects the change.
 */
export function writeTheme(theme: Theme): void {
  safeSet(theme);
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', theme);
  }
  for (const cb of subscribers) cb(theme);
}

export function subscribeTheme(cb: Subscriber): () => void {
  subscribers.add(cb);
  return () => { subscribers.delete(cb); };
}

/**
 * Pre-paint hydration helper: returns a string of JS to inline in `index.html`'s
 * `<head>` so the document picks up the persisted theme *before* first paint,
 * preventing a flash of wrong theme. Default theme is dark.
 */
export const THEME_HYDRATION_SCRIPT = `(function(){var t='dark';try{var v=window.localStorage&&window.localStorage.getItem('${STORAGE_KEY}');if(v==='dark'||v==='light'){t=v;}}catch(e){}document.documentElement.setAttribute('data-theme',t);})();`;
