'use client';
import { Phone, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import styles from './ActionButtons.module.css';

interface ActionButtonsProps {
  onCallClick: (reason: string) => void;
  href?: string;
  reason: string;
  className?: string;
}

export default function ActionButtons({ 
  onCallClick, 
  href, 
  reason, 
  className = '' 
}: ActionButtonsProps) {
  return (
    <div className={`${styles.buttons} ${className}`}>
      <button
        onClick={() => onCallClick(reason)}
        className={styles.callButton}
        aria-label="Заказать звонок"
      >
        <Phone size={20} />
        Заказать звонок
      </button>
      
      {href && (
        <Link
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.detailsButton}
          aria-label="Подробнее"
        >
          <ExternalLink size={20} />
          Подробнее
        </Link>
      )}
    </div>
  );
}
