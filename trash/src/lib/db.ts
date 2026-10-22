import fs from 'fs';
import path from 'path';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';

// ============================================
// Двухрежимное ядро данных: JSON ↔ PostgreSQL
// ============================================
// Режим JSON:   синхронное чтение/запись db.json (как было)
// Режим PG:     реальные чтение/запись из PostgreSQL по таблицам
//               синхронный getDb() отдаёт кэш, обновляемый при каждом saveDb()
//               async getDbAsync() делает реальное чтение из БД
// Переключение: через файл .db-mode.json или админ-панель
// ============================================

const dbPath = path.join(process.cwd(), 'db.json');
const modePath = path.join(process.cwd(), '.db-mode.json');

export type DbMode = 'json' | 'postgres';

// ––– In-memory кэш для PostgreSQL (обновляется при чтении/записи) –––
let pgCache: Record<string, any> | null = null;
let pgCacheReady = false;
let pgCacheLoading: Promise<Record<string, any>> | null = null;

// ============================================
// Определение режима
// ============================================
export function getDbMode(): DbMode {
  try {
    if (fs.existsSync(modePath)) {
      const config = JSON.parse(fs.readFileSync(modePath, 'utf-8'));
      if (config.mode === 'postgres') return 'postgres';
    }
  } catch {}
  return (process.env.DB_MODE as DbMode) || 'json';
}

export function setDbMode(mode: DbMode): void {
  fs.writeFileSync(modePath, JSON.stringify({ mode, switchedAt: new Date().toISOString() }, null, 2));
  // При переключении сбрасываем кэш
  pgCache = null;
  pgCacheReady = false;
}

// ============================================
// JSON-режим (синхронный)
// ============================================
function getDbJson(): any {
  try {
    if (fs.existsSync(dbPath)) {
      return JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
    }
  } catch {}
  return { sliders: [], trainers: [], news: [], contacts: {} };
}

function saveDbJson(data: any): boolean {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
    return true;
  } catch {
    return false;
  }
}

// ============================================
// PostgreSQL-режим
// ============================================

/**
 * Реальная загрузка данных из PostgreSQL (новая схема cfr_*) в кэш
 */
async function loadPgData(): Promise<Record<string, any>> {
  const { loadAllFromPg } = await import('./db-new');
  const data = await loadAllFromPg();
  pgCache = data;
  pgCacheReady = true;
  return data;
}

/**
 * Асинхронная инициализация кэша (без блокировки)
 * Запускается в фоне при первом обращении в PG-режиме
 */
function ensurePgCache(): void {
  if (pgCacheReady || pgCacheLoading) return;
  pgCacheLoading = loadPgData()
    .catch(err => {
      console.error('❌ Ошибка загрузки кэша из PostgreSQL:', err);
      pgCacheReady = false;
      return {};
    })
    .finally(() => {
      pgCacheLoading = null;
    }) as Promise<Record<string, any>>;
}

/**
 * Реальная запись в PostgreSQL (новая схема cfr_*) + обновление кэша
 */
async function saveDbPg(data: Record<string, any>): Promise<boolean> {
  try {
    const { saveAllToPg } = await import('./db-new');
    await saveAllToPg(data);
    // Обновляем кэш
    pgCache = data;
    pgCacheReady = true;
    return true;
  } catch (err) {
    console.error('❌ Ошибка сохранения в PostgreSQL:', err);
    return false;
  }
}

// ============================================
// Синхронное API (совместимо с существующим кодом)
// ============================================

/**
 * Синхронное чтение данных.
 * В JSON-режиме читает db.json.
 * В PG-режиме отдаёт кэш (если готов) или JSON fallback + запускает фоновую загрузку.
 */
export const getDb = (): any => {
  const mode = getDbMode();

  if (mode === 'json') {
    return getDbJson();
  }

  // PG-режим: отдаём кэш если он готов
  if (pgCacheReady && pgCache !== null) {
    return pgCache;
  }

  // Запускаем фоновую загрузку кэша (не блокируем синхронный вызов)
  ensurePgCache();

  // Пока кэш не готов — отдаём JSON (данные не теряются)
  console.warn('⚠️ PostgreSQL кэш ещё не загружен, используем JSON fallback');
  return getDbJson();
};

/**
 * Синхронное сохранение.
 * В JSON-режиме пишет в db.json.
 * В PG-режиме обновляет кэш синхронно + запускает асинхронную запись в БД.
 */
export const saveDb = (data: any): boolean => {
  const mode = getDbMode();

  if (mode === 'json') {
    return saveDbJson(data);
  }

  // PG-режим: обновляем кэш синхронно, пишем в БД асинхронно
  pgCache = data;
  pgCacheReady = true;
  saveDbPg(data).catch(err => console.error('❌ PG save error:', err));
  return true;
};

// ============================================
// Асинхронное API (реальное чтение/запись в PG)
// ============================================

/**
 * Асинхронное чтение.
 * В JSON-режиме читает db.json.
 * В PG-режиме делает РЕАЛЬНОЕ чтение из PostgreSQL.
 * Если PostgreSQL недоступен — автоматический fallback на JSON (не падает).
 */
export const getDbAsync = async (): Promise<any> => {
  const mode = getDbMode();
  if (mode === 'json') return getDbJson();

  // Реальное чтение из БД
  try {
    return await loadPgData();
  } catch (err) {
    console.warn('⚠️ PG недоступен, fallback на JSON (getDbAsync):', err instanceof Error ? err.message : err);
    return getDbJson();
  }
};

/**
 * Асинхронное сохранение.
 * В JSON-режиме пишет в db.json.
 * В PG-режиме делает РЕАЛЬНУЮ запись в PostgreSQL.
 * Если PostgreSQL недоступен — автоматический fallback на JSON (данные не теряются).
 */
export const saveDbAsync = async (data: any): Promise<boolean> => {
  const mode = getDbMode();
  if (mode === 'json') return saveDbJson(data);

  const ok = await saveDbPg(data);
  if (!ok) {
    console.warn('⚠️ PG save недоступен, fallback на JSON (saveDbAsync)');
    return saveDbJson(data);
  }
  return true;
};

// ============================================
// Утилиты
// ============================================

/**
 * Принудительная перезагрузка кэша из БД (async)
 */
export const reloadPgCache = async (): Promise<Record<string, any>> => {
  return await loadPgData();
};

/**
 * Проверка доступности PostgreSQL
 */
export const isPgAvailable = async (): Promise<boolean> => {
  try {
    const { isPgAvailable: checkPg } = await import('./postgres');
    return await checkPg();
  } catch {
    return false;
  }
};

/**
 * Сброс кэша (форсирует перезагрузку при следующем обращении)
 */
export const resetPgCache = (): void => {
  pgCache = null;
  pgCacheReady = false;
};

// ––– Экспорт для обратной совместимости –––
export const loadDb = getDb;
export const db = { data: {} };

export default { getDb, saveDb, getDbAsync, saveDbAsync, getDbMode, setDbMode, reloadPgCache, isPgAvailable };
