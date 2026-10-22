'use client';
import { useState, useEffect, useRef } from 'react';
import styles from './TruncatedText.module.css';

interface TruncatedTextProps {
  children: string;
  className?: string;
  lines?: 2 | 3;
}

export default function TruncatedText({ 
  children, 
  className = '', 
  lines = 2 
}: TruncatedTextProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const hasOverflow = element.scrollHeight > element.clientHeight;
    setIsOverflowing(hasOverflow);
  }, [children]);

  const toggleExpand = () => setIsExpanded(!isExpanded);

  return (
    <div className={`${styles.container} ${className}`}>
      <div 
        ref={ref}
        className={`${styles.text} ${isOverflowing && !isExpanded ? styles.truncated : ''}`}
        style={{ 
          WebkitLineClamp: lines.toString() as any 
        }}
      >
        {children}
      </div>
      
      {isOverflowing && (
        <button onClick={toggleExpand} className={styles.expandButton}>
          {isExpanded ? 'Свернуть' : 'Подробнее...'}
        </button>
      )}
    </div>
  );
}
