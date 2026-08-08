import { NextRequest, NextResponse } from 'next/server';

const ADMIN_API_KEY = process.env.ADMIN_API_KEY;

export function authenticateAdmin(req: NextRequest): any {
  if (!ADMIN_API_KEY) {
    console.error('ADMIN_API_KEY не установлен');
    return NextResponse.json({ error: 'Ошибка конфигурации сервера' }, { status: 500 });
  }
  const auth = req.headers.get('authorization');
  if (!auth || auth !== `Basic ${Buffer.from(ADMIN_API_KEY).toString('base64')}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return true;
}
