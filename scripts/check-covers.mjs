#!/usr/bin/env node
/**
 * scripts/check-covers.mjs
 *
 * Проверка обложек программ и тренеров: размер, соотношение сторон.
 *
 * - Если обложка маленькая (<400px по длинной стороне) или не квадратная (w ≠ h)
 *   — пытается заменить на другое фото из той же папки.
 * - Если подходящих фото нет — добавляет в список для email-уведомления.
 *
 * Запуск:
 *   npm run check-covers            — проверка + замена
 *   npm run check-covers -- --no-email  — без email (только отчёт)
 *
 * Идемпотентен, бэкапит db.json.
 *
 * Подходит для запуска ПОСЛЕ parse-docs.mjs (отдельным шагом).
 */

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import nodemailer from 'nodemailer';
import { fileURLToPath } from 'url';
import { flattenDb, nestDb } from './db-format.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const dataDir = path.join(root, 'static', 'data');
const dbPath = path.join(root, 'db.json');
const coversDir = path.join(root, 'static', 'uploads', 'covers');
const SEND_EMAIL = !process.argv.includes('--no-email');

const MIN_DIM = 400;    // минимальная длинная сторона обложки
const MIN_COVER_DIM = 300; // ещё мягче для тренеров
const IMG_RE = /\.(jpe?g|png|webp)$/i;

// ============================================
// Утилиты
// ============================================

function log(msg) {
  const ts = new Date().toISOString().slice(0, 19);
  console.log(`[${ts}] ${msg}`);
  try {
    fs.appendFileSync(path.join(dataDir, '.check-covers.log'), `[${ts}] ${msg}\n`);
  } catch {}
}

