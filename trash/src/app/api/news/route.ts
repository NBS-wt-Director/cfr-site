import { NextResponse } from 'next/server';
import { getNewsDual } from '@/lib/dual-mode';

export async function GET() {
  try {
    // Двухрежимно: PG (если доступен) → JSON fallback
    const news = await getNewsDual();
    return NextResponse.json(news);
  } catch (error) {
    console.error('Error reading news:', error);
    return NextResponse.json([]);
  }
}
