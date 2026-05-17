import { useEffect, useRef } from 'react';

/**
 * useReveal — cinematic intersection-driven reveal hook.
 *
 * Sets `data-revealed="true"` on the element when it crosses the
 * threshold. CSS handles the actual animation, so reduced-motion users
 * skip it via the global `prefers-reduced-motion` media rule in cinema.css.
 *
 * Default: 12% intersection ratio, fires once per page session.
 */
export function useReveal<T extends HTMLElement>(
  threshold = 0.12,
  rootMargin = '0px 0px -10% 0px',
): React.RefObject<T | null> {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      el.setAttribute('data-revealed', 'true');
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            el.setAttribute('data-revealed', 'true');
            io.unobserve(el);
          }
        }
      },
      { threshold, rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold, rootMargin]);

  return ref;
}
