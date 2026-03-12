import { NextRequest, NextResponse } from 'next/server';
import { getDb, saveDb } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = getDb();
    const workouts = data.workouts || [];
    const workout = workouts.find((w: any) => String(w.id) === id);
    
    if (!workout) {
      return NextResponse.json({ error: 'Тренировка не найдена' }, { status: 404 });
    }
    
    return NextResponse.json(workout);
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
    const data = getDb();
    const workouts = data.workouts || [];
    
    const index = workouts.findIndex((w: any) => String(w.id) === id);
    if (index === -1) {
      return NextResponse.json({ error: 'Тренировка не найдена' }, { status: 404 });
    }
    
    workouts[index] = {
      ...workouts[index],
      day: body.day ?? workouts[index].day,
      time: body.time ?? workouts[index].time,
      programId: body.programId ?? workouts[index].programId,
      programName: body.programName ?? workouts[index].programName,
      params: body.params ?? workouts[index].params,
      updatedAt: new Date().toISOString()
    };
    
    data.workouts = workouts;
    saveDb(data);
    
    return NextResponse.json(workouts[index]);
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
    const data = getDb();
    const workouts = data.workouts || [];
    
    const filtered = workouts.filter((w: any) => String(w.id) !== id);
    data.workouts = filtered;
    saveDb(data);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('API workout DELETE error:', error);
    return NextResponse.json({ error: 'Ошибка удаления' }, { status: 500 });
  }
}
