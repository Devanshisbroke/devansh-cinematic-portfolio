import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { play } from '../../audio/sound-engine';

export interface BiosSettings {
  graphics: 'webgl' | 'static' | 'off';
  waveform: OscillatorType;
  attack: 'fast' | 'medium' | 'slow';
  release: 'fast' | 'medium' | 'slow';
  crt: 'on' | 'off';
}

const ATTACK_MS = { fast: 3, medium: 8, slow: 20 };
const RELEASE_MS = { fast: 60, medium: 120, slow: 250 };

export function readBiosSettings(): BiosSettings {
  if (typeof window === 'undefined') {
    return { graphics: 'webgl', waveform: 'triangle', attack: 'fast', release: 'medium', crt: 'off' };
  }
  try {
    return {
      graphics: (window.localStorage.getItem('pcr.bios-graphics') as 'webgl' | 'static' | 'off') ?? 'webgl',
      waveform: (window.localStorage.getItem('pcr.bios-waveform') as OscillatorType) ?? 'triangle',
      attack: (window.localStorage.getItem('pcr.bios-attack') as 'fast' | 'medium' | 'slow') ?? 'fast',
      release: (window.localStorage.getItem('pcr.bios-release') as 'fast' | 'medium' | 'slow') ?? 'medium',
      crt: (window.localStorage.getItem('pcr.bios-crt') as 'on' | 'off') ?? 'off',
    };
  } catch {
    return { graphics: 'webgl', waveform: 'triangle', attack: 'fast', release: 'medium', crt: 'off' };
  }
}

export function writeBiosSettings(settings: BiosSettings) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem('pcr.bios-graphics', settings.graphics);
    window.localStorage.setItem('pcr.bios-waveform', settings.waveform);
    window.localStorage.setItem('pcr.bios-attack', settings.attack);
    window.localStorage.setItem('pcr.bios-release', settings.release);
    window.localStorage.setItem('pcr.bios-crt', settings.crt);
  } catch {
    // noop
  }
}

function getAdsrGraph(attack: 'fast' | 'medium' | 'slow', release: 'fast' | 'medium' | 'slow'): string {
  const lines = [
    '  ▲ VOL   ',
    '  │       ',
    '  │       ',
    '  │       ',
    '  └───────► TIME',
  ];
  
  if (attack === 'fast' && release === 'fast') {
    lines[1] = '  │  /\\';
    lines[2] = '  │ /  \\';
    lines[3] = '  │/    \\_____';
  } else if (attack === 'fast' && release === 'medium') {
    lines[1] = '  │  /\\';
    lines[2] = '  │ /  \\_';
    lines[3] = '  │/     \\____';
  } else if (attack === 'fast' && release === 'slow') {
    lines[1] = '  │  /\\';
    lines[2] = '  │ /  \\____';
    lines[3] = '  │/         \\';
  } else if (attack === 'medium' && release === 'fast') {
    lines[1] = '  │    /\\';
    lines[2] = '  │   /  \\';
    lines[3] = '  │  /    \\___';
  } else if (attack === 'medium' && release === 'medium') {
    lines[1] = '  │    /\\';
    lines[2] = '  │   /  \\_';
    lines[3] = '  │  /     \\__';
  } else if (attack === 'medium' && release === 'slow') {
    lines[1] = '  │    /\\';
    lines[2] = '  │   /  \\____';
    lines[3] = '  │  /         \\';
  } else if (attack === 'slow' && release === 'fast') {
    lines[1] = '  │      /\\';
    lines[2] = '  │     /  \\';
    lines[3] = '  │  __/    \\_';
  } else if (attack === 'slow' && release === 'medium') {
    lines[1] = '  │      /\\';
    lines[2] = '  │     /  \\_';
    lines[3] = '  │  __/     \\';
  } else { // slow, slow
    lines[1] = '  │      /\\';
    lines[2] = '  │     /  \\___';
    lines[3] = '  │  __/       \\';
  }
  
  return lines.join('\n');
}

