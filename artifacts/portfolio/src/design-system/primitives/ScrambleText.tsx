import { useEffect, useRef, useState } from 'react';
import { readReducedMotion } from '../../accessibility';

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+';

export interface ScrambleTextProps {
  text: string;
  className?: string;
  style?: React.CSSProperties;
}

export function ScrambleText({ text, className, style }: ScrambleTextProps) {
  const [displayText, setDisplayText] = useState(text);
  const isHovering = useRef(false);
  const frameRef = useRef(0);
  
  useEffect(() => {
    setDisplayText(text);
  }, [text]);

  const onPointerEnter = () => {
    if (readReducedMotion()) return;
    if (isHovering.current) return;
    isHovering.current = true;
    
    let frame = 0;
    const totalFrames = 15;
    
    const animate = () => {
      frame++;
      if (frame >= totalFrames) {
        setDisplayText(text);
        return;
      }
      
      const scrambled = text.split('').map((char, index) => {
        if (char === ' ') return ' ';
        if (index < (frame / totalFrames) * text.length) {
          return char;
        }
        return CHARS[Math.floor(Math.random() * CHARS.length)];
      }).join('');
      
      setDisplayText(scrambled);
      frameRef.current = requestAnimationFrame(animate);
    };
    
    cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(animate);
  };
  
  const onPointerLeave = () => {
    isHovering.current = false;
    cancelAnimationFrame(frameRef.current);
    setDisplayText(text);
  };

  useEffect(() => {
    return () => cancelAnimationFrame(frameRef.current);
  }, []);

  return (
    <span 
      className={className} 
      style={style} 
      onPointerEnter={onPointerEnter} 
      onPointerLeave={onPointerLeave}
    >
      {displayText}
    </span>
  );
}
