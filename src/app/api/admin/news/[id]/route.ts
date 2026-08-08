import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/postgres';
import { authenticateAdmin } from '@/lib/auth';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = authenticateAdmin(req);
  if (auth !== true) return auth;

  const contentType = req.headers.get('content-type');
  if (!contentType?.includes('application/json')) {
    return NextResponse.json({ error: 'Неверный Content-Type' }, { status: 415 });
  }

  try {
    const body = await req.json();
    const { id } = await params;
    const client = await pool.connect();
    try {
      const result = await client.query(
        `UPDATE cfr_media
         SET file_path = COALESCE($1, file_path),
             caption = COALESCE($2, caption)
         WHERE id = $3 AND entity_type = 'news'
         RETURNING id, file_path, caption, position, created_at`,
        [body.image, body.text || '', id]
      );

      if (result.rows.length === 0) {
        return NextResponse.json({ error: 'News not found' }, { status: 404 });
      }

      return NextResponse.json(result.rows[0]);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error updating news:', error);
    return NextResponse.json({ error: 'Failed to update news' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = authenticateAdmin(req);
  if (auth !== true) return auth;
  try {
    const { id } = await params;
    const client = await pool.connect();
    try {
      await client.query(
        "UPDATE cfr_media SET record_status = 'removed' WHERE id = $1 AND entity_type = 'news'",
        [id]
      );
      return NextResponse.json({ success: true });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error deleting news:', error);
    return NextResponse.json({ error: 'Failed to delete news' }, { status: 500 });
  }
}