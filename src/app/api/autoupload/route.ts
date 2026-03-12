import { NextRequest, NextResponse } from 'next/server';
import { writeFile, readFile, mkdir, stat } from 'fs/promises';
import { join } from 'path';
import mammoth from 'mammoth';
import { parseProgramDocument, createProgramJson, type DbProgram, namesMatch } from '@/lib/programParser';
import { getDb } from '@/lib/db';

const READ_JSON_FILE = 'read.json';

interface ReadItem {
  id: string;
  type: 'program' | 'trainer' | 'slider';
  name: string;
  path: string;
  // Текст из docx
  description?: string;
  descriptionLines?: string[];
  descriptionFileName?: string;
  // Фото
  previewImage?: string;
  uploadedImages?: Array<{
    name: string;
    path: string;
    localPath: string;
    fileName: string;
  }>;
  // Статистика
  hasImages?: boolean;
  hasDocx?: boolean;
  totalFiles?: number;
  processedAt: string;
}

// Найти все папки (рекурсивно)
async function findAllFolders(
  token: string, 
  path: string, 
  depth: number = 0, 
  maxDepth: number = 10
): Promise<any[]> {
  if (depth > maxDepth) return [];
  
  const headers = {
    'Authorization': `OAuth ${token}`,
    'Accept': 'application/json'
  };
  
  const url = `https://cloud-api.yandex.net/v1/disk/resources?path=${encodeURIComponent(path)}&fields=_embedded.items(name,type,path)&limit=100`;
  
  try {
    const response = await fetch(url, { headers });
    if (!response.ok) return [];
    
    const data = await response.json();
    const items = data._embedded?.items || [];
    
    // Только папки
    const folders = items.filter((item: any) => item.type === 'dir');
    
    if (folders.length === 0) {
      // Это листовая папка - возвращаем её
      return [{ path, depth, name: path.split('/').pop() }];
    }
    
    // Рекурсивно ищем в каждой подпапке
    const results: any[] = [];
    for (const folder of folders) {
      const subResults = await findAllFolders(token, folder.path, depth + 1, maxDepth);
      results.push(...subResults);
    }
    
    return results;
  } catch {
    return [];
  }
}

// Прочитать текст из docx (используя Buffer)
async function extractDocxText(downloadUrl: string, headers: HeadersInit): Promise<string> {
  try {
    console.log('📄 extractDocxText: скачиваю файл...');
    
    const response = await fetch(downloadUrl, { headers });
    console.log('📄 extractDocxText: response status =', response.status);
    
    if (!response.ok) {
      console.error('📄 extractDocxText: не удалось скачать, status =', response.status);
      return '';
    }
    
    // Получаем ArrayBuffer
    const arrayBuffer = await response.arrayBuffer();
    console.log('📄 extractDocxText: размер arrayBuffer =', arrayBuffer.byteLength, 'байт');
    
    // Конвертируем в Node.js Buffer
    const nodeBuffer = Buffer.from(arrayBuffer);
    console.log('📄 extractDocxText: конвертировано в Buffer, длина =', nodeBuffer.length);
    
    // mammoth может работать с буфером
    const result = await mammoth.extractRawText({ buffer: nodeBuffer });
    console.log('📄 extractDocxText: результат длина =', result.value?.length);
    if (result.value) {
      console.log('📄 extractDocxText: результат (первые 100 символов):', result.value.substring(0, 100));
    }
    return result.value || '';
  } catch (e: any) {
    console.error('📄 extractDocxText: ошибка:', e.message);
    console.error('📄 extractDocxText: стек:', e.stack);
    return '';
  }
}

