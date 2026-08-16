import { NextResponse } from 'next/server';
import { getTrainersDual } from '@/lib/dual-mode';

export async function GET() {
  try {
    // Двухрежимно: PG (если доступен) → JSON fallback
    const trainers = await getTrainersDual();
    return NextResponse.json(trainers);
  } catch (error) {
    console.error('Error reading trainers:', error);
    return NextResponse.json([]);
  }
}
