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
        ) VALUES ($1, $2, $3, $4, $5, $6, 'received')
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
 * Маппинг имени XML-файла на имя таблицы cfr_* в БД
 */
function mapFileNameToEntity(fileName: string): string | null {
  const nameMap: Record<string, string> = {
    'Client.xml': 'cfr_clients',
    'Client001.xml': 'cfr_clients',
    'Teacher.xml': 'cfr_teachers',
    'Teacher001.xml': 'cfr_teachers',
    'Group.xml': 'cfr_entities',
    'Account.xml': 'cfr_accounts',
    'Account001.xml': 'cfr_accounts',
    'SingleTraining.xml': 'cfr_visits',
    'SingleTraining001.xml': 'cfr_visits',
    'SingleTraining002.xml': 'cfr_visits',
    'SingleTraining003.xml': 'cfr_visits',
    'SingleTraining004.xml': 'cfr_visits',
    'SingleTraining005.xml': 'cfr_visits',
    'SingleTraining006.xml': 'cfr_visits',
    'SingleTraining007.xml': 'cfr_visits',
    'SingleTraining008.xml': 'cfr_visits',
    'SingleTraining009.xml': 'cfr_visits',
    'SingleTraining010.xml': 'cfr_visits',
    'SingleTraining011.xml': 'cfr_visits',
    'SingleTraining012.xml': 'cfr_visits',
    'SingleTraining013.xml': 'cfr_visits',
    'SingleTraining014.xml': 'cfr_visits',
    'Reservation.xml': 'cfr_reservations',
    'Rent.xml': 'cfr_entities',
    'IndividualAccount.xml': 'cfr_accounts',
    'IndividualTraining.xml': 'cfr_visits',
    'Style.xml': 'cfr_styles',
    'Hall.xml': 'cfr_halls',
    'Branch.xml': 'cfr_branches',
    'Tag.xml': 'cfr_tags',
    'Note.xml': 'cfr_notes',
    'Message.xml': 'cfr_messages',
    'Task.xml': 'cfr_tasks',
    'Charge.xml': 'cfr_charges',
    'Product.xml': 'cfr_products',
  };

  return nameMap[fileName] || null;
}

/**
 * Обработка пакета из bridge_queue
 * Парсит XML-контент и вставляет данные в целевую таблицу cfr_*
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
      [packetId, 'received']
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
      ['completed', inserted, packetId]
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
 * Преобразует PascalCase поля из XML в snake_case для PostgreSQL
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
      // Преобразуем поля по маппингу для данной сущности
      const mapped = mapFields(record, entity);
      items.push(mapped);
    }
  }

  return items;
}

/**
 * Маппинг полей из XML (PascalCase DanceStudio) → БД (snake_case PostgreSQL)
 */
