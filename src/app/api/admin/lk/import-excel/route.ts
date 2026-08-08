/**
 * API: Импорт данных из Excel (CRM) через админку
 * POST /api/admin/lk/import-excel — загрузка .xlsx файла
 *
 * Формат Excel (первый лист):
 * | Телефон   | Дата       | Тип       | Сумма | Программа | Описание       |
 * | 7900123456| 01.01.2026 | Посещение |       | Йога      |                |
 * | 7900123456| 01.01.2026 | Оплата    | 5000  | Йога      | Абонемент январь |
 * | 7900123456| 01.01.2026 | Подписка  |       | Йога      | active         |
 */

import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getUserByPhone, createVisit, createPayment, createSubscription } from '@/lib/postgres';
import { authenticateAdmin } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const auth = authenticateAdmin(request);
  if (auth !== true) return auth;
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Файл не загружен' }, { status: 400 });
    }

    // Читаем файл
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return NextResponse.json({ error: 'Файл пуст' }, { status: 400 });
    }

    const sheet = workbook.Sheets[sheetName];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Нет данных в файле' }, { status: 400 });
    }

    // Определяем заголовки (первая строка) — ищем колонки по ключевым словам
    const headers = Object.keys(rows[0]);
    const findCol = (keywords: string[]): string | null => {
      return headers.find(h => keywords.some(k => h.toLowerCase().includes(k.toLowerCase()))) || null;
    };

    const phoneCol = findCol(['телефон', 'phone', 'tel', 'login', 'логин']);
    const dateCol = findCol(['дата', 'date', 'visit', 'payment', 'посещение', 'оплат']);
    const typeCol = findCol(['тип', 'type', 'действие', 'action']);
    const amountCol = findCol(['сумма', 'amount', 'price', 'цена', 'оплат']);
    const programCol = findCol(['программа', 'program', 'услуг', 'service']);
    const descCol = findCol(['описание', 'description', 'desc', 'примечание', 'note', 'комментарий']);

    if (!phoneCol) {
      return NextResponse.json({
        error: 'Не найдена колонка с телефоном. Ожидаются колонки: Телефон, Дата, Тип',
        headers: headers,
      }, { status: 400 });
    }

    const stats = { visits: 0, payments: 0, subscriptions: 0, errors: 0, skipped: 0 };
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const phone = String(row[phoneCol!]).replace(/[^0-9]/g, '');
      const dateStr = String(dateCol ? row[dateCol] || '' : '');
      const type = String(typeCol ? row[typeCol] || '' : '').toLowerCase().trim();
      const amount = parseFloat(String(amountCol ? row[amountCol] || '0' : '0').replace(/[^0-9.,]/g, '').replace(',', '.'));
      const programName = String(programCol ? row[programCol] || '' : '').trim();
      const description = String(descCol ? row[descCol] || '' : '').trim();

      if (!phone || phone.length < 10) {
        stats.skipped++;
        continue;
      }

      // Ищем пользователя по телефону
      const user = await getUserByPhone(phone);
      if (!user) {
        stats.skipped++;
        errors.push(`Строка ${i + 2}: пользователь с телефоном ${phone} не найден`);
        continue;
      }

      const programId = programName ? null : null; // можно доработать поиск по имени программы

      // Определяем тип записи
      if (type.includes('посещен') || type.includes('visit')) {
        const visitDate = parseDate(dateStr);
        await createVisit(user.id, programId, visitDate);
        stats.visits++;
      } else if (type.includes('оплат') || type.includes('payment') || (amount > 0 && !type.includes('подпис') && !type.includes('subscript'))) {
        const paymentDate = parseDate(dateStr);
        await createPayment(user.id, amount, description || `Импорт из CRM (${programName || 'без программы'})`, programId, 'crm_import');
        stats.payments++;
      } else if (type.includes('подпис') || type.includes('subscript')) {
        const status = description.toLowerCase().includes('active') ? 'active' : 'inactive';
        await createSubscription(user.id, programId, status);
        stats.subscriptions++;
      } else {
        // Если тип не указан, но есть сумма — считаем оплатой
        if (amount > 0) {
          const paymentDate = parseDate(dateStr);
          await createPayment(user.id, amount, description || `Импорт из CRM (${programName || 'без программы'})`, programId, 'crm_import');
          stats.payments++;
        } else {
          // Если есть дата — считаем посещением
          if (dateStr) {
            const visitDate = parseDate(dateStr);
            await createVisit(user.id, programId, visitDate);
            stats.visits++;
          } else {
            stats.skipped++;
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      stats,
      errors: errors.slice(0, 20), // максимум 20 ошибок
      totalRows: rows.length,
      message: `✅ Импортировано: ${stats.visits} посещений, ${stats.payments} оплат, ${stats.subscriptions} подписок. Пропущено: ${stats.skipped}${errors.length > 0 ? `. Ошибок: ${errors.length}` : ''}`,
    });
  } catch (error) {
    console.error('❌ Ошибка импорта Excel:', error);
    return NextResponse.json({ error: 'Ошибка импорта файла' }, { status: 500 });
  }
}

/**
 * Парсинг даты из разных форматов
 */
function parseDate(dateStr: string): string {
  if (!dateStr) return new Date().toISOString();

  // Если это Excel-серийный номер даты
  const num = parseFloat(dateStr);
  if (!isNaN(num) && num > 40000 && num < 100000) {
    // Excel serial date
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + num * 86400000);
    return date.toISOString();
  }

  // Если это число-таймстамп (миллисекунды)
  if (!isNaN(num) && num > 1000000000000) {
    return new Date(num).toISOString();
  }

  // Если это строка — пытаемся распарсить
  // DD.MM.YYYY или DD/MM/YYYY или YYYY-MM-DD
  const cleaned = dateStr.replace(/[^0-9.\-/: ]/g, '').trim();
  const parts = cleaned.split(/[.\-/: ]/).filter(Boolean);

  if (parts.length === 3) {
    let day: string, month: string, year: string;
    if (parts[0].length === 4) {
      // YYYY-MM-DD
      year = parts[0]; month = parts[1]; day = parts[2];
    } else if (parts[2].length === 4) {
      // DD.MM.YYYY
      day = parts[0]; month = parts[1]; year = parts[2];
    } else {
      return new Date().toISOString();
    }
    return new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`).toISOString();
  }

  return new Date(dateStr).toISOString();
}