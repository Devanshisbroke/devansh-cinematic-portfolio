/**
 * WarpTransition — a brief full-bleed flash that plays when the user
 * crosses into a project reveal. Marks the boundary between worlds.
 *
 * A single canvas sits between scenes. When any element with the
 * `data-warp-trigger` attribute crosses 50% of the viewport, the
 * canvas flashes amber for ~280ms with vertical chromatic-aberration
 * scan lines and an inverse mask wipe. Plays at most once per
 * trigger element per session.
 */

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { readReducedMotion } from '../../accessibility';
import { play } from '../../audio/sound-engine';

export function WarpTransition() {
  const [active, setActive] = useState(false);
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (typeof IntersectionObserver === 'undefined') return;

    const targets = document.querySelectorAll<HTMLElement>('[data-warp-trigger]');
    if (targets.length === 0) {
      // Not yet rendered — observe later via mutation observer
      const mo = new MutationObserver(() => {
        const t = document.querySelectorAll<HTMLElement>('[data-warp-trigger]');
        if (t.length > 0) {
          mo.disconnect();
          setupObserver(t);
        }
      });
      mo.observe(document.body, { childList: true, subtree: true });
      return () => mo.disconnect();
    } else {
      return setupObserver(targets);
    }

    function setupObserver(els: NodeListOf<HTMLElement>): () => void {
      const reduced = readReducedMotion();
      const io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.intersectionRatio > 0.5) {
              const el = e.target as HTMLElement;
              const id = el.id || el.getAttribute('data-warp-trigger') || '';
              if (seenRef.current.has(id)) continue;
              seenRef.current.add(id);
              if (reduced) continue;
              setActive(true);
              play('enter');
              setTimeout(() => setActive(false), 320);
            }
          }
        },
        { threshold: [0.5, 0.55] },
      );
      els.forEach((el) => io.observe(el));
      return () => io.disconnect();
    }
  }, []);

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          aria-hidden="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0] }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1], times: [0, 0.3, 1] }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 8000,
            pointerEvents: 'none',
            background:
              'radial-gradient(ellipse at center, rgba(255,179,71,0.18) 0%, rgba(255,179,71,0.06) 40%, rgba(0,0,0,0) 70%)',
            mixBlendMode: 'screen',
          }}
        >
          {/* Vertical scan-line bands */}
          <motion.div
            initial={{ scaleY: 0.2, opacity: 1 }}
            animate={{ scaleY: 1, opacity: 0 }}
            transition={{ duration: 0.32, ease: 'linear' }}
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'repeating-linear-gradient(0deg, transparent 0, transparent 2px, rgba(255,179,71,0.05) 2px, rgba(255,179,71,0.05) 3px)',
              transformOrigin: 'center',
            }}
          />
          {/* Horizontal sweep */}
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: '100%' }}
            transition={{ duration: 0.32, ease: 'linear' }}
            style={{
              position: 'absolute',
              top: '50%',
              left: 0,
              right: 0,
              height: 1,
              background:
                'linear-gradient(90deg, transparent, #FFB347 50%, transparent)',
              transform: 'translateY(-50%)',
              boxShadow: '0 0 24px #FFB347',
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
