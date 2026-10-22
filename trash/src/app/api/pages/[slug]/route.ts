import { NextResponse } from 'next/server';
import { getPageBySlug } from '@/lib/db-new';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const page = await getPageBySlug(slug);
    
    if (!page) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }
    
    return NextResponse.json(page);
  } catch (error) {
    console.error('Error reading page:', error);
    return NextResponse.json({ error: 'Failed to read page' }, { status: 500 });
  }
}
