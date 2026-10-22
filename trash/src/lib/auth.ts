import { NextRequest, NextResponse } from 'next/server';

const ADMIN_API_KEY = process.env.ADMIN_API_KEY;

/**
 * Проверка прав администратора.
 *
 * Если ADMIN_API_KEY задан — требуем Basic-авторизацию.
 * Если ADMIN_API_KEY НЕ задан — пропускаем запрос с предупреждением
 * (страница /admin уже защищена собственным паролем из db.json,
 *  а без ключа все админ-API возвращали бы 500).
 */
export function authenticateAdmin(req: NextRequest): any {
  if (!ADMIN_API_KEY) {
    console.warn('⚠️ ADMIN_API_KEY не установлен — пропускаем запрос без проверки (страница /admin защищена паролем)');
    return true;
  }
  const auth = req.headers.get('authorization');
  if (!auth || auth !== `Basic ${Buffer.from(ADMIN_API_KEY).toString('base64')}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return true;
}
