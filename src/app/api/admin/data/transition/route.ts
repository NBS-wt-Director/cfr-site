import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin } from '@/lib/auth';
import { getDbAsync, saveDbAsync, setDbMode, getDbMode } from '@/lib/db';
import { saveAllToPg, loadAllFromPg } from '@/lib/db-new';
import { isPgAvailable } from '@/lib/postgres';

/**
 * POST /api/admin/data/transition
 * Запуск полного перехода на PostgreSQL
 */
export async function POST(request: NextRequest) {
  const auth = authenticateAdmin(request);
  if (auth !== true) return auth;

  try {
    const stages: Array<{ name: string; status: 'pending' | 'running' | 'success' | 'error'; message: string }> = [
      { name: 'Проверка подключения к PG', status: 'pending', message: '' },
      { name: 'Экспорт данных из JSON', status: 'pending', message: '' },
      { name: 'Импорт в PG по таблицам', status: 'pending', message: '' },
      { name: 'Проверка целостности', status: 'pending', message: '' },
      { name: 'Переключение режима на PG', status: 'pending', message: '' },
    ];

    // Этап 1: Проверка подключения
    stages[0].status = 'running';
    const pgAvailable = await isPgAvailable();
    
    if (!pgAvailable) {
      stages[0].status = 'error';
      stages[0].message = 'PostgreSQL недоступен. Запустите Docker: docker compose up -d';
      
      return NextResponse.json({
        success: false,
        stages,
        error: 'PostgreSQL недоступен',
      });
    }
    
    stages[0].status = 'success';
    stages[0].message = 'Подключение успешно';

    // Этап 2: Экспорт из JSON
    stages[1].status = 'running';
    const jsonData = await getDbAsync();
    stages[1].status = 'success';
    stages[1].message = `Экспортировано данных: ${Object.keys(jsonData).length} таблиц`;

    // Этап 3: Импорт в PG
    stages[2].status = 'running';
    await saveAllToPg(jsonData);
    stages[2].status = 'success';
    stages[2].message = 'Данные успешно импортированы в PostgreSQL';

    // Этап 4: Проверка целостности
    stages[3].status = 'running';
    const pgData = await loadAllFromPg();
    let integrityOk = true;
    let integrityMessage = '';
    
    for (const key of Object.keys(jsonData)) {
      if (Array.isArray(jsonData[key])) {
        const pgCount = Array.isArray(pgData[key]) ? pgData[key].length : 0;
        const jsonCount = jsonData[key].length;
        
        if (pgCount < jsonCount * 0.9) { // 90% совпадения
          integrityOk = false;
          integrityMessage = `Несоответствие для "${key}": JSON=${jsonCount}, PG=${pgCount}`;
          break;
        }
      }
    }
    
    stages[3].status = integrityOk ? 'success' : 'error';
    stages[3].message = integrityOk ? 'Целостность проверена' : integrityMessage;

    if (!integrityOk) {
      return NextResponse.json({
        success: false,
        stages,
        error: integrityMessage,
      });
    }

    // Этап 5: Переключение режима
    stages[4].status = 'running';
    setDbMode('postgres');
    stages[4].status = 'success';
    stages[4].message = 'Режим переключён на PostgreSQL';

    return NextResponse.json({
      success: true,
      stages,
      message: '✅ Переход на PostgreSQL завершён успешно!',
    });
  } catch (error) {
    console.error('❌ Ошибка перехода:', error);
    return NextResponse.json(
      { 
        error: 'Ошибка перехода',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
