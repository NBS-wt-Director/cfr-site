import { NextResponse } from 'next/server';
import { getAllTrainers } from '@/lib/db-new';

export async function GET() {
  try {
    const trainers = await getAllTrainers();
    return NextResponse.json(trainers);
  } catch (error) {
    console.error('API trainers error:', error);
    return NextResponse.json([]);
  }
}
