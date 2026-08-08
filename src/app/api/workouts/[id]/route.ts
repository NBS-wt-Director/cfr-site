import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/postgres';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT e.id as entity_id, e.name as entity_name,
               s.day_of_week, s.start_time, s.end_time,
               s.hall_id, s.notes, s.branch_id,
               sty.client_name as style_name
        FROM cfr_schedule_entries s
        JOIN cfr_entities e ON e.id = s.entity_id
        LEFT JOIN cfr_styles sty ON sty.id = e.style_id
        WHERE (e.id = $1 OR s.id::text = $1)
          AND s.record_status != 'removed'
        LIMIT 1
      `, [id]);

      if (result.rows.length === 0) {
        return NextResponse.json({ error: 'Тренировка не найдена' }, { status: 404 });
      }

      const s = result.rows[0];
      const dayNames = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];

      return NextResponse.json({
        id: s.id,
        day: dayNames[s.day_of_week] || String(s.day_of_week),
        time: `${s.start_time?.toString?.() || ''} - ${s.end_time?.toString?.() || ''}`,
        programId: s.entity_id,
        programName: s.entity_name || '',
        params: [],
        styleName: s.style_name || '',
        hall_id: s.hall_id,
        branch_id: s.branch_id,
        notes: s.notes,
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('API workout GET error:', error);
    return NextResponse.json({ error: 'Ошибка' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const client = await pool.connect();
    try {
      const dayNames: Record<string, number> = {
        'Понедельник': 1, 'Вторник': 2, 'Среда': 3, 'Четверг': 4,
        'Пятница': 5, 'Суббота': 6, 'Воскресенье': 0
      };

      const result = await client.query(
        `UPDATE cfr_schedule_entries
         SET day_of_week = COALESCE($1, day_of_week),
             start_time = COALESCE($2, start_time),
             notes = COALESCE($3, notes),
             updated_at = NOW()
         WHERE id = $4
         RETURNING id, entity_id, day_of_week, start_time, notes`,
        [dayNames[body.day], body.time, body.notes, id]
      );

      if (result.rows.length === 0) {
        return NextResponse.json({ error: 'Тренировка не найдена' }, { status: 404 });
      }

      return NextResponse.json(result.rows[0]);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('API workout PUT error:', error);
    return NextResponse.json({ error: 'Ошибка обновления' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const client = await pool.connect();
    try {
      await client.query(
        'DELETE FROM cfr_schedule_entries WHERE id = $1',
        [id]
      );
      return NextResponse.json({ success: true });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('API workout DELETE error:', error);
    return NextResponse.json({ error: 'Ошибка удаления' }, { status: 500 });
  }
}
