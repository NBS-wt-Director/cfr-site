/**
 * Скрипт прямой миграции db.json → PostgreSQL (простые таблицы)
 * Читает db.json и заполняет таблицы: trainers, programs, news,
 * sliders, sections, schedule_items, prices, staff.
 *
 * Запуск (на сервере, в каталоге проекта):
 *   PGPASSWORD=... node scripts/migrate-db-json-to-pg.mjs
 *
 * Использует переменные окружения: PG_HOST, PG_PORT, PG_DATABASE, PG_USER, PG_PASSWORD
 * (или значения по умолчанию из .env.production, если экспортированы).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- Конфигурация подключения ---
const config = {
  host: process.env.PG_HOST || '127.0.0.1',
  port: parseInt(process.env.PG_PORT || '5432', 10),
  database: process.env.PG_DATABASE || 'cfr_site',
  user: process.env.PG_USER || 'cfr',
  password: process.env.PG_PASSWORD || '',
};

// Динамический импорт pg (ESM)
const { default: pg } = await import('pg');

function esc(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  const s = String(v).replace(/'/g, "''");
  return `'${s}'`;
}

function escJson(v) {
  if (v === null || v === undefined) return 'NULL';
  const s = JSON.stringify(v).replace(/'/g, "''");
  return `'${s}'::jsonb`;
}

async function main() {
  const dbPath = path.join(process.cwd(), 'db.json');
  if (!fs.existsSync(dbPath)) {
    console.error('❌ db.json не найден:', dbPath);
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));

  const client = new pg.Client(config);
  await client.connect();
  console.log('✅ Подключено к PostgreSQL');

  try {
    await client.query('BEGIN');

    // --- 1. Тренеры ---
    const trainers = data.trainers || [];
    await client.query('TRUNCATE trainers RESTART IDENTITY CASCADE');
    for (const t of trainers) {
      await client.query(
        `INSERT INTO trainers (id, image, name, experience, type, description, specialization, is_director)
         VALUES (${esc(t.id)}, ${esc(t.image)}, ${esc(t.name)}, ${esc(t.experience)}, 'trainer', NULL, NULL, FALSE)`
      );
    }
    console.log(`✅ Тренеры: ${trainers.length}`);

    // --- 2. Программы ---
    const programs = data.programs || [];
    await client.query('TRUNCATE programs RESTART IDENTITY CASCADE');
    await client.query('TRUNCATE program_workouts RESTART IDENTITY CASCADE');
    for (const p of programs) {
      await client.query(
        `INSERT INTO programs (id, image, name, type, description)
         VALUES (${esc(p.id)}, ${esc(p.image)}, ${esc(p.name)}, ${esc(p.type)}, ${esc(p.description)})`
      );
      // Тренировки внутри программ
      for (const w of p.workouts || []) {
        await client.query(
          `INSERT INTO program_workouts (program_id, day, time, params)
           VALUES (${esc(p.id)}, ${esc(w.day)}, ${esc(w.time)}, ${escJson(w.params || [])})`
        );
      }
    }
    console.log(`✅ Программы: ${programs.length}`);

    // --- 3. Новости ---
    const news = data.news || [];
    await client.query('TRUNCATE news RESTART IDENTITY CASCADE');
    for (const n of news) {
      await client.query(
        `INSERT INTO news (id, image, title, text, description)
         VALUES (${esc(n.id)}, ${esc(n.image)}, ${esc(n.title)}, ${esc(n.text)}, ${esc(n.description)})`
      );
    }
    console.log(`✅ Новости: ${news.length}`);

    // --- 4. Слайдер ---
    const sliders = data.sliders || [];
    await client.query('TRUNCATE sliders RESTART IDENTITY CASCADE');
    for (const s of sliders) {
      await client.query(
        `INSERT INTO sliders (id, title, image, interval, position)
         VALUES (${esc(s.id)}, ${esc(s.title)}, ${esc(s.image)}, ${esc(s.interval ?? 5)}, ${esc(s.position || 'center')})`
      );
    }
    console.log(`✅ Слайдеры: ${sliders.length}`);

    // --- 5. Разделы главной ---
    const sections = data.sections || [];
    await client.query('TRUNCATE sections RESTART IDENTITY CASCADE');
    for (const s of sections) {
      await client.query(
        `INSERT INTO sections (id, title, background, cols)
         VALUES (${esc(s.id)}, ${esc(s.title)}, ${esc(s.background)}, ${esc(s.cols ?? null)})`
      );
    }
    console.log(`✅ Разделы: ${sections.length}`);

    // --- 6. Расписание (картинки) ---
    const schedule = data.schedule || [];
    await client.query('TRUNCATE schedule_items RESTART IDENTITY CASCADE');
    for (const s of schedule) {
      await client.query(
        `INSERT INTO schedule_items (id, image)
         VALUES (${esc(s.id)}, ${esc(s.image)})`
      );
    }
    console.log(`✅ Расписание: ${schedule.length}`);

    // --- 7. Цены ---
    const prices = data.prices || [];
    await client.query('TRUNCATE prices RESTART IDENTITY CASCADE');
    for (const p of prices) {
      await client.query(
        `INSERT INTO prices (id, image)
         VALUES (${esc(p.id)}, ${esc(p.image)})`
      );
    }
    console.log(`✅ Цены: ${prices.length}`);

    // --- 8. Сотрудники ---
    const staff = data.staff || [];
    await client.query('TRUNCATE staff RESTART IDENTITY CASCADE');
    for (const s of staff) {
      await client.query(
        `INSERT INTO staff (id, name, image, role)
         VALUES (${esc(s.id)}, ${esc(s.name)}, ${esc(s.image)}, ${esc(s.role)})`
      );
    }
    console.log(`✅ Сотрудники: ${staff.length}`);

    // --- 9. Настройки (key-value) ---
    // Сохраняем глобальные настройки: globalDivider, designSettings, headerSettings, emailConfig и др.
    const settingsKeys = [
      'globalDivider', 'designSettings', 'headerSettings', 'emailConfig',
      'sliderSettings', 'sections', 'additionalContacts', 'siteSettings',
    ];
    for (const key of settingsKeys) {
      if (data[key] !== undefined) {
        await client.query(
          `INSERT INTO settings (key, value) VALUES ('${key}', ${escJson(data[key])})
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`
        );
      }
    }
    console.log(`✅ Настройки: ${settingsKeys.filter(k => data[k] !== undefined).length} ключей`);

    await client.query('COMMIT');
    console.log('\n🎉 Миграция завершена успешно!');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('❌ Ошибка миграции:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('❌ Ошибка:', err);
  process.exit(1);
});