import { NextResponse } from 'next/server';
import { getAllPages } from '@/lib/db-new';

export async function GET() {
  try {
    const pages = await getAllPages();
    return NextResponse.json(pages);
  } catch (error) {
    console.error('Error reading pages:', error);
    return NextResponse.json([]);
  }
}
