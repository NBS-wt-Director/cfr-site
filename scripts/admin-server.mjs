#!/usr/bin/env node
/**
 * scripts/admin-server.mjs
 *
 * Локальный сервер для админки статического сайта.
 *   node scripts/admin-server.mjs
 *
 * Отдаёт:
 *   GET  /admin.html          — страница админки
 *   GET  /static/*            — статика (css, js, картинки)
 *   POST /api/admin/login     — вход, возвращает токен
 *   POST /api/admin/save      — сохранение db.json + перегенерация
 *   POST /api/admin/upload    — загрузка файлов
 *   POST /api/admin/delete    — удаление файлов
 *
 * Пароль читается из ADMIN_PASSWORD env.
 * Сессия — токен в cookie на 24 часа.
 *
 * ⚠️ Только localhost, не для продакшна.
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const staticDir = path.join(root, 'static');
const dbPath = path.join(root, 'db.json');
const uploadsDir = path.join(staticDir, 'uploads');

// ============================================
// Конфигурация
// ============================================

// Пароль из env, для продакшена; fallback для удобства деплоя
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'ЦФР_2026.10.21';

const PORT = parseInt(process.env.ADMIN_PORT || '3456', 10);
const SESSION_SECRET = crypto.randomBytes(32).toString('hex');
const SESSION_COOKIE_NAME = 'admin_token';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 часа

// В памяти — сессии: token → { createdAt }
const sessions = new Map();

// ============================================
// Утилиты
// ============================================

function sendJSON(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function sendHTML(res, status, html) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

function sendFile(res, filePath, contentType) {
  try {
    const data = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const types = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
      '.ttf': 'font/ttf'
    };
    res.writeHead(200, { 'Content-Type': types[ext] || contentType });
    res.end(data);
  } catch (err) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch { resolve(null); }
    });
    req.on('error', reject);
  });
}

function readFormBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => { chunks.push(chunk); });
    req.on('end', () => {
      const buf = Buffer.concat(chunks);
      resolve(buf);
    });
    req.on('error', reject);
  });
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function setCookie(res, name, value, maxAgeMs) {
  const expires = new Date(Date.now() + maxAgeMs).toUTCString();
  const cookie = `${name}=${value}; Expires=${expires}; Path=/; HttpOnly; SameSite=Lax`;
  res.setHeader('Set-Cookie', cookie);
}

function clearCookie(res, name) {
  res.setHeader('Set-Cookie', `${name}=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/`);
}

// Токен сессии: заголовок Authorization: Bearer (кросс-портовый доступ) или cookie (тот же origin)
function extractTokenFromCookie(headers) {
  const auth = headers.authorization || '';
  const bearer = auth.match(/^Bearer\s+(.+)$/i);
  if (bearer) return bearer[1];
  const cookies = headers.cookie || '';
  const match = cookies.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function isValidSession(token) {
  if (!token || !sessions.has(token)) return false;
  const session = sessions.get(token);
  if (Date.now() - session.createdAt > SESSION_TTL_MS) {
    sessions.delete(token);
    return false;
  }
  return true;
}

// ============================================
// Бэкап и перегенерация
// ============================================

function backupDB() {
  if (!fs.existsSync(dbPath)) return;
  const timestamp = Date.now();
  const backupPath = path.join(root, 'backups', `db.json.backup.${timestamp}`);
  const backupsDir = path.dirname(backupPath);
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }
  fs.copyFileSync(dbPath, backupPath);
  console.log(`💾 Бэкап: ${backupPath}`);
}

function regenerateStatic() {
  try {
    console.log('🔄 Перегенерация статики...');
    execSync('npm run static:export', { cwd: root, stdio: 'inherit' });
    console.log('✅ Статика перегенерирована');
  } catch (err) {
    console.error('❌ Ошибка перегенерации:', err.message);
    throw err;
  }
}

// ============================================
// Обработчики API
// ============================================

async function handleLogin(req, res) {
  const body = await readBody(req);
  const password = body?.password;

  if (password !== ADMIN_PASSWORD) {
    return sendJSON(res, 401, { error: 'Неверный пароль' });
  }

  const token = generateToken();
  sessions.set(token, { createdAt: Date.now() });
  setCookie(res, SESSION_COOKIE_NAME, token, SESSION_TTL_MS);

  console.log(`🔑 Вход по паролю OK — токен: ${token.slice(0, 16)}...`);
  // Токен и в cookie (тот же origin), и в теле (другой порт: localStorage + Authorization)
  sendJSON(res, 200, { ok: true, token });
}

async function handleSave(req, res) {
  // Проверяем сессию
  const token = extractTokenFromCookie(req.headers);
  if (!isValidSession(token)) {
    return sendJSON(res, 401, { error: 'Не авторизован' });
  }

  const body = await readBody(req);
  if (!body?.data) {
    return sendJSON(res, 400, { error: 'Нет данных' });
  }

  try {
    // Бэкап
    backupDB();

    // Запись db.json
    fs.writeFileSync(dbPath, JSON.stringify(body.data, null, 2), 'utf-8');
    console.log('✅ db.json сохранён');

    // Перегенерация
    regenerateStatic();

    sendJSON(res, 200, { ok: true });
  } catch (err) {
    console.error('❌ Ошибка сохранения:', err);
    sendJSON(res, 500, { error: err.message });
  }
}

async function handleUpload(req, res) {
  const token = extractTokenFromCookie(req.headers);
  if (!isValidSession(token)) {
    return sendJSON(res, 401, { error: 'Не авторизован' });
  }

  // Правильный парсинг multipart/form-data
  const contentType = req.headers['content-type'] || '';
  const boundaryMatch = contentType.match(/boundary=(.+)/);
  if (!boundaryMatch) {
    return sendJSON(res, 400, { error: 'Неверный Content-Type, нужен multipart/form-data' });
  }

  const boundary = boundaryMatch[1];
  const buffer = await readFormBody(req);

  // Парсим multipart body
  const files = parseMultipart(buffer, boundary);
  if (!files.length) {
    return sendJSON(res, 400, { error: 'Нет файлов в запросе' });
  }

  // Берём первый файл
  const file = files[0];
  const { fieldName, originalName, data } = file;
  const ext = path.extname(originalName).toLowerCase() || '.jpg';
  const safeName = crypto.randomBytes(8).toString('hex') + ext;

  // Сохраняем в static/uploads/ (как существующие файлы)
  const targetDir = uploadsDir;
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const targetPath = path.join(targetDir, safeName);
  fs.writeFileSync(targetPath, data);

  console.log(`📎 Загружен файл: ${fieldName} → uploads/${safeName} (${data.length} байт)`);

  sendJSON(res, 200, {
    ok: true,
    path: `uploads/${safeName}`
  });
}

function parseMultipart(buffer, boundary) {
  const results = [];
  const boundaryPrefix = `--${boundary}\r\n`;
  const headersSep = '\r\n\r\n';

  let pos = 0;

  while (pos < buffer.length) {
    // Ищем начало части
    const partStart = buffer.indexOf(Buffer.from(boundaryPrefix, 'latin1'), pos);
    if (partStart === -1) break;

    // Ищем конец части (следующий boundary или end boundary)
    const endPos = buffer.indexOf(Buffer.from(`\r\n--${boundary}`, 'latin1'), partStart);
    if (endPos === -1) break;

    const part = buffer.subarray(partStart + boundaryPrefix.length, endPos - 2); // -2 для \r\n

    // Ищем разделитель заголовков и контента
    const headersEnd = part.indexOf(Buffer.from(headersSep));
    if (headersEnd === -1) {
      pos = endPos;
      continue;
    }

    const headers = part.subarray(0, headersEnd).toString('utf-8');
    const content = part.subarray(headersEnd + 4);

    // Парсим имя поля и имя файла
    const nameMatch = headers.match(/name=\"([^\"]+)\"/);
    const filenameMatch = headers.match(/filename=\"([^\"]+)\"/);

    if (nameMatch) {
      results.push({
        fieldName: nameMatch[1],
        originalName: filenameMatch ? filenameMatch[1].replace(/\//g, '').replace(/\\/g, '') : 'file',
        data: content
      });
    }

    pos = endPos;
  }

  return results;
}

async function handleDelete(req, res) {
  const token = extractTokenFromCookie(req.headers);
  if (!isValidSession(token)) {
    return sendJSON(res, 401, { error: 'Не авторизован' });
  }

  const body = await readBody(req);
  const filePath = body?.path;

  if (!filePath) {
    return sendJSON(res, 400, { error: 'Нет пути к файлу' });
  }

  // Пути в db.json: /uploads/xxx.png → реальный путь: static/uploads/xxx.png
  const cleanPath = filePath.replace(/^\//, '');
  const fullPath = path.join(staticDir, cleanPath);

  // Защита от path traversal
  const resolved = path.resolve(fullPath);
  if (!resolved.startsWith(path.resolve(staticDir, 'uploads'))) {
    return sendJSON(res, 403, { error: 'Доступ только к uploads/' });
  }

  try {
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      console.log(`🗑 Удалён файл: ${cleanPath}`);
    }
    sendJSON(res, 200, { ok: true });
  } catch (err) {
    sendJSON(res, 500, { error: err.message });
  }
}

function handleLogout(req, res) {
  const token = extractTokenFromCookie(req.headers);
  if (token) {
    sessions.delete(token);
  }
  clearCookie(res, SESSION_COOKIE_NAME);
  sendJSON(res, 200, { ok: true });
}

// ============================================
// Новости CRUD
// ============================================

function readDb() {
  try {
    return JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
  } catch {
    return {};
  }
}

function writeDb(db) {
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf-8');
}

function previewOf(text) {
  return text.replace(/[*_~\[\]#()]/g, '').replace(/\n/g, ' ').trim().substring(0, 200);
}

async function handleGetNews(req, res) {
  const token = extractTokenFromCookie(req.headers);
  if (!isValidSession(token)) {
    return sendJSON(res, 401, { error: 'Не авторизован' });
  }

  const db = readDb();
  const news = (db.news || []).slice().sort((a, b) => {
    const da = String(a.date || '');
    const dbb = String(b.date || '');
    if (da !== dbb) return da < dbb ? 1 : -1;
    return (b.id || 0) - (a.id || 0);
  });

  sendJSON(res, 200, { news });
}

async function handleSaveNews(req, res) {
  const token = extractTokenFromCookie(req.headers);
  if (!isValidSession(token)) {
    return sendJSON(res, 401, { error: 'Не авторизован' });
  }

  const body = await readBody(req);
  const newsItem = body?.news;
  const isNew = body?.isNew;

  if (!newsItem || !newsItem.title) {
    return sendJSON(res, 400, { error: 'Не указан заголовок' });
  }

  try {
    const db = readDb();
    if (!db.news) db.news = [];

    if (isNew) {
      newsItem.id = Date.now();
      newsItem.text = newsItem.text || '';
      newsItem.date = newsItem.date || new Date().toISOString().split('T')[0];
      newsItem.preview = previewOf(newsItem.text);
      db.news.push(newsItem);
    } else {
      const idx = db.news.findIndex(n => n.id === newsItem.id);
      if (idx === -1) {
        return sendJSON(res, 404, { error: 'Новость не найдена' });
      }
      newsItem.preview = previewOf(newsItem.text);
      db.news[idx] = newsItem;
    }

    // Бэкап
    backupDB();

    // Запись
    writeDb(db);

    // Перегенерация
    regenerateStatic();

    sendJSON(res, 200, { ok: true });
  } catch (err) {
    console.error('❌ Ошибка сохранения новости:', err);
    sendJSON(res, 500, { error: err.message });
  }
}

async function handleDeleteNews(req, res) {
  const token = extractTokenFromCookie(req.headers);
  if (!isValidSession(token)) {
    return sendJSON(res, 401, { error: 'Не авторизован' });
  }

  const body = await readBody(req);
  const id = body?.id;

  if (!id) {
    return sendJSON(res, 400, { error: 'Нет id новости' });
  }

  try {
    const db = readDb();
    const idx = db.news.findIndex(n => n.id === id);
    if (idx === -1) {
      return sendJSON(res, 404, { error: 'Новость не найдена' });
    }

    // Удаляем файлы медиа
    const news = db.news[idx];
    for (const field of ['image', 'video']) {
      const val = news[field];
      if (val) {
        try {
          const cleanPath = val.replace(/^\//, '');
          const fullPath = path.join(staticDir, cleanPath);
          const resolved = path.resolve(fullPath);
          if (resolved.startsWith(path.resolve(staticDir, 'uploads')) && fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
            console.log(`🗑 Удалён ${field}: ${cleanPath}`);
          }
        } catch (e) {
          console.warn(`Не удалось удалить ${field}: ${e.message}`);
        }
      }
    }

    db.news.splice(idx, 1);

    // Бэкап
    backupDB();

    // Запись
    writeDb(db);

    // Перегенерация
    regenerateStatic();

    sendJSON(res, 200, { ok: true });
  } catch (err) {
    console.error('❌ Ошибка удаления новости:', err);
    sendJSON(res, 500, { error: err.message });
  }
}

async function handleSaveNewsList(req, res) {
  const token = extractTokenFromCookie(req.headers);
  if (!isValidSession(token)) {
    return sendJSON(res, 401, { error: 'Не авторизован' });
  }

  const body = await readBody(req);
  const newsList = body?.news;

  if (!newsList) {
    return sendJSON(res, 400, { error: 'Нет списка новостей' });
  }

  try {
    const db = readDb();
    db.news = newsList;

    // Бэкап
    backupDB();

    // Запись
    writeDb(db);

    // Перегенерация
    regenerateStatic();

    sendJSON(res, 200, { ok: true });
  } catch (err) {
    console.error('❌ Ошибка сохранения порядка:', err);
    sendJSON(res, 500, { error: err.message });
  }
}

// ============================================
// Программы и тренеры
// ============================================

async function handleGetPrograms(req, res) {
  const token = extractTokenFromCookie(req.headers);
  if (!isValidSession(token)) {
    return sendJSON(res, 401, { error: 'Не авторизован' });
  }

  const db = readDb();
  sendJSON(res, 200, { programs: db.programs || [] });
}

async function handleSavePrograms(req, res) {
  const token = extractTokenFromCookie(req.headers);
  if (!isValidSession(token)) {
    return sendJSON(res, 401, { error: 'Не авторизован' });
  }

  const body = await readBody(req);
  const programsList = body?.programs;

  if (!programsList) {
    return sendJSON(res, 400, { error: 'Нет списка программ' });
  }

  try {
    const db = readDb();
    db.programs = programsList;

    backupDB();
    writeDb(db);
    regenerateStatic();

    sendJSON(res, 200, { ok: true });
  } catch (err) {
    console.error('❌ Ошибка сохранения программ:', err);
    sendJSON(res, 500, { error: err.message });
  }
}

async function handleGetTrainers(req, res) {
  const token = extractTokenFromCookie(req.headers);
  if (!isValidSession(token)) {
    return sendJSON(res, 401, { error: 'Не авторизован' });
  }

  const db = readDb();
  sendJSON(res, 200, { trainers: db.trainers || [] });
}

async function handleSaveTrainers(req, res) {
  const token = extractTokenFromCookie(req.headers);
  if (!isValidSession(token)) {
    return sendJSON(res, 401, { error: 'Не авторизован' });
  }

  const body = await readBody(req);
  const trainersList = body?.trainers;

  if (!trainersList) {
    return sendJSON(res, 400, { error: 'Нет списка тренеров' });
  }

  try {
    const db = readDb();
    db.trainers = trainersList;

    backupDB();
    writeDb(db);
    regenerateStatic();

    sendJSON(res, 200, { ok: true });
  } catch (err) {
    console.error('❌ Ошибка сохранения тренеров:', err);
    sendJSON(res, 500, { error: err.message });
  }
}

// ============================================
// Синхронизация данных
// ============================================

let syncInProgress = false;
let syncLog = '';
let syncStatus = 'idle'; // idle, running, done, error

async function handleSyncData(req, res) {
  const token = extractTokenFromCookie(req.headers);
  if (!isValidSession(token)) {
    return sendJSON(res, 401, { error: 'Не авторизован' });
  }

  if (syncInProgress) {
    return sendJSON(res, 409, { error: 'Синхронизация уже выполняется' });
  }

  syncInProgress = true;
  syncLog = '';
  syncStatus = 'running';

  sendJSON(res, 200, { ok: true });

  // Запускаем night-sync асинхронно
  (async () => {
    try {
      const { execSync } = await import('child_process');
      const scriptPath = path.join(root, 'scripts', 'night-sync.mjs');
      
      if (!fs.existsSync(scriptPath)) {
        throw new Error('Скрипт night-sync.mjs не найден');
      }

      const output = execSync(`node "${scriptPath}"`, {
        cwd: root,
        encoding: 'utf-8',
        timeout: 3600000,
        stdio: 'pipe'
      });

      syncLog = output;
      syncStatus = 'done';
      console.log('✅ Синхронизация завершена');
    } catch (err) {
      syncLog = err.stdout || err.message;
      syncStatus = 'error';
      console.error('❌ Ошибка синхронизации:', err.message);
    } finally {
      syncInProgress = false;
    }
  })();
}

function handleSyncStatus(req, res) {
  sendJSON(res, 200, {
    status: syncStatus,
    log: syncLog
  });
}

// ============================================
// Парсинг DOCX
// ============================================

let parseInProgress = false;
let parseLog = '';
let parseStatus = 'idle';

async function handleParseDocs(req, res) {
  const token = extractTokenFromCookie(req.headers);
  if (!isValidSession(token)) {
    return sendJSON(res, 401, { error: 'Не авторизован' });
  }

  if (parseInProgress) {
    return sendJSON(res, 409, { error: 'Парсинг уже выполняется' });
  }

  parseInProgress = true;
  parseLog = '';
  parseStatus = 'running';

  sendJSON(res, 200, { ok: true });

  (async () => {
    try {
      const { execSync } = await import('child_process');
      const scriptPath = path.join(root, 'scripts', 'parse-docs.mjs');
      
      if (!fs.existsSync(scriptPath)) {
        throw new Error('Скрипт parse-docs.mjs не найден');
      }

      const output = execSync(`node "${scriptPath}"`, {
        cwd: root,
        encoding: 'utf-8',
        timeout: 600000,
        stdio: 'pipe'
      });

      parseLog = output;
      parseStatus = 'done';
      console.log('✅ Парсинг завершён');
    } catch (err) {
      parseLog = err.stdout || err.message;
      parseStatus = 'error';
      console.error('❌ Ошибка парсинга:', err.message);
    } finally {
      parseInProgress = false;
    }
  })();
}

function handleParseStatus(req, res) {
  sendJSON(res, 200, {
    status: parseStatus,
    log: parseLog
  });
}

// ============================================
// Email-уведомления (missing photos)
// ============================================

async function handleMissingPhotos(req, res) {
  const token = extractTokenFromCookie(req.headers);
  if (!isValidSession(token)) {
    return sendJSON(res, 401, { error: 'Не авторизован' });
  }

  const db = readDb();
  const missing = [];

  for (const t of (db.trainers || [])) {
    if (t.hidden) continue;
    if (t.image) continue;
    missing.push({ type: 'тренер', name: t.name, issue: 'Нет фото-обложки' });
  }
  for (const p of (db.programs || [])) {
    if (p.hidden) continue;
    if (p.image) continue;
    missing.push({ type: 'программа', name: p.name, issue: 'Нет фото-обложки' });
  }

  sendJSON(res, 200, { missing });
}

async function handleSendReminder(req, res) {
  const token = extractTokenFromCookie(req.headers);
  if (!isValidSession(token)) {
    return sendJSON(res, 401, { error: 'Не авторизован' });
  }

  const db = readDb();
  const missing = [];

  for (const t of (db.trainers || [])) {
    if (t.hidden) continue;
    if (t.image) continue;
    missing.push({ type: 'тренер', name: t.name, issue: 'Нет фото-обложки' });
  }
  for (const p of (db.programs || [])) {
    if (p.hidden) continue;
    if (p.image) continue;
    missing.push({ type: 'программа', name: p.name, issue: 'Нет фото-обложки' });
  }

  if (!missing.length) {
    return sendJSON(res, 200, { ok: true, message: 'Нет объектов для уведомления' });
  }

  // Пытаемся отправить email
  try {
    const nodemailer = (await import('nodemailer')).default;
    const emailConfig = db.emailConfig || {};
    const smtpHost = emailConfig.smtpHost || 'smtp.yandex.ru';
    const smtpPort = emailConfig.smtpPort || 465;
    const smtpSecure = emailConfig.smtpSecure !== false;
    const smtpUser = emailConfig.smtpUser;
    const smtpPass = emailConfig.smtpPass;
    const fromName = emailConfig.fromName || 'Робот-Автопарсер';
    const adminEmail = emailConfig.adminEmail;
    const errorEmail = emailConfig.errorEmail || [];

    if (!smtpUser || !smtpPass || !adminEmail) {
      return sendJSON(res, 200, { ok: false, error: 'SMTP-настройки неполные' });
    }

    let body = 'Уважаемые Коллеги!\nПросьба дозаполнить:\n';
    for (const m of missing) {
      body += `- ${m.type === 'тренер' ? 'Тренер' : 'Программа'} "${m.name}" — ${m.issue}.\n`;
    }
    body += '\nС Уважением, Ваш Робот-Автопарсер центр-фр.рф.';

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: { user: smtpUser, pass: smtpPass }
    });

    const recipients = [adminEmail, ...errorEmail].filter(Boolean);
    await transporter.sendMail({
      from: `"${fromName}" <${smtpUser}>`,
      to: recipients.join(', '),
      subject: 'Автоматическое заполнение сайта - уведомление о незаполненных объектах',
      text: body
    });

    sendJSON(res, 200, { ok: true, sent: missing.length, recipients });
  } catch (err) {
    sendJSON(res, 200, { ok: false, error: err.message });
  }
}

// ============================================
// Маршрутизация
// ============================================

const server = http.createServer(async (req, res) => {
  let url;
  try {
    url = new URL(req.url, `http://${req.headers.host}`);
  } catch {
    // Мусорный/некорректный request-target (например «//», сканеры, прокси) —
    // не должен ронять сервер (502 на весь сайт)
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bad Request');
    return;
  }
  const pathname = url.pathname;
  const method = req.method;

  // CORS для localhost (на всякий случай)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie');

  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // === Новости CRUD ===
  if (pathname === '/api/admin/get-news' && method === 'POST') {
    return handleGetNews(req, res);
  }
  if (pathname === '/api/admin/save-news' && method === 'POST') {
    return handleSaveNews(req, res);
  }
  if (pathname === '/api/admin/delete-news' && method === 'POST') {
    return handleDeleteNews(req, res);
  }
  if (pathname === '/api/admin/save-news-list' && method === 'POST') {
    return handleSaveNewsList(req, res);
  }

  // === Программы ===
  if (pathname === '/api/admin/get-programs' && method === 'POST') {
    return handleGetPrograms(req, res);
  }
  if (pathname === '/api/admin/save-programs' && method === 'POST') {
    return handleSavePrograms(req, res);
  }

  // === Тренеры ===
  if (pathname === '/api/admin/get-trainers' && method === 'POST') {
    return handleGetTrainers(req, res);
  }
  if (pathname === '/api/admin/save-trainers' && method === 'POST') {
    return handleSaveTrainers(req, res);
  }

  // === Синхронизация данных ===
  if (pathname === '/api/admin/sync-data' && method === 'POST') {
    return handleSyncData(req, res);
  }
  if (pathname === '/api/admin/sync-status' && method === 'GET') {
    return handleSyncStatus(req, res);
  }
  if (pathname === '/api/admin/parse-docs' && method === 'POST') {
    return handleParseDocs(req, res);
  }
  if (pathname === '/api/admin/parse-status' && method === 'GET') {
    return handleParseStatus(req, res);
  }

  // === Email-уведомления ===
  if (pathname === '/api/admin/missing-photos' && method === 'GET') {
    return handleMissingPhotos(req, res);
  }
  if (pathname === '/api/admin/send-reminder' && method === 'POST') {
    return handleSendReminder(req, res);
  }

  // === API ===
  if (pathname === '/api/admin/login' && method === 'POST') {
    return handleLogin(req, res);
  }
  if (pathname === '/api/admin/logout' && method === 'POST') {
    return handleLogout(req, res);
  }
  if (pathname === '/api/admin/save' && method === 'POST') {
    return handleSave(req, res);
  }
  if (pathname === '/api/admin/upload' && method === 'POST') {
    return handleUpload(req, res);
  }
  if (pathname === '/api/admin/delete' && method === 'POST') {
    return handleDelete(req, res);
  }

  // === Статика ===
  if (pathname === '/admin.html' || pathname === '/admin') {
    return sendFile(res, path.join(staticDir, 'admin.html'), 'text/html');
  }

  // Один порт (S42): весь сайт из static/ — /, *.html, css, js, uploads…
  if (method === 'GET' || method === 'HEAD') {
    const rel = pathname === '/' ? 'index.html' : decodeURIComponent(pathname.slice(1));
    const filePath = path.join(staticDir, rel);
    if (filePath.startsWith(staticDir + path.sep) || filePath === path.join(staticDir, 'index.html')) {
      try {
        const realPath = fs.realpathSync(filePath);
        if (realPath.startsWith(staticDir) && fs.statSync(realPath).isFile()) {
          const ext = path.extname(realPath).toLowerCase();
          const types = {
            '.html': 'text/html; charset=utf-8',
            '.js': 'application/javascript; charset=utf-8',
            '.css': 'text/css; charset=utf-8',
            '.json': 'application/json; charset=utf-8',
            '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
            '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml',
            '.ico': 'image/x-icon', '.mov': 'video/quicktime', '.mp4': 'video/mp4'
          };
          return sendFile(res, realPath, types[ext] || 'application/octet-stream');
        }
      } catch { /* файла нет — 404 ниже */ }
    }
  }

  // Старый префикс /static/* (Next.js-совместимость)
  if (pathname.startsWith('/static/')) {
    const filePath = path.join(root, pathname);
    try {
      const realPath = fs.realpathSync(filePath);
      if (!realPath.startsWith(path.join(root, 'static'))) {
        return sendFile(res, '', 'text/plain');
      }
      return sendFile(res, filePath, 'application/octet-stream');
    } catch { /* нет файла */ }
  }

  // 404
  sendFile(res, '', 'text/plain');
});

// ============================================
// Запуск
// ============================================

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n🚀 Админка запущена: http://127.0.0.1:${PORT}/admin.html`);
  console.log(`   Пароль: ${ADMIN_PASSWORD}`);
  console.log(`   Только localhost — не для продакшна!\n`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Сервер остановлен');
  process.exit(0);
});
