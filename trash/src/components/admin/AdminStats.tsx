'use client';
import { useState, useEffect } from 'react';
import styles from './AdminStats.module.css';

interface StatEntry {
  count: number;
  lastVisit: string;
}

interface Stats {
  pages: Record<string, StatEntry>;
  forms: Record<string, StatEntry>;
  lastUpdated: string;
}

interface AdminStatsProps {
  stats: Stats;
  onRefresh: () => void;
  onClear: () => void;
}

export default function AdminStats({ stats, onRefresh, onClear }: AdminStatsProps) {
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState<'all' | 'day' | 'week' | 'month'>('all');

  // Подсчёт статистики за период
  const getFilteredStats = () => {
    const now = new Date();
    const dayMs = 24 * 60 * 60 * 1000;
    const weekMs = 7 * dayMs;
    const monthMs = 30 * dayMs;

    let filterMs = 0;
    if (period === 'day') filterMs = dayMs;
    if (period === 'week') filterMs = weekMs;
    if (period === 'month') filterMs = monthMs;

    const filterByTime = (entry: StatEntry) => {
      if (filterMs === 0) return true;
      const lastVisit = new Date(entry.lastVisit).getTime();
      return (now.getTime() - lastVisit) < filterMs;
    };

    const pages = Object.entries(stats.pages || {})
      .filter(([_, entry]) => filterByTime(entry))
      .sort((a, b) => b[1].count - a[1].count);

    const forms = Object.entries(stats.forms || {})
      .filter(([_, entry]) => filterByTime(entry))
      .sort((a, b) => b[1].count - a[1].count);

    return { pages, forms };
  };

  const filtered = getFilteredStats();
  const totalPageViews = filtered.pages.reduce((sum, [_, entry]) => sum + entry.count, 0);
  const totalForms = filtered.forms.reduce((sum, [_, entry]) => sum + entry.count, 0);

  // Экспорт отчёта (TXT) и отправка на email
  const exportReport = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/stats/export?action=export-txt', { method: 'POST' });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `отчёт-статистика-${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        // Альтернатива - отправить на email
        await fetch('/api/admin/stats/export?action=send-email', { method: 'POST' });
      }
    } catch (e) {
      console.error('Ошибка экспорта:', e);
      // Альтернатива - отправить на email
      alert('Экспорт недоступен. Статистика отправлена на email.');
      await fetch('/api/admin/stats/export?action=send-email', { method: 'POST' });
    }
    setLoading(false);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('ru-RU');
  };

  const getPeriodLabel = (p: string) => {
    switch(p) {
      case 'day': return 'За сегодня';
      case 'week': return 'За неделю';
      case 'month': return 'За месяц';
      default: return 'Всё время';
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>📊 Статистика сайта</h2>
        <div className={styles.actions}>
          <button onClick={onRefresh} className={styles.btn}>
            🔄 Обновить
          </button>
          <button onClick={exportReport} disabled={loading} className={styles.btn}>
            {loading ? '⏳...' : '📧 Отправить отчёт'}
          </button>
          <button onClick={onClear} className={`${styles.btn} ${styles.btnDanger}`}>
            🗑️ Очистить
          </button>
        </div>
      </div>

      {/* Фильтр периода */}
      <div className={styles.periodFilter}>
        {(['all', 'day', 'week', 'month'] as const).map(p => (
          <button
            key={p}
            className={`${styles.periodBtn} ${period === p ? styles.periodActive : ''}`}
            onClick={() => setPeriod(p)}
          >
            {getPeriodLabel(p)}
          </button>
        ))}
      </div>

      {/* Общая статистика */}
      <div className={styles.summary}>
        <div className={styles.summaryCard}>
          <div className={styles.summaryIcon}>👁️</div>
          <div className={styles.summaryValue}>{totalPageViews}</div>
          <div className={styles.summaryLabel}>Просмотров страниц</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryIcon}>📝</div>
          <div className={styles.summaryValue}>{totalForms}</div>
          <div className={styles.summaryLabel}>Отправлено форм</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryIcon}>📄</div>
          <div className={styles.summaryValue}>{filtered.pages.length}</div>
          <div className={styles.summaryLabel}>Страниц в топе</div>
        </div>
      </div>

      {/* Таблица просмотров страниц */}
      <div className={styles.section}>
        <h3>👁️ Просмотры страниц</h3>
        {filtered.pages.length > 0 ? (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Страница</th>
                <th>Просмотров</th>
                <th>Последний визит</th>
              </tr>
            </thead>
            <tbody>
              {filtered.pages.map(([page, entry]) => (
                <tr key={page}>
                  <td>{page}</td>
                  <td><span className={styles.count}>{entry.count}</span></td>
                  <td>{formatDate(entry.lastVisit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className={styles.empty}>Нет данных за выбранный период</p>
        )}
      </div>

      {/* Таблица форм */}
      <div className={styles.section}>
        <h3>📝 Отправленные формы</h3>
        {filtered.forms.length > 0 ? (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Тип формы</th>
                <th>Отправок</th>
                <th>Последняя отправка</th>
              </tr>
            </thead>
            <tbody>
              {filtered.forms.map(([formType, entry]) => (
                <tr key={formType}>
                  <td>{formType}</td>
                  <td><span className={styles.count}>{entry.count}</span></td>
                  <td>{formatDate(entry.lastVisit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className={styles.empty}>Нет данных за выбранный период</p>
        )}
      </div>

      <div className={styles.footer}>
        Обновлено: {formatDate(stats.lastUpdated)}
      </div>
    </div>
  );
}
