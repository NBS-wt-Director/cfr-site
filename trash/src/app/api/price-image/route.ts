import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const file = searchParams.get('file');

    if (!file) {
      return NextResponse.json({ error: 'Укажи ?file=...' }, { status: 400 });
    }

    // Защита от path traversal
    const safeFile = path.basename(file);
    const filePath = path.join(process.cwd(), 'public', safeFile);
    
    const buffer = await readFile(filePath);
    
    // Определяем Content-Type по расширению
    const ext = path.extname(safeFile).toLowerCase();
    const contentTypeMap: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
    };
    
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentTypeMap[ext] || 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Файл не найден' }, { status: 404 });
  }
}

