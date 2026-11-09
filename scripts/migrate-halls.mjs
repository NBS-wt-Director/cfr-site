#!/usr/bin/env node
/**
 * scripts/migrate-halls.mjs — S99
 *
 * Картинки расписания переезжают из `data.schedule[]` в сущность «Залы»
 * (`settings.halls[]`): у зала пока только название и картинка расписания.
 *
 *   settings.halls = [{ id, name, image, visible }]
 *
 * Идемпотентно:
 *   - повторный запуск НЕ плодит дубли (сверка по id и по картинке);
 *   - пустые имена/картинки у уже существующих залов добираются, непустые не затираются;
 *   - `data.schedule` остаётся на месте как источник-наследие (его читают
 *     админка и экспорт до тех пор, пока залов нет) — скрипт его НЕ удаляет.
 *
 *   npm run migrate-halls                — применить
 *   npm run migrate-halls -- --dry-run   — только отчёт
 *   npm run migrate-halls -- --force     — пересобрать залы из data.schedule заново
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { flattenDb, nestDb } from './db-format.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const dbPath = path.join(root, 'db.json');

const DRY_RUN = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');

/**
 * Имена по умолчанию. Два листа расписания = два зала (большой/малый),
 * как залы уже зашиты в модели слотов (`hall: big|small` —
 * `static/js/schedule-ui.js`, `static/admin.html`, `scripts/export-static.mjs`).
 * Название каждого зала админ правит в разделе «🏋️ Залы».
 */
const DEFAULT_NAMES = ['Большой зал', 'Малый зал'];

function log(msg) {
  console.log(`[${new Date().toISOString().slice(0, 19)}] ${msg}`);
}

function main() {
  log('='.repeat(60));
  log(`🏋️ S99: миграция картинок расписания → «Залы» ${DRY_RUN ? '(--dry-run)' : ''}`);
  log('='.repeat(60));

  const db = flattenDb(JSON.parse(fs.readFileSync(dbPath, 'utf8')));

  const legacy = Array.isArray(db.schedule) ? db.schedule : [];
  const existing = Array.isArray(db.halls) ? db.halls : [];

  if (FORCE && !DRY_RUN) {
    log('  ⚠️ --force: залы будут пересобраны из data.schedule');
  }

  // Источник картинок: data.schedule (наследие). Если его нет — берём то, что уже есть.
  const sourceImages = legacy
    .filter(s => s && s.image)
    .map((s, i) => ({
      id: Number(s.id) || i + 1,
      image: s.image,
      name: DEFAULT_NAMES[i] || `Зал ${i + 1}`
    }));

  let halls = FORCE ? [] : existing.slice();

  // 1. Дополняем залы, которых нет, по картинкам из data.schedule
  let created = 0;
  for (const src of sourceImages) {
    const byId = halls.find(h => String(h.id) === String(src.id));
    if (byId) {
      // есть — добиваем пустые поля, непустые не трогаем
      if (!byId.name) { byId.name = src.name; log(`  ✏️  Зал ${src.id}: добрано имя «${src.name}»`); }
      if (!byId.image) { byId.image = src.image; log(`  ✏️  Зал ${src.id}: добрана картинка ${src.image}`); }
      if (byId.visible === undefined) { byId.visible = true; }
      continue;
    }
    const byImage = halls.find(h => h.image === src.image);
    if (byImage) {
      log(`  =  Картинка ${src.image} уже есть у зала ${byImage.id} — дубль не создан`);
      continue;
    }
    halls.push({ id: src.id, name: src.name, image: src.image, visible: true });
    created++;
    log(`  🆕 Зал ${src.id}: «${src.name}» — ${src.image}`);
  }

  // 2. Залы без картинок из наследия (созданы в админке) — только нормализуем поля
  for (const h of halls) {
    if (h.visible === undefined) h.visible = true;
    if (h.image === undefined) h.image = '';
    if (h.name === undefined) h.name = '';
    if (!h.id) h.id = Date.now();
  }

  // 3. Порядок = порядок data.schedule (для тех, кто в нём есть), остальные — за ними
  const orderIndex = new Map(sourceImages.map((s, i) => [String(s.id), i]));
  halls.sort((a, b) => {
    const ai = orderIndex.has(String(a.id)) ? orderIndex.get(String(a.id)) : Infinity;
    const bi = orderIndex.has(String(b.id)) ? orderIndex.get(String(b.id)) : Infinity;
    return ai - bi;
  });

  db.halls = halls;

  log('\n📊 ИТОГО:');
  log(`  Картинок в data.schedule (наследие): ${legacy.length}`);
  log(`  Залов в settings.halls:              ${halls.length}  (создано ${created})`);
  for (const h of halls) {
    log(`   • ${h.id} | ${h.name || '—'} | ${h.image || '—'} | ${h.visible ? '👁 виден' : '🙈 скрыт'}`);
  }

  if (!halls.length) {
    log('\n  ⚠️ Залов нет и создавать не из чего — data.schedule пуст. Ничего не пишем.');
    return;
  }

  if (DRY_RUN) {
    log('\n  📄 dry-run — db.json НЕ изменён');
    return;
  }

  if (!created && !FORCE) {
    // Проверка, что реально менять есть что (добавленные поля) — иначе не пишем
    const before = JSON.stringify(flattenDb(JSON.parse(fs.readFileSync(dbPath, 'utf8'))).halls || []);
    if (before === JSON.stringify(halls)) {
      log('\n  ✅ Изменений нет — db.json не переписываем (идемпотентно).');
      return;
    }
  }

  const backupsDir = path.join(root, 'backups');
  fs.mkdirSync(backupsDir, { recursive: true });
  const backupPath = path.join(backupsDir, `db.json.backup.${Date.now()}`);
  fs.copyFileSync(dbPath, backupPath);
  log(`\n  💾 Бэкап: ${path.relative(root, backupPath)}`);

  fs.writeFileSync(dbPath, JSON.stringify(nestDb(db), null, 2), 'utf8');
  log('  ✅ db.json записан (settings.halls)');
  log('  ➡️  Далее: npm run static:export');
}

main();
