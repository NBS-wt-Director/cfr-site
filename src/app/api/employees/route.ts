import { NextResponse } from 'next/server';
import { getAllEmployees } from '@/lib/db-new';

export async function GET() {
  try {
    const employees = await getAllEmployees();
    return NextResponse.json(employees);
  } catch (error) {
    console.error('API staff error:', error);
    return NextResponse.json([]);
  }
}
