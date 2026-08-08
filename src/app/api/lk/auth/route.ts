/**
 * API: Авторизация в ЛК — Тикет 3.2
 * POST /api/lk/auth — вход (phone + agreement_number) → возвращает JWT-токен
 * 
 * Логика:
 * 1. Ищем пользователя по phone
 * 2. Проверяем agreement_number (поле в users или через cfr_accounts)
 * 3. Возвращаем JWT + user data + has_family + is_birthday
 */

import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { pool } from '@/lib/postgres';
import { rateLimit } from '@/lib/rate-limit';

const JWT_SECRET = process.env.JWT_SECRET;

export async function POST(request: NextRequest) {
  if (!JWT_SECRET) {
    console.error('❌ JWT_SECRET не установлен на сервере');
    return NextResponse.json({ error: 'Ошибка конфигурации сервера' }, { status: 500 });
  }

  // Rate limiting — 5 запросов в минуту на IP
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
  const key = `lk_auth:${ip}`;
  if (!rateLimit(key, 5, 60000)) {
    return NextResponse.json({ error: 'Слишком много запросов. Попробуйте позже' }, { status: 429 });
  }

  try {
    const body = await request.json();
    const { phone, agreement_number } = body;

    if (!phone || !agreement_number) {
      return NextResponse.json(
        { error: 'Телефон и номер договора обязательны' },
        { status: 400 }
      );
    }

    const client = await pool.connect();
    try {
      // Форматируем телефон: убираем всё кроме цифр
      const cleanPhone = phone.replace(/\D/g, '');
      // Пробуем несколько форматов телефона
      const phoneFormats = [
        `+7${cleanPhone}`,
        `8${cleanPhone}`,
        phone,
      ];

      // Ищем пользователя по телефону
      // Сначала пробуем через таблицу users
      let user: any = null;
      for (const pf of phoneFormats) {
        const result = await client.query(
          'SELECT * FROM users WHERE phone = $1',
          [pf]
        );
        if (result.rows.length > 0) {
          user = result.rows[0];
          break;
        }
      }

      // Если не нашли в users — ищем через cfr_persons (по телефону)
      // и связываем с agreement_number через cfr_accounts
      if (!user) {
        const personResult = await client.query(
          `SELECT p.id, p.last_name, p.first_name, p.middle_name, p.mobile_phone,
                  c.agreement_number
           FROM cfr_persons p
           JOIN cfr_clients c ON c.person_id = p.id
           WHERE p.mobile_phone = $1 OR p.mobile_phone LIKE $2`,
          [phone, `%${cleanPhone}%`]
        );

        if (personResult.rows.length > 0) {
          const person = personResult.rows[0];
          // Проверяем agreement_number
          if (person.agreement_number !== agreement_number) {
            return NextResponse.json(
              { error: 'Неверный номер телефона или номер договора' },
              { status: 401 }
            );
          }

          // Формируем user объект
          const fullName = [person.last_name, person.first_name, person.middle_name]
            .filter(Boolean).join(' ') || person.first_name || person.last_name || 'Клиент';

          user = {
            id: person.id,
            phone: person.mobile_phone,
            name: fullName,
            email: null,
            agreement_number: person.agreement_number,
            person_id: person.id,
          };
        }
      } else {
        // Пользователь найден в users — проверяем agreement_number
        const userAgreement = user.agreement_number || '';
        if (userAgreement && userAgreement !== agreement_number) {
          return NextResponse.json(
            { error: 'Неверный номер телефона или номер договора' },
            { status: 401 }
          );
        }
      }

      if (!user) {
        return NextResponse.json(
          { error: 'Неверный номер телефона или номер договора' },
          { status: 401 }
        );
      }

      // Проверяем, есть ли у пользователя семья (дети)
      let hasFamily = false;
      try {
        const familyResult = await client.query(
          `SELECT COUNT(*) as cnt FROM cfr_clients
           WHERE parent_person_id = $1 OR parent_person_id_1 = $1 OR parent_person_id_2 = $1`,
          [user.person_id || user.id]
        );
        hasFamily = parseInt(familyResult.rows[0].cnt) > 0;
      } catch {
        hasFamily = false;
      }

      // Проверяем день рождения (ближайшие 3 дня)
      let isBirthday = false;
      try {
        const birthResult = await client.query(
          `SELECT birth_date FROM cfr_persons WHERE id = $1`,
          [user.person_id || user.id]
        );
        if (birthResult.rows[0]?.birth_date) {
          const birthDate = new Date(birthResult.rows[0].birth_date);
          const today = new Date();
          const jan1 = new Date(today.getFullYear(), 0, 1);
          const dayOfYear = Math.floor((today.getTime() - jan1.getTime()) / (1000 * 60 * 60 * 24));
          const birthDayOfYear = Math.floor((birthDate.getTime() - jan1.getTime()) / (1000 * 60 * 60 * 24));
          isBirthday = Math.abs(dayOfYear - birthDayOfYear) <= 3;
        }
      } catch {
        isBirthday = false;
      }

      // Генерируем JWT
      const token = jwt.sign(
        { id: user.id, phone: user.phone },
        JWT_SECRET,
        { expiresIn: '30d' }
      );

      return NextResponse.json({
        success: true,
        token,
        user: {
          id: user.id,
          phone: user.phone,
          name: user.name,
          email: user.email || null,
          agreement_number: user.agreement_number || agreement_number,
          has_family: hasFamily,
          is_birthday: isBirthday,
        },
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('❌ Ошибка авторизации:', error);
    return NextResponse.json(
      { error: 'Ошибка сервера' },
      { status: 500 }
    );
  }
}