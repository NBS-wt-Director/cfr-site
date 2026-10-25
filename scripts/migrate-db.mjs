#!/usr/bin/env node
/**
 * scripts/migrate-db.mjs — одноразовая миграция db.json к вложенной структуре (S4).
 *
 *   node scripts/migrate-db.mjs          — плоский → вложенный (data + settings)
 *   node scripts/migrate-db.mjs --check  — только показать состояние структуры
 *
 * Безопасность:
 *   - перед записью — бэкап в backups/db.json.backup.<timestamp>;
 *   - повторный запуск на уже вложенном файле — no-op;
 *   - данные не теряются: неизвестные ключи остаются на верхнем уровне.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { flattenDb, nestDb, isNested, DATA_KEYS, SETTINGS_KEYS } from './db-format.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const dbPath = path.join(root, 'db.json');

const args = process.argv.slice(2);
const checkOnly = args.includes('--check');

if (!fs.existsSync(dbPath)) {
  console.error('❌ db.json не найден:', dbPath);
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));

console.log('📦 Структура db.json:', isNested(raw) ? 'вложенная (data.*/settings.*)' : 'плоская');
console.log('   Ключи верхнего уровня:', Object.keys(raw).join(', '));

if (isNested(raw)) {
  console.log('✅ Миграция не требуется — файл уже вложенный.');
  const flat = flattenDb(raw);
  console.log('   data.*    :', DATA_KEYS.filter(k => flat[k] !== undefined).join(', ') || '(пусто)');
  console.log('   settings.*:', SETTINGS_KEYS.filter(k => flat[k] !== undefined).join(', ') || '(пусто)');
  process.exit(0);
}

if (checkOnly) {
  console.log('ℹ️  Запущен с --check — миграция НЕ выполнена. Запустите без флага для миграции.');
  process.exit(0);
}

// ── Миграция ──
const flat = flattenDb(raw);

// Легаси-ключ settings: [] (пустой массив из старой схемы) — данные отсутствуют,
// при вложенном формате ключ settings занимает объект настроек.
if (Array.isArray(flat.settings) && flat.settings.length === 0) {
  delete flat.settings;
  console.log('ℹ️  Легаси-ключ settings: [] (пустой) — удалён.');
} else if (Array.isArray(flat.settings)) {
  console.error('❌ Легаси-ключ settings непустой — сначала разберитесь с ним вручную.');
  process.exit(1);
}

const nested = nestDb(flat);

// Проверка целостности: ни один ключ не потерян, ни одно значение не изменилось
const flatBack = flattenDb(nested);
const lostKeys = Object.keys(flat).filter(k => flatBack[k] === undefined);
const changedKeys = Object.keys(flat).filter(
  k => flatBack[k] !== undefined && JSON.stringify(flat[k]) !== JSON.stringify(flatBack[k])
);
if (lostKeys.length || changedKeys.length) {
  console.error('❌ Проверка целостности ПРОВАЛЕНА.');
  if (lostKeys.length) console.error('   Потеряны ключи:', lostKeys.join(', '));
  if (changedKeys.length) console.error('   Изменены ключи:', changedKeys.join(', '));
  console.error('   Миграция НЕ выполнена.');
  process.exit(1);
}

// Бэкап
const backupsDir = path.join(root, 'backups');
if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });
const backupPath = path.join(backupsDir, `db.json.backup.${Date.now()}`);
fs.copyFileSync(dbPath, backupPath);
console.log('💾 Бэкап:', backupPath);

// Запись
fs.writeFileSync(dbPath, JSON.stringify(nested, null, 2), 'utf-8');

console.log('✅ Миграция выполнена.');
console.log('   data.*    :', DATA_KEYS.filter(k => nested.data[k] !== undefined).join(', ') || '(пусто)');
console.log('   settings.*:', SETTINGS_KEYS.filter(k => nested.settings[k] !== undefined).join(', ') || '(пусто)');
const extras = Object.keys(nested).filter(k => k !== 'data' && k !== 'settings');
console.log('   верхний уровень:', extras.join(', ') || '(пусто)');
console.log('\n👉 Проверьте: node scripts/export-static.mjs');
