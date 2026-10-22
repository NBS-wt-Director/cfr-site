import { NextResponse } from 'next/server';
import { getEmployeesDual } from '@/lib/dual-mode';

export async function GET() {
  try {
    // Двухрежимно: PG (если доступен) → JSON fallback
    const employees = await getEmployeesDual();
    return NextResponse.json(employees);
  } catch (error) {
    console.error('API employees error:', error);
    return NextResponse.json([]);
  }
}
