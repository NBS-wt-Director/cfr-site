import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const logs: string[] = [];
  
  const addLog = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString('ru-RU');
    const line = `[${timestamp}] ${msg}`;
    logs.push(line);
    console.log(line);
  };
  
  try {
    const body = await request.json();
    const { folderPath, oauthToken } = body;
    
    addLog(`🔍 Проверка папки: ${folderPath}`);
    
    if (!folderPath?.trim() || !oauthToken?.trim()) {
      return NextResponse.json({ 
        success: false, 
        error: 'folderPath и oauthToken обязательны',
        logs 
      }, { status: 400 });
    }
    
    const headers = {
      'Authorization': `OAuth ${oauthToken}`,
      'Accept': 'application/json'
    };
    
    // Проверяем токен
    addLog('🔑 Проверка токена...');
    const testResponse = await fetch('https://cloud-api.yandex.net/v1/disk/', { headers });
    if (!testResponse.ok) {
      addLog(`❌ Токен невалиден: ${testResponse.status}`);
      return NextResponse.json({ 
        success: false, 
        error: 'Токен невалиден',
        code: 'INVALID_TOKEN',
        logs 
      }, { status: 401 });
    }
    addLog('✅ Токен валиден');
    
    // Проверяем папку
    addLog(`📂 Проверяю папку: ${folderPath}`);
    const url = `https://cloud-api.yandex.net/v1/disk/resources?path=${encodeURIComponent(folderPath)}&fields=_embedded.items(name,type,path,extension)&limit=100`;
    
    const response = await fetch(url, { headers });
    
    if (response.ok) {
      const data = await response.json();
      const items = data._embedded?.items || [];
      const folders = items.filter((i: any) => i.type === 'dir');
      const files = items.filter((i: any) => i.type === 'file');
      
      addLog(`✅ Папка найдена!`);
      addLog(`📁 Подпапок: ${folders.length}`);
      addLog(`📄 Файлов: ${files.length}`);
      
      if (folders.length > 0) {
        addLog(`📋 Первые папки: ${folders.slice(0, 5).map((f: any) => f.name).join(', ')}`);
      }
      if (files.length > 0) {
        addLog(`📋 Первые файлы: ${files.slice(0, 5).map((f: any) => f.name).join(', ')}`);
      }
      
      return NextResponse.json({
        success: true,
        found: true,
        folderName: folderPath.split('/').pop(),
        subfolderCount: folders.length,
        fileCount: files.length,
        logs
      });
    } else if (response.status === 404) {
      addLog(`❌ Папка не найдена: ${folderPath}`);
      return NextResponse.json({
        success: true,
        found: false,
        folderName: folderPath,
        logs
      });
    } else {
      const errorText = await response.text();
      addLog(`❌ Ошибка: ${response.status} - ${errorText}`);
      return NextResponse.json({
        success: false,
        error: errorText,
        code: `HTTP_${response.status}`,
        logs
      }, { status: response.status });
    }
    
  } catch (error: any) {
    addLog(`💥 Ошибка: ${error.message}`);
    return NextResponse.json({
      success: false,
      error: error.message,
      code: 'EXCEPTION',
      logs
    }, { status: 500 });
  }
}
