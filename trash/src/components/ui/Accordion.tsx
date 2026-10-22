'use client';
import { useState } from 'react';
import styles from './Accordion.module.css';

interface AccordionProps {
  items: Array<{
    title: string;
    content: React.ReactNode;
    defaultOpen?: boolean;
  }>;
  className?: string;
}

export default function Accordion({ items, className = '' }: AccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(
    items.findIndex(item => item.defaultOpen) || 0
  );

  const toggleItem = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className={`${styles.container} ${className}`}>
      {items.map((item, index) => (
        <div key={index} className={styles.item}>
          <button
            className={`${styles.header} ${openIndex === index ? styles.active : ''}`}
            onClick={() => toggleItem(index)}
          >
            <h4>{item.title}</h4>
            <span className={`${styles.icon} ${openIndex === index ? styles.rotated : ''}`}>
              ▼
            </span>
          </button>
          {openIndex === index && (
            <div className={styles.content}>
              {item.content}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
