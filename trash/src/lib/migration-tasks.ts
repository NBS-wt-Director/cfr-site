// ============================================
// In-memory хранилище задач миграции (F1)
// ============================================
// Хранит состояние асинхронных задач перехода на PostgreSQL.
// Каждая задача имеет уникальный taskId и массив этапов (stages).
// Polling-эндпоинт читает состояние из этой карты.
// ============================================

import { getDbAsync } from '@/lib/db';
import { saveAllToPg, loadAllFromPg } from '@/lib/db-new';
import { setDbMode } from '@/lib/db';
import { isPgAvailable } from '@/lib/postgres';

export interface Stage {
  name: string;
  status: 'pending' | 'running' | 'success' | 'error';
  message: string;
}

export interface MigrationTask {
  taskId: string;
  stages: Stage[];
  completed: boolean;
  success: boolean;
  error: string | null;
  startedAt: number;
  finishedAt: number | null;
}

// Глобальное хранилище задач (живёт в памяти серверного процесса)
const tasks = new Map<string, MigrationTask>();

/**
 * Определения этапов миграции
 */
function createStages(): Stage[] {
  return [
    { name: 'Проверка подключения к PG', status: 'pending', message: '' },
    { name: 'Экспорт данных из JSON', status: 'pending', message: '' },
    { name: 'Импорт в PG по таблицам', status: 'pending', message: '' },
    { name: 'Проверка целостности', status: 'pending', message: '' },
    { name: 'Переключение режима на PG', status: 'pending', message: '' },
  ];
}

/**
 * Создать задачу и запустить миграцию в фоне.
 * Возвращает taskId немедленно.
 */
export function startMigrationTask(): string {
  const taskId = generateTaskId();
  const task: MigrationTask = {
    taskId,
    stages: createStages(),
    completed: false,
    success: false,
    error: null,
    startedAt: Date.now(),
    finishedAt: null,
  };
  tasks.set(taskId, task);

  // Запускаем в фоне — не await
  runMigration(task).catch((err) => {
    console.error('❌ Неперехваченная ошибка миграции:', err);
    task.completed = true;
    task.success = false;
    task.error = err instanceof Error ? err.message : 'Unknown error';
    task.finishedAt = Date.now();
  });

  return taskId;
}

/**
 * Получить задачу по taskId (для polling).
 */
export function getMigrationTask(taskId: string): MigrationTask | undefined {
  return tasks.get(taskId);
}

/**
 * Удалить завершённую задачу (очистка памяти).
 */
export function deleteMigrationTask(taskId: string): void {
  tasks.delete(taskId);
}

/**
 * Сгенерировать короткий уникальный ID задачи.
 */
function generateTaskId(): string {
  return (
    Date.now().toString(36) +
    '-' +
    Math.random().toString(36).slice(2, 8)
  );
}

/**
 * Асинхронное выполнение всех этапов миграции.
 * Обновляет task.stages по мере выполнения.
 * Если этап провалился — процесс останавливается, режим не переключается.
 */
async function runMigration(task: MigrationTask): Promise<void> {
  const { stages } = task;

  // Этап 1: Проверка подключения
  stages[0].status = 'running';
  const pgAvailable = await isPgAvailable();

  if (!pgAvailable) {
    stages[0].status = 'error';
    stages[0].message = 'PostgreSQL недоступен. Запустите Docker: docker compose up -d';
    task.completed = true;
    task.success = false;
    task.error = 'PostgreSQL недоступен';
    task.finishedAt = Date.now();
    return;
  }

  stages[0].status = 'success';
  stages[0].message = 'Подключение успешно';

  // Этап 2: Экспорт из JSON
  stages[1].status = 'running';
  const jsonData = await getDbAsync();
  stages[1].status = 'success';
  stages[1].message = `Экспортировано данных: ${Object.keys(jsonData).length} таблиц`;

  // Этап 3: Импорт в PG
  stages[2].status = 'running';
  await saveAllToPg(jsonData);
  stages[2].status = 'success';
  stages[2].message = 'Данные успешно импортированы в PostgreSQL';

  // Этап 4: Проверка целостности
  stages[3].status = 'running';
  const pgData = await loadAllFromPg();
  let integrityOk = true;
  let integrityMessage = '';

  for (const key of Object.keys(jsonData)) {
    if (Array.isArray(jsonData[key])) {
      const pgCount = Array.isArray(pgData[key]) ? pgData[key].length : 0;
      const jsonCount = jsonData[key].length;

      if (pgCount < jsonCount * 0.9) {
        // 90% совпадения
        integrityOk = false;
        integrityMessage = `Несоответствие для "${key}": JSON=${jsonCount}, PG=${pgCount}`;
        break;
      }
    }
  }

  stages[3].status = integrityOk ? 'success' : 'error';
  stages[3].message = integrityOk ? 'Целостность проверена' : integrityMessage;

  if (!integrityOk) {
    task.completed = true;
    task.success = false;
    task.error = integrityMessage;
    task.finishedAt = Date.now();
    return;
  }

  // Этап 5: Переключение режима
  stages[4].status = 'running';
  setDbMode('postgres');
  stages[4].status = 'success';
  stages[4].message = 'Режим переключён на PostgreSQL';

  task.completed = true;
  task.success = true;
  task.finishedAt = Date.now();
}
