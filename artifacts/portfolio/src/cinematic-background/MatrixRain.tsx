import { useEffect, useRef, useState } from 'react';
import { readThemeMode, subscribeThemeMode, type ThemeMode } from '../accessibility/theme-cycle';
import { readReducedMotion } from '../accessibility';

const CHARS = '0101010101010101ABCDEFGHIJKLMNOPQRSTUVWXYZｦｧｨｩｪｫｬｭｮｯｰｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ';

export function MatrixRain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [active, setActive] = useState<boolean>(() => {
    return readThemeMode() === 'terminal' && !readReducedMotion();
  });

  // Subscribe to theme and reduced-motion changes
  useEffect(() => {
    const checkActive = (theme: ThemeMode) => {
      setActive(theme === 'terminal' && !readReducedMotion());
    };
    
    // Initial check
    checkActive(readThemeMode());
    
    const unsubscribe = subscribeThemeMode(checkActive);
    
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!active) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const fontSize = 16;
    let cols = Math.floor(width / fontSize);
    
    // Track drop states
    let yPositions = Array.from({ length: cols }, () => Math.random() * -600 - 50);
    let speeds = Array.from({ length: cols }, () => 1 + Math.random() * 2);
    let currentChars = Array.from({ length: cols }, () => 
      CHARS[Math.floor(Math.random() * CHARS.length)]!
    );

    // Track mouse
    let mouseX = -9999;
    let mouseY = -9999;

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };

    const handleMouseLeave = () => {
      mouseX = -9999;
      mouseY = -9999;
    };

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      const newCols = Math.floor(width / fontSize);
      
      // Keep old state or rebuild if size changed significantly
      if (newCols !== cols) {
        cols = newCols;
        yPositions = Array.from({ length: cols }, () => Math.random() * -600 - 50);
        speeds = Array.from({ length: cols }, () => 1 + Math.random() * 2);
        currentChars = Array.from({ length: cols }, () => 
          CHARS[Math.floor(Math.random() * CHARS.length)]!
        );
      }
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mouseleave', handleMouseLeave, { passive: true });
    window.addEventListener('resize', handleResize, { passive: true });

    let rafId = 0;
    let lastTime = 0;
    const fps = 40; // Throttle to 40fps for high performance and movie feel
    const interval = 1000 / fps;

    const draw = (timestamp: number) => {
      rafId = requestAnimationFrame(draw);

      if (document.hidden) return;

      const elapsed = timestamp - lastTime;
      if (elapsed < interval) return;
      lastTime = timestamp - (elapsed % interval);

      // Trailing fade effect
      ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
      ctx.fillRect(0, 0, width, height);

      ctx.font = '14px "JetBrains Mono", ui-monospace, monospace';

      for (let col = 0; col < cols; col++) {
        const x = col * fontSize;
        const y = yPositions[col]!;

        // Update drop character occasionally
        if (Math.random() < 0.03) {
          currentChars[col] = CHARS[Math.floor(Math.random() * CHARS.length)]!;
        }

        // Calculate distance to mouse
        const dx = x - mouseX;
        const dy = y - mouseY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // 1. Mouse Repel Zone (100px radius)
        if (dist < 100) {
          // Simply skip rendering the character if it's too close to create a clean bubble
          yPositions[col] += speeds[col]! * 6; // accelerate past the mouse
          if (yPositions[col]! > height) {
            yPositions[col] = Math.random() * -100 - 50;
          }
          continue;
        }

        // 2. Glow Zone (100px - 160px radius)
        const isGlowing = dist >= 100 && dist < 160;

        if (isGlowing) {
          ctx.fillStyle = '#FFFFFF'; // White hot glow
          ctx.shadowColor = '#00FF41';
          ctx.shadowBlur = 12;
        } else {
          // Normal gradient colors - leading character is white, rest is green
          ctx.fillStyle = Math.random() < 0.08 ? '#FFFFFF' : '#00FF41';
          ctx.shadowBlur = 0;
        }

        ctx.fillText(currentChars[col]!, x, y);

        // Reset shadow
        if (isGlowing) {
          ctx.shadowBlur = 0;
        }

        // Update positions
        yPositions[col] += speeds[col]! * 3;

        // Reset drop to top if it goes off bottom
        if (yPositions[col]! > height) {
          yPositions[col] = Math.random() * -100 - 50;
          speeds[col] = 1 + Math.random() * 2;
        }
      }
    };

    rafId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('resize', handleResize);
    };
  }, [active]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        zIndex: -1,
        pointerEvents: 'none',
        background: 'transparent',
      }}
    />
  );
}