function backupDB() {
  const dir = path.join(root, 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const dst = path.join(dir, `db.json.backup.${Date.now()}`);
  fs.copyFileSync(dbPath, dst);
  log(`💾 Бэкап: ${dst}`);
}

function readDb() {
  try {
    // S4: плоский или вложенный — обработчики работают с плоским
    return flattenDb(JSON.parse(fs.readFileSync(dbPath, 'utf-8')));
  } catch {
    return {};
  }
}

function writeDb(db) {
  // S4: всегда пишем вложенный формат (data.*/settings.*)
  fs.writeFileSync(dbPath, JSON.stringify(nestDb(db), null, 2), 'utf-8');
}

// Получить размеры изображения через ImageMagick
function getImageSize(filePath) {
  try {
    const out = execFileSync('identify', ['-format', '%w %h', filePath], { stdio: 'pipe', encoding: 'utf-8' });
    const parts = out.trim().split(/\s+/);
    return { w: parseInt(parts[0], 10), h: parseInt(parts[1], 10) };
  } catch {
    return null;
  }
}

// ============================================
// Проверка обложки
// ============================================

function isSuitable(w, h, kind) {
  // Квадратная?
  if (Math.abs(w - h) > Math.max(w, h) * 0.05) {
    // Не квадратная (разница >5%)
    return { suitable: false, reason: `не квадратная (${w}×${h})` };
  }
  // Слишком маленькая?
  const maxDim = Math.max(w, h);
  if (maxDim < MIN_DIM) {
    return { suitable: false, reason: `маленькая (${w}×${h})` };
  }
  return { suitable: true };
}

// ============================================
// Поиск лучшего фото в папке
// ============================================

function findBetterCover(folderPath) {
  if (!fs.existsSync(folderPath)) return null;

  const files = fs.readdirSync(folderPath).filter(f => IMG_RE.test(f));
  let best = null;
  let bestScore = -1;

  for (const file of files) {
    const filePath = path.join(folderPath, file);
    const size = getImageSize(filePath);
    if (!size) continue;

    const { w, h } = size;
    const maxDim = Math.max(w, h);

    // Квадратная?
    if (Math.abs(w - h) > Math.max(w, h) * 0.05) continue;
    // Довольно большая?
    if (maxDim < MIN_COVER_DIM) continue;

    // Оценка: больше = лучше
    const score = maxDim;
    if (score > bestScore) {
      bestScore = score;
      best = { file, w, h };
    }
  }

  return best;
}

// Создать обложку через ImageMagick (квадрат, ≤1600px, q82)
function makeCover(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  try {
    execFileSync('convert', [
      src,
      '-auto-orient',
      '-resize', '1600x1600>',
      '-background', 'white',
      '-gravity', 'center',
      '-extent', '1600x1600',
      '-quality', '82',
      dest
    ], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

// ============================================
// Основная логика
// ============================================

function processList(list, baseDir, kind) {
  const badCovers = [];
  let replaced = 0;
  let skipped = 0;
  let noBetter = 0;

  for (const entity of list) {
    if (entity.hidden) continue;
    if (!entity.image) {
      // Нет обложки вообще — это отдельная проблема (обрабатывается в parse-docs)
      continue;
    }

    // Определяем папку с исходными фото
    let folderPath = null;
    if (kind === 'trainer') {
      folderPath = path.join(dataDir, 'trainers', entity.name);
    } else {
      // Программа: ищем в static/data/programs/<CAT>/<Имя>/
      const programsDir = path.join(dataDir, 'programs');
      if (fs.existsSync(programsDir)) {
        const categories = fs.readdirSync(programsDir).filter(f => {
          const fp = path.join(programsDir, f);
          return fs.statSync(fp).isDirectory();
        });
        for (const cat of categories) {
          const catDir = path.join(programsDir, cat);
          const folders = fs.readdirSync(catDir).filter(f => {
            const fp = path.join(catDir, f);
            return fs.statSync(fp).isDirectory();
          });
          for (const folder of folders) {
            const normFolder = folder.replace(/^в расписании нет\s+/i, '').trim();
            if (normFolder.toLowerCase().includes(entity.name.toLowerCase()) ||
                entity.name.toLowerCase().includes(normFolder.toLowerCase())) {
              folderPath = path.join(catDir, folder);
              break;
            }
          }
          if (folderPath) break;
        }
      }
    }

    // Проверяем текущую обложку
    let coverFilePath = null;
    // Проверяем в uploads/covers/
    if (entity.image.startsWith('/uploads/covers/') || entity.image.startsWith('uploads/covers/')) {
      coverFilePath = path.join(root, entity.image.startsWith('/') ? entity.image.slice(1) : entity.image);
    } else if (entity.image.startsWith('/uploads/') || entity.image.startsWith('uploads/')) {
      coverFilePath = path.join(root, entity.image.startsWith('/') ? entity.image.slice(1) : entity.image);
    }

    if (!coverFilePath || !fs.existsSync(coverFilePath)) {
      skipped++;
      continue;
    }

    const size = getImageSize(coverFilePath);
    if (!size) {
      badCovers.push({
        type: kind === 'trainer' ? 'тренер' : 'программа',
        name: entity.name,
        coverFile: path.basename(coverFilePath),
        reason: 'не удалось получить размер файла'
      });
      continue;
    }

    const check = isSuitable(size.w, size.h, kind);
    if (check.suitable) {
      skipped++;
      continue;
    }

    log(`  ⚠️ ${entity.name}: обложка ${path.basename(coverFilePath)} (${size.w}×${size.h}) — ${check.reason}`);

    // Пытаемся найти лучшее фото в папке
    if (!folderPath) {
      badCovers.push({
        type: kind === 'trainer' ? 'тренер' : 'программа',
        name: entity.name,
        coverFile: path.basename(coverFilePath),
        reason: check.reason + ' (нет папки с фото на диске)'
      });
      noBetter++;
      continue;
    }

    const better = findBetterCover(folderPath);
    if (!better) {
      badCovers.push({
        type: kind === 'trainer' ? 'тренер' : 'программа',
        name: entity.name,
        coverFile: path.basename(coverFilePath),
        reason: check.reason + ' (нет подходящих фото в папке)'
      });
      noBetter++;
      continue;
    }

    // Заменяем обложку
    const newCoverSrc = path.join(folderPath, better.file);
    const slug = entity.name.toLowerCase().replace(/[^a-zа-яё0-9]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'cover';
    const destName = `${kind}-${slug}.jpg`;
    const dest = path.join(coversDir, destName);

    if (makeCover(newCoverSrc, dest)) {
      entity.image = `/uploads/covers/${destName}`;
      replaced++;
      log(`  ✅ ${entity.name}: заменена на ${better.file} (${better.w}×${better.h})`);
    } else {
      badCovers.push({
        type: kind === 'trainer' ? 'тренер' : 'программа',
        name: entity.name,
        coverFile: path.basename(coverFilePath),
        reason: check.reason + ` (ошибка создания обложки из ${better.file})`
      });
    }
  }

  return { badCovers, replaced, skipped, noBetter };
}

// ============================================
// Email-уведомления
// ============================================

async function sendCoverEmail(badCovers, db) {
  if (!badCovers.length) {
    log('  📧 Нет проблем с обложками — email не отправляем');
    return;
  }

  if (!SEND_EMAIL) {
    log('  📧 --no-email: email не отправляем');
    return;
  }

  const emailConfig = db.emailConfig || {};
  const smtpHost = emailConfig.smtpHost || 'smtp.yandex.ru';
  const smtpPort = emailConfig.smtpPort || 465;
  const smtpSecure = emailConfig.smtpSecure !== false;
  const smtpUser = emailConfig.smtpUser;
  const smtpPass = emailConfig.smtpPass;
  const fromName = emailConfig.fromName || 'Робот-Автопарсер';
  const adminEmail = emailConfig.adminEmail;
  const errorEmail = emailConfig.errorEmail || [];

  if (!smtpUser || !smtpPass || !adminEmail) {
    log('  ⚠️ SMTP-настройки неполные — выводим список в консоль');
    console.log('\n=== ПРОБЛЕМНЫЕ ОБЛОЖКИ ===');
    for (const b of badCovers) {
      console.log(`- ${b.type}: "${b.name}" — обложка "${b.coverFile}" (${b.reason})`);
    }
    console.log('===========================\n');
    return;
  }

  let body = 'Уважаемые Коллеги!\nПросьба заменить обложки:\n';
  for (const b of badCovers) {
    body += `- ${b.type === 'тренер' ? 'Тренер' : 'Программа'} "${b.name}" — обложка "${b.coverFile}" (${b.reason})\n`;
  }
  body += '\nС Уважением, Ваш Робот-Автопарсер центр-фр.рф.';

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: { user: smtpUser, pass: smtpPass }
  });

  const recipients = [adminEmail, ...errorEmail].filter(Boolean);

  try {
    await transporter.sendMail({
      from: `"${fromName}" <${smtpUser}>`,
      to: recipients.join(', '),
      subject: 'Автоматическое заполнение сайта - уведомления по обложкам',
      text: body
    });
    log(`  📧 Email отправлен: ${recipients.join(', ')}, проблемных обложек: ${badCovers.length}`);
  } catch (err) {
    log(`  ⚠️ Ошибка отправки email: ${err.message}`);
    console.log('\n=== ПРОБЛЕМНЫЕ ОБЛОЖКИ (email не отправлен) ===');
    for (const b of badCovers) {
      console.log(`- ${b.type}: "${b.name}" — обложка "${b.coverFile}" (${b.reason})`);
    }
    console.log('================================================\n');
  }
}

// ============================================
// main
// ============================================

async function main() {
  log('='.repeat(60));
  log(`🖼 Проверка обложек ${SEND_EMAIL ? '' : '(--no-email)'}`);
  log('='.repeat(60));

  const db = readDb();
  if (!db.trainers || !db.programs) {
    console.error('❌ В db.json нет trainers или programs');
    process.exit(1);
  }

  // 1. Проверяем тренеров
  log('\n📋 Шаг 1: Проверка тренеров...');
  const trainerResult = processList(db.trainers, null, 'trainer');

  // 2. Проверяем программы
  log('\n📋 Шаг 2: Проверка программ...');
  const programResult = processList(db.programs, null, 'program');

  // 3. Объединяем проблемы
  const allBad = [...trainerResult.badCovers, ...programResult.badCovers];

  // 4. Сохранение db.json (если были замены)
  if (trainerResult.replaced > 0 || programResult.replaced > 0) {
    log('\n📋 Шаг 3: Сохранение db.json...');
    backupDB();
    writeDb(db);
    log('  ✅ Сохранено');
  } else {
    log('\n✅ Обложек не заменено');
  }

  // 5. Email
  if (allBad.length > 0) {
    log('\n📋 Шаг 4: Email-уведомление...');
    await sendCoverEmail(allBad, db);
  }

  // 6. Итог
  log('\n' + '='.repeat(60));
  log(`📊 ИТОГО:`);
  log(`  Тренеры: проверено ${db.trainers.filter(t => !t.hidden && t.image).length}, заменено ${trainerResult.replaced}, пропущено ${trainerResult.skipped}, без замены ${trainerResult.noBetter}`);
  log(`  Программы: проверено ${db.programs.filter(p => !p.hidden && p.image).length}, заменено ${programResult.replaced}, пропущено ${programResult.skipped}, без замены ${programResult.noBetter}`);
  log(`  Проблемных обложек (осталось): ${allBad.length}`);
  log('='.repeat(60));
}

main().catch(err => {
  log(`❌ Ошибка: ${err.message}`);
  console.error(err);
  process.exit(1);
});
