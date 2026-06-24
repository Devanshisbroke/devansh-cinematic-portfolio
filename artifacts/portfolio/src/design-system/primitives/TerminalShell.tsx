import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { play } from '../../audio/sound-engine';
import { identity, projects } from '../../content-registry/data';
import { cycleThemeMode, writeThemeMode } from '../../accessibility/theme-cycle';

interface LogLine {
  text: string;
  type: 'input' | 'output' | 'system';
}

interface TerminalShellProps {
  active: boolean;
  onClose: () => void;
  triggerMeltdown: () => void;
  triggerBios: () => void;
  triggerGame: () => void;
  triggerGlitch: () => void;
  triggerTimeTravel: () => void;
}

export function TerminalShell({
  active,
  onClose,
  triggerMeltdown,
  triggerBios,
  triggerGame,
  triggerGlitch,
  triggerTimeTravel,
}: TerminalShellProps) {
  const [open, setOpen] = useState(active);
  const [inputVal, setInputVal] = useState('');
  const [history, setHistory] = useState<LogLine[]>([
    { text: 'SYSTEM SHELL DEPLOYED (v1.0.4)', type: 'system' },
    { text: 'Type "help" to see what you can ask the system.', type: 'system' },
    { text: 'NLP terminal is offline and fully client-side.', type: 'system' },
  ]);

  // Draggable window state
  const [position, setPosition] = useState({ x: 80, y: 120 });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, posX: 0, posY: 0 });

  const terminalRef = useRef<HTMLDivElement>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOpen(active);
  }, [active]);

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [history]);

  const handleDragStart = (e: React.MouseEvent) => {
    // Only drag from titlebar
    if ((e.target as HTMLElement).closest('[data-titlebar]') === null) return;
    setDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      posX: position.x,
      posY: position.y,
    };
  };

  useEffect(() => {
    if (!dragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      setPosition({
        x: Math.max(10, Math.min(window.innerWidth - 300, dragRef.current.posX + dx)),
        y: Math.max(10, Math.min(window.innerHeight - 200, dragRef.current.posY + dy)),
      });
    };
    const handleMouseUp = () => {
      setDragging(false);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging]);

  const processNLP = (rawInput: string) => {
    const input = rawInput.toLowerCase().trim();
    if (!input) return;

    setHistory((prev) => [...prev, { text: `devansh@system:~$ ${rawInput}`, type: 'input' }]);

    const response = (text: string) => {
      // Print response with chiptune typewriter sounds
      let currentLength = 0;
      setHistory((prev) => [...prev, { text: '', type: 'output' }]);
      
      const interval = setInterval(() => {
        currentLength += 3; // output chunks to speed up slightly
        const snippet = text.slice(0, currentLength);
        
        setHistory((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last && last.type === 'output') {
            last.text = snippet;
          }
          return next;
        });

        play('tick');

        if (currentLength >= text.length) {
          clearInterval(interval);
        }
      }, 15);
    };

    // NLP matching keywords
    // HELP
    if (input === 'help') {
      response(
        `AVAILABLE DOMAIN QUERIES:\n` +
        `  • "education" : IIT Madras & IIM Bangalore details.\n` +
        `  • "experience": Professional engineering history (Globe ID).\n` +
        `  • "projects"  : Summary of developed systems.\n` +
        `  • "skills"    : Primary technical competencies.\n` +
        `  • "contact"   : Email and socials links.\n\n` +
        `SYSTEM COMMANDS (MACROS):\n` +
        `  • "theme <dark|light|terminal|studio>" : Cycle theme modes.\n` +
        `  • "scroll <threshold|compass|work|ethos|signal>" : Jump to scene.\n` +
        `  • "game"      : Launch webpage breakout game.\n` +
        `  • "bios"      : Open system Award BIOS configuration.\n` +
        `  • "travel"    : Launch git time-travel timeline scrubber.\n` +
        `  • "melt"      : Trigger system gravitational collapse.\n` +
        `  • "glitch"    : Trigger code telemetry corruption.`
      );
      return;
    }

    // CLEAR
    if (input === 'clear') {
      setHistory([]);
      return;
    }

    // EDUCATION
    if (input.includes('education') || input.includes('iit') || input.includes('iim') || input.includes('college') || input.includes('degree')) {
      response(
        `EDUCATION HISTORY:\n` +
        `1. Indian Institute of Technology, Madras (IIT Madras) [2018 - 2022]\n` +
        `   - B.Tech in Engineering. Developed foundational programming skills, vector maths, and analytical mechanics.\n` +
        `2. Indian Institute of Management, Bangalore (IIM Bangalore) [2022 - 2024]\n` +
        `   - Master of Business Administration (MBA). Focus on operational strategy, product execution, and analytics.`
      );
      return;
    }

    // EXPERIENCE
    if (input.includes('experience') || input.includes('work') || input.includes('job') || input.includes('career') || input.includes('globe')) {
      response(
        `WORK EXPERIENCE:\n` +
        `- Globe ID (Software Development Engineer)\n` +
        `  - Developed spatial UI layouts, optimized high-throughput systems, and designed custom internal CLI developer tools. Spearheaded migration of legacy modules to reactive, lightweight frontends.`
      );
      return;
    }

    // SKILLS
    if (input.includes('skills') || input.includes('tech') || input.includes('languages') || input.includes('code')) {
      response(
        `TECHNICAL COMPETENCY LIST:\n` +
        `- Languages: TypeScript, JavaScript, HTML5/CSS3, Python, C++\n` +
        `- Frontend : React, Next.js, Framer Motion, WebGL / GLSL Shaders, Tailwind CSS\n` +
        `- Backend  : Node.js, Express, PostgreSQL, Drizzle ORM, REST/OpenAPI Specs\n` +
        `- Developer tools: Vite, Vitest, Git, pnpm monorepos, local terminal emulators`
      );
      return;
    }

    // PROJECTS
    if (input.includes('projects') || input.includes('portfolio') || input.includes('khetech') || input.includes('notes')) {
      const projList = projects.map((p, i) => `${i + 1}. ${p.name} - ${p.tagline} [${p.tags.join(', ')}]`).join('\n');
      response(
        `INVENTORY PROJECTS LOG:\n` +
        projList + `\n\nType "scroll work" to visually inspect project panels.`
      );
      return;
    }

    // CONTACT
    if (input.includes('contact') || input.includes('email') || input.includes('phone') || input.includes('social') || input.includes('linkedin')) {
      const socialList = identity.socials.map((s) => `  - ${s.label}: ${s.url}`).join('\n');
      response(
        `CONTACT DIRECTIVES:\n` +
        `  - Email: ${identity.email}\n` +
        socialList + `\n\nDirect mail link: mailto:${identity.email}`
      );
      return;
    }

    // COMMAND: THEME
    if (input.startsWith('theme')) {
      const target = input.replace('theme', '').trim();
      if (['dark', 'light', 'terminal', 'studio'].includes(target)) {
        writeThemeMode(target as 'dark' | 'light' | 'studio' | 'terminal');
        response(`SUCCESS: Theme cycle updated to mode: ${target.toUpperCase()}`);
      } else {
        response(`ERROR: Unknown theme mode "${target}". Try: dark, light, terminal, studio`);
      }
      return;
    }

    // COMMAND: SCROLL
    if (input.startsWith('scroll') || input.startsWith('go to') || input.startsWith('goto')) {
      let target = input.replace('scroll', '').replace('go to', '').replace('goto', '').trim();
      
      // Map colloquial section names
      if (target === 'home' || target === 'top') target = 'threshold';
      if (target === 'projects') target = 'work';
      if (target === 'about') target = 'ethos';
      if (target === 'contact') target = 'signal';
      
      const sections = ['threshold', 'compass', 'work', 'ethos', 'signal'];
      
      const matched = sections.find(s => s.includes(target) || target.includes(s));
      if (matched) {
        response(`NAVIGATING: Scrolling viewport to section target #${matched.toUpperCase()}`);
        setTimeout(() => {
          window.location.hash = `#scene-${matched}`;
        }, 600);
      } else {
        response(`ERROR: Section target "${target}" not found. Try scroll: threshold, compass, work, ethos, signal.`);
      }
      return;
    }

    // COMMAND: MELT
    if (input === 'melt' || input === 'meltdown' || input === 'destroy') {
      response('ALERT: Launching system gravity meltdown sequence in t-500ms...');
      setTimeout(() => {
        triggerMeltdown();
        onClose();
      }, 800);
      return;
    }

    // COMMAND: BIOS
    if (input === 'bios' || input === 'system setup') {
      response('LAUNCHING: Deploying blue ROM Setup Utility...');
      setTimeout(() => {
        triggerBios();
        onClose();
      }, 800);
      return;
    }

    // COMMAND: GAME
    if (input === 'game' || input === 'play' || input === 'play game') {
      response('BOOTING: Initializing Breakout brick breaker game engine...');
      setTimeout(() => {
        triggerGame();
        onClose();
      }, 800);
      return;
    }

    // COMMAND: GLITCH
    if (input === 'glitch' || input === 'corrupt') {
      response('ALERT: Inducing mock sector corruption matrix...');
      setTimeout(() => {
        triggerGlitch();
        onClose();
      }, 800);
      return;
    }

    // COMMAND: TIMETRAVEL
    if (input === 'time' || input === 'timetravel' || input === 'travel') {
      response('BOOTING: Deploying temporal git timeline scrubber...');
      setTimeout(() => {
        triggerTimeTravel();
        onClose();
      }, 800);
      return;
    }

    // FALLBACK
    response(
      `ERROR: Syntax check failed for query "${rawInput}".\n` +
      `System could not map terms to local registry database.\n` +
      `Type "help" to list available vocabulary and commands.`
    );
  };

  const handleInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      processNLP(inputVal);
      setInputVal('');
      play('burst');
    }
  };

  if (!open) return null;

  return (
    <div
      ref={terminalRef}
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: '450px',
        height: '320px',
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        overflow: 'hidden',
        color: '#00FF41',
        boxShadow: '0 12px 40px rgba(0,0,0,0.8), 0 0 10px rgba(0,255,65,0.15)',
      }}
      className="glass-card"
    >
      {/* Title bar */}
      <div
        data-titlebar
        onMouseDown={handleDragStart}
        style={{
          height: '32px',
          backgroundColor: 'rgba(0, 30, 0, 0.75)',
          borderBottom: '1px solid rgba(0, 255, 65, 0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingInline: '12px',
          cursor: dragging ? 'grabbing' : 'grab',
          userSelect: 'none',
        }}
      >
        <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em', fontWeight: 'bold' }}>
          📟 system://shell-ai
        </span>
        <button
          onClick={() => {
            play('burst');
            onClose();
          }}
          style={{
            background: 'none',
            border: 'none',
            color: '#00FF41',
            cursor: 'pointer',
            fontSize: '14px',
            padding: '2px',
            fontFamily: 'var(--font-mono)',
          }}
        >
          ×
        </button>
      </div>

      {/* Log History */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px',
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          whiteSpace: 'pre-wrap',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}
      >
        {history.map((line, idx) => {
          let color = '#00FF41';
          if (line.type === 'input') color = '#FFFFFF';
          if (line.type === 'system') color = '#008F11';
          return (
            <div key={idx} style={{ color }}>
              {line.text}
            </div>
          );
        })}
        <div ref={logEndRef} />
      </div>

      {/* Input bar */}
      <div
        style={{
          height: '36px',
          backgroundColor: 'rgba(0, 10, 0, 0.85)',
          borderTop: '1px solid rgba(0, 255, 65, 0.25)',
          display: 'flex',
          alignItems: 'center',
          paddingInline: '12px',
        }}
      >
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', marginRight: '6px', userSelect: 'none' }}>
          $
        </span>
        <input
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={handleInputKeyDown}
          placeholder="Ask system, e.g. 'education' or 'help'"
          style={{
            flex: 1,
            background: 'none',
            border: 'none',
            color: '#FFFFFF',
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            outline: 'none',
          }}
        />
      </div>
    </div>
  );
}
