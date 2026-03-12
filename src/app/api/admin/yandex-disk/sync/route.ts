import { NextRequest, NextResponse } from 'next/server';
import { writeFile, readFile } from 'fs/promises';
import { join } from 'path';

const FOLDER_NAME = 'форматированные данные для сайта';
const YANDEX_DISK_API = 'https://cloud-api.yandex.net/v1/disk';

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('OAuth ')) {
    return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 });
  }
  
  const token = authHeader.replace('OAuth ', '');
  
  try {
    // Проверяем существование папки
    const folderPath = encodeURIComponent(`disk:/${FOLDER_NAME}`);
    const folderResponse = await fetch(`${YANDEX_DISK_API}/resources?path=${folderPath}`, {
      headers: {
        'Authorization': `OAuth ${token}`
      }
    });
    
    if (!folderResponse.ok) {
      return NextResponse.json({ 
        error: `Папка "${FOLDER_NAME}" не найдена на Яндекс.Диске` 
      }, { status: 404 });
    }
    
    // Получаем список файлов
    const filesResponse = await fetch(`${YANDEX_DISK_API}/resources?path=${folderPath}&limit=100`, {
      headers: {
        'Authorization': `OAuth ${token}`
      }
    });
    
    const filesData = await filesResponse.json();
    const files = (filesData._embedded?.items || []).filter((item: any) => item.type === 'file');
    
    if (files.length === 0) {
      return NextResponse.json({ 
        message: 'Папка пуста, нечего синхронизировать',
        syncedFiles: 0
      });
    }
    
    const syncedFiles: string[] = [];
    const errors: string[] = [];
    
    // Скачиваем каждый файл
    for (const file of files) {
      try {
        // Получаем ссылку на скачивание
        const downloadUrlResponse = await fetch(
          `${YANDEX_DISK_API}/resources/download?path=${encodeURIComponent(file.path)}`,
          {
            headers: {
              'Authorization': `OAuth ${token}`
            }
          }
        );
        
        if (!downloadUrlResponse.ok) {
          errors.push(`Не удалось получить ссылку для ${file.name}`);
          continue;
        }
        
        const downloadData = await downloadUrlResponse.json();
        
        // Скачиваем файл
        const fileResponse = await fetch(downloadData.href);
        const fileBuffer = await fileResponse.arrayBuffer();
        
        // Сохраняем файл локально (в папку public/yandex-data)
        const fileName = file.name;
        const localPath = join(process.cwd(), 'public', 'yandex-data', fileName);
        
        await writeFile(localPath, Buffer.from(fileBuffer));
        syncedFiles.push(fileName);
        
      } catch (fileError) {
        console.error(`Ошибка скачивания файла ${file.name}:`, fileError);
        errors.push(`Ошибка скачивания: ${file.name}`);
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Синхронизировано файлов: ${syncedFiles.length}`,
      syncedFiles: syncedFiles,
      errors: errors,
      totalFiles: files.length
    });
    
  } catch (error) {
    console.error('Yandex Disk sync error:', error);
    return NextResponse.json({ 
      error: 'Ошибка синхронизации с Яндекс.Диском' 
    }, { status: 500 });
  }
}
