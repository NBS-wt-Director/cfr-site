'use client';
import { useState, useEffect } from 'react';
import styles from './AdminDataMapping.module.css';

interface MappingEntry {
  id: number;
  entity_type: string;
  json_id: number | null;
  pg_id: number | null;
  json_name: string;
  pg_name: string;
  status: 'mapped' | 'json_only' | 'pg_only' | 'deleted' | 'included';
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface DataItem {
  id: number;
  name: string;
  [key: string]: any;
}

export default function AdminDataMapping() {
  const [activeType, setActiveType] = useState<'trainer' | 'program'>('trainer');
  const [jsonItems, setJsonItems] = useState<DataItem[]>([]);
  const [pgItems, setPgItems] = useState<DataItem[]>([]);
  const [mappings, setMappings] = useState<MappingEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Загрузка данных
  const loadData = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Загружаем маппинги
      const mappingRes = await fetch(`/api/admin/data/mapping?type=${activeType}`);
      if (mappingRes.ok) {
        const data = await mappingRes.json();
        setMappings(data.mappings || []);
      }

      // Загружаем JSON данные
      const jsonRes = await fetch('/api/db');
      if (jsonRes.ok) {
        const dbData = await jsonRes.json();
        const items = dbData[activeType === 'trainer' ? 'trainers' : 'programs'] || [];
        setJsonItems(items);
      }

      // Загружаем PG данные
      const pgRes = await fetch(`/api/admin/data/pg-items?type=${activeType}`);
      if (pgRes.ok) {
        const data = await pgRes.json();
        setPgItems(data.items || []);
      }
    } catch (err) {
      setError('Ошибка загрузки данных');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeType]);

  // Создание маппинга
  const handleMap = async (jsonId: number, pgId: number) => {
    try {
      const jsonItem = jsonItems.find((i) => i.id === jsonId);
      const pgItem = pgItems.find((i) => i.id === pgId);

      const res = await fetch('/api/admin/data/mapping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType: activeType,
          jsonId,
          pgId,
          jsonName: jsonItem?.name || '',
          pgName: pgItem?.name || '',
          status: 'mapped',
        }),
      });

      if (res.ok) {
        setSuccess('✅ Маппинг создан');
        loadData();
      }
    } catch (err) {
      setError('Ошибка создания маппинга');
    }
  };

  // Удаление записи
  const handleDelete = async (jsonId: number | null, pgId: number | null) => {
    if (!confirm('Удалить эту запись?')) return;

    try {
      const res = await fetch('/api/admin/data/mapping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType: activeType,
          jsonId,
          pgId,
          status: 'deleted',
        }),
      });

      if (res.ok) {
        setSuccess('✅ Запись удалена');
        loadData();
      }
    } catch (err) {
      setError('Ошибка удаления');
    }
  };

  // Включение в информационную зону
  const handleInclude = async (pgId: number) => {
    try {
      const pgItem = pgItems.find((i) => i.id === pgId);
      const res = await fetch('/api/admin/data/mapping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType: activeType,
          pgId,
          pgName: pgItem?.name || '',
          status: 'included',
        }),
      });

      if (res.ok) {
        setSuccess('✅ Включено в информационную зону');
        loadData();
      }
    } catch (err) {
      setError('Ошибка включения');
    }
  };

  const mappedJsonIds = new Set(mappings.filter((m) => m.status === 'mapped' && m.json_id).map((m) => m.json_id));
  const mappedPgIds = new Set(mappings.filter((m) => m.status === 'mapped' && m.pg_id).map((m) => m.pg_id));

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>🔗 Маппинг данных</h2>
        <p>Ручное сопоставление объектов между JSON и PostgreSQL</p>
      </div>

      {/* Переключатель типа */}
      <div className={styles.typeSelector}>
        <button
          className={`${styles.typeButton} ${activeType === 'trainer' ? styles.active : ''}`}
          onClick={() => setActiveType('trainer')}
        >
          👨‍🏫 Тренеры
        </button>
        <button
          className={`${styles.typeButton} ${activeType === 'program' ? styles.active : ''}`}
          onClick={() => setActiveType('program')}
        >
          🎯 Программы
        </button>
      </div>

      {/* Статистика */}
      <div className={styles.stats}>
        <div className={styles.statItem}>
          <span className={styles.statNumber}>{jsonItems.length}</span>
          <span className={styles.statLabel}>В JSON</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statNumber}>{pgItems.length}</span>
          <span className={styles.statLabel}>В PG</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statNumber}>{mappings.filter((m) => m.status === 'mapped').length}</span>
          <span className={styles.statLabel}>Сопоставлено</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statNumber}>{jsonItems.length - mappedJsonIds.size}</span>
          <span className={styles.statLabel}>Не сопоставлено (JSON)</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statNumber}>{pgItems.length - mappedPgIds.size}</span>
          <span className={styles.statLabel}>Не сопоставлено (PG)</span>
        </div>
      </div>

      {/* Ошибки и успех */}
      {error && <div className={styles.error}>{error}</div>}
      {success && <div className={styles.success}>{success}</div>}

      {loading ? (
        <div className={styles.loading}>Загрузка...</div>
      ) : (
        <div className={styles.mappingGrid}>
          {/* JSON данные */}
          <div className={styles.column}>
            <h3 className={styles.columnHeader}>📦 JSON (старые данные)</h3>
            <div className={styles.columnContent}>
              {jsonItems.map((item) => {
                const isMapped = mappedJsonIds.has(item.id);
                const isDeleted = mappings.some((m) => m.json_id === item.id && m.status === 'deleted');

                return (
                  <div
                    key={item.id}
                    className={`${styles.item} ${isMapped ? styles.mapped : ''} ${isDeleted ? styles.deleted : ''}`}
                  >
                    <div className={styles.itemName}>{item.name || `ID: ${item.id}`}</div>
                    <div className={styles.itemActions}>
                      {!isMapped && !isDeleted && (
                        <select
                          className={styles.select}
                          onChange={(e) => {
                            if (e.target.value) handleMap(item.id, parseInt(e.target.value));
                          }}
                        >
                          <option value="">→ Сопоставить с PG</option>
                          {pgItems
                            .filter((p) => !mappedPgIds.has(p.id))
                            .map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name || `ID: ${p.id}`}
                              </option>
                            ))}
                        </select>
                      )}
                      {isMapped && (
                        <span className={styles.statusBadge}>✅ Сопоставлено</span>
                      )}
                      {isDeleted && (
                        <span className={styles.statusBadgeDeleted}>🗑️ Удалено</span>
                      )}
                      <button
                        className={styles.deleteBtn}
                        onClick={() => handleDelete(item.id, null)}
                        disabled={isMapped}
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* PG данные */}
          <div className={styles.column}>
            <h3 className={styles.columnHeader}>🗄️ PostgreSQL (новые данные)</h3>
            <div className={styles.columnContent}>
              {pgItems.map((item) => {
                const isMapped = mappedPgIds.has(item.id);
                const isIncluded = mappings.some((m) => m.pg_id === item.id && m.status === 'included');

                return (
                  <div
                    key={item.id}
                    className={`${styles.item} ${isMapped ? styles.mapped : ''} ${isIncluded ? styles.included : ''}`}
                  >
                    <div className={styles.itemName}>{item.name || `ID: ${item.id}`}</div>
                    <div className={styles.itemActions}>
                      {!isMapped && !isIncluded && (
                        <button
                          className={styles.includeBtn}
                          onClick={() => handleInclude(item.id)}
                        >
                          📥 Включить в инфо-зону
                        </button>
                      )}
                      {isMapped && (
                        <span className={styles.statusBadge}>✅ Сопоставлено</span>
                      )}
                      {isIncluded && (
                        <span className={styles.statusBadgeIncluded}>📥 В инфо-зоне</span>
                      )}
                      <button
                        className={styles.deleteBtn}
                        onClick={() => handleDelete(null, item.id)}
                        disabled={isMapped || isIncluded}
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
