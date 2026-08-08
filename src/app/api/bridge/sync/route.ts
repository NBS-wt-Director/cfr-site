/**
 * API: Управление синхронизацией данных
 * GET  /api/bridge/sync/status  — статус синхронизации
 * POST /api/bridge/sync         — ручная синхронизация (запуск отправки пакетов из очереди)
 * POST /api/bridge/sync/reset   — сброс очереди (удаление всех пакетов)
 *
 * Используется кнопкой «Получить данные» в админке.
 */

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/postgres';

// ============================================
// GET: Статус синхронизации
// ============================================

export async function GET(request: NextRequest) {
  let client: any;

  try {
    client = await pool.connect();

    // Статус пакетов в bridge_queue
    const statusResult = await client.query(`
      SELECT status, COUNT(*) as count
      FROM bridge_queue
      GROUP BY status
      ORDER BY status
    `);

    const totalResult = await client.query(`
      SELECT COUNT(*) as total FROM bridge_queue
    `);

    // Последние 5 обработанных пакетов
    const recentResult = await client.query(`
      SELECT id, file_name, entity, status, records_count,
             created_at, processed_at, error_msg
      FROM bridge_queue
      ORDER BY created_at DESC
      LIMIT 5
    `);

    // Статистика за последние 7 дней
    const statsResult = await client.query(`
      SELECT
        COUNT(*) as total_7d,
        COUNT(*) FILTER (WHERE status = 'processed') as processed_7d,
        COUNT(*) FILTER (WHERE status = 'error') as errors_7d,
        COALESCE(SUM(records_count), 0) as records_7d,
        MAX(processed_at) as last_success
      FROM bridge_queue
      WHERE created_at >= NOW() - INTERVAL '7 days'
    `);

    const byStatus: Record<string, number> = {};
    for (const row of statusResult.rows) {
      byStatus[row.status] = parseInt(row.count, 10);
    }

    return NextResponse.json({
      success: true,
      total: parseInt(totalResult.rows[0].total, 10),
      byStatus,
      last7d: {
        total: parseInt(statsResult.rows[0].total_7d, 10),
        processed: parseInt(statsResult.rows[0].processed_7d, 10),
        errors: parseInt(statsResult.rows[0].errors_7d, 10),
        records: parseInt(statsResult.rows[0].records_7d, 10),
        last_success: statsResult.rows[0].last_success,
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
    console.error('❌ Ошибка получения статуса синхронизации:', error);
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

// ============================================
// POST: Ручная синхронизация
// ============================================

export async function POST(request: NextRequest) {
  let client: any;

  try {
    const body = await request.json().catch(() => ({}));
    const action = body.action || 'sync'; // 'sync' | 'reset'

    client = await pool.connect();

    try {
      await client.query('BEGIN');

      if (action === 'sync') {
        // Запускаем обработку всех pending-пакетов
        const pendingResult = await client.query(`
          SELECT id, file_name, entity, content
          FROM bridge_queue
          WHERE status = 'pending'
          ORDER BY created_at ASC
        `);

        const packets = pendingResult.rows;
        let processed = 0;
        let errors = 0;

        for (const packet of packets) {
          const ok = await processBridgePacket(client, packet.id, packet.entity, packet.content);
          if (ok) {
            processed++;
          } else {
            errors++;
          }
        }

        await client.query('COMMIT');

        return NextResponse.json({
          success: true,
          message: `Синхронизация завершена. Обработано: ${processed}, Ошибок: ${errors}`,
          processed,
          errors,
          total: packets.length,
          action: 'sync',
        });

      } else if (action === 'reset') {
        // Сброс очереди — удаление всех пакетов
        const deleteResult = await client.query(`
          DELETE FROM bridge_queue
          WHERE status IN ('pending', 'processing', 'error')
        `);

        await client.query('COMMIT');

        return NextResponse.json({
          success: true,
          message: `Очередь сброшена. Удалено пакетов: ${deleteResult.rowCount}`,
          deleted: deleteResult.rowCount || 0,
          action: 'reset',
        });

      } else {
        return NextResponse.json(
          {
            success: false,
            message: `Неизвестное действие: ${action}. Допустимые: sync, reset`,
          },
          { status: 400 }
        );
      }

    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    }

  } catch (error) {
    console.error('❌ Ошибка управления синхронизацией:', error);
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

/**
 * Обработка отдельного пакета
 */
async function processBridgePacket(
  client: any,
  packetId: number,
  entity: string,
  content: string
): Promise<boolean> {
  try {
    const records = parseXmlContent(content, entity);

    if (records.length === 0) {
      await client.query(
        'UPDATE bridge_queue SET status = $1, error_msg = $2, processed_at = NOW() WHERE id = $3',
        ['error', 'Нет записей в XML', packetId]
      );
      return false;
    }

    let inserted = 0;
    for (const record of records) {
      const ok = await upsertEntity(client, entity, record);
      if (ok) inserted++;
    }

    await client.query(
      'UPDATE bridge_queue SET status = $1, processed_at = NOW(), records_count = $2 WHERE id = $3',
      ['processed', inserted, packetId]
    );

    return inserted > 0;

  } catch (err) {
    console.error(`❌ Ошибка пакета ${packetId}:`, err instanceof Error ? err.message : 'Unknown');
    try {
      await client.query(
        'UPDATE bridge_queue SET status = $1, error_msg = $2, processed_at = NOW() WHERE id = $3',
        ['error', err instanceof Error ? err.message : 'Unknown', packetId]
      );
    } catch {}
    return false;
  }
}

/**
 * Парсинг XML DanceStudio
 */
function parseXmlContent(content: string, entity: string): any[] {
  const itemRegex = /<Item[^>]*>([\s\S]*?)<\/Item>/g;
  const items: any[] = [];
  let match;

  while ((match = itemRegex.exec(content)) !== null) {
    const itemXml = match[1];
    const record: Record<string, string> = {};
    
    const fieldRegex = /<(\w+)>([\s\S]*?)<\/\1>/g;
    let fieldMatch;
    
    while ((fieldMatch = fieldRegex.exec(itemXml)) !== null) {
      const fieldName = fieldMatch[1];
      const fieldValue = fieldMatch[2].trim();
      
      if (fieldName === 'Item') continue;
      
      record[fieldName] = fieldValue;
    }
    
    if (Object.keys(record).length > 0) {
      items.push(record);
    }
  }

  return items;
}

/**
 * Upsert в целевую таблицу
 */
async function upsertEntity(client: any, entity: string, record: Record<string, string>): Promise<boolean> {
  try {
    const keys = Object.keys(record);
    if (keys.length === 0) return false;

    const values = keys.map(k => record[k]);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    const columns = keys.map(k => `"${k}"`).join(', ');
    
    const idField = keys.includes('ID') ? 'ID' : keys[0];
    const updateKeys = keys.filter(k => k !== idField);
    const updateSet = updateKeys.map((k, i) => `"${k}" = EXCLUDED."${k}"`).join(', ');
    
    const query = `
      INSERT INTO ${entity} (${columns})
      VALUES (${placeholders})
      ON CONFLICT (ID) DO UPDATE SET ${updateSet}
    `;

    await client.query(query, values);
    return true;
  } catch (err) {
    return false;
  }
}