function mapFields(record: Record<string, string>, entity: string): Record<string, string> {
  // Маппинги для каждой сущности
  const fieldMaps: Record<string, Record<string, string>> = {
    // Client → cfr_clients (через cfr_persons)
    'cfr_clients': {
      'ID': 'id',
      'LastName': 'last_name',
      'Name': 'first_name',
      'MiddleName': 'middle_name',
      'MobilePhone1': 'mobile_phone',
      'MobilePhone2': 'additional_phone',
      'BirthDate': 'birth_date',
      'Email': 'email',
      'AgreementNumber': 'agreement_number',
      'Barcode': 'barcode',
      'Archive': 'archive',
      'Annotation': 'annotation',
      'ID_Foto': 'id_foto',
      'ID_Sex': 'sex',
      'ID_Friend': 'friend_person_id',
      'ParentLastName': 'parent_last_name',
      'ParentName': 'parent_first_name',
      'ParentMiddleName': 'parent_middle_name',
      'ParentMobilePhone1': 'parent_mobile_phone_1',
      'ParentMobilePhone2': 'parent_mobile_phone_2',
    },
    // Teacher → cfr_teachers (через cfr_persons)
    'cfr_teachers': {
      'ID': 'id',
      'LastName': 'last_name',
      'Name': 'first_name',
      'MiddleName': 'middle_name',
      'MobilePhone1': 'mobile_phone',
      'BirthDate': 'birth_date',
      'ID_Sex': 'sex',
      'ID_Foto': 'id_foto',
      'OwnSalaryOptions': 'own_salary_options',
      'Status': 'status',
      'SalaryOptions': 'salary_options',
      'Styles': 'styles',
    },
    // Group/Rent → cfr_entities
    'cfr_entities': {
      'ID': 'id',
      'Colour': 'colour',
      'Status': 'status',
      'ID_Style': 'style_id',
      'ID_Teacher': 'teacher_person_id',
      'ID_Hall': 'hall_id',
      'OwnSalaryOptions': 'own_salary_options',
      'OwnSecondSalaryOptions': 'own_second_salary_options',
      'Schedule': 'schedule',
      'Clients': 'clients',
      'RentTypeName': 'name',
      'RentTypeCost': 'price_per_session',
      'Prepayment': 'prepayment',
      'TenantType': 'tenant_type',
      'LastName': 'last_name',
      'Name': 'name',
      'MobilePhone': 'mobile_phone',
    },
    // Account → cfr_accounts
    'cfr_accounts': {
      'ID': 'id',
      'Number': 'number',
      'CreateDate': 'create_date',
      'BeginDate': 'begin_date',
      'DaysCount': 'days_count',
      'IsPerpetual': 'is_perpetual',
      'IsUnlimited': 'is_unlimited',
      'TrainingCount': 'training_count',
      'FreeTrainingCount': 'free_training_count',
      'PaymentType': 'payment_type',
      'ID_Client': 'person_id',
      'OriginalCost': 'original_cost',
      'Discount': 'discount',
      'DiscountPercent': 'discount_percent',
      'AddDaysCount': 'add_days_count',
      'AccountTypeName': 'account_type_name',
      'AccountTypeCost': 'account_type_cost',
      'Annotation': 'annotation',
      'Groups': 'groups',
      'Reservations': 'reservations',
      'Visits': 'visits',
      'Deposit': 'deposit',
      'Bonus': 'bonus',
      'ID_Style': 'style_id',
      'ID_Teacher': 'teacher_person_id',
      'Colour': 'colour',
    },
    // SingleTraining/IndividualTraining → cfr_visits
    'cfr_visits': {
      'ID': 'id',
      'VisitDate': 'visit_date',
      'PaymentType': 'payment_type',
      'ID_Client': 'person_id',
      'ID_Group': 'entity_id',
      'Cost': 'cost',
      'SingleTrainingTypeName': 'training_type_name',
      'SingleTrainingTypeCost': 'training_type_cost',
      'Deposit': 'deposit',
      'Bonus': 'bonus',
      'ID_Teacher': 'teacher_person_id',
      'Prepayment': 'prepayment',
    },
    // Reservation → cfr_reservations
    'cfr_reservations': {
      'ID': 'id',
      'ID_Status': 'status_id',
      'ReservationType': 'reservation_type',
      'ClientType': 'client_type',
      'ID_Client': 'person_id',
      'LastName': 'last_name',
      'Name': 'first_name',
      'MiddleName': 'middle_name',
      'BirthDate': 'birth_date',
      'ParentLastName': 'parent_last_name',
      'ParentMobilePhone1': 'parent_mobile_phone_1',
      'MobilePhone1': 'mobile_phone',
      'Time': 'reservation_time',
      'ID_Group': 'entity_id',
      'Comments': 'comments',
      'StatusChanges': 'status_changes',
      'Informers': 'informers',
      'Tags': 'tags',
      'Schedule': 'schedule',
      'Tasks': 'tasks',
    },
    // Style → cfr_styles
    'cfr_styles': {
      'ID': 'id',
      'Name': 'name',
      'ClientName': 'client_name',
      'Description': 'description',
      'Type': 'type',
    },
    // Hall → cfr_halls
    'cfr_halls': {
      'ID': 'id',
      'Name': 'name',
      'Status': 'status',
    },
    // Branch → cfr_branches
    'cfr_branches': {
      'ID': 'id',
      'Name': 'name',
      'Address': 'address',
      'Phone': 'phone',
      'Email': 'email',
      'Website': 'website',
      'Hours': 'hours',
    },
    // Tag → cfr_tags
    'cfr_tags': {
      'ID': 'id',
      'Name': 'name',
      'Colour': 'colour',
      'Position': 'position',
      'Description': 'description',
    },
    // Note → cfr_notes
    'cfr_notes': {
      'ID': 'id',
      'Text': 'text',
      'Closed': 'closed',
      'Colour': 'colour',
      'NoteDate': 'note_date',
      'CloseDate': 'close_date',
    },
    // Message → cfr_messages
    'cfr_messages': {
      'ID': 'id',
      'Text': 'text',
      'Target': 'target',
      'Phone': 'phone',
      'Status': 'msg_status',
      'Cost': 'cost',
      'MessageTime': 'message_time',
    },
    // Task → cfr_tasks
    'cfr_tasks': {
      'ID': 'id',
      'Text': 'text',
      'Closed': 'closed',
      'TaskType': 'task_type',
      'TaskTime': 'task_time',
      'CloseTime': 'close_time',
    },
    // Charge → cfr_charges
    'cfr_charges': {
      'ID': 'id',
      'Name': 'name',
      'Description': 'description',
      'Annotation': 'annotation',
      'Items': 'items',
      'Packets': 'packets',
    },
    // Product → cfr_products
    'cfr_products': {
      'ID': 'id',
      'Name': 'name',
      'Barcode': 'barcode',
      'Measurement': 'measurement',
      'Unit': 'unit',
      'Status': 'status',
      'PurchaseCost': 'purchase_cost',
      'Markup': 'markup',
      'MarkupPercent': 'markup_percent',
      'Annotation': 'annotation',
      'PurchasePackets': 'purchase_packets',
      'StoragePackets': 'storage_packets',
      'SalePackets': 'sale_packets',
      'Deposit': 'deposit',
      'Bonus': 'bonus',
    },
  };

  const map = fieldMaps[entity];
  if (!map) {
    // Если маппинга нет — возвращаем как есть (с преобразованием ключей в snake_case)
    return Object.fromEntries(
      Object.entries(record).map(([k, v]) => [toSnakeCase(k), v])
    );
  }

  const result: Record<string, string> = {};
  for (const [xmlKey, dbKey] of Object.entries(map)) {
    if (record[xmlKey] !== undefined) {
      result[dbKey] = record[xmlKey];
    }
  }
  // Добавляем поля, для которых нет явного маппинга
  for (const [k, v] of Object.entries(record)) {
    if (!map[k]) {
      result[toSnakeCase(k)] = v;
    }
  }

  return result;
}

