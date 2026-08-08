/**
 * API: Приём пакетов от моста данных (PowerShell-агент)
 * POST /api/bridge/receive — приём пакета от моста
 *
 * Принимает JSON-пакет, записывает в bridge_queue,
 * автоматически запускает триггер для переноса данных в целевые таблицы.
 *
 * Формат входящего пакета:
 * {
 *   "file_name": "Client.xml",
 *   "file_path": "C:\\DanceStudio\\Data\\Client.xml",
 *   "file_hash": "abc123...",
 *   "file_size": 12345,
 *   "last_modified": "2025-01-15T10:30:00",
 *   "content": "<Client>...</Client>"
 * }
 *
 * Ответ:
 * {
 *   "status": "received",
 *   "packet_id": 123,
 *   "file_name": "Client.xml",
 *   "processed": true
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/postgres';

export async function POST(request: NextRequest) {
  let client: any;

  try {
    // Парсим тело запроса
    const body = await request.json().catch(() => null);
    
    if (!body || !body.file_name || !body.content) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Неверный формат пакета. Обязательные поля: file_name, content',
        },
        { status: 400 }
      );
    }

    // Получаем соединение из пула
    client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Определяем сущность по имени файла
      const entity = mapFileNameToEntity(body.file_name);
      if (!entity) {
        await client.query('ROLLBACK');
        return NextResponse.json(
          {
            status: 'error',
            message: `Неизвестный файл: ${body.file_name}. Невозможно определить сущность.`,
          },
          { status: 400 }
        );
      }

      // Вставляем пакет в bridge_queue
      const insertResult = await client.query(
        `INSERT INTO bridge_queue (
          file_name, file_hash, file_size, file_path,
          entity, content, status
        ) VALUES ($1, $2, $3, $4, $5, $6, 'pending')
        RETURNING id, file_name, status`,
        [
          body.file_name,
          body.file_hash || null,
          body.file_size || null,
          body.file_path || null,
          entity,
          body.content,
        ]
      );

      const packetId = insertResult.rows[0].id;

      // Автоматически запускаем обработку пакета
      const processed = await processBridgePacket(client, packetId, entity);

      await client.query('COMMIT');

      return NextResponse.json({
        status: 'received',
        packet_id: packetId,
        file_name: body.file_name,
        entity: entity,
        processed: processed,
      });

    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    }

  } catch (error) {
    console.error('❌ Ошибка приёма пакета моста:', error);
    return NextResponse.json(
      {
        status: 'error',
        message: error instanceof Error ? error.message : 'Ошибка сервера',
      },
      { status: 500 }
    );
  } finally {
    if (client) client.release();
  }
}

/**
 * Маппинг имени XML-файла на имя сущности в БД
 */
function mapFileNameToEntity(fileName: string): string | null {
  const nameMap: Record<string, string> = {
    'Client.xml': 'clients',
    'Client001.xml': 'clients',
    'Teacher.xml': 'teachers',
    'Teacher001.xml': 'teachers',
    'Group.xml': 'groups',
    'Account.xml': 'accounts',
    'Account001.xml': 'accounts',
    'Charge.xml': 'charges',
    'Product.xml': 'products',
    'Reservation.xml': 'reservations',
    'IndividualAccount.xml': 'individual_accounts',
    'IndividualTraining.xml': 'individual_trainings',
    'Hall.xml': 'halls',
    'Rent.xml': 'rents',
    'Style.xml': 'styles',
    'Sex.xml': 'sexes',
    'Tag.xml': 'tags',
    'Branch.xml': 'branches',
    'Substitute.xml': 'substitutes',
    'ScheduleChange.xml': 'schedule_changes',
    'ReservationStatus.xml': 'reservation_statuses',
    'Note.xml': 'notes',
    'Message.xml': 'messages',
    'User.xml': 'bridge_users',
    'Task.xml': 'tasks',
  };

  return nameMap[fileName] || null;
}

/**
 * Обработка пакета из bridge_queue
 * Парсит XML-контент и вставляет данные в целевую таблицу
 */
async function processBridgePacket(
  client: any,
  packetId: number,
  entity: string
): Promise<boolean> {
  try {
    // Получаем пакет
    const packetResult = await client.query(
      'SELECT content FROM bridge_queue WHERE id = $1 AND status = $2',
      [packetId, 'pending']
    );

    if (packetResult.rows.length === 0) {
      return false;
    }

    const content = packetResult.rows[0].content;

    // Парсим XML-контент и извлекаем записи
    const records = parseXmlContent(content, entity);

    if (records.length === 0) {
      // Не удалось распарсить — помечаем как ошибку
      await client.query(
        'UPDATE bridge_queue SET status = $1, error_msg = $2 WHERE id = $3',
        ['error', 'Не удалось распарсить XML-контент', packetId]
      );
      return false;
    }

    // Вставляем записи в целевую таблицу
    let inserted = 0;
    for (const record of records) {
      const insertOk = await upsertEntity(client, entity, record);
      if (insertOk) inserted++;
    }

    // Обновляем статус пакета
    await client.query(
      'UPDATE bridge_queue SET status = $1, processed_at = NOW(), records_count = $2 WHERE id = $3',
      ['processed', inserted, packetId]
    );

    return inserted > 0;

  } catch (err) {
    console.error(`❌ Ошибка обработки пакета ${packetId} (entity: ${entity}):`, err);
    
    // Помечаем пакет как error
    try {
      await client.query(
        'UPDATE bridge_queue SET status = $1, error_msg = $2, processed_at = NOW() WHERE id = $3',
        ['error', err instanceof Error ? err.message : 'Unknown error', packetId]
      );
    } catch {}
    
    return false;
  }
}

/**
 * Парсинг XML-контента в массив записей
 * XML DanceStudio имеет структуру: <Root><Item><Field1>val1</Field1>...</Item>...</Root>
 */
function parseXmlContent(content: string, entity: string): any[] {
  // Простой парсер XML для структуры DanceStudio
  // Извлекаем все <Item>...</Item> блоки
  const itemRegex = /<Item[^>]*>([\s\S]*?)<\/Item>/g;
  const items: any[] = [];
  let match;

  while ((match = itemRegex.exec(content)) !== null) {
    const itemXml = match[1];
    const record: Record<string, string> = {};
    
    // Извлекаем все поля из Item
    const fieldRegex = /<(\w+)>([\s\S]*?)<\/\1>/g;
    let fieldMatch;
    
    while ((fieldMatch = fieldRegex.exec(itemXml)) !== null) {
      const fieldName = fieldMatch[1];
      const fieldValue = fieldMatch[2].trim();
      
      // Пропускаем вложенные Item-блоки (чтобы не дублировать)
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
 * Upsert записи в целевую таблицу по entity
 */
async function upsertEntity(client: any, entity: string, record: Record<string, string>): Promise<boolean> {
  try {
    // Получаем имена колонок и значения
    const keys = Object.keys(record);
    if (keys.length === 0) return false;

    const values = keys.map(k => record[k]);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    const columns = keys.map(k => `"${k}"`).join(', ');
    
    // Определяем поле для UPDATE (обычно ID)
    const idField = keys.includes('ID') ? 'ID' : keys[0];
    
    // Формируем UPDATE SET (все поля кроме ID)
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
    console.warn(`⚠️ Ошибка вставки в ${entity}:`, err instanceof Error ? err.message : 'Unknown');
    return false;
  }
}
