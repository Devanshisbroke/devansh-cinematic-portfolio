/**
 * CommandPalette — ⌘K / Ctrl-K spatial command bar.
 *
 * The palette is the OS-style entry point to the entire experience:
 *
 *   • Navigate scenes (⏎ scrolls to anchor)
 *   • Open projects directly
 *   • Toggle theme / reduced-motion / core-dump
 *   • Fire contact actions (mailto, copy email, open social)
 *   • "Ask the system" — a contextual answer pipe driven by the
 *     content registry (no LLM round-trip; all answers compose
 *     from in-bundle data so it stays instant + offline)
 *
 * Keyboard:
 *   ⌘/Ctrl K  — open
 *   Esc       — close
 *   ↑ ↓       — move selection
 *   ⏎         — activate
 *   /         — focus search (when palette open)
 *
 * Pure DOM, no portal lib; renders into document.body via React portal.
 */

import { motion, AnimatePresence } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { identity, projects } from '../../content-registry/data';
import { routeMap } from '../../route-map/data';
import {
  readReducedMotion,
  writeReducedMotion,
  readTheme,
  writeTheme,
} from '../../accessibility';

// ===========================================================================
// Command model
// ===========================================================================

type CommandKind = 'navigate' | 'project' | 'contact' | 'system' | 'answer';

interface Command {
  id: string;
  kind: CommandKind;
  title: string;
  subtitle?: string;
  hint?: string;        // right-side keystroke hint
  hue?: string;         // accent color glyph
  glyph?: string;       // 1-2 char monogram
  keywords?: string;    // extra fuzzy terms
  run: () => void;
}

interface BuilderArgs {
  close: () => void;
  setCoreDump: (v: boolean) => void;
}

