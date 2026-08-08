import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/postgres';
import { authenticateAdmin } from '@/lib/auth';

// GET - получить статистику
export async function GET(request: NextRequest) {
  const auth = authenticateAdmin(request);
  if (auth !== true) return auth;
  try {
    const client = await pool.connect();
    try {
      // Просмотры страниц
      const pageViews = await client.query(`
        SELECT page, COUNT(*) as count, MAX(viewed_at) as last_viewed
        FROM cfr_page_views
        GROUP BY page
        ORDER BY count DESC
      `).catch(() => ({ rows: [] }));

      // Отправки форм
      const forms = await client.query(`
        SELECT form_type, COUNT(*) as count, MAX(submitted_at) as last_submitted
        FROM cfr_form_submissions
        GROUP BY form_type
        ORDER BY count DESC
      `).catch(() => ({ rows: [] }));

      return NextResponse.json({
        pages: pageViews.rows.map((p: any) => ({ [p.page]: { count: parseInt(p.count), lastVisit: p.last_viewed } })),
        forms: forms.rows.map((f: any) => ({ [f.form_type]: { count: parseInt(f.count), lastVisit: f.last_submitted } })),
        lastUpdated: new Date().toISOString(),
      });
    } finally {
      client.release();
    }
  } catch (e) {
    console.error('Ошибка чтения stat.json:', e);
    return NextResponse.json({ pages: {}, forms: {}, lastUpdated: new Date().toISOString() });
  }
}

// POST - записать посещение страницы или отправку формы
export async function POST(request: NextRequest) {
  const auth = authenticateAdmin(request);
  if (auth !== true) return auth;

  const contentType = request.headers.get('content-type');
  if (!contentType?.includes('application/json')) {
    return NextResponse.json({ error: 'Неверный Content-Type' }, { status: 415 });
  }

  try {
    const body = await request.json();
    const { type, page, formType } = body;
    
    const client = await pool.connect();
    try {
      if (type === 'pageview' && page && typeof page === 'string' && page.length > 0) {
        const normalizedPage = page.replace(/\/+/g, '/');
        await client.query(
          'INSERT INTO cfr_page_views (page, viewed_at) VALUES ($1, NOW())',
          [normalizedPage]
        );
      } else if (type === 'form' && formType) {
        await client.query(
          'INSERT INTO cfr_form_submissions (form_type, submitted_at) VALUES ($1, NOW())',
          [formType]
        );
      }
      
      return NextResponse.json({ success: true });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Ошибка записи статистики:', error);
    return NextResponse.json({ error: 'Ошибка записи' }, { status: 500 });
  }
}
