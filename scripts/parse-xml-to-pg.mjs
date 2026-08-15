#!/usr/bin/env node

/**
 * parse-xml-to-pg.mjs — Импорт данных донора (JSON) в PostgreSQL
 *
 * Читает:
 *   - данные/DB/json_schema.json    — схема сущностей и типы полей
 *   - данные/DB/json_summary.json   — сводки по сущностям
 *   - данные/DB/json_data/*.json    — полные записи данных
 *
 * Делает:
 *   1. Создаёт таблицы `donor_<entity>` по схеме из json_schema.json
 *   2. Импортирует данные из json_data/*.json
 *   3. Показывает статистику: создано / обновлено / пропущено / ошибки
 *
 * Запуск:
 *   node scripts/parse-xml-to-pg.mjs            # полный импорт
 *   node scripts/parse-xml-to-pg.mjs --dry-run  # только план, без подключения к БД
 *
 * Переменные окружения:
 *   PG_HOST, PG_PORT, PG_DATABASE, PG_USER, PG_PASSWORD
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const { Pool } = pg;

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_DIR = join(__dirname, '..', 'данные', 'DB');
const JSON_DATA_DIR = join(DB_DIR, 'json_data');

// Префикс таблиц, чтобы не конфликтовать с таблицами приложения
const TABLE_PREFIX = 'donor_';

const pgConfig = {
  host: process.env.PG_HOST || 'localhost',
  port: parseInt(process.env.PG_PORT || '5432', 10),
  database: process.env.PG_DATABASE || 'cfr_site',
  user: process.env.PG_USER || 'cfr',
  password: process.env.PG_PASSWORD || 'cfr_secret_2026',
};

// ==================== Маппинг типов JSON → SQL ====================

function sqlTypeFor(schemaType) {
  switch (schemaType) {
    case 'UUID': return 'UUID';
    case 'integer': return 'BIGINT';
    case 'float': return 'DOUBLE PRECISION';
    case 'boolean': return 'BOOLEAN';
    case 'date (DD.MM.YYYY)': return 'DATE';
    case 'datetime': return 'TIMESTAMP';
    case 'string':
    case 'empty':
    default: return 'TEXT';
  }
}

// ==================== Конвертация значений ====================

function parseDate(str) {
  if (!str || String(str).trim() === '') return null;
  const m = String(str).trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function parseDateTime(str) {
  if (!str || String(str).trim() === '') return null;
  const m = String(str).trim().match(/^(\d{2})\.(\d{2})\.(\d{4})[ T](\d{2}):(\d{2}):(\d{2})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}:${m[6]}`;
}

function parseBool(str) {
  if (str === undefined || str === null) return null;
  const s = String(str).trim().toLowerCase();
  if (s === '') return null;
  if (s === 'true' || s === '1' || s === 'yes') return true;
  if (s === 'false' || s === '0' || s === 'no') return false;
  return null;
}

/** Конвертирует значение записи в SQL-тип по схеме поля */
function convertValue(value, schemaType) {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  if (s === '') return null;

  switch (schemaType) {
    case 'UUID':
      return s;
    case 'integer':
      return /^-?\d+$/.test(s) ? parseInt(s, 10) : null;
    case 'float':
      return /^-?\d+(\.\d+)?$/.test(s) ? parseFloat(s) : null;
    case 'boolean':
      return parseBool(s);
    case 'date (DD.MM.YYYY)':
      return parseDate(s);
    case 'datetime':
      return parseDateTime(s);
    case 'string':
    case 'empty':
    default:
      return s;
  }
}

// ==================== Чтение входных файлов ====================

