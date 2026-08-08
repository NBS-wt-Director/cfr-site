import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/postgres';
import { authenticateAdmin } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const auth = authenticateAdmin(req);
  if (auth !== true) return auth;

  try {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT id, file_path, caption, position, created_at
        FROM cfr_media
        WHERE entity_type = 'news' AND record_status != 'removed'
        ORDER BY position, created_at DESC
      `);
      return NextResponse.json(result.rows.map((n: any) => ({
        id: n.id,
        image: n.file_path,
        title: n.caption || '',
        text: '',
        date: n.created_at,
      })));
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error reading news:', error);
    return NextResponse.json([], { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = authenticateAdmin(req);
  if (auth !== true) return auth;

  const contentType = req.headers.get('content-type');
  if (!contentType?.includes('application/json')) {
    return NextResponse.json({ error: 'Неверный Content-Type' }, { status: 415 });
  }

  try {
    const body = await req.json();
    const client = await pool.connect();
    try {
      const result = await client.query(
        `INSERT INTO cfr_media (entity_type, file_path, caption, position, created_at)
         VALUES ('news', $1, $2, (SELECT COALESCE(MAX(position), -1) + 1 FROM cfr_media WHERE entity_type = 'news'), NOW())
         RETURNING id, file_path, caption, position, created_at`,
        [body.image || '', body.text || '']
      );

      return NextResponse.json({
        id: result.rows[0].id,
        image: result.rows[0].file_path,
        text: body.text,
        date: result.rows[0].created_at,
      }, { status: 201 });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error creating news:', error);
    return NextResponse.json({ error: 'Failed to create news' }, { status: 500 });
  }
}
