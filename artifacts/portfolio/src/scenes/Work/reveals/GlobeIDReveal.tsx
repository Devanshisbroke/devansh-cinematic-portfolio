/**
 * GlobeID reveal — living identity infrastructure.
 *
 * Full-bleed canvas. A network of identity nodes (you, plus 6 platform
 * "facets": social, finance, gov, dev, creative, comms). Connection
 * pulses propagate from the central node outward on a continuous rhythm,
 * representing credential issuance + verification across the graph. The
 * whole network breathes, drifts with cursor, and renders ~120 nodes
 * with anti-aliased glow on a high-DPI canvas.
 *
 * The user reads it as: "this is not an app — this is infrastructure."
 *
 * Validates: R8.1 (centered-singular), R8.2, R8.3, R8.7, R8.8 + Property 9
 */

import { motion, useInView, AnimatePresence } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import type { Project_Record } from '../../../content-registry/types';
import { Surface } from '../../../design-system/primitives/Surface';
import { Link } from '../../../design-system/primitives/Link';
import { readReducedMotion, subscribeReducedMotion } from '../../../accessibility';
import { registerVariant } from '../../../motion/motion-create';
import { play } from '../../../audio/sound-engine';
import { RevealConviction } from '../RevealConviction';

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

// PBT-locked variant IDs
registerVariant({ id: 'globeid-glyph-draw',         keyframes: [{ transform: {}, opacity: 0, durationMs: 1200, easing: 'ease-out-soft' }] });
registerVariant({ id: 'globeid-headline-rise',      keyframes: [{ transform: { translateY: 12 }, opacity: 0, durationMs: 600, delayMs: 400, easing: 'ease-out-soft' }] });
registerVariant({ id: 'globeid-tagline-cross-fade', keyframes: [{ transform: {}, opacity: 0, durationMs: 400, delayMs: 800, easing: 'ease-out-soft' }] });
registerVariant({ id: 'globeid-cta-stage-in',       keyframes: [{ transform: {}, opacity: 0, durationMs: 400, delayMs: 1400, easing: 'ease-out-soft' }] });

// === Network model ========================================================

interface FacetCluster {
  label: string;
  caption: string;
  angle: number;        // radians around the centre
  radius: number;       // distance from centre
  hue: string;
  count: number;        // child node count
}

const FACETS: readonly FacetCluster[] = [
  { label: 'social',   caption: 'Public-facing handles, follower graphs, attribution maps.', angle: -Math.PI / 2,                     radius: 0.32, hue: '#FFB347', count: 12 },
  { label: 'finance',  caption: 'Wallets, KYC pathways, payment rails — verifiable, portable.', angle: -Math.PI / 2 + (Math.PI * 2 / 6), radius: 0.36, hue: '#6FD4FF', count: 14 },
  { label: 'identity', caption: 'Government documents, academic credentials, foundational records.', angle: -Math.PI / 2 + (Math.PI * 4 / 6), radius: 0.30, hue: '#B388FF', count: 10 },
  { label: 'creative', caption: 'Authored work, owned content, signed artefacts.', angle: -Math.PI / 2 + (Math.PI * 6 / 6), radius: 0.34, hue: '#FFB347', count: 13 },
  { label: 'dev',      caption: 'Repos, signed commits, project-level reputation.', angle: -Math.PI / 2 + (Math.PI * 8 / 6), radius: 0.38, hue: '#8EB58A', count: 11 },
  { label: 'comms',    caption: 'End-to-end channels and verified inbound surfaces.', angle: -Math.PI / 2 + (Math.PI * 10 / 6), radius: 0.32, hue: '#6FD4FF', count: 12 },
] as const;

interface Node {
  x: number;        // normalised (-1..1)
  y: number;        // normalised (-1..1)
  baseX: number;    // base position before drift
  baseY: number;
  hue: string;
  radius: number;   // px
  isHub: boolean;
  isCore: boolean;
  facetIdx: number; // -1 for core/hub
  driftPhase: number;
}

interface Edge {
  a: number;
  b: number;
  hue: string;
}

interface Pulse {
  edgeIdx: number;
  startTime: number;
  duration: number;
}

