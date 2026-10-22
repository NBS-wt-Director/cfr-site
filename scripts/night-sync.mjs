#!/usr/bin/env node
/**
 * scripts/night-sync.mjs
 *
 * Ночной синхронизатор: проверяет static/data/ на новые файлы,
 * запускает загрузку недостающих, парсит DOCX, заполняет фото.
 *
 * npm run night-sync
 *
 * Лог: static/data/.night-sync.log
 *
 * Запускается:
 *   - Вручную: node scripts/night-sync.mjs
 *   - По cron: pm2 cron scripts/night-sync.mjs "0 3 * * *" (каждый день в 3:00)
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const dataDir = path.join(root, 'static', 'data');
const dbPath = path.join(root, 'db.json');
const logFile = path.join(dataDir, '.night-sync.log');
const progressFile = path.join(dataDir, '.download-progress.json');

// ============================================
// Логирование
// ============================================

function log(message) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${message}`;
  console.log(line);
  fs.appendFileSync(logFile, line + '\n');
}

function backupDB() {
  if (!fs.existsSync(dbPath)) return;
  const timestamp = Date.now();
  const backupPath = path.join(root, 'backups', `db.json.backup.${timestamp}`);
  const backupsDir = path.dirname(backupPath);
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }
  fs.copyFileSync(dbPath, backupPath);
  log(`💾 Бэкап: ${backupPath}`);
}

function readDb() {
  try {
    return JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
  } catch {
    return {};
  }
}

function writeDb(db) {
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf-8');
}

// ============================================
// Сканирование новых файлов
// ============================================

function scanDirectory(dirPath) {
  const files = [];
  const dirs = fs.readdirSync(dirPath).filter(f => {
    const stat = fs.statSync(path.join(dirPath, f));
    return stat.isDirectory();
  });

  for (const dir of dirs) {
    const fullPath = path.join(dirPath, dir);
    if (fs.statSync(fullPath).isDirectory()) {
      files.push(...scanDirectory(fullPath));
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

function getKnownFiles() {
  if (!fs.existsSync(progressFile)) return new Set();
  try {
    const progress = JSON.parse(fs.readFileSync(progressFile, 'utf-8'));
    return new Set(Object.keys(progress));
  } catch {
    return new Set();
  }
}

function findNewFiles(baseDir, knownFiles) {
  const allFiles = scanDirectory(baseDir);
  const newFiles = [];

  for (const filePath of allFiles) {
    // Нормализуем путь относительно dataDir
    const relative = path.relative(dataDir, filePath);
    if (!knownFiles.has(relative)) {
      newFiles.push({
        fullPath: filePath,
        relative: relative,
        name: path.basename(filePath)
      });
    }
  }

  return newFiles;
}

// ============================================
// Загрузка недостающих файлов
// ============================================

function downloadMissingFiles(newFiles) {
  const newFolders = new Set();
  for (const file of newFiles) {
    const folder = path.dirname(file.relative);
    newFolders.add(folder);
  }

  if (newFolders.size === 0) {
    log('  ✅ Нет новых папок для загрузки');
    return 0;
  }

  log(`  📥 Скачивание ${newFolders.size} папок...`);
  
  try {
    // Запускаем yandex-download.py
    const yandexScript = path.join(root, 'scripts', 'yandex-download.py');
    if (fs.existsSync(yandexScript)) {
      execSync(`python3 "${yandexScript}"`, {
        cwd: root,
        stdio: 'inherit',
        timeout: 3600000 // 1 час
      });
      log('  ✅ Загрузка завершена');
      return newFolders.size;
    } else {
      log('  ⚠️  Скрипт yandex-download.py не найден');
      return 0;
    }
  } catch (err) {
    log(`  ⚠️  Ошибка загрузки: ${err.message}`);
    return 0;
  }
}

// ============================================
// Парсинг новых DOCX
// ============================================

async function parseNewDocx(newFiles) {
  const docxFiles = newFiles.filter(f => f.name.endsWith('.docx'));
  if (docxFiles.length === 0) {
    log('  ✅ Нет новых DOCX');
    return 0;
  }

  log(`  📄 Парсинг ${docxFiles.length} новых DOCX...`);
  
  try {
    // Запускаем parse-docs.mjs
    const parseScript = path.join(root, 'scripts', 'parse-docs.mjs');
    if (fs.existsSync(parseScript)) {
      execSync(`node "${parseScript}"`, {
        cwd: root,
        stdio: 'inherit',
        timeout: 600000 // 10 минут
      });
      log('  ✅ Парсинг DOCX завершён');
      return docxFiles.length;
    } else {
      log('  ⚠️  Скрипт parse-docs.mjs не найден');
      return 0;
    }
  } catch (err) {
    log(`  ⚠️  Ошибка парсинга: ${err.message}`);
    return 0;
  }
}

// ============================================
// Заполнение фото
// ============================================

function fillPhotos() {
  const db = readDb();
  if (!db.trainers || !db.programs) return 0;

  log('  📸 Заполнение фото...');
  let updated = 0;

  // Заполняем тренеров
  for (const trainer of db.trainers) {
    if (trainer.image) continue; // уже есть обложка

    const trainerDir = path.join(dataDir, 'trainers', trainer.name);
    if (!fs.existsSync(trainerDir)) continue;

    // Ищем фото
    const files = fs.readdirSync(trainerDir).filter(f => {
      const ext = path.extname(f).toLowerCase();
      return ['.jpg', '.jpeg', '.png', '.webp'].includes(ext);
    }).sort();

    if (files.length > 0) {
      trainer.image = `uploads/${files[0]}`;
      updated++;
      log(`    ✅ ${trainer.name}: ${files[0]}`);
    }
  }

  // Заполняем программы
  for (const program of db.programs) {
    if (program.image) continue;

    // Ищем в static/data/programs/<CAT>/<NAME>/
    const programsDir = path.join(dataDir, 'programs');
    const categories = fs.readdirSync(programsDir).filter(f => {
      const stat = fs.statSync(path.join(programsDir, f));
      return stat.isDirectory();
    });

    for (const cat of categories) {
      const catDir = path.join(programsDir, cat);
      const programFolders = fs.readdirSync(catDir).filter(f => {
        const stat = fs.statSync(path.join(catDir, f));
        return stat.isDirectory();
      });

      for (const folder of programFolders) {
        if (path.basename(folder).toLowerCase() === path.basename(program.name).toLowerCase()) {
          const folderPath = path.join(catDir, folder);
          const files = fs.readdirSync(folderPath).filter(f => {
            const ext = path.extname(f).toLowerCase();
            return ['.jpg', '.jpeg', '.png', '.webp'].includes(ext);
          }).sort();

          if (files.length > 0) {
            program.image = `uploads/${files[0]}`;
            updated++;
            log(`    ✅ ${program.name}: ${files[0]}`);
          }
          break;
        }
      }
      if (program.image) break;
    }
  }

  return updated;
}

// ============================================
// Основная логика
// ============================================

async function main() {
  log('='.repeat(70));
  log('🌙 NIGHT SYNC START');
  log('='.repeat(70));

  const startTime = Date.now();

  // 1. Сканируем новые файлы
  log('\n📂 Шаг 1: Сканирование новых файлов...');
  const knownFiles = getKnownFiles();
  const trainersNew = findNewFiles(path.join(dataDir, 'trainers'), knownFiles);
  const programsNew = findNewFiles(path.join(dataDir, 'programs'), knownFiles);
  const allNew = [...trainersNew, ...programsNew];

  log(`  📁 Всего новых файлов: ${allNew.length}`);
  log(`    Тренеры: ${trainersNew.length}`);
  log(`    Программы: ${programsNew.length}`);

  // 2. Загружаем недостающие
  if (allNew.length > 0) {
    log('\n📥 Шаг 2: Загрузка недостающих файлов...');
    await downloadMissingFiles(allNew);
  } else {
    log('\n✅ Шаг 2: Пропущен (нет новых папок)');
  }

  // 3. Парсим новые DOCX
  log('\n📄 Шаг 3: Парсинг новых DOCX...');
  await parseNewDocx(allNew);

  // 4. Заполняем фото
  log('\n📸 Шаг 4: Заполнение фото...');
  const photosUpdated = fillPhotos();
  log(`  ✅ Обновлено: ${photosUpdated}`);

  // 5. Сохраняем
  log('\n💾 Шаг 5: Сохранение db.json...');
  backupDB();
  writeDb(readDb());
  log('  ✅ Сохранено');

  // 6. Перегенерация статики
  log('\n🔄 Шаг 6: Перегенерация статики...');
  try {
    execSync('npm run static:export', {
      cwd: root,
      stdio: 'inherit',
      timeout: 300000 // 5 минут
    });
    log('  ✅ Статика перегенерирована');
  } catch (err) {
    log(`  ⚠️  Ошибка перегенерации: ${err.message}`);
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  log('\n' + '='.repeat(70));
  log(`✅ NIGHT SYNC COMPLETE (${duration} сек)`);
  log('='.repeat(70));
}

main().catch(err => {
  log(`❌ Ошибка: ${err.message}`);
  process.exit(1);
});
