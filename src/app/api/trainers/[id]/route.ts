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
      // Ищем тренера по person_id или short_code
      const result = await client.query(`
        SELECT t.person_id, t.short_code, t.status, t.image, t.experience,
               t.description, t.specialization, t.is_director, t.sort_order,
               p.last_name, p.first_name, p.middle_name, p.mobile_phone, p.avatar_url
        FROM cfr_teachers t
        JOIN cfr_persons p ON p.id = t.person_id
        WHERE (t.person_id = $1 OR t.short_code = $1)
          AND p.status != 'removed' AND t.record_status != 'removed'
        LIMIT 1
      `, [id]);

      if (result.rows.length === 0) {
        // Демо-тренер
        return NextResponse.json({
          id,
          isDemo: true,
          name: `Тренер ${id}`,
          description: "Данные не заполнены. Скоро здесь появится реальный профиль тренера.",
          image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800",
          gallery: null,
          workouts: null
        });
      }

      const t = result.rows[0];
      const fullName = [t.last_name, t.first_name, t.middle_name].filter(Boolean).join(' ');

      // Фото
      const photosResult = await client.query(
        'SELECT file_path, caption, width, height FROM cfr_media WHERE entity_type = \'teacher\' AND entity_id = $1 ORDER BY position',
        [t.person_id]
      );

      // Стили
      const stylesResult = await client.query(
        'SELECT s.id, s.name, s.client_name FROM cfr_teacher_styles ts JOIN cfr_styles s ON s.id = ts.style_id WHERE ts.person_id = $1',
        [t.person_id]
      );

      return NextResponse.json({
        id: t.person_id,
        name: fullName || t.first_name || 'Без имени',
        short_code: t.short_code,
        experience: t.experience || '',
        description: t.description || '',
        specialization: t.specialization || '',
        isDirector: t.is_director || false,
        phone: t.mobile_phone || '',
        image: t.avatar_url || t.image || '',
        gallery: photosResult.rows.map((p: any) => p.file_path),
        photoAlbum: photosResult.rows.map((p: any) => ({
          image: p.file_path,
          caption: p.caption || '',
          width: p.width,
          height: p.height,
        })),
        styles: stylesResult.rows.map((s: any) => s.client_name || s.name),
        workouts: null,
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('API тренер error:', error);
    return NextResponse.json({
      id: 'unknown',
      isDemo: true,
      name: 'Демо-тренер',
      description: "Ошибка загрузки данных.",
      image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800",
      gallery: null,
      workouts: null
    }, { status: 500 });
  }
}
