import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { isAudioEnabled } from '../../audio/sound-engine';

interface PhysicalBody {
  id: number;
  el: HTMLElement; // original element
  cloneEl: HTMLDivElement | null; // cloned DOM element for physics render
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  mass: number;
  isDragging: boolean;
}

export function PhysicsPlayground({
  active,
  onClose,
}: {
  active: boolean;
  onClose: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const mouseRef = useRef({ x: 0, y: 0, lastX: 0, lastY: 0, down: false });
  const [bodies, setBodies] = useState<PhysicalBody[]>([]);

  // Sound synthesis utility for physics collisions
  const playHitSound = (volume: number) => {
    if (!isAudioEnabled() || typeof window === 'undefined') return;
    try {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      const ctx = audioCtxRef.current || new Ctor();
      audioCtxRef.current = ctx;

      const t0 = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(150 + Math.random() * 80, t0);
      osc.frequency.exponentialRampToValueAtTime(60, t0 + 0.05);

      gain.gain.setValueAtTime(Math.min(0.08, volume * 0.04), t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.05);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(t0 + 0.06);
    } catch {
      // noop
    }
  };

  useEffect(() => {
    if (!active) {
      setBodies([]);
      return;
    }

    // 1. Gather text nodes and layout blocks
    const targetElements = Array.from(
      document.querySelectorAll<HTMLElement>(
        'h1, h2, h3, p, a, button, img, li, [data-kinetic]'
      )
    ).filter((el) => {
      const isHeader = el.closest('header') !== null;
      const isNav = el.closest('nav') !== null;
      const isPortal = el.closest('[role="dialog"]') !== null || el.closest('#command-palette') !== null;
      const isHUD = el.closest('[data-breakout-container]') !== null || el.closest('.footer-telemetry') !== null;
      if (isHeader || isNav || isPortal || isHUD) return false;

      const r = el.getBoundingClientRect();
      const inViewport =
        r.bottom > 0 &&
        r.top < window.innerHeight &&
        r.right > 0 &&
        r.left < window.innerWidth;
      
      const isVisible = r.width > 0 && r.height > 0;
      return inViewport && isVisible;
    });

    const activeBodies: PhysicalBody[] = targetElements.map((el, index) => {
      const r = el.getBoundingClientRect();
      
      // Hide original element
      el.style.visibility = 'hidden';
      el.style.pointerEvents = 'none';

      // Estimate mass based on area
      const area = r.width * r.height;
      const mass = Math.max(0.5, Math.min(5, area / 20000));

      return {
        id: index,
        el,
        cloneEl: null,
        x: r.left,
        y: r.top,
        w: r.width,
        h: r.height,
        vx: (Math.random() - 0.5) * 5,
        vy: -Math.random() * 8, // throw up slightly
        mass,
        isDragging: false,
      };
    });

    setBodies(activeBodies);

    // Mouse velocity tracker
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.lastX = mouseRef.current.x;
      mouseRef.current.lastY = mouseRef.current.y;
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
    };

    const handleMouseUp = () => {
      mouseRef.current.down = false;
      activeBodies.forEach((b) => {
        if (b.isDragging) {
          b.isDragging = false;
          // Apply cursor throw velocity
          b.vx = mouseRef.current.x - mouseRef.current.lastX;
          b.vy = mouseRef.current.y - mouseRef.current.lastY;
        }
      });
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        exit();
      }
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mouseup', handleMouseUp, { passive: true });
    window.addEventListener('keydown', handleKeyDown);

    // Physics Engine Loop
    let rafId = 0;
    let lastTime = performance.now();
    const g = 0.38; // gravity
    const airResistance = 0.99;
    const floorFriction = 0.8;
    const restitution = 0.55; // bounce coefficient

    const tick = (now: number) => {
      const dt = Math.min(33, now - lastTime) / 16.666;
      lastTime = now;

      const vh = window.innerHeight;
      const vw = window.innerWidth;

      activeBodies.forEach((b) => {
        if (b.isDragging) {
          // Dragging overrides physics
          b.x = mouseRef.current.x - b.w / 2;
          b.y = mouseRef.current.y - b.h / 2;
          b.vx = 0;
          b.vy = 0;
        } else {
          // Apply gravity
          b.vy += g * dt;

          // Apply air resistance
          b.vx *= Math.pow(airResistance, dt);
          b.vy *= Math.pow(airResistance, dt);

          // Apply velocity
          b.x += b.vx * dt;
          b.y += b.vy * dt;

          // Viewport collision bounds
          // Bottom boundary (floor)
          if (b.y + b.h > vh - 20) {
            b.y = vh - 20 - b.h;
            if (Math.abs(b.vy) > 1.5) {
              playHitSound(Math.abs(b.vy));
            }
            b.vy = -b.vy * restitution;
            b.vx *= floorFriction;
          }

          // Top boundary (ceiling)
          if (b.y < 0) {
            b.y = 0;
            if (Math.abs(b.vy) > 1.5) {
              playHitSound(Math.abs(b.vy));
            }
            b.vy = -b.vy * restitution;
          }

          // Left boundary
          if (b.x < 0) {
            b.x = 0;
            if (Math.abs(b.vx) > 1.5) {
              playHitSound(Math.abs(b.vx));
            }
            b.vx = -b.vx * restitution;
          }

          // Right boundary
          if (b.x + b.w > vw) {
            b.x = vw - b.w;
            if (Math.abs(b.vx) > 1.5) {
              playHitSound(Math.abs(b.vx));
            }
            b.vx = -b.vx * restitution;
          }
        }

        // Render cloned visual position directly on DOM node (GPU-driven translation)
        if (b.cloneEl) {
          b.cloneEl.style.transform = `translate3d(${b.x}px, ${b.y}px, 0)`;
        }
      });

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    const exit = () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('keydown', handleKeyDown);

      // Restore original elements
      activeBodies.forEach((b) => {
        b.el.style.visibility = '';
        b.el.style.pointerEvents = '';
      });

      onClose();
    };

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('keydown', handleKeyDown);

      // Clean up body states
      activeBodies.forEach((b) => {
        b.el.style.visibility = '';
        b.el.style.pointerEvents = '';
      });

      if (audioCtxRef.current) {
        void audioCtxRef.current.close();
      }
    };
  }, [active, onClose]);

  const handleBodyMouseDown = (id: number, e: React.MouseEvent) => {
    e.preventDefault();
    mouseRef.current.down = true;
    mouseRef.current.x = e.clientX;
    mouseRef.current.y = e.clientY;
    mouseRef.current.lastX = e.clientX;
    mouseRef.current.lastY = e.clientY;

    setBodies((prev) =>
      prev.map((b) => {
        if (b.id === id) {
          b.isDragging = true;
        }
        return b;
      })
    );
  };

  if (!active || typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(4px)',
        zIndex: 999999, // below game but on top of page content
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: '#FFB347',
          backgroundColor: 'rgba(0,0,0,0.8)',
          border: '1px solid rgba(255,179,71,0.3)',
          borderRadius: 4,
          padding: '8px 12px',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          pointerEvents: 'none',
          userSelect: 'none',
          boxShadow: 'var(--glow-amber)',
        }}
      >
        PHYSICS PLAYGROUND ACTIVE · DRAG & THROW ELEMENTS · ESC TO RESTORE
      </div>

      {bodies.map((b) => (
        <div
          key={b.id}
          ref={(el) => {
            b.cloneEl = el;
          }}
          onMouseDown={(e) => handleBodyMouseDown(b.id, e)}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: b.w,
            height: b.h,
            color: '#00FF41',
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-small)',
            cursor: b.isDragging ? 'grabbing' : 'grab',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0, 255, 65, 0.08)',
            border: '1px dashed rgba(0, 255, 65, 0.3)',
            boxSizing: 'border-box',
            userSelect: 'none',
            transform: `translate3d(${b.x}px, ${b.y}px, 0)`,
            willChange: 'transform',
          }}
        >
          {b.el.textContent?.slice(0, 18) || 'element'}
        </div>
      ))}
    </div>,
    document.body
  );
}
