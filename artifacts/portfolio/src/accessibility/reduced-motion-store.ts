const STORAGE_KEY = 'pcr.reduced-motion';

type ReducedMotionPref = 'on' | 'off' | null;
type Subscriber = (active: boolean) => void;

const subscribers = new Set<Subscriber>();

function safeLocalStorageGet(): string | null {
  if (typeof window === 'undefined') return null;
  try { return window.localStorage?.getItem(STORAGE_KEY) ?? null; }
  catch { return null; }
}

function safeLocalStorageSet(value: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (value === null) window.localStorage?.removeItem(STORAGE_KEY);
    else window.localStorage?.setItem(STORAGE_KEY, value);
  } catch {}
}

/**
 * Read the active Reduced_Motion_Mode flag.
 * 
 * Resolution order:
 *   1. `localStorage["pcr.reduced-motion"]` if set (`"on"` or `"off"`)
 *   2. `matchMedia('(prefers-reduced-motion: reduce)')` if available
 *   3. `false`
 */
export function readReducedMotion(): boolean {
  const stored = safeLocalStorageGet();
  if (stored === 'on') return true;
  if (stored === 'off') return false;
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  return false;
}

/**
 * Persist the user's reduced-motion preference and notify subscribers.
 */
export function writeReducedMotion(active: boolean): void {
  safeLocalStorageSet(active ? 'on' : 'off');
  notify();
}

/**
 * Clear the user's preference; future reads fall back to the OS preference.
 */
export function clearReducedMotionPref(): void {
  safeLocalStorageSet(null);
  notify();
}

/**
 * Subscribe to changes in the resolved Reduced_Motion_Mode value.
 * Returns an unsubscribe function.
 */
export function subscribe(cb: Subscriber): () => void {
  subscribers.add(cb);
  if (typeof window !== 'undefined') {
    // Listen for OS-pref changes too
    const mql = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const onMqlChange = () => cb(readReducedMotion());
    mql?.addEventListener?.('change', onMqlChange);
    return () => {
      subscribers.delete(cb);
      mql?.removeEventListener?.('change', onMqlChange);
    };
  }
  return () => { subscribers.delete(cb); };
}

function notify(): void {
  const active = readReducedMotion();
  for (const cb of subscribers) cb(active);
}

/**
 * Pre-paint hydration helper: returns a string of JS to inline in `index.html`'s
 * `<head>` so the document picks up the persisted preference *before* first
 * paint, preventing a motion-flash. Sets `<html data-reduced-motion="on|off">`.
 */
export const REDUCED_MOTION_HYDRATION_SCRIPT = `(function(){try{var v=window.localStorage&&window.localStorage.getItem('${STORAGE_KEY}');if(v==='on'||v==='off'){document.documentElement.setAttribute('data-reduced-motion',v);return;}}catch(e){}if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches){document.documentElement.setAttribute('data-reduced-motion','on');}else{document.documentElement.setAttribute('data-reduced-motion','off');}})();`;
