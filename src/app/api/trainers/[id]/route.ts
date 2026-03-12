import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const data = getDb();
    const trainers = data.trainers || [];
    
    // Ищем реального тренера
    const trainer = trainers.find((t: any) => String(t.id) === String(id));
    if (!trainer) {
      // ✅ Возвращаем демо-тренера
      console.warn(`⚠️ Тренер ${id} не найден, возвращаем демо`);
      
      return NextResponse.json({
        id: id,
        isDemo: true,
        name: `Тренер ${id}`,
        description: "Данные не заполнены. Скоро здесь появится реальный профиль тренера. Заполните в админке!",
        image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800",
        gallery: null,
        workouts: null
      });
    }

    return NextResponse.json(trainer);
  } catch (error) {
    console.error('API тренер error:', error);
    return NextResponse.json({
      id: 'unknown',
      isDemo: true,
      name: 'Демо-тренер',
      description: "Ошибка загрузки данных. Используется демо-режим.",
      image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800",
      gallery: null,
      workouts: null
    }, { status: 500 });
  }
}
