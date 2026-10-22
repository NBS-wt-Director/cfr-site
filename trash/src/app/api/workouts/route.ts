import { NextRequest, NextResponse } from 'next/server';
import { getAllWorkouts } from '@/lib/db-new';
import { getDataDual } from '@/lib/dual-mode';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    // Двухрежимно: PG (если доступен) → JSON fallback из db.json (programs[].workouts)
    const workouts = await getDataDual(
      getAllWorkouts,
      () => {
        const dbData = getDb();
        const list: any[] = [];
        const dayNames = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
        for (const p of dbData?.programs || []) {
          for (const w of p.workouts || []) {
            const dayIdx = dayNames.findIndex(d => d === w.day);
            list.push({
              id: `${p.id}-${dayIdx >= 0 ? dayIdx : w.day}`,
              day: w.day,
              time: w.time,
              programId: p.id,
              programName: p.name || '',
              params: w.params || [],
              styleName: p.type || '',
              hall_id: null,
              branch_id: null,
            });
          }
        }
        return list;
      },
    );
    return NextResponse.json(workouts);
  } catch (error) {
    console.error('API workouts GET error:', error);
    return NextResponse.json([], { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const client = await (await import('@/lib/postgres')).default.connect();
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
