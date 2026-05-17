/**
 * App.tsx — the cinematic identity engine shell.
 */

import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { LazyMotion, domAnimation } from 'framer-motion';

import { Threshold } from './scenes/Threshold';
import { ScrollSourceProvider } from './motion/scroll-source';
import { useHashRouter } from './route-map/hash-router';
import { HashNotFoundGlitch } from './route-map/HashNotFoundGlitch';
import { schedulePostFCPLoad } from './cinematic-background/post-fcp-loader';
import { ReducedMotionToggle } from './motion/reduced-motion-toggle';
import { SkipToContent } from './design-system/primitives/SkipToContent';
import { CursorAura } from './design-system/primitives/CursorAura';
import { CursorReadout } from './design-system/primitives/CursorReadout';
import { CommandPalette } from './design-system/primitives/CommandPalette';
import { CoreDump } from './design-system/primitives/CoreDump';
import { KonamiListener } from './design-system/primitives/KonamiListener';
import { WarpTransition } from './design-system/primitives/WarpTransition';
import { AudioToggle } from './design-system/primitives/AudioToggle';
import { KineticGlobal } from './design-system/primitives/KineticGlobal';
import { SceneProgress } from './design-system/primitives/SceneProgress';
import { ThemeCycle } from './design-system/primitives/ThemeCycle';
import { FooterTelemetry } from './design-system/primitives/FooterTelemetry';
import { play } from './audio/sound-engine';
import { BootSequence } from './scenes/BootSequence';
import { SystemHUD } from './scenes/SystemHUD';
import startLenis from './motion/lenis-bridge';
import {
  setMainContentRef,
  useHeadingHierarchyAssertion,
  readReducedMotion,
} from './accessibility';
import { routeMap } from './route-map/data';
import { identity } from './content-registry/data';

const TwinCompass = lazy(() => import('./scenes/TwinCompass').then((m) => ({ default: m.TwinCompass })));
const TheWork = lazy(() => import('./scenes/Work/TheWork').then((m) => ({ default: m.TheWork })));
const Ethos = lazy(() => import('./scenes/Ethos').then((m) => ({ default: m.Ethos })));
const Signal = lazy(() => import('./scenes/Signal').then((m) => ({ default: m.Signal })));
const CinematicBackground = lazy(() =>
  import('./cinematic-background/CinematicBackground').then((m) => ({ default: m.CinematicBackground })),
);

interface SceneSkeletonProps { readonly minHeight: string; readonly id?: string; }

function SceneSkeleton({ minHeight, id }: SceneSkeletonProps): ReactNode {
  return <div id={id} aria-hidden="true" style={{ minHeight }} />;
}

// === Header chrome ========================================================

const headerStyle: CSSProperties = {
  position: 'fixed',
  top: 'clamp(var(--space-3), 2vw, var(--space-5))',
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 50,
  background: 'rgba(0,0,0,0.62)',
  backdropFilter: 'blur(28px) saturate(160%)',
  WebkitBackdropFilter: 'blur(28px) saturate(160%)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 'var(--radius-pill)',
  width: 'min(94vw, 1100px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 'var(--space-4)',
  padding: 'clamp(var(--space-2), 1vw, var(--space-3)) clamp(var(--space-3), 2vw, var(--space-5))',
};

const navListStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'nowrap',
  gap: 'var(--space-1)',
  listStyle: 'none',
  padding: 0,
  margin: 0,
  overflow: 'hidden',
};

const navLinkStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 36,
  paddingBlock: 'var(--space-2)',
  paddingInline: 'var(--space-3)',
  color: 'var(--color-text-muted)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--text-eyebrow)',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  textDecoration: 'none',
  borderRadius: 'var(--radius-pill)',
  transition: 'color 240ms cubic-bezier(0.19,1,0.22,1), background 240ms cubic-bezier(0.19,1,0.22,1)',
};

const mainStyle: CSSProperties = { outline: 'none' };

