import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file || file.size === 0) {
      return NextResponse.json({ error: 'Нет файла' }, { status: 400 });
    }

    // Лимит размера файла — 10MB
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'Файл слишком большой (макс. 10MB)' }, { status: 413 });
    }

    // Разрешаем изображения и видео
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    
    if (!isImage && !isVideo) {
      return NextResponse.json({ error: 'Только изображения и видео' }, { status: 400 });
    }

    // Фикс: храним вне public/ — Next.js не отдаёт файлы, записанные в public/ после сборки
    const uploadDir = path.join(process.cwd(), 'uploads');
    await mkdir(uploadDir, { recursive: true });

    // Уникальное имя файла
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const ext = file.name.split('.').pop() || (isVideo ? 'mp4' : 'jpg');
    const filename = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${ext}`;
    const filepath = path.join(uploadDir, filename);

    // Сохраняем файл
    await writeFile(filepath, buffer);

    const fileUrl = `/uploads/${filename}`;
    
    return NextResponse.json({ success: true, url: fileUrl });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Ошибка загрузки' }, { status: 500 });
  }
}
