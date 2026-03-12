import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

const pagesFilePath = path.join(process.cwd(), 'data', 'pages.json');

// Читаем файл
function readPages() {
  try {
    const content = fs.readFileSync(pagesFilePath, 'utf-8');
    const data = JSON.parse(content);
    return Array.isArray(data) ? data : (data.pages || []);
  } catch {
    return [];
  }
}

// Записываем файл
function writePages(pages: any[]) {
  fs.writeFileSync(pagesFilePath, JSON.stringify(pages, null, 2), 'utf-8');
}

export async function GET() {
  try {
    const pages = readPages();
    return NextResponse.json(pages);
  } catch (error) {
    console.error('Error reading pages:', error);
    return NextResponse.json([]);
  }
}

export async function POST(request: Request) {
  try {
    const pages = readPages();
    const page = await request.json();
    
    // Добавить или обновить страницу
    const existingIndex = pages.findIndex((p: any) => p.id === page.id);
    if (existingIndex >= 0) {
      pages[existingIndex] = page;
    } else {
      page.id = page.id || Date.now().toString();
      pages.push(page);
    }
    
    writePages(pages);
    return NextResponse.json({ success: true, page });
  } catch (error) {
    console.error('Error saving page:', error);
    return NextResponse.json({ error: 'Failed to save page' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const pages = readPages();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    const filteredPages = pages.filter((p: any) => p.id !== id);
    writePages(filteredPages);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting page:', error);
    return NextResponse.json({ error: 'Failed to delete page' }, { status: 500 });
  }
}
