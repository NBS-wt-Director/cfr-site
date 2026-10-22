'use client';
import styles from './GlobalPreloader.module.css';

export default function GlobalPreloader() {
  return (
    <div className={styles.preloader}>
      <div className={styles.spinner}></div>
      <div className={styles.text}>Загрузка...</div>
    </div>
  );
}
