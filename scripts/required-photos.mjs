#!/usr/bin/env node
/**
 * scripts/required-photos.mjs
 *
 * Анализирует структуру папок static/data/ и определяет, какие фото
 * нужно загрузить для программ и тренеров.
 *
 * npm run required-photos
 *
 * Выводит:
 *   - Список программ/тренеров без фото
 *   - Список фото, которые есть на диске, но не в db.json
 *   - Сводку
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { flattenDb } from './db-format.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const dataDir = path.join(root, 'static', 'data');
const uploadsDir = path.join(root, 'static', 'uploads');
const dbPath = path.join(root, 'db.json');

function readDb() {
  try {
    // S4: плоский или вложенный — работаем с плоским
    return flattenDb(JSON.parse(fs.readFileSync(dbPath, 'utf-8')));
  } catch {
    return {};
  }
}

function normalizeName(name) {
  return name
    .trim()
    .replace(/\s+$/, '')
    .replace(/\s{2,}/g, ' ');
}

function findByName(list, name) {
  const normalized = normalizeName(name);
  return list.find(item => normalizeName(item.name) === normalized);
}

function getAllPhotos(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  
  const photos = [];
  const items = fs.readdirSync(dirPath);
  
  for (const item of items) {
    const fullPath = path.join(dirPath, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      photos.push(...getAllPhotos(fullPath));
    } else {
      const ext = path.extname(item).toLowerCase();
      if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
        photos.push({
          path: fullPath,
          name: item,
          relative: path.relative(dataDir, fullPath)
        });
      }
    }
  }
  
  return photos;
}

function main() {
  const db = readDb();
  if (!db.trainers || !db.programs) {
    console.error('❌ В db.json нет trainers или programs');
    process.exit(1);
  }

  console.log('='.repeat(80));
  console.log('📸 REQUIRED PHOTOS ANALYSIS');
  console.log('='.repeat(80));

  // 1. Программы без фото
  console.log('\n❌ ПРОГРАММЫ БЕЗ ФОТО:');
  const programsWithoutPhotos = [];
  
  for (const program of db.programs) {
    if (!program.image) {
      console.log(`  - ${program.name} (cat: ${program.category})`);
      programsWithoutPhotos.push(program);
    }
  }
  console.log(`  Итого: ${programsWithoutPhotos.length} программ`);

  // 2. Тренеры без фото
  console.log('\n❌ ТРЕНЕРЫ БЕЗ ФОТО:');
  const trainersWithoutPhotos = [];
  
  for (const trainer of db.trainers) {
    if (!trainer.image) {
      console.log(`  - ${trainer.name}`);
      trainersWithoutPhotos.push(trainer);
    }
  }
  console.log(`  Итого: ${trainersWithoutPhotos.length} тренеров`);

  // 3. Фото на диске, которые не используются
  console.log('\n📂 ФОТО НА ДИСКЕ (не в uploads/):');
  const trainersPhotos = getAllPhotos(path.join(dataDir, 'trainers'));
  const programsPhotos = getAllPhotos(path.join(dataDir, 'programs'));
  
  console.log(`  Тренеры: ${trainersPhotos.length} фото`);
  console.log(`  Программы: ${programsPhotos.length} фото`);
  console.log(`  Всего на диске: ${trainersPhotos.length + programsPhotos.length}`);

  // 4. Уже загруженные в uploads
  let uploadedCount = 0;
  if (fs.existsSync(uploadsDir)) {
    const uploadedFiles = fs.readdirSync(uploadsDir).filter(f => {
      const ext = path.extname(f).toLowerCase();
      return ['.jpg', '.jpeg', '.png', '.webp'].includes(ext);
    });
    uploadedCount = uploadedFiles.length;
    console.log(`\n✅ ЗАГРУЖЕНО В uploads/: ${uploadedCount} файлов`);
  }

  // 5. Сводка
  console.log('\n' + '='.repeat(80));
  console.log('📊 СВОДКА:');
  console.log('='.repeat(80));
  console.log(`  Видимых программ: ${db.programs.filter(p => !p.hidden).length}`);
  console.log(`    С фото: ${db.programs.filter(p => !p.hidden && p.image).length}`);
  console.log(`    Без фото: ${db.programs.filter(p => !p.hidden && !p.image).length}`);
  console.log(`  Видимых тренеров: ${db.trainers.filter(t => !t.hidden).length}`);
  console.log(`    С фото: ${db.trainers.filter(t => !t.hidden && t.image).length}`);
  console.log(`    Без фото: ${db.trainers.filter(t => !t.hidden && !t.image).length}`);
  console.log(`  Всего фото на диске: ${trainersPhotos.length + programsPhotos.length}`);
  console.log(`  Загружено: ${uploadedCount}`);
  console.log(`  Требуется загрузить: ${trainersPhotos.length + programsPhotos.length - uploadedCount}`);
  
  console.log('\n✅ Анализ завершён');
}

main();
