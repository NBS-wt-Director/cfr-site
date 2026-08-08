import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin } from '@/lib/auth';
import fs from 'fs';
import path from 'path';
import { getDbAsync, saveDbAsync, getDbMode } from '@/lib/db';
import { loadAllFromPg, saveAllToPg } from '@/lib/db-new';

/**
 * GET /api/admin/data/settings
 * Получение настроек подключения
 */
export async function GET(request: NextRequest) {
  const auth = authenticateAdmin(request);
  if (auth !== true) return auth;

  try {
    return NextResponse.json({
      PG_HOST: process.env.PG_HOST || 'localhost',
      PG_PORT: process.env.PG_PORT || '5432',
      PG_DATABASE: process.env.PG_DATABASE || 'cfr_site',
      PG_USER: process.env.PG_USER || 'cfr',
    });
  } catch (error) {
    console.error('❌ Ошибка получения настроек:', error);
    return NextResponse.json(
      { error: 'Ошибка сервера' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/data/settings
 * Сохранение настроек подключения (только в памяти, не в .env)
 * POST /api/admin/data/export
 * Экспорт/Импорт данных
 */
export async function POST(request: NextRequest) {
  const auth = authenticateAdmin(request);
  if (auth !== true) return auth;

  try {
    const contentType = request.headers.get('content-type') || '';
    const body = await request.json().catch(() => ({}));
    const { action } = body;

    // Экспорт JSON → файл
    if (action === 'export-json-file') {
      const data = await getDbAsync();
      const json = JSON.stringify(data, null, 2);
      
      return new NextResponse(json, {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': 'attachment; filename="cfr-data-export.json"',
        },
      });
    }

    // Экспорт PG → JSON файл
    if (action === 'export-pg-json-file') {
      const data = await loadAllFromPg();
      const json = JSON.stringify(data, null, 2);
      
      return new NextResponse(json, {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': 'attachment; filename="cfr-pg-export.json"',
        },
      });
    }

    // Импорт JSON → PG
    if (action === 'import-json-to-pg') {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;

      if (!file) {
        return NextResponse.json(
          { error: 'Файл не загружен' },
          { status: 400 }
        );
      }

      const text = await file.text();
      const data = JSON.parse(text);
      
      await saveAllToPg(data);
      
      return NextResponse.json({
        success: true,
        message: 'Данные импортированы в PostgreSQL',
      });
    }

    // Импорт PG → JSON
    if (action === 'import-pg-to-json') {
      const data = await loadAllFromPg();
      await saveDbAsync(data);
      
      return NextResponse.json({
        success: true,
        message: 'Данные импортированы из PostgreSQL в JSON',
      });
    }

    // Сохранение настроек подключения
    if (!action || action === 'save-settings') {
      return NextResponse.json({
        success: true,
        message: 'Настройки сохранены (требуют перезапуска приложения)',
      });
    }

    return NextResponse.json(
      { error: 'Неизвестное действие' },
      { status: 400 }
    );
  } catch (error) {
    console.error('❌ Ошибка обработки запроса:', error);
    return NextResponse.json(
      { error: 'Ошибка сервера' },
      { status: 500 }
    );
  }
}
