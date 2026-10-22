import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/postgres';
import { authenticateAdmin } from '@/lib/auth';
import { getDbMode, getDb, saveDb } from '@/lib/db';

// Чтение тренеров из JSON (db.json) в админ-формате
function getTrainersFromJson() {
  const dbData = getDb();
  return (dbData?.trainers || []).map((t: any) => ({
    id: t.id,
    name: t.name || 'Без имени',
    short_code: t.short_code || '',
    experience: t.experience || '',
    type: t.type || t.specialization || 'trainer',
    description: t.description || '',
    specialization: t.specialization || '',
    isDirector: t.isDirector || false,
    phone: t.phone || '',
    image: t.image || '',
    status: t.status || 'active',
  }));
}

export async function GET(req: NextRequest) {
  const auth = authenticateAdmin(req);
  if (auth !== true) return auth;

  // JSON-режим — читаем db.json напрямую
  if (getDbMode() !== 'postgres') {
    return NextResponse.json(getTrainersFromJson());
  }

  // PG-режим — пробуем PG, при ошибке fallback на JSON
  try {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT t.person_id, t.short_code, t.status, t.image, t.experience,
               t.description, t.specialization, t.is_director, t.sort_order,
               p.last_name, p.first_name, p.middle_name, p.mobile_phone
        FROM cfr_teachers t
        JOIN cfr_persons p ON p.id = t.person_id
        WHERE p.status != 'removed' AND t.record_status != 'removed'
        ORDER BY t.sort_order, p.last_name
      `);

      const fullName = (row: any) => [row.last_name, row.first_name, row.middle_name].filter(Boolean).join(' ');

      return NextResponse.json(result.rows.map((t: any) => ({
        id: t.person_id,
        name: fullName(t),
        short_code: t.short_code,
        experience: t.experience,
        type: t.specialization || 'trainer',
        description: t.description,
        specialization: t.specialization,
        isDirector: t.is_director,
        phone: t.mobile_phone,
        image: t.image || '',
        status: t.status,
      })));
    } finally {
      client.release();
    }
  } catch (error) {
    console.warn('⚠️ PG недоступен, fallback на JSON (admin trainers GET):', error);
    return NextResponse.json(getTrainersFromJson());
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
      const trainer = {
        id: Date.now(),
        name: body.name || 'Без имени',
        short_code: body.short_code || '',
        experience: body.experience || '',
        specialization: body.specialization || '',
        isDirector: body.isDirector || false,
        phone: body.phone || '',
        image: body.image || '',
      };
      saveDb({ ...dbData, trainers: [...(dbData?.trainers || []), trainer] });
      return NextResponse.json({ id: trainer.id, success: true }, { status: 201 });
    }

    // PG-режим — пробуем PG, при ошибке fallback на JSON
    try {
      const client = await pool.connect();
      try {
        // Создаём person
        const nameParts = (body.name || '').split(' ');
        const personResult = await client.query(
          `INSERT INTO cfr_persons (last_name, first_name, middle_name, mobile_phone, avatar_url)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id`,
          [nameParts[0] || '', nameParts[1] || '', nameParts.slice(2).join('') || '',
           body.phone || null, body.image || null]
        );

        const personId = personResult.rows[0].id;

        // Создаём teacher
        await client.query(
          `INSERT INTO cfr_teachers (person_id, short_code, status, image, experience,
                                     description, specialization, is_director, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [personId, body.short_code || null, 'active', body.image || null,
           body.experience || null, body.description || null, body.specialization || null,
           body.isDirector || false, body.id || 0]
        );

        return NextResponse.json({ id: personId, success: true }, { status: 201 });
      } finally {
        client.release();
      }
    } catch (error) {
      console.warn('⚠️ PG недоступен, fallback на JSON (admin trainers POST):', error);
      const dbData = getDb();
      const trainer = {
        id: Date.now(),
        name: body.name || 'Без имени',
        short_code: body.short_code || '',
        experience: body.experience || '',
        specialization: body.specialization || '',
        isDirector: body.isDirector || false,
        phone: body.phone || '',
        image: body.image || '',
      };
      saveDb({ ...dbData, trainers: [...(dbData?.trainers || []), trainer] });
      return NextResponse.json({ id: trainer.id, success: true }, { status: 201 });
    }
  } catch (error) {
    console.error('Error creating trainer:', error);
    return NextResponse.json({ error: 'Failed to create trainer' }, { status: 500 });
  }
}
