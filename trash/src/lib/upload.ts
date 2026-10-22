import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

/**
 * Сохраняет файл в ./uploads/ с уникальным именем.
 * Возвращает URL для использования в БД (например: /uploads/abc123.jpg)
 * Фикс: файлы хранятся вне public/ — Next.js не видит файлы, записанные в public/ после сборки.
 */
export async function saveUploadedFile(file: File, dir?: string): Promise<string> {
  const uploadDir = path.join(process.cwd(), 'uploads', dir || '');
  await mkdir(uploadDir, { recursive: true });

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const ext = file.name.split('.').pop() || 'jpg';
  const filename = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${ext}`;
  const filepath = path.join(uploadDir, filename);

  await writeFile(filepath, buffer);

  return `/uploads/${dir ? dir + '/' : ''}${filename}`;
}