export function BiosConfig({
  active,
  onClose,
}: {
  active: boolean;
  onClose: () => void;
}) {
  const [settings, setSettings] = useState<BiosSettings>(() => readBiosSettings());
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [diagnosticsActive, setDiagnosticsActive] = useState(false);
  const [diagProgress, setDiagProgress] = useState<number[]>([]);
  const [nowStr, setNowStr] = useState('');

  // Clock
  useEffect(() => {
    if (!active) return;
    const updateTime = () => {
      const d = new Date();
      setNowStr(
        `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}/${d.getFullYear()}  ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`
      );
    };
    updateTime();
    const id = setInterval(updateTime, 1000);
    return () => clearInterval(id);
  }, [active]);

  const menuItems = [
    { key: 'graphics', label: 'GRAPHIC LAYER ADAPTER', options: ['webgl', 'static', 'off'], desc: 'Select rendering engine for backgrounds.' },
    { key: 'waveform', label: 'SYNTH WAVEFORM STYLE', options: ['triangle', 'square', 'sine', 'sawtooth'], desc: 'Select oscillator wave type for keystroke play.' },
    { key: 'attack', label: 'KEYBOARD ATTACK RATE', options: ['fast', 'medium', 'slow'], desc: 'Configure initial envelope attack rate.' },
    { key: 'release', label: 'KEYBOARD DECAY RELEASE', options: ['fast', 'medium', 'slow'], desc: 'Configure final notes decay duration.' },
    { key: 'crt', label: 'CRT GLASS SCREEN FILTER', options: ['on', 'off'], desc: 'Toggle phosphor curved tube barrel distortion filter.' },
    { key: 'diagnostics', label: 'RUN SYSTEM SECTOR TEST', options: ['[ Press Enter ]'], desc: 'Run sector integrity verification scan.' },
    { key: 'defaults', label: 'LOAD BIOS DEFAULTS', options: ['[ Press Enter ]'], desc: 'Reset registers to production defaults.' },
    { key: 'save', label: 'SAVE & EXIT SETUP', options: ['[ Press Enter ]'], desc: 'Save settings to localStorage and reboot.' },
    { key: 'exit', label: 'EXIT WITHOUT SAVING', options: ['[ Press Enter ]'], desc: 'Discard setup modifications and exit.' },
  ];

  // Diagnostics tick
  useEffect(() => {
    if (!diagnosticsActive) return;
    setDiagProgress([]);
    let cellIdx = 0;
    const totalCells = 160;
    const interval = setInterval(() => {
      if (cellIdx >= totalCells) {
        clearInterval(interval);
        setTimeout(() => setDiagnosticsActive(false), 800);
        return;
      }
      // Sector statuses: 0=ok, 1=warning, 2=bad sector
      const roll = Math.random();
      const status = roll < 0.94 ? 0 : roll < 0.98 ? 1 : 2;
      setDiagProgress((prev) => [...prev, status]);
      play('tick');
      cellIdx++;
    }, 18);

    return () => clearInterval(interval);
  }, [diagnosticsActive]);

  useEffect(() => {
    if (!active) return;
    play('enter');

    const handleKeyDown = (e: KeyboardEvent) => {
      if (diagnosticsActive) {
        if (e.key === 'Escape' || e.key === 'Enter') {
          setDiagnosticsActive(false);
          play('burst');
        }
        return;
      }

      switch (e.key) {
        case 'ArrowUp':
          setSelectedIndex((idx) => (idx === 0 ? menuItems.length - 1 : idx - 1));
          play('tick');
          break;
        case 'ArrowDown':
          setSelectedIndex((idx) => (idx === menuItems.length - 1 ? 0 : idx + 1));
          play('tick');
          break;
        case 'ArrowLeft':
        case 'ArrowRight': {
          const item = menuItems[selectedIndex]!;
          if (item.options.length > 1) {
            const curOptIdx = item.options.indexOf(settings[item.key as keyof BiosSettings] as string);
            const dir = e.key === 'ArrowRight' ? 1 : -1;
            let nextOptIdx = curOptIdx + dir;
            if (nextOptIdx >= item.options.length) nextOptIdx = 0;
            if (nextOptIdx < 0) nextOptIdx = item.options.length - 1;
            
            setSettings((prev) => ({
              ...prev,
              [item.key]: item.options[nextOptIdx],
            }));
            play('tick');
          }
          break;
        }
        case 'Enter': {
          const item = menuItems[selectedIndex]!;
          if (item.key === 'diagnostics') {
            setDiagnosticsActive(true);
            play('dump');
          } else if (item.key === 'defaults') {
            setSettings({ graphics: 'webgl', waveform: 'triangle', attack: 'fast', release: 'medium', crt: 'off' });
            play('burst');
          } else if (item.key === 'save') {
            writeBiosSettings(settings);
            // Apply theme changes dynamically
            if (typeof document !== 'undefined') {
              if (settings.graphics === 'webgl') {
                document.documentElement.removeAttribute('data-reduced-motion');
              } else {
                document.documentElement.setAttribute('data-reduced-motion', 'on');
              }
              if (settings.crt === 'on') {
                document.documentElement.setAttribute('data-crt-filter', 'on');
              } else {
                document.documentElement.removeAttribute('data-crt-filter');
              }
            }
            play('boot');
            onClose();
          } else if (item.key === 'exit') {
            play('burst');
            onClose();
          } else if (item.options.length > 1) {
            // Cycle on Enter
            const curOptIdx = item.options.indexOf(settings[item.key as keyof BiosSettings] as string);
            const nextOptIdx = (curOptIdx + 1) % item.options.length;
            setSettings((prev) => ({
              ...prev,
              [item.key]: item.options[nextOptIdx],
            }));
            play('tick');
          }
          break;
        }
        case 'Escape':
          play('burst');
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [active, selectedIndex, settings, diagnosticsActive]);

  if (!active || typeof document === 'undefined') return null;

  const currentItem = menuItems[selectedIndex]!;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: '#0000A8',
        color: '#A8A8A8',
        fontFamily: 'var(--font-mono)',
        fontSize: '14px',
        lineHeight: '1.4',
        zIndex: 9999999,
        padding: '24px',
        boxSizing: 'border-box',
        userSelect: 'none',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Top Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px double #A8A8A8', paddingBottom: '6px', color: '#FFFFFF' }}>
        <span>ROM PCI/ISA BIOS SETUP UTILITY</span>
        <span>AWARD SOFTWARE, INC.</span>
      </div>

      {/* Main Grid Setup */}
      <div style={{ flex: 1, display: 'flex', marginTop: '16px', gap: '20px', minHeight: 0 }}>
        {/* Left Hand: Controls */}
        <div style={{ flex: 3, borderRight: '1px solid #A8A8A8', paddingRight: '20px' }}>
          <div style={{ color: '#FFFF54', marginBottom: '16px', fontWeight: 'bold' }}>SYSTEM CONFIGURATION REGISTERS</div>
          
          {menuItems.map((item, index) => {
            const isSelected = index === selectedIndex;
            const val = item.options.length > 1 ? settings[item.key as keyof BiosSettings] : item.options[0];
            return (
              <div
                key={item.key}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '4px 8px',
                  backgroundColor: isSelected ? '#A8A8A8' : 'transparent',
                  color: isSelected ? '#0000A8' : '#A8A8A8',
                  fontWeight: isSelected ? 'bold' : 'normal',
                  cursor: 'pointer',
                  marginBottom: '2px',
                }}
              >
                <span>{item.label}</span>
                <span style={{ color: isSelected ? '#0000A8' : '#FFFF54' }}>
                  {val?.toString().toUpperCase()}
                </span>
              </div>
            );
          })}

          <div style={{ marginTop: '30px', color: '#FFFFFF' }}>
            <div>SYSTEM DATETIME REGISTER</div>
            <div style={{ color: '#FFFF54', marginTop: '4px' }}>{nowStr}</div>
          </div>
        </div>

        {/* Right Hand: Sub Details / Help Box */}
        <div style={{ flex: 2, display: 'flex', flexDirection: 'column' }}>
          <div style={{ color: '#FFFF54', marginBottom: '10px', fontWeight: 'bold' }}>ITEM DESCRIPTION</div>
          <div style={{ flex: 1, border: '1px solid #A8A8A8', padding: '12px', color: '#FFFFFF', backgroundColor: '#00007c', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>{currentItem.desc}</div>
            {currentItem.options.length > 1 && (
              <div style={{ color: '#A8A8A8' }}>
                Values: <span style={{ color: '#FFFF54' }}>{currentItem.options.join(' / ').toUpperCase()}</span>
              </div>
            )}
            
            {/* Visual envelope graph for ADSR registers */}
            {(currentItem.key === 'attack' || currentItem.key === 'release' || currentItem.key === 'waveform') && (
              <div style={{ borderTop: '1px dashed #A8A8A8', paddingTop: '12px', marginTop: 'auto' }}>
                <div style={{ color: '#FFFF54', fontWeight: 'bold', fontSize: 11, marginBottom: 8 }}>VISUAL ENVELOPE CONFIG</div>
                <pre style={{ margin: 0, fontFamily: 'monospace', fontSize: 12, color: '#00FF41', lineHeight: '1.2' }}>
                  {getAdsrGraph(settings.attack, settings.release)}
                </pre>
              </div>
            )}
          </div>
          
          <div style={{ marginTop: '16px', border: '1px solid #A8A8A8', padding: '12px' }}>
            <div style={{ color: '#FFFF54', fontWeight: 'bold', marginBottom: '6px' }}>KEY CONTROLS</div>
            <div style={{ fontSize: '12px' }}>
              <div>↑, ↓    : Select Register</div>
              <div>←, →    : Modify Option</div>
              <div>Enter   : Toggle / Execute</div>
              <div>Esc     : Exit Setup Utility</div>
            </div>
          </div>
        </div>
      </div>

      {/* Diagnostics Overlay Modal */}
      {diagnosticsActive && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: '#0000A8',
            border: '4px double #FFFFFF',
            padding: '24px',
            width: '460px',
            boxShadow: '0 0 50px rgba(0,0,0,0.8)',
            color: '#FFFFFF',
          }}
        >
          <div style={{ textAlign: 'center', color: '#FFFF54', fontWeight: 'bold', marginBottom: '16px' }}>
            AWARD SYSTEM SECTOR INTEGRITY TEST
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(20, 1fr)',
              gap: '3px',
              backgroundColor: '#000000',
              padding: '10px',
              border: '1px solid #A8A8A8',
              maxHeight: '180px',
              overflowY: 'auto',
            }}
          >
            {Array.from({ length: 160 }).map((_, i) => {
              const status = diagProgress[i];
              let bg = '#222222';
              if (status === 0) bg = '#00FF41'; // OK sector (Green)
              if (status === 1) bg = '#FFFF54'; // Warning sector (Yellow)
              if (status === 2) bg = '#FF5555'; // Bad sector (Red)
              return (
                <div
                  key={i}
                  style={{
                    width: '100%',
                    paddingBottom: '100%',
                    backgroundColor: bg,
                    border: '1px solid #333333',
                  }}
                />
              );
            })}
          </div>
          <div style={{ marginTop: '16px', fontSize: '12px', display: 'flex', justifyContent: 'space-between', color: '#A8A8A8' }}>
            <span>Sector count: {diagProgress.length} / 160</span>
            {diagProgress.length < 160 ? (
              <span style={{ color: '#FFFF54', animation: 'blink 1s step-end infinite' }}>SCANNING...</span>
            ) : (
              <span style={{ color: '#00FF41', fontWeight: 'bold' }}>SCAN OK</span>
            )}
          </div>
        </div>
      )}

      {/* Footer bar */}
      <div style={{ borderTop: '1px solid #A8A8A8', paddingTop: '6px', marginTop: '12px', textAlign: 'center', fontSize: '11px' }}>
        F10: Save & Exit Setup  ·  Esc: Discard Setup  ·  Award Software, Inc. © 1998-2026
      </div>
      <style>{`
        @keyframes blink {
          50% { opacity: 0; }
        }
      `}</style>
    </div>,
    document.body
  );
}
