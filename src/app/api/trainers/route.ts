import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    // Fallback на JSON — PG может быть недоступен
    const dbData = getDb();
    const trainers = dbData?.trainers || [];
    return NextResponse.json(trainers);
  } catch (error) {
    console.error('Error reading trainers:', error);
    return NextResponse.json([]);
  }
}
