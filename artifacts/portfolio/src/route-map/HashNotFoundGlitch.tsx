/**
 * HashNotFoundGlitch — replaces the simple text toast with a cinematic
 * "signal does not resolve" indicator. Same external API as the
 * existing HashNotFoundToast: { active, onDismiss }.
 */

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect } from 'react';

export function HashNotFoundGlitch({
  active,
  onDismiss,
}: {
  active: boolean;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(onDismiss, 4000);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey);
    };
  }, [active, onDismiss]);

  return (
    <AnimatePresence>
      {active && (
        <motion.aside
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
          style={{
            position: 'fixed',
            top: 'clamp(var(--space-7), 8vw, var(--space-9))',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 70,
            padding: '14px 20px',
            background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(20px) saturate(160%)',
            WebkitBackdropFilter: 'blur(20px) saturate(160%)',
            border: '1px solid rgba(255,179,71,0.3)',
            borderRadius: 999,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: '#FFB347',
            boxShadow: '0 0 32px rgba(255,179,71,0.25), 0 12px 48px rgba(0,0,0,0.6)',
          }}
        >
          {/* Glitch glyph */}
          <motion.span
            animate={{ opacity: [1, 0.3, 1, 0.6, 1] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
            style={{ color: '#FFB347', fontWeight: 600 }}
          >
            ⌧
          </motion.span>
          <span style={{ color: '#DCD9D2' }}>signal does not resolve</span>
          <span style={{ color: '#3F3D36', marginInline: 4 }}>::</span>
          <button
            type="button"
            onClick={onDismiss}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#8E8B82',
              fontFamily: 'inherit',
              fontSize: 'inherit',
              letterSpacing: 'inherit',
              textTransform: 'inherit',
              cursor: 'none',
              padding: 0,
            }}
            aria-label="Dismiss"
          >
            esc · dismiss
          </button>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
