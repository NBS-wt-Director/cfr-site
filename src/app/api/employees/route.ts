import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    // Fallback на JSON — PG может быть недоступен
    const dbData = getDb();
    const employees = dbData?.employees || [];
    return NextResponse.json(employees);
  } catch (error) {
    console.error('API employees error:', error);
    return NextResponse.json([]);
  }
}
