import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/postgres';
import { authenticateAdmin } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const auth = authenticateAdmin(request);
  if (auth !== true) return auth;
  try {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT id, slug, title, content, media, enabled, sort_order, record_status
        FROM cfr_pages
        ORDER BY sort_order, id
      `);
      return NextResponse.json(result.rows);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error reading pages:', error);
    return NextResponse.json([]);
  }
}

export async function POST(request: NextRequest) {
  const auth = authenticateAdmin(request);
  if (auth !== true) return auth;

  const contentType = request.headers.get('content-type');
  if (!contentType?.includes('application/json')) {
    return NextResponse.json({ error: 'Неверный Content-Type' }, { status: 415 });
  }

  try {
    const page = await request.json();
    const client = await pool.connect();
    try {
      // Обновляем или создаём страницу
      const result = await client.query(
        `INSERT INTO cfr_pages (id, slug, title, content, media, enabled, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO UPDATE SET
           slug = EXCLUDED.slug, title = EXCLUDED.title,
           content = EXCLUDED.content, media = EXCLUDED.media,
           enabled = EXCLUDED.enabled, sort_order = EXCLUDED.sort_order
         RETURNING id, slug, title, content, media, enabled, sort_order`,
        [page.id, page.slug || page.id, page.title || '', page.content || '',
         page.media || '', page.enabled !== false, page.sort_order || 0]
      );
      return NextResponse.json({ success: true, page: result.rows[0] });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error saving page:', error);
    return NextResponse.json({ error: 'Failed to save page' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = authenticateAdmin(request);
  if (auth !== true) return auth;
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'ID обязателен' }, { status: 400 });
    }
    const client = await pool.connect();
    try {
      await client.query(
        'DELETE FROM cfr_pages WHERE id = $1',
        [id]
      );
      return NextResponse.json({ success: true });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error deleting page:', error);
    return NextResponse.json({ error: 'Failed to delete page' }, { status: 500 });
  }
}