function buildNetwork(): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // 0: core (you)
  nodes.push({
    x: 0, y: 0, baseX: 0, baseY: 0,
    hue: '#FFFFFF',
    radius: 5,
    isHub: false,
    isCore: true,
    facetIdx: -1,
    driftPhase: 0,
  });

  // 1..6: facet hubs
  FACETS.forEach((f, fi) => {
    const x = Math.cos(f.angle) * f.radius;
    const y = Math.sin(f.angle) * f.radius;
    nodes.push({
      x, y, baseX: x, baseY: y,
      hue: f.hue,
      radius: 3.2,
      isHub: true,
      isCore: false,
      facetIdx: fi,
      driftPhase: Math.random() * Math.PI * 2,
    });
    // edge: core → hub
    edges.push({ a: 0, b: nodes.length - 1, hue: f.hue });
  });

  // children — distributed in arc around hub
  FACETS.forEach((f, fi) => {
    const hubIdx = 1 + fi;
    const hub = nodes[hubIdx]!;
    for (let i = 0; i < f.count; i++) {
      const childAngle = f.angle + (i / f.count - 0.5) * 1.0;
      const childRadius = f.radius + 0.12 + Math.random() * 0.18;
      const x = Math.cos(childAngle) * childRadius + (Math.random() - 0.5) * 0.05;
      const y = Math.sin(childAngle) * childRadius + (Math.random() - 0.5) * 0.05;
      nodes.push({
        x, y, baseX: x, baseY: y,
        hue: f.hue,
        radius: 1.4 + Math.random() * 0.6,
        isHub: false,
        isCore: false,
        facetIdx: fi,
        driftPhase: Math.random() * Math.PI * 2,
      });
      edges.push({ a: hubIdx, b: nodes.length - 1, hue: f.hue });
    }
  });

  // Cross-facet bridges (interoperability)
  for (let fi = 0; fi < FACETS.length; fi++) {
    const next = (fi + 1) % FACETS.length;
    edges.push({ a: 1 + fi, b: 1 + next, hue: '#FFB347' });
  }

  return { nodes, edges };
}

// === Component ============================================================

