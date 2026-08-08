/**
 * API: Управление пользователями ЛК (админка)
 * GET  /api/admin/lk/users — список пользователей
 * POST /api/admin/lk/users — создать пользователя (логин=телефон, пароль=6 цифр)
 * DELETE /api/admin/lk/users/:id — удалить пользователя
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createUser, getAllUsers, getUserByPhone, deleteUser } from '@/lib/postgres';
import { authenticateAdmin } from '@/lib/auth';

/**
 * Генерация 6-значного кода
 */
function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * SHA-256 хеширование пароля
 */
function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export async function GET(request: NextRequest) {
  const auth = authenticateAdmin(request);
  if (auth !== true) return auth;
  try {
    const users = await getAllUsers();
    return NextResponse.json(users);
  } catch (error) {
    console.error('❌ Ошибка получения пользователей:', error);
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
    const { phone, name, email } = body;

    if (!phone) {
      return NextResponse.json({ error: 'Телефон обязателен' }, { status: 400 });
    }

    // Проверка, что пользователь с таким телефоном не существует
    const existing = await getUserByPhone(phone);
    if (existing) {
      return NextResponse.json({ error: 'Пользователь с таким телефоном уже существует' }, { status: 409 });
    }

    // Генерируем пароль = 6 цифр
    const password = generateCode();
    const passwordHash = hashPassword(password);

    // Создаём пользователя
    const user = await createUser(phone, passwordHash, name || null, email || null);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        email: user.email,
      },
      credentials: {
        login: phone,
        password: password,
      },
      message: `✅ Пользователь ${phone} создан. Пароль: ${password}`,
    }, { status: 201 });
  } catch (error) {
    console.error('❌ Ошибка создания пользователя:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = authenticateAdmin(request);
  if (auth !== true) return auth;
  try {
    const { searchParams } = new URL(request.url);
    const id = parseInt(searchParams.get('id') || '');
    if (!id) {
      return NextResponse.json({ error: 'ID обязателен' }, { status: 400 });
    }
    await deleteUser(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ Ошибка удаления пользователя:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}