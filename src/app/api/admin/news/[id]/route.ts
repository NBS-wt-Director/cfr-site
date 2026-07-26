import { NextRequest, NextResponse } from 'next/server';
import { getDb, saveDb } from '@/lib/db';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await req.json();
    const { id } = await params;
    const data = getDb();
    const newsId = parseInt(id);
    const index = data.news.findIndex((n: any) => n.id === newsId);
    
    if (index === -1) {
      return NextResponse.json({ error: 'News not found' }, { status: 404 });
    }
    
    data.news[index] = { ...data.news[index], ...body, date: new Date().toISOString() };
    saveDb(data);
    
    return NextResponse.json(data.news[index]);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update news' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const data = getDb();
    const newsId = parseInt(id);
    const newNews = data.news.filter((n: any) => n.id !== newsId);
    saveDb(data);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete news' }, { status: 500 });
  }
}