export function GlobeIDReveal({ project }: { project: Project_Record }) {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: false, amount: 0.15 });
  const [reduced, setReduced] = useState<boolean>(() =>
    typeof window === 'undefined' ? false : readReducedMotion(),
  );
  useEffect(() => subscribeReducedMotion(setReduced), []);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [activeFacet, setActiveFacet] = useState<number | null>(null);
  const activeFacetRef = useRef<number | null>(null);
  useEffect(() => { activeFacetRef.current = activeFacet; }, [activeFacet]);

  // ----- Canvas render loop ----------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    const section = ref.current;
    if (!canvas || !section) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const network = buildNetwork();
    const { nodes, edges } = network;

    // Pulses: pre-seeded one per edge from core, others spawn over time
    const pulses: Pulse[] = [];
    const seedCoreEdges = () => {
      for (let i = 0; i < edges.length; i++) {
        if (edges[i]!.a === 0 || edges[i]!.b === 0) {
          pulses.push({
            edgeIdx: i,
            startTime: performance.now() + Math.random() * 1500,
            duration: 1800 + Math.random() * 1200,
          });
        }
      }
    };
    seedCoreEdges();

    let mouseX = 0;
    let mouseY = 0;
    let targetMouseX = 0;
    let targetMouseY = 0;
    let hovering = false;

    const onMove = (e: PointerEvent) => {
      const r = section.getBoundingClientRect();
      targetMouseX = ((e.clientX - r.left) / r.width - 0.5) * 2;
      targetMouseY = ((e.clientY - r.top) / r.height - 0.5) * 2;

      // Hub hit-test (in canvas px space)
      const cx = section.clientWidth / 2;
      const cy = section.clientHeight / 2;
      const scale = Math.min(section.clientWidth, section.clientHeight) * 0.42;
      const px = e.clientX - r.left;
      const py = e.clientY - r.top;
      let hitHub = -1;
      for (let i = 1; i <= FACETS.length; i++) {
        const n = nodes[i];
        if (!n) continue;
        const nx = cx + n.x * scale;
        const ny = cy + n.y * scale;
        const d2 = (px - nx) ** 2 + (py - ny) ** 2;
        if (d2 < 24 * 24) {
          hitHub = i - 1;
          break;
        }
      }
      hovering = hitHub >= 0;
      section.style.cursor = hovering ? 'pointer' : '';
    };
    const onClick = (e: MouseEvent) => {
      const r = section.getBoundingClientRect();
      const cx = section.clientWidth / 2;
      const cy = section.clientHeight / 2;
      const scale = Math.min(section.clientWidth, section.clientHeight) * 0.42;
      const px = e.clientX - r.left;
      const py = e.clientY - r.top;
      for (let i = 1; i <= FACETS.length; i++) {
        const n = nodes[i];
        if (!n) continue;
        const nx = cx + n.x * scale;
        const ny = cy + n.y * scale;
        const d2 = (px - nx) ** 2 + (py - ny) ** 2;
        if (d2 < 24 * 24) {
          const fi = i - 1;
          // Burst: fire pulses from hub down every child edge
          const now = performance.now();
          for (let ei = 0; ei < edges.length; ei++) {
            if (edges[ei]!.a === i) {
              pulses.push({
                edgeIdx: ei,
                startTime: now + Math.random() * 100,
                duration: 700 + Math.random() * 400,
              });
            }
          }
          // Toggle the active facet
          setActiveFacet((prev) => (prev === fi ? null : fi));
          play('burst');
          return;
        }
      }
      // Click on core or empty space deactivates
      setActiveFacet(null);
    };
    section.addEventListener('pointermove', onMove);
    section.addEventListener('click', onClick);
    section.addEventListener('pointerleave', () => {
      targetMouseX = 0;
      targetMouseY = 0;
      hovering = false;
      section.style.cursor = '';
    });

    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let cssW = section.clientWidth;
    let cssH = section.clientHeight;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      cssW = section.clientWidth;
      cssH = section.clientHeight;
      canvas.width = cssW * dpr;
      canvas.height = cssH * dpr;
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(section);

    let raf = 0;
    let stopped = false;

    const tick = (now: number) => {
      if (stopped) return;

      // Smooth mouse
      mouseX += (targetMouseX - mouseX) * 0.06;
      mouseY += (targetMouseY - mouseY) * 0.06;

      // Reset
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);

      const cx = cssW / 2;
      const cy = cssH / 2;
      // Scale: fit network in 90% of the smaller dimension
      const scale = Math.min(cssW, cssH) * 0.42;

      // Update node drift
      const t = now / 1000;
      for (const n of nodes) {
        if (n.isCore) {
          n.x = n.baseX;
          n.y = n.baseY;
          continue;
        }
        const drift = reduced ? 0 : 0.012 * Math.sin(t * 0.5 + n.driftPhase);
        const driftY = reduced ? 0 : 0.012 * Math.cos(t * 0.5 + n.driftPhase * 1.3);
        // Mouse repulsion (very subtle)
        const dx = n.baseX - mouseX * 0.2;
        const dy = n.baseY - mouseY * 0.2;
        const distSq = dx * dx + dy * dy;
        const push = 0.04 / (distSq + 0.5);
        n.x = n.baseX + dx * push + drift;
        n.y = n.baseY + dy * push + driftY;
      }

      // Draw edges (faint)
      ctx.lineWidth = 0.6;
      for (const e of edges) {
        const a = nodes[e.a]!;
        const b = nodes[e.b]!;
        const ax = cx + a.x * scale;
        const ay = cy + a.y * scale;
        const bx = cx + b.x * scale;
        const by = cy + b.y * scale;
        ctx.strokeStyle = `${e.hue}22`;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.stroke();
      }

      // Spawn new pulses from core periodically
      if (!reduced && Math.random() < 0.04) {
        const candidates: number[] = [];
        for (let i = 0; i < edges.length; i++) {
          if (edges[i]!.a === 0) candidates.push(i);
        }
        if (candidates.length > 0) {
          const ei = candidates[Math.floor(Math.random() * candidates.length)]!;
          pulses.push({
            edgeIdx: ei,
            startTime: now,
            duration: 1400 + Math.random() * 800,
          });
        }
      }

      // Draw + advance pulses
      for (let i = pulses.length - 1; i >= 0; i--) {
        const p = pulses[i]!;
        if (now < p.startTime) continue;
        const progress = (now - p.startTime) / p.duration;
        if (progress >= 1) {
          // Pulse reaches hub: cascade to children
          const hubIdx = edges[p.edgeIdx]!.b;
          const hubNode = nodes[hubIdx];
          if (hubNode && hubNode.isHub && !reduced) {
            for (let ei = 0; ei < edges.length; ei++) {
              if (edges[ei]!.a === hubIdx && Math.random() < 0.4) {
                pulses.push({
                  edgeIdx: ei,
                  startTime: now + Math.random() * 200,
                  duration: 800 + Math.random() * 400,
                });
              }
            }
          }
          pulses.splice(i, 1);
          continue;
        }

        const e = edges[p.edgeIdx]!;
        const a = nodes[e.a]!;
        const b = nodes[e.b]!;
        const ax = cx + a.x * scale;
        const ay = cy + a.y * scale;
        const bx = cx + b.x * scale;
        const by = cy + b.y * scale;

        // Pulse trail: leading dot + fading tail
        const px = ax + (bx - ax) * progress;
        const py = ay + (by - ay) * progress;

        // Tail line
        const tailLen = Math.max(0, progress - 0.25);
        const tx = ax + (bx - ax) * tailLen;
        const ty = ay + (by - ay) * tailLen;
        const grad = ctx.createLinearGradient(tx, ty, px, py);
        grad.addColorStop(0, `${e.hue}00`);
        grad.addColorStop(1, e.hue);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(px, py);
        ctx.stroke();

        // Leading dot
        ctx.shadowBlur = 12;
        ctx.shadowColor = e.hue;
        ctx.fillStyle = e.hue;
        ctx.beginPath();
        ctx.arc(px, py, 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // Draw nodes (over edges + pulses)
      const af = activeFacetRef.current;
      for (let ni = 0; ni < nodes.length; ni++) {
        const n = nodes[ni]!;
        const x = cx + n.x * scale;
        const y = cy + n.y * scale;
        const isHubMatch = n.isHub && af !== null && n.facetIdx === af;
        const isChildMatch = !n.isHub && !n.isCore && af !== null && n.facetIdx === af;
        const dim = af !== null && !isHubMatch && !isChildMatch && !n.isCore;
        const r = isHubMatch ? n.radius * 1.6 : n.radius;
        const alphaMul = dim ? 0.25 : 1;

        // Outer glow
        const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 5);
        const a1 = Math.round(0x80 * alphaMul).toString(16).padStart(2, '0');
        glow.addColorStop(0, `${n.hue}${a1}`);
        glow.addColorStop(1, `${n.hue}00`);
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y, r * 5, 0, Math.PI * 2);
        ctx.fill();

        // Core
        ctx.globalAlpha = alphaMul;
        ctx.fillStyle = n.hue;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;

        // Hub: pulsing outer ring when active
        if (n.isHub && (isHubMatch || (af === null && !reduced))) {
          const ringR = r + 6 + Math.sin(t * 1.6 + n.driftPhase) * 2;
          ctx.strokeStyle = isHubMatch ? n.hue : `${n.hue}AA`;
          ctx.lineWidth = isHubMatch ? 1.6 : 0.8;
          ctx.beginPath();
          ctx.arc(x, y, ringR, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Core: pulsing ring
        if (n.isCore && !reduced) {
          const ringR = r + 4 + Math.sin(t * 1.5) * 2;
          ctx.strokeStyle = `${n.hue}AA`;
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.arc(x, y, ringR, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Hub label
        if (n.isHub) {
          const label = FACETS[n.facetIdx]!.label;
          ctx.font = isHubMatch
            ? '600 11px "JetBrains Mono", monospace'
            : '9px "JetBrains Mono", monospace';
          ctx.fillStyle = isHubMatch ? n.hue : '#8E8B82';
          ctx.textAlign = 'center';
          ctx.fillText(label.toUpperCase(), x, y - r - 10);
        }
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      section.removeEventListener('pointermove', onMove);
      section.removeEventListener('click', onClick);
    };
  }, [reduced]);

  return (
    <Surface
      as="section"
      ref={ref}
      id={`scene-work-${project.id}`}
      aria-labelledby={`reveal-${project.id}-h3`}
      tone="base"
      data-reveal-layout="centered-singular"
      data-warp-trigger="globeid"
      style={{
        position: 'relative',
        minHeight: '120dvh',
        paddingBlock: 'clamp(var(--space-8), 8vw, var(--space-10))',
        paddingInline: 'clamp(var(--space-5), 4vw, var(--space-9))',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        backgroundColor: 'transparent',
      }}
    >
      {/* Identity-graph canvas — fills the entire section */}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="glitch-hover"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'auto',
        }}
      />

      {/* Foreground type — overlaid on the network */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          maxWidth: '64ch',
          width: '100%',
          textAlign: 'center',
          pointerEvents: 'none',
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : undefined}
          transition={{ duration: reduced ? 0.12 : 0.6, delay: reduced ? 0 : 0.2, ease: EASE }}
          className="eyebrow"
          style={{ justifyContent: 'center', marginBottom: 'var(--space-5)' }}
        >
          01 · GlobeID · Identity infrastructure
        </motion.div>

        <motion.h3
          id={`reveal-${project.id}-h3`}
          initial={{ y: reduced ? 0 : 12, opacity: 0 }}
          animate={inView ? { y: 0, opacity: 1 } : undefined}
          transition={{ duration: reduced ? 0.12 : 0.6, delay: reduced ? 0 : 0.4, ease: EASE }}
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(2.5rem, 1rem + 7vw, 6rem)',
            lineHeight: 1.0,
            letterSpacing: '-0.04em',
            fontWeight: 600,
            margin: 0,
            color: '#FFFFFF',
            textShadow: '0 0 2px rgba(255,255,255,0.6), 0 0 32px rgba(255,179,71,0.3)',
          }}
        >
          {project.name}
        </motion.h3>

        <motion.p
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 0.9 } : undefined}
          transition={{ duration: reduced ? 0.12 : 0.4, delay: reduced ? 0 : 0.8, ease: EASE }}
          style={{
            margin: 'clamp(var(--space-3), 2vw, var(--space-5)) 0 0',
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(1.25rem, 0.8rem + 1.6vw, 1.75rem)',
            lineHeight: 1.3,
            fontStyle: 'italic',
            color: '#DCD9D2',
            maxWidth: '32ch',
            marginInline: 'auto',
          }}
        >
          {project.tagline}
        </motion.p>

        <motion.p
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : undefined}
          transition={{ duration: reduced ? 0.12 : 0.6, delay: reduced ? 0 : 1.0, ease: EASE }}
          style={{
            margin: 'clamp(var(--space-5), 3vw, var(--space-7)) auto 0',
            fontSize: 'var(--text-body)',
            lineHeight: 'var(--leading-body)',
            color: '#DCD9D2',
            maxWidth: '52ch',
            background: 'rgba(0,0,0,0.55)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            padding: 'var(--space-4) var(--space-5)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid rgba(255,179,71,0.15)',
          }}
        >
          {project.summary}
        </motion.p>

        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : undefined}
          transition={{ duration: reduced ? 0.12 : 0.5, delay: reduced ? 0 : 1.2 }}
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--space-4)',
            justifyContent: 'center',
            marginTop: 'var(--space-5)',
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-caption)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: '#8E8B82',
          }}
        >
          <span>{project.role}</span>
          <span>·</span>
          <span>{typeof project.year === 'number' ? project.year : `${project.year[0]}–${project.year[1]}`}</span>
          <span>·</span>
          <span style={{ color: '#FFB347' }}>{project.status}</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : undefined}
          transition={{ duration: reduced ? 0.12 : 0.4, delay: reduced ? 0 : 1.4, ease: EASE }}
          style={{ marginTop: 'clamp(var(--space-7), 4vw, var(--space-8))', pointerEvents: 'auto' }}
        >
          <Link
            href={project.primaryLink.url}
            external
            aria-label={`${project.primaryLink.label}: ${project.name}`}
            data-cursor-magnet
            className="cta-primary"
          >
            {project.primaryLink.label}
          </Link>
        </motion.div>

        {/* Active-facet caption — appears when a hub is clicked */}
        <AnimatePresence>
          {activeFacet !== null && FACETS[activeFacet] && (
            <motion.div
              key={activeFacet}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.35, ease: EASE }}
              style={{
                marginTop: 'var(--space-5)',
                padding: 'var(--space-4) var(--space-5)',
                background: 'rgba(0,0,0,0.7)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: `1px solid ${FACETS[activeFacet].hue}40`,
                borderRadius: 'var(--radius-md)',
                maxWidth: '40ch',
                marginInline: 'auto',
                pointerEvents: 'none',
                boxShadow: `0 0 32px ${FACETS[activeFacet].hue}30`,
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--text-caption)',
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: FACETS[activeFacet].hue,
                  marginBottom: 6,
                }}
              >
                facet · {FACETS[activeFacet].label}
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontStyle: 'italic',
                  fontSize: 'var(--text-body)',
                  lineHeight: 1.4,
                  color: '#FFFFFF',
                }}
              >
                {FACETS[activeFacet].caption}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Interactive hint */}
        {activeFacet === null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 0.5 } : undefined}
            transition={{ duration: 0.6, delay: 1.8 }}
            style={{
              marginTop: 'var(--space-5)',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: '#8E8B82',
            }}
          >
            ◇ click any facet to inspect
          </motion.div>
        )}

        {/* Conviction closing beat — problem framing + the human line */}
        <div style={{ pointerEvents: 'auto' }}>
          <RevealConviction project={project} accent="#FFB347" align="center" maxWidthCh={52} />
        </div>
      </div>
    </Surface>
  );
}
