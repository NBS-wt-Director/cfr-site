import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DB_FILE = path.join(process.cwd(), 'db.json');
const STAT_FILE = path.join(process.cwd(), 'public', 'stat.json');
const BACKUP_DIR = path.join(process.cwd(), 'backups');

// Убедиться что папка backups существует
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// GET - получить данные (экспорт)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  
  try {
    // Экспорт БД
    if (action === 'export') {
      if (fs.existsSync(DB_FILE)) {
        const dbData = fs.readFileSync(DB_FILE, 'utf-8');
        return NextResponse.json(JSON.parse(dbData));
      }
      return NextResponse.json({ error: 'БД не найдена' }, { status: 404 });
    }
    
    // Экспорт статистики
    if (action === 'export-stat') {
      if (fs.existsSync(STAT_FILE)) {
        const statData = fs.readFileSync(STAT_FILE, 'utf-8');
        return NextResponse.json(JSON.parse(statData));
      }
      return NextResponse.json({ error: 'Статистика не найдена' }, { status: 404 });
    }
    
    // Создать резервную копию БД
    if (action === 'backup') {
      if (fs.existsSync(DB_FILE)) {
        const dbData = fs.readFileSync(DB_FILE, 'utf-8');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFile = path.join(BACKUP_DIR, `db-backup-${timestamp}.json`);
        fs.writeFileSync(backupFile, dbData, 'utf-8');
        
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
      return NextResponse.json({ error: 'БД не найдена' }, { status: 404 });
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

// POST - импорт данных
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, data } = body;
    
    // Импорт БД
    if (action === 'import') {
      if (!data) {
        return NextResponse.json({ error: 'Нет данных для импорта' }, { status: 400 });
      }
      
      // Создаём бэкап перед импортом
      if (fs.existsSync(DB_FILE)) {
        const dbData = fs.readFileSync(DB_FILE, 'utf-8');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFile = path.join(BACKUP_DIR, `db-before-import-${timestamp}.json`);
        fs.writeFileSync(backupFile, dbData, 'utf-8');
      }
      
      // Записываем новые данные
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
      return NextResponse.json({ success: true });
    }
    
    // Восстановить из бэкапа
    if (action === 'restore') {
      const { backupPath } = body;
      if (!backupPath || !fs.existsSync(backupPath)) {
        return NextResponse.json({ error: 'Бэкап не найден' }, { status: 400 });
      }
      
      const backupData = fs.readFileSync(backupPath, 'utf-8');
      fs.writeFileSync(DB_FILE, backupData, 'utf-8');
      return NextResponse.json({ success: true });
    }
    
    // Очистить статистику
    if (action === 'clear-stat') {
      const emptyStat = { pages: {}, forms: {}, lastUpdated: new Date().toISOString() };
      fs.writeFileSync(STAT_FILE, JSON.stringify(emptyStat, null, 2), 'utf-8');
      return NextResponse.json({ success: true });
    }
    
    return NextResponse.json({ error: 'Неизвестное действие' }, { status: 400 });
  } catch (error) {
    console.error('Ошибка импорта:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}
