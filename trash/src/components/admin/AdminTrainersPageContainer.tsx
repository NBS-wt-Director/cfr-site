'use client';
import styles from './AdminItemForm.module.css';

interface AdminTrainersPageContainerProps {
  containerSettings?: any;
  cardSettings?: any;
  onSave?: (containerSettings: any, cardSettings: any) => void;
}

export default function AdminTrainersPageContainer({ containerSettings, cardSettings, onSave }: AdminTrainersPageContainerProps = {}) {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>👨‍🏫 Настройки страницы Тренеры</h3>
      </div>
      <div className={styles.content}>
        <div className={styles.section}>
          <h4>🚧 В разработке</h4>
          <p>Настройки отображения тренеров на странице тренеров скоро будут доступны.</p>
          <p>Пока используйте настройки "Тренеры на главной" для управления отображением на главной странице.</p>
        </div>
      </div>
    </div>
  );
}
