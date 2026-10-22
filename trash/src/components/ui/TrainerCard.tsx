import styles from './TrainerCard.module.css';

interface Trainer {
  id: number | string;
  name: string;
  image: string;
  experience?: string;
  specialization?: string;
  photoAlbum?: { image: string; caption?: string }[];
}

interface Props {
  trainer: Trainer;
}

export default function TrainerCard({ trainer }: Props) {
  return (
    <div className={styles.card}>
      {/* Изображение */}
      <div className={styles.imageWrapper}>
        <img
          src={trainer.image}
          alt={trainer.name}
          className={styles.image}
          onError={(e) => {
            e.currentTarget.src = '/images/trainer-placeholder.jpg';
          }}
        />
      </div>

      {/* Информация */}
      <div className={styles.content}>
        <div>
          <h3 className={styles.name}>
            {trainer.name}
          </h3>
          {trainer.specialization && (
            <p className={styles.specialty}>{trainer.specialization}</p>
          )}
        </div>
        {trainer.experience && (
          <p className={styles.experience}>Опыт: {trainer.experience}</p>
        )}
      </div>
    </div>
  );
}
