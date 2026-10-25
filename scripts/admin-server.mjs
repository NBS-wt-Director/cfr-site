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
import { flattenDb, nestDb, isNested, DATA_KEYS, SETTINGS_KEYS } from './db-format.mjs';

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

// Сессии: token → { createdAt }. Хранятся в файле, чтобы перезапуск PM2
// (или падение) не превращал админку в «висяк с пустыми списками»:
// токен в localStorage браузера переживает рестарт, а in-memory Map — нет.
const sessionsFile = path.join(root, '.admin-sessions.json');
const sessions = new Map();

function loadSessions() {
  try {
    const obj = JSON.parse(fs.readFileSync(sessionsFile, 'utf-8'));
    for (const [t, s] of Object.entries(obj || {})) {
      if (s && s.createdAt && Date.now() - s.createdAt <= SESSION_TTL_MS) sessions.set(t, s);
    }
  } catch { /* файла нет — стартуем с пустыми сессиями */ }
}

function persistSessions() {
  try { fs.writeFileSync(sessionsFile, JSON.stringify(Object.fromEntries(sessions))); }
  catch (e) { console.warn('Не удалось записать сессии:', e.message); }
}

loadSessions();

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
    // stdio:'pipe' + timeout: 'inherit' под PM2 может намертво заблокировать
    // процесс на записи в лог-пайп, а execSync без timeout вешает весь сервер
    execSync('npm run static:export', {
      cwd: root,
      stdio: 'pipe',
      timeout: 120000,
      maxBuffer: 16 * 1024 * 1024
    });
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
  persistSessions();
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

    // Запись db.json (S4: body.data может быть плоским или вложенным — пишем вложенный)
    fs.writeFileSync(dbPath, JSON.stringify(nestDb(flattenDb(body.data)), null, 2), 'utf-8');
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
    // S4: на диске может быть вложенный формат — обработчики работают с плоским
    return flattenDb(JSON.parse(fs.readFileSync(dbPath, 'utf-8')));
  } catch {
    return {};
  }
}

