import { NextResponse } from 'next/server';
import { getProgramsDual } from '@/lib/dual-mode';

export async function GET() {
  try {
    // Двухрежимно: PG (если доступен) → JSON fallback
    const programs = await getProgramsDual();
    return NextResponse.json(programs);
  } catch (error) {
    console.error('API programs error:', error);
    return NextResponse.json([]);
  }
}
