import { NextRequest, NextResponse } from 'next/server';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import path from 'path';
import { authenticateAdmin } from '@/lib/auth';

const footerFilePath = path.join(process.cwd(), 'data', 'footer.json');
const defaultFooter = {
  enabled: true,
  showContacts: true,
  showSocial: true,
  showCopyright: true,
  copyrightText: '© 2026 Шифу Панда. Екатеринбург. Все права защищены.',
  showDevInfo: false,
  links: []
};

async function getFooterDb() {
  const db = new Low<any>(new JSONFile(footerFilePath), defaultFooter);
  await db.read();
  return db;
}

export async function GET(request: NextRequest) {
  const auth = authenticateAdmin(request);
  if (auth !== true) return auth;
  try {
    const db = await getFooterDb();
    return NextResponse.json(db.data || defaultFooter);
  } catch (error) {
    console.error('Error reading footer:', error);
    return NextResponse.json(defaultFooter);
  }
}

export async function POST(request: NextRequest) {
  const auth = authenticateAdmin(request);
  if (auth !== true) return auth;

  const contentType = request.headers.get('content-type');
  if (!contentType?.includes('application/json')) {
    return NextResponse.json({ error: 'Неверный Content-Type' }, { status: 415 });
  }

  try {
    const db = await getFooterDb();
    const footerSettings = await request.json();
    
    db.data = footerSettings;
    await db.write();
    
    return NextResponse.json({ success: true, footer: footerSettings });
  } catch (error) {
    console.error('Error saving footer:', error);
    return NextResponse.json({ error: 'Failed to save footer' }, { status: 500 });
  }
}
