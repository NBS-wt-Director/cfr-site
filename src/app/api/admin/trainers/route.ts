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

export async function GET(req: NextRequest) {
  if (!authenticate(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const data = await db.getData();
  return NextResponse.json(data.trainers);
}

export async function POST(req: NextRequest) {
  if (!authenticate(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const data = await db.getData();
    const newId = Math.max(...data.trainers.map((t: any) => t.id), 0) + 1;
    const newTrainer = { id: newId, name: body.name, image: body.image };
    
    data.trainers.push(newTrainer);
    await db.updateTrainers(data.trainers);
    
    return NextResponse.json(newTrainer, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create trainer' }, { status: 500 });
  }
}