function readJson(path, fallback) {
  try {
    if (!existsSync(path)) return fallback;
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch (err) {
    console.warn(`   ⚠️ Не удалось прочитать ${path}: ${err.message}`);
    return fallback;
  }
}

/** Загружает записи сущности из json_data/<Entity>.json */
function loadEntityData(entityName) {
  // Файлы в json_data названы в PascalCase (Client.json, IndividualAccount.json...),
  // а ключи схемы — в нижнем регистре (client, individualaccount...).
  // Ищем файл без учёта регистра.
  if (!existsSync(JSON_DATA_DIR)) return [];

  const target = `${entityName.toLowerCase()}.json`;
  const fileName = readdirSync(JSON_DATA_DIR).find(
    (f) => f.toLowerCase() === target
  );
  if (!fileName) return [];

  const data = readJson(join(JSON_DATA_DIR, fileName), []);
  return Array.isArray(data) ? data : [];
}

// ==================== Создание таблиц ====================

function buildCreateTableSQL(entityName, schema) {
  const tableName = `${TABLE_PREFIX}${entityName}`;
  const fields = schema.fields || [];

  if (fields.length === 0) {
    // Сущность без полей — создаём таблицу только с id
    return {
      tableName,
      sql: `CREATE TABLE IF NOT EXISTS ${tableName} (
        id TEXT PRIMARY KEY
      )`,
    };
  }

  const columns = fields
    .filter((f) => f.name)
    .map((f) => {
      if (f.name === 'ID') {
        return `"ID" ${sqlTypeFor(f.type || 'UUID')} PRIMARY KEY`;
      }
      return `"${f.name}" ${sqlTypeFor(f.type || 'string')}`;
    });

  // Если в схеме нет поля ID — добавляем суррогатный ключ
  const hasId = fields.some((f) => f.name === 'ID');
  const idColumn = hasId ? '' : 'id TEXT PRIMARY KEY, ';

  return {
    tableName,
    sql: `CREATE TABLE IF NOT EXISTS ${tableName} (
      ${idColumn}${columns.join(',\n      ')}
    )`,
  };
}

// ==================== Импорт данных ====================

function convertRecord(record, schema) {
  const fields = schema.fields || [];
  const typeMap = new Map(fields.map((f) => [f.name, f.type || 'string']));

  const row = {};
  for (const [key, value] of Object.entries(record)) {
    const schemaType = typeMap.get(key) || 'string';
    row[key] = convertValue(value, schemaType);
  }
  return row;
}

/** Импортирует записи батчами с обработкой ошибок */
async function importEntity(client, tableName, schema, rows, dryRun) {
  if (rows.length === 0) return { inserted: 0, updated: 0, skipped: 0, errors: 0 };

  const fields = schema.fields || [];
  const colNames = fields.filter((f) => f.name).map((f) => f.name);
  if (colNames.length === 0) colNames.push('id');

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  // Для сущностей с ID используем ON CONFLICT (id) DO UPDATE
  const hasId = colNames.includes('ID');
  const idCol = hasId ? 'ID' : 'id';

  const batchSize = 500;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);

    // Конвертируем каждую запись
    const converted = [];
    for (const rec of batch) {
      const row = convertRecord(rec, schema);
      if (!row[idCol] && row[idCol] !== 0) {
        skipped++;
        continue;
      }
      converted.push(row);
    }

    if (converted.length === 0) continue;

    const placeholders = converted
      .map((_, vi) =>
        colNames.map((_, pi) => `$${vi * colNames.length + pi + 1}`).join(', ')
      )
      .map((p) => `(${p})`)
      .join(', ');

    const values = converted.flatMap((row) => colNames.map((c) => row[c] ?? null));

    const updateSet = hasId
      ? colNames.filter((c) => c !== idCol).map((c) => `"${c}" = EXCLUDED."${c}"`).join(', ')
      : '';

    const upsertSql = hasId
      ? `INSERT INTO ${tableName} ("${colNames.join('", "')}") VALUES ${placeholders}
         ON CONFLICT ("${idCol}") DO UPDATE SET ${updateSet}`
      : `INSERT INTO ${tableName} ("${colNames.join('", "')}") VALUES ${placeholders} ON CONFLICT DO NOTHING`;

    if (dryRun) {
      inserted += converted.length;
      continue;
    }

    try {
      const result = await client.query(upsertSql, values);
      // При ON CONFLICT DO UPDATE pg вернёт каждую обработанную строку как 1
      inserted += result.rowCount;
    } catch (err) {
      // Ошибка батча — вставляем по одной для подсчёта точной статистики
      for (const row of converted) {
        const singleValues = colNames.map((c) => row[c] ?? null);
        const singlePlaceholders = colNames.map((_, pi) => `$${pi + 1}`).join(', ');
        const singleSql = hasId
          ? `INSERT INTO ${tableName} ("${colNames.join('", "')}") VALUES (${singlePlaceholders})
             ON CONFLICT ("${idCol}") DO UPDATE SET ${updateSet}`
          : `INSERT INTO ${tableName} ("${colNames.join('", "')}") VALUES (${singlePlaceholders}) ON CONFLICT DO NOTHING`;
        try {
          const r = await client.query(singleSql, singleValues);
          inserted += r.rowCount;
        } catch (singleErr) {
          errors++;
          if (errors <= 3) {
            console.error(`      ✗ ${tableName}: ${singleErr.message}`);
          }
        }
      }
    }
  }

  return { inserted, updated, skipped, errors };
}

