'use client';
import Link from 'next/link';
import styles from './Admin.module.css';

interface HeaderProps {
  changesCount: number;
  onSaveAll: () => void;
  onLogout: () => void;
}

export default function Header({ changesCount, onSaveAll, onLogout }: HeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.headerLeft}>
        <Link href="/" className={styles.homeLink}>🏠 Главная</Link>
        <h1 className={styles.title}>🛠️ Админ панель</h1>
      </div>
      <div className={styles.headerRight}>
        <button onClick={onSaveAll} className={styles.saveAllBtn}>
          💾 Сохранить все ({changesCount})
        </button>
        <button onClick={onLogout} className={styles.logoutBtn}>🚪 Выйти</button>
      </div>
    </header>
  );
}