const footerStyle: CSSProperties = {
  position: 'relative',
  paddingBlock: 'var(--space-9)',
  paddingInline: 'clamp(var(--space-5), 4vw, var(--space-9))',
  borderBlockStart: '1px solid rgba(255,255,255,0.06)',
  marginBlockStart: 'var(--space-9)',
  background: '#000000',
};

const footerInnerStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 'var(--space-5)',
  maxWidth: 1280,
  marginInline: 'auto',
};

const footerLegalStyle: CSSProperties = {
  fontSize: 'var(--text-small)',
  color: 'var(--color-text-subtle)',
  margin: 0,
  fontFamily: 'var(--font-mono)',
  letterSpacing: '0.04em',
};

const footerControlsStyle: CSSProperties = {
  display: 'inline-flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 'var(--space-3)',
};

// === AppShell ============================================================

function AppShell(): ReactNode {
  const { notFoundActive, dismissNotFound } = useHashRouter();
  const mainRefCallback = useCallback((el: HTMLElement | null) => setMainContentRef(el), []);

  // Track viewport width once so we can hide the floating ⌘K affordance on
  // narrow screens (touch / phone). Recomputed via matchMedia listener so
  // device-rotation is handled without a full remount.
  const [showCommandPill, setShowCommandPill] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(hover: hover) and (min-width: 720px)').matches;
  });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(hover: hover) and (min-width: 720px)');
    const apply = () => setShowCommandPill(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  useEffect(() => { schedulePostFCPLoad(); }, []);

  // Lenis smooth-scroll
  useEffect(() => {
    let teardown: (() => void) | undefined;
    let cancelled = false;
    const reduced = readReducedMotion();
    void startLenis(reduced).then((handle) => {
      if (cancelled) handle.teardown();
      else teardown = handle.teardown;
    });
    return () => {
      cancelled = true;
      teardown?.();
    };
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    let cancelled = false;
    let teardown: (() => void) | undefined;
    void import('./perf/fps-sampler').then((m) => {
      if (cancelled) return;
      teardown = m.startFpsSampler((sample) => {
        // eslint-disable-next-line no-console
        console.debug('[fps]', sample);
      });
    });
    return () => { cancelled = true; teardown?.(); };
  }, []);

  useHeadingHierarchyAssertion();

  return (
    <>
      <SkipToContent />
      <CursorAura />
      <CursorReadout />
      <KineticGlobal />
      <SceneProgress />
      <WarpTransition />

      <Suspense fallback={null}>
        <CinematicBackground />
      </Suspense>

      {/* Atmospheric overlays */}
      <div className="cinema-noise" aria-hidden="true" />
      <div className="cinema-vignette" aria-hidden="true" />

      <header role="banner" data-sticky-header style={headerStyle}>
        <a
          href="#scene-threshold"
          aria-label={`${identity.displayName} — home`}
          data-cursor-magnet
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            color: 'var(--color-text)',
            textDecoration: 'none',
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            letterSpacing: '-0.02em',
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--color-amber), var(--color-amber-deep))',
              color: '#0a0c13',
              fontSize: 11,
              fontWeight: 700,
              boxShadow: 'var(--glow-amber)',
            }}
            aria-hidden="true"
          >
            DB
          </span>
          <span style={{ fontSize: 'var(--text-small)' }}>devansh.</span>
        </a>

        <nav aria-label="Primary" style={{ minWidth: 0, overflow: 'hidden' }}>
          <ul style={navListStyle}>
            {routeMap.map((entry) => (
              <li key={entry.slug}>
                <a
                  href={`#${entry.slug}`}
                  data-cursor-magnet
                  data-nav-slug={entry.slug}
                  style={navLinkStyle}
                >
                  {entry.slug}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <a
          href="#scene-signal"
          data-cursor-magnet
          aria-label="Reach me"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            padding: 'var(--space-2) var(--space-4)',
            minHeight: 36,
            borderRadius: 'var(--radius-pill)',
            background: 'linear-gradient(135deg, var(--color-amber), var(--color-amber-deep))',
            color: '#0a0c13',
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-small)',
            fontWeight: 500,
            textDecoration: 'none',
            boxShadow: 'var(--glow-amber)',
            whiteSpace: 'nowrap',
          }}
        >
          Reach me
        </a>
      </header>

      {/* Floating ⌘K affordance — desktop only. On touch, the nav bar is the
          surface, and adding another floating pill clutters the viewport. */}
      {showCommandPill && (
        <button
          type="button"
          aria-label="Open command palette"
          onClick={() => {
            window.dispatchEvent(
              new KeyboardEvent('keydown', { key: 'k', metaKey: true, ctrlKey: true, bubbles: true }),
            );
          }}
          data-cursor-magnet
          style={{
            position: 'fixed',
            bottom: 'clamp(var(--space-3), 2vw, var(--space-5))',
            left: 'clamp(var(--space-3), 2vw, var(--space-5))',
            zIndex: 90,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            background: 'rgba(0,0,0,0.55)',
            backdropFilter: 'blur(20px) saturate(160%)',
            WebkitBackdropFilter: 'blur(20px) saturate(160%)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 999,
            color: '#DCD9D2',
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
          }}
        >
          <span style={{ color: '#FFB347', textShadow: '0 0 8px rgba(255,179,71,0.6)' }}>⌘</span>
          <span style={{ color: '#FFB347' }}>K</span>
          <span style={{ opacity: 0.4 }}>::</span>
          <span>command</span>
        </button>
      )}

      <main id="main-content" ref={mainRefCallback} tabIndex={-1} style={mainStyle}>
        <Threshold />
        <Suspense fallback={<SceneSkeleton id="scene-compass" minHeight="100dvh" />}><TwinCompass /></Suspense>
        <Suspense fallback={<SceneSkeleton id="scene-work" minHeight="300dvh" />}><TheWork /></Suspense>
        <Suspense fallback={<SceneSkeleton id="scene-ethos" minHeight="100dvh" />}><Ethos /></Suspense>
        <Suspense fallback={<SceneSkeleton id="scene-signal" minHeight="60dvh" />}><Signal /></Suspense>
      </main>

      <footer role="contentinfo" style={footerStyle}>
        <div style={footerInnerStyle}>
          <FooterTelemetry />
          <div style={footerControlsStyle}>
            <ReducedMotionToggle />
            <ThemeCycle />
            <AudioToggle />
          </div>
        </div>
        <p style={{ ...footerLegalStyle, marginTop: 'var(--space-5)', maxWidth: 1280, marginInline: 'auto' }}>
          © {new Date().getFullYear()} {identity.displayName} · all signals operational · designed and built in this browser
        </p>
      </footer>

      <HashNotFoundGlitch active={notFoundActive} onDismiss={dismissNotFound} />
    </>
  );
}

export function App(): ReactNode {
  // Theme starts dark; the inline script in index.html already set
  // <html data-theme>. We keep the user's preference unchanged here.
  const [hydrated, setHydrated] = useState(false);
  const [bootDone, setBootDone] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return Boolean(sessionStorage.getItem('pcr.boot-played'));
  });
  const [coreDump, setCoreDump] = useState(false);

  useEffect(() => { setHydrated(true); }, []);
  void hydrated;

  return (
    <LazyMotion features={domAnimation}>
      <ScrollSourceProvider>
        {!bootDone && <BootSequence onComplete={() => setBootDone(true)} onPlaySound={() => play('boot')} />}
        <AppShell />
        {bootDone && <SystemHUD />}
        <CommandPalette setCoreDump={setCoreDump} />
        <CoreDump active={coreDump} onClose={() => setCoreDump(false)} />
        <KonamiListener onActivate={() => { setCoreDump(true); play('dump'); }} />
      </ScrollSourceProvider>
    </LazyMotion>
  );
}

export default App;
