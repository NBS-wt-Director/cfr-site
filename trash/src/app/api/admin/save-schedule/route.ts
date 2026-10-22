import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import path from 'path';
import { authenticateAdmin } from '@/lib/auth';

/**
 * Сохраняет файл с уникальным именем в папку uploads/schedule/
 * Возвращает массив URL загруженных файлов
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
    const scheduleFiles = formData.getAll('scheduleFiles') as File[];
    
    if (scheduleFiles.length === 0) {
      return NextResponse.json({ error: 'Нет файлов' }, { status: 400 });
    }

    const urls: string[] = [];
    
    for (let i = 0; i < scheduleFiles.length; i++) {
      const url = await saveFile(scheduleFiles[i], 'schedule');
      urls.push(url);
    }

    return NextResponse.json({ 
      success: true, 
      files: urls 
    });
  } catch (error) {
    console.error('Ошибка сохранения расписания:', error);
    return NextResponse.json({ error: 'Ошибка сохранения' }, { status: 500 });
  }
}
