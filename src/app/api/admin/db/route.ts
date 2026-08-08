import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/postgres';
import { loadAllFromPg, saveAllToPg, getTableCounts } from '@/lib/db-new';
import fs from 'fs';
import path from 'path';
import { authenticateAdmin } from '@/lib/auth';

const BACKUP_DIR = path.join(process.cwd(), 'backups');

// Убедиться что папка backups существует
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// GET - получить данные (экспорт из PG)
export async function GET(request: NextRequest) {
  const auth = authenticateAdmin(request);
  if (auth !== true) return auth;
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  
  try {
    // Экспорт БД
    if (action === 'export') {
      const data = await loadAllFromPg();
      return NextResponse.json(data);
    }
    
    // Статистика по таблицам
    if (action === 'stats') {
      const counts = await getTableCounts();
      return NextResponse.json(counts);
    }
    
    // Создать резервную копию БД
    if (action === 'backup') {
      const data = await loadAllFromPg();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFile = path.join(BACKUP_DIR, `db-backup-${timestamp}.json`);
      fs.writeFileSync(backupFile, JSON.stringify(data, null, 2), 'utf-8');
      
      // Удалить старые бэкапы (оставить только последние 10)
      const backups = fs.readdirSync(BACKUP_DIR)
        .filter(f => f.startsWith('db-backup-'))
        .sort()
        .reverse();
      
      if (backups.length > 10) {
        backups.slice(10).forEach(oldFile => {
          fs.unlinkSync(path.join(BACKUP_DIR, oldFile));
        });
      }
      
      return NextResponse.json({ success: true, backup: backupFile });
    }
    
    // Получить список бэкапов
    if (action === 'list-backups') {
      const backups = fs.readdirSync(BACKUP_DIR)
        .filter(f => f.startsWith('db-backup-'))
        .sort()
        .reverse()
        .map(f => ({
          name: f,
          path: path.join(BACKUP_DIR, f),
          date: fs.statSync(path.join(BACKUP_DIR, f)).mtime
        }));
      return NextResponse.json(backups);
    }
    
    return NextResponse.json({ error: 'Неизвестное действие' }, { status: 400 });
  } catch (error) {
    console.error('Ошибка экспорта:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}

// POST - импорт данных из JSON в PG
export async function POST(request: NextRequest) {
  const auth = authenticateAdmin(request);
  if (auth !== true) return auth;

  const contentType = request.headers.get('content-type');
  if (!contentType?.includes('application/json')) {
    return NextResponse.json({ error: 'Неверный Content-Type' }, { status: 415 });
  }

  try {
    const body = await request.json();
    const { action, data } = body;
    
    // Импорт БД
    if (action === 'import') {
      if (!data) {
        return NextResponse.json({ error: 'Нет данных для импорта' }, { status: 400 });
      }
      
      // Создаём бэкап перед импортом
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFile = path.join(BACKUP_DIR, `db-before-import-${timestamp}.json`);
      const currentData = await loadAllFromPg();
      fs.writeFileSync(backupFile, JSON.stringify(currentData, null, 2), 'utf-8');
      
      // Сохраняем в PG
      await saveAllToPg(data);
      return NextResponse.json({ success: true });
    }
    
    // Очистить статистику
    if (action === 'clear-stat') {
      return NextResponse.json({ success: true });
    }
    
    return NextResponse.json({ error: 'Неизвестное действие' }, { status: 400 });
  } catch (error) {
    console.error('Ошибка импорта:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}
