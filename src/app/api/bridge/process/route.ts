/**
 * API: Ручная обработка очереди моста данных
 * POST /api/bridge/process — запуск обработки всех pending-пакетов
 *
 * Ручной запуск process_bridge_queue() для обработки всех пакетов со статусом 'pending'.
 * Полезно для отладки и восстановления после сбоев.
 *
 * Тело запроса (опционально):
 * {
 *   "limit": 10  // макс. пакетов за один запуск
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/postgres';

export async function POST(request: NextRequest) {
  let client: any;

  try {
    const body = await request.json().catch(() => ({}));
    const limit = Math.min(Math.max(body.limit || 0, 1), 100); // 1-100

    client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Получаем pending-пакеты
      const pendingResult = await client.query(
        `SELECT id, file_name, entity, content
         FROM bridge_queue
         WHERE status = 'pending'
         ORDER BY created_at ASC
         LIMIT $1`,
        [limit]
      );

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
        message: `Обработано пакетов: ${processed}, Ошибок: ${errors}`,
        processed,
        errors,
        total: packets.length,
      });

    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    }

  } catch (error) {
    console.error('❌ Ошибка обработки очереди:', error);
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
    // Парсим XML
    const records = parseXmlContent(content, entity);

    if (records.length === 0) {
      await client.query(
        'UPDATE bridge_queue SET status = $1, error_msg = $2, processed_at = NOW() WHERE id = $3',
        ['error', 'Нет записей в XML', packetId]
      );
      return false;
    }

    // Вставляем в целевую таблицу
    let inserted = 0;
    for (const record of records) {
      const ok = await upsertEntity(client, entity, record);
      if (ok) inserted++;
    }

    // Обновляем статус
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