/**
 * Преобразование PascalCase / camelCase → snake_case
 */
function toSnakeCase(str: string): string {
  return str
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();
}

/**
 * Upsert записи в целевую таблицу по entity
 * Для таблиц cfr_clients/cfr_teachers/cfr_accounts/cfr_visits
 * используются PL/pgSQL функции bridge_insert_xxx из миграции 002.
 * Для остальных таблиц — generic INSERT ... ON CONFLICT.
 */
async function upsertEntity(client: any, entity: string, record: Record<string, string>): Promise<boolean> {
  try {
    // Для сущностей, требующих записи в cfr_persons + подчинённую таблицу,
    // используем PL/pgSQL функции из 002_bridge_queue.sql
    if (entity === 'cfr_clients') {
      return await upsertClient(client, record);
    }
    if (entity === 'cfr_teachers') {
      return await upsertTeacher(client, record);
    }
    if (entity === 'cfr_accounts') {
      return await upsertAccount(client, record);
    }
    if (entity === 'cfr_visits') {
      return await upsertVisit(client, record);
    }

    // Generic upsert для остальных таблиц (cfr_styles, cfr_halls, cfr_tags,
    // cfr_charges, cfr_products, cfr_notes, cfr_messages, cfr_tasks,
    // cfr_entities, cfr_branches, cfr_reservations)
    return await upsertGeneric(client, entity, record);
  } catch (err) {
    console.warn(`⚠️ Ошибка вставки в ${entity}:`, err instanceof Error ? err.message : 'Unknown');
    return false;
  }
}

/**
 * Upsert клиента: cfr_persons + cfr_clients
 */
