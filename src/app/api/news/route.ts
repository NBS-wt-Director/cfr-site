import { NextResponse } from 'next/server';
import { getAllNews } from '@/lib/db-new';

export async function GET() {
  try {
    const news = await getAllNews();
    return NextResponse.json(news);
  } catch (error) {
    console.error('Error reading news:', error);
    return NextResponse.json([]);
  }
}
