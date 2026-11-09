#!/usr/bin/env node
/**
 * scripts/deploy-merge-db.mjs — мерж базы при деплое (S101, запрет №1)
 *
 * Проблема, которую решает:
 *   На сервере db.json — источник истины: там живут заявки, посещения, правки
 *   из админки. В репозитории лежит восстановленная и дополненная база дева.
 *   Обычный деплой либо затирает серверную базу репозиторной, либо (вариант
 *   «cp бэкапа обратно») откатывает восстановленные данные дева. Оба варианта
 *   нарушают запрет «данные с сервера не теряются».
 *
 * Правила мержа:
 *   1. Списочные разделы (data.*, sliders, sections, staff, employees, …) —
 *      объединение по id. Записи, которых нет в репозитории, ДОБАВЛЯЮТСЯ из
 *      сервера (серверные данные не теряются). При совпадении id выигрывает
 *      репозиторий, кроме случая, когда серверная запись свежее (updatedAt/date
 *      больше) — тогда берётся серверная.
 *   2. Словарные разделы (settings.*, contacts, …) — поверхностный мерж:
 *      ключи репозитория выигрывают, ключей, которых нет в репозитории, не
 *      теряем — добавляем из сервера.
 *   3. Неизвестные ключи верхнего уровня сохраняются с обеих сторон.
 *   Ни одна серверная запись не удаляется молча: всё выводится в отчёт.
 *
 * Использование:
 *   node scripts/deploy-merge-db.mjs <server-db.json> [repo-db.json] [--apply]
 *
 *   Без --apply — только отчёт (ничего не пишется).
 *   С --apply   — результат в repo-db.json (по умолчанию ./db.json),
 *                 перед записью — бэкап в backups/db.json.pre-merge.<ts>.
 *
 * Пример на сервере:
 *   cp db.json /tmp/db.server.json
 *   git pull origin main
 *   node scripts/deploy-merge-db.mjs /tmp/db.server.json          # отчёт
 *   node scripts/deploy-merge-db.mjs /tmp/db.server.json --apply  # применить
 *   npm run static:export && pm2 restart cfrsite --update-env
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { flattenDb, nestDb, DATA_KEYS, SETTINGS_KEYS } from './db-format.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const args = process.argv.slice(2).filter(a => a !== '--apply');
const APPLY = process.argv.includes('--apply');
const serverPath = args[0];
const repoPath = args[1] || path.join(root, 'db.json');

if (!serverPath) {
  console.log('Использование: node scripts/deploy-merge-db.mjs <server-db.json> [repo-db.json] [--apply]');
  process.exit(1);
}
for (const p of [serverPath, repoPath]) {
  if (!fs.existsSync(p)) { console.error(`❌ нет файла: ${p}`); process.exit(1); }
}

// Плоское представление: db.news, db.trainers, … — так проще мержить
const server = flattenDb(JSON.parse(fs.readFileSync(serverPath, 'utf-8')));
const repo = flattenDb(JSON.parse(fs.readFileSync(repoPath, 'utf-8')));

const report = [];
let lostServerRecords = 0;

const idOf = (rec) => {
  if (rec === null || typeof rec !== 'object') return null;
  const id = rec.id ?? rec._id;
  return id === undefined || id === null ? null : String(id);
};

// Дата записи для правила «сервер свежее»
const stampOf = (rec) => {
  if (rec === null || typeof rec !== 'object') return '';
  return String(rec.updatedAt || rec.date || rec.createdAt || '');
};

function mergeList(name, serverList, repoList) {
  const sArr = Array.isArray(serverList) ? serverList : [];
  const rArr = Array.isArray(repoList) ? repoList : null;
  if (!rArr) {
    // В репозитории раздела нет — берём серверный как есть
    if (sArr.length) { report.push([name, sArr.length, 0, sArr.length, 'раздела нет в репо → взят серверный']); return sArr; }
    return repoList === undefined ? serverList : repoList;
  }
  if (!Array.isArray(serverList)) { report.push([name, 0, rArr.length, rArr.length, 'на сервере раздела нет']); return rArr; }

  const byId = new Map();
  const noId = [];
  for (const rec of rArr) {
    const id = idOf(rec);
    if (id === null) noId.push(rec); else byId.set(id, rec);
  }

  let added = 0, serverWon = 0;
  for (const sRec of sArr) {
    const id = idOf(sRec);
    if (id === null) { noId.push(sRec); continue; }
    const rRec = byId.get(id);
    if (!rRec) { byId.set(id, sRec); added++; continue; }
    // Совпадение id: репозиторий выигрывает, если серверная запись не свежее
    if (stampOf(sRec) > stampOf(rRec)) { byId.set(id, sRec); serverWon++; }
  }

  // Записи без id: дописываем серверные, которых нет среди репозиторных
  const seen = new Set([...byId.values(), ...noId].map(r => JSON.stringify(r)));
  for (const sRec of sArr.filter(r => idOf(r) === null)) {
    if (!seen.has(JSON.stringify(sRec))) { noId.push(sRec); added++; }
  }

  const merged = [...byId.values(), ...noId];
  if (added || serverWon) {
    lostServerRecords += added;
    report.push([name, sArr.length, rArr.length, merged.length,
      `+${added} с сервера${serverWon ? `, ${serverWon} серверных свежее` : ''}`]);
  }
  return merged;
}

function mergeDict(name, serverObj, repoObj) {
  if (!serverObj || typeof serverObj !== 'object' || Array.isArray(serverObj)) return repoObj ?? serverObj;
  if (!repoObj || typeof repoObj !== 'object' || Array.isArray(repoObj)) return repoObj ?? serverObj;
  const out = { ...serverObj, ...repoObj };   // репозиторий выигрывает по общим ключам
  const onlyServer = Object.keys(serverObj).filter(k => !(k in repoObj));
  if (onlyServer.length) {
    report.push([name, Object.keys(serverObj).length, Object.keys(repoObj).length,
      Object.keys(out).length, `+${onlyServer.length} ключ(ей) только на сервере: ${onlyServer.join(', ')}`]);
  }
  return out;
}

// ── Мерж ────────────────────────────────────────────────────────────
// Тип мержа определяется по фактическому значению ключа, а не по списку
// известных: так не теряются серверные записи в разделах, которых нет в
// DATA_KEYS/SETTINGS_KEYS (additionalContacts, designSettings, …).
const isListVal = (v) => Array.isArray(v);
const isDictVal = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const label = (k) => (DATA_KEYS.includes(k) ? `data.${k}` : SETTINGS_KEYS.includes(k) ? `settings.${k}` : k);

const merged = {};
for (const key of new Set([...Object.keys(server), ...Object.keys(repo)])) {
  const s = server[key], r = repo[key];
  if (isListVal(s) || isListVal(r)) merged[key] = mergeList(label(key), s, r);
  else if (isDictVal(s) && isDictVal(r)) merged[key] = mergeDict(label(key), s, r);
  else merged[key] = r !== undefined ? r : s;   // скаляр: репозиторий выигрывает
}

// ── Отчёт ───────────────────────────────────────────────────────────
console.log(`\n🔀 Мерж базы: сервер=${path.basename(serverPath)} + репо=${path.basename(repoPath)}\n`);
if (report.length) {
  console.log('Раздел'.padEnd(26) + 'Сервер'.padStart(8) + 'Репозиторий'.padStart(13) + 'После'.padStart(8) + '  Что сделано');
  console.log('─'.repeat(96));
  for (const [name, s, r, m, note] of report) {
    console.log(String(name).padEnd(26) + String(s).padStart(8) + String(r).padStart(13) + String(m).padStart(8) + '  ' + note);
  }
  console.log(`\n⚠️  Серверных записей, которых не было в репозитории: ${lostServerRecords}`);
  console.log('    Их нужно перенести в репозиторий (git add db.json && commit),');
  console.log('    иначе следующий деплой снова их добавит из сервера.');
} else {
  console.log('✅ Расхождений нет — серверная база и база репозитория совместимы.');
}

if (!APPLY) {
  console.log('\nРежим отчёта. Применить: ' +
    `node scripts/deploy-merge-db.mjs ${serverPath} ${args[1] || 'db.json'} --apply\n`);
  process.exit(0);
}

// ── Запись с бэкапом ────────────────────────────────────────────────
const backupsDir = path.join(root, 'backups');
fs.mkdirSync(backupsDir, { recursive: true });
const backup = path.join(backupsDir, `db.json.pre-merge.${Date.now()}`);
fs.copyFileSync(repoPath, backup);
fs.writeFileSync(repoPath, JSON.stringify(nestDb(merged), null, 2) + '\n');
console.log(`\n💾 Записано: ${repoPath}\n   Бэкап прежней версии: ${backup}\n`);
