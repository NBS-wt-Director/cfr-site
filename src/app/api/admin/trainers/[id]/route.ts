import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

const ADMIN_PASSWORD = 'цфр2026';

function authenticate(req: NextRequest): boolean {
  const auth = req.headers.get('authorization');
  if (!auth || auth !== `Basic ${Buffer.from(ADMIN_PASSWORD).toString('base64')}`) {
    return false;
  }
  return true;
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  if (!authenticate(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const data = await db.getData();
    const index = data.trainers.findIndex((t: any) => t.id === parseInt(params.id));
    
    if (index === -1) {
      return NextResponse.json({ error: 'Trainer not found' }, { status: 404 });
    }
    
    data.trainers[index] = { ...data.trainers[index], ...body };
    await db.updateTrainers(data.trainers);
    
    return NextResponse.json(data.trainers[index]);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update trainer' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!authenticate(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const data = await db.getData();
    const newTrainers = data.trainers.filter((t: any) => t.id !== parseInt(params.id));
    await db.updateTrainers(newTrainers);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete trainer' }, { status: 500 });
  }
}
