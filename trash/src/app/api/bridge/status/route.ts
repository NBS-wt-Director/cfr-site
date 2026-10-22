/**
 * API: Статус моста данных
 * GET /api/bridge/status — количество пакетов в очереди
 *
 * Возвращает текущее состояние очереди моста:
 * - Количество пакетов по статусам (pending, processing, processed, error)
 * - Общая статистика
 * - Последние пакеты
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/postgres';

export async function GET() {
  let client: any;

  try {
    client = await pool.connect();

    // Общее количество пакетов по статусам
    const statusResult = await client.query(`
      SELECT status, COUNT(*) as count
      FROM bridge_queue
      GROUP BY status
      ORDER BY status
    `);

    // Общее количество
    const totalResult = await client.query(`
      SELECT COUNT(*) as total FROM bridge_queue
    `);

    // Статистика за последние 24 часа
    const todayResult = await client.query(`
      SELECT 
        COUNT(*) as today_total,
        COUNT(*) FILTER (WHERE status = 'completed') as today_processed,
        COUNT(*) FILTER (WHERE status = 'error') as today_error,
        COALESCE(SUM(records_count), 0) as today_records
      FROM bridge_queue
      WHERE processed_at >= NOW() - INTERVAL '24 hours'
    `);

    // Последние 10 пакетов
    const recentResult = await client.query(`
      SELECT id, file_name, entity, status, records_count, 
             created_at, processed_at, error_msg
      FROM bridge_queue
      ORDER BY created_at DESC
      LIMIT 10
    `);

    const statusByType: Record<string, number> = {};
    for (const row of statusResult.rows) {
      statusByType[row.status] = parseInt(row.count, 10);
    }

    return NextResponse.json({
      success: true,
      total: parseInt(totalResult.rows[0].total, 10),
      byStatus: statusByType,
      last24h: {
        total: parseInt(todayResult.rows[0].today_total, 10),
        processed: parseInt(todayResult.rows[0].today_processed, 10),
        errors: parseInt(todayResult.rows[0].today_error, 10),
        records: parseInt(todayResult.rows[0].today_records, 10),
      },
      recent: recentResult.rows.map((r: any) => ({
        id: r.id,
        file_name: r.file_name,
        entity: r.entity,
        status: r.status,
        records_count: r.records_count,
        created_at: r.created_at?.toISOString?.() || r.created_at,
        processed_at: r.processed_at?.toISOString?.() || r.processed_at,
        error_msg: r.error_msg,
      })),
    });

  } catch (error) {
    console.error('❌ Ошибка статуса моста:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Ошибка сервера',
      },
      { status: 500 }
    );
  } finally {
    if (client) client.release();
  }
}
