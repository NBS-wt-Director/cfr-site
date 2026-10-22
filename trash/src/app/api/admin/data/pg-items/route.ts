import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/postgres';
import { authenticateAdmin } from '@/lib/auth';

/**
 * GET /api/admin/data/pg-items?type=trainer|program
 * Получение данных из PostgreSQL для маппинга
 */
export async function GET(request: NextRequest) {
  const auth = authenticateAdmin(request);
  if (auth !== true) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    let query: string;
    let params: any[] = [];

    if (type === 'trainer') {
      query = `
        SELECT 
          t.person_id as id,
          CONCAT(p.last_name, ' ', p.first_name, ' ', p.middle_name) as name
        FROM cfr_teachers t
        JOIN cfr_persons p ON p.id = t.person_id
        WHERE t.record_status != 'removed' AND p.status != 'removed'
        ORDER BY p.last_name, p.first_name
      `;
    } else if (type === 'program') {
      query = `
        SELECT 
          e.id,
          e.name
        FROM cfr_entities e
        WHERE e.entity_type = 'program' AND e.record_status != 'removed'
        ORDER BY e.sort_order, e.name
      `;
    } else {
      return NextResponse.json(
        { error: 'Необходим параметр type (trainer|program)' },
        { status: 400 }
      );
    }

    const result = await pool.query(query, params);

    return NextResponse.json({ items: result.rows });
  } catch (error) {
    console.error('❌ Ошибка получения данных из PG:', error);
    return NextResponse.json(
      { error: 'Ошибка сервера' },
      { status: 500 }
    );
  }
}