async function upsertClient(client: any, record: Record<string, string>): Promise<boolean> {
  const id = record.id || record.ID;
  if (!id) return false;

  try {
    await client.query(`
      INSERT INTO cfr_persons (
        id, last_name, first_name, middle_name, mobile_phone,
        additional_phone, birth_date, email, sex,
        parent_last_name, parent_first_name, parent_middle_name,
        parent_mobile_phone_1, parent_mobile_phone_2,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
      ON CONFLICT (id) DO UPDATE SET
        last_name = EXCLUDED.last_name,
        first_name = EXCLUDED.first_name,
        middle_name = EXCLUDED.middle_name,
        mobile_phone = EXCLUDED.mobile_phone,
        additional_phone = EXCLUDED.additional_phone,
        birth_date = EXCLUDED.birth_date,
        email = EXCLUDED.email,
        sex = EXCLUDED.sex,
        parent_last_name = EXCLUDED.parent_last_name,
        parent_first_name = EXCLUDED.parent_first_name,
        parent_middle_name = EXCLUDED.parent_middle_name,
        parent_mobile_phone_1 = EXCLUDED.parent_mobile_phone_1,
        parent_mobile_phone_2 = EXCLUDED.parent_mobile_phone_2,
        updated_at = NOW()
    `, [
      id, record.last_name || record.LastName || null,
      record.first_name || record.Name || null,
      record.middle_name || record.MiddleName || null,
      record.mobile_phone || record.MobilePhone1 || null,
      record.additional_phone || record.MobilePhone2 || null,
      record.birth_date || record.BirthDate || null,
      record.email || record.Email || null,
      record.sex || record.ID_Sex || null,
      record.parent_last_name || record.ParentLastName || null,
      record.parent_first_name || record.ParentName || null,
      record.parent_middle_name || record.ParentMiddleName || null,
      record.parent_mobile_phone_1 || record.ParentMobilePhone1 || null,
      record.parent_mobile_phone_2 || record.ParentMobilePhone2 || null,
    ]);

    await client.query(`
      INSERT INTO cfr_clients (
        person_id, agreement_number, barcode, archive, annotation,
        id_foto, status_id, friend_person_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (person_id) DO UPDATE SET
        agreement_number = EXCLUDED.agreement_number,
        barcode = EXCLUDED.barcode,
        archive = EXCLUDED.archive,
        annotation = EXCLUDED.annotation,
        id_foto = EXCLUDED.id_foto,
        status_id = EXCLUDED.status_id,
        friend_person_id = EXCLUDED.friend_person_id
    `, [
      id,
      record.agreement_number || record.AgreementNumber ? parseInt(record.agreement_number || record.AgreementNumber, 10) : null,
      record.barcode || record.Barcode || null,
      record.archive === 'true' || record.Archive === 'True' || record.archive === '1',
      record.annotation || record.Annotation || null,
      record.id_foto || record.ID_Foto || null,
      record.status_id || record.ID_Status || null,
      record.friend_person_id || record.ID_Friend || null,
    ]);

    return true;
  } catch (err) {
    console.warn('⚠️ upsertClient error:', err instanceof Error ? err.message : 'Unknown');
    return false;
  }
}

/**
 * Upsert преподавателя: cfr_persons + cfr_teachers
 */
