#!/usr/bin/env node

/**
 * Скрипт для инициализации базы данных PostgreSQL
 * Запуск: node scripts/init-db.mjs
 *
 * Читает SQL из docker/init.sql и выполняет его в БД.
 * Безопасно — все команды IF NOT EXISTS.
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

// Конфигурация из переменных окружения или по умолчанию
const config = {
  host: process.env.PG_HOST || 'localhost',
  port: parseInt(process.env.PG_PORT || '5432', 10),
  database: process.env.PG_DATABASE || 'cfr_site',
  user: process.env.PG_USER || 'cfr',
  password: process.env.PG_PASSWORD || 'cfr_secret_2026',
};

async function main() {
  console.log('🔧 Инициализация базы данных PostgreSQL');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Хост:     ${config.host}`);
  console.log(`  Порт:     ${config.port}`);
  console.log(`  База:     ${config.database}`);
  console.log(`  Пользователь: ${config.user}`);
  console.log('');

  // Читаем SQL-файл
  const sqlPath = path.join(rootDir, 'docker', 'init.sql');
  if (!fs.existsSync(sqlPath)) {
    console.error(`❌ Файл ${sqlPath} не найден`);
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlPath, 'utf-8');
  console.log(`📄 Загружен SQL (${sql.length} символов)`);

  // Подключаемся к PostgreSQL
  const pool = new pg.Pool(config);

  try {
    // Проверка соединения
    const client = await pool.connect();
    try {
      const versionResult = await client.query('SELECT version()');
      console.log(`✅ Подключено: ${versionResult.rows[0].version}`);
      console.log('');

      // Выполняем SQL
      console.log('🔄 Выполнение SQL...');
      await client.query(sql);
      console.log('✅ SQL успешно выполнен');
      console.log('');

      // Проверяем, что таблицы созданы
      const tablesResult = await client.query(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name
      `);
      const tables = tablesResult.rows.map(r => r.table_name);
      console.log(`📊 Создано ${tables.length} таблиц:`);
      for (const table of tables) {
        const countResult = await client.query(`SELECT COUNT(*) as cnt FROM ${table}`);
        console.log(`   ✓ ${table} (${countResult.rows[0].cnt} записей)`);
      }
      console.log('');
      console.log('🎉 Инициализация базы данных завершена успешно!');
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('❌ Ошибка инициализации БД:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();