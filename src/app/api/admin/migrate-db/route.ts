/**
 * API: Миграция данных из db.json в PostgreSQL
 * POST /api/admin/migrate-db — перенос данных
 * GET  /api/admin/migrate-db — статус миграции
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb, getDbAsync } from '@/lib/db';
import { isPgAvailable, getTableCounts, logMigration, getMigrationHistory } from '@/lib/postgres';
import { saveAllToPg } from '@/lib/db-new';
import fs from 'fs';
import path from 'path';
import { authenticateAdmin } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const auth = authenticateAdmin(request);
  if (auth !== true) return auth;
  try {
    const pgAvailable = await isPgAvailable();
    const history = pgAvailable ? await getMigrationHistory().catch(() => []) : [];
    const counts = pgAvailable ? await getTableCounts().catch(() => ({})) : {};

    // Читаем db.json для подсчёта записей
    const dbPath = path.join(process.cwd(), 'db.json');
    let jsonRecords = 0;
    if (fs.existsSync(dbPath)) {
      try {
        const dbData = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
        jsonRecords = Object.values(dbData).reduce((sum: number, val: any) => {
          if (Array.isArray(val)) return sum + val.length;
          if (typeof val === 'object' && val !== null) return sum + 1;
          return sum;
        }, 0);
      } catch {}
    }

    return NextResponse.json({
      pgAvailable,
      history,
      tableCounts: counts,
      jsonRecords,
      lastMigrated: history.length > 0 ? history[0] : null,
    });
  } catch (error) {
    console.error('❌ Ошибка статуса миграции:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
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
    const body = await request.json().catch(() => ({}));
    const { action = 'migrate' } = body;

    // Проверка доступности PG
    const pgAvailable = await isPgAvailable();
    if (!pgAvailable) {
      return NextResponse.json({
        success: false,
        error: 'PostgreSQL недоступен. Запустите Docker: docker compose up -d',
      }, { status: 503 });
    }

    if (action === 'migrate') {
      // Читаем данные из db.json
      const dbData = getDb();

      // Записываем в PostgreSQL
      await saveAllToPg(dbData);

      // Подсчитываем количество записей
      let totalRecords = 0;
      for (const [key, val] of Object.entries(dbData)) {
        if (Array.isArray(val)) totalRecords += val.length;
      }

      // Логируем миграцию
      await logMigration('db.json', totalRecords);

      // Получаем статистику по таблицам
      const tableCounts = await getTableCounts();

      return NextResponse.json({
        success: true,
        message: `✅ Данные успешно перенесены в PostgreSQL. Всего записей: ${totalRecords}`,
        totalRecords,
        tableCounts,
      });
    }

    if (action === 'status') {
      const history = await getMigrationHistory();
      const tableCounts = await getTableCounts();
      return NextResponse.json({
        success: true,
        history,
        tableCounts,
      });
    }

    return NextResponse.json({ success: false, error: 'Неизвестное действие' }, { status: 400 });
  } catch (error) {
    console.error('❌ Ошибка миграции:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка сервера',
    }, { status: 500 });
  }
}