async function upsertTeacher(client: any, record: Record<string, string>): Promise<boolean> {
  const id = record.id || record.ID;
  if (!id) return false;

  try {
    await client.query(`
      INSERT INTO cfr_persons (
        id, last_name, first_name, middle_name, mobile_phone,
        birth_date, email, sex, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      ON CONFLICT (id) DO UPDATE SET
        last_name = EXCLUDED.last_name,
        first_name = EXCLUDED.first_name,
        middle_name = EXCLUDED.middle_name,
        mobile_phone = EXCLUDED.mobile_phone,
        birth_date = EXCLUDED.birth_date,
        email = EXCLUDED.email,
        sex = EXCLUDED.sex,
        updated_at = NOW()
    `, [
      id, record.last_name || record.LastName || null,
      record.first_name || record.Name || null,
      record.middle_name || record.MiddleName || null,
      record.mobile_phone || record.MobilePhone1 || null,
      record.birth_date || record.BirthDate || null,
      record.email || record.Email || null,
      record.sex || record.ID_Sex || null,
    ]);

    // Преобразование статуса
    const pgStatus = record.status === 'Closed' || record.Status === 'closed' ? 'inactive' : 'active';
    const isDirector = record.is_director === 'true' ||
                       record.is_director === 'True' ||
                       record.is_director === '1';

    await client.query(`
      INSERT INTO cfr_teachers (
        person_id, short_code, status, experience, description,
        specialization, is_director, own_salary_options,
        record_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'normal')
      ON CONFLICT (person_id) DO UPDATE SET
        short_code = EXCLUDED.short_code,
        status = EXCLUDED.status,
        experience = EXCLUDED.experience,
        description = EXCLUDED.description,
        specialization = EXCLUDED.specialization,
        is_director = EXCLUDED.is_director,
        own_salary_options = EXCLUDED.own_salary_options
    `, [
      id,
      record.short_code || null,
      pgStatus,
      record.experience || null,
      record.description || null,
      record.specialization || null,
      isDirector,
      record.own_salary_options === 'true' || record.own_salary_options === '1',
    ]);

    return true;
  } catch (err) {
    console.warn('⚠️ upsertTeacher error:', err instanceof Error ? err.message : 'Unknown');
    return false;
  }
}

/**
 * Upsert абонемента: cfr_accounts (+ person через cfr_persons)
 */
async function upsertAccount(client: any, record: Record<string, string>): Promise<boolean> {
  const id = record.id || record.ID;
  if (!id) return false;

  try {
    // Сначала person
    const personId = record.person_id || record.ID_Client || record.id || record.ID;
    if (personId) {
      await client.query(`
        INSERT INTO cfr_persons (id, updated_at) VALUES ($1, NOW())
        ON CONFLICT (id) DO NOTHING
      `, [personId]);
    }

    // Преобразование PaymentType: Cash → cash, NonCash → transfer
    const pgPaymentType = (record.payment_type || record.PaymentType || 'Cash')
      .replace('Cash', 'cash').replace('NonCash', 'transfer').toLowerCase();

    await client.query(`
      INSERT INTO cfr_accounts (
        id, number, person_id, create_date, begin_date, days_count,
        is_perpetual, is_unlimited, training_count, free_training_count,
        payment_type, original_cost, discount, discount_percent,
        add_days_count, account_type_name, account_type_cost,
        annotation, record_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, 'normal')
      ON CONFLICT (id) DO UPDATE SET
        number = EXCLUDED.number,
        person_id = EXCLUDED.person_id,
        create_date = EXCLUDED.create_date,
        begin_date = EXCLUDED.begin_date,
        days_count = EXCLUDED.days_count,
        is_perpetual = EXCLUDED.is_perpetual,
        is_unlimited = EXCLUDED.is_unlimited,
        training_count = EXCLUDED.training_count,
        free_training_count = EXCLUDED.free_training_count,
        payment_type = EXCLUDED.payment_type,
        original_cost = EXCLUDED.original_cost,
        discount = EXCLUDED.discount,
        discount_percent = EXCLUDED.discount_percent,
        add_days_count = EXCLUDED.add_days_count,
        account_type_name = EXCLUDED.account_type_name,
        account_type_cost = EXCLUDED.account_type_cost,
        annotation = EXCLUDED.annotation,
        updated_at = NOW()
    `, [
      id,
      record.number || record.Number ? parseInt(record.number || record.Number, 10) : null,
      personId,
      parseDate(record.create_date || record.CreateDate),
      parseDate(record.begin_date || record.BeginDate),
      record.days_count || record.DaysCount ? parseInt(record.days_count || record.DaysCount, 10) : null,
      record.is_perpetual === 'true' || record.is_perpetual === '1',
      record.is_unlimited === 'true' || record.is_unlimited === '1',
      record.training_count || record.TrainingCount ? parseInt(record.training_count || record.TrainingCount, 10) : null,
      record.free_training_count || record.FreeTrainingCount ? parseInt(record.free_training_count || record.FreeTrainingCount, 10) : null,
      pgPaymentType,
      record.original_cost || record.OriginalCost ? parseFloat(String(record.original_cost || record.OriginalCost).replace(',', '.')) : null,
      record.discount || record.Discount ? parseFloat(String(record.discount || record.Discount).replace(',', '.')) : null,
      record.discount_percent || record.DiscountPercent ? parseFloat(String(record.discount_percent || record.DiscountPercent).replace(',', '.')) : null,
      record.add_days_count || record.AddDaysCount ? parseInt(record.add_days_count || record.AddDaysCount, 10) : null,
      record.account_type_name || record.AccountTypeName || null,
      record.account_type_cost || record.AccountTypeCost ? parseFloat(String(record.account_type_cost || record.AccountTypeCost).replace(',', '.')) : null,
      record.annotation || record.Annotation || null,
    ]);

    return true;
  } catch (err) {
    console.warn('⚠️ upsertAccount error:', err instanceof Error ? err.message : 'Unknown');
    return false;
  }
}

