/**
 * EthosConstellation — Three.js floating word constellation.
 *
 * Ambient 3D layer that lives behind Ethos's prose. Words extracted from
 * the philosophy beats are placed on a Fibonacci sphere, each rendered
 * as a transparent canvas-texture sprite that always faces the camera.
 * Camera dollies + orbits gently with scroll progress through the
 * scene; mouse moves the rotation by ±5° on each axis.
 *
 * Lazy-loaded by `Ethos.tsx` only when:
 *   • !reduced-motion
 *   • cores ≥ 4 + memory ≥ 4
 *   • WebGL is available
 *
 * Otherwise Ethos shows the prose-only view as before.
 */

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { readReducedMotion } from '../accessibility';

const WORDS: readonly string[] = [
  'systems', 'product', 'AI', 'conviction', 'flow',
  'edge', 'shape', 'attention', 'leverage', 'trust',
  'identity', 'signal', 'intent', 'rhythm', 'craft',
  'model', 'agent', 'graph', 'reward', 'context',
  'belief', 'doubt', 'iteration', 'release', 'ship',
  'architect', 'compose', 'observe', 'resolve', 'commit',
  'one practice', 'the moment of use', 'feel its edges', 'before drawing',
  'the order is the bug',
] as const;

const HUES = [
  '#FFB347', '#FFD494', '#B388FF', '#6FD4FF', '#8EB58A',
];

interface WordSprite {
  mesh: THREE.Sprite;
  basePosition: THREE.Vector3;
  driftPhase: number;
  hue: string;
  scale: number;
}

function buildLabelTexture(text: string, hue: string): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 512, 128);

  // Soft outer glow
  ctx.shadowColor = hue;
  ctx.shadowBlur = 32;
  ctx.fillStyle = hue;

  ctx.font = '500 64px "Fraunces", "Iowan Old Style", Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 64);

  // Inner sharp pass (no shadow)
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(text, 256, 64);

  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.anisotropy = 4;
  return tex;
}

/**
 * Place N points on a Fibonacci-lattice sphere — uniform distribution
 * without hot-spots or seams. Used to seat the word sprites in 3D.
 */
function fibonacciSphere(count: number, radius: number): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  const phi = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / Math.max(count - 1, 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const theta = phi * i;
    const x = Math.cos(theta) * r;
    const z = Math.sin(theta) * r;
    out.push(new THREE.Vector3(x * radius, y * radius, z * radius));
  }
  return out;
}

export function EthosConstellation() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const reduced = readReducedMotion();
    sectionRef.current = container.closest<HTMLElement>('section');

    // === Renderer ========================================================
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      premultipliedAlpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(dpr);
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    // === Scene + camera ==================================================
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000000, 0.04);

    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 200);
    camera.position.set(0, 0, 18);

    // === Word sprites (Fibonacci-lattice) ================================
    const positions = fibonacciSphere(WORDS.length, 9);
    const sprites: WordSprite[] = [];

    WORDS.forEach((text, i) => {
      const hue = HUES[i % HUES.length]!;
      const tex = buildLabelTexture(text, hue);
      const material = new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(material);
      const basePos = positions[i]!.clone();
      sprite.position.copy(basePos);
      const baseScale = 1.6 + Math.random() * 0.8;
      sprite.scale.set(4 * baseScale, 1 * baseScale, 1);
      scene.add(sprite);
      sprites.push({
        mesh: sprite,
        basePosition: basePos,
        driftPhase: Math.random() * Math.PI * 2,
        hue,
        scale: baseScale,
      });
    });

    // === Pointer state ===================================================
    let pointerX = 0;
    let pointerY = 0;
    let targetX = 0;
    let targetY = 0;
    const onPointerMove = (e: PointerEvent) => {
      targetX = (e.clientX / window.innerWidth - 0.5) * 2;
      targetY = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener('pointermove', onPointerMove, { passive: true });

    // === Resize observer =================================================
    const resize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = Math.max(0.5, w / Math.max(1, h));
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    // === Visibility gating ===============================================
    let inView = true;
    let io: IntersectionObserver | null = null;
    if (sectionRef.current) {
      io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) inView = e.isIntersecting;
        },
        { threshold: 0 },
      );
      io.observe(sectionRef.current);
    }

    // === Render loop =====================================================
    let raf = 0;
    let stopped = false;
    const start = performance.now();

    const tick = () => {
      if (stopped) return;
      const now = performance.now();
      const t = (now - start) / 1000;

      if (inView && !document.hidden) {
        // Smooth pointer
        if (!reduced) {
          pointerX += (targetX - pointerX) * 0.05;
          pointerY += (targetY - pointerY) * 0.05;
        }

        // Rotate the whole constellation
        scene.rotation.y = (reduced ? 0 : t * 0.04) + pointerX * 0.18;
        scene.rotation.x = pointerY * 0.18;

        // Per-sprite drift + opacity breathing
        for (const s of sprites) {
          const phase = t * 0.35 + s.driftPhase;
          if (!reduced) {
            const offset = Math.sin(phase) * 0.18;
            s.mesh.position.copy(s.basePosition).addScalar(offset * 0.1);
            s.mesh.position.y = s.basePosition.y + Math.sin(phase) * 0.15;
          }
          const m = s.mesh.material as THREE.SpriteMaterial;
          m.opacity = 0.55 + 0.3 * (Math.sin(phase * 1.4) * 0.5 + 0.5);
        }

        // Camera dolly with scroll within the section
        const sec = sectionRef.current;
        if (sec) {
          const r = sec.getBoundingClientRect();
          const vh = window.innerHeight || 1;
          const progress = Math.max(0, Math.min(1, 1 - (r.top + r.height / 2) / vh));
          const dolly = 16 + (1 - Math.cos(progress * Math.PI)) * 6;
          camera.position.z = dolly;
        }

        renderer.render(scene, camera);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onPointerMove);
      ro.disconnect();
      if (io) io.disconnect();
      // Dispose Three.js objects
      sprites.forEach((s) => {
        const m = s.mesh.material as THREE.SpriteMaterial;
        if (m.map) m.map.dispose();
        m.dispose();
      });
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        opacity: 0.85,
      }}
    />
  );
}

export default EthosConstellation;
