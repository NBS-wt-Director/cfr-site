/**
 * Двухрежимный доступ к данным: PostgreSQL → JSON fallback.
 *
 * «Двухрежимный» — поддерживает ОБА режима:
 *   - по умолчанию (если нет PG / DB_MODE=json) — JSON (db.json);
 *   - иначе (DB_MODE=postgres) — PostgreSQL, при ошибке — автоматический fallback на JSON.
 *
 * Используется во всех публичных и админских API маршрутах.
 */

import { getDbMode, getDb, saveDb, type DbMode } from './db';

// ============================================
// ЧТЕНИЕ
// ============================================

/**
 * Универсальный двухрежимный геттер.
 *
 * @param pgLoader  — функция реального чтения из PostgreSQL (async)
 * @param jsonGetter — функция синхронного чтения из JSON (db.json)
 * @returns данные из PG (если режим postgres и PG доступен) либо из JSON
 *
 * Поведение:
 *  - DB_MODE=json           → jsonGetter()
 *  - DB_MODE=postgres + OK  → pgLoader()
 *  - DB_MODE=postgres + err → jsonGetter()  (автоматический fallback)
 */
export async function getDataDual<T>(
  pgLoader: () => Promise<T>,
  jsonGetter: () => T,
): Promise<T> {
  const mode: DbMode = getDbMode();

  if (mode === 'postgres') {
    try {
      return await pgLoader();
    } catch (err) {
      console.warn('⚠️ PG недоступен, fallback на JSON:', err instanceof Error ? err.message : err);
      return jsonGetter();
    }
  }

  return jsonGetter();
}

// ============================================
// ЗАПИСЬ
// ============================================

/**
 * Универсальный двухрежимный сеттер.
 *
 * @param pgSaver   — функция реальной записи в PostgreSQL (async)
 * @param jsonSaver — функция записи в JSON (db.json), синхронная, возвращает boolean
 * @param data      — данные для сохранения
 *
 * Поведение:
 *  - DB_MODE=json           → jsonSaver(data)
 *  - DB_MODE=postgres + OK  → pgSaver(data)
 *  - DB_MODE=postgres + err → jsonSaver(data)  (fallback, данные не теряются)
 */
export async function saveDataDual<T>(
  pgSaver: (data: T) => Promise<boolean>,
  jsonSaver: (data: T) => boolean,
  data: T,
): Promise<boolean> {
  const mode: DbMode = getDbMode();

  if (mode === 'postgres') {
    try {
      return await pgSaver(data);
    } catch (err) {
      console.warn('⚠️ PG save недоступен, fallback на JSON:', err instanceof Error ? err.message : err);
      return jsonSaver(data);
    }
  }

  return jsonSaver(data);
}

// ============================================
// УДОБНЫЕ ХЕЛПЕРЫ ДЛЯ КОНКРЕТНЫХ СУЩНОСТЕЙ
// ============================================
// Каждый хелпер инкапсулирует связку «PG-функция из db-new» + «поле из getDb()».

import {
  getAllNews as pgGetAllNews,
  getAllTrainers as pgGetAllTrainers,
  getAllPrograms as pgGetAllPrograms,
  getAllEmployees as pgGetAllEmployees,
} from './db-new';

/** Новости: PG (cfr_media) → JSON (db.news) */
export async function getNewsDual() {
  return getDataDual(pgGetAllNews, () => getDb()?.news || []);
}

/** Тренеры: PG (cfr_teachers+cfr_persons) → JSON (db.trainers) */
export async function getTrainersDual() {
  return getDataDual(pgGetAllTrainers, () => getDb()?.trainers || []);
}

/** Программы: PG (cfr_entities) → JSON (db.programs) */
export async function getProgramsDual() {
  return getDataDual(pgGetAllPrograms, () => getDb()?.programs || []);
}

/** Сотрудники: PG (cfr_teachers) → JSON (db.employees) */
export async function getEmployeesDual() {
  return getDataDual(pgGetAllEmployees, () => getDb()?.employees || []);
}

/**
 * Один тренер по id: PG (getAllTrainers + find) → JSON (db.trainers.find).
 * Возвращает null если не найден ни в PG, ни в JSON.
 */
export async function getTrainerByIdDual(id: string) {
  return getDataDual(
    async () => {
      const all = await pgGetAllTrainers();
      return all.find((t: any) => String(t.id) === id) || null;
    },
    () => {
      const trainers = getDb()?.trainers || [];
      return trainers.find((t: any) => String(t.id) === id) || null;
    },
  );
}

/**
 * Одна программа по id: PG (getAllPrograms + find) → JSON (db.programs.find).
 * Возвращает null если не найдена.
 */
export async function getProgramByIdDual(id: string) {
  return getDataDual(
    async () => {
      const all = await pgGetAllPrograms();
      return all.find((p: any) => String(p.id) === id) || null;
    },
    () => {
      const programs = getDb()?.programs || [];
      return programs.find((p: any) => String(p.id) === id) || null;
    },
  );
}

// ============================================
// СОХРАНЕНИЕ ВСЕЙ БД (для /api/db POST)
// ============================================

/**
 * Двухрежимное сохранение всего объекта данных.
 * PG: saveAllToPg → при ошибке fallback на saveDb (JSON).
 * JSON: saveDb (db.json).
 */
export async function saveAllDual(data: Record<string, any>): Promise<boolean> {
  const mode: DbMode = getDbMode();

  if (mode === 'postgres') {
    try {
      const { saveAllToPg } = await import('./db-new');
      await saveAllToPg(data);
      return true;
    } catch (err) {
      console.warn('⚠️ PG save недоступен, fallback на JSON (saveAllDual):', err instanceof Error ? err.message : err);
      return saveDb(data);
    }
  }

  return saveDb(data);
}

/**
 * Двухрежимное чтение всего объекта данных.
 * PG: loadAllFromPg → при ошибке fallback на getDb (JSON).
 * JSON: getDb (db.json).
 */
export async function loadAllDual(): Promise<Record<string, any>> {
  const mode: DbMode = getDbMode();

  if (mode === 'postgres') {
    try {
      const { loadAllFromPg } = await import('./db-new');
      return await loadAllFromPg();
    } catch (err) {
      console.warn('⚠️ PG load недоступен, fallback на JSON (loadAllDual):', err instanceof Error ? err.message : err);
      return getDb();
    }
  }

  return getDb();
}

export default { getDataDual, saveDataDual, getNewsDual, getTrainersDual, getProgramsDual, getEmployeesDual, getTrainerByIdDual, getProgramByIdDual, saveAllDual, loadAllDual };
