import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { authenticateAdmin } from '@/lib/auth';

/**
 * POST /api/admin/data/test-connection
 * Тест подключения к PostgreSQL с параметрами из body
 */
export async function POST(request: NextRequest) {
  const auth = authenticateAdmin(request);
  if (auth !== true) return auth;

  try {
    const body = await request.json();
    const { host, port, database, user, password } = body;

    if (!host || !database || !user || !password) {
      return NextResponse.json(
        { error: 'Необходимы все параметры подключения' },
        { status: 400 }
      );
    }

    const startTime = Date.now();
    
    const testPool = new Pool({
      host,
      port: parseInt(port, 10),
      database,
      user,
      password,
      connectionTimeoutMillis: 5000,
    });

    try {
      await testPool.query('SELECT 1');
      
      return NextResponse.json({
        success: true,
        connectionTime: Date.now() - startTime,
        message: 'Подключение успешно',
      });
    } finally {
      await testPool.end();
    }
  } catch (error) {
    console.error('❌ Ошибка теста подключения:', error);
    return NextResponse.json(
      { 
        error: 'Ошибка подключения',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
