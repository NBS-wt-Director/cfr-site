import { NextRequest, NextResponse } from 'next/server';
import { loadAllDual, saveAllDual } from '@/lib/dual-mode';

export async function GET() {
  try {
    // Двухрежимно: PG (если доступен) → JSON fallback
    const data = await loadAllDual();
    return NextResponse.json(data);
  } catch (error) {
    console.error('API db error:', error);
    return NextResponse.json({ sliders: [], trainers: [], news: [], contacts: {} });
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    // Двухрежимно: PG (если доступен) → JSON fallback
    const success = await saveAllDual(data);
    return NextResponse.json({ success });
  } catch (error) {
    return NextResponse.json({ success: false });
  }
}
