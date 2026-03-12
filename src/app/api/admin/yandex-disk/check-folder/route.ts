import { NextRequest, NextResponse } from 'next/server';

const FOLDER_NAME = 'форматированные данные для сайта';
const YANDEX_DISK_API = 'https://cloud-api.yandex.net/v1/disk';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('OAuth ')) {
    return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 });
  }
  
  const token = authHeader.replace('OAuth ', '');
  
  try {
    // Проверяем существование папки
    const folderPath = encodeURIComponent(`disk:/${FOLDER_NAME}`);
    const response = await fetch(`${YANDEX_DISK_API}/resources?path=${folderPath}`, {
      headers: {
        'Authorization': `OAuth ${token}`
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      
      // Получаем список файлов в папке
      const filesResponse = await fetch(`${YANDEX_DISK_API}/resources?path=${folderPath}&limit=100`, {
        headers: {
          'Authorization': `OAuth ${token}`
        }
      });
      
      const filesData = await filesResponse.json();
      const files = (filesData._embedded?.items || [])
        .filter((item: any) => item.type === 'file')
        .map((file: any) => ({
          name: file.name,
          path: file.path,
          size: file.size,
          modified: file.modified
        }));
      
      return NextResponse.json({
        hasFolder: true,
        folderName: FOLDER_NAME,
        files: files,
        fileCount: files.length
      });
    } else if (response.status === 404) {
      return NextResponse.json({
        hasFolder: false,
        folderName: FOLDER_NAME,
        files: [],
        fileCount: 0
      });
    } else {
      return NextResponse.json({ 
        error: 'Ошибка проверки папки',
        status: response.status 
      }, { status: response.status });
    }
  } catch (error) {
    console.error('Yandex Disk API error:', error);
    return NextResponse.json({ 
      error: 'Ошибка соединения с Яндекс.Диском' 
    }, { status: 500 });
  }
}
