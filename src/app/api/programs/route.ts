import { NextResponse } from 'next/server';
import { getAllPrograms } from '@/lib/db-new';

export async function GET() {
  try {
    const programs = await getAllPrograms();
    return NextResponse.json(programs);
  } catch (error) {
    console.error('API программы error:', error);
    return NextResponse.json([]);
  }
}