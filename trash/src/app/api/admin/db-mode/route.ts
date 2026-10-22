/**
 * API: Переключение режима данных (JSON ↔ PostgreSQL)
 * GET  /api/admin/db-mode — текущий режим + статус PG
 * POST /api/admin/db-mode — переключение режима
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDbMode, setDbMode, isPgAvailable, reloadPgCache } from '@/lib/db';
import { authenticateAdmin } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const auth = authenticateAdmin(request);
  if (auth !== true) return auth;
  try {
    const currentMode = getDbMode();
    const pgAvailable = currentMode === 'postgres' ? true : await isPgAvailable();

    return NextResponse.json({
      mode: currentMode,
      pgAvailable,
      switchedAt: null, // можно добавить из файла режима
    });
  } catch (error) {
    console.error('❌ Ошибка получения режима:', error);
    return NextResponse.json({ mode: 'json', pgAvailable: false }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = authenticateAdmin(request);
  if (auth !== true) return auth;

  const contentType = request.headers.get('content-type');
  if (!contentType?.includes('application/json')) {
    return NextResponse.json({ error: 'Неверный Content-Type' }, { status: 415 });
  }

  try {
    const body = await request.json();
    const { mode } = body;

    if (mode !== 'json' && mode !== 'postgres') {
      return NextResponse.json({
        success: false,
        error: 'Режим должен быть "json" или "postgres"',
      }, { status: 400 });
    }

    // Если переключаемся на PG — проверяем доступность
    if (mode === 'postgres') {
      const pgAvailable = await isPgAvailable();
      if (!pgAvailable) {
        return NextResponse.json({
          success: false,
          error: 'PostgreSQL недоступен. Запустите Docker: docker compose up -d',
        }, { status: 503 });
      }
    }

    // Устанавливаем режим
    setDbMode(mode);

    // Если переключились на PG — перезагружаем кэш
    if (mode === 'postgres') {
      await reloadPgCache().catch(err => {
        console.error('⚠️ Ошибка перезагрузки кэша после переключения:', err);
      });
    }

    return NextResponse.json({
      success: true,
      mode,
      message: mode === 'postgres'
        ? '✅ Переключено на PostgreSQL'
        : '✅ Переключено на JSON',
    });
  } catch (error) {
    console.error('❌ Ошибка переключения режима:', error);
    return NextResponse.json({
      success: false,
      error: 'Ошибка переключения режима',
    }, { status: 500 });
  }
}