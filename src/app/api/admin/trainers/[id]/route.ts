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
      // Обновляем person
      const nameParts = (body.name || '').split(' ');
      await client.query(
        `UPDATE cfr_persons 
         SET last_name = COALESCE($1, last_name),
             first_name = COALESCE($2, first_name),
             middle_name = COALESCE($3, middle_name),
             mobile_phone = COALESCE($4, mobile_phone),
             avatar_url = COALESCE($5, avatar_url)
         WHERE id = $6`,
        [nameParts[0], nameParts[1], nameParts.slice(2).join('') || null,
         body.phone, body.image, id]
      );

      // Обновляем teacher
      await client.query(
        `UPDATE cfr_teachers 
         SET short_code = COALESCE($1, short_code),
             status = COALESCE($2, status),
             image = COALESCE($3, image),
             experience = COALESCE($4, experience),
             description = COALESCE($5, description),
             specialization = COALESCE($6, specialization),
             is_director = COALESCE($7, is_director),
             sort_order = COALESCE($8, sort_order)
         WHERE person_id = $9`,
        [body.short_code, body.status, body.image, body.experience,
         body.description, body.specialization, body.isDirector, body.sort_order, id]
      );

      const result = await client.query(
        'SELECT * FROM cfr_teachers WHERE person_id = $1',
        [id]
      );

      return NextResponse.json(result.rows[0]);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error updating trainer:', error);
    return NextResponse.json({ error: 'Failed to update trainer' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = authenticateAdmin(req);
  if (auth !== true) return auth;
  try {
    const { id } = await params;
    const client = await pool.connect();
    try {
      // Мягкое удаление — помечаем как removed
      await client.query(
        'UPDATE cfr_persons SET status = $1 WHERE id = $2',
        ['removed', id]
      );
      await client.query(
        'UPDATE cfr_teachers SET record_status = $1 WHERE person_id = $2',
        ['removed', id]
      );
      return NextResponse.json({ success: true });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error deleting trainer:', error);
    return NextResponse.json({ error: 'Failed to delete trainer' }, { status: 500 });
  }
}
