import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/postgres';
import { authenticateAdmin } from '@/lib/auth';

/**
 * GET /api/admin/data/mapping?type=trainer|program|all
 * Получение всех маппингов или по типу
 */
export async function GET(request: NextRequest) {
  const auth = authenticateAdmin(request);
  if (auth !== true) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all';

    let query = 'SELECT * FROM data_mappings ORDER BY created_at DESC';
    const params: any[] = [];

    if (type !== 'all') {
      query = 'SELECT * FROM data_mappings WHERE entity_type = $1 ORDER BY created_at DESC';
      params.push(type);
    }

    const result = await pool.query(query, params);

    return NextResponse.json({ mappings: result.rows });
  } catch (error) {
    console.error('❌ Ошибка получения маппингов:', error);
    return NextResponse.json({ mappings: [] });
  }
}

/**
 * POST /api/admin/data/mapping
 * Создание/обновление маппинга
 */
export async function POST(request: NextRequest) {
  const auth = authenticateAdmin(request);
  if (auth !== true) return auth;

  try {
    const body = await request.json();
    const { entityType, jsonId, pgId, jsonName, pgName, status, notes } = body;

    if (!entityType || !status) {
      return NextResponse.json(
        { error: 'Необходимы entityType и status' },
        { status: 400 }
      );
    }

    // Проверяем существующий маппинг
    let checkQuery = 'SELECT id FROM data_mappings WHERE entity_type = $1';
    let checkParams: any[] = [entityType];

    if (jsonId !== null && jsonId !== undefined) {
      checkQuery += ' AND json_id = $2';
      checkParams.push(jsonId);
    }
    if (pgId !== null && pgId !== undefined) {
      checkQuery += ' AND pg_id = $2';
      checkParams.push(pgId);
    }

    const existing = await pool.query(checkQuery, checkParams);

    if (existing.rows.length > 0) {
      // Обновляем существующий
      await pool.query(
        `UPDATE data_mappings 
         SET status = $1, json_name = $2, pg_name = $3, notes = $4, updated_at = NOW()
         WHERE id = $5`,
        [status, jsonName || null, pgName || null, notes || null, existing.rows[0].id]
      );
    } else {
      // Создаём новый
      await pool.query(
        `INSERT INTO data_mappings (entity_type, json_id, pg_id, json_name, pg_name, status, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [entityType, jsonId || null, pgId || null, jsonName || null, pgName || null, status, notes || null]
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ Ошибка сохранения маппинга:', error);
    return NextResponse.json(
      { error: 'PostgreSQL недоступен. Запустите Docker: docker compose up -d' },
      { status: 503 }
    );
  }
}

/**
 * DELETE /api/admin/data/mapping?id=123
 * Удаление маппинга
 */
export async function DELETE(request: NextRequest) {
  const auth = authenticateAdmin(request);
  if (auth !== true) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const id = parseInt(searchParams.get('id') || '');

    if (!id) {
      return NextResponse.json(
        { error: 'Необходим ID' },
        { status: 400 }
      );
    }

    await pool.query('DELETE FROM data_mappings WHERE id = $1', [id]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ Ошибка удаления маппинга:', error);
    return NextResponse.json(
      { error: 'PostgreSQL недоступен' },
      { status: 503 }
    );
  }
}
