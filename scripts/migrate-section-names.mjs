#!/usr/bin/env node
/**
 * scripts/migrate-section-names.mjs — миграция имён разделов (S127, решение Р1).
 *
 * Переносит текущие settings.homeSections[].title в settings.sectionNames,
 * кроме trainers → «Коллектив» (имя выбрано пользователем с расчётом на
 * не-тренеров в разделе). homeSections[].title остаётся в схеме: теперь это
 * заголовок блока на главной (пусто → sectionNames[id]).
 *
 * Идемпотентно: если settings.sectionNames уже заполнен — ничего не меняется.
 * Бэкапит db.json перед записью.
 *
 *   node scripts/migrate-section-names.mjs [--dry-run]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { flattenDb, nestDb } from './db-format.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const dbPath = path.join(root, 'db.json');
const dryRun = process.argv.includes('--dry-run');

const DEFAULTS = {
  schedule: 'Наше расписание',
  prices: 'Наши цены',
  programs: 'Наши тренировки',
  trainers: 'Коллектив',        // Р1
  news: 'Новости центра',
  contacts: 'Контакты'
};

const db = flattenDb(JSON.parse(fs.readFileSync(dbPath, 'utf-8')));
const existing = (db.sectionNames && typeof db.sectionNames === 'object') ? db.sectionNames : {};
const homeTitles = {};
(db.homeSections || []).forEach(s => {
  if (s && DEFAULTS[s.id] !== undefined && String(s.title || '').trim()) {
    homeTitles[s.id] = String(s.title).trim();
  }
});

const next = {};
const changes = [];
for (const id of Object.keys(DEFAULTS)) {
  const current = String(existing[id] == null ? '' : existing[id]).trim();
  // Свойство уже задано админом — не трогаем; иначе — миграция из homeSections
  // Исключение: trainers → «Коллектив» (Р1), не берём из homeSections
  if (id === 'trainers') {
    next[id] = DEFAULTS[id];  // всегда «Коллектив»
    if (current !== next[id]) changes.push(`${id}: "${current}" → "${next[id]}" (Р1)`);
  } else {
    const value = current || homeTitles[id] || DEFAULTS[id];
    next[id] = value.slice(0, 60);
    if (current !== next[id]) changes.push(`${id}: "${current}" → "${next[id]}"`);
  }
}

// Подзаголовки разделов (S127 шаг 3): добавляем поле, если его нет
let subtitleAdded = 0;
for (const s of (db.homeSections || [])) {
  if (s && typeof s.subtitle !== 'string') { s.subtitle = ''; subtitleAdded++; }
}

console.log('Миграция sectionNames (Р1):');
console.log(changes.length ? changes.map(c => '   ' + c).join('\n') : '   изменений нет (ключ уже заполнен)');
console.log(`   homeSections[].subtitle добавлено записей: ${subtitleAdded}`);

if (!changes.length && !subtitleAdded) {
  console.log('\n✅ Идемпотентно: база уже в целевом состоянии, запись не нужна.');
  process.exit(0);
}

if (dryRun) {
  console.log('\n(--dry-run) db.json не изменён.');
  process.exit(0);
}

const stamp = Date.now();
const backups = path.join(root, 'backups');
fs.mkdirSync(backups, { recursive: true });
fs.copyFileSync(dbPath, path.join(backups, `db.json.backup.${stamp}`));

db.sectionNames = next;
db.homeSections = (db.homeSections || []).map(s => ({ ...s, subtitle: typeof s.subtitle === 'string' ? s.subtitle : '' }));
fs.writeFileSync(dbPath, JSON.stringify(nestDb(db), null, 2), 'utf-8');
console.log(`\n✅ Записано. Бэкап: backups/db.json.backup.${stamp}`);
