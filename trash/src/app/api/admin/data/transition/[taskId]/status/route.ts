import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin } from '@/lib/auth';
import { getMigrationTask } from '@/lib/migration-tasks';

/**
 * GET /api/admin/data/transition/[taskId]/status
 * Возвращает текущий прогресс асинхронной задачи миграции.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const auth = authenticateAdmin(request);
  if (auth !== true) return auth;

  const { taskId } = await params;
  const task = getMigrationTask(taskId);

  if (!task) {
    return NextResponse.json(
      { error: 'Задача не найдена. Возможно, сервер был перезапущен.' },
      { status: 404 }
    );
  }

  return NextResponse.json({
    taskId: task.taskId,
    stages: task.stages,
    completed: task.completed,
    success: task.success,
    error: task.error,
    message: task.success
      ? '✅ Переход на PostgreSQL завершён успешно!'
      : task.error
        ? `❌ Ошибка: ${task.error}`
        : 'Миграция выполняется...',
  });
}