function buildCommands({ close, setCoreDump }: BuilderArgs): Command[] {
  const cmds: Command[] = [];

  // Scene navigation
  for (const r of routeMap) {
    cmds.push({
      id: `nav:${r.slug}`,
      kind: 'navigate',
      title: r.slug.charAt(0).toUpperCase() + r.slug.slice(1),
      subtitle: `Jump to scene · #${r.slug}`,
      hint: '↵',
      glyph: r.slug.charAt(0).toUpperCase(),
      hue: hueForSlug(r.slug),
      keywords: `scene navigate jump goto ${r.slug} ${r.role}`,
      run: () => {
        window.location.hash = `#${r.slug}`;
        close();
      },
    });
  }

  // Projects
  for (const p of projects) {
    cmds.push({
      id: `project:${p.id}`,
      kind: 'project',
      title: p.name,
      subtitle: p.tagline,
      hint: '↗',
      glyph: p.name.slice(0, 2).toUpperCase(),
      hue: hueForProject(p.id),
      keywords: `project ${p.id} ${p.tags.join(' ')} ${p.technologyOrientation ?? ''}`,
      run: () => {
        window.location.hash = `#scene-work-${p.id}`;
        close();
      },
    });
  }

  // Contacts
  cmds.push({
    id: 'contact:email',
    kind: 'contact',
    title: 'Email Devansh',
    subtitle: identity.email,
    hint: '⏎',
    glyph: '✉',
    hue: '#FFB347',
    keywords: 'email mail reach contact write',
    run: () => {
      window.location.href = `mailto:${identity.email}`;
      close();
    },
  });
  cmds.push({
    id: 'contact:copy-email',
    kind: 'contact',
    title: 'Copy email to clipboard',
    subtitle: identity.email,
    hint: '⌘C',
    glyph: '⌘',
    hue: '#FFB347',
    keywords: 'copy clipboard email',
    run: async () => {
      try { await navigator.clipboard.writeText(identity.email); } catch { /* noop */ }
      close();
    },
  });
  for (const s of identity.socials) {
    cmds.push({
      id: `contact:${s.label.toLowerCase()}`,
      kind: 'contact',
      title: `Open ${s.label}`,
      subtitle: s.url.replace(/^https?:\/\//, ''),
      hint: '↗',
      glyph: s.label === 'LinkedIn' ? 'in' : '⟨/⟩',
      hue: s.label === 'LinkedIn' ? '#6FD4FF' : '#B388FF',
      keywords: `${s.label.toLowerCase()} social link`,
      run: () => {
        window.open(s.url, '_blank', 'noopener,noreferrer');
        close();
      },
    });
  }

  // System commands
  cmds.push({
    id: 'sys:theme',
    kind: 'system',
    title: 'Toggle theme',
    subtitle: 'switch dark / light',
    hint: '⏎',
    glyph: '☾',
    hue: '#DCD9D2',
    keywords: 'theme dark light mode',
    run: () => {
      writeTheme(readTheme() === 'dark' ? 'light' : 'dark');
      close();
    },
  });
  cmds.push({
    id: 'sys:motion',
    kind: 'system',
    title: 'Toggle reduced motion',
    subtitle: 'respect motion preferences',
    hint: '⏎',
    glyph: '◐',
    hue: '#DCD9D2',
    keywords: 'motion reduce animation',
    run: () => {
      writeReducedMotion(!readReducedMotion());
      close();
    },
  });
  cmds.push({
    id: 'sys:replay-boot',
    kind: 'system',
    title: 'Replay boot sequence',
    subtitle: 'cinematic intro',
    hint: '⏎',
    glyph: '⟳',
    hue: '#FFB347',
    keywords: 'boot intro replay cinematic',
    run: () => {
      sessionStorage.removeItem('pcr.boot-played');
      window.location.reload();
    },
  });
  cmds.push({
    id: 'sys:core-dump',
    kind: 'system',
    title: 'Core dump · system telemetry',
    subtitle: 'developer view (60s)',
    hint: '⏎',
    glyph: '∎',
    hue: '#8EB58A',
    keywords: 'core dump dev developer debug telemetry konami',
    run: () => {
      setCoreDump(true);
      close();
    },
  });

  // Contextual "ask the system" answers (precomputed; no API call).
  for (const a of buildAnswers()) {
    cmds.push({
      id: `answer:${a.q}`,
      kind: 'answer',
      title: a.q,
      subtitle: a.a,
      hint: '↳',
      glyph: '?',
      hue: '#8E8B82',
      keywords: `ask question ${a.q} ${a.a}`,
      run: () => { /* no-op — the subtitle IS the answer */ },
    });
  }

  return cmds;
}

interface AskAnswer { q: string; a: string; }

function buildAnswers(): AskAnswer[] {
  const projNames = projects.map((p) => p.name).join(', ');
  return [
    { q: 'who is devansh?', a: `${identity.tagline} · IIT Madras + IIM Bangalore.` },
    { q: 'what does devansh build?', a: `Four flagship projects: ${projNames}.` },
    { q: 'how to reach devansh?', a: `${identity.email} · LinkedIn + GitHub linked.` },
    { q: 'how is this site built?', a: 'React 19 · Vite 7 · Tailwind 4 · WebGL plasma shader · custom motion system. PBT-tested.' },
    { q: 'why two universities?', a: 'Co-primary, equal weight. IIT Madras shapes technical instinct. IIM Bangalore shapes product translation.' },
    { q: 'what is globeid?', a: 'Identity infrastructure for cross-platform presence. Founder + product lead.' },
    { q: 'what is khetech?', a: 'Computer-vision pipeline for plant-disease diagnosis from leaf photos.' },
    { q: 'what is supportdeskops?', a: 'RL environment with step-wise scoring for LLM-driven customer-support agents.' },
    { q: 'what is last-minute pdf?', a: 'A small PDF utility built for the moment three minutes before a deadline.' },
  ];
}

function hueForSlug(slug: string): string {
  switch (slug) {
    case 'threshold': return '#FFB347';
    case 'compass':   return '#6FD4FF';
    case 'work':      return '#B388FF';
    case 'ethos':     return '#8EB58A';
    case 'signal':    return '#FFB347';
    default:          return '#FFB347';
  }
}

function hueForProject(id: string): string {
  switch (id) {
    case 'globeid':           return '#FFB347';
    case 'khetech':           return '#8EB58A';
    case 'supportdeskops-v6': return '#FFB347';
    case 'last-minute-pdf':   return '#D9621F';
    default:                  return '#FFB347';
  }
}

// ===========================================================================
// Fuzzy match — simple subsequence + score
// ===========================================================================

function fuzzy(query: string, target: string): number {
  if (!query) return 1;
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  if (t.includes(q)) return 1.0;
  let qi = 0;
  let score = 0;
  let last = -1;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) {
      score += last >= 0 && i - last === 1 ? 2 : 1;
      last = i;
      qi++;
    }
  }
  return qi === q.length ? score / (q.length * 2) : 0;
}

function rankCommand(cmd: Command, query: string): number {
  if (!query) return 1;
  const a = fuzzy(query, cmd.title);
  const b = fuzzy(query, cmd.subtitle ?? '') * 0.6;
  const c = fuzzy(query, cmd.keywords ?? '') * 0.4;
  return Math.max(a, b, c);
}

// ===========================================================================
// Component
// ===========================================================================