function writeDb(db) {
  // S4: всегда пишем вложенный формат (data.*/settings.*)
  fs.writeFileSync(dbPath, JSON.stringify(nestDb(db), null, 2), 'utf-8');
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
    const mediaPaths = [news.image, news.video, ...(Array.isArray(news.photos) ? news.photos : [])]
      .filter(Boolean);
    for (const val of mediaPaths) {
      try {
        const cleanPath = String(val).replace(/^\//, '');
        const fullPath = path.join(staticDir, cleanPath);
        const resolved = path.resolve(fullPath);
        if (resolved.startsWith(path.resolve(staticDir, 'uploads')) && fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
          console.log(`🗑 Удалён медиа: ${cleanPath}`);
        }
      } catch (e) {
        console.warn(`Не удалось удалить медиа ${val}: ${e.message}`);
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

  // Запускаем night-sync НЕБЛОКИРУЮЩИМ spawn.
  // execSync (даже внутри async-IIFE) блокирует event loop: весь API висит,
  // админка «замирает» без ошибок. spawn — сервер отвечает во время закачки.
  try {
    const { spawn } = await import('child_process');
    const scriptPath = path.join(root, 'scripts', 'night-sync.mjs');

    if (!fs.existsSync(scriptPath)) {
      throw new Error('Скрипт night-sync.mjs не найден');
    }

    const child = spawn('node', [scriptPath], { cwd: root });
    child.stdout.on('data', d => { syncLog = (syncLog + d).slice(-500000); });
    child.stderr.on('data', d => { syncLog = (syncLog + d).slice(-500000); });
    child.on('error', err => {
      syncLog += '\n' + err.message;
      syncStatus = 'error';
      syncInProgress = false;
      console.error('❌ Ошибка запуска синхронизации:', err.message);
    });
    child.on('close', code => {
      syncStatus = code === 0 ? 'done' : 'error';
      syncInProgress = false;
      console.log(code === 0 ? '✅ Синхронизация завершена' : `❌ Синхронизация завершилась с кодом ${code}`);
    });
  } catch (err) {
    syncLog = err.message;
    syncStatus = 'error';
    syncInProgress = false;
    console.error('❌ Ошибка синхронизации:', err.message);
  }
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

  // spawn вместо execSync — не блокирует event loop сервера
  try {
    const { spawn } = await import('child_process');
    const scriptPath = path.join(root, 'scripts', 'parse-docs.mjs');

    if (!fs.existsSync(scriptPath)) {
      throw new Error('Скрипт parse-docs.mjs не найден');
    }

    const child = spawn('node', [scriptPath], { cwd: root });
    child.stdout.on('data', d => { parseLog = (parseLog + d).slice(-500000); });
    child.stderr.on('data', d => { parseLog = (parseLog + d).slice(-500000); });
    child.on('error', err => {
      parseLog += '\n' + err.message;
      parseStatus = 'error';
      parseInProgress = false;
    });
    child.on('close', code => {
      parseStatus = code === 0 ? 'done' : 'error';
      parseInProgress = false;
      console.log(code === 0 ? '✅ Парсинг завершён' : `❌ Парсинг завершился с кодом ${code}`);
    });
  } catch (err) {
    parseLog = err.message;
    parseStatus = 'error';
    parseInProgress = false;
    console.error('❌ Ошибка парсинга:', err.message);
  }
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
  // Разделители (globalDivider)
  // ============================================

  async function handleGetDivider(req, res) {
    const token = extractTokenFromCookie(req.headers);
    if (!isValidSession(token)) {
      return sendJSON(res, 401, { error: 'Не авторизован' });
    }
    const db = readDb();
    sendJSON(res, 200, { divider: db.globalDivider || { enabled: false } });
  }

  async function handleSaveDivider(req, res) {
    const token = extractTokenFromCookie(req.headers);
    if (!isValidSession(token)) {
      return sendJSON(res, 401, { error: 'Не авторизован' });
    }
    const body = await readBody(req);
    const dividerData = body?.divider;
    if (!dividerData) {
      return sendJSON(res, 400, { error: 'Нет данных разделителя' });
    }
    try {
      const db = readDb();
      db.globalDivider = dividerData;
      backupDB();
      writeDb(db);
      regenerateStatic();
      sendJSON(res, 200, { ok: true });
    } catch (err) {
      console.error('❌ Ошибка сохранения разделителя:', err);
      sendJSON(res, 500, { error: err.message });
    }
  }

  // ============================================
  // Оформление (appearance) и просмотр данных (S73)
  // ============================================

  // Разрешены CSS-переменные текста (--fs-*, --fw-*, --ff-*, --lh-*)
  // и цвета сайта --color-* (S82: значения — строго hex #RRGGBB).
  const APPEARANCE_VAR_RE = /^--(fs|fw|ff|lh)-[a-z0-9-]+$/;
  const APPEARANCE_COLOR_RE = /^--color-[a-z0-9-]+$/;
  const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

  function sanitizeAppearance(raw) {
    const out = { variables: {}, customCss: '' };
    if (!raw || typeof raw !== 'object') return out;
    const vars = raw.variables;
    if (vars && typeof vars === 'object') {
      for (const [name, value] of Object.entries(vars)) {
        const isText = APPEARANCE_VAR_RE.test(name);
        const isColor = APPEARANCE_COLOR_RE.test(name);
        if (!isText && !isColor) continue;
        const v = String(value == null ? '' : value).trim();
        // Цвет (S82): только валидный hex
        if (isColor) {
          if (HEX_COLOR_RE.test(v)) out.variables[name] = v;
          continue;
        }
        // Значение — короткий скаляр без ; } < (защита от обрыва объявления)
        if (!v || v.length > 60 || /[;<>{}]/.test(v)) continue;
        out.variables[name] = v;
      }
    }
    if (typeof raw.customCss === 'string') {
      let css = raw.customCss.slice(0, 20000);
      css = css.replace(/<\/style/gi, '<\/style').replace(/@import[^;]*;?/gi, '');
      out.customCss = css;
    }
    return out;
  }

  async function handleGetAppearance(req, res) {
    const token = extractTokenFromCookie(req.headers);
    if (!isValidSession(token)) {
      return sendJSON(res, 401, { error: 'Не авторизован' });
    }
    const db = readDb();
    sendJSON(res, 200, { appearance: sanitizeAppearance(db.appearance) });
  }

  async function handleSaveAppearance(req, res) {
    const token = extractTokenFromCookie(req.headers);
    if (!isValidSession(token)) {
      return sendJSON(res, 401, { error: 'Не авторизован' });
    }
    const body = await readBody(req);
    if (!body?.appearance || typeof body.appearance !== 'object') {
      return sendJSON(res, 400, { error: 'Нет данных оформления' });
    }
    try {
      const db = readDb();
      db.appearance = sanitizeAppearance(body.appearance);
      backupDB();
      writeDb(db);
      regenerateStatic();
      sendJSON(res, 200, { ok: true });
    } catch (err) {
      console.error('❌ Ошибка сохранения оформления:', err);
      sendJSON(res, 500, { error: err.message });
    }
  }

  // ============================================
  // Разделение «данные» / «настройки» (S4)
  //   get-data     → data.* + прочие ключи верхнего уровня (без settings.*)
  //   get-settings → settings.* (для страниц настроек админки)
  //   save-data    → сохраняет data.*
  //   save-settings→ сохраняет settings.*
  // ============================================

  // Логотип-base64 вырезается — сотни КБ, в интерфейсе бесполезны.
  function stripLogo(siteSettings) {
    if (siteSettings && typeof siteSettings.logo === 'string' && siteSettings.logo.length > 200) {
      return { ...siteSettings, logo: '(base64 логотип, ' + siteSettings.logo.length + ' симв.)' };
    }
    return siteSettings;
  }

  async function handleGetData(req, res) {
    const token = extractTokenFromCookie(req.headers);
    if (!isValidSession(token)) {
      return sendJSON(res, 401, { error: 'Не авторизован' });
    }
    const db = readDb();
    // Только «данные» + ключи верхнего уровня; настройки — отдельный endpoint
    const data = {};
    for (const [k, v] of Object.entries(db)) {
      if (SETTINGS_KEYS.includes(k)) continue;
      data[k] = v;
    }
    sendJSON(res, 200, { data });
  }

  async function handleGetSettings(req, res) {
    const token = extractTokenFromCookie(req.headers);
    if (!isValidSession(token)) {
      return sendJSON(res, 401, { error: 'Не авторизован' });
    }
    const db = readDb();
    const settings = {};
    for (const k of SETTINGS_KEYS) {
      if (db[k] !== undefined) settings[k] = k === 'siteSettings' ? stripLogo(db[k]) : db[k];
    }
    sendJSON(res, 200, { settings });
  }

  async function handleSaveData(req, res) {
    const token = extractTokenFromCookie(req.headers);
    if (!isValidSession(token)) {
      return sendJSON(res, 401, { error: 'Не авторизован' });
    }
    const body = await readBody(req);
    if (!body?.data || typeof body.data !== 'object') {
      return sendJSON(res, 400, { error: 'Нет данных' });
    }
    try {
      const db = readDb();
      // Сохраняем только ключи «данных» и ключи верхнего уровня — settings не трогаем
      for (const [k, v] of Object.entries(body.data)) {
        if (SETTINGS_KEYS.includes(k)) continue;
        if (k === 'data' && isNested(body.data)) { Object.assign(db, flattenDb(body.data)); break; }
        db[k] = v;
      }
      backupDB();
      writeDb(db);
      regenerateStatic();
      sendJSON(res, 200, { ok: true });
    } catch (err) {
      console.error('❌ Ошибка сохранения данных:', err);
      sendJSON(res, 500, { error: err.message });
    }
  }

  async function handleSaveSettings(req, res) {
    const token = extractTokenFromCookie(req.headers);
    if (!isValidSession(token)) {
      return sendJSON(res, 401, { error: 'Не авторизован' });
    }
    const body = await readBody(req);
    if (!body?.settings || typeof body.settings !== 'object') {
      return sendJSON(res, 400, { error: 'Нет настроек' });
    }
    try {
      const db = readDb();
      for (const [k, v] of Object.entries(body.settings)) {
        if (!SETTINGS_KEYS.includes(k)) continue;
        // base64-заглушка из get-settings не должна затирать реальный логотип
        if (k === 'siteSettings' && typeof v.logo === 'string' && v.logo.startsWith('(base64')) continue;
        db[k] = v;
      }
      backupDB();
      writeDb(db);
      regenerateStatic();
      sendJSON(res, 200, { ok: true });
    } catch (err) {
      console.error('❌ Ошибка сохранения настроек:', err);
      sendJSON(res, 500, { error: err.message });
    }
  }

  // ============================================
  // Главные данные (S75)
  // ============================================
  async function handleGetSiteSettings(req, res) {
    const token = extractTokenFromCookie(req.headers);
    if (!isValidSession(token)) {
      return sendJSON(res, 401, { error: 'Не авторизован' });
    }
    const db = readDb();
    const settings = db.siteSettings || { title1: 'Шифу Панда', title2: 'Центр Функционального Развития', logo: '' };
    sendJSON(res, 200, { siteSettings: settings });
  }

  async function handleSaveSiteSettings(req, res) {
    const token = extractTokenFromCookie(req.headers);
    if (!isValidSession(token)) {
      return sendJSON(res, 401, { error: 'Не авторизован' });
    }
    const body = await readBody(req);
    if (!body?.siteSettings || typeof body.siteSettings !== 'object') {
      return sendJSON(res, 400, { error: 'Нет данных' });
    }
    try {
      const db = readDb();
      if (!db.siteSettings) db.siteSettings = {};
      db.siteSettings.title1 = String(body.siteSettings.title1 || 'Шифу Панда');
      db.siteSettings.title2 = String(body.siteSettings.title2 || 'Центр Функционального Развития');
      // logo: путь uploads/... или data: URI (наследие) — оба допустимы
      if (body.siteSettings.logo && typeof body.siteSettings.logo === 'string') {
        const l = body.siteSettings.logo.trim();
        db.siteSettings.logo = l.startsWith('data:') ? l : l.replace(/^\//, '');
      }
      backupDB();
      writeDb(db);
      regenerateStatic();
      sendJSON(res, 200, { ok: true });
    } catch (err) {
      console.error('❌ Ошибка сохранения siteSettings:', err);
      sendJSON(res, 500, { error: err.message });
    }
  }

  // ============================================
  // Расписание (S76)
  // ============================================
  async function handleSaveSchedule(req, res) {
    const token = extractTokenFromCookie(req.headers);
    if (!isValidSession(token)) {
      return sendJSON(res, 401, { error: 'Не авторизован' });
    }
    const body = await readBody(req);
    if (!body?.schedule || !Array.isArray(body.schedule)) {
      return sendJSON(res, 400, { error: 'Нет данных расписания' });
    }
    try {
      const db = readDb();
      // Удаляем старые файлы, если новые не переданы
      const oldSchedule = db.schedule || [];
      for (const oldItem of oldSchedule) {
        const oldPath = oldItem.image && oldItem.image.replace(/^\//, '');
        const newPath = body.schedule.find(x => x.id === oldItem.id);
        if (oldPath && (!newPath || !newPath.image)) {
          // Удаляем старый файл, если новый не передан
          const fullPath = path.join(staticDir, oldPath);
          try { if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath); } catch (e) { /* ignore */ }
        }
      }
      db.schedule = body.schedule.map((item, idx) => ({
        id: item.id || idx + 1,
        day: item.day || '',
        time: item.time || '',
        trainerId: item.trainerId || null,
        programId: item.programId || null,
        title: item.title || 'Тренировка',
        image: item.image || '',
        visible: item.visible !== false,
        archived: item.archived || false,
        order: item.order ?? idx
      }));
      backupDB();
      writeDb(db);
      regenerateStatic();
      sendJSON(res, 200, { ok: true });
    } catch (err) {
      console.error('❌ Ошибка сохранения schedule:', err);
      sendJSON(res, 500, { error: err.message });
    }
  }

  // S3: CRUD для расписания
  async function handleGetSchedule(req, res) {
    const token = extractTokenFromCookie(req.headers);
    if (!isValidSession(token)) {
      return sendJSON(res, 401, { error: 'Не авторизован' });
    }
    const db = readDb();
    sendJSON(res, 200, { schedule: db.schedule || [] });
  }

  async function handleDeleteScheduleItem(req, res) {
    const token = extractTokenFromCookie(req.headers);
    if (!isValidSession(token)) {
      return sendJSON(res, 401, { error: 'Не авторизован' });
    }
    const body = await readBody(req);
    const id = body?.id;
    if (!id) {
      return sendJSON(res, 400, { error: 'Нет id' });
    }
    try {
      const db = readDb();
      const idx = db.schedule.findIndex(s => s.id === id);
      if (idx === -1) {
        return sendJSON(res, 404, { error: 'Не найдено' });
      }
      const item = db.schedule[idx];
      // Удаляем файл изображения
      if (item.image) {
        const fullPath = path.join(staticDir, item.image.replace(/^\//, ''));
        try { if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath); } catch (e) { /* ignore */ }
      }
      db.schedule.splice(idx, 1);
      backupDB();
      writeDb(db);
      regenerateStatic();
      sendJSON(res, 200, { ok: true });
    } catch (err) {
      console.error('❌ Ошибка удаления schedule item:', err);
      sendJSON(res, 500, { error: err.message });
    }
  }

  // ============================================
  // Цены (S77)
  // ============================================
  async function handleSavePrices(req, res) {
    const token = extractTokenFromCookie(req.headers);
    if (!isValidSession(token)) {
      return sendJSON(res, 401, { error: 'Не авторизован' });
    }
    const body = await readBody(req);
    if (!body?.prices || !Array.isArray(body.prices)) {
      return sendJSON(res, 400, { error: 'Нет данных цен' });
    }
    try {
      const db = readDb();
      const oldPrices = db.prices || [];
      for (const oldItem of oldPrices) {
        const oldPath = oldItem.image && oldItem.image.replace(/^\//, '');
        const newPath = body.prices.find(x => x.id === oldItem.id);
        if (oldPath && (!newPath || !newPath.image)) {
          const fullPath = path.join(staticDir, oldPath);
          try { if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath); } catch (e) { /* ignore */ }
        }
      }
      db.prices = body.prices.map((item, idx) => ({
        id: item.id || idx + 1,
        image: item.image || '',
        title: item.title || 'Прайс'
      }));
      backupDB();
      writeDb(db);
      regenerateStatic();
      sendJSON(res, 200, { ok: true });
    } catch (err) {
      console.error('❌ Ошибка сохранения prices:', err);
      sendJSON(res, 500, { error: err.message });
    }
  }

  // ============================================
  // Настройки расписания (S2)
  // ============================================
  async function handleSaveScheduleSettings(req, res) {
    const token = extractTokenFromCookie(req.headers);
    if (!isValidSession(token)) {
      return sendJSON(res, 401, { error: 'Не авторизован' });
    }
    const body = await readBody(req);
    if (!body?.scheduleSettings || typeof body.scheduleSettings !== 'object') {
      return sendJSON(res, 400, { error: 'Нет данных настроек расписания' });
    }
    try {
      const db = readDb();
      db.scheduleSettings = {
        defaultView: ['images', 'table', 'hybrid'].includes(body.scheduleSettings.defaultView)
          ? body.scheduleSettings.defaultView
          : 'images',
        // S84: hybridActiveTab трёхзначный — как переключатель на главной
        // ('hybrid' = картинки и таблица одновременно)
        hybridActiveTab: ['images', 'table', 'hybrid'].includes(body.scheduleSettings.hybridActiveTab)
          ? body.scheduleSettings.hybridActiveTab
          : 'images'
      };
      backupDB();
      writeDb(db);
      regenerateStatic();
      sendJSON(res, 200, { ok: true });
    } catch (err) {
      console.error('❌ Ошибка сохранения scheduleSettings:', err);
      sendJSON(res, 500, { error: err.message });
    }
  }

  // ============================================
  // Занятия расписания (S3): scheduleStructured программ
  // ============================================
  async function handleSaveScheduleSlots(req, res) {
    const token = extractTokenFromCookie(req.headers);
    if (!isValidSession(token)) {
      return sendJSON(res, 401, { error: 'Не авторизован' });
    }
    const body = await readBody(req);
    if (!body?.programs || !Array.isArray(body.programs)) {
      return sendJSON(res, 400, { error: 'Нет данных программ' });
    }
    try {
      const db = readDb();
      const programs = db.programs || [];
      for (const prog of body.programs) {
        const idx = programs.findIndex(p => Number(p.id) === Number(prog.id));
        if (idx === -1) continue;
        programs[idx].scheduleStructured = (prog.scheduleStructured || []).map(s => ({
          day: s.day || '',
          time: s.time || '',
          place: s.place || '',
          hall: ['big', 'small'].includes(s.hall) ? s.hall : 'big',
          mode: ['hall', 'online', 'hybrid'].includes(s.mode) ? s.mode : 'hybrid',
          trainerId: s.trainerId != null ? Number(s.trainerId) : null,
          visible: s.visible !== false
        }));
      }
      db.programs = programs;
      backupDB();
      writeDb(db);
      regenerateStatic();
      sendJSON(res, 200, { ok: true });
    } catch (err) {
      console.error('❌ Ошибка сохранения занятий расписания:', err);
      sendJSON(res, 500, { error: err.message });
    }
  }

  // ============================================
  // Настройки электронной почты (S7)
  // ============================================

  async function handleGetEmailConfig(req, res) {
    const token = extractTokenFromCookie(req.headers);
    if (!isValidSession(token)) {
      return sendJSON(res, 401, { error: 'Не авторизован' });
    }
    const db = readDb();
    const config = db.emailConfig || {
      smtpHost: 'smtp.yandex.ru',
      smtpPort: 465,
      smtpSecure: true,
      smtpUser: '',
      smtpPass: '',
      fromName: 'Робот-Автопарсер',
      adminEmail: '',
      errorEmail: []
    };
    // Не отправляем пароль в открытом виде при получении — оставляем пустым
    config.smtpPass = '';
    sendJSON(res, 200, { emailConfig: config });
  }

  async function handleSaveEmailConfig(req, res) {
    const token = extractTokenFromCookie(req.headers);
    if (!isValidSession(token)) {
      return sendJSON(res, 401, { error: 'Не авторизован' });
    }
    const body = await readBody(req);
    if (!body?.emailConfig || typeof body.emailConfig !== 'object') {
      return sendJSON(res, 400, { error: 'Нет данных настроек почты' });
    }
    const ec = body.emailConfig;
    try {
      const db = readDb();
      if (!db.emailConfig) db.emailConfig = {};
      db.emailConfig.smtpHost = String(ec.smtpHost || 'smtp.yandex.ru').trim();
      db.emailConfig.smtpPort = parseInt(ec.smtpPort, 10) || 465;
      db.emailConfig.smtpSecure = ec.smtpSecure !== false;
      db.emailConfig.smtpUser = String(ec.smtpUser || '').trim();
      // Пароль сохраняется только если не пустой
      if (ec.smtpPass && typeof ec.smtpPass === 'string' && ec.smtpPass.trim()) {
        db.emailConfig.smtpPass = ec.smtpPass.trim();
      }
      db.emailConfig.fromName = String(ec.fromName || 'Робот-Автопарсер').trim();
      db.emailConfig.adminEmail = String(ec.adminEmail || '').trim();
      // errorEmail — строка или массив
      if (Array.isArray(ec.errorEmail)) {
        db.emailConfig.errorEmail = ec.errorEmail.map(e => String(e || '').trim()).filter(Boolean);
      } else if (typeof ec.errorEmail === 'string') {
        db.emailConfig.errorEmail = ec.errorEmail.split(',').map(e => String(e || '').trim()).filter(Boolean);
      }
      backupDB();
      writeDb(db);
      regenerateStatic();
      sendJSON(res, 200, { ok: true });
    } catch (err) {
      console.error('❌ Ошибка сохранения emailConfig:', err);
      sendJSON(res, 500, { error: err.message });
    }
  }

  async function handleSendTestEmail(req, res) {
    const token = extractTokenFromCookie(req.headers);
    if (!isValidSession(token)) {
      return sendJSON(res, 401, { error: 'Не авторизован' });
    }
    const body = await readBody(req);
    const toEmail = body?.toEmail;
    if (!toEmail || !toEmail.includes('@')) {
      return sendJSON(res, 400, { error: 'Неверный email получателя' });
    }
    try {
      const db = readDb();
      const emailConfig = db.emailConfig || {};
      const smtpHost = emailConfig.smtpHost || 'smtp.yandex.ru';
      const smtpPort = emailConfig.smtpPort || 465;
      const smtpSecure = emailConfig.smtpSecure !== false;
      const smtpUser = emailConfig.smtpUser;
      const smtpPass = emailConfig.smtpPass;
      const fromName = emailConfig.fromName || 'Робот-Автопарсер';

      if (!smtpUser || !smtpPass) {
        return sendJSON(res, 200, { ok: false, error: 'SMTP-настройки неполные (нужны user и pass)' });
      }

      const nodemailer = (await import('nodemailer')).default;
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: { user: smtpUser, pass: smtpPass }
      });

      await transporter.sendMail({
        from: `"${fromName}" <${smtpUser}>`,
        to: toEmail,
        subject: 'Тестовое письмо — ЦФР Админка',
        text: 'Это тестовое письмо от админки сайта ЦФР. Если вы его получили — SMTP настроен правильно!'
      });

      sendJSON(res, 200, { ok: true, message: 'Тестовое письмо отправлено на ' + toEmail });
    } catch (err) {
      console.error('❌ Ошибка отправки тестового письма:', err.message);
      sendJSON(res, 200, { ok: false, error: err.message });
    }
  }

  // ============================================
  // Справка для администраторов (S8)
  // ============================================

  const DEFAULT_HELP_SECTIONS = [
    {
      id: 'news',
      title: '📰 Новости',
      content: `# Управление новостями\n\nЗдесь можно добавлять, редактировать и удалять новости сайта.\n\n## Возможности:\n- Добавление новых новостей с датой, заголовком и текстом\n- Загрузка обложки и видео\n- Множественные фото для новости\n- Настройка отображения на главной странице\n- Изменение порядка перетаскиванием\n\n## Поля новости:\n- **Заголовок** — отображается на главной и в списке\n- **Текст** — полное содержание новости (поддерживает markdown)\n- **Дата** — когда новость публикуется\n- **Обложка** — главное изображение\n- **Фото** — дополнительные фотографии\n- **Видео** — ссылка на видео\n- **На главной** — показывать ли на главной странице`,
      category: 'data'
    },
    {
      id: 'programs',
      title: '🥋 Программы тренировок',
      content: `# Программы тренировок\n\nУправление программами тренировок, которые отображаются на сайте.\n\n## Возможности:\n- Добавление программ с описанием\n- Загрузка обложки\n- Привязка фотоальбома\n- Категории программ\n\n## Поля программы:\n- **Название** — отображается в карточке\n- **Категория** — группа программ\n- **Описание** — текст программы\n- **Обложка** — главное изображение\n- **Фотоальбом** — дополнительные фото`,
      category: 'data'
    },
    {
      id: 'trainers',
      title: '👨‍🏫 Тренеры',
      content: `# Тренеры\n\nУправление информацией о тренерах центра.\n\n## Возможности:\n- Добавление тренеров с фото\n- Указание опыта и специализации\n- Описание\n- Фотоальбом тренера\n\n## Поля тренера:\n- **Имя** — отображается на карточке\n- **Фото** — портрет тренера\n- **Опыт** — стаж работы\n- **Специализация** — направления\n- **Описание** — биография и достижения`,
      category: 'data'
    },
    {
      id: 'schedule',
      title: '📅 Расписание',
      content: `# Расписание\n\nУправление расписанием занятий.\n\n## Режимы отображения:\n- **Картинки** — только изображения занятий\n- **Таблица** — таблица с расписанием\n- **Гибрид** — обе вкладки\n\n## Возможности:\n- Переключение режима отображения на сайте\n- CRUD для занятий\n- Привязка к тренерам и программам\n- Выбор зала (большой/малый)\n- Режим проведения (зал/онлайн/гибрид)\n- Видимость и архивирование\n\n## Поля занятия:\n- **День** — день недели\n- **Время** — временной интервал\n- **Тренер** — привязка к тренеру\n- **Программа** — привязка к программе\n- **Зал** — большой или малый\n- **Режим** — зал, онлайн или гибрид`,
      category: 'data'
    },
    {
      id: 'prices',
      title: '💰 Цены',
      content: `# Цены\n\nУправление прайс-листами.\n\n## Возможности:\n- Загрузка изображений прайс-листов\n- Несколько прайсов\n\n## Поля:\n- **Изображение** — файл прайс-листа\n- **Заголовок** — описание прайса`,
      category: 'data'
    },
    {
      id: 'album',
      title: '📸 Альбом',
      content: `# Фотоальбом\n\nСвободные фотографии общего альбома.\n\n## Возможности:\n- Просмотр фото\n- Загрузка через ночного парсера\n- Привязка к программам и тренерам\n\n## Поля фото:\n- **Изображение** — файл фото\n- **Миниатюра** — уменьшенная копия\n- **Заголовок** — описание\n- **Дата** — дата загрузки`,
      category: 'data'
    },
    {
      id: 'appearance',
      title: '🖌 Оформление',
      content: `# Оформление сайта\n\nНастройка внешнего вида сайта.\n\n## Возможности:\n- Редактор CSS-переменных\n- Цветовая схема (в будущих версиях)\n- Кастомный CSS\n\n## CSS-переменные:\n- **--fs-*** — размеры шрифтов\n- **--fw-*** — начертания\n- **--ff-*** — шрифты\n- **--lh-*** — межстрочные интервалы`,
      category: 'settings'
    },
    {
      id: 'email',
      title: '✉️ Настройки электронной почты',
      content: `# Настройки электронной почты\n\nSMTP-настройки для отправки уведомлений.\n\n## Возможности:\n- Настройка SMTP-сервера\n- Тестовая отправка писем\n- Настройка адресов для ошибок\n\n## Поля:\n- **SMTP-хост** — адрес SMTP-сервера\n- **SMTP-порт** — порт (465 для SSL, 587 для TLS)\n- **SSL/TLS** — использовать защищённое соединение\n- **Пользователь** — логин SMTP\n- **Пароль** — пароль SMTP\n- **Имя отправителя** — отображается в письмах\n- **Email админа** — основной адрес\n- **Email ошибок** — через запятую`,
      category: 'settings'
    },
    {
      id: 'contacts',
      title: '📞 Контакты',
      content: `# Контакты\n\nКонтактная информация сайта.\n\n## Поля:\n- **Адрес** — физический адрес\n- **Телефон** — контактный телефон\n- **Email** — электронная почта\n- **ВКонтакте** — ссылка на группу\n- **Telegram** — ссылка на канал\n- **Соцсети** — список соцсетей`,
      category: 'settings'
    },
    {
      id: 'slider',
      title: '🎞 Слайдер',
      content: `# Слайдер главной страницы\n\nУправление слайдами на главной странице.\n\n## Поля:\n- **Заголовок** — текст слайда\n- **Изображение** — фон слайда\n- **Интервал** — время показа (сек)\n- **Позиция** — порядок`,
      category: 'settings'
    },
    {
      id: 'dividers',
      title: '🎨 Разделители',
      content: `# Разделители\n\nНастройка видимых разделителей между секциями.\n\n## Поля:\n- **Включены** — показать разделители\n- **Текст** — текст разделителя\n- **Высота** — высота линии\n- **Фон** — цвет фона\n- **Размер шрифта** — размер текста`,
      category: 'settings'
    },
    {
      id: 'main-data',
      title: '🏠 Главные данные',
      content: `# Главные данные сайта\n\nОсновные настройки сайта.\n\n## Поля:\n- **Логотип** — favicon и шапка\n- **Первое название** — текст в шапке, alt логотипа\n- **Второе название** — footer, title страницы`,
      category: 'settings'
    }
  ];

  function getHelpSections() {
    const db = readDb();
    const help = db.help || { sections: [] };
    // Добавляем дефолтные секции, которых нет
    const existingIds = new Set(help.sections.map(s => s.id));
    for (const def of DEFAULT_HELP_SECTIONS) {
      if (!existingIds.has(def.id)) {
        help.sections.push({ ...def });
      }
    }
    return help;
  }

  async function handleGetHelp(req, res) {
    const token = extractTokenFromCookie(req.headers);
    if (!isValidSession(token)) {
      return sendJSON(res, 401, { error: 'Не авторизован' });
    }
    const help = getHelpSections();
    sendJSON(res, 200, { help });
  }

  async function handleSaveHelp(req, res) {
    const token = extractTokenFromCookie(req.headers);
    if (!isValidSession(token)) {
      return sendJSON(res, 401, { error: 'Не авторизован' });
    }
    const body = await readBody(req);
    if (!body?.help || !Array.isArray(body.help.sections)) {
      return sendJSON(res, 400, { error: 'Нет данных справки' });
    }
    try {
      const db = readDb();
      db.help = { sections: body.help.sections };
      backupDB();
      writeDb(db);
      regenerateStatic();
      sendJSON(res, 200, { ok: true });
    } catch (err) {
      console.error('❌ Ошибка сохранения help:', err);
      sendJSON(res, 500, { error: err.message });
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

  // === Разделители ===
  if (pathname === '/api/admin/get-divider' && method === 'POST') {
    return handleGetDivider(req, res);
  }
  if (pathname === '/api/admin/save-divider' && method === 'POST') {
    return handleSaveDivider(req, res);
  }

  // === Оформление (S73) + просмотр данных ===
  if (pathname === '/api/admin/get-appearance' && method === 'POST') {
    return handleGetAppearance(req, res);
  }
  if (pathname === '/api/admin/save-appearance' && method === 'POST') {
    return handleSaveAppearance(req, res);
  }
  if (pathname === '/api/admin/get-data' && method === 'POST') {
    return handleGetData(req, res);
  }
  // Разделение данных/настроек (S4)
  if (pathname === '/api/admin/get-settings' && method === 'POST') {
    return handleGetSettings(req, res);
  }
  if (pathname === '/api/admin/save-data' && method === 'POST') {
    return handleSaveData(req, res);
  }
  if (pathname === '/api/admin/save-settings' && method === 'POST') {
    return handleSaveSettings(req, res);
  }

  // Главные данные (S75)
  if (pathname === '/api/admin/get-site-settings' && method === 'POST') {
    return handleGetSiteSettings(req, res);
  }
  if (pathname === '/api/admin/save-site-settings' && method === 'POST') {
    return handleSaveSiteSettings(req, res);
  }

  // Расписание (S76 + S3)
  if (pathname === '/api/admin/save-schedule' && method === 'POST') {
    return handleSaveSchedule(req, res);
  }
  if (pathname === '/api/admin/get-schedule' && method === 'POST') {
    return handleGetSchedule(req, res);
  }
  if (pathname === '/api/admin/delete-schedule-item' && method === 'POST') {
    return handleDeleteScheduleItem(req, res);
  }

  // Цены (S77)
  if (pathname === '/api/admin/save-prices' && method === 'POST') {
    return handleSavePrices(req, res);
  }

  // Настройки расписания (S2)
  if (pathname === '/api/admin/save-schedule-settings' && method === 'POST') {
    return handleSaveScheduleSettings(req, res);
  }
  // Занятия расписания (S3)
  if (pathname === '/api/admin/save-schedule-slots' && method === 'POST') {
    return handleSaveScheduleSlots(req, res);
  }

  // Экспорт БД (S6)
  if (pathname === '/api/admin/export-db' && method === 'POST') {
    return handleExportDB(req, res);
  }

  // Настройки электронной почты (S7)
  if (pathname === '/api/admin/get-email-config' && method === 'POST') {
    return handleGetEmailConfig(req, res);
  }
  if (pathname === '/api/admin/save-email-config' && method === 'POST') {
    return handleSaveEmailConfig(req, res);
  }
  if (pathname === '/api/admin/send-test-email' && method === 'POST') {
    return handleSendTestEmail(req, res);
  }

  // Справка (S8)
  if (pathname === '/api/admin/get-help' && method === 'POST') {
    return handleGetHelp(req, res);
  }
  if (pathname === '/api/admin/save-help' && method === 'POST') {
    return handleSaveHelp(req, res);
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
// Экспорт БД (S6 — механизм забора данных с прода на дев)
// ============================================

// Rate limiting: IP → { count, windowStart }
const exportRateLimit = new Map();
const EXPORT_RATE_LIMIT_MAX = 5;       // запросов
const EXPORT_RATE_LIMIT_WINDOW = 60;   // секунд
const EXPORT_MAX_SIZE = 10 * 1024 * 1024; // 10 МБ

function checkExportRateLimit(ip) {
  const now = Date.now();
  const entry = exportRateLimit.get(ip);
  if (!entry) {
    exportRateLimit.set(ip, { count: 1, windowStart: now });
    return true;
  }
  if (now - entry.windowStart > EXPORT_RATE_LIMIT_WINDOW * 1000) {
    // Окно истекло — сброс
    exportRateLimit.set(ip, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= EXPORT_RATE_LIMIT_MAX) {
    return false; // превышен лимит
  }
  entry.count++;
  return true;
}

async function handleExportDB(req, res) {
  const token = extractTokenFromCookie(req.headers);
  if (!isValidSession(token)) {
    return sendJSON(res, 401, { error: 'Не авторизован' });
  }

  // Rate limiting по IP
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
  if (!checkExportRateLimit(ip)) {
    return sendJSON(res, 429, { error: 'Слишком много запросов. Лимит: 5 запросов в минуту.' });
  }

  try {
    const raw = fs.readFileSync(dbPath, 'utf-8');
    const size = raw.length;
    if (size > EXPORT_MAX_SIZE) {
      return sendJSON(res, 413, { error: `Файл слишком большой: ${(size / 1024 / 1024).toFixed(1)} МБ (макс. 10 МБ)` });
    }

    // Валидируем JSON
    const data = JSON.parse(raw);
    sendJSON(res, 200, { data, size, sizeMB: (size / 1024 / 1024).toFixed(2) });
  } catch (err) {
    console.error('❌ Ошибка экспорта БД:', err.message);
    sendJSON(res, 500, { error: 'Ошибка чтения БД: ' + err.message });
  }
}

// ============================================
// Запуск
// ============================================

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n🚀 Админка запущена: http://127.0.0.1:${PORT}/admin.html`);
  console.log(`   Пароль: ${ADMIN_PASSWORD}`);
  console.log(`   Только localhost — не для продакшна!\n`);
  // Сигнал готовности для PM2 (ecosystem: wait_ready: true)
  if (typeof process.send === 'function') process.send('ready');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Сервер остановлен');
  process.exit(0);
});
