import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const STAT_FILE = path.join(process.cwd(), 'public', 'stat.json');

interface StatEntry {
  count: number;
  lastVisit: string;
}

interface Stats {
  pages: Record<string, StatEntry>;
  forms: Record<string, StatEntry>;
  lastUpdated: string;
}

// Чтение статистики
function getStats(): Stats {
  try {
    if (fs.existsSync(STAT_FILE)) {
      const data = fs.readFileSync(STAT_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Ошибка чтения stat.json:', e);
  }
  return { pages: {}, forms: {}, lastUpdated: new Date().toISOString() };
}

// Запись статистики
function saveStats(stats: Stats): void {
  stats.lastUpdated = new Date().toISOString();
  fs.writeFileSync(STAT_FILE, JSON.stringify(stats, null, 2), 'utf-8');
}

// GET - получить статистику
export async function GET() {
  const stats = getStats();
  return NextResponse.json(stats);
}

// POST - записать посещение страницы или отправку формы
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, page, formType } = body;
    
    console.log('📊 Stats received:', { type, page, formType });
    
    const stats = getStats();
    
    if (type === 'pageview' && page && typeof page === 'string' && page.length > 0) {
      // Нормализуем путь - убираем повторяющиеся слэши
      const normalizedPage = page.replace(/\/+/g, '/');
      
      // Увеличиваем счётчик просмотров страницы
      if (!stats.pages[normalizedPage]) {
        stats.pages[normalizedPage] = { count: 0, lastVisit: new Date().toISOString() };
      }
      stats.pages[normalizedPage].count += 1;
      stats.pages[normalizedPage].lastVisit = new Date().toISOString();
      console.log('📊 Page view recorded for:', normalizedPage);
    } else if (type === 'form' && formType) {
      // Увеличиваем счётчик отправок формы
      if (!stats.forms[formType]) {
        stats.forms[formType] = { count: 0, lastVisit: new Date().toISOString() };
      }
      stats.forms[formType].count += 1;
      stats.forms[formType].lastVisit = new Date().toISOString();
    }
    
    saveStats(stats);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Ошибка записи статистики:', error);
    return NextResponse.json({ error: 'Ошибка записи' }, { status: 500 });
  }
}
