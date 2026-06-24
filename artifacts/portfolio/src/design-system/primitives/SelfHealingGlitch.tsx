import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { isAudioEnabled } from '../../audio/sound-engine';

interface GlitchedElement {
  el: HTMLElement;
  originalHTML: string;
  glitchedHTML: string;
  healed: boolean;
}

export function SelfHealingGlitch({
  active,
  onClose,
}: {
  active: boolean;
  onClose: () => void;
}) {
  const [sweepY, setSweepY] = useState(-10);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);

  useEffect(() => {
    if (!active) return;

    // 1. Audio Synthesis setup for scanning hum
    if (isAudioEnabled() && typeof window !== 'undefined') {
      try {
        const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (Ctor) {
          const ctx = new Ctor();
          audioCtxRef.current = ctx;
          
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const filter = ctx.createBiquadFilter();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(80, ctx.currentTime);
          // Sweep frequency up slightly as laser moves
          osc.frequency.linearRampToValueAtTime(220, ctx.currentTime + 1.5);

          filter.type = 'bandpass';
          filter.frequency.setValueAtTime(300, ctx.currentTime);
          filter.frequency.linearRampToValueAtTime(1000, ctx.currentTime + 1.5);
          filter.Q.value = 8;

          gain.gain.setValueAtTime(0, ctx.currentTime);
          gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.1);
          gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.6);

          osc.connect(filter);
          filter.connect(gain);
          gain.connect(ctx.destination);

          osc.start();
          oscRef.current = osc;
          gainRef.current = gain;
        }
      } catch {
        // noop
      }
    }

    // 2. Scan elements and prepare glitched state
    const elementsToGlitch = Array.from(
      document.querySelectorAll<HTMLElement>(
        'h1, h2, h3, p, a, span, button, li, code, pre'
      )
    ).filter((el) => {
      const isHeader = el.closest('header') !== null;
      const isNav = el.closest('nav') !== null;
      const isPortal = el.closest('[role="dialog"]') !== null || el.closest('#command-palette') !== null;
      const isHUD = el.closest('.footer-telemetry') !== null || el.closest('.glass-card') !== null;
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

    const glitchedItems: GlitchedElement[] = [];

    elementsToGlitch.forEach((el) => {
      let hasText = false;
      for (let i = 0; i < el.childNodes.length; i++) {
        if (el.childNodes[i]?.nodeType === Node.TEXT_NODE && el.childNodes[i]?.nodeValue?.trim()) {
          hasText = true;
          break;
        }
      }
      if (!hasText) return;

      const originalHTML = el.innerHTML;
      const text = el.textContent || '';
      
      // Scramble characters to make a glitch markup
      const scrambleChars = '01#%&@?*∆∇▲▼◀▶☼☾⌨☄';
      const glitched = Array.from(originalHTML)
        .map((char) => {
          // Keep tags intact but scramble text nodes
          if (char === '<' || char === '>') return char;
          // Skip whitespace
          if (char === ' ' || char === '\n' || char === '\t') return char;
          
          if (Math.random() < 0.45) {
            return scrambleChars[Math.floor(Math.random() * scrambleChars.length)]!;
          }
          return char;
        })
        .join('');

      glitchedItems.push({
        el,
        originalHTML,
        glitchedHTML: glitched,
        healed: false,
      });

      // Induce glitch state
      el.innerHTML = glitched;
    });

    // 3. Sweep animation loop
    let rafId = 0;
    let currentY = 0;
    const speed = window.innerHeight / 75; // 75 frames total scan (approx 1.25s)

    const tick = () => {
      currentY += speed;
      setSweepY(currentY);

      glitchedItems.forEach((item) => {
        if (item.healed) return;
        const r = item.el.getBoundingClientRect();
        
        // When sweep passes the top of the element, restore it!
        if (r.top < currentY) {
          item.el.innerHTML = item.originalHTML;
          item.healed = true;
          
          // play a tiny synthesis blip for healing action
          if (audioCtxRef.current) {
            const ctx = audioCtxRef.current;
            const blip = ctx.createOscillator();
            const blipGain = ctx.createGain();
            blip.type = 'triangle';
            blip.frequency.setValueAtTime(800 + Math.random() * 400, ctx.currentTime);
            blipGain.gain.setValueAtTime(0.02, ctx.currentTime);
            blipGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.05);
            blip.connect(blipGain);
            blipGain.connect(ctx.destination);
            blip.start();
            blip.stop(ctx.currentTime + 0.06);
          }
        }
      });

      if (currentY < window.innerHeight) {
        rafId = requestAnimationFrame(tick);
      } else {
        // Complete scan
        setTimeout(() => {
          cleanup();
          onClose();
        }, 150);
      }
    };

    rafId = requestAnimationFrame(tick);

    const cleanup = () => {
      cancelAnimationFrame(rafId);
      
      // Ensure all restored
      glitchedItems.forEach((item) => {
        if (!item.healed) {
          item.el.innerHTML = item.originalHTML;
        }
      });

      // Tear down audio
      if (oscRef.current) {
        try {
          oscRef.current.stop();
          oscRef.current.disconnect();
        } catch { /* noop */ }
      }
      if (gainRef.current) {
        gainRef.current.disconnect();
      }
      if (audioCtxRef.current) {
        void audioCtxRef.current.close();
      }
    };

    return cleanup;
  }, [active, onClose]);

  if (!active || typeof document === 'undefined') return null;

  return createPortal(
    <>
      {/* Horizontal laser scanline line */}
      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          top: `${sweepY}px`,
          height: '4px',
          background: 'linear-gradient(90deg, transparent, #00FF41, #FFFFFF, #00FF41, transparent)',
          boxShadow: '0 0 10px #00FF41, 0 0 24px rgba(0, 255, 65, 0.8)',
          zIndex: 9999999, // on top of everything
          pointerEvents: 'none',
        }}
      />
      {/* Glitch CRT static tint */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          top: 0,
          height: `${sweepY}px`,
          backgroundColor: 'rgba(0, 255, 65, 0.015)',
          backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(0,255,65,0.01) 0%, transparent 100%)',
          zIndex: 9999998,
          pointerEvents: 'none',
        }}
      />
    </>,
    document.body
  );
}
