import { NextRequest, NextResponse } from 'next/server';
import { readdir, stat, readFile } from 'fs/promises';
import { join } from 'path';

// Получить все файлы в папке рекурсивно
async function getAllFiles(dirPath: string, baseDir: string = ''): Promise<{ path: string; size: number; relativePath: string }[]> {
  const files: { path: string; size: number; relativePath: string }[] = [];
  
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);
      const relativePath = baseDir ? `${baseDir}/${entry.name}` : entry.name;
      
      if (entry.isDirectory()) {
        const subFiles = await getAllFiles(fullPath, relativePath);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        const fileStat = await stat(fullPath);
        files.push({
          path: fullPath,
          size: fileStat.size,
          relativePath
        });
      }
    }
  } catch (error) {
    console.error('Error reading directory:', error);
  }
  
  return files;
}

// Найти все ссылки на файлы в БД
async function findFileReferences(): Promise<Set<string>> {
  const references = new Set<string>();
  const dbPath = join(process.cwd(), 'db.json');
  
  try {
    const content = await readFile(dbPath, 'utf-8');
    const db = JSON.parse(content);
    
    // Собираем все ссылки на файлы из БД
    const collectRefs = (obj: any) => {
      if (!obj) return;
      
      if (typeof obj === 'string') {
        // Проверяем, содержит ли строка путь к файлу
        if (obj.includes('/uploads/') || obj.includes('uploads\\')) {
          // Извлекаем относительный путь
          const match = obj.match(/uploads\/([^\s'"]+)/i) || obj.match(/uploads\\([^\\s'"]+)/i);
          if (match) {
            references.add(match[1]);
          }
        }
      } else if (Array.isArray(obj)) {
        obj.forEach(collectRefs);
      } else if (typeof obj === 'object') {
        Object.values(obj).forEach(collectRefs);
      }
    };
    
    collectRefs(db);
  } catch (error) {
    console.error('Error reading DB:', error);
  }
  
  return references;
}

// Функция для оценки размера объекта в памяти
function getObjectSize(obj: any): number {
  const str = JSON.stringify(obj);
  return new Blob([str]).size;
}

export async function GET() {
  try {
    const uploadsDir = join(process.cwd(), 'public', 'uploads');
    
    // 1. Получаем все файлы в uploads
    const files = await getAllFiles(uploadsDir);
    
    // 2. Получаем ссылки на файлы из БД
    const references = await findFileReferences();
    
    // 3. Разделяем на используемые и мусор
    const usedFiles: { path: string; size: number; relativePath: string }[] = [];
    const garbageFiles: { path: string; size: number; relativePath: string }[] = [];
    
    for (const file of files) {
      // Проверяем, есть ли ссылка на этот файл в БД
      const fileName = file.relativePath;
      const isUsed = [...references].some(ref => 
        fileName.includes(ref) || ref.includes(fileName)
      );
      
      if (isUsed) {
        usedFiles.push(file);
      } else {
        garbageFiles.push(file);
      }
    }
    
    // 4. Вычисляем объёмы
    const usedSize = usedFiles.reduce((sum, f) => sum + f.size, 0);
    const garbageSize = garbageFiles.reduce((sum, f) => sum + f.size, 0);
    const totalSize = usedSize + garbageSize;
    
    // 5. Размер БД
    const dbPath = join(process.cwd(), 'db.json');
    let dbSize = 0;
    try {
      const dbStat = await stat(dbPath);
      dbSize = dbStat.size;
    } catch {}
    
    // 6. Примерный размер всего сайта (без node_modules и .next)
    const publicDir = join(process.cwd(), 'public');
    const srcDir = join(process.cwd(), 'src');
    
    const publicFiles = await getAllFiles(publicDir);
    const srcFiles = await getAllFiles(srcDir);
    
    const publicSize = publicFiles.reduce((sum, f) => sum + f.size, 0);
    const srcSize = srcFiles.reduce((sum, f) => sum + f.size, 0);
    const totalSiteSize = publicSize + srcSize + dbSize;
    
    // 7. Оценка размера в памяти (приблизительно - размер JSON сериализованных данных)
    let memoryUsage = 0;
    try {
      const dbContent = await readFile(dbPath, 'utf-8');
      const db = JSON.parse(dbContent);
      memoryUsage = getObjectSize(db);
    } catch {}
    
    return NextResponse.json({
      uploads: {
        totalFiles: files.length,
        totalSize,
        usedFiles: usedFiles.length,
        usedSize,
        garbageFiles: garbageFiles.length,
        garbageSize
      },
      site: {
        totalSize: totalSiteSize,
        publicSize,
        srcSize,
        dbSize,
        memoryUsage
      }
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const uploadsDir = join(process.cwd(), 'public', 'uploads');
    
    // Получаем ссылки на файлы из БД
    const references = await findFileReferences();
    
    // Получаем все файлы
    const files = await getAllFiles(uploadsDir);
    
    // Находим мусор
    const garbageFiles: string[] = [];
    
    for (const file of files) {
      const fileName = file.relativePath;
      const isUsed = [...references].some(ref => 
        fileName.includes(ref) || ref.includes(fileName)
      );
      
      if (!isUsed) {
        garbageFiles.push(file.path);
      }
    }
    
    // Удаляем мусор
    const { unlink } = await import('fs/promises');
    let deletedCount = 0;
    let deletedSize = 0;
    
    for (const filePath of garbageFiles) {
      try {
        const fileStat = await stat(filePath);
        await unlink(filePath);
        deletedCount++;
        deletedSize += fileStat.size;
      } catch (error) {
        console.error('Error deleting file:', filePath, error);
      }
    }
    
    return NextResponse.json({
      success: true,
      deletedCount,
      deletedSize,
      message: `Удалено ${deletedCount} файлов (${formatSize(deletedSize)})`
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} ГБ`;
}
