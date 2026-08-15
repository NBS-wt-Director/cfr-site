#!/usr/bin/env node
/**
 * migrate-uploads.mjs
 * 
 * Переносит загруженные фото из public/uploads/ в uploads/
 * Пути в db.json уже правильные (/uploads/...) — менять ничего не надо.
 * 
 * Использование:
 *   node scripts/migrate-uploads.mjs
 */

import { readdir, copyFile, stat, access } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

const SOURCE = join(process.cwd(), 'public', 'uploads');
const DEST = join(process.cwd(), 'uploads');

async function run() {
  console.log('🔍 Migration: public/uploads/ → uploads/');
  console.log(`   Source: ${SOURCE}`);
  console.log(`   Dest:   ${DEST}`);

  // Проверяем источник
  if (!existsSync(SOURCE)) {
    console.log('⚠️  public/uploads/ не существует — ничего переносить.');
    return;
  }

  // Создаём целевую директорию
  try {
    await access(DEST);
  } catch {
    console.log('📁 Создаю директорию uploads/');
    const { mkdir } = await import('fs/promises');
    await mkdir(DEST, { recursive: true });
  }

  const files = await readdir(SOURCE);
  const imageExts = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'mp4', 'webm']);

  let copied = 0;
  let skipped = 0;
  let errors = 0;

  for (const file of files) {
    const ext = file.split('.').pop()?.toLowerCase() || '';
    if (!imageExts.has(ext)) {
      console.log(`  ⏭️  Пропущен (не медиа): ${file}`);
      skipped++;
      continue;
    }

    const src = join(SOURCE, file);
    const dst = join(DEST, file);

    try {
      const srcStat = await stat(src);
      if (srcStat.isFile()) {
        await copyFile(src, dst);
        copied++;
      }
    } catch (err) {
      console.log(`  ❌ Ошибка при копировании ${file}: ${err.message}`);
      errors++;
    }
  }

  console.log('');
  console.log(`✅ Скопировано: ${copied}`);
  console.log(`⏭️  Пропущено: ${skipped}`);
  console.log(`❌ Ошибок: ${errors}`);
  console.log('');
  console.log('Готово! Пути в db.json уже правильные (/uploads/...).');
  console.log('После деплоя файлы будут доступны по тем же URL.');
}

run().catch(err => {
  console.error('❌ Критическая ошибка:', err.message);
  process.exit(1);
});
