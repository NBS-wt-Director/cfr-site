import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import path from 'path';
import { authenticateAdmin } from '@/lib/auth';

/**
 * Сохраняет файл с уникальным именем в папку uploads/prices/
 * Возвращает URL загруженного файла
 */
async function saveFile(file: File, dir: string): Promise<string> {
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', dir);
  
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const ext = file.name.split('.').pop() || 'jpg';
  const filename = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${ext}`;
  const filepath = path.join(uploadDir, filename);
  
  await writeFile(filepath, buffer);
  
  return `/uploads/${dir}/${filename}`;
}

export async function POST(request: NextRequest) {
  const auth = authenticateAdmin(request);
  if (auth !== true) return auth;
  try {
    const formData = await request.formData();
    const priceFiles = formData.getAll('priceFiles') as File[];
    
    if (priceFiles.length === 0) {
      return NextResponse.json({ error: 'Нет файлов' }, { status: 400 });
    }

    // Сохраняем первый файл как prices1
    const url = await saveFile(priceFiles[0], 'prices');

    return NextResponse.json({ 
      success: true, 
      files: [url] 
    });
  } catch (error) {
    console.error('Ошибка сохранения цен:', error);
    return NextResponse.json({ error: 'Ошибка сохранения цен' }, { status: 500 });
  }
}
