import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const data = getDb();
    const programs = data.programs || [];
    return NextResponse.json(programs);
  } catch (error) {
    console.error('API программы error:', error);
    return NextResponse.json([]);
  }
}