import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { play } from '../../audio/sound-engine';
import { identity, projects } from '../../content-registry/data';

export type CareerEra = '2026' | '2024' | '2022' | '2020';

interface TimeTravelHUDProps {
  active: boolean;
  onClose: () => void;
}

export function TimeTravelHUD({ active, onClose }: TimeTravelHUDProps) {
  const [era, setEra] = useState<CareerEra>('2026');

  useEffect(() => {
    if (!active) return;
    play('enter');
  }, [active]);

  const handleEraChange = (nextEra: CareerEra) => {
    setEra(nextEra);
    play('tick');
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-era', nextEra);
    }
  };

  const handleClose = () => {
    // Reset back to normal 2026 when closed
    if (typeof document !== 'undefined') {
      document.documentElement.removeAttribute('data-era');
    }
    play('burst');
    onClose();
  };

  if (!active || typeof document === 'undefined') return null;

  return (
    <>
      {/* Floating Scrubber HUD */}
      {createPortal(
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '420px',
            backgroundColor: 'rgba(10, 10, 10, 0.85)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '16px',
            padding: '16px 20px',
            boxSizing: 'border-box',
            zIndex: 999999,
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            color: '#FFFFFF',
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), var(--glow-amber)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', userSelect: 'none' }}>
            <span style={{ fontWeight: 'bold', color: 'var(--color-amber)' }}>🕰️ GIT TIMELINE TRAVEL</span>
            <button
              onClick={handleClose}
              style={{
                background: 'none',
                border: 'none',
                color: '#8E8B82',
                cursor: 'pointer',
                fontSize: '14px',
                padding: '2px',
              }}
            >
              ×
            </button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', marginTop: '10px' }}>
            {/* Horizontal timeline bar */}
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '12px',
                right: '12px',
                height: '2px',
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                transform: 'translateY(-50%)',
                zIndex: 0,
              }}
            />

            {(['2020', '2022', '2024', '2026'] as CareerEra[]).map((y) => {
              const isSelected = era === y;
              return (
                <button
                  key={y}
                  onClick={() => handleEraChange(y)}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: isSelected ? 'var(--color-amber)' : '#1F1E1A',
                    border: `2px solid ${isSelected ? '#FFFFFF' : 'rgba(255,255,255,0.2)'}`,
                    color: isSelected ? '#000000' : '#FFFFFF',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '10px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    zIndex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 200ms ease',
                    boxShadow: isSelected ? 'var(--glow-amber)' : 'none',
                  }}
                >
                  {y.slice(2)}
                </button>
              );
            })}
          </div>

          <div style={{ textAlign: 'center', color: '#8E8B82', fontSize: '10px', marginTop: '4px', userSelect: 'none' }}>
            {era === '2026' && 'Era: 2026 · Cinematic Glassmorphism (IITM + IIMB Grad)'}
            {era === '2024' && 'Era: 2024 · Corporate Editorial (IIM Bangalore MBA)'}
            {era === '2022' && 'Era: 2022 · Cyberpunk terminal (IIT Madras B.Tech)'}
            {era === '2020' && 'Era: 2020 · DOS ASCII Resume (First HTML codes)'}
          </div>
        </div>,
        document.body
      )}

      {/* Full-screen DOS Resume for 2020 Era */}
      {(() => {
        if (era !== '2020') return null;

        const dName = identity.displayName;
        const kName = projects.find((p) => p.id === 'khetech')?.name || '';
        const lmnName = projects.find((p) => p.id === 'lastminute')?.name || '';

        const headerLine = `║ ${dName.toUpperCase()} - SYSTEM RESUME CORE MATRIX v0.8.2`.padEnd(75) + '║';
        const nameLine = `║   - Name: ${dName}`.padEnd(75) + '║';
        const lmnLine = `║   - ${lmnName} (Web App tool)`.padEnd(75) + '║';
        const kLine = `║   - ${kName} Industrial automation mockups`.padEnd(75) + '║';

        return createPortal(
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: '#000000',
              color: '#C0C0C0',
              fontFamily: 'var(--font-mono)',
              fontSize: '14px',
              zIndex: 999990, // just behind the slider
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              userSelect: 'none',
              padding: '24px',
              boxSizing: 'border-box',
            }}
          >
            <pre
              style={{
                border: '2px solid #C0C0C0',
                padding: '20px',
                backgroundColor: '#000000',
                color: '#C0C0C0',
                fontFamily: 'monospace',
                fontSize: '12px',
                lineHeight: '1.4',
                maxWidth: '680px',
                width: '100%',
                boxShadow: '0 0 30px rgba(0,0,0,0.9)',
                overflowX: 'auto',
              }}
            >
{`╔══════════════════════════════════════════════════════════════════════════╗
${headerLine}
╠══════════════════════════════════════════════════════════════════════════╣
║ [IDENTITY]                                                               ║
${nameLine}
║   - Role: Engineering Student (IIT Madras)                               ║
║   - Tech Interest: Web Design, React, Algorithms                         ║
║                                                                          ║
║ [ACADEMICS]                                                              ║
║   - Indian Institute of Technology, Madras (B.Tech student)              ║
║                                                                          ║
║ [EARLY PROJECTS]                                                         ║
${lmnLine}
${kLine}
║                                                                          ║
║ [SKILLS]                                                                 ║
║   - HTML / CSS / Vanilla JavaScript / C++ / Data Structures               ║
║                                                                          ║
║ [SYSTEM STATS]                                                           ║
║   - Time: 2:14 AM                                                        ║
║   - RAM : 640 KB Free                                                    ║
║   - Host: IITM Hostel Room Terminal                                      ║
╚══════════════════════════════════════════════════════════════════════════╝

[ Status: Code compiling... Press "Timeline Slider" to change epochs ]`}
            </pre>
          </div>,
          document.body
        );
      })()}
    </>
  );
}
