import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const data = getDb();
    
    // Собираем тренировки из всех программ
    const allWorkouts: any[] = [];
    const programs = data.programs || [];
    
    programs.forEach((program: any) => {
      if (program.workouts && Array.isArray(program.workouts)) {
        program.workouts.forEach((workout: any) => {
          allWorkouts.push({
            id: workout.id || Date.now() + Math.random(),
            day: workout.day,
            time: workout.time,
            programId: program.id,
            programName: program.name,
            params: workout.params || []
          });
        });
      }
    });
    
    // Также добавляем отдельные тренировки если есть
    const separateWorkouts = data.workouts || [];
    separateWorkouts.forEach((workout: any) => {
      allWorkouts.push({
        ...workout,
        programName: workout.programName || programs.find((p: any) => p.id === workout.programId)?.name || ''
      });
    });
    
    return NextResponse.json(allWorkouts);
  } catch (error) {
    console.error('API workouts error:', error);
    return NextResponse.json([]);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = getDb();
    
    // Создаём новую тренировку
    const newWorkout = {
      id: Date.now(),
      day: body.day || 'Понедельник',
      time: body.time || '10:00',
      programId: body.programId || null,
      programName: body.programName || '',
      params: body.params || [],
      createdAt: new Date().toISOString()
    };
    
    const workouts = data.workouts || [];
    workouts.push(newWorkout);
    
    data.workouts = workouts;
    
    // Сохраняем
    const { saveDb } = await import('@/lib/db');
    saveDb(data);
    
    return NextResponse.json(newWorkout);
  } catch (error) {
    console.error('API workouts POST error:', error);
    return NextResponse.json({ error: 'Ошибка создания тренировки' }, { status: 500 });
  }
}
