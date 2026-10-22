/**
 * Скрипт миграции: переименование изображений программ
 * 
 * Старый формат: /uploads/[name]_[index]_[timestamp].[ext]
 * Новый формат: 
 *   - Главное фото: /uploads/p-[id_prog]-m.[ext]
 *   - Галерея: /uploads/p-[id_prog]-a-[номер].[ext]
 * 
 * Запуск: npx tsx scripts/migrate-program-images.ts
 */

import { readFile, writeFile, rename, readdir, stat } from 'fs/promises';
import { join, basename, extname } from 'path';
import { existsSync } from 'fs';

const DB_PATH = join(process.cwd(), 'db.json');
const UPLOADS_DIR = join(process.cwd(), 'public', 'uploads');

// Шаблон для определения старых имён файлов программ
// Примеры: Крепыши__2_4_года__0_1772570676077.jpg, Борьба_0_1772570685330.jpg
const OLD_NAME_PATTERN = /^([^\d_]*)_?(\d+)?_(\d+)\.(jpg|jpeg|png|gif|webp)$/i;

interface Program {
  id: number;
  image: string;
  name: string;
  photoAlbum: Array<{ image: string; caption: string }>;
}

interface DbData {
  programs: Program[];
}

async function main() {
  console.log('🟢 Начинаем миграцию изображений программ...\n');

  // Читаем БД
  console.log('📖 Читаем базу данных...');
  const dbContent = await readFile(DB_PATH, 'utf-8');
  const dbData: DbData = JSON.parse(dbContent);
  const programs = dbData.programs || [];
  
  console.log(`   Найдено программ: ${programs.length}\n`);

  // Собираем все файлы в папке uploads
  console.log('📂 Сканируем папку uploads...');
  let files: string[] = [];
  try {
    files = await readdir(UPLOADS_DIR);
  } catch (e) {
    console.error('❌ Ошибка чтения папки uploads:', e);
    process.exit(1);
  }
  
  console.log(`   Найдено файлов: ${files.length}\n`);

  // Создаём маппинг старых путей к новым
  const pathUpdates: Map<string, string> = new Map();
  let renamedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const program of programs) {
    const programId = program.id;
    console.log(`📋 Обрабатываем программу: ${program.name} (ID: ${programId})`);

    // Обрабатываем главное изображение
    if (program.image && program.image.startsWith('/uploads/')) {
      const oldPath = program.image;
      const fileName = oldPath.replace('/uploads/', '');
      const ext = extname(fileName).toLowerCase().replace('.', '') || 'jpg';
      
      // Проверяем, существует ли файл
      const oldFullPath = join(UPLOADS_DIR, fileName);
      
      if (existsSync(oldFullPath)) {
        const newFileName = `p-${programId}-m.${ext}`;
        const newPath = `/uploads/${newFileName}`;
        
        // Если путь уже новый - пропускаем
        if (oldPath !== newPath) {
          try {
            const newFullPath = join(UPLOADS_DIR, newFileName);
            
            // Если новый файл уже существует - удаляем старый
            if (existsSync(newFullPath)) {
              console.log(`   ⚠️ Файл ${newFileName} уже существует, удаляем старый ${fileName}`);
              pathUpdates.set(oldPath, newPath);
            } else {
              // Переименовываем файл
              await rename(oldFullPath, newFullPath);
              console.log(`   ✅ ${fileName} -> ${newFileName}`);
              pathUpdates.set(oldPath, newPath);
              renamedCount++;
            }
          } catch (e: any) {
            console.log(`   ❌ Ошибка переименования ${fileName}: ${e.message}`);
            errorCount++;
          }
        } else {
          console.log(`   ⏭️ Главное изображение уже в новом формате`);
          skippedCount++;
        }
      } else {
        console.log(`   ⚠️ Файл не найден: ${fileName}`);
      }
    }

    // Обрабатываем галерею
    if (program.photoAlbum && program.photoAlbum.length > 0) {
      for (let i = 0; i < program.photoAlbum.length; i++) {
        const photo = program.photoAlbum[i];
        if (photo.image && photo.image.startsWith('/uploads/')) {
          const oldPath = photo.image;
          const fileName = oldPath.replace('/uploads/', '');
          const ext = extname(fileName).toLowerCase().replace('.', '') || 'jpg';
          
          const oldFullPath = join(UPLOADS_DIR, fileName);
          
          if (existsSync(oldFullPath)) {
            const newFileName = `p-${programId}-a-${i}.${ext}`;
            const newPath = `/uploads/${newFileName}`;
            
            if (oldPath !== newPath) {
              try {
                const newFullPath = join(UPLOADS_DIR, newFileName);
                
                if (existsSync(newFullPath)) {
                  console.log(`   ⚠️ Файл ${newFileName} уже существует, удаляем старый ${fileName}`);
                  pathUpdates.set(oldPath, newPath);
                } else {
                  await rename(oldFullPath, newFullPath);
                  console.log(`   ✅ ${fileName} -> ${newFileName}`);
                  pathUpdates.set(oldPath, newPath);
                  renamedCount++;
                }
              } catch (e: any) {
                console.log(`   ❌ Ошибка переименования ${fileName}: ${e.message}`);
                errorCount++;
              }
            } else {
              skippedCount++;
            }
          } else {
            console.log(`   ⚠️ Файл не найден: ${fileName}`);
          }
        }
      }
    }
    
    console.log('');
  }

  // Обновляем пути в БД
  if (pathUpdates.size > 0) {
    console.log('💾 Обновляем пути в базе данных...');
    
    for (const program of programs) {
      // Главное изображение
      if (program.image && pathUpdates.has(program.image)) {
        program.image = pathUpdates.get(program.image)!;
      }
      
      // Галерея
      if (program.photoAlbum) {
        for (const photo of program.photoAlbum) {
          if (photo.image && pathUpdates.has(photo.image)) {
            photo.image = pathUpdates.get(photo.image)!;
          }
        }
      }
    }

    // Сохраняем обновлённую БД
    await writeFile(DB_PATH, JSON.stringify(dbData, null, 2), 'utf-8');
    console.log('✅ База данных обновлена\n');
  } else {
    console.log('⏭️ Нет файлов для переименования\n');
  }

  // Итоги
  console.log('='.repeat(50));
  console.log('📊 ИТОГИ МИГРАЦИИ:');
  console.log(`   Переименовано: ${renamedCount}`);
  console.log(`   Пропущено (уже новый формат): ${skippedCount}`);
  console.log(`   Ошибок: ${errorCount}`);
  console.log('='.repeat(50));

  if (errorCount > 0) {
    console.log('\n⚠️ Внимание: были ошибки при переименовании. Проверьте лог.');
    process.exit(1);
  }
}

main().catch(console.error);
