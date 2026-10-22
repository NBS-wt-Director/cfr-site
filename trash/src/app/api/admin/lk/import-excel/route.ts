/**
 * API: Импорт данных из Excel (CRM) через админку
 * POST /api/admin/lk/import-excel
 *
 * Поддерживаемые файлы:
 *   clients.xlsx — парсер клиентов (F5)
 *   data.xlsx    — парсер посещений/оплат (F6)
 *   любой другой — старый формат
 */
// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getUserByPhone, createVisit, createPayment, upsertUserFromCrm, pool } from '@/lib/postgres';
import { authenticateAdmin } from '@/lib/auth';

function extractName(raw: string): string {
  if (!raw) return '';
  return raw.replace(/\s*\(\d+\s*лет\)/g, '').trim();
}
function extractPhone(raw: string): string {
  if (!raw) return '';
  return String(raw).replace(/[^0-9]/g, '');
}
function parseDateCrm(str: string): string | null {
  if (!str) return null;
  const cleaned = String(str).trim();
  const m = cleaned.match(/^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2}):?(\d{2})?$/);
  if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}T${m[4]}:${m[5]}:${(m[6]||'00').padStart(2,'0')}`;
  const m2 = cleaned.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (m2) return `${m2[3]}-${m2[2].padStart(2,'0')}-${m2[1].padStart(2,'0')}T00:00:00`;
  const num = parseFloat(cleaned);
  if (!isNaN(num) && num > 40000 && num < 100000) {
    return new Date(1899, 11, 30 + num * 86400000).toISOString();
  }
  return null;
}
function extractPaymentInfo(raw: string): { amount: number | null; discount: string | null } {
  if (!raw) return { amount: null, discount: null };
  const s = String(raw).trim();
  if (!s) return { amount: null, discount: null };

  // Формат: "50%, пм - 360" или "1/1 5% - 262,5" или "1,5 - 400" или "бесплатно - 0"
  // Паттерн: <скидка/описание> - <сумма>
  // Сначала пробуем "пм -"
  const pmMatch = s.match(/пм\s*-\s*(\d+(?:[.,]\d+)?)/i);
  if (pmMatch) {
    const amount = parseFloat(pmMatch[1].replace(',', '.'));
    let discount = s.slice(0, pmMatch.index).trim();
    if (!discount) discount = null;
    return { amount, discount };
  }

  // Паттерн: <что-то> - <число> (например "50% - 360", "1/1 5% - 262,5", "1,5 - 400")
  const dashMatch = s.match(/^(.+?)\s*-\s*(\d+(?:[.,]\d+)?)\s*$/);
  if (dashMatch) {
    const amount = parseFloat(dashMatch[2].replace(',', '.'));
    const discount = dashMatch[1].trim();
    return { amount, discount };
  }

  // Просто число — сумма
  const numMatch = s.match(/^(\d+(?:[.,]\d+)?)\s*$/);
  if (numMatch) {
    return { amount: parseFloat(numMatch[1].replace(',', '.')), discount: null };
  }

  return { amount: null, discount: null };
}

/**
 * Извлекает сумму и скидку из 'Вид занятия' (например '50%, пм - 360')
 */
function extractActivityInfo(raw: string): { amount: number | null; discount: string | null } {
  if (!raw) return { amount: null, discount: null };
  const s = String(raw).trim();
  if (!s) return { amount: null, discount: null };
  // Ищем "пм - <число>"
  const pmMatch = s.match(/пм\s*-\s*(\d+(?:[.,]\d+)?)/i);
  const amount = pmMatch ? parseFloat(pmMatch[1].replace(',', '.')) : null;
  // Скидка — часть до "пм -"
  let discount: string | null = null;
  const pmIdx = s.toLowerCase().indexOf('пм -');
  if (pmIdx > 0) {
    discount = s.slice(0, pmIdx).trim();
    if (!discount) discount = null;
  }
  return { amount, discount };
}

async function parseClients(rows: any[]) {
  const stats = { created: 0, skipped: 0, errors: [] };
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;
    const phone1 = extractPhone(row['Мобильный 1'] || '');
    const phone2 = extractPhone(row['Мобильный 2'] || '');
    const phone = phone1 || phone2;
    if (!phone || phone.length < 10) { stats.skipped++; continue; }
    const name = extractName(row['ФИО'] || '');
    if (!name) { stats.skipped++; continue; }
    const existing = await getUserByPhone(phone);
    if (existing) { stats.skipped++; continue; }
    const birthDate = row['Дата рождения'] ? parseDateCrm(row['Дата рождения']) : null;
    const genderRaw = (row['Пол'] || '').toString().trim().toLowerCase();
    const gender = (genderRaw.includes('ж') || genderRaw.includes('жен') || genderRaw.includes('f')) ? 'female'
                 : (genderRaw.includes('м') || genderRaw.includes('муж') || genderRaw.includes('m')) ? 'male' : null;
    const balanceRaw = (row['Баланс ЛС'] || '0').toString().trim();
    const balance = balanceRaw ? parseFloat(balanceRaw.replace(',', '.')) : 0;
    const parentPhone1 = extractPhone(row['Мобильный родителя 1'] || '');
    const parentPhone2 = extractPhone(row['Мобильный родителя 2'] || '');
    const source = (row['Узнал от друга'] || '').toString().trim() || null;
    const createdAtCrm = row['Дата создания'] ? parseDateCrm(row['Дата создания']) : null;
    try {
      await upsertUserFromCrm(phone, name, birthDate, gender, balance,
        parentPhone1 || null, parentPhone2 || null, source, createdAtCrm);
      stats.created++;
    } catch (err) {
      stats.errors.push(`Строка ${rowNum}: ${err.message}`);
      stats.skipped++;
    }
  }
  return stats;
}

async function findUserByName(name) {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT * FROM users WHERE name ILIKE $1 LIMIT 1', [name]);
    return result.rows[0] || null;
  } finally { client.release(); }
}

/** Пакетная вставка посещений (batchSize=500) */
async function bulkInsertVisits(batch) {
  if (batch.length === 0) return;
  const client = await pool.connect();
  try {
    const values = batch.flatMap((b, bi) => [
      b.userId, b.visitDate || new Date().toISOString(), b.notes || null, b.groupName || null
    ]);
    const placeholders = batch.map((_, bi) => {
      const base = bi * 4 + 1;
      return `($${base}, $${base+1}, $${base+2}, $${base+3})`;
    }).join(', ');
    await client.query(`INSERT INTO user_visits (user_id, visit_date, notes, group_name) VALUES ${placeholders}`, values);
  } finally { client.release(); }
}

/** Пакетная вставка оплат (batchSize=500) */
async function bulkInsertPayments(batch) {
  if (batch.length === 0) return;
  const client = await pool.connect();
  try {
    const values = batch.flatMap((b, bi) => [
      b.userId, b.amount, b.description, b.discount, b.groupName || null, b.notes || null
    ]);
    const placeholders = batch.map((_, bi) => {
      const base = bi * 6 + 1;
      return `($${base}, $${base+1}, $${base+2}, $${base+3}, $${base+4}, $${base+5})`;
    }).join(', ');
    await client.query(
      `INSERT INTO user_payments (user_id, amount, description, discount, group_name, notes, payment_date) VALUES ${placeholders}, NOW())`,
      values
    );
  } finally { client.release(); }
}

async function createVisitWithDetails(userId, visitDate, groupName, notes) {
  const client = await pool.connect();
  try {
    await client.query('INSERT INTO user_visits (user_id, visit_date, notes, group_name) VALUES ($1, $2, $3, $4)',
      [userId, visitDate || new Date().toISOString(), notes, groupName || null]);
  } finally { client.release(); }
}
async function createPaymentWithDetails(userId, amount, description, discount, groupName, notes) {
  const client = await pool.connect();
  try {
    await client.query('INSERT INTO user_payments (user_id, amount, description, discount, group_name, notes, payment_date) VALUES ($1, $2, $3, $4, $5, $6, NOW())',
      [userId, amount, description, discount, groupName || null, notes]);
  } finally { client.release(); }
}
async function createSubscriptionPg(userId, programId, status) {
  const client = await pool.connect();
  try {
    await client.query('INSERT INTO user_subscriptions (user_id, status) VALUES ($1, $2)', [userId, status]);
  } finally { client.release(); }
}

async function parseDataRows(rows) {
  const stats = { visits: 0, payments: 0, skipped: 0, errors: [] };
  const visitBatch = [];
  const paymentBatch = [];
  const batchSize = 500;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;
    const clientNameRaw = (row['Клиент'] || '').toString().trim();
    if (!clientNameRaw) { stats.skipped++; continue; }
    const clientName = extractName(clientNameRaw);
    const user = await findUserByName(clientName);
    if (!user) { stats.errors.push(`Строка ${rowNum}: пользователь "${clientName}" не найден`); stats.skipped++; continue; }

    const visitValue = (row['Посещение'] || '').toString().trim();
    const paymentValue = (row['Оплачено'] || '').toString().trim();
    const groupName = (row['Группа'] || '').toString().trim();
    const notes = (row['Примечание'] || '').toString().trim() || null;

    if (visitValue.length > 0) {
      visitBatch.push({ userId: user.id, visitDate: parseDateCrm(visitValue), groupName, notes });
      if (visitBatch.length >= batchSize) {
        try { await bulkInsertVisits(visitBatch); stats.visits += visitBatch.length; }
        catch (err) { stats.errors.push(`Строка ${rowNum}: ошибка пакетной вставки посещений`); }
        visitBatch.length = 0;
      }
    }
    if (paymentValue.length > 0) {
      const activityType = (row['Вид занятия'] || '').toString().trim();
      const { amount, discount } = activityType ? extractActivityInfo(activityType) : extractPaymentInfo(paymentValue);
      const description = activityType || paymentValue;
      paymentBatch.push({ userId: user.id, amount, description, discount, groupName, notes });
      if (paymentBatch.length >= batchSize) {
        try { await bulkInsertPayments(paymentBatch); stats.payments += paymentBatch.length; }
        catch (err) { stats.errors.push(`Строка ${rowNum}: ошибка пакетной вставки оплат`); }
        paymentBatch.length = 0;
      }
    }
  }
  // Оставшиеся записи
  if (visitBatch.length > 0) {
    try { await bulkInsertVisits(visitBatch); stats.visits += visitBatch.length; }
    catch (err) { stats.errors.push('Остаток пакетной вставки посещений'); }
  }
  if (paymentBatch.length > 0) {
    try { await bulkInsertPayments(paymentBatch); stats.payments += paymentBatch.length; }
    catch (err) { stats.errors.push('Остаток пакетной вставки оплат'); }
  }
  return stats;
}

async function handleLegacyImport(rows) {
  const headers = Object.keys(rows[0]);
  const findCol = (keywords) => headers.find(h => keywords.some(k => h.toLowerCase().includes(k.toLowerCase()))) || null;
  const phoneCol = findCol(['телефон', 'phone', 'tel', 'login', 'логин']);
  const dateCol = findCol(['дата', 'date', 'visit', 'payment', 'посещение', 'оплат']);
  const typeCol = findCol(['тип', 'type', 'действие', 'action']);
  const amountCol = findCol(['сумма', 'amount', 'price', 'цена', 'оплат']);
  const programCol = findCol(['программа', 'program', 'услуг', 'service']);
  const descCol = findCol(['описание', 'description', 'desc', 'примечание', 'note', 'комментарий']);
  if (!phoneCol) return NextResponse.json({ error: 'Не найдена колонка с телефоном', headers }, { status: 400 });
  const stats = { visits: 0, payments: 0, subscriptions: 0, errors: 0, skipped: 0 };
  const errors = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const phone = extractPhone(String(row[phoneCol] || ''));
    const dateStr = String(dateCol ? row[dateCol] || '' : '');
    const type = String(typeCol ? row[typeCol] || '' : '').toLowerCase().trim();
    const amount = parseFloat(String(amountCol ? row[amountCol] || '0' : '0').replace(/[^0-9.,]/g, '').replace(',', '.'));
    const programName = String(programCol ? row[programCol] || '' : '').trim();
    const description = String(descCol ? row[descCol] || '' : '').trim();
    if (!phone || phone.length < 10) { stats.skipped++; continue; }
    const user = await getUserByPhone(phone);
    if (!user) { stats.skipped++; errors.push(`Строка ${i + 2}: пользователь с телефоном ${phone} не найден`); continue; }
    const programId = null;
    if (type.includes('посещен') || type.includes('visit')) {
      await createVisit(user.id, programId, parseDateCrm(dateStr));
      stats.visits++;
    } else if (type.includes('оплат') || type.includes('payment') || (amount > 0 && !type.includes('подпис') && !type.includes('subscript'))) {
      await createPayment(user.id, amount, description || `Импорт из CRM (${programName || 'без программы'})`, programId, 'crm_import');
      stats.payments++;
    } else if (type.includes('подпис') || type.includes('subscript')) {
      const status = description.toLowerCase().includes('active') ? 'active' : 'inactive';
      await createSubscriptionPg(user.id, programId, status);
      stats.subscriptions++;
    } else if (amount > 0) {
      await createPayment(user.id, amount, description || `Импорт из CRM (${programName || 'без программы'})`, programId, 'crm_import');
      stats.payments++;
    } else if (dateStr) {
      await createVisit(user.id, programId, parseDateCrm(dateStr));
      stats.visits++;
    } else { stats.skipped++; }
  }
  return NextResponse.json({ success: true, type: 'legacy', stats, errors: errors.slice(0, 20), totalRows: rows.length,
    message: `✅ Импортировано: ${stats.visits} посещений, ${stats.payments} оплат, ${stats.subscriptions} подписок. Пропущено: ${stats.skipped}${errors.length > 0 ? `. Ошибок: ${errors.length}` : ''}` });
}

export async function POST(request) {
  const auth = authenticateAdmin(request);
  if (auth !== true) return auth;
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    if (!file) return NextResponse.json({ error: 'Файл не загружен' }, { status: 400 });
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return NextResponse.json({ error: 'Файл пуст' }, { status: 400 });
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    if (rows.length === 0) return NextResponse.json({ error: 'Нет данных в файле' }, { status: 400 });
    const fileName = file.name.toLowerCase();
    const headers = Object.keys(rows[0]);
    if (fileName.includes('client') || headers.includes('ФИО')) {
      const stats = await parseClients(rows);
      return NextResponse.json({ success: true, type: 'clients', stats, totalRows: rows.length,
        message: `✅ Клиенты: создано ${stats.created}, пропущено ${stats.skipped}${stats.errors.length > 0 ? `. Ошибок: ${stats.errors.length}` : ''}` });
    }
    if (fileName.includes('data') || (headers.includes('Клиент') && (headers.includes('Посещение') || headers.includes('Оплачено')))) {
      const stats = await parseDataRows(rows);
      return NextResponse.json({ success: true, type: 'data', stats, totalRows: rows.length,
        message: `✅ Данные: посещений ${stats.visits}, оплат ${stats.payments}, пропущено ${stats.skipped}${stats.errors.length > 0 ? `. Ошибок: ${stats.errors.length}` : ''}` });
    }
    return await handleLegacyImport(rows);
  } catch (error) {
    console.error('❌ Ошибка импорта Excel:', error);
    return NextResponse.json({ error: 'Ошибка импорта файла' }, { status: 500 });
  }
}
