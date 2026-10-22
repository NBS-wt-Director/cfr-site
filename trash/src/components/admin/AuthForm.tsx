'use client';
import styles from './Admin.module.css';

interface AuthFormProps {
  password: string;
  setPassword: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  error?: string;
}

export default function AuthForm({ password, setPassword, onSubmit, error }: AuthFormProps) {
  return (
    <div className={styles.authContainer}>
      <div className={styles.authCard}>
        <h1 className={styles.authTitle}>🔐 Админ панель</h1>
        <form onSubmit={onSubmit} className={styles.authForm}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="вспоминай..."
            className={styles.authInput}
            autoFocus
          />
          <button type="submit" className={styles.authButton}>Войти</button>
        </form>
        {error && <p className={styles.error}>{error}</p>}
      </div>
    </div>
  );
}