// ==================== Главная ====================

function loadSchemaAndSummary() {
  const schemaPath = join(DB_DIR, 'json_schema.json');
  const summaryPath = join(DB_DIR, 'json_summary.json');

  const schema = readJson(schemaPath, {});
  const summary = readJson(summaryPath, {});

  if (Object.keys(schema).length === 0) {
    console.error(`❌ Файл схемы пуст или не найден: ${schemaPath}`);
    process.exit(1);
  }
  return { schema, summary };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  console.log('🚀 Parse XML (JSON) → PostgreSQL\n');

  const { schema, summary } = loadSchemaAndSummary();
  const entityNames = Object.keys(schema);
  console.log(`📊 Найдено сущностей в схеме: ${entityNames.length}`);
  console.log('');

  // Проверяем наличие json_data
  if (!existsSync(JSON_DATA_DIR)) {
    console.warn('⚠️ Директория json_data не найдена. Сначала запустите extract-donor.mjs.');
  }

  if (dryRun) {
    console.log('🔍 РЕЖИМ DRY-RUN — план импорта (без подключения к БД):\n');
    for (const entityName of entityNames) {
      const sch = schema[entityName];
      const recCount = summary[entityName]?.record_count ?? 0;
      const rows = loadEntityData(entityName);
      console.log(`  ${TABLE_PREFIX}${entityName}:`);
      console.log(`     полей: ${(sch.fields || []).length}, ожидается записей: ${recCount}, на диске: ${rows.length}`);
    }
    console.log(`\n✅ DRY-RUN завершён. Для импорта запустите без --dry-run.`);
    return;
  }

  console.log(`🔌 Подключение к PostgreSQL: ${pgConfig.host}:${pgConfig.port} / ${pgConfig.database}\n`);
  const pool = new Pool(pgConfig);

  let totalInserted = 0;
  let totalErrors = 0;

  try {
    const client = await pool.connect();
    try {
      const version = await client.query('SELECT version()');
      console.log(`✅ Подключено: ${version.rows[0].version.split('\n')[0]}\n`);

      for (const entityName of entityNames) {
        const sch = schema[entityName];
        const rows = loadEntityData(entityName);
        const tableInfo = buildCreateTableSQL(entityName, sch);

        // Создаём таблицу
        await client.query(tableInfo.sql);
        console.log(`🔄 ${tableInfo.tableName}: создана (${rows.length} записей на диске)`);

        // Импортируем
        const stats = await importEntity(client, tableInfo.tableName, sch, rows, false);
        totalInserted += stats.inserted;
        totalErrors += stats.errors;
        console.log(
          `   ✅ импортировано: ${stats.inserted}, пропущено: ${stats.skipped}, ошибок: ${stats.errors}`
        );
      }

      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📊 ИТОГОВАЯ СТАТИСТИКА ИМПОРТА');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      // Проверяем фактическое количество записей
      for (const entityName of entityNames) {
        const tableName = `${TABLE_PREFIX}${entityName}`;
        try {
          const result = await client.query(`SELECT COUNT(*) as cnt FROM ${tableName}`);
          console.log(`   ${tableName}: ${result.rows[0].cnt} записей`);
        } catch (err) {
          console.log(`   ${tableName}: ошибка подсчёта (${err.message})`);
        }
      }

      console.log(`\n🎉 Импорт завершён. Всего импортировано: ${totalInserted}, ошибок: ${totalErrors}`);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('❌ Ошибка подключения к PostgreSQL:', err.message);
    console.error('   Проверьте PG_HOST/PG_PORT/PG_DATABASE/PG_USER/PG_PASSWORD');
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
