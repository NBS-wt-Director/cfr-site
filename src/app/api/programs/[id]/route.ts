import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Пытаемся подключиться к PostgreSQL
    let pgResult = null;
    try {
      const pool = await import('@/lib/postgres').then(m => m.default);
      const client = await pool.connect();
      try {
        const result = await client.query(`
          SELECT e.id, e.name, e.entity_type, e.colour, e.max_capacity,
                 e.price_per_session, e.style_id, e.teacher_person_id,
                 s.name as style_name, s.client_name as style_client_name,
                 p.last_name, p.first_name
          FROM cfr_entities e
          LEFT JOIN cfr_styles s ON s.id = e.style_id
          LEFT JOIN cfr_persons p ON p.id = e.teacher_person_id
          WHERE e.id = $1 AND e.entity_type = 'group' AND e.record_status != 'removed'
          LIMIT 1
        `, [id]);

        if (result.rows.length > 0) {
          const e = result.rows[0];
          const scheduleResult = await client.query(`
            SELECT day_of_week, start_time, end_time, hall_id, notes
            FROM cfr_schedule_entries
            WHERE entity_id = $1 AND entity_type = 'group' AND record_status != 'removed'
            ORDER BY day_of_week, start_time
          `, [id]);

          const dayNames = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
          const schedule = scheduleResult.rows.map((s: any) => ({
            day: dayNames[s.day_of_week] || String(s.day_of_week),
            time: `${s.start_time?.toString?.() || ''} - ${s.end_time?.toString?.() || ''}`,
            hall_id: s.hall_id,
            notes: s.notes,
          }));

          const trainers = e.teacher_person_id ? [{
            id: e.teacher_person_id,
            name: [e.last_name, e.first_name].filter(Boolean).join(' ') || null,
            image: '',
            experience: '',
          }] : [];

          const photosResult = await client.query(
            'SELECT file_path, caption FROM cfr_media WHERE entity_type = \'group\' AND entity_id = $1 ORDER BY position',
            [id]
          );

          pgResult = {
            id: e.id,
            name: e.name || 'Без названия',
            type: e.style_client_name || e.style_name || 'Группа',
            description: e.name || '',
            image: '',
            gallery: photosResult.rows.map((p: any) => p.file_path),
            photoAlbum: photosResult.rows.map((p: any) => ({
              image: p.file_path,
              caption: p.caption || '',
            })),
            trainers,
            workouts: schedule,
            schedule,
            style_name: e.style_name,
            max_capacity: e.max_capacity,
            price_per_session: e.price_per_session?.toString?.() || '0',
          };
        }
      } finally {
        client.release();
      }
    } catch (pgErr) {
      // PG недоступен — переходим к JSON fallback
      console.warn('⚠️ PG недоступен, используем JSON fallback:', pgErr instanceof Error ? pgErr.message : pgErr);
    }

    // Если PG вернул результат — отдаём его
    if (pgResult) {
      return NextResponse.json(pgResult);
    }

    // JSON fallback — читаем из db.json
    const dbData = getDb();
    const programs = dbData?.programs || [];
    const program = programs.find((p: any) => String(p.id) === id);

    if (!program) {
      return NextResponse.json({
        id,
        isDemo: true,
        name: `Программа ${id}`,
        description: "Данные не заполнены. Скоро здесь появится реальная программа.",
        image: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800",
        gallery: null,
        trainers: null,
        workouts: null
      });
    }

    return NextResponse.json({
      id: program.id,
      name: program.name || 'Без названия',
      description: program.description || '',
      image: program.image || '',
      gallery: program.gallery || [],
      photoAlbum: program.photoAlbum || [],
      trainers: program.trainers || [],
      workouts: program.workouts || [],
    });
  } catch (error) {
    console.error('API программа error:', error);
    return NextResponse.json({
      id: 'unknown',
      isDemo: true,
      name: 'Ошибка загрузки',
      description: "Ошибка сервера.",
      image: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800",
      gallery: null,
      trainers: null,
      workouts: null
    }, { status: 500 });
  }
}
