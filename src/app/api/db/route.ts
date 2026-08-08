import { NextRequest, NextResponse } from 'next/server';
import { getDbAsync, saveDbAsync } from '@/lib/db';

export async function GET() {
  try {
    const data = await getDbAsync();
    return NextResponse.json(data);
  } catch (error) {
    console.error('API db error:', error);
    return NextResponse.json({ sliders: [], trainers: [], news: [], contacts: {} });
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const success = await saveDbAsync(data);
    return NextResponse.json({ success });
  } catch (error) {
    return NextResponse.json({ success: false });
  }
}
