import { NextRequest, NextResponse } from 'next/server';
import { getTrainerByIdDual } from '@/lib/dual-mode';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Двухрежимно: PG (если доступен) → JSON fallback
    const trainer = await getTrainerByIdDual(id);

    if (!trainer) {
      // Демо-тренер если не найден
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

    return NextResponse.json({
      id: trainer.id,
      name: trainer.name || 'Без имени',
      short_code: trainer.short_code || '',
      experience: trainer.experience || '',
      description: trainer.description || '',
      specialization: trainer.specialization || '',
      isDirector: trainer.isDirector || false,
      phone: trainer.phone || '',
      image: trainer.image || '',
      gallery: [],
      photoAlbum: trainer.photoAlbum || [],
      styles: trainer.styles || [],
      workouts: null,
    });
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
