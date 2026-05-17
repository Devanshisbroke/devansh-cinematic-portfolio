import { useEffect, useRef } from 'react';
import { VERTEX_SHADER_SOURCE } from './shader.vert';
import { FRAGMENT_SHADER_SOURCE } from './shader.frag';

const AMBER:  [number, number, number] = [1.000, 0.702, 0.278]; // #FFB347
const PLASMA: [number, number, number] = [0.702, 0.533, 1.000]; // #B388FF
const SIGNAL: [number, number, number] = [0.435, 0.831, 1.000]; // #6FD4FF
const BASE:   [number, number, number] = [0.000, 0.000, 0.000]; // #000000

/**
 * WebGLLayer — owns a single GPU-accelerated <canvas> running the
 * cinematic plasma-mesh shader. Mouse-reactive, scroll-reactive, and
 * frame-budgeted (30 fps while scrolling, 60 fps idle, paused on hidden).
 *
 * R5.2 documented exception: this module attaches its own `scroll` and
 * `pointermove` listeners purely to throttle and parametrise the GPU
 * draw rate. The shared scroll source in motion/scroll-source.ts is for
 * layout-coordinated effects (parallax, sticky, hash-router); the
 * GPU-side throttle here is a self-contained concern in a lazy-loaded,
 * post-FCP module. The `no-window-scroll-listeners` ESLint rule lists
 * this file as a documented exception alongside motion/scroll-source.ts.
 */
export default function WebGLLayer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = (canvas.getContext('webgl', {
      alpha: false,
      antialias: false,
      premultipliedAlpha: false,
    }) ?? canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (!gl) return;

    const compile = (type: number, src: string): WebGLShader | null => {
      const sh = gl.createShader(type);
      if (!sh) return null;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        gl.deleteShader(sh);
        return null;
      }
      return sh;
    };

    const vs = compile(gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
    const fs = compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);
    if (!vs || !fs) return;

    const prog = gl.createProgram();
    if (!prog) return;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      gl.deleteProgram(prog);
      return;
    }
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const aPos = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uTime   = gl.getUniformLocation(prog, 'u_time');
    const uRes    = gl.getUniformLocation(prog, 'u_res');
    const uMouse  = gl.getUniformLocation(prog, 'u_mouse');
    const uScroll = gl.getUniformLocation(prog, 'u_scroll');
    const uVelocity = gl.getUniformLocation(prog, 'u_velocity');
    const uAmber  = gl.getUniformLocation(prog, 'u_amber');
    const uPlasma = gl.getUniformLocation(prog, 'u_plasma');
    const uSignal = gl.getUniformLocation(prog, 'u_signal');
    const uBase   = gl.getUniformLocation(prog, 'u_base');

    gl.uniform3fv(uAmber, AMBER);
    gl.uniform3fv(uPlasma, PLASMA);
    gl.uniform3fv(uSignal, SIGNAL);
    gl.uniform3fv(uBase, BASE);

    let resWidth = 0;
    let resHeight = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      const w = Math.floor(canvas.clientWidth * dpr);
      const h = Math.floor(canvas.clientHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
        gl.uniform2f(uRes, w, h);
        resWidth = w;
        resHeight = h;
      }
    };
    resize();

    // Smoothed mouse position
    let mouseX = 0.5;
    let mouseY = 0.5;
    let targetMouseX = 0.5;
    let targetMouseY = 0.5;
    const onPointerMove = (e: PointerEvent) => {
      targetMouseX = e.clientX / window.innerWidth;
      targetMouseY = 1 - e.clientY / window.innerHeight;
    };
    window.addEventListener('pointermove', onPointerMove, { passive: true });

    let scroll = 0;
    let targetScroll = 0;
    let raf = 0;
    let stopped = false;
    let lastFrame = 0;
    let scrolling = false;
    let lastScrollAt = 0;
    let scrollVelocity = 0;
    let lastScrollY = typeof window !== 'undefined' ? window.scrollY : 0;
    let lastScrollSampleTime = 0;

    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      targetScroll = max > 0 ? window.scrollY / max : 0;
      const now = performance.now();
      const dt = Math.max(8, now - lastScrollSampleTime);
      const dy = window.scrollY - lastScrollY;
      // Pixels per ms, normalised
      scrollVelocity = Math.min(1, Math.abs(dy / dt) * 0.025);
      lastScrollY = window.scrollY;
      lastScrollSampleTime = now;
      lastScrollAt = now;
      scrolling = true;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    const tick = (now: number) => {
      if (stopped) return;
      const dtSinceScroll = now - lastScrollAt;
      if (dtSinceScroll > 200) scrolling = false;

      // Drop to 30fps while scrolling to free CPU for layout
      const targetFps = scrolling ? 30 : 60;
      const minDelta = 1000 / targetFps;

      if (now - lastFrame >= minDelta) {
        resize();
        // Smooth lerp
        mouseX += (targetMouseX - mouseX) * 0.06;
        mouseY += (targetMouseY - mouseY) * 0.06;
        scroll += (targetScroll - scroll) * 0.10;
        // Velocity decays toward zero each frame
        scrollVelocity *= 0.92;
        // Suppress unused-variable lint; resolution stays in sync via resize()
        void resWidth; void resHeight;
        gl.uniform1f(uTime, now / 1000);
        gl.uniform2f(uMouse, mouseX, mouseY);
        gl.uniform1f(uScroll, scroll);
        gl.uniform1f(uVelocity, scrollVelocity);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        lastFrame = now;
      }
      raf = requestAnimationFrame(tick);
    };

    let visible = !document.hidden;
    const onVisibility = () => {
      const wasVisible = visible;
      visible = !document.hidden;
      if (visible && !wasVisible) {
        if (raf === 0) raf = requestAnimationFrame(tick);
      } else if (!visible && wasVisible) {
        if (raf !== 0) {
          cancelAnimationFrame(raf);
          raf = 0;
        }
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    if (visible) raf = requestAnimationFrame(tick);

    return () => {
      stopped = true;
      if (raf !== 0) cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('visibilitychange', onVisibility);
      gl.deleteProgram(prog);
      gl.deleteBuffer(buf);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-cinematic="webgl"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        zIndex: -1,
        pointerEvents: 'none',
      }}
    />
  );
}
