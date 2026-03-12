import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

const ADMIN_PASSWORD = 'цфр2026';

function authenticate(req: NextRequest): boolean {
  const auth = req.headers.get('authorization');
  if (!auth || auth !== `Basic ${Buffer.from(ADMIN_PASSWORD).toString('base64')}`) {
    return false;
  }
  return true;
}

export async function GET(req: NextRequest) {
  if (!authenticate(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const data = await db.getData();
  return NextResponse.json(data.news);
}

export async function POST(req: NextRequest) {
  if (!authenticate(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const data = await db.getData();
    const newId = Math.max(...data.news.map((n: any) => n.id), 0) + 1;
    const newNews = { 
      id: newId, 
      image: body.image, 
      text: body.text, 
      date: new Date().toISOString() 
    };
    
    data.news.push(newNews);
    await db.updateNews(data.news);
    
    return NextResponse.json(newNews, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create news' }, { status: 500 });
  }
}
