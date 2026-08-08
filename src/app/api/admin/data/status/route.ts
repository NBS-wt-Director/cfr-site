import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/postgres';
import { authenticateAdmin } from '@/lib/auth';
import { getDbMode } from '@/lib/db';

/**
 * GET /api/admin/data/status
 * Статус PG: подключение, таблицы, количество записей
 */
export async function GET(request: NextRequest) {
  const auth = authenticateAdmin(request);
  if (auth !== true) return auth;

  try {
    const mode = getDbMode();
    const result: any = {
      mode,
      pgAvailable: false,
      connectionTime: null,
      tables: {},
      totalRecords: 0,
    };

    if (mode === 'postgres') {
      const startTime = Date.now();
      
      try {
        // Проверяем подключение
        await pool.query('SELECT 1');
        result.pgAvailable = true;
        result.connectionTime = Date.now() - startTime;
        
        // Получаем статистику по таблицам
        const tableStats = await pool.query(`
          SELECT 
            tablename as table_name,
            n_live_tup as record_count
          FROM pg_stat_user_tables
          WHERE schemaname = 'public'
          AND tablename LIKE 'cfr_%'
          ORDER BY tablename
        `);
        
        result.tables = tableStats.rows;
        result.totalRecords = tableStats.rows.reduce((sum: number, t: any) => sum + (parseInt(t.record_count) || 0), 0);
        
      } catch (error) {
        console.error('❌ Ошибка проверки PG:', error);
        result.pgAvailable = false;
        result.error = error instanceof Error ? error.message : 'Unknown error';
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('❌ Ошибка получения статуса:', error);
    return NextResponse.json(
      { error: 'Ошибка сервера' },
      { status: 500 }
    );
  }
}