export function CommandPalette({
  setCoreDump,
}: {
  setCoreDump: (v: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setSelected(0);
  }, []);

  const commands = useMemo(
    () => buildCommands({ close, setCoreDump }),
    [close, setCoreDump],
  );

  const filtered = useMemo(() => {
    return commands
      .map((c) => ({ c, r: rankCommand(c, query) }))
      .filter((x) => x.r > 0)
      .sort((a, b) => b.r - a.r)
      .map((x) => x.c)
      .slice(0, 24);
  }, [commands, query]);

  // Keyboard global handlers
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Replay boot: ⌘/Ctrl+Shift+K
      const isReplay = (e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'k' || e.key === 'K');
      if (isReplay) {
        e.preventDefault();
        sessionStorage.removeItem('pcr.boot-played');
        window.location.reload();
        return;
      }
      const isModK = (e.metaKey || e.ctrlKey) && !e.shiftKey && (e.key === 'k' || e.key === 'K');
      if (isModK) {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (!open) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelected((s) => Math.min(s + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelected((s) => Math.max(s - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const cmd = filtered[selected];
        if (cmd) cmd.run();
      } else if (e.key === '/' && document.activeElement !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, filtered, selected, close]);

  // Reset selection when query / filtered changes
  useEffect(() => { setSelected(0); }, [query]);

  // Auto-focus input on open
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Scroll selected into view
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-cmd-idx="${selected}"]`);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Command palette"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 200,
            background: 'rgba(0,0,0,0.55)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            display: 'grid',
            placeItems: 'start center',
            paddingTop: '14vh',
            paddingInline: 'var(--space-4)',
            cursor: 'auto',
          }}
          onClick={close}
        >
          <motion.div
            initial={{ y: -16, scale: 0.98, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: -10, scale: 0.98, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(640px, 100%)',
              maxHeight: '70vh',
              background: 'rgba(10,10,10,0.92)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 16,
              boxShadow:
                '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,179,71,0.05), 0 0 80px rgba(255,179,71,0.06)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              fontFamily: 'var(--font-body)',
            }}
          >
            {/* Search row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '14px 18px',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: '#FFB347',
                  textShadow: '0 0 8px rgba(255,179,71,0.6)',
                }}
              >
                ⌘
              </span>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search scenes · projects · ask anything"
                aria-label="Search commands"
                autoComplete="off"
                spellCheck={false}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#FFFFFF',
                  fontSize: 16,
                  fontFamily: 'var(--font-body)',
                  letterSpacing: '-0.005em',
                }}
              />
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: '#8E8B82',
                }}
              >
                esc
              </span>
            </div>

            {/* Result list */}
            <div
              ref={listRef}
              role="listbox"
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: 6,
              }}
            >
              {filtered.length === 0 ? (
                <div
                  style={{
                    padding: '48px 20px',
                    textAlign: 'center',
                    color: '#8E8B82',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                  }}
                >
                  no signal · refine query
                </div>
              ) : (
                filtered.map((cmd, idx) => (
                  <button
                    key={cmd.id}
                    type="button"
                    role="option"
                    data-cmd-idx={idx}
                    aria-selected={idx === selected}
                    onMouseEnter={() => setSelected(idx)}
                    onClick={() => cmd.run()}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      padding: '12px 14px',
                      background:
                        idx === selected
                          ? 'rgba(255,179,71,0.08)'
                          : 'transparent',
                      border: 'none',
                      borderRadius: 10,
                      cursor: 'none',
                      textAlign: 'left',
                      color: 'inherit',
                      transition: 'background 120ms ease',
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        width: 30,
                        height: 30,
                        borderRadius: 8,
                        background: `${cmd.hue ?? '#FFB347'}1a`,
                        border: `1px solid ${cmd.hue ?? '#FFB347'}40`,
                        color: cmd.hue ?? '#FFB347',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        fontWeight: 600,
                        letterSpacing: 0,
                      }}
                    >
                      {cmd.glyph ?? '◇'}
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span
                        style={{
                          display: 'block',
                          fontSize: 14,
                          fontWeight: 500,
                          color: '#FFFFFF',
                          marginBottom: 2,
                          textOverflow: 'ellipsis',
                          overflow: 'hidden',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {cmd.title}
                      </span>
                      {cmd.subtitle && (
                        <span
                          style={{
                            display: 'block',
                            fontSize: 12,
                            color: '#8E8B82',
                            textOverflow: 'ellipsis',
                            overflow: 'hidden',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {cmd.subtitle}
                        </span>
                      )}
                    </span>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 10,
                        letterSpacing: '0.14em',
                        textTransform: 'uppercase',
                        color: idx === selected ? '#FFB347' : '#3F3D36',
                        flexShrink: 0,
                      }}
                    >
                      {kindLabel(cmd.kind)} · {cmd.hint ?? '↵'}
                    </span>
                  </button>
                ))
              )}
            </div>

            {/* Footer hints */}
            <div
              style={{
                display: 'flex',
                gap: 16,
                padding: '10px 18px',
                borderTop: '1px solid rgba(255,255,255,0.05)',
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: '#8E8B82',
              }}
            >
              <span>↑↓ navigate</span>
              <span>↵ select</span>
              <span>esc close</span>
              <span style={{ marginLeft: 'auto', color: '#FFB347' }}>{filtered.length} results</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function kindLabel(k: CommandKind): string {
  switch (k) {
    case 'navigate': return 'scene';
    case 'project':  return 'project';
    case 'contact':  return 'contact';
    case 'system':   return 'system';
    case 'answer':   return 'answer';
  }
}
