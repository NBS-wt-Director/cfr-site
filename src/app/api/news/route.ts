import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    // Fallback на JSON — PG может быть недоступен
    const dbData = getDb();
    const news = dbData?.news || [];
    return NextResponse.json(news);
  } catch (error) {
    console.error('Error reading news:', error);
    return NextResponse.json([]);
  }
}
