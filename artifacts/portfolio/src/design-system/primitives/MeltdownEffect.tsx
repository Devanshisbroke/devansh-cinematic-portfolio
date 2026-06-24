import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { play } from '../../audio/sound-engine';

interface Particle {
  char: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  g: number;
  color: string;
  font: string;
}

export function MeltdownEffect({
  active,
  onClose,
}: {
  active: boolean;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    if (!active) {
      setHasStarted(false);
      return;
    }

    setHasStarted(true);
    play('meltdown');

    // Add keydown listener to exit early
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        exit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    // List of original elements we hid, so we can restore them later
    const hiddenElements: { el: HTMLElement; originalVisibility: string }[] = [];

    // Find all visible text-bearing elements
    const elementsToMelt = Array.from(
      document.querySelectorAll<HTMLElement>(
        'h1, h2, h3, p, a, span, button, li, code, pre'
      )
    ).filter((el) => {
      // Ignore header/nav/overlays/telemetry/cursors/palettes
      const isHeader = el.closest('header') !== null;
      const isNav = el.closest('nav') !== null;
      const isPortal = el.closest('[role="dialog"]') !== null || el.closest('#command-palette') !== null;
      const isHUD = el.closest('[data-core-dump="on"]') !== null || el.closest('.footer-telemetry') !== null;
      if (isHeader || isNav || isPortal || isHUD) return false;

      const r = el.getBoundingClientRect();
      const inViewport =
        r.bottom > 0 &&
        r.top < window.innerHeight &&
        r.right > 0 &&
        r.left < window.innerWidth;
      
      const isVisible = r.width > 0 && r.height > 0 && getComputedStyle(el).display !== 'none';
      return inViewport && isVisible;
    });

    const particles: Particle[] = [];

    // For each element, split its text nodes to measure coordinates
    elementsToMelt.forEach((el) => {
      // Only process elements that contain direct visible text nodes
      let hasText = false;
      for (let i = 0; i < el.childNodes.length; i++) {
        if (el.childNodes[i]?.nodeType === Node.TEXT_NODE && el.childNodes[i]?.nodeValue?.trim()) {
          hasText = true;
          break;
        }
      }
      if (!hasText) return;

      const computedStyle = getComputedStyle(el);
      const color = computedStyle.color || '#00FF41';
      const font = `${computedStyle.fontWeight} ${computedStyle.fontSize} ${computedStyle.fontFamily}`;

      const originalHTML = el.innerHTML;
      const text = el.textContent || '';
      
      // Temporary split in order to measure coordinate of each char
      // Wrap characters in inline-block spans
      const spansHTML = Array.from(text)
        .map((char) => {
          if (char === ' ' || char === '\n' || char === '\t') {
            return char; // leave whitespace as is
          }
          return `<span class="melt-char-temp" style="display: inline-block; white-space: pre;">${char}</span>`;
        })
        .join('');

      el.innerHTML = spansHTML;

      // Measure spans
      const tempSpans = el.querySelectorAll<HTMLElement>('.melt-char-temp');
      tempSpans.forEach((span) => {
        const r = span.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          particles.push({
            char: span.textContent || '',
            x: r.left,
            y: r.top + r.height, // draw text aligned to baseline-ish
            vx: (Math.random() - 0.5) * 2,
            vy: -Math.random() * 2, // slight initial upward bounce
            g: 0.15 + Math.random() * 0.25,
            color,
            font,
          });
        }
      });

      // Restore original HTML
      el.innerHTML = originalHTML;

      // Hide element visually
      hiddenElements.push({
        el,
        originalVisibility: el.style.visibility,
      });
      el.style.visibility = 'hidden';
    });

    // Start canvas animation
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    let rafId = 0;

    const tick = () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.18)'; // slight trail fade
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      let allResting = true;

      particles.forEach((p) => {
        // Apply gravity
        p.vy += p.g;
        p.y += p.vy;
        p.x += p.vx;

        // Ground collision
        const floor = canvas.height - 24;
        if (p.y > floor) {
          p.y = floor;
          p.vy = -p.vy * 0.15; // bounce dampening
          p.vx *= 0.6; // friction
          
          if (Math.abs(p.vy) < 0.2) {
            p.vy = 0;
          }
        }

        if (Math.abs(p.vy) > 0.05 || p.y < floor) {
          allResting = false;
        }

        // Draw character
        ctx.font = p.font;
        ctx.fillStyle = p.color;
        ctx.fillText(p.char, p.x, p.y);
      });

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    const exit = () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('keydown', handleKeyDown);
      
      // Restore elements
      hiddenElements.forEach(({ el, originalVisibility }) => {
        el.style.visibility = originalVisibility;
      });

      play('boot'); // trigger reboot chime
      onClose();
    };

    const handleCanvasClick = () => {
      exit();
    };
    canvas.addEventListener('click', handleCanvasClick);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('keydown', handleKeyDown);
      if (canvas) {
        canvas.removeEventListener('click', handleCanvasClick);
      }
      // Restore if somehow unmounted prematurely
      hiddenElements.forEach(({ el, originalVisibility }) => {
        el.style.visibility = originalVisibility;
      });
    };
  }, [active, onClose]);

  if (!active || typeof document === 'undefined') return null;

  return createPortal(
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999, // sit on top of everything
        cursor: 'pointer',
        background: 'black',
      }}
    />,
    document.body
  );
}
