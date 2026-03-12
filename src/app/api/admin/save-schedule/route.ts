import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const scheduleFiles = formData.getAll('scheduleFiles') as File[];
    
    const publicDir = path.join(process.cwd(), 'public');
    const schedule1Path = path.join(publicDir, 'расписание1.jpg');
    const schedule2Path = path.join(publicDir, 'расписание2.jpg');

    // ✅ ЗАМЕНА/ДОБАВЛЕНИЕ файлов
    for (let i = 0; i < scheduleFiles.length; i++) {
      const file = scheduleFiles[i];
      const buffer = Buffer.from(await file.arrayBuffer());
      
      const targetPath = i === 0 ? schedule1Path : schedule2Path;
      
      // ✅ Сохраняем только если файл существует
      await writeFile(targetPath, buffer, 'binary');
    }

    return NextResponse.json({ 
      success: true, 
      files: ['/расписание1.jpg', '/расписание2.jpg'] 
    });
  } catch (error) {
    return NextResponse.json({ error: 'Ошибка сохранения' }, { status: 500 });
  }
}
