import { NextRequest, NextResponse } from 'next/server';
import { getDb, saveDb } from '@/lib/db';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await req.json();
    const { id } = await params;
    const data = getDb();
    const trainerId = parseInt(id);
    const index = data.trainers.findIndex((t: any) => t.id === trainerId);
    
    if (index === -1) {
      return NextResponse.json({ error: 'Trainer not found' }, { status: 404 });
    }
    
    data.trainers[index] = { ...data.trainers[index], ...body };
    saveDb(data);
    
    return NextResponse.json(data.trainers[index]);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update trainer' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const data = getDb();
    const trainerId = parseInt(id);
    const newTrainers = data.trainers.filter((t: any) => t.id !== trainerId);
    saveDb(data);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete trainer' }, { status: 500 });
  }
}
