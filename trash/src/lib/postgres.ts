/**
 * PostgreSQL пул соединений и операции с таблицами ЛК
 * (users, user_visits, user_payments, user_subscriptions)
 */

import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.PG_HOST || 'localhost',
  port: parseInt(process.env.PG_PORT || '5432', 10),
  database: process.env.PG_DATABASE || 'cfr_site',
  user: process.env.PG_USER || 'cfr',
  password: process.env.PG_PASSWORD,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

if (!process.env.PG_PASSWORD) {
  console.warn('⚠️ PG_PASSWORD не установлен — подключения к PostgreSQL будут падать на сервере');
}

// ============================================
// Проверка доступности PostgreSQL
// ============================================
export async function isPgAvailable(): Promise<boolean> {
  try {
    const client = await pool.connect();
    try {
      await client.query('SELECT 1');
      return true;
    } finally {
      client.release();
    }
  } catch {
    return false;
  }
}

// ============================================
// CRUD: ПОЛЬЗОВАТЕЛИ (ЛК)
// ============================================

export async function createUser(phone: string, passwordHash: string, name?: string, email?: string): Promise<any> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO users (phone, password_hash, name, email)
       VALUES ($1, $2, $3, $4)
       RETURNING id, phone, name, email, created_at`,
      [phone, passwordHash, name || null, email || null]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

export async function getUserByPhone(phone: string): Promise<any | null> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM users WHERE phone = $1',
      [phone]
    );
    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

export async function getUserById(id: number): Promise<any | null> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

export async function getAllUsers(): Promise<any[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT id, phone, name, email, created_at, birth_date, gender, balance, parent_phone_1, parent_phone_2, source FROM users ORDER BY created_at DESC'
    );
    return result.rows;
  } finally {
    client.release();
  }
}

/**
 * Создаёт пользователя из CRM (Excel).
 * phone — уникальный ключ, ON CONFLICT игнорирует дубликаты.
 */
export async function upsertUserFromCrm(
  phone: string,
  name: string,
  birthDate: string | null,
  gender: string | null,
  balance: number | null,
  parentPhone1: string | null,
  parentPhone2: string | null,
  source: string | null,
  createdAtCrm: string | null,
): Promise<{ created: boolean; user: any }> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO users (phone, name, birth_date, gender, balance, parent_phone_1, parent_phone_2, source, created_at_crm)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (phone) DO UPDATE SET
         name = EXCLUDED.name,
         birth_date = COALESCE(EXCLUDED.birth_date, users.birth_date),
         gender = COALESCE(EXCLUDED.gender, users.gender),
         balance = COALESCE(EXCLUDED.balance, users.balance),
         parent_phone_1 = COALESCE(EXCLUDED.parent_phone_1, users.parent_phone_1),
         parent_phone_2 = COALESCE(EXCLUDED.parent_phone_2, users.parent_phone_2)
       RETURNING id, phone, name, email, created_at, birth_date, gender, balance, parent_phone_1, parent_phone_2, source, created_at_crm`,
      [phone, name, birthDate, gender, balance, parentPhone1, parentPhone2, source || 'crm_import', createdAtCrm]
    );
    return { created: true, user: result.rows[0] };
  } catch (err: any) {
    if (err.code === '23505') {
      // Дубликат телефона — обновляем
      const updateResult = await client.query(
        `UPDATE users SET name = $2, birth_date = COALESCE($3, birth_date), gender = COALESCE($4, gender),
         balance = COALESCE($5, balance), parent_phone_1 = COALESCE($6, parent_phone_1),
         parent_phone_2 = COALESCE($7, parent_phone_2)
         WHERE phone = $1
         RETURNING id, phone, name, email, created_at, birth_date, gender, balance, parent_phone_1, parent_phone_2, source, created_at_crm`,
        [phone, name, birthDate, gender, balance, parentPhone1, parentPhone2]
      );
      return { created: false, user: updateResult.rows[0] };
    }
    throw err;
  } finally {
    client.release();
  }
}

export async function deleteUser(id: number): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query('DELETE FROM users WHERE id = $1', [id]);
    return true;
  } catch {
    return false;
  } finally {
    client.release();
  }
}

// ============================================
// CRUD: ПОСЕЩЕНИЯ (ЛК)
// ============================================

export async function createVisit(userId: number, programId: number | null, visitDate: string): Promise<any> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO user_visits (user_id, program_id, visit_date)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [userId, programId, visitDate]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

export async function createVisitBulk(visits: Array<{ userId: number; programId: number | null; visitDate: string }>): Promise<number> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let count = 0;
    for (const v of visits) {
      await client.query(
        'INSERT INTO user_visits (user_id, program_id, visit_date) VALUES ($1, $2, $3)',
        [v.userId, v.programId, v.visitDate]
      );
      count++;
    }
    await client.query('COMMIT');
    return count;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function getUserVisits(userId: number): Promise<any[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM user_visits WHERE user_id = $1 ORDER BY visit_date DESC',
      [userId]
    );
    return result.rows;
  } finally {
    client.release();
  }
}

