import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/postgres';

export async function GET() {
  try {
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
        WHERE s.record_status != 'removed' AND e.entity_type = 'group'
        ORDER BY s.day_of_week, s.start_time
      `);

      const dayNames = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];

      return NextResponse.json(result.rows.map((s: any) => ({
        id: `${s.entity_id}-${s.day_of_week}`,
        day: dayNames[s.day_of_week] || String(s.day_of_week),
        time: `${s.start_time?.toString?.() || ''} - ${s.end_time?.toString?.() || ''}`,
        programId: s.entity_id,
        programName: s.entity_name || '',
        params: [],
        styleName: s.style_name || '',
        hall_id: s.hall_id,
        branch_id: s.branch_id,
      })));
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('API workouts GET error:', error);
    return NextResponse.json([], { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const client = await pool.connect();
    try {
      // Создаём запись расписания
      const dayNames: Record<string, number> = {
        'Понедельник': 1, 'Вторник': 2, 'Среда': 3, 'Четверг': 4,
        'Пятница': 5, 'Суббота': 6, 'Воскресенье': 0
      };
      
      const result = await client.query(
        `INSERT INTO cfr_schedule_entries (entity_id, entity_type, day_of_week, start_time, notes)
         VALUES ($1, 'group', $2, $3, $4)
         RETURNING id, entity_id, day_of_week, start_time, notes`,
        [body.programId || null, dayNames[body.day] || 1, body.time || null, body.notes || null]
      );

      return NextResponse.json(result.rows[0], { status: 201 });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('API workouts POST error:', error);
    return NextResponse.json({ error: 'Ошибка создания' }, { status: 500 });
  }
}
