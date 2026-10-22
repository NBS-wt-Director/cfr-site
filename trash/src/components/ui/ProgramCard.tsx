'use client';
import ActionButtons from './ActionButtons';
import styles from './ProgramCard.module.css';

interface ProgramCardProps {
  program: {
    id: number;
    image: string;
    name: string;
    description: string;
    photoAlbum?: { image: string; caption?: string }[];
  };
  onFormOpen: (reason: string) => void;
  openImageModal: (url: string, alt: string) => void;
}

export default function ProgramCard({ program, onFormOpen, openImageModal }: ProgramCardProps) {
  return (
    <div className={styles.card}>
      <div 
        className={styles.imageWrapper}
        onClick={() => openImageModal(program.image, program.name)}
      >
        <img
          src={program.image}
          alt={program.name}
          className={styles.image}
        />
      </div>
      
      <div className={styles.content}>
        <h3 className={styles.title}>{program.name}</h3>
        <p className={styles.description}>{program.description}</p>
        <ActionButtons
          href={`/programs/${program.id}`}
          reason={program.name}
          onCallClick={onFormOpen}
        />
      </div>
    </div>
  );
}
