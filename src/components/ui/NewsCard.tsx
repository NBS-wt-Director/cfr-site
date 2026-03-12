'use client';
import Image from 'next/image';
import ActionButtons from './ActionButtons';
import styles from './NewsCard.module.css';

interface NewsCardProps {
  news: {
    id: number;
    image: string;
    title: string;
    description: string;
  };
  onFormOpen: (reason: string) => void;
  openImageModal: (url: string, alt: string) => void;
}

export default function NewsCard({ news, onFormOpen, openImageModal }: NewsCardProps) {
  return (
    <div className={styles.card}>
      <div 
        className={styles.imageWrapper}
        onClick={() => openImageModal(news.image, news.title)}
      >
        <Image
          src={news.image}
          alt={news.title}
          fill
          className={styles.image}
        />
      </div>
      
      <div className={styles.content}>
        <h3 className={styles.title}>{news.title}</h3>
        <p className={styles.description}>{news.description}</p>
        <ActionButtons
          href={`/news/${news.id}`}
          reason={news.title}
          onCallClick={onFormOpen}
        />
      </div>
    </div>
  );
}
