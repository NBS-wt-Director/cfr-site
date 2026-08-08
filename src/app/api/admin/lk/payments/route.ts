/**
 * API: Оплаты ЛК (админка + импорт из CRM)
 * GET  /api/admin/lk/payments — все оплаты (или по userId)
 * POST /api/admin/lk/payments — записать оплату
 * POST /api/admin/lk/payments/import — импорт из JSON/CSV
 */

import { NextRequest, NextResponse } from 'next/server';
import { createPayment, getAllPayments, getPaymentsForUser, importPaymentsFromCrm } from '@/lib/postgres';
import { authenticateAdmin } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const auth = authenticateAdmin(request);
  if (auth !== true) return auth;
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (userId) {
      const payments = await getPaymentsForUser(parseInt(userId));
      return NextResponse.json(payments);
    }

    const payments = await getAllPayments();
    return NextResponse.json(payments);
  } catch (error) {
    console.error('❌ Ошибка получения оплат:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
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
    const body = await request.json();
    const { action, userId, amount, description, programId, paymentDate, payments } = body;

    // Импорт из CRM (массив платежей)
    if (action === 'import' && payments && Array.isArray(payments)) {
      const count = await importPaymentsFromCrm(
        payments.map((p: any) => ({
          userId: p.userId,
          amount: p.amount,
          paymentDate: p.paymentDate || new Date().toISOString(),
          description: p.description,
          programId: p.programId,
        }))
      );
      return NextResponse.json({ success: true, count });
    }

    // Одиночная запись
    if (!userId || !amount) {
      return NextResponse.json({ error: 'userId и amount обязательны' }, { status: 400 });
    }

    const payment = await createPayment(
      userId,
      amount,
      description || null,
      programId || null,
      'manual'
    );

    return NextResponse.json({ success: true, payment }, { status: 201 });
  } catch (error) {
    console.error('❌ Ошибка записи оплаты:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}