// Скачать файл (бинарный)
async function downloadFile(downloadUrl: string): Promise<Buffer | null> {
  try {
    const response = await fetch(downloadUrl);
    if (!response.ok) return null;
    
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch {
    return null;
  }
}

// Найти все файлы в папке (jpg, png, docx и др.)
async function findFiles(token: string, folderPath: string): Promise<{
  images: any[];
  docxFiles: any[];
  allFiles: any[];
}> {
  const headers = {
    'Authorization': `OAuth ${token}`,
    'Accept': 'application/json'
  };
  
  const url = `https://cloud-api.yandex.net/v1/disk/resources?path=${encodeURIComponent(folderPath)}&fields=_embedded.items(name,type,path,extension,size,modified)&limit=200`;
  
  console.log('🔍 findFiles URL:', url);
  console.log('🔍 findFiles folderPath:', folderPath);
  
  try {
    const response = await fetch(url, { headers });
    console.log('🔍 findFiles response:', response.status);
    
    if (!response.ok) {
      const errText = await response.text();
      console.error('🔍 findFiles error:', errText);
      return { images: [], docxFiles: [], allFiles: [] };
    }
    
    const data = await response.json();
    const items = data._embedded?.items || [];
    
    console.log('🔍 findFiles items count:', items.length);
    console.log('🔍 findFiles items:', items.map((i: any) => `${i.type}: ${i.name}`).join(', '));
    
    // Все файлы
    const allFiles = items.filter((item: any) => item.type === 'file');
    console.log('🔍 findFiles allFiles:', allFiles.length);
    
    // Извлекаем расширение из имени файла (API может не возвращать extension)
    const getExtension = (filename: string): string => {
      const parts = filename.split('.');
      return parts.length > 1 ? parts.pop()?.toLowerCase() || '' : '';
    };

    // Все изображения (проверяем и extension из API, и извлекаем из имени)
    const imageExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'];
    const images = allFiles.filter((item: any) => {
      const ext = (item.extension || getExtension(item.name)).toLowerCase();
      return imageExtensions.includes(ext);
    });
    console.log('🔍 findFiles images:', images.length);

    // Все docx файлы
    const docxFiles = allFiles.filter((item: any) => {
      const ext = (item.extension || getExtension(item.name)).toLowerCase();
      return ext === 'docx';
    });
    console.log('🔍 findFiles docxFiles:', docxFiles.length);
    
    return { images, docxFiles, allFiles };
  } catch (e: any) {
    console.error('🔍 findFiles exception:', e.message);
    return { images: [], docxFiles: [], allFiles: [] };
  }
}

// Чтение или создание read.json
async function getReadJsonPath(): Promise<string> {
  return join(process.cwd(), 'public', 'yandex-data', READ_JSON_FILE);
}

async function readReadJson(): Promise<ReadItem[]> {
  try {
    const filePath = await getReadJsonPath();
    const content = await readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return [];
  }
}

async function writeReadJson(items: ReadItem[]): Promise<void> {
  const dirPath = join(process.cwd(), 'public', 'yandex-data');
  
  try {
    await mkdir(dirPath, { recursive: true });
  } catch {}
  
  const filePath = await getReadJsonPath();
  await writeFile(filePath, JSON.stringify(items, null, 2), 'utf-8');
}

/**
 * Сравнение двух программ на идентичность
 */
function programsAreEqual(prog1: any, prog2: any): boolean {
  // Сравниваем основные поля
  if (prog1.name !== prog2.name) return false;
  if (prog1.description !== prog2.description) return false;
  if (prog1.image !== prog2.image) return false;
  
  // Сравниваем тренеров
  const train1 = JSON.stringify(prog1.trainers || []);
  const train2 = JSON.stringify(prog2.trainers || []);
  if (train1 !== train2) return false;
  
  // Сравниваем тренировки
  const work1 = JSON.stringify(prog1.workouts || []);
  const work2 = JSON.stringify(prog2.workouts || []);
  if (work1 !== work2) return false;
  
  // Сравниваем галерею
  const photo1 = JSON.stringify(prog1.photoAlbum || []);
  const photo2 = JSON.stringify(prog2.photoAlbum || []);
  if (photo1 !== photo2) return false;
  
  return true;
}

/**
 * Сохранение программы в БД (с проверкой на существование и изменения)
 */
async function saveProgramToDb(
  program: any, 
  dbData: any, 
  addLog: (msg: string) => void
): Promise<{ saved: boolean; action: 'skipped' | 'created' | 'updated'; existingProgram?: any }> {
  const programs = dbData.programs || [];
  
  // Ищем программу с таким же названием
  const existingIndex = programs.findIndex((p: any) => 
    p.name.toLowerCase().trim() === program.name.toLowerCase().trim()
  );
  
  if (existingIndex >= 0) {
    const existingProgram = programs[existingIndex];
    
    // Проверяем, есть ли изменения
    if (programsAreEqual(existingProgram, program)) {
      addLog(`   ⏭️ Пропускаем "${program.name}" - идентично существующему`);
      return { saved: true, action: 'skipped', existingProgram };
    }
    
    // Обновляем существующую программу
    addLog(`   🔄 Обновляем "${program.name}"`);
    programs[existingIndex] = { ...existingProgram, ...program, id: existingProgram.id };
    return { saved: true, action: 'updated', existingProgram };
  }
  
  // Создаём новую программу
  addLog(`   ➕ Создаём новую программу "${program.name}"`);
  programs.push({ ...program, id: Date.now() });
  return { saved: true, action: 'created' };
}

export async function POST(request: NextRequest) {
  const logs: string[] = [];
  
  const addLog = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString('ru-RU');
    const line = `[${timestamp}] ${msg}`;
    logs.push(line);
    console.log(line);
  };
  
  addLog('='.repeat(60));
  addLog('🔥 AUTOUPLOAD API: START');
  addLog('='.repeat(60));
  
  try {
    const rawBody = await request.text();
    let body;
    try {
      body = JSON.parse(rawBody);
    } catch {
      throw new Error('Невалидный JSON');
    }
    
    const { folderPath, oauthToken, scanType } = body;
    addLog(`📋 Параметры: folderPath="${folderPath}", scanType="${scanType}"`);
    addLog(`🔑 Token: ${oauthToken ? 'есть (' + oauthToken.slice(0,10) + '...)' : 'НЕТ'}`);

    // Валидация
    if (!folderPath?.trim() || !oauthToken?.trim()) {
      return NextResponse.json({ success: false, error: 'folderPath и oauthToken обязательны', logs }, { status: 400 });
    }

    if (!['programs', 'trainers', 'sliders'].includes(scanType)) {
      return NextResponse.json({ success: false, error: 'scanType: programs/trainers/sliders', logs }, { status: 400 });
    }

    const headers = {
      'Authorization': `OAuth ${oauthToken}`,
      'Accept': 'application/json',
      'User-Agent': 'CFR-Admin/1.0'
    };

    // === ШАГ 1: Проверка токена ===
    addLog('\n📂 ШАГ 1: Проверка токена...');
    const testResponse = await fetch('https://cloud-api.yandex.net/v1/disk/', { headers });
    if (!testResponse.ok) {
      const err = await testResponse.text();
      addLog(`❌ Токен не работает: ${testResponse.status} - ${err}`);
      throw new Error(`Токен невалиден: ${testResponse.status}`);
    }
    const userData = await testResponse.json();
    addLog(`✅ Токен валиден. Пользователь: ${userData.user?.display_name || 'unknown'}`);

    // === ШАГ 2: Поиск корневой папки ===
    addLog('\n📂 ШАГ 2: Поиск корневой папки: ' + folderPath);
    const folderMappings: Record<string, string> = {
      programs: 'программы',
      trainers: 'тренера|тренер',
      sliders: 'слайдер|баннер|главная|banner'
    };
    const targetPattern = folderMappings[scanType];
    addLog(`🔍 Ищу папку с названием содержащим: "${targetPattern}"`);

    const rootUrl = `https://cloud-api.yandex.net/v1/disk/resources?path=${encodeURIComponent(folderPath)}&fields=_embedded.items(name,type,path)&limit=100`;
    addLog(`🌐 URL: ${rootUrl}`);
    
    const rootResponse = await fetch(rootUrl, { headers });
    addLog(`📡 Ответ корневой папки: ${rootResponse.status}`);
    
    if (!rootResponse.ok) {
      const err = await rootResponse.text();
      addLog(`❌ Ошибка: ${err}`);
      throw new Error(`Ошибка доступа к папке: ${rootResponse.status} - ${err.slice(0, 200)}`);
    }

    const rootData = await rootResponse.json();
    const rootItems = rootData._embedded?.items || [];
    addLog(`📁 В корневой папке найдено ${rootItems.length} элементов:`);
    
    // Выводим все элементы корневой папки
    rootItems.forEach((item: any, i: number) => {
      addLog(`   ${i+1}. [${item.type}] ${item.name}`);
    });

    // Ищем целевую папку (программы/тренера/слайдеры)
    const targetFolder = rootItems.find((item: any) =>
      item.type === 'dir' && item.name.toLowerCase().includes(targetPattern.toLowerCase())
    );

    if (!targetFolder) {
      addLog(`❌ НЕ НАЙДЕНА папка "${targetPattern}"`);
      addLog(`📋 Доступные папки: ${rootItems.filter((i: any) => i.type === 'dir').map((i: any) => i.name).join(', ')}`);
      throw new Error(`Папка "${targetPattern}" не найдена в корневой папке`);
    }

    addLog(`✅ НАЙДЕНА папка: "${targetFolder.name}" (path: ${targetFolder.path})`);

    // === ШАГ 3: Сканирование содержимого целевой папки ===
    addLog('\n📂 ШАГ 3: Сканирование папки "' + targetFolder.name + '"');
    
    const targetUrl = `https://cloud-api.yandex.net/v1/disk/resources?path=${encodeURIComponent(targetFolder.path)}&fields=_embedded.items(name,type,path)&limit=100`;
    const targetResponse = await fetch(targetUrl, { headers });
    addLog(`📡 Ответ: ${targetResponse.status}`);
    
    if (!targetResponse.ok) {
      const err = await targetResponse.text();
      addLog(`❌ Ошибка: ${err}`);
      throw new Error(err);
    }

    const targetData = await targetResponse.json();
    const targetItems = targetData._embedded?.items || [];
    addLog(`📁 В папке "${targetFolder.name}" найдено ${targetItems.length} элементов`);
    
    // Разделяем на папки и файлы
    const subfolders = targetItems.filter((i: any) => i.type === 'dir');
    const files = targetItems.filter((i: any) => i.type === 'file');
    
    addLog(`   📁 Папок: ${subfolders.length}`);
    addLog(`   📄 Файлов: ${files.length}`);
    
    if (subfolders.length > 0) {
      addLog(`📋 Список подпапок (первые 10):`);
      subfolders.slice(0, 10).forEach((f: any, i: number) => {
        addLog(`   ${i+1}. ${f.name}`);
      });
    }
    
    if (files.length > 0) {
      addLog(`📋 Файлы в корне папки (не в подпапках):`);
      files.slice(0, 10).forEach((f: any, i: number) => {
        addLog(`   ${i+1}. ${f.name} (${f.extension})`);
      });
    }

    // === ШАГ 4: Сканируем каждую подпапку (Борьба, Здоровая спина и т.д.) ===
    addLog('\n🔍 ШАГ 4: Сканирование каждой программы...');
    
    // Используем подпапки из шага 3 (это папки типа "Борьба", "Здоровая спина" и т.д.)
    const programFolders = subfolders.map((f: any) => ({
      path: f.path,
      depth: 0,
      name: f.name
    }));
    
    addLog(`📁 Всего программ: ${programFolders.length}`);
    
    if (programFolders.length === 0) {
      addLog(`❌ Не найдены папки с данными!`);
      throw new Error('Не найдены папки с данными. Проверьте структуру папок на Яндекс.Диске.');
    }

    addLog(`📋 Первые 10 папок:`);
    programFolders.slice(0, 10).forEach((f: any, i: number) => {
      addLog(`   ${i+1}. ${f.name} (depth: ${f.depth})`);
    });

    // === ШАГ 5: Сканирование содержимого каждой папки ===
    addLog('\n📄 ШАГ 5: Сканирование + чтение docx + загрузка картинок...');
    
    // Папка для загрузок
    const uploadsDir = join(process.cwd(), 'public', 'uploads');
    try { await mkdir(uploadsDir, { recursive: true }); } catch {}
    addLog(`   📁 Папка uploads: ${uploadsDir}`);
    
    const scanPromises = programFolders.map(async (folder: any, index: number) => {
      const { images, docxFiles, allFiles } = await findFiles(oauthToken, folder.path);
      
      console.log('=== ОБРАБОТКА:', folder.name, '===');
      console.log('images:', images.length, images.map((i: any) => i.name));
      console.log('docxFiles:', docxFiles.length, docxFiles.map((i: any) => i.name));
      
      addLog(`\n   === ${folder.name} ===`);
      addLog(`   🖼️ Фото: ${images.length}, 📄 DOCX: ${docxFiles.length}`);
      
      // === ЧИТАЕМ ТЕКСТ ИЗ DOCX ===
      let descriptionText = '';
      let descriptionLines: string[] = [];
      let descriptionFileName = '';
      let docxSaved = false;
      
      for (const docxFile of docxFiles) {
        addLog(`   📄 Обрабатываю: ${docxFile.name}`);
        
        try {
          let apiPath = docxFile.path;
          if (apiPath.startsWith('disk:/')) apiPath = apiPath.replace('disk:/', '/');
          
          addLog(`   📄 API path: ${apiPath}`);
          
          const downloadUrlResponse = await fetch(
            `https://cloud-api.yandex.net/v1/disk/resources/download?path=${encodeURIComponent(apiPath)}`,
            { headers }
          );
          
          addLog(`   📄 Download URL response: ${downloadUrlResponse.status}`);
          
          if (downloadUrlResponse.ok) {
            const downloadData = await downloadUrlResponse.json();
            addLog(`   📄 Download href получен: ${downloadData.href?.substring(0, 80)}...`);
            addLog(`   📄 Download method: ${downloadData.method}`);
            
            // Читаем текст (с заголовками для Яндекса)
            descriptionText = await extractDocxText(downloadData.href, headers);
            descriptionLines = descriptionText.split('\n').filter((line: string) => line.trim());
            descriptionFileName = docxFile.name;
            
            addLog(`   ✅ Текст прочитан: ${descriptionLines.length} строк`);
            if (descriptionLines.length > 0) {
              addLog(`   📝 Первые 100 символов: ${descriptionText.substring(0, 100).replace(/\n/g, '↵')}`);
            } else {
              addLog(`   ⚠️ Текст ПУСТ! Проверьте docx файл`);
            }
            
            // Также сохраняем сам файл
            const fileBuffer = await downloadFile(downloadData.href);
            if (fileBuffer && fileBuffer.length > 0) {
              const safeName = folder.name.replace(/[^a-zA-Z0-9а-яА-ЯёЁ]/g, '_');
              const localFileName = `${safeName}_${docxFile.name}`;
              const localPath = join(uploadsDir, localFileName);
              await writeFile(localPath, fileBuffer);
              docxSaved = true;
              addLog(`   💾 DOCX сохранён: ${localFileName}`);
            }
              
            // Читаем только первый docx
            break;
          }
        } catch (e: any) {
          addLog(`   ❌ Ошибка ${docxFile.name}: ${e.message}`);
        }
      }
      
      // === ЗАГРУЖАЕМ ВСЕ КАРТИНКИ ===
      const uploadedImages: any[] = [];
      
      for (let imgIdx = 0; imgIdx < images.length; imgIdx++) {
        const img = images[imgIdx];
        addLog(`   🖼️ Загружаю ${imgIdx + 1}/${images.length}: ${img.name}`);
        
        try {
          let apiPath = img.path;
          if (apiPath.startsWith('disk:/')) apiPath = apiPath.replace('disk:/', '/');
          
          const downloadUrlResponse = await fetch(
            `https://cloud-api.yandex.net/v1/disk/resources/download?path=${encodeURIComponent(apiPath)}`,
            { headers }
          );
          
          if (downloadUrlResponse.ok) {
            const downloadData = await downloadUrlResponse.json();
            const fileUrl = downloadData.href;
            
            const fileResponse = await fetch(fileUrl);
            const fileBuffer = await fileResponse.arrayBuffer();
            
            if (fileBuffer.byteLength > 0) {
              // Формат: p_[id]_[m/номер]_[ddmmyyyyHHMMSS].jpeg
              // ID программы будет известен позже, пока используем временный формат с именем папки
              const safeName = folder.name.replace(/[^a-zA-Z0-9а-яА-ЯёЁ]/g, '_');
              const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14); // ddmmyyyyHHMMSS
              const ext = 'jpeg'; // Всегда jpeg
              // Временный формат until программа не создана в БД
              const localFileName = `p_${safeName}_${imgIdx}_${timestamp}.${ext}`;
              const localPath = join(uploadsDir, localFileName);
              
              await writeFile(localPath, Buffer.from(fileBuffer));
              
              uploadedImages.push({
                name: img.name,
                path: img.path,
                localPath: `/uploads/${localFileName}`,
                fileName: localFileName,
                timestamp,
                isMain: imgIdx === 0 // Флаг главного фото
              });
              
              addLog(`   ✅ ${localFileName}`);
            }
          }
        } catch (e: any) {
          addLog(`   ❌ Ошибка ${img.name}: ${e.message}`);
        }
      }
      
      const typeMap: Record<string, 'program' | 'trainer' | 'slider'> = {
        programs: 'program',
        trainers: 'trainer',
        sliders: 'slider'
      };
      
      return {
        id: `${scanType}-${index}-${Date.now()}`,
        type: typeMap[scanType],
        name: folder.name,
        path: folder.path,
        // Текст из docx
        description: descriptionText,
        descriptionLines: descriptionLines,
        descriptionFileName: descriptionFileName,
        // Загруженные изображения
        uploadedImages: uploadedImages,
        previewImage: uploadedImages[0]?.localPath || null,
        // Для совместимости
        docxFiles: docxFiles.map((f: any) => ({
          name: f.name,
          path: f.path,
          size: f.size
        })),
        imagePaths: images.map((img: any) => ({
          name: img.name,
          path: img.path,
          size: img.size
        })),
        allFiles: allFiles.map((f: any) => ({
          name: f.name,
          path: f.path,
          extension: f.extension,
          size: f.size
        })),
        hasImages: images.length > 0,
        hasDocx: docxFiles.length > 0,
        totalFiles: allFiles.length,
        uploadedImagesCount: uploadedImages.length,
        processedAt: new Date().toISOString()
      };
    });

    const scannedItems = await Promise.all(scanPromises);
    
    // Берем ВСЕ папки (даже без файлов - покажем что в них есть)
    const validItems = scannedItems;

    // === ШАГ 6: Парсинг программ (новое!) ===
    addLog('\n🔄 ШАГ 6: Парсинг программ...');
    
    // Получаем существующих тренеров из БД
    const dbData = getDb();
    const existingTrainers = (dbData.trainers || []).map((t: any) => ({
      id: t.id,
      name: t.name,
      image: t.image,
      experience: t.experience
    }));
    addLog(`   👥 Существующих тренеров в БД: ${existingTrainers.length}`);
    
    // Парсим каждую программу
    const parsedPrograms: any[] = [];
    
    for (const item of validItems) {
      if (item.description && item.description.trim().length > 0) {
        const parsed = parseProgramDocument(item.description);
        
        if (parsed) {
          // Папка для фото программы
          const safeName = item.name.replace(/[^a-zA-Z0-9а-яА-ЯёЁ]/g, '_');
          const programFolder = `/uploads/${safeName}`;
          
          // Создаем программу для БД
          const dbProgram = createProgramJson(parsed, programFolder, existingTrainers);
          
          // Формируем полный preview
          // Находим загруженные фото для этой программы
          const programUploadedImages = item.uploadedImages || [];
          
          // Сопоставляем главное фото и галерею с загруженными файлами
          // Первое загруженное фото = главное фото программы
          // Все остальные загруженные фото = галерея
          const mainImagePath = programUploadedImages[0]?.localPath || null;
          
          // Для галереи используем все фото, начиная со второго (индекс 1)
          const galleryWithPaths = parsed.gallery.map((photo: any, idx: number) => {
            // Ищем соответствующее фото по индексу в загруженных (начиная с 1, т.к. 0 - главное)
            const uploadedPhoto = programUploadedImages[idx + 1];
            return {
              ...photo,
              fullPath: uploadedPhoto?.localPath || null
            };
          });

          const preview = {
            ...dbProgram,
            // Переопределяем image с реальным путем
            image: mainImagePath || dbProgram.image,
            // Добавляем загруженные фото для отображения
            uploadedImages: programUploadedImages,
            // Добавляем информацию о парсинге
            parsed: {
              name: parsed.name,
              description: parsed.description,
              trainers: parsed.trainers,
              workouts: parsed.workouts,
              mainImage: parsed.mainImage,
              gallery: galleryWithPaths,
              // ID найденных тренеров
              matchedTrainerIds: dbProgram.trainers.filter((t: any) => !t.includes(' ')),
              // Имена тренеров которые не найдены (используем улучшенный поиск с перестановкой слов)
              unmatchedTrainers: parsed.trainers.filter((t: string) => 
                !existingTrainers.some((et: any) => namesMatch(t, et.name))
              )
            }
          };
          
          parsedPrograms.push(preview);
          addLog(`   ✅ ${item.name}: "${parsed.name}" - ${parsed.trainers.length} тренеров, ${parsed.workouts.length} тренировок`);
        } else {
          addLog(`   ⚠️ ${item.name}: не удалось распарсить (формат не соответствует)`);
        }
      } else {
        addLog(`   ⚠️ ${item.name}: нет текста для парсинга`);
      }
    }

    // === ШАГ 7: Сохранение программ в БД ===
    addLog('\n💾 ШАГ 7: Сохранение программ в БД...');
    
    let savedCount = 0;
    let skippedCount = 0;
    let updatedCount = 0;
    
    for (const parsedProgram of parsedPrograms) {
      // Формируем photoAlbum с реальными путями к загруженным файлам
      // Первое фото (индекс 0) - главное, остальные - галерея
      const uploadedImages = parsedProgram.uploadedImages || [];
      const photoAlbum = uploadedImages.slice(1).map((img: any, idx: number) => ({
        image: img.localPath,
        caption: parsedProgram.parsed?.gallery?.[idx]?.caption || ''
      }));
      
      // Подготавливаем данные программы для сохранения
      const programData = {
        name: parsedProgram.name,
        description: parsedProgram.description,
        image: parsedProgram.image, // Уже содержит правильный путь из uploadedImages[0]
        photoAlbum: photoAlbum,
        trainers: parsedProgram.trainers,
        workouts: parsedProgram.workouts
      };
      
      const result = await saveProgramToDb(programData, dbData, addLog);
      if (result.action === 'created') savedCount++;
      else if (result.action === 'updated') updatedCount++;
      else if (result.action === 'skipped') skippedCount++;
    }
    
    // Сохраняем обновлённую БД
    if (savedCount > 0 || updatedCount > 0) {
      const dbPath = join(process.cwd(), 'db.json');
      await writeFile(dbPath, JSON.stringify(dbData, null, 2), 'utf-8');
      addLog(`   ✅ БД обновлена: создано ${savedCount}, обновлено ${updatedCount}, пропущено ${skippedCount}`);
    } else {
      addLog(`   ⏭️ БД не изменена: все программы идентичны (пропущено ${skippedCount})`);
    }

    addLog(`\n✅ Обработано программ: ${validItems.length}`);
    addLog(`   📝 Распарсено программ: ${parsedPrograms.length}`);
    addLog(`   💾 Сохранено: ${savedCount} новых, ${updatedCount} обновлено, ${skippedCount} пропущено`);
    
    // Статистика
    const withDocx = validItems.filter((i: any) => i.hasDocx).length;
    const withImages = validItems.filter((i: any) => i.hasImages).length;
    const totalFiles = validItems.reduce((sum: number, i: any) => sum + (i.totalFiles || 0), 0);
    addLog(`   📄 С docx: ${withDocx}`);
    addLog(`   🖼️ С фото: ${withImages}`);
    addLog(`   📁 Всего файлов: ${totalFiles}`);

    // 4. Читаем существующий read.json и добавляем новые данные
    addLog('\n💾 ШАГ 6: Сохранение в read.json...');
    const existingItems = await readReadJson();
    
    // Удаляем старые записи того же типа
    const typeToRemove = scanType === 'programs' ? 'program' : 
                        scanType === 'trainers' ? 'trainer' : 'slider';
    const filteredExisting = existingItems.filter(item => item.type !== typeToRemove);
    
    // Формируем данные для сохранения
    const itemsToSave = validItems.map((item: any) => ({
      id: item.id,
      type: item.type,
      name: item.name,
      path: item.path,
      // Текст из docx
      description: item.description,
      descriptionLines: item.descriptionLines,
      descriptionFileName: item.descriptionFileName,
      // Фото
      previewImage: item.previewImage,
      uploadedImages: item.uploadedImages,
      // Остальное
      hasImages: item.hasImages,
      hasDocx: item.hasDocx,
      totalFiles: item.totalFiles,
      processedAt: item.processedAt
    }));
    
    // Объединяем и сохраняем
    const allItems = [...filteredExisting, ...itemsToSave];
    await writeReadJson(allItems);

    addLog(`✅ Сохранено в read.json (${allItems.length} записей всего)`);
    addLog(`   📝 Текстовых описаний: ${itemsToSave.filter((i: any) => i.description).length}`);
    addLog(`   🖼️ Загружено фото: ${itemsToSave.reduce((sum: number, i: any) => sum + (i.uploadedImages?.length || 0), 0)}`);

    // Подсчитываем сколько загружено
    const uploadedImages = validItems.filter((i: any) => i.previewImage).length;
    const uploadedDocx = validItems.filter((i: any) => i.description?.text).length;
    
    // Итоговый ответ
    const result = {
      success: true,
      scanType,
      targetFolder: targetFolder.name,
      totalLeafFolders: programFolders.length,
      validItems: validItems.length,
      uploadedImages,
      uploadedDocx,
      items: validItems,
      // Добавляем распарсенные программы
      parsedPrograms,
      // Существующие тренеры для сопоставления
      existingTrainers,
      readJsonPath: `/yandex-data/${READ_JSON_FILE}`,
      processedAt: new Date().toISOString(),
      logs: logs
    };

    addLog('\n' + '='.repeat(60));
    addLog('🎉 УСПЕХ! Завершено');
    addLog('='.repeat(60));
    
    return NextResponse.json(result);

  } catch (error: any) {
    addLog('\n' + '❌'.repeat(30));
    addLog('💥 ОШИБКА: ' + error.message);
    addLog('❌'.repeat(30));
    
    // Пытаемся извлечь код ошибки
    let errorCode = 'UNKNOWN';
    try {
      const parsed = JSON.parse(error.message);
      errorCode = parsed.code || parsed.error?.code || error.message.slice(0, 50);
    } catch {
      errorCode = error.message.slice(0, 50);
    }
    
    return NextResponse.json({
      success: false,
      error: error.message,
      code: errorCode,
      logs: logs
    }, { status: 500 });
  }
}



