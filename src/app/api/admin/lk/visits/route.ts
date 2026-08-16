/**
 * API: Посещения ЛК (админка)
 * GET  /api/admin/lk/visits — все посещения
 * POST /api/admin/lk/visits — записать посещение (или массив)
 * POST /api/admin/lk/visits/import — импорт из CSV/JSON
 */

import { NextRequest, NextResponse } from 'next/server';
import { createVisit, createVisitBulk, getAllVisits, getUserVisits } from '@/lib/postgres';
import { authenticateAdmin } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const auth = authenticateAdmin(request);
  if (auth !== true) return auth;
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (userId) {
      const visits = await getUserVisits(parseInt(userId));
      return NextResponse.json(visits);
    }

    const visits = await getAllVisits();
    return NextResponse.json(visits);
  } catch (error) {
    console.error('❌ Ошибка получения посещений:', error);
    return NextResponse.json([]);
  }
}

export async function POST(request: NextRequest) {
  const auth = authenticateAdmin(request);
  if (auth !== true) return auth;

  const contentType = request.headers.get('content-type');
  if (!contentType?.includes('application/json')) {
    return NextResponse.json({ error: 'Неверный Content-Type' }, { status: 415 });
  }

  try {
    const body = await request.json();
    const { userId, programId, visitDate, visits } = body;

    // Массовая запись
    if (visits && Array.isArray(visits)) {
      const count = await createVisitBulk(
        visits.map((v: any) => ({
          userId: v.userId,
          programId: v.programId || null,
          visitDate: v.visitDate || new Date().toISOString(),
        }))
      );
      return NextResponse.json({ success: true, count });
    }

    // Одиночная запись
    if (!userId) {
      return NextResponse.json({ error: 'userId обязателен' }, { status: 400 });
    }

    const visit = await createVisit(
      userId,
      programId || null,
      visitDate || new Date().toISOString()
    );

    return NextResponse.json({ success: true, visit }, { status: 201 });
  } catch (error) {
    console.error('❌ Ошибка записи посещения:', error);
    return NextResponse.json({ error: 'PostgreSQL недоступен. Запустите Docker: docker compose up -d' }, { status: 503 });
  }
}