export async function getAllVisits(): Promise<any[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT uv.*, u.phone as user_phone, u.name as user_name
       FROM user_visits uv
       LEFT JOIN users u ON u.id = uv.user_id
       ORDER BY uv.visit_date DESC`
    );
    return result.rows;
  } finally {
    client.release();
  }
}

// ============================================
// CRUD: ПОДПИСКИ (ЛК)
// ============================================

export async function createSubscription(userId: number, programId: number | null, status: string = 'active'): Promise<any> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO user_subscriptions (user_id, program_id, status)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [userId, programId, status]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

export async function getUserSubscriptions(userId: number): Promise<any[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT us.*, p.name as program_name
       FROM user_subscriptions us
       LEFT JOIN programs p ON p.id = us.program_id
       WHERE us.user_id = $1
       ORDER BY us.created_at DESC`,
      [userId]
    );
    return result.rows;
  } finally {
    client.release();
  }
}

export async function getAllSubscriptions(): Promise<any[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT us.*, u.phone as user_phone, u.name as user_name, p.name as program_name
       FROM user_subscriptions us
       LEFT JOIN users u ON u.id = us.user_id
       LEFT JOIN programs p ON p.id = us.program_id
       ORDER BY us.created_at DESC`
    );
    return result.rows;
  } finally {
    client.release();
  }
}

export async function updateSubscriptionStatus(id: number, status: string): Promise<any> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'UPDATE user_subscriptions SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );
    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

// ============================================
// CRUD: ОПЛАТЫ (ЛК)
// ============================================

export async function createPayment(userId: number, amount: number, description?: string, programId?: number | null, source: string = 'manual'): Promise<any> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO user_payments (user_id, amount, description, program_id, source, payment_date)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING *`,
      [userId, amount, description || null, programId || null, source]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

export async function getPaymentsForUser(userId: number): Promise<any[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT * FROM user_payments WHERE user_id = $1 ORDER BY payment_date DESC`,
      [userId]
    );
    return result.rows;
  } finally {
    client.release();
  }
}

export async function getAllPayments(): Promise<any[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT up.*, u.phone as user_phone, u.name as user_name
       FROM user_payments up
       LEFT JOIN users u ON u.id = up.user_id
       ORDER BY up.payment_date DESC`
    );
    return result.rows;
  } finally {
    client.release();
  }
}

export async function importPaymentsFromCrm(payments: Array<{ userId: number; amount: number; paymentDate: string; description?: string; programId?: number | null }>): Promise<number> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let count = 0;
    for (const p of payments) {
      await client.query(
        `INSERT INTO user_payments (user_id, amount, payment_date, description, program_id, source)
         VALUES ($1, $2, $3, $4, $5, 'crm_import')`,
        [p.userId, p.amount, p.paymentDate, p.description || null, p.programId || null]
      );
      count++;
    }
    await client.query('COMMIT');
    return count;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// ============================================
// CRUD: НАСТРОЙКИ (key-value)
// ============================================

export async function getSetting(key: string): Promise<any> {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT value FROM settings WHERE key = $1', [key]);
    return result.rows[0]?.value || null;
  } finally {
    client.release();
  }
}

export async function saveSetting(key: string, value: any): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO settings (key, value, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $2::jsonb, updated_at = NOW()`,
      [key, JSON.stringify(value)]
    );
  } finally {
    client.release();
  }
}

export { pool };
export default pool;

// ============================================
// ПОДСЧЁТ ЗАПИСЕЙ В ТАБЛИЦАХ
// ============================================

export async function getTableCounts(): Promise<Record<string, number>> {
  const client = await pool.connect();
  try {
    const tables = [
      'cfr_persons', 'cfr_clients', 'cfr_teachers', 'cfr_media',
      'cfr_styles', 'cfr_halls', 'cfr_branches', 'cfr_entities',
      'cfr_accounts', 'cfr_visits', 'cfr_reservations',
      'cfr_schedule_entries', 'cfr_transactions', 'cfr_tasks',
      'cfr_messages', 'cfr_pages', 'cfr_contacts',
      'trainers', 'programs', 'news', 'sliders',
      'schedule_items', 'prices', 'staff', 'sections', 'workouts',
      'settings', 'db_meta', 'users',
      'user_visits', 'user_payments', 'user_subscriptions',
      'bridge_queue',
    ];
    const counts: Record<string, number> = {};
    for (const table of tables) {
      try {
        const result = await client.query(`SELECT COUNT(*) as cnt FROM ${table}`);
        counts[table] = parseInt(result.rows[0].cnt, 10);
      } catch {
        counts[table] = 0;
      }
    }
    return counts;
  } finally {
    client.release();
  }
}

// ============================================
// МЕТА-ИНФОРМАЦИЯ (миграции)
// ============================================

export async function logMigration(source: string, records: number): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(
      'INSERT INTO db_meta (source, records) VALUES ($1, $2)',
      [source, records]
    );
  } finally {
    client.release();
  }
}

export async function getMigrationHistory(): Promise<any[]> {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT * FROM db_meta ORDER BY migrated_at DESC LIMIT 10');
    return result.rows;
  } finally {
    client.release();
  }
}