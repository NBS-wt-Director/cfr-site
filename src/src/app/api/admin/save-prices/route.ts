import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const priceFiles = formData.getAll('priceFiles') as File[];
    
    const publicDir = path.join(process.cwd(), 'public');
    const price1Path = path.join(publicDir, 'цены1.jpg');

    // ✅ ЗАМЕНА цены1.jpg
    for (const file of priceFiles) {
      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(price1Path, buffer, 'binary');
    }

    return NextResponse.json({ 
      success: true, 
      files: ['/цены1.jpg'] 
    });
  } catch (error) {
    return NextResponse.json({ error: 'Ошибка сохранения цен' }, { status: 500 });
  }
}
