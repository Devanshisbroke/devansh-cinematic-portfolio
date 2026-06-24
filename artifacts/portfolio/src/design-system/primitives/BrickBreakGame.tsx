import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { isAudioEnabled } from '../../audio/sound-engine';

interface GameBrick {
  id: number;
  el: HTMLElement;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  broken: boolean;
}

export function BrickBreakGame({
  active,
  onClose,
}: {
  active: boolean;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Sound synthesis utility
  const playSound = (type: 'paddle' | 'brick' | 'fail' | 'win') => {
    if (!isAudioEnabled() || typeof window === 'undefined') return;
    try {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      const ctx = audioCtxRef.current || new Ctor();
      audioCtxRef.current = ctx;

      const t0 = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      if (type === 'paddle') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(320, t0);
        osc.frequency.exponentialRampToValueAtTime(440, t0 + 0.08);
        gain.gain.setValueAtTime(0.06, t0);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.08);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(t0 + 0.1);
      } else if (type === 'brick') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(600, t0);
        osc.frequency.setValueAtTime(900, t0 + 0.03);
        gain.gain.setValueAtTime(0.04, t0);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.06);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(t0 + 0.08);
      } else if (type === 'fail') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, t0);
        osc.frequency.exponentialRampToValueAtTime(50, t0 + 0.35);
        gain.gain.setValueAtTime(0.12, t0);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(t0 + 0.4);
      } else if (type === 'win') {
        // Play victory arpeggio
        [523.25, 659.25, 783.99, 1046.5].forEach((f, idx) => {
          const oscArp = ctx.createOscillator();
          const gainArp = ctx.createGain();
          oscArp.type = 'sine';
          oscArp.frequency.setValueAtTime(f, t0 + idx * 0.1);
          gainArp.gain.setValueAtTime(0.08, t0 + idx * 0.1);
          gainArp.gain.exponentialRampToValueAtTime(0.0001, t0 + idx * 0.1 + 0.25);
          oscArp.connect(gainArp);
          gainArp.connect(ctx.destination);
          oscArp.start(t0 + idx * 0.1);
          oscArp.stop(t0 + idx * 0.1 + 0.3);
        });
      }
    } catch {
      // noop
    }
  };

  useEffect(() => {
    if (!active) return;

    // Scan the viewport for blocks to target
    const targetElements = Array.from(
      document.querySelectorAll<HTMLElement>(
        'h1, h2, h3, p, a, button, img, li, [data-kinetic-jelly]'
      )
    ).filter((el) => {
      // Avoid parsing header, nav, modals, or game elements
      const isHeader = el.closest('header') !== null;
      const isNav = el.closest('nav') !== null;
      const isPortal = el.closest('[role="dialog"]') !== null || el.closest('#command-palette') !== null;
      const isSelf = el.closest('[data-breakout-container]') !== null;
      if (isHeader || isNav || isPortal || isSelf) return false;

      const r = el.getBoundingClientRect();
      const inViewport =
        r.bottom > 0 &&
        r.top < window.innerHeight &&
        r.right > 0 &&
        r.left < window.innerWidth;
      
      const isVisible = r.width > 0 && r.height > 0;
      return inViewport && isVisible;
    });

    // Save elements and create block geometries
    const bricks: GameBrick[] = targetElements.map((el, index) => {
      const r = el.getBoundingClientRect();
      const computedStyle = getComputedStyle(el);
      const color = computedStyle.color || '#FFFF54';
      return {
        id: index,
        el,
        x: r.left,
        y: r.top,
        w: r.width,
        h: r.height,
        color,
        broken: false,
      };
    });

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = (canvas.width = window.innerWidth);
    const height = (canvas.height = window.innerHeight);

    // Paddle state
    let paddleX = width / 2 - 50;
    const paddleY = height - 40;
    const paddleWidth = 110;
    const paddleHeight = 12;

    // Ball state
    let ballX = width / 2;
    let ballY = height / 2;
    let ballVx = (Math.random() - 0.5) * 4;
    let ballVy = -5;
    const ballRadius = 7;

    const handleMouseMove = (e: MouseEvent) => {
      paddleX = e.clientX - paddleWidth / 2;
      // Clamp to bounds
      if (paddleX < 0) paddleX = 0;
      if (paddleX > width - paddleWidth) paddleX = width - paddleWidth;
    };
    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        exit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    let rafId = 0;
    let isGameOver = false;

    const tick = () => {
      if (isGameOver) return;

      // Draw game frame background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)'; // slight trail
      ctx.fillRect(0, 0, width, height);

      // Update ball coordinates
      ballX += ballVx;
      ballY += ballVy;

      // Wall bounce
      if (ballX - ballRadius < 0) {
        ballX = ballRadius;
        ballVx = -ballVx;
        playSound('paddle');
      }
      if (ballX + ballRadius > width) {
        ballX = width - ballRadius;
        ballVx = -ballVx;
        playSound('paddle');
      }
      if (ballY - ballRadius < 0) {
        ballY = ballRadius;
        ballVy = -ballVy;
        playSound('paddle');
      }

      // Ball falls off bottom - fails
      if (ballY + ballRadius > height) {
        playSound('fail');
        // Reset ball to center
        ballX = width / 2;
        ballY = height / 2;
        ballVx = (Math.random() - 0.5) * 4;
        ballVy = -5;
      }

      // Paddle hit
      if (
        ballY + ballRadius > paddleY &&
        ballY - ballRadius < paddleY + paddleHeight &&
        ballX > paddleX &&
        ballX < paddleX + paddleWidth
      ) {
        ballVy = -Math.abs(ballVy);
        // Change bounce angle depending on hit location
        const hitPos = (ballX - (paddleX + paddleWidth / 2)) / (paddleWidth / 2);
        ballVx = hitPos * 6;
        playSound('paddle');
      }

      // Check brick collisions
      let remainingBricks = 0;
      bricks.forEach((b) => {
        if (b.broken) return;
        remainingBricks++;

        // AABB AABB collision test
        const overlapX = ballX + ballRadius > b.x && ballX - ballRadius < b.x + b.w;
        const overlapY = ballY + ballRadius > b.y && ballY - ballRadius < b.y + b.h;

        if (overlapX && overlapY) {
          b.broken = true;
          playSound('brick');

          // Hide actual element physically on website!
          b.el.style.visibility = 'hidden';

          // Simple bounce logic: resolve collision direction
          const prevBallX = ballX - ballVx;
          const prevBallY = ballY - ballVy;

          if (prevBallX + ballRadius <= b.x || prevBallX - ballRadius >= b.x + b.w) {
            ballVx = -ballVx;
          } else {
            ballVy = -ballVy;
          }
        }
      });

      // Win trigger
      if (remainingBricks === 0 && bricks.length > 0) {
        isGameOver = true;
        playSound('win');
        setTimeout(() => {
          exit();
        }, 1200);
        return;
      }

      // Render Bricks
      bricks.forEach((b) => {
        if (b.broken) return;
        ctx.fillStyle = b.color;
        ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(b.x, b.y, b.w, b.h);
      });

      // Render Paddle
      ctx.fillStyle = '#00FF41';
      ctx.fillRect(paddleX, paddleY, paddleWidth, paddleHeight);
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.strokeRect(paddleX, paddleY, paddleWidth, paddleHeight);

      // Render Ball
      ctx.beginPath();
      ctx.arc(ballX, ballY, ballRadius, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.shadowColor = '#00FF41';
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Draw instructions
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.fillText(`BRICKS REMAINING: ${remainingBricks}  ·  ESC TO EXIT`, 24, 32);

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    const exit = () => {
      isGameOver = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('keydown', handleKeyDown);
      
      // Restore all hidden elements on site
      bricks.forEach((b) => {
        b.el.style.visibility = '';
      });

      onClose();
    };

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('keydown', handleKeyDown);
      // Ensure all elements restored in case of sudden teardown
      bricks.forEach((b) => {
        b.el.style.visibility = '';
      });
      if (audioCtxRef.current) {
        void audioCtxRef.current.close();
      }
    };
  }, [active, onClose]);

  if (!active || typeof document === 'undefined') return null;

  return createPortal(
    <div
      data-breakout-container
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.4)',
        zIndex: 9999999, // sit on top of everything
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: '100vw',
          height: '100vh',
          display: 'block',
          cursor: 'none',
        }}
      />
    </div>,
    document.body
  );
}
