'use client';
import { useState, useEffect } from 'react';
import styles from './AdminDataTab.module.css';
import AdminDataMapping from './AdminDataMapping';

interface MigrationStatus {
  pgAvailable: boolean;
  history: any[];
  tableCounts: Record<string, number>;
  jsonRecords: number;
  lastMigrated: any | null;
}

interface DbModeResponse {
  mode: string;
  pgAvailable: boolean;
}

interface PgStatus {
  mode: string;
  pgAvailable: boolean;
  connectionTime: number | null;
  tables: Array<{ table_name: string; record_count: string }>;
  totalRecords: number;
}

export default function AdminDataTab() {
  const [activeSection, setActiveSection] = useState<'mapping' | 'data' | 'settings' | 'transition'>('data');
  const [status, setStatus] = useState<MigrationStatus | null>(null);
  const [mode, setMode] = useState<string>('json');
  const [pgAvailable, setPgAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [migrating, setMigrating] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [progress, setProgress] = useState(0);
  const [pgStatus, setPgStatus] = useState<PgStatus | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const [transitionStages, setTransitionStages] = useState<any[]>([]);

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const [modeRes, migrateRes, statusRes] = await Promise.all([
        fetch('/api/admin/db-mode'),
        fetch('/api/admin/migrate-db'),
        fetch('/api/admin/data/status'),
      ]);
      const modeData: DbModeResponse = await modeRes.json();
      const migrateData: MigrationStatus = await migrateRes.json();
      const pgData: PgStatus = await statusRes.json();

      setMode(modeData.mode);
      setPgAvailable(modeData.pgAvailable);
      setStatus(migrateData);
      setPgStatus(pgData);
    } catch (err) {
      setMessage({ type: 'error', text: 'Ошибка загрузки статуса' });
    } finally {
      setLoading(false);
    }
  };

  const handleMigrate = async () => {
    setMigrating(true);
    setMessage(null);
    setProgress(10);

    try {
      const progressInterval = setInterval(() => {
        setProgress(p => Math.min(p + 10, 80));
      }, 500);

      const res = await fetch('/api/admin/migrate-db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'migrate' }),
      });

      clearInterval(progressInterval);
      setProgress(100);

      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: data.message });
        setTimeout(() => loadStatus(), 1000);
      } else {
        setMessage({ type: 'error', text: data.error || 'Ошибка миграции' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Ошибка соединения с сервером' });
    } finally {
      setMigrating(false);
      setProgress(0);
    }
  };

  const handleSwitchMode = async (newMode: string) => {
    setSwitching(true);
    setMessage(null);

    try {
      const res = await fetch('/api/admin/db-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: newMode }),
      });

      const data = await res.json();
      if (data.success) {
        setMode(newMode);
        setMessage({ type: 'success', text: data.message });
        setTimeout(() => loadStatus(), 1000);
      } else {
        setMessage({ type: 'error', text: data.error || 'Ошибка переключения' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Ошибка соединения с сервером' });
    } finally {
      setSwitching(false);
    }
  };

  const handleCheckPg = async () => {
    setMessage(null);
    try {
      const res = await fetch('/api/admin/db-mode');
      const data: DbModeResponse = await res.json();
      setPgAvailable(data.pgAvailable);
      setMessage({
        type: data.pgAvailable ? 'success' : 'error',
        text: data.pgAvailable
          ? '✅ PostgreSQL доступен'
          : '❌ PostgreSQL недоступен. Запустите Docker: docker compose up -d',
      });
    } catch (err) {
      setMessage({ type: 'error', text: 'Ошибка проверки соединения' });
    }
  };

  const handleTransition = async () => {
    if (!confirm('Начать полный переход на PostgreSQL? Это займёт несколько минут.')) return;
    
    setTransitioning(true);
    setTransitionStages([]);
    setMessage(null);

    try {
      const res = await fetch('/api/admin/data/transition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();
      setTransitionStages(data.stages || []);

      if (data.success) {
        setMessage({ type: 'success', text: data.message });
        setTimeout(() => loadStatus(), 1000);
      } else {
        setMessage({ type: 'error', text: data.error || 'Ошибка перехода' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Ошибка соединения с сервером' });
    } finally {
      setTransitioning(false);
    }
  };

  const handleExport = async (type: 'json' | 'pg') => {
    try {
      const endpoint = type === 'json' ? '/api/admin/data/settings?action=export-json-file' : '/api/admin/data/settings?action=export-pg-json-file';
      const res = await fetch(endpoint, { method: 'POST' });
      
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = type === 'json' ? 'cfr-data-export.json' : 'cfr-pg-export.json';
        a.click();
        window.URL.revokeObjectURL(url);
        setMessage({ type: 'success', text: `✅ Данные экспортированы (${type === 'json' ? 'JSON' : 'PG'})` });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Ошибка экспорта' });
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>, type: 'json' | 'pg') => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/admin/data/settings', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: data.message });
        setTimeout(() => loadStatus(), 1000);
      } else {
        setMessage({ type: 'error', text: data.error || 'Ошибка импорта' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Ошибка соединения с сервером' });
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Загрузка статуса данных...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>🗄️ Управление данными</h3>
        <p className={styles.description}>
          Двухрежимное хранение данных: JSON (файл) или PostgreSQL (база данных в Docker).
        </p>
      </div>

      {/* Навигация по секциям */}
      <div className={styles.sectionTabs}>
        <button
          className={`${styles.sectionTab} ${activeSection === 'mapping' ? styles.sectionTabActive : ''}`}
          onClick={() => setActiveSection('mapping')}
        >
          🔗 Маппинг данных
        </button>
        <button
          className={`${styles.sectionTab} ${activeSection === 'data' ? styles.sectionTabActive : ''}`}
          onClick={() => setActiveSection('data')}
        >
          📊 Данные
        </button>
        <button
          className={`${styles.sectionTab} ${activeSection === 'settings' ? styles.sectionTabActive : ''}`}
          onClick={() => setActiveSection('settings')}
        >
          ⚙️ Настройки
        </button>
        <button
          className={`${styles.sectionTab} ${activeSection === 'transition' ? styles.sectionTabActive : ''}`}
          onClick={() => setActiveSection('transition')}
        >
          🚀 Переход на PG
        </button>
      </div>

      {/* Секция: Маппинг данных */}
      {activeSection === 'mapping' && (
        <AdminDataMapping />
      )}

      {/* Секция: Данные */}
      {activeSection === 'data' && (
        <>
          {/* Текущий режим */}
          <div className={styles.modeCard}>
            <div className={styles.modeHeader}>
              <span className={styles.modeLabel}>Текущий режим:</span>
              <span className={`${styles.modeBadge} ${mode === 'postgres' ? styles.modePg : styles.modeJson}`}>
                {mode === 'postgres' ? '🐘 PostgreSQL' : '📄 JSON'}
              </span>
              <span className={`${styles.statusDot} ${pgAvailable ? styles.statusOk : styles.statusFail}`}></span>
              <span className={styles.statusText}>
                {pgAvailable ? 'PG доступен' : 'PG недоступен'}
              </span>
              <button
                className={styles.checkBtn}
                onClick={handleCheckPg}
                disabled={switching}
              >
                🔄 Проверить
              </button>
            </div>
          </div>

          {/* Статистика */}
          {status && (
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <div className={styles.statValue}>{status.jsonRecords}</div>
                <div className={styles.statLabel}>Записей в JSON</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statValue}>
                  {status.tableCounts ? Object.values(status.tableCounts).reduce((a: number, b: number) => a + b, 0) : 0}
                </div>
                <div className={styles.statLabel}>Записей в PG</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statValue}>{status.history?.length || 0}</div>
                <div className={styles.statLabel}>Миграций выполнено</div>
              </div>
            </div>
          )}

          {/* Детальная статистика по таблицам */}
          {pgStatus?.tables && pgStatus.tables.length > 0 && (
            <div className={styles.tableStats}>
              <h4>📊 Статистика по таблицам PG</h4>
              <div className={styles.tableGrid}>
                {pgStatus.tables.map((table) => (
                  <div key={table.table_name} className={styles.tableStatItem}>
                    <span className={styles.tableName}>{table.table_name}</span>
                    <span className={styles.tableCount}>{table.record_count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* История миграций */}
          {status?.history && status.history.length > 0 && (
            <div className={styles.historyCard}>
              <h4>📜 История миграций</h4>
              {status.history.slice(0, 5).map((h: any, i: number) => (
                <div key={h.id || i} className={styles.historyItem}>
                  <span className={styles.historyDate}>
                    {new Date(h.migrated_at).toLocaleString('ru-RU')}
                  </span>
                  <span className={styles.historySource}>Источник: {h.source}</span>
                  <span className={styles.historyRecords}>{h.records} записей</span>
                </div>
              ))}
            </div>
          )}

          {/* Действия */}
          <div className={styles.actions}>
            {/* Миграция */}
            <div className={styles.actionCard}>
              <h4>📥 Перенести данные в PostgreSQL</h4>
              <p>Перенесёт все данные из db.json в PostgreSQL с разбивкой по таблицам.</p>
              {migrating && (
                <div className={styles.progressBar}>
                  <div className={styles.progressFill} style={{ width: `${progress}%` }}></div>
                </div>
              )}
              <button
                className={styles.migrateBtn}
                onClick={handleMigrate}
                disabled={migrating || !pgAvailable}
              >
                {migrating ? '⏳ Перенос...' : '🚀 Перенести данные в БД'}
              </button>
              {!pgAvailable && (
                <p className={styles.hint}>PostgreSQL недоступен. Сначала запустите Docker.</p>
              )}
            </div>

            {/* Переключение */}
            <div className={styles.actionCard}>
              <h4>🔄 Переключить режим</h4>
              <p>
                {mode === 'json'
                  ? 'Переключиться на PostgreSQL. Данные будут читаться из БД.'
                  : 'Переключиться на JSON. Данные будут читаться из файла db.json.'}
              </p>
              {mode === 'json' ? (
                <button
                  className={styles.switchToPgBtn}
                  onClick={() => handleSwitchMode('postgres')}
                  disabled={switching || !pgAvailable}
                >
                  {switching ? '⏳ Переключение...' : '🐘 Переключить на PostgreSQL'}
                </button>
              ) : (
                <button
                  className={styles.switchToJsonBtn}
                  onClick={() => handleSwitchMode('json')}
                  disabled={switching}
                >
                  {switching ? '⏳ Переключение...' : '📄 Переключить на JSON'}
                </button>
              )}
              {mode === 'postgres' && pgAvailable && (
                <p className={styles.hintSuccess}>✅ Сайт работает через PostgreSQL</p>
              )}
            </div>
          </div>
        </>
      )}

      {/* Секция: Настройки */}
      {activeSection === 'settings' && (
        <div className={styles.settingsSection}>
          <div className={styles.actionCard}>
            <h4>📤 Экспорт данных</h4>
            <p>Скачать данные в JSON формате для резервной копии</p>
            <div className={styles.exportButtons}>
              <button className={styles.exportBtn} onClick={() => handleExport('json')}>
                📄 Экспорт JSON → файл
              </button>
              <button className={styles.exportBtn} onClick={() => handleExport('pg')}>
                🐘 Экспорт PG → файл
              </button>
            </div>
          </div>

          <div className={styles.actionCard}>
            <h4>📥 Импорт данных</h4>
            <p>Загрузить данные из JSON файла</p>
            <div className={styles.importButtons}>
              <label className={styles.importLabel}>
                <input
                  type="file"
                  accept=".json"
                  onChange={(e) => handleImport(e, 'json')}
                  style={{ display: 'none' }}
                />
                <span className={styles.importBtn}>📄 Импорт JSON → PG</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Секция: Переход на PG */}
      {activeSection === 'transition' && (
        <div className={styles.transitionSection}>
          <div className={styles.actionCard}>
            <h4>🚀 Полный переход на PostgreSQL</h4>
            <p>
              Автоматически перенесёт все данные из JSON в PostgreSQL, проверит целостность
              и переключит режим работы.
            </p>
            <p className={styles.hintWarning}>
              ⚠️ Этот процесс займёт несколько минут. Не закрывайте страницу.
            </p>
            <button
              className={styles.transitionBtn}
              onClick={handleTransition}
              disabled={transitioning || !pgAvailable}
            >
              {transitioning ? '⏳ Переход...' : '🚀 Начать полный переход на PG'}
            </button>
          </div>

          {transitionStages.length > 0 && (
            <div className={styles.stagesCard}>
              <h4>📊 Прогресс перехода</h4>
              {transitionStages.map((stage, i) => (
                <div key={i} className={`${styles.stageItem} ${styles[`stage${stage.status}`]}`}>
                  <span className={styles.stageIcon}>
                    {stage.status === 'success' ? '✅' : stage.status === 'error' ? '❌' : stage.status === 'running' ? '⏳' : '⏸️'}
                  </span>
                  <div className={styles.stageContent}>
                    <span className={styles.stageName}>{stage.name}</span>
                    <span className={styles.stageMessage}>{stage.message}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Сообщение */}
      {message && (
        <div className={`${styles.message} ${message.type === 'success' ? styles.msgSuccess : message.type === 'error' ? styles.msgError : styles.msgInfo}`}>
          {message.text}
        </div>
      )}
    </div>
  );
}