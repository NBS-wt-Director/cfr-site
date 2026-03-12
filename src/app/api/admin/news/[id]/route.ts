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

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  if (!authenticate(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const data = await db.getData();
    const index = data.news.findIndex((n: any) => n.id === parseInt(params.id));
    
    if (index === -1) {
      return NextResponse.json({ error: 'News not found' }, { status: 404 });
    }
    
    data.news[index] = { ...data.news[index], ...body, date: new Date().toISOString() };
    await db.updateNews(data.news);
    
    return NextResponse.json(data.news[index]);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update news' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!authenticate(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const data = await db.getData();
    const newNews = data.news.filter((n: any) => n.id !== parseInt(params.id));
    await db.updateNews(newNews);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete news' }, { status: 500 });
  }
}