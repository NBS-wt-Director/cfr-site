import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/postgres';
import { authenticateAdmin } from '@/lib/auth';
import { getDbMode, getDb, saveDb } from '@/lib/db';

// Чтение новостей из JSON (db.json)
function getNewsFromJson() {
  const dbData = getDb();
  return (dbData?.news || []).map((n: any) => ({
    id: n.id,
    image: n.image || '',
    title: n.title || n.caption || '',
    text: n.text || '',
    date: n.date || n.created_at || null,
  }));
}

// Чтение новостей из PG (cfr_media)
async function getNewsFromPg() {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT id, file_path, caption, position, created_at
      FROM cfr_media
      WHERE entity_type = 'news' AND record_status != 'removed'
      ORDER BY position, created_at DESC
    `);
    return result.rows.map((n: any) => ({
      id: n.id,
      image: n.file_path,
      title: n.caption || '',
      text: '',
      date: n.created_at,
    }));
  } finally {
    client.release();
  }
}

export async function GET(req: NextRequest) {
  const auth = authenticateAdmin(req);
  if (auth !== true) return auth;

  // JSON-режим — читаем db.json напрямую
  if (getDbMode() !== 'postgres') {
    return NextResponse.json(getNewsFromJson());
  }

  // PG-режим — пробуем PG, при ошибке fallback на JSON
  try {
    return NextResponse.json(await getNewsFromPg());
  } catch (error) {
    console.warn('⚠️ PG недоступен, fallback на JSON (admin news GET):', error);
    return NextResponse.json(getNewsFromJson());
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

    // JSON-режим — пишем в db.json
    if (getDbMode() !== 'postgres') {
      const dbData = getDb();
      const newsItem = {
        id: Date.now(),
        image: body.image || '',
        title: body.text || '',
        text: body.text || '',
      };
      saveDb({ ...dbData, news: [newsItem, ...(dbData?.news || [])] });
      return NextResponse.json({ id: newsItem.id, image: newsItem.image, text: body.text }, { status: 201 });
    }

    // PG-режим — пробуем PG, при ошибке fallback на JSON
    try {
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
      console.warn('⚠️ PG недоступен, fallback на JSON (admin news POST):', error);
      const dbData = getDb();
      const newsItem = {
        id: Date.now(),
        image: body.image || '',
        title: body.text || '',
        text: body.text || '',
      };
      saveDb({ ...dbData, news: [newsItem, ...(dbData?.news || [])] });
      return NextResponse.json({ id: newsItem.id, image: newsItem.image, text: body.text }, { status: 201 });
    }
  } catch (error) {
    console.error('Error creating news:', error);
    return NextResponse.json({ error: 'Failed to create news' }, { status: 500 });
  }
}