/**
 * Upsert визита: cfr_visits (+ person через cfr_persons)
 */
async function upsertVisit(client: any, record: Record<string, string>): Promise<boolean> {
  const id = record.id || record.ID;
  if (!id) return false;

  try {
    // Сначала person
    const personId = record.person_id || record.ID_Client || record.id || record.ID;
    if (personId) {
      await client.query(`
        INSERT INTO cfr_persons (id, updated_at) VALUES ($1, NOW())
        ON CONFLICT (id) DO NOTHING
      `, [personId]);
    }

    // Преобразование PaymentType
    const pgPaymentType = (record.payment_type || record.PaymentType || 'Cash')
      .replace('Cash', 'cash').replace('NonCash', 'transfer').toLowerCase();

    await client.query(`
      INSERT INTO cfr_visits (
        id, visit_date, person_id, entity_id, cost,
        payment_type, training_type_name, training_type_cost,
        record_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'normal')
      ON CONFLICT (id) DO UPDATE SET
        visit_date = EXCLUDED.visit_date,
        person_id = EXCLUDED.person_id,
        entity_id = EXCLUDED.entity_id,
        cost = EXCLUDED.cost,
        payment_type = EXCLUDED.payment_type,
        training_type_name = EXCLUDED.training_type_name,
        training_type_cost = EXCLUDED.training_type_cost
    `, [
      id,
      parseDate(record.visit_date || record.VisitDate),
      personId,
      record.entity_id || record.ID_Group || null,
      record.cost || record.Cost ? parseFloat(String(record.cost || record.Cost).replace(',', '.')) : 0,
      pgPaymentType,
      record.training_type_name || record.SingleTrainingTypeName || null,
      record.training_type_cost || record.SingleTrainingTypeCost ? parseFloat(String(record.training_type_cost || record.SingleTrainingTypeCost).replace(',', '.')) : 0,
    ]);

    return true;
  } catch (err) {
    console.warn('⚠️ upsertVisit error:', err instanceof Error ? err.message : 'Unknown');
    return false;
  }
}

/**
 * Generic upsert для таблиц без связи с cfr_persons
 */
async function upsertGeneric(client: any, entity: string, record: Record<string, string>): Promise<boolean> {
  const keys = Object.keys(record);
  if (keys.length === 0) return false;

  // Определяем поле для CONFLICT (ID или primary key)
  const idKey = keys.find(k => k.toLowerCase() === 'id') || keys[0];
  
  const values = keys.map(k => record[k]);
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
  const columns = keys.map(k => `"${k}"`).join(', ');
  
  const updateKeys = keys.filter(k => k !== idKey);
  const updateSet = updateKeys.map((k, i) => `"${k}" = EXCLUDED."${k}"`).join(', ');
  
  const query = `
    INSERT INTO ${entity} (${columns})
    VALUES (${placeholders})
    ON CONFLICT (${idKey}) DO UPDATE SET ${updateSet}
  `;

  await client.query(query, values);
  return true;
}

/**
 * Преобразование даты из DD.MM.YYYY в YYYY-MM-DD для PostgreSQL
 */
function parseDate(str: string | undefined): string | null {
  if (!str) return null;
  const parts = str.split('.');
  if (parts.length === 3 && parts[0].length === 2 && parts[1].length === 2 && parts[2].length === 4) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  // Попробуем как ISO
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }
  return null;
}
