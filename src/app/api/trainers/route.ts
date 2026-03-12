import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const data = getDb();
    const trainers = data.trainers || [];
    return NextResponse.json(trainers);
  } catch (error) {
    console.error('API trainers error:', error);
    return NextResponse.json([]);
  }
}
