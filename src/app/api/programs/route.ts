import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    // Fallback на JSON — PG может быть недоступен
    const dbData = getDb();
    const programs = dbData?.programs || [];
    return NextResponse.json(programs);
  } catch (error) {
    console.error('API programs error:', error);
    return NextResponse.json([]);
  }
}
