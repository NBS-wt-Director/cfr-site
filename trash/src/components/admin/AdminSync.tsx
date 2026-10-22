'use client';
import { useState, useEffect } from 'react';
import styles from './AdminSync.module.css';

interface SyncStatus {
  success: boolean;
  total: number;
  byStatus: Record<string, number>;
  last7d: {
    total: number;
    processed: number;
    errors: number;
    records: number;
    last_success: string | null;
  };
  recent: Array<{
    id: number;
    file_name: string;
    entity: string;
    status: string;
    records_count: number;
    created_at: string;
    processed_at: string | null;
    error_msg: string | null;
  }>;
}

interface SyncLog {
  type: 'info' | 'success' | 'error' | 'warning';
  message: string;
  timestamp: string;
}

export default function AdminSync() {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [log, setLog] = useState<SyncLog[]>([]);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Загрузка статуса
  const loadStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/bridge/sync');
      const data = await res.json();
      if (data.success) {
        setStatus(data);
        addLog('info', 'Статус синхронизации обновлён');
      } else if (data.pgUnavailable) {
        addLog('warning', 'PostgreSQL недоступен — синхронизация не работает');
      }
    } catch (err) {
      addLog('error', 'Ошибка загрузки статуса: ' + (err instanceof Error ? err.message : 'Unknown'));
    } finally {
      setLoading(false);
    }
  };

  // Ручная синхронизация
  const handleSync = async () => {
    setSyncing(true);
    addLog('info', 'Запуск синхронизации...');
    
    try {
      const res = await fetch('/api/bridge/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync' }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        addLog('success', `✅ ${data.message}`);
        // Перезагружаем статус
        await loadStatus();
      } else {
        addLog('error', `❌ ${data.error || 'Ошибка синхронизации'}`);
      }
    } catch (err) {
      addLog('error', '❌ Ошибка сети: ' + (err instanceof Error ? err.message : 'Unknown'));
    } finally {
      setSyncing(false);
    }
  };

  // Сброс очереди
  const handleReset = async () => {
    setShowResetConfirm(false);
    addLog('warning', 'Сброс очереди...');
    
    try {
      const res = await fetch('/api/bridge/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        addLog('success', `✅ Очередь сброшена. Удалено пакетов: ${data.deleted}`);
        await loadStatus();
      } else {
        addLog('error', `❌ ${data.error || 'Ошибка сброса'}`);
      }
    } catch (err) {
      addLog('error', '❌ Ошибка сети: ' + (err instanceof Error ? err.message : 'Unknown'));
    }
  };

  const addLog = (type: SyncLog['type'], message: string) => {
    const newLog: SyncLog = {
      type,
      message,
      timestamp: new Date().toLocaleTimeString('ru-RU'),
    };
    setLog(prev => [newLog, ...prev].slice(0, 50));
  };

  useEffect(() => {
    loadStatus();
    
    // Автообновление каждые 30 секунд
    const interval = setInterval(loadStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  // Форматирование статуса пакета
  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      received: '#f59e0b',
      processing: '#3b82f6',
      completed: '#10b981',
      error: '#ef4444',
    };
    const labels: Record<string, string> = {
      received: '⏳ Ожидание',
      processing: '🔄 Обработка',
      completed: '✅ Готово',
      error: '❌ Ошибка',
    };
    return (
      <span className={styles.badge} style={{ backgroundColor: colors[status] || '#6b7280' }}>
        {labels[status] || status}
      </span>
    );
  };

  return (
    <div className={styles.container}>
      {/* Заголовок */}
      <div className={styles.header}>
        <h2 className={styles.title}>🔄 Синхронизация данных</h2>
        <p className={styles.subtitle}>
          Синхронизация данных между админским ПК (DanceStudio XML) и сайтом
        </p>
      </div>

      {/* Основная кнопка синхронизации */}
      <div className={styles.syncSection}>
        <button
          className={`${styles.syncButton} ${syncing ? styles.syncing : ''}`}
          onClick={handleSync}
          disabled={syncing}
        >
          {syncing ? (
            <>
              <span className={styles.spinner}>⏳</span>
              Синхронизация...
            </>
          ) : (
            <>
              <span className={styles.icon}>📥</span>
              Получить данные
            </>
          )}
        </button>
        
        {status && status.total > 0 && (
          <p className={styles.pendingNote}>
            В очереди: {status.byStatus.received || 0} пакетов
          </p>
        )}
      </div>

      {/* Статистика */}
      {status && (
        <div className={styles.statsGrid}>
          {/* Всего пакетов */}
          <div className={styles.statCard}>
            <div className={styles.statIcon}>📦</div>
            <div className={styles.statValue}>{status.total}</div>
            <div className={styles.statLabel}>Всего пакетов</div>
          </div>
          
          {/* Обработано за 7 дней */}
          <div className={styles.statCard}>
            <div className={styles.statIcon}>✅</div>
            <div className={styles.statValue}>{status.last7d.processed}</div>
            <div className={styles.statLabel}>Обработано (7 дней)</div>
          </div>
          
          {/* Ошибок за 7 дней */}
          <div className={styles.statCard}>
            <div className={styles.statIcon}>❌</div>
            <div className={styles.statValue}>{status.last7d.errors}</div>
            <div className={styles.statLabel}>Ошибок (7 дней)</div>
          </div>
          
          {/* Записей за 7 дней */}
          <div className={styles.statCard}>
            <div className={styles.statIcon}>📊</div>
            <div className={styles.statValue}>{status.last7d.records}</div>
            <div className={styles.statLabel}>Записей (7 дней)</div>
          </div>
        </div>
      )}

      {/* Статус по типам */}
      {status && Object.keys(status.byStatus).length > 0 && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Статус пакетов</h3>
          <div className={styles.statusRow}>
            {Object.entries(status.byStatus).map(([statusType, count]) => (
              <div key={statusType} className={styles.statusItem}>
                {getStatusBadge(statusType)}
                <span className={styles.statusCount}>{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Последние пакеты */}
      {status && status.recent.length > 0 && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Последние пакеты</h3>
          <div className={styles.recentTable}>
            <div className={styles.tableHeader}>
              <span>Файл</span>
              <span>Сущность</span>
              <span>Статус</span>
              <span>Записей</span>
              <span>Дата</span>
            </div>
            {status.recent.map((packet) => (
              <div key={packet.id} className={styles.tableRow}>
                <span className={styles.fileName}>{packet.file_name}</span>
                <span className={styles.entityName}>{packet.entity}</span>
                <span>{getStatusBadge(packet.status)}</span>
                <span>{packet.records_count}</span>
                <span className={styles.date}>
                  {new Date(packet.created_at).toLocaleDateString('ru-RU')} {new Date(packet.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Лог */}
      <div className={styles.section}>
        <div className={styles.logHeader}>
          <h3 className={styles.sectionTitle}>Журнал действий</h3>
          <button className={styles.clearLog} onClick={() => setLog([])}>
            Очистить
          </button>
        </div>
        <div className={styles.logContainer}>
          {log.length === 0 ? (
            <div className={styles.emptyLog}>Журнал пуст</div>
          ) : (
            log.map((entry, index) => (
              <div key={index} className={`${styles.logEntry} ${styles[entry.type]}`}>
                <span className={styles.logTime}>{entry.timestamp}</span>
                <span className={styles.logMessage}>{entry.message}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Кнопка сброса очереди */}
      {status && (status.byStatus.pending || 0) > 0 && (
        <div className={styles.section}>
          <div className={styles.resetSection}>
            <p className={styles.resetWarning}>
              ⚠️ В очереди есть неотправленные пакеты. Сброс удалит все пакеты со статусами: ожидание, обработка, ошибка.
            </p>
            {!showResetConfirm ? (
              <button
                className={styles.resetButton}
                onClick={() => setShowResetConfirm(true)}
              >
                🗑 Сбросить очередь
              </button>
            ) : (
              <div className={styles.resetConfirm}>
                <span>Подтвердить сброс?</span>
                <div className={styles.resetButtons}>
                  <button className={styles.confirmYes} onClick={handleReset}>
                    Да, сбросить
                  </button>
                  <button className={styles.confirmNo} onClick={() => setShowResetConfirm(false)}>
                    Отмена
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Инфо о мосте */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>ℹ️ Информация о мосте</h3>
        <div className={styles.infoGrid}>
          <div className={styles.infoItem}>
            <strong>Мост:</strong> PowerShell-агент на админском ПК
          </div>
          <div className={styles.infoItem}>
            <strong>Формат:</strong> Пакеты JSON через REST API
          </div>
          <div className={styles.infoItem}>
            <strong>Автозапуск:</strong> Task Scheduler (при входе в систему)
          </div>
          <div className={styles.infoItem}>
            <strong>Интервал:</strong> Настраиваемый (по умолчанию 60 сек)
          </div>
          <div className={styles.infoItem}>
            <strong>Ручной запуск:</strong> <code>.\bridge_agent.ps1 -manual</code>
          </div>
          <div className={styles.infoItem}>
            <strong>Последняя успех:</strong>{' '}
            {status?.last7d.last_success
              ? new Date(status.last7d.last_success).toLocaleString('ru-RU')
              : 'Нет данных'}
          </div>
        </div>
      </div>
    </div>
  );
}
