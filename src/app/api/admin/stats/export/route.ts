import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/postgres';
import { authenticateAdmin } from '@/lib/auth';

// GET - получить статистику из PG
async function getStats() {
  try {
    const client = await pool.connect();
    try {
      const pageViews = await client.query(`
        SELECT page, COUNT(*) as count, MAX(viewed_at) as last_viewed
        FROM cfr_page_views GROUP BY page ORDER BY count DESC
      `);
      const forms = await client.query(`
        SELECT form_type, COUNT(*) as count, MAX(submitted_at) as last_submitted
        FROM cfr_form_submissions GROUP BY form_type ORDER BY count DESC
      `);
      return {
        pages: pageViews.rows.reduce((acc: any, p: any) => {
          acc[p.page] = { count: parseInt(p.count), lastVisit: p.last_viewed };
          return acc;
        }, {}),
        forms: forms.rows.reduce((acc: any, f: any) => {
          acc[f.form_type] = { count: parseInt(f.count), lastVisit: f.last_submitted };
          return acc;
        }, {}),
        lastUpdated: new Date().toISOString(),
      };
    } finally {
      client.release();
    }
  } catch {
    return { pages: {}, forms: {}, lastUpdated: new Date().toISOString() };
  }
}

// Формирование текстового отчёта
function generateReport(stats: any): string {
  const lines: string[] = [
    '════════════════════════════════════════════════════════════',
    '           ОТЧЁТ ПО СТАТИСТИКЕ САЙТА',
    '════════════════════════════════════════════════════════════',
    '',
    `Дата формирования: ${new Date().toLocaleString('ru-RU')}`,
    `Последнее обновление: ${new Date(stats.lastUpdated).toLocaleString('ru-RU')}`,
    '',
    '────────────────────────────────────────────────────────────',
    '                    ПРОСМОТРЫ СТРАНИЦ',
    '────────────────────────────────────────────────────────────',
    ''
  ];

  const pages = Object.entries(stats.pages || {})
    .sort((a: any, b: any) => b[1].count - a[1].count);

  if (pages.length === 0) {
    lines.push('Нет данных о просмотрах');
  } else {
    pages.forEach(([page, entry]: [string, any]) => {
      lines.push(`${entry.count.toString().padStart(5)} просмотров  —  ${page}`);
    });
  }

  lines.push('');
  lines.push('────────────────────────────────────────────────────────────');
  lines.push('                    ОТПРАВЛЕННЫЕ ФОРМЫ');
  lines.push('────────────────────────────────────────────────────────────');
  lines.push('');

  const forms = Object.entries(stats.forms || {})
    .sort((a: any, b: any) => b[1].count - a[1].count);

  if (forms.length === 0) {
    lines.push('Нет данных о формах');
  } else {
    forms.forEach(([formType, entry]: [string, any]) => {
      lines.push(`${entry.count.toString().padStart(5)} отправок  —  ${formType}`);
    });
  }

  lines.push('');
  lines.push('════════════════════════════════════════════════════════════');

  return lines.join('\r\n');
}

// POST - экспорт отчёта или отправка на email
export async function POST(request: NextRequest) {
  const auth = authenticateAdmin(request);
  if (auth !== true) return auth;
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  const stats = await getStats();

  // Экспорт в TXT
  if (action === 'export-txt') {
    const report = generateReport(stats);
    return new NextResponse(report, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="stat-report-${new Date().toISOString().split('T')[0]}.txt"`
      }
    });
  }

  // Экспорт в HTML
  if (action === 'export-html') {
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Статистика сайта</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; }
    h1 { color: #333; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f5f5f5; }
    .count { background: #3b82f6; color: white; padding: 2px 10px; border-radius: 10px; }
    .section { margin: 30px 0; }
  </style>
</head>
<body>
  <h1>📊 Отчёт по статистике сайта</h1>
  <p>Дата: ${new Date().toLocaleString('ru-RU')}</p>
  
  <div class="section">
    <h2>👁️ Просмотры страниц</h2>
    <table>
      <tr><th>Страница</th><th>Просмотров</th></tr>
      ${Object.entries(stats.pages || {})
        .sort((a: any, b: any) => b[1].count - a[1].count)
        .map(([page, entry]: [string, any]) => 
          `<tr><td>${page}</td><td><span class="count">${entry.count}</span></td></tr>`
        ).join('')}
    </table>
  </div>
  
  <div class="section">
    <h2>📝 Отправленные формы</h2>
    <table>
      <tr><th>Тип формы</th><th>Отправок</th></tr>
      ${Object.entries(stats.forms || {})
        .sort((a: any, b: any) => b[1].count - a[1].count)
        .map(([formType, entry]: [string, any]) => 
          `<tr><td>${formType}</td><td><span class="count">${entry.count}</span></td></tr>`
        ).join('')}
    </table>
  </div>
</body>
</html>`;

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="stat-report-${new Date().toISOString().split('T')[0]}.html"`
      }
    });
  }

  // Отправка на email
  if (action === 'send-email') {
    const report = generateReport(stats);
    console.log('Отчёт для отправки на email:\n', report);
    return NextResponse.json({ success: true, message: 'Отчёт сформирован' });
  }

  return NextResponse.json({ error: 'Неизвестное действие' }, { status: 400 });
}
