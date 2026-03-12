import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

const pagesFilePath = path.join(process.cwd(), 'data', 'pages.json');

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const fileContent = fs.readFileSync(pagesFilePath, 'utf-8');
    const pages = JSON.parse(fileContent);
    const pagesArray = Array.isArray(pages) ? pages : (pages.pages || []);
    
    // Ищем страницу по slug
    const page = pagesArray.find((p: any) => p.slug === slug || p.slug === `/${slug}`);
    
    if (!page) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }
    
    return NextResponse.json(page);
  } catch (error) {
    console.error('Error reading page:', error);
    return NextResponse.json({ error: 'Failed to read page' }, { status: 500 });
  }
}
