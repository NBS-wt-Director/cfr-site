import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const data = getDb();
    const staff = data.employees || [];  // ← Новое поле в БД
    return NextResponse.json(staff);
  } catch (error) {
    console.error('API staff error:', error);
    return NextResponse.json([]);
  }
}
