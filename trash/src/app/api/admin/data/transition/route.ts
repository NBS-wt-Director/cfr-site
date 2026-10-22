import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin } from '@/lib/auth';
import { startMigrationTask } from '@/lib/migration-tasks';

/**
 * POST /api/admin/data/transition
 * Запуск полного перехода на PostgreSQL (асинхронно с taskId).
 *
 * Возвращает немедленно { taskId, stages } — фактический прогресс
 * отслеживается через GET /api/admin/data/transition/[taskId]/status
 */
export async function POST(request: NextRequest) {
  const auth = authenticateAdmin(request);
  if (auth !== true) return auth;

  try {
    const taskId = startMigrationTask();

    return NextResponse.json({
      taskId,
      stages: [
        { name: 'Проверка подключения к PG', status: 'pending', message: '' },
        { name: 'Экспорт данных из JSON', status: 'pending', message: '' },
        { name: 'Импорт в PG по таблицам', status: 'pending', message: '' },
        { name: 'Проверка целостности', status: 'pending', message: '' },
        { name: 'Переключение режима на PG', status: 'pending', message: '' },
      ],
      message: 'Миграция запущена. Опрашивайте статус через GET /api/admin/data/transition/' + taskId + '/status',
    });
  } catch (error) {
    console.error('❌ Ошибка запуска миграции:', error);
    return NextResponse.json(
      {
        error: 'Ошибка запуска миграции',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
