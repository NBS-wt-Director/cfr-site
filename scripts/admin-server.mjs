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
import os from 'os';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { flattenDb, nestDb, isNested, DATA_KEYS, SETTINGS_KEYS } from './db-format.mjs';
import { renderSitemap, renderRobots } from './lib/sitemap.mjs';

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

// S126: сменённый в админке пароль хранится ВНЕ репозитория (.gitignore) —
// sha256+salt, а не открытый текст. Приоритет выше, чем ADMIN_PASSWORD из env:
// файл есть → проверяем по нему, файла нет → проверяем по окружению.
const passwordFile = path.join(root, '.admin-password.json');

function loadPasswordRecord() {
  try {
    const rec = JSON.parse(fs.readFileSync(passwordFile, 'utf-8'));
    if (rec && typeof rec.hash === 'string' && typeof rec.salt === 'string' &&
        rec.hash.length === 64 && rec.salt.length >= 16) return rec;
  } catch { /* файла нет или повреждён — используем пароль из окружения */ }
  return null;
}

function hashPassword(password, salt) {
  return crypto.createHash('sha256').update(salt + ':' + password).digest('hex');
}

function checkPassword(password) {
  const rec = loadPasswordRecord();
  if (rec) return hashPassword(String(password || ''), rec.salt) === rec.hash;
  return String(password || '') === ADMIN_PASSWORD;
}

// Смена пароля: min длина 8, хранится sha256+salt вне репозитория.
// Возвращает null при успехе или текст ошибки.
function changePassword(newPassword) {
  const pw = String(newPassword || '');
  if (pw.length < 8) return 'Пароль должен быть не короче 8 символов';
  const salt = crypto.randomBytes(16).toString('hex');
  const rec = { salt, hash: hashPassword(pw, salt), changedAt: new Date().toISOString() };
  try {
    fs.writeFileSync(passwordFile, JSON.stringify(rec, null, 2) + '\n', { mode: 0o600 });
  } catch (err) {
    return 'Не удалось записать файл пароля: ' + err.message;
  }
  // Старые сессии инвалидируем: пароль сменился — все должны перелогиниться
  sessions.clear();
  try { fs.unlinkSync(sessionsFile); } catch { /* файла могло не быть */ }
  return null;
}

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
      '.ttf': 'font/ttf',
      // S133: sitemap.xml и robots.txt — с правильным MIME (иначе скачивание вместо чтения роботом)
      '.xml': 'application/xml; charset=utf-8',
      '.txt': 'text/plain; charset=utf-8',
      '.webmanifest': 'application/manifest+json'
    };
    // S144: HTML — no-cache, чтобы браузер всегда получал свежую админку/страницы
    // (эвристическое кэширование без заголовков держало старый admin.html часами).
    // CSS/JS инвалидируются версией ?v= в URL — для них кэш полезен.
    const headers = { 'Content-Type': types[ext] || contentType };
    if (ext === '.html') headers['Cache-Control'] = 'no-cache';
    res.writeHead(200, headers);
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

  if (!checkPassword(password)) {
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

  // S140: защита от перезаписи непустой базы пустыми данными
  const validation = validateDbData(body.data);
  if (!validation.ok) {
    console.error('❌ S140: отклонена запись —', validation.error);
    return sendJSON(res, 400, { error: validation.error });
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

/**
 * S140: валидация БД перед записью.
 * Не разрешает перезаписывать непустую базу пустыми/непол данными.
 * Возвращает { ok: true } или { ok: false, error: '...' }.
 */
function validateDbData(newData) {
  // Извлекаем data (вложенный формат)
  const flat = flattenDb(newData);
  const data = flat.data || {};
  const settings = flat.settings || {};

  // Обязательные ключи в data (допустимы пустые массивы — их запрещает только 0)
  const requiredDataKeys = ['news', 'programs', 'trainers'];
  for (const key of requiredDataKeys) {
    if (!Array.isArray(data[key]) || data[key].length === 0) {
      return { ok: false, error: `Безопасная блокировка: data.${key} отсутствует или пуст. Запись непустой базы пустыми данными запрещена.` };
    }
  }

  // settings должны содержать хотя бы core-настройки
  const requiredSettingsKeys = ['appearance', 'siteSettings'];
  for (const key of requiredSettingsKeys) {
    if (!settings[key] && typeof settings[key] !== 'object') {
      return { ok: false, error: `Безопасная блокировка: settings.${key} отсутствует. Запись непустой базы пустыми данными запрещена.` };
    }
  }

  return { ok: true };
}

function previewOf(text) {
  return text.replace(/[*_~\[\]#()]/g, '').replace(/\n/g, ' ').trim().substring(0, 200);
}

// S129: санитизация новости + новые поля (hidden, category, pinned, programId,
// trainerId, updatedAt). Существующие поля сохраняются; лимит 9999 видимых
// символов снимает разметку и обрезает текст, а не отклоняет запись.
function sanitizeNews(item) {
  if (!item || typeof item !== 'object') return null;
  const title = String(item.title || '').slice(0, 50);
  if (!title) return null;
  const text = typeof item.text === 'string' ? item.text : '';
  return {
    id: item.id != null ? Number(item.id) : null,
    title,
    text,
    date: typeof item.date === 'string' ? item.date : '',
    image: typeof item.image === 'string' ? item.image.replace(/^\//, '') : '',
    video: typeof item.video === 'string' ? item.video.replace(/^\//, '') : '',
    photos: Array.isArray(item.photos) ? item.photos.map(p => String(p).replace(/^\//, '')).filter(Boolean).slice(0, 5) : [],
    showOnHome: item.showOnHome !== false,
    hidden: item.hidden === true,
    category: typeof item.category === 'string' ? item.category.slice(0, 60) : '',
    pinned: item.pinned === true,
    programId: item.programId != null && item.programId !== '' ? Number(item.programId) : null,
    trainerId: item.trainerId != null && item.trainerId !== '' ? Number(item.trainerId) : null,
    updatedAt: new Date().toISOString().split('T')[0]
  };
}

// S129: сортировка списка новостей — закреплённые первыми, затем по дате (новые), id
function sortNews(list) {
  return (Array.isArray(list) ? list : []).slice().sort((a, b) => {
    if (!!b.pinned !== !!a.pinned) return b.pinned ? 1 : -1;
    const da = String(a.date || ''), db = String(b.date || '');
    if (da !== db) return da < db ? 1 : -1;
    return (Number(b.id) || 0) - (Number(a.id) || 0);
  });
}

async function handleGetNews(req, res) {
  const token = extractTokenFromCookie(req.headers);
  if (!isValidSession(token)) {
    return sendJSON(res, 401, { error: 'Не авторизован' });
  }

  const db = readDb();
  const news = sortNews(db.news || []);

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

    const clean = sanitizeNews(newsItem);
    if (!clean) {
      return sendJSON(res, 400, { error: 'Не указан заголовок' });
    }

    if (isNew) {
      clean.id = Date.now();
      clean.date = clean.date || new Date().toISOString().split('T')[0];
      clean.preview = previewOf(clean.text);
      db.news.push(clean);
    } else {
      const idx = db.news.findIndex(n => Number(n.id) === clean.id);
      if (idx === -1) {
        return sendJSON(res, 404, { error: 'Новость не найдена' });
      }
      clean.preview = previewOf(clean.text);
      // Сохраняем неизвестные поля исходной записи (ничего не теряем)
      const original = db.news[idx];
      for (const k of Object.keys(original)) {
        if (!(k in clean)) clean[k] = original[k];
      }
      db.news[idx] = clean;
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
// S129: настройки раздела «Новости» (db.newsSettings)
// ============================================
const NEWS_SETTINGS_DEFAULT = {
  showOnHome: true,
  homeCount: 8,
  showAllLink: true,
  buttonLabels: { readMore: 'Читать полностью →', details: 'Подробнее →', photos: 'Смотреть фото →' }
};

function sanitizeNewsSettings(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const out = {
    showOnHome: src.showOnHome !== false,
    homeCount: Math.min(24, Math.max(1, Number(src.homeCount) || NEWS_SETTINGS_DEFAULT.homeCount)),
    showAllLink: src.showAllLink !== false,
    buttonLabels: {
      readMore: typeof src.buttonLabels?.readMore === 'string' && src.buttonLabels.readMore.trim()
        ? src.buttonLabels.readMore.trim().slice(0, 40) : NEWS_SETTINGS_DEFAULT.buttonLabels.readMore,
      details: typeof src.buttonLabels?.details === 'string' && src.buttonLabels.details.trim()
        ? src.buttonLabels.details.trim().slice(0, 40) : NEWS_SETTINGS_DEFAULT.buttonLabels.details,
      photos: typeof src.buttonLabels?.photos === 'string' && src.buttonLabels.photos.trim()
        ? src.buttonLabels.photos.trim().slice(0, 40) : NEWS_SETTINGS_DEFAULT.buttonLabels.photos
    }
  };
  return out;
}

async function handleGetNewsSettings(req, res) {
  const token = extractTokenFromCookie(req.headers);
  if (!isValidSession(token)) return sendJSON(res, 401, { error: 'Не авторизован' });
  const db = readDb();
  sendJSON(res, 200, { newsSettings: sanitizeNewsSettings(db.newsSettings) });
}

async function handleSaveNewsSettings(req, res) {
  const token = extractTokenFromCookie(req.headers);
  if (!isValidSession(token)) return sendJSON(res, 401, { error: 'Не авторизован' });
  const body = await readBody(req);
  if (!body || typeof body.newsSettings !== 'object') {
    return sendJSON(res, 400, { error: 'Нет данных' });
  }
  try {
    const db = readDb();
    db.newsSettings = sanitizeNewsSettings(body.newsSettings);
    backupDB();
    writeDb(db);
    regenerateStatic();
    sendJSON(res, 200, { ok: true, newsSettings: db.newsSettings });
  } catch (err) {
    console.error('❌ Ошибка сохранения newsSettings:', err);
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

  // S118: ширина контейнеров — { unit: 'px'|'%', value: число }
  // Дефолт: 90% (текущая ширина слайдера). px — 320…3840, % — 20…100.
  function sanitizeContainerWidth(raw) {
    const def = { unit: '%', value: 90 };
    if (!raw || typeof raw !== 'object') return def;
    const unit = raw.unit === 'px' ? 'px' : '%';
    const n = Number(raw.value);
    if (!Number.isFinite(n)) return def;
    if (unit === 'px') {
      if (n < 320 || n > 3840) return def;
      return { unit: 'px', value: Math.round(n) };
    }
    if (n < 20 || n > 100) return def;
    return { unit: '%', value: Math.round(n) };
  }

  // S125: максимальная ширина плитки новости — { unit: 'px'|'%', value: число }
  // Дефолт: 360px. px — 200…800, % — 20…100.
  function sanitizeNewsTileWidth(raw) {
    const def = { unit: 'px', value: 360 };
    if (!raw || typeof raw !== 'object') return def;
    const unit = raw.unit === '%' ? '%' : 'px';
    const n = Number(raw.value);
    if (!Number.isFinite(n)) return def;
    if (unit === 'px') {
      if (n < 200 || n > 800) return def;
      return { unit: 'px', value: Math.round(n) };
    }
    if (n < 20 || n > 100) return def;
    return { unit: '%', value: Math.round(n) };
  }

  function sanitizeAppearance(raw) {
    const out = {
      variables: {},
      customCss: '',
      containerWidth: { unit: '%', value: 90 },
      newsTileWidth: { unit: 'px', value: 360 }
    };
    if (!raw || typeof raw !== 'object') return out;
    out.containerWidth = sanitizeContainerWidth(raw.containerWidth);
    out.newsTileWidth = sanitizeNewsTileWidth(raw.newsTileWidth);
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
      // S126: смена пароля админки (опционально, в том же запросе).
      // Пароль в db.json и siteSettings НЕ попадает — только в файл вне репозитория.
      const pw = typeof body.adminPassword === 'string' ? body.adminPassword : '';
      const pwConfirm = typeof body.adminPasswordConfirm === 'string' ? body.adminPasswordConfirm : '';
      let passwordChanged = false;
      if (pw || pwConfirm) {
        if (pw !== pwConfirm) {
          return sendJSON(res, 400, { error: 'Пароль и подтверждение не совпадают' });
        }
        const pwError = changePassword(pw);
        if (pwError) {
          return sendJSON(res, 400, { error: pwError });
        }
        passwordChanged = true;
        console.log('🔑 Пароль админки изменён через «Главные данные»');
      }

      const db = readDb();
      if (!db.siteSettings) db.siteSettings = {};
      db.siteSettings.title1 = String(body.siteSettings.title1 || 'Шифу Панда');
      db.siteSettings.title2 = String(body.siteSettings.title2 || 'Центр Функционального Развития');
      // S152: текст подтверждения после отправки формы обратного звонка
      if (Object.prototype.hasOwnProperty.call(body.siteSettings, 'callSuccessText')) {
        const t = String(body.siteSettings.callSuccessText || '').trim();
        if (t === '') { delete db.siteSettings.callSuccessText; }
        else { db.siteSettings.callSuccessText = t.slice(0, 120); }
      }
      // S133 п.7: baseUrl — хост для canonical/og/sitemap. Значение по умолчанию
      // (https://центр-фр.рф, Р3) задаётся в генераторе; здесь — только валидация
      // ввода админа: https://, без завершающего /, без пути/query/пробелов; IDN разрешён.
      if (Object.prototype.hasOwnProperty.call(body.siteSettings, 'baseUrl')) {
        const raw = String(body.siteSettings.baseUrl || '').trim();
        if (raw === '') {
          delete db.siteSettings.baseUrl;   // пусто = дефолт генератора
        } else {
          const bad = (function () {
            if (!/^https:\/\//i.test(raw)) return 'адрес должен начинаться с https://';
            if (/\/$/.test(raw)) return 'без завершающего /';
            if (/\s/.test(raw)) return 'без пробелов';
            try {
              const u = new URL(raw);
              if (u.pathname !== '/' || u.search || u.hash) return 'только протокол и домен, без пути';
            } catch (e) { return 'некорректный адрес'; }
            return '';
          })();
          if (bad) return sendJSON(res, 400, { error: 'Адрес сайта: ' + bad });
          db.siteSettings.baseUrl = raw;
        }
      }
      // logo: путь uploads/... или data: URI (наследие) — оба допустимы
      if (body.siteSettings.logo && typeof body.siteSettings.logo === 'string') {
        const l = body.siteSettings.logo.trim();
        db.siteSettings.logo = l.startsWith('data:') ? l : l.replace(/^\//, '');
      }
      backupDB();
      writeDb(db);
      regenerateStatic();
      // S134: число URL в sitemap (для toast при смене baseUrl)
      const urlCount = (db.programs || []).filter(p => !p.hidden).length
        + (db.trainers || []).filter(t => !t.hidden).length
        + (db.news || []).length;
      sendJSON(res, 200, { ok: true, passwordChanged, urls: urlCount });
    } catch (err) {
      console.error('❌ Ошибка сохранения siteSettings:', err);
      sendJSON(res, 500, { error: err.message });
    }
  }

  // S133: перегенерация sitemap.xml и robots.txt без правки базы
  async function handleRegenerateSeo(req, res) {
    const token = extractTokenFromCookie(req.headers);
    if (!isValidSession(token)) {
      return sendJSON(res, 401, { error: 'Не авторизован' });
    }
    try {
      const db = flattenDb(JSON.parse(fs.readFileSync(dbPath, 'utf-8')));
      const buildDateISO = new Date().toISOString();
      fs.writeFileSync(path.join(staticDir, 'sitemap.xml'), renderSitemap(db, buildDateISO), 'utf-8');
      fs.writeFileSync(path.join(staticDir, 'robots.txt'), renderRobots(db, buildDateISO), 'utf-8');
      const urls = (db.programs || []).filter(p => !p.hidden).length
        + (db.trainers || []).filter(t => !t.hidden).length
        + (db.news || []).length;
      console.log('🔧 sitemap.xml и robots.txt перегенерированы');
      sendJSON(res, 200, { ok: true, entities: urls });
    } catch (err) {
      console.error('❌ Ошибка regenerate-seo:', err);
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
        // data/ — общие листы из репозитория (price-2026-10.jpg): удаляем только uploads/
        if (!oldPath || !oldPath.startsWith('uploads/')) continue;
        const newPath = body.prices.find(x => x.id === oldItem.id);
        if (newPath && newPath.image) continue;
        const fullPath = path.join(staticDir, oldPath);
        try { if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath); } catch (e) { /* ignore */ }
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
        // S99: hybridActiveTab — ровно два значения ('images' | 'table').
        // Третьего режима («оба сразу», S84) больше нет: значение 'hybrid'
        // в базе приводим к 'images'.
        hybridActiveTab: ['images', 'table'].includes(body.scheduleSettings.hybridActiveTab)
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
  // S138: слайдер совместных фото на странице «Коллектив».
  // Только вкл/выкл + интервал — данные (db.album «Совместные фото»)
  // и экспорт trainer-slider.js не трогаем: S136 вернёт слайдер наполненным.
  // ============================================
  function handleGetTrainerSliderSettings(req, res) {
    const token = extractTokenFromCookie(req.headers);
    if (!isValidSession(token)) {
      return sendJSON(res, 401, { error: 'Не авторизован' });
    }
    const db = readDb();
    const s = db.trainerSliderSettings || {};
    sendJSON(res, 200, {
      trainerSliderSettings: {
        enabled: s.enabled === true,
        interval: (function () {
          const n = Number(s.interval);
          return Number.isFinite(n) && n >= 2 && n <= 20 ? Math.round(n) : 5;
        })()
      }
    });
  }

  async function handleSaveTrainerSliderSettings(req, res) {
    const token = extractTokenFromCookie(req.headers);
    if (!isValidSession(token)) {
      return sendJSON(res, 401, { error: 'Не авторизован' });
    }
    const body = await readBody(req);
    if (!body || typeof body !== 'object' || !body.trainerSliderSettings || typeof body.trainerSliderSettings !== 'object') {
      return sendJSON(res, 400, { error: 'Нет данных настроек слайдера' });
    }
    try {
      const s = body.trainerSliderSettings;
      const n = Number(s.interval);
      const db = readDb();
      db.trainerSliderSettings = {
        enabled: s.enabled === true,
        interval: Number.isFinite(n) && n >= 2 && n <= 20 ? Math.round(n) : 5
      };
      backupDB();
      writeDb(db);
      regenerateStatic();
      sendJSON(res, 200, { ok: true, trainerSliderSettings: db.trainerSliderSettings });
    } catch (err) {
      console.error('❌ Ошибка сохранения trainerSliderSettings:', err);
      sendJSON(res, 500, { error: err.message });
    }
  }

  // ============================================
  // Залы (S99): название + картинка расписания
  // Картинки расписания переехали из data.schedule в settings.halls
  // ============================================
  function sanitizeHallImage(p) {
    const s = String(p || '').trim();
    if (!s) return '';
    const rel = s.replace(/^\//, '');
    // Только внутри static/uploads/ (загрузки админки) и static/data/ (наследие)
    if (!/^(uploads|data)\/[\w.\-/]+$/.test(rel) || rel.includes('..')) return '';
    return '/' + rel;
  }

  async function handleGetHalls(req, res) {
    const token = extractTokenFromCookie(req.headers);
    if (!isValidSession(token)) {
      return sendJSON(res, 401, { error: 'Не авторизован' });
    }
    try {
      const db = readDb();
      sendJSON(res, 200, { halls: db.halls || [] });
    } catch (err) {
      console.error('❌ Ошибка чтения залов:', err);
      sendJSON(res, 500, { error: err.message });
    }
  }

  async function handleSaveHalls(req, res) {
    const token = extractTokenFromCookie(req.headers);
    if (!isValidSession(token)) {
      return sendJSON(res, 401, { error: 'Не авторизован' });
    }
    const body = await readBody(req);
    if (!body?.halls || !Array.isArray(body.halls)) {
      return sendJSON(res, 400, { error: 'Нет данных залов' });
    }
    try {
      const db = readDb();
      const oldHalls = db.halls || [];

      const halls = [];
      for (const item of body.halls) {
        const name = String(item.name || '').trim().slice(0, 80);
        const image = sanitizeHallImage(item.image);
        if (!name && !image) continue;   // пустые строки не сохраняем
        halls.push({
          id: item.id || Date.now(),
          name,
          image,
          visible: item.visible !== false
        });
      }

      // Удалили картинку или весь зал — убираем файл (только uploads/, data/ — общие листы)
      for (const old of oldHalls) {
        const oldPath = old.image && old.image.replace(/^\//, '');
        if (!oldPath || !oldPath.startsWith('uploads/')) continue;
        const stillUsed = halls.some(h => h.image === old.image);
        if (stillUsed) continue;
        const fullPath = path.join(staticDir, oldPath);
        try { if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath); } catch (e) { /* ignore */ }
      }

      db.halls = halls;
      backupDB();
      writeDb(db);
      regenerateStatic();
      sendJSON(res, 200, { ok: true, halls });
    } catch (err) {
      console.error('❌ Ошибка сохранения залов:', err);
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
  // S23: Направления
  // ============================================
  async function handleGetDirections(req, res) {
    const token = extractTokenFromCookie(req.headers);
    if (!isValidSession(token)) {
      return sendJSON(res, 401, { error: 'Не авторизован' });
    }
    const db = readDb();
    const dirs = (db.directions || []).map(d => ({
      id: d.id || '',
      name: d.name || '',
      description: d.description || '',
      image: d.image || '',
      hidden: !!d.hidden,
      isBuiltin: !!d.isBuiltin,
      // S131 п.4: новые опциональные поля (дефолт = текущее поведение)
      publicTitle: d.publicTitle || '',
      subtitle: d.subtitle || '',
      showOnHome: d.showOnHome !== false,
      showInMenu: d.showInMenu !== false,
      showSchedule: d.showSchedule !== false,
      priceGroup: d.priceGroup || '',
      programs: (d.programs || []).map(p => ({ id: p.id, name: p.name || '', image: p.image || '' }))
    }));
    sendJSON(res, 200, { directions: dirs });
  }

  async function handleSaveDirections(req, res) {
    const token = extractTokenFromCookie(req.headers);
    if (!isValidSession(token)) {
      return sendJSON(res, 401, { error: 'Не авторизован' });
    }
    const body = await readBody(req);
    if (!body?.directions || !Array.isArray(body.directions)) {
      return sendJSON(res, 400, { error: 'Нет данных направлений' });
    }
    try {
      const db = readDb();
      const existing = db.directions || [];
      const existingById = new Map(existing.map(d => [String(d.id), d]));
      const programById = new Map((db.programs || []).map(p => [String(p.id), p]));

      const usedIds = new Set();
      let created = 0;

      const directions = [];
      for (const d of body.directions) {
        let id = String(d.id || '').trim();
        // Новое направление (нет id или id занят) — генерируем
        if (!id || usedIds.has(id)) {
          id = 'dir-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
          created++;
        }
        usedIds.add(id);

        // Состав программ: только существующие id, без дублей.
        // S100: раньше приходил {id:'', name:<текст>} — id терялись.
        const seen = new Set();
        const programs = [];
        for (const p of (Array.isArray(d.programs) ? d.programs : [])) {
          const pid = String(p.id != null ? p.id : '');
          if (!pid || seen.has(pid)) continue;
          const real = programById.get(pid);
          if (!real) continue;   // несуществующую программу не пишем
          seen.add(pid);
          programs.push({
            id: real.id,
            name: real.name || '',
            image: real.image || ''
          });
        }

        const prev = existingById.get(id);
        directions.push({
          id,
          name: String(d.name || '').trim().slice(0, 120),
          description: String(d.description || '').trim(),
          image: String(d.image || '').trim(),
          hidden: !!d.hidden,
          // isBuiltin неснимаемый: если был — остаётся; новые — не встроенные
          isBuiltin: !!(prev && prev.isBuiltin) || !!d.isBuiltin,
          // S131 п.4: опциональные поля направления (пусто/отсутствие = дефолт)
          publicTitle: String(d.publicTitle || '').trim().slice(0, 120),
          subtitle: String(d.subtitle || '').trim().slice(0, 200),
          showOnHome: d.showOnHome !== false,
          showInMenu: d.showInMenu !== false,
          showSchedule: d.showSchedule !== false,
          priceGroup: String(d.priceGroup || '').trim().slice(0, 120),
          programs
        });
      }

      db.directions = directions;

      // Обновляем directionId в программах по фактическому составу направлений.
      // Скрытая программа всегда остаётся в 'dir-hidden' — даже если лежит в обычном
      // направлении (наследие: «Греко-римская борьба» есть и в БОЕВЫХ, и в Скрытых).
      const programs = db.programs || [];
      const membership = new Map();
      for (const dir of directions) {
        if (dir.id === 'dir-hidden') continue;
        for (const p of dir.programs) {
          const key = String(p.id);
          if (!membership.has(key)) membership.set(key, dir.id);
        }
      }
      programs.forEach(p => {
        if (p.hidden) {
          p.directionId = 'dir-hidden';
          return;
        }
        const dirId = membership.get(String(p.id));
        if (dirId) {
          p.directionId = dirId;
        } else {
          delete p.directionId;
        }
      });

      backupDB();
      writeDb(db);
      regenerateStatic();
      sendJSON(res, 200, { ok: true, directions, created });
    } catch (err) {
      console.error('❌ Ошибка сохранения направлений:', err);
      sendJSON(res, 500, { error: err.message });
    }
  }

  // ============================================
  // S106: Разделы главной (заголовок / фон / видимость / порядок)
  // ============================================
  // S108: добавлен 'prices' (раздел «Цены» на главной) — порядок как в index.html
  // S127: добавлено опциональное поле subtitle — подзаголовок раздела
  // (выводится на общих страницах как .section-subtitle).
  const HOME_SECTION_IDS = ['slider', 'schedule', 'prices', 'programs', 'trainers', 'news'];
  const HOME_SECTIONS_DEFAULT = [
    { id: 'slider', title: '', subtitle: '', bgColor: '', visible: true },
    { id: 'schedule', title: 'Наше расписание', subtitle: '', bgColor: '', visible: true },
    { id: 'prices', title: 'Наши цены', subtitle: '', bgColor: '', visible: true },
    { id: 'programs', title: 'Наши тренировки', subtitle: '', bgColor: '', visible: true },
    { id: 'trainers', title: 'Наши тренера', subtitle: '', bgColor: '', visible: true },
    { id: 'news', title: 'Новости центра', subtitle: '', bgColor: '', visible: true }
  ];

  async function handleGetHomeSections(req, res) {
    const token = extractTokenFromCookie(req.headers);
    if (!isValidSession(token)) {
      return sendJSON(res, 401, { error: 'Не авторизован' });
    }
    try {
      const db = readDb();
      sendJSON(res, 200, { homeSections: sanitizeHomeSections(db.homeSections) });
    } catch (err) {
      console.error('❌ Ошибка чтения разделов главной:', err);
      sendJSON(res, 500, { error: err.message });
    }
  }

  // Порядок = порядок массива; whitelist id; hex-цвет или пусто; недостающие — в конец
  function sanitizeHomeSections(raw) {
    const src = Array.isArray(raw) ? raw : HOME_SECTIONS_DEFAULT;
    const seen = new Set();
    const list = [];
    for (const item of src) {
      const id = item && item.id;
      if (!HOME_SECTION_IDS.includes(id) || seen.has(id)) continue;
      seen.add(id);
      const bg = String(item.bgColor || '').trim();
      list.push({
        id,
        title: String(item.title == null ? '' : item.title).slice(0, 80),
        // S127: подзаголовок раздела (выводится на общих страницах)
        subtitle: String(item.subtitle == null ? '' : item.subtitle).slice(0, 200),
        bgColor: /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(bg) ? bg : '',
        visible: item.visible !== false
      });
    }
    for (const d of HOME_SECTIONS_DEFAULT) if (!seen.has(d.id)) list.push({ ...d });
    return list;
  }

  async function handleSaveHomeSections(req, res) {
    const token = extractTokenFromCookie(req.headers);
    if (!isValidSession(token)) {
      return sendJSON(res, 401, { error: 'Не авторизован' });
    }
    const body = await readBody(req);
    if (!body?.homeSections || !Array.isArray(body.homeSections)) {
      return sendJSON(res, 400, { error: 'Нет данных разделов главной' });
    }
    try {
      const db = readDb();
      const homeSections = sanitizeHomeSections(body.homeSections);
      db.homeSections = homeSections;
      backupDB();
      writeDb(db);
      regenerateStatic();
      sendJSON(res, 200, { ok: true, homeSections });
    } catch (err) {
      console.error('❌ Ошибка сохранения разделов главной:', err);
      sendJSON(res, 500, { error: err.message });
    }
  }

  // ============================================
  // S127 (решение Р1): единые имена разделов (settings.sectionNames)
  //
  // Одно имя действует во всех точках: меню шапки, подвал, хлебные крошки,
  // <h1> общей страницы, <title> вкладки. Дефолт для trainers — «Коллектив»
  // (выбор пользователя: в раздел планируются не только тренеры).
  // CRUD: get-section-names / save-section-names
  // ============================================
  const SECTION_NAME_IDS = ['schedule', 'prices', 'programs', 'trainers', 'news', 'contacts'];
  const SECTION_NAMES_DEFAULT = {
    schedule: 'Наше расписание',
    prices: 'Наши цены',
    programs: 'Наши тренировки',
    trainers: 'Коллектив',
    news: 'Новости центра',
    contacts: 'Контакты'
  };

  // Миграция (ничего не теряем): если ключа в базе нет, имена берутся из
  // settings.homeSections[].title, кроме trainers → «Коллектив» (Р1).
  function sectionNamesFromHomeSections(homeSections) {
    const out = { ...SECTION_NAMES_DEFAULT };
    (Array.isArray(homeSections) ? homeSections : []).forEach(function (s) {
      if (!s || !SECTION_NAME_IDS.includes(s.id)) return;
      const t = String(s.title == null ? '' : s.title).trim();
      if (t) out[s.id] = t;
    });
    out.trainers = SECTION_NAMES_DEFAULT.trainers;   // Р1: не «Наши тренера»
    return out;
  }

  function sanitizeSectionNames(raw, db) {
    const base = (db && db.sectionNames && typeof db.sectionNames === 'object')
      ? db.sectionNames
      : sectionNamesFromHomeSections(db && db.homeSections);
    const src = (raw && typeof raw === 'object') ? raw : base;
    const out = {};
    for (const id of SECTION_NAME_IDS) {
      const value = String(src[id] == null ? '' : src[id]).trim().slice(0, 60);
      // Пустое = не трогать → остаётся прежнее значение (или дефолт)
      out[id] = value || base[id] || SECTION_NAMES_DEFAULT[id];
    }
    return out;
  }

  async function handleGetSectionNames(req, res) {
    const token = extractTokenFromCookie(req.headers);
    if (!isValidSession(token)) {
      return sendJSON(res, 401, { error: 'Не авторизован' });
    }
    try {
      const db = readDb();
      sendJSON(res, 200, { sectionNames: sanitizeSectionNames(db.sectionNames, db) });
    } catch (err) {
      console.error('❌ Ошибка чтения имён разделов:', err);
      sendJSON(res, 500, { error: err.message });
    }
  }

  async function handleSaveSectionNames(req, res) {
    const token = extractTokenFromCookie(req.headers);
    if (!isValidSession(token)) {
      return sendJSON(res, 401, { error: 'Не авторизован' });
    }
    const body = await readBody(req);
    if (!body || typeof body.sectionNames !== 'object' || !body.sectionNames) {
      return sendJSON(res, 400, { error: 'Нет данных имён разделов' });
    }
    try {
      const db = readDb();
      const sectionNames = sanitizeSectionNames(body.sectionNames, db);
      db.sectionNames = sectionNames;
      backupDB();
      writeDb(db);
      regenerateStatic();
      sendJSON(res, 200, { ok: true, sectionNames });
    } catch (err) {
      console.error('❌ Ошибка сохранения имён разделов:', err);
      sendJSON(res, 500, { error: err.message });
    }
  }

  // ============================================
  // S113: Ссылки подвала (settings.footerLinks)
  //
  // crud: get-footer-links / save-footer-links
  // Группы: 'nav' («Перейти к») и 'partners' («Наши партнёры»).
  // Порядок = порядок массива; id стабильные (не пересобираются без нужды).
  // ============================================
  const FOOTER_LINK_GROUPS = ['nav', 'partners'];
  const FOOTER_LINKS_DEFAULT = [
    { id: 'nav-schedule', group: 'nav', title: '📅 Расписание', url: '#schedule', visible: true },
    { id: 'nav-prices', group: 'nav', title: '💰 Цены', url: '#prices', visible: true },
    { id: 'nav-programs', group: 'nav', title: '🥋 Программы', url: 'programs.html', visible: true },
    { id: 'nav-trainers', group: 'nav', title: '👥 Тренеры', url: 'trainers.html', visible: true },
    { id: 'nav-news', group: 'nav', title: '📰 Новости', url: 'news.html', visible: true },
    { id: 'nav-lk', group: 'nav', title: '👤 Личный кабинет', url: 'lk.html', visible: true },
    { id: 'par-usfu', group: 'partners', title: '🐼 Урало-Сибирская федерация ушу', url: 'https://www.usfu.ru/', visible: true }
  ];

  // url: только http(s)://…, #якорь, внутренняя страница *.html или /путь.
  // Протоколы javascript:/data: не проходят ни по одной ветке.
  function cleanFooterUrl(v) {
    const s = String(v == null ? '' : v).trim();
    if (/^#[\w-]+/.test(s)) return s.slice(0, 120);
    if (/^https?:\/\/[^\s<>"']+/i.test(s)) return s.slice(0, 500);
    if (/^[\w.-]+\.html(#[\w-]*)?$/.test(s)) return s.slice(0, 200);
    if (/^\/[\w./-]+$/.test(s)) return s.slice(0, 200);
    return '';
  }

  function sanitizeFooterLinks(raw) {
    const src = Array.isArray(raw) ? raw : FOOTER_LINKS_DEFAULT;
    const seen = new Set();
    const list = [];
    for (const item of src) {
      if (!item || typeof item !== 'object') continue;
      const group = FOOTER_LINK_GROUPS.includes(item.group) ? item.group : 'nav';
      const title = cleanPriceText(item.title, 80);
      const url = cleanFooterUrl(item.url);
      if (!title || !url) continue;
      let id = String(item.id == null ? '' : item.id).trim().replace(/[^\w-]/g, '').slice(0, 40);
      if (!id) id = 'fl-' + list.length + '-' + Date.now().toString(36);
      if (seen.has(id)) continue;
      seen.add(id);
      list.push({ id, group, title, url, visible: item.visible !== false });
    }
    return list;
  }

  async function handleGetFooterLinks(req, res) {
    const token = extractTokenFromCookie(req.headers);
    if (!isValidSession(token)) {
      return sendJSON(res, 401, { error: 'Не авторизован' });
    }
    try {
      const db = readDb();
      sendJSON(res, 200, { footerLinks: sanitizeFooterLinks(db.footerLinks) });
    } catch (err) {
      console.error('❌ Ошибка чтения ссылок подвала:', err);
      sendJSON(res, 500, { error: err.message });
    }
  }

  async function handleSaveFooterLinks(req, res) {
    const token = extractTokenFromCookie(req.headers);
    if (!isValidSession(token)) {
      return sendJSON(res, 401, { error: 'Не авторизован' });
    }
    const body = await readBody(req);
    if (!body?.footerLinks || !Array.isArray(body.footerLinks)) {
      return sendJSON(res, 400, { error: 'Нет данных ссылок подвала' });
    }
    try {
      const db = readDb();
      const footerLinks = sanitizeFooterLinks(body.footerLinks);
      db.footerLinks = footerLinks;
      backupDB();
      writeDb(db);
      regenerateStatic();
      sendJSON(res, 200, { ok: true, footerLinks });
    } catch (err) {
      console.error('❌ Ошибка сохранения ссылок подвала:', err);
      sendJSON(res, 500, { error: err.message });
    }
  }

  // ============================================
  // S122: настройки шапки (headerSettings)
  //
  // crud: get-header-settings / save-header-settings
  // Поля: colors (hex), buttons.callText, items[{id,visible}], hover.style.
  // Legacy-поля (titleSuffix, secondLineText, …) сохраняются как есть.
  // ============================================

  const HEADER_MENU_ITEMS = ['schedule', 'prices', 'programs', 'staff', 'news', 'contacts', 'lk'];
  const HEADER_HOVER_STYLES = ['color', 'underline', 'background', 'scale'];
  const HEADER_COLOR_KEYS = ['menuBg', 'menuText', 'hoverBg', 'hoverText', 'activeBg', 'activeText'];
  const HEADER_DEFAULT = {
    colors: { menuBg: '', menuText: '', hoverBg: '', hoverText: '', activeBg: '', activeText: '' },
    buttons: { callText: 'Заказать звонок' },
    items: HEADER_MENU_ITEMS.map(id => ({ id, visible: true })),
    hover: { style: 'color' }
  };

  function cleanHexColor(v) {
    const s = String(v == null ? '' : v).trim();
    return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s) ? s : '';
  }

  function sanitizeHeaderSettings(raw, db) {
    const src = (raw && typeof raw === 'object') ? raw : {};
    const legacy = (db.headerSettings && typeof db.headerSettings === 'object') ? db.headerSettings : {};

    const colors = {};
    const rawColors = (src.colors && typeof src.colors === 'object') ? src.colors : {};
    for (const k of HEADER_COLOR_KEYS) colors[k] = cleanHexColor(rawColors[k]);

    const callText = cleanPriceText((src.buttons && src.buttons.callText) != null ? src.buttons.callText : HEADER_DEFAULT.buttons.callText, 40)
      || HEADER_DEFAULT.buttons.callText;

    // items: whitelist id, порядок фиксирован, дубли отбрасываются
    const rawItems = Array.isArray(src.items) ? src.items : HEADER_DEFAULT.items;
    const seen = new Set();
    const items = [];
    for (const it of rawItems) {
      const id = it && HEADER_MENU_ITEMS.includes(it.id) ? it.id : null;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      items.push({ id, visible: it.visible !== false });
    }
    // Недостающие пункты дописываем видимыми (данные не теряются)
    for (const id of HEADER_MENU_ITEMS) if (!seen.has(id)) items.push({ id, visible: true });

    const hoverStyle = HEADER_HOVER_STYLES.includes(src.hover && src.hover.style)
      ? src.hover.style : HEADER_DEFAULT.hover.style;

    // Legacy-поля сохраняем (titleSuffix, secondLineText и прочие)
    return {
      ...legacy,
      colors,
      buttons: { callText },
      items,
      hover: { style: hoverStyle }
    };
  }

  async function handleGetHeaderSettings(req, res) {
    const token = extractTokenFromCookie(req.headers);
    if (!isValidSession(token)) return sendJSON(res, 401, { error: 'Не авторизован' });
    try {
      const db = readDb();
      sendJSON(res, 200, { headerSettings: sanitizeHeaderSettings(db.headerSettings, db) });
    } catch (err) {
      console.error('❌ Ошибка чтения настроек шапки:', err);
      sendJSON(res, 500, { error: err.message });
    }
  }

  async function handleSaveHeaderSettings(req, res) {
    const token = extractTokenFromCookie(req.headers);
    if (!isValidSession(token)) return sendJSON(res, 401, { error: 'Не авторизован' });
    const body = await readBody(req);
    if (!body?.headerSettings || typeof body.headerSettings !== 'object') {
      return sendJSON(res, 400, { error: 'Нет данных настроек шапки' });
    }
    try {
      const db = readDb();
      const headerSettings = sanitizeHeaderSettings(body.headerSettings, db);
      db.headerSettings = headerSettings;
      backupDB();
      writeDb(db);
      regenerateStatic();
      sendJSON(res, 200, { ok: true, headerSettings });
    } catch (err) {
      console.error('❌ Ошибка сохранения настроек шапки:', err);
      sendJSON(res, 500, { error: err.message });
    }
  }

  // ============================================
  // S120: статические страницы (settings.pages)
  //
  // crud: get-pages / save-pages
  // Поля: id, title, url (ASCII-slug), text (markdown), visible, showInMenu, order.
  // url уникален; при пустом/занятом — автогенерация (числовой id или транслит).
  // Порядок = порядок массива (перетаскивание в админке).
  // ============================================

  // Транслитерация кириллицы → латиница (для url из заголовка)
  const TRANSLIT = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e', 'ж': 'zh',
    'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
    'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'ts',
    'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu',
    'я': 'ya'
  };

  function translit(str) {
    return String(str == null ? '' : str).toLowerCase().split('').map(function (ch) {
      return TRANSLIT[ch] !== undefined ? TRANSLIT[ch] : ch;
    }).join('');
  }

  // URL страницы: ASCII-slug [a-z0-9_-]. Кириллица транслитерируется, прочее — в дефис.
  function cleanPageUrl(v) {
    const s = translit(String(v == null ? '' : v).trim())
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
    return s;
  }

  function sanitizePages(raw, db) {
    const src = Array.isArray(raw) ? raw : [];
    const usedIds = new Set();
    const usedUrls = new Set();
    let nextId = src.reduce((m, p) => Math.max(m, Number(p && p.id) || 0), 0) + 1;

    const out = [];
    for (const p of src) {
      if (!p || typeof p !== 'object') continue;
      const title = cleanPriceText(p.title, 80);
      if (!title) continue;   // без заголовка страница бессмысленна

      let id = String(p.id == null ? '' : p.id).trim();
      if (!/^\d+$/.test(id) || usedIds.has(id)) id = String(nextId++);
      usedIds.add(id);

      // url: ручной ASCII-slug; пусто → числовой id (дефолт). Проверка уникальности.
      let url = cleanPageUrl(p.url) || String(id);
      if (usedUrls.has(url)) {
        const base = url;
        let n = 2;
        while (usedUrls.has(url)) url = base + '-' + (n++);
      }
      usedUrls.add(url);

      out.push({
        id: Number(id),
        title,
        url,
        text: typeof p.text === 'string' ? p.text.slice(0, 100000) : '',
        visible: p.visible !== false,
        showInMenu: p.showInMenu === true,
        order: out.length + 1
      });
    }
    return out;
  }

  async function handleGetPages(req, res) {
    const token = extractTokenFromCookie(req.headers);
    if (!isValidSession(token)) return sendJSON(res, 401, { error: 'Не авторизован' });
    try {
      const db = readDb();
      sendJSON(res, 200, { pages: sanitizePages(db.pages, db) });
    } catch (err) {
      console.error('❌ Ошибка чтения страниц:', err);
      sendJSON(res, 500, { error: err.message });
    }
  }

  async function handleSavePages(req, res) {
    const token = extractTokenFromCookie(req.headers);
    if (!isValidSession(token)) return sendJSON(res, 401, { error: 'Не авторизован' });
    const body = await readBody(req);
    if (!body?.pages || !Array.isArray(body.pages)) {
      return sendJSON(res, 400, { error: 'Нет данных страниц' });
    }
    try {
      const db = readDb();
      const pages = sanitizePages(body.pages, db);
      db.pages = pages;
      backupDB();
      writeDb(db);
      regenerateStatic();
      sendJSON(res, 200, { ok: true, pages });
    } catch (err) {
      console.error('❌ Ошибка сохранения страниц:', err);
      sendJSON(res, 500, { error: err.message });
    }
  }

  // ============================================
  // S114: Полноценный CRUD для разделов, бывших «только просмотр»
  //
  //   get/save-slides        — слайдер главной (data.sliders)
  //   get/save-contacts      — контакты (settings.contacts + additionalContacts)
  //   get/save-album         — альбом (data.album)
  //
  // Расписание/цены уже имели CRUD (залы, слоты, позиции цен) — см. S76/S77/S99/S115.
  // Общие правила: сессия → backupDB() → writeDb() → regenerateStatic().
  // ============================================

  function cleanMediaPath(v) {
    const s = String(v == null ? '' : v).trim().slice(0, 300);
    if (!s) return '';
    // Только относительные пути внутри static/: uploads/… или data/…
    if (/^\/?(uploads|data)\/[\w./%()\- ]+$/i.test(s)) return s.replace(/^\//, '');
    return '';
  }

  // S158: позиции текста слайдера (9 вариантов + миграция старых left/right)
  const SLIDER_POS = [
    'top-left','top-center','top-right',
    'center-left','center','center-right',
    'bottom-left','bottom-center','bottom-right'
  ];
  const SLIDER_POS_MIGRATE = { left: 'center-left', right: 'center-right' };
  // Валидация hex-цвета
  const HEX_RE = /^#[0-9a-fA-F]{6}$/;

  function sanitizeSlides(raw) {
    const src = Array.isArray(raw) ? raw : [];
    const seen = new Set();
    const out = [];
    for (const item of src) {
      if (!item || typeof item !== 'object') continue;
      let id = Number(item.id);
      if (!Number.isFinite(id) || id <= 0) id = Date.now() + out.length;
      if (seen.has(id)) continue;
      seen.add(id);
      // S162: слайды БЕЗ картинки НЕ выбрасываются — сохраняются с пустой картинкой и hidden:true
      // чтобы пакетное сохранение не теряло слайды при изменении полей
      const image = cleanMediaPath(item.image);
      const interval = Number(item.interval);
      const pos = SLIDER_POS_MIGRATE[item.position] || item.position;
      // S158: новые поля
      const textColor = HEX_RE.test(item.textColor) ? item.textColor : '#ffffff';
      const textSize = Number.isFinite(Number(item.textSize))
        ? Math.max(16, Math.min(96, Math.round(Number(item.textSize)))) : 42;
      const tm = item.textMargin || {};
      const textMargin = {
        top: Math.max(0, Math.min(200, Math.round(Number(tm.top ?? 20)))),
        right: Math.max(0, Math.min(200, Math.round(Number(tm.right ?? 20)))),
        bottom: Math.max(0, Math.min(200, Math.round(Number(tm.bottom ?? 20)))),
        left: Math.max(0, Math.min(200, Math.round(Number(tm.left ?? 20))))
      };
      const ov = item.overlay || {};
      const overlay = {
        enabled: ov.enabled !== false,
        color: HEX_RE.test(ov.color) ? ov.color : '#000000',
        opacity: Number.isFinite(Number(ov.opacity))
          ? Math.max(0, Math.min(0.9, Number(ov.opacity))) : 0.4
      };
      const link = String(item.link || '').trim().slice(0, 300);
      const wasHidden = item.hidden === true;
      out.push({
        id,
        title: cleanPriceText(item.title, 80),
        description: cleanPriceText(item.description || '', 500),
        image,
        link: link || '',
        linkTarget: item.linkTarget === '_blank' ? '_blank' : '_self',
        interval: Number.isFinite(interval) && interval > 0 && interval <= 120 ? Math.round(interval) : 5,
        position: SLIDER_POS.includes(pos) ? pos : 'center',
        textColor, textSize, textMargin, overlay,
        hidden: image ? wasHidden : true   // S162: без картинки = всегда скрыт
      });
    }
    return out;
  }

  // S158: глобальные настройки слайдера (в db.settings.sliderSettings).
  // Мёртвые поля старой Next.js-версии (textPositionMode/staticPosition/marginX/marginY)
  // не сохраняются — вместо них реальные настройки, которые применяет main.js.
  function sanitizeSliderSettings(raw) {
    const s = raw && typeof raw === 'object' ? raw : {};
    const num = (v, dflt, min, max) => {
      const n = Number(v);
      return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : dflt;
    };
    const pos = SLIDER_POS_MIGRATE[s.defaultPosition] || s.defaultPosition;
    return {
      autoplay: s.autoplay !== false,
      showArrows: s.showArrows !== false,
      showDots: s.showDots !== false,
      // 0 = автовысота по картинке
      height: num(s.height, 0, 0, 1200),
      defaultPosition: SLIDER_POS.includes(pos) ? pos : 'center',
      defaultTextColor: HEX_RE.test(s.defaultTextColor) ? s.defaultTextColor : '#ffffff',
      defaultTextSize: num(s.defaultTextSize, 42, 16, 96),
      // S159: интервал прокрутки фотоальбомов (программы, тренеры, альбом, обложки)
      albumInterval: num(s.albumInterval, 6, 1, 120)
    };
  }

  async function handleGetSlides(req, res) {
    const token = extractTokenFromCookie(req.headers);
    if (!isValidSession(token)) return sendJSON(res, 401, { error: 'Не авторизован' });
    try {
      const db = readDb();
      // S158: глобальные настройки слайдера — плоский ключ sliderSettings
      // (на диске лежит в settings.*, readDb() его выносит наверх)
      sendJSON(res, 200, {
        slides: sanitizeSlides(db.sliders),
        defaultInterval: Number(db.defaultInterval) || 5,
        sliderSettings: db.sliderSettings || null
      });
    } catch (err) {
      console.error('❌ Ошибка чтения слайдера:', err);
      sendJSON(res, 500, { error: err.message });
    }
  }

  async function handleSaveSlides(req, res) {
    const token = extractTokenFromCookie(req.headers);
    if (!isValidSession(token)) return sendJSON(res, 401, { error: 'Не авторизован' });
    const body = await readBody(req);
    if (!body?.slides || !Array.isArray(body.slides)) {
      return sendJSON(res, 400, { error: 'Нет данных слайдера' });
    }
    try {
      const db = readDb();
      const slides = sanitizeSlides(body.slides);
      db.sliders = slides;
      if (body.defaultInterval != null) {
        const di = Number(body.defaultInterval);
        if (Number.isFinite(di) && di > 0 && di <= 120) db.defaultInterval = Math.round(di);
      }
      // S158: глобальные настройки слайдера (плоский ключ sliderSettings,
      // nestDb() положит его в settings.sliderSettings)
      if (body.sliderSettings !== undefined) {
        db.sliderSettings = sanitizeSliderSettings(body.sliderSettings);
      }
      backupDB();
      writeDb(db);
      regenerateStatic();
      sendJSON(res, 200, {
        ok: true, slides, defaultInterval: Number(db.defaultInterval) || 5,
        sliderSettings: db.sliderSettings || null
      });
    } catch (err) {
      console.error('❌ Ошибка сохранения слайдера:', err);
      sendJSON(res, 500, { error: err.message });
    }
  }

  // S162: удаление всех скрытых слайдов
  async function handleDeleteHiddenSlides(req, res) {
    const token = extractTokenFromCookie(req.headers);
    if (!isValidSession(token)) return sendJSON(res, 401, { error: 'Не авторизован' });
    try {
      const db = readDb();
      const before = db.sliders || [];
      const hiddenCount = before.filter(s => s.hidden === true).length;
      if (!hiddenCount) return sendJSON(res, 200, { ok: true, removed: 0, note: 'Скрытых слайдов нет' });
      db.sliders = before.filter(s => s.hidden !== true);
      backupDB();
      writeDb(db);
      regenerateStatic();
      console.log(`🗑 Скрытые слайды удалены: ${hiddenCount} → ${db.sliders.length}`);
      sendJSON(res, 200, { ok: true, removed: hiddenCount, remaining: db.sliders.length });
    } catch (err) {
      console.error('❌ Ошибка удаления скрытых слайдов:', err);
      sendJSON(res, 500, { error: err.message });
    }
  }

  /* ================================================================
     S166: Мероприятия (events)
     ================================================================
     Конструктивно — смесь новостей (текст-md + связь с новостью),
     программ (обложка, описание, отзывы), альбома (фотогалерея-слайдер)
     и страниц (отдельная страница event.html?id=).

     Правила автоматизации:
      • создали мероприятие на будущее  → заводим новость (showOnHome,
        со ссылкой на страницу мероприятия); связь хранится в event.newsId;
      • мероприятие прошло (dateEnd < now) → связанную новость скрываем,
        администраторам — письмо «загрузите фото/видео» + заметка в
        разделе «Статус → Проблемы» (collectSiteProblems);
      • переход «будущее → прошедшее» ловится и при сохранении, и
        периодической проверкой (дата могла пройти, пока базу не трогали).
  */
  const EVENT_TYPES = ['семинар', 'тестирование', 'праздник', 'беседа',
    'открытое_мероприятие', 'выездной_семинар'];

  // S167: альбом = слайдер. Кадры photoAlbum хранят те же поля, что слайды
  // главного слайдера (title/description/link/position/текст/overlay/hidden).
  // Общая санитизация — для мероприятий; тренеры/программы пишутся как есть,
  // но экспорт и сайт читают этот же набор полей.
  const SLIDE_POS_MIGRATE = { left: 'center-left', right: 'center-right' };
  function sanitizeAlbumSlides(raw) {
    const src = Array.isArray(raw) ? raw : [];
    const out = [];
    for (const a of src) {
      const item = typeof a === 'string' ? { image: a } : (a && typeof a === 'object' ? a : null);
      if (!item) continue;
      const image = cleanMediaPath(item.image);
      if (!image) continue;
      const rec = { image };
      const title = cleanPriceText(item.title || item.caption || '', 80);
      if (title) { rec.title = title; rec.caption = title; }
      const description = String(item.description || '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, 300);
      if (description.trim()) rec.description = description.trim();
      // ссылка — как у слайдов главного слайдера (произвольный адрес страницы)
      const link = String(item.link || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 300);
      if (link) { rec.link = link; rec.linkTarget = item.linkTarget === '_blank' ? '_blank' : '_self'; }
      const interval = Number(item.interval);
      if (Number.isFinite(interval) && interval >= 1 && interval <= 120) rec.interval = interval;
      const position = String(item.position || '');
      if (position) rec.position = SLIDE_POS_MIGRATE[position] || position;
      if (/^#[0-9a-fA-F]{3,8}$/.test(String(item.textColor || ''))) rec.textColor = String(item.textColor);
      const textSize = Number(item.textSize);
      if (Number.isFinite(textSize) && textSize >= 16 && textSize <= 96) rec.textSize = textSize;
      if (item.textMargin && typeof item.textMargin === 'object') {
        const tm = {};
        for (const k of ['top', 'right', 'bottom', 'left']) {
          const v = Number(item.textMargin[k]);
          if (Number.isFinite(v) && v >= 0 && v <= 200) tm[k] = v;
        }
        if (Object.keys(tm).length) rec.textMargin = tm;
      }
      if (item.overlay && typeof item.overlay === 'object') {
        const ov = {};
        if (item.overlay.enabled === false) ov.enabled = false;
        if (/^#[0-9a-fA-F]{3,8}$/.test(String(item.overlay.color || ''))) ov.color = String(item.overlay.color);
        const op = Number(item.overlay.opacity);
        if (Number.isFinite(op) && op >= 0 && op <= 0.9) ov.opacity = op;
        if (Object.keys(ov).length) rec.overlay = ov;
      }
      if (item.hidden === true) rec.hidden = true;
      out.push(rec);
      if (out.length >= 60) break;
    }
    return out;
  }

  function sanitizeEvents(raw) {
    const src = Array.isArray(raw) ? raw : [];
    const seen = new Set();
    const out = [];
    for (const item of src) {
      if (!item || typeof item !== 'object') continue;
      let id = Number(item.id);
      if (!Number.isFinite(id) || id <= 0) id = Date.now() + out.length;
      if (seen.has(id)) continue;
      seen.add(id);
      const ds = String(item.dateStart || '').slice(0, 16);
      let de = String(item.dateEnd || '').slice(0, 16);
      // без окончания — считаем «в тот же день, +3 часа» от начала
      if (!eventDate(de) && eventDate(ds)) {
        const d = eventDate(ds);
        d.setHours(d.getHours() + 3);
        const p = (n) => String(n).padStart(2, '0');
        de = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
      }
      const num = (v) => (v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null);
      out.push({
        id,
        name: cleanPriceText(item.name, 60),
        type: EVENT_TYPES.includes(item.type) ? item.type : '',
        dateStart: eventDate(ds) ? ds : '',
        dateEnd: eventDate(de) ? de : '',
        image: cleanMediaPath(item.image),
        shortDescription: cleanPriceText(item.shortDescription || '', 120),
        description: String(item.description || '').slice(0, 20000),
        reviews: (Array.isArray(item.reviews) ? item.reviews : [])
          .map(r => r && typeof r === 'object'
            ? { name: cleanPriceText(r.name || '', 80), text: String(r.text || '').slice(0, 1000) }
            : null)
          .filter(Boolean)
          .filter(r => r.name || r.text)
          .slice(0, 50),
        photoAlbum: sanitizeAlbumSlides(item.photoAlbum),
        videos: (Array.isArray(item.videos) ? item.videos : [])
          .map(v => v && typeof v === 'object'
            ? { title: cleanPriceText(v.title || '', 80), url: normalizeEventVideoUrl(v.url) }
            : null)
          .filter(Boolean)
          .filter(v => v.url)
          .slice(0, 15),
        hidden: item.hidden === true,
        newsId: num(item.newsId),
        createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString().slice(0, 10),
        updatedAt: new Date().toISOString().slice(0, 10),
      });
    }
    return out;
  }

  // Текст авто-новости: анонс + ссылка на страницу мероприятия
  function eventNewsText(ev) {
    const when = String(ev.dateStart || '').replace('T', ' ');
    const lines = [];
    if (when) lines.push('**📅 ' + when + '**');
    if (ev.type) lines.push('*' + EVENT_TYPES.includes(ev.type) ? ev.type.replace(/_/g, ' ') : '' + '*');
    if (ev.shortDescription) lines.push('', ev.shortDescription);
    lines.push('', 'Подробности, фото и запись: [Открыть страницу мероприятия](event.html?id=' + ev.id + ')');
    return lines.filter((l, i) => l !== '' || i > 0).join('\n');
  }

  // Создание новости для планируемого мероприятия (без email/regen — только правка db-объекта)
  function createNewsForEvent(db, ev) {
    // id не зависит от скорости вызовов: два события в одну миллисекунду
    // не должны получить одинаковый id
    let id = Date.now();
    while ((db.news || []).some(n => Number(n.id) === id)) id++;
    const news = {
      id,
      title: String(ev.name || 'Мероприятие').slice(0, 50),
      text: eventNewsText(ev),
      date: new Date().toISOString().slice(0, 10),
      image: ev.image || '',
      video: '',
      photos: [],
      showOnHome: true,
      hidden: false,
      category: 'Мероприятия',
      pinned: false,
      programId: null,
      trainerId: null,
      updatedAt: new Date().toISOString().slice(0, 10),
      preview: previewOf(eventNewsText(ev)),
    };
    if (!Array.isArray(db.news)) db.news = [];
    db.news.push(news);
    return id;
  }

  // Луч-effort письмо администраторам (SMTP из emailConfig). Ошибку не роняем.
  async function sendAdminMail(subject, text) {
    try {
      const db = readDb();
      const emailConfig = db.emailConfig || {};
      const smtpUser = emailConfig.smtpUser, smtpPass = emailConfig.smtpPass;
      const adminEmail = emailConfig.adminEmail;
      if (!smtpUser || !smtpPass || !adminEmail) return { ok: false, error: 'SMTP не настроен' };
      const nodemailer = (await import('nodemailer')).default;
      const transporter = nodemailer.createTransport({
        host: emailConfig.smtpHost || 'smtp.yandex.ru',
        port: emailConfig.smtpPort || 465,
        secure: emailConfig.smtpSecure !== false,
        auth: { user: smtpUser, pass: smtpPass },
      });
      const recipients = [adminEmail, ...(emailConfig.errorEmail || [])].filter(Boolean);
      await transporter.sendMail({
        from: `"${emailConfig.fromName || 'Сайт центр-фр.рф'}" <${smtpUser}>`,
        to: recipients.join(', '),
        subject,
        text,
      });
      return { ok: true, sent: recipients.length };
    } catch (err) {
      console.error('❌ Письмо администраторам не отправлено:', err.message);
      return { ok: false, error: err.message };
    }
  }

  // Письмо «мероприятие прошло — загрузите фото/видео»
  async function notifyEventPassed(ev) {
    const subject = `Мероприятие прошло: ${ev.name} — загрузите фото и видео`;
    const text =
      `Уважаемые Коллеги!\n\n` +
      `Мероприятие «${ev.name}» (начало ${ev.dateStart || '?'}) завершено.\n` +
      `Просьба загрузить в админке, раздел «Данные → Мероприятия»:\n` +
      `  • фотогалерею (слайдер на странице мероприятия);\n` +
      `  • ссылкu(и) на видео, если снимали;\n` +
      `  • отзывы участников (ФИО + текст).\n\n` +
      `Связанная новость с главной автоматически скрыта.\n` +
      `Если фото есть — страница мероприятия сразу станет привлекательнее для посетителей.\n\n` +
      `С Уважением, робот сайта центр-фр.рф`;
    return sendAdminMail(subject, text);
  }

  // Переходы статусов: будущие без новости → создать; прошедшие с видимой новостью → скрыть.
  // Возвращает { created: [...], hiddenNews: [...], notified: bool }.
  function applyEventTransitions(db, now) {
    const result = { created: [], hiddenNews: [], needNotify: [] };
    const events = db.events || [];
    for (const ev of events) {
      if (!ev || ev.hidden) continue;
      const past = eventIsPast(ev, now);
      if (!past && !ev.newsId && ev.dateStart) {
        const id = createNewsForEvent(db, ev);
        ev.newsId = id;
        result.created.push({ id: ev.id, newsId: id });
      }
      if (past && ev.newsId) {
        const n = (db.news || []).find(x => Number(x.id) === Number(ev.newsId));
        if (n && !n.hidden) {
          n.hidden = true;
          n.updatedAt = new Date().toISOString().slice(0, 10);
          result.hiddenNews.push({ id: ev.id, newsId: n.id });
          result.needNotify.push(ev);
        }
      }
    }
    return result;
  }

  async function handleGetEvents(req, res) {
    const token = extractTokenFromCookie(req.headers);
    if (!isValidSession(token)) return sendJSON(res, 401, { error: 'Не авторизован' });
    try {
      const db = readDb();
      sendJSON(res, 200, {
        events: db.events || [],
        types: EVENT_TYPES,
        news: (db.news || []).map(n => ({ id: n.id, title: n.title, hidden: !!n.hidden })),
      });
    } catch (err) {
      console.error('❌ Ошибка чтения мероприятий:', err);
      sendJSON(res, 500, { error: err.message });
    }
  }

  async function handleSaveEvents(req, res) {
    const token = extractTokenFromCookie(req.headers);
    if (!isValidSession(token)) return sendJSON(res, 401, { error: 'Не авторизован' });
    const body = await readBody(req);
    if (!body || !Array.isArray(body.events)) {
      return sendJSON(res, 400, { error: 'Нет списка мероприятий' });
    }
    try {
      const db = readDb();
      db.events = sanitizeEvents(body.events);
      const tr = applyEventTransitions(db, Date.now());
      backupDB();
      writeDb(db);
      regenerateStatic();
      let mail = null;
      if (tr.needNotify.length) {
        for (const ev of tr.needNotify) mail = await notifyEventPassed(ev);
      }
      sendJSON(res, 200, {
        ok: true,
        events: db.events,
        newsCreated: tr.created.length,
        newsHidden: tr.hiddenNews.length,
        mail: mail ? mail.ok ? 'отправлено' : 'не отправлено: ' + mail.error : null,
      });
    } catch (err) {
      console.error('❌ Ошибка сохранения мероприятий:', err);
      sendJSON(res, 500, { error: err.message });
    }
  }

  // Периодическая проверка (дата прошла, а базу не сохраняли):
  // скрываем новость прошедшего мероприятия, уведомляем, перегенерируем.
  const EVENTS_CHECK_MS = 6 * 60 * 60 * 1000;
  async function checkEventsTransitions() {
    try {
      const db = readDb();
      if (!Array.isArray(db.events) || !db.events.length) return;
      const tr = applyEventTransitions(db, Date.now());
      const changed = tr.created.length + tr.hiddenNews.length;
      if (!changed) return;
      backupDB();
      writeDb(db);
      regenerateStatic();
      console.log(`🗓 S166: переходы мероприятий — новостей создано ${tr.created.length}, скрыто ${tr.hiddenNews.length}`);
      for (const ev of tr.needNotify) await notifyEventPassed(ev);
    } catch (err) {
      console.error('❌ Периодическая проверка мероприятий:', err.message);
    }
  }

  // S158: выбор фото для слайда — общий скан uploads/ + usage из всей базы
  async function handleGetPhotoAlbum(req, res) {
    const token = extractTokenFromCookie(req.headers);
    if (!isValidSession(token)) return sendJSON(res, 401, { error: 'Не авторизован' });
    try {
      const body = await readBody(req).catch(() => ({}));
      const query = String((body && body.query) || '').trim().toLowerCase();
      const filter = ['all', 'unused', 'used'].includes(body && body.filter) ? body.filter : 'all';
      const page = Math.max(1, Number(body && body.page) || 1);
      const perPage = Math.max(1, Math.min(200, Number(body && body.per_page) || 24));

      const db = readDb();
      const usage = collectPhotoUsage(db);

      const files = [];
      walkUploads(path.join(root, 'static', 'uploads'), 'uploads', files);

      const photos = [];
      for (const f of files) {
        if (query && !f.path.toLowerCase().includes(query)) continue;
        const usages = usage.get(f.path) || [];
        const status = usages.some((x) => !x.hidden) ? 'used' : (usages.length ? 'hidden' : 'unused');
        if (filter === 'used' && status === 'unused') continue;
        if (filter === 'unused' && status !== 'unused') continue;
        photos.push({
          path: f.path, name: path.basename(f.path), size: f.bytes,
          used: status === 'used', status,
        });
      }

      // Сортировка: сначала неиспользованные, затем по имени
      photos.sort((a, b) => (a.used ? 1 : 0) - (b.used ? 1 : 0) || a.name.localeCompare(b.name, 'ru'));

      const total = photos.length;
      const paged = photos.slice((page - 1) * perPage, page * perPage);
      sendJSON(res, 200, { photos: paged, total, page, per_page: perPage });
    } catch (err) {
      console.error('❌ Ошибка фото-альбома:', err);
      sendJSON(res, 500, { error: err.message });
    }
  }

  // ── S159. Менеджер фотографий ────────────────────────────────────────
  // Фото живут в static/uploads/** и static/data/**. Использование собирается
  // изо ВСЕХ разделов базы (не только слайдеры/программы/тренеры, как в
  // handleGetPhotoAlbum), поэтому файл считается «неиспользуемым» только когда
  // на него реально никто не ссылается.
  const PHOTO_EXTS_RE = /\.(jpg|jpeg|png|webp|gif|svg)$/i;

  function walkUploads(dir, relBase, out) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
    for (const e of entries) {
      const abs = path.join(dir, e.name);
      const rel = relBase ? `${relBase}/${e.name}` : e.name;
      if (e.isDirectory()) { walkUploads(abs, rel, out); continue; }
      if (!e.isFile() || !PHOTO_EXTS_RE.test(e.name)) continue;
      let size = 0, mtime = 0;
      try { const st = fs.statSync(abs); size = st.size; mtime = st.mtimeMs; } catch {}
      out.push({ path: rel, bytes: size, mtime });
    }
    return out;
  }

  // Все ссылки на файлы в базе: relPath → [{ kind, id, name, url, hidden }]
  function collectPhotoUsage(db) {
    const map = new Map();
    const add = (raw, u) => {
      if (typeof raw !== 'string') return;
      let rel = raw.trim();
      if (!rel || rel.startsWith('http') || rel.startsWith('data:')) return;
      rel = rel.replace(/^\/+/, '');
      if (!PHOTO_EXTS_RE.test(rel)) return;
      let arr = map.get(rel);
      if (!arr) { arr = []; map.set(rel, arr); }
      // дубликаты (одна и та же сущность) не плодим
      if (!arr.some((x) => x.kind === u.kind && String(x.id) === String(u.id))) arr.push(u);
    };

    for (const s of (db.sliders || [])) add(s.image, { kind: 'slider', id: s.id, name: s.title || 'Слайд', url: '/#home-slider', hidden: !!s.hidden });
    for (const p of (db.programs || [])) {
      add(p.image, { kind: 'program', id: p.id, name: p.title || 'Программа', url: `/program.html?id=${p.id}`, hidden: !!p.hidden });
      for (const ph of (p.photoAlbum || [])) add(ph.image, { kind: 'program', id: p.id, name: `${p.title || 'Программа'} · альбом`, url: `/program.html?id=${p.id}`, hidden: !!p.hidden });
    }
    for (const t of (db.trainers || [])) {
      add(t.image, { kind: 'trainer', id: t.id, name: t.name || 'Тренер', url: `/trainer.html?id=${t.id}`, hidden: !!t.hidden });
      for (const ph of (t.photoAlbum || [])) add(ph.image, { kind: 'trainer', id: t.id, name: `${t.name || 'Тренер'} · альбом`, url: `/trainer.html?id=${t.id}`, hidden: !!t.hidden });
    }
    for (const n of (db.news || [])) {
      add(n.image, { kind: 'news', id: n.id, name: n.title || 'Новость', url: `/news.html?id=${n.id}`, hidden: !!n.hidden });
      for (const ph of (n.photos || [])) add(ph, { kind: 'news', id: n.id, name: `${n.title || 'Новость'} · галерея`, url: `/news.html?id=${n.id}`, hidden: !!n.hidden });
    }
    for (const d of (db.directions || [])) {
      add(d.image, { kind: 'direction', id: d.id, name: d.name || 'Направление', url: `/directions.html?id=${d.id}`, hidden: !!d.hidden });
      for (const p of (d.programs || [])) add(p.image, { kind: 'direction', id: d.id, name: `${d.name || 'Направление'} · ${p.title || ''}`, url: `/directions.html?id=${d.id}`, hidden: !!d.hidden });
    }
    for (const a of (db.album || [])) {
      add(a.image, { kind: 'album', id: a.id, name: a.caption || a.title || 'Фото альбома', url: '/album.html', hidden: false });
      add(a.thumb, { kind: 'album', id: a.id, name: a.caption || a.title || 'Миниатюра альбома', url: '/album.html', hidden: false });
    }
    // S166: мероприятия — обложка и фотогалерея
    for (const ev of (db.events || [])) {
      add(ev.image, { kind: 'event', id: ev.id, name: ev.name || 'Мероприятие', url: `/event.html?id=${ev.id}`, hidden: !!ev.hidden });
      for (const ph of (ev.photoAlbum || [])) add(ph.image, { kind: 'event', id: ev.id, name: `${ev.name || 'Мероприятие'} · галерея`, url: `/event.html?id=${ev.id}`, hidden: !!ev.hidden });
    }
    for (const s of (db.staff || [])) add(s.image, { kind: 'staff', id: s.id, name: s.name || 'Сотрудник', url: '/#contacts', hidden: !!s.hidden });
    for (const e of (db.employees || [])) add(e.image, { kind: 'staff', id: e.id, name: e.name || 'Сотрудник', url: '/#contacts', hidden: !!e.hidden });
    for (const h of (db.halls || [])) add(h.image, { kind: 'hall', id: h.id, name: h.name || 'Зал', url: '/#schedule', hidden: h.visible === false });
    for (const g of (db.schedule || [])) {
      add(g.image, { kind: 'schedule', id: g.id, name: g.name || 'Расписание', url: '/#schedule', hidden: !!g.hidden });
      for (const el of (g.elements || [])) add(el.image, { kind: 'schedule', id: g.id, name: g.name || 'Расписание', url: '/#schedule', hidden: !!g.hidden });
    }
    for (const pr of (db.prices || [])) {
      add(pr.image, { kind: 'price', id: pr.id, name: pr.title || pr.name || 'Прайс', url: '/#prices', hidden: !!pr.hidden });
      for (const it of (pr.items || [])) add(it.image, { kind: 'price', id: pr.id, name: pr.title || pr.name || 'Прайс', url: '/#prices', hidden: !!pr.hidden });
    }
    for (const it of (db.priceItems || [])) add(it.image, { kind: 'price', id: it.id, name: it.title || it.name || 'Позиция прайса', url: '/#prices', hidden: !!it.hidden });
    add((db.globalDivider || {}).image, { kind: 'site', id: 'divider', name: 'Разделитель', url: '/', hidden: false });
    add((db.siteSettings || {}).logo, { kind: 'site', id: 'logo', name: 'Логотип', url: '/', hidden: false });
    add((db.siteSettings || {}).favicon, { kind: 'site', id: 'favicon', name: 'Favicon', url: '/', hidden: false });

    return map;
  }

  // ── GET /api/admin/get-photo-manager ────────────────────────────────
  async function handleGetPhotoManager(req, res) {
    const token = extractTokenFromCookie(req.headers);
    if (!isValidSession(token)) {
      return sendJSON(res, 401, { error: 'Не авторизован' });
    }
    try {
      const body = (await readBody(req)) || {};
      const u = new URL(req.url, 'http://localhost');
      const p = (key, dflt) => (body[key] !== undefined && body[key] !== null && body[key] !== ''
        ? body[key] : (u.searchParams.get(key) !== null ? u.searchParams.get(key) : dflt));
      const filter = ['all', 'used', 'hidden', 'unused'].includes(p('filter', 'all')) ? p('filter', 'all') : 'all';
      // scope: uploads (веб-медиа сайта, по умолчанию) | data (рабочий архив) | all
      const scope = ['uploads', 'data', 'all'].includes(p('scope', 'uploads')) ? p('scope', 'uploads') : 'uploads';
      const query = String(p('q', p('query', '')) || '').trim().toLowerCase();
      const page = Math.max(1, parseInt(p('page', '1'), 10) || 1);
      const perPage = Math.min(500, Math.max(10, parseInt(p('per_page', '60'), 10) || 60));

      const db = readDb();
      const usage = collectPhotoUsage(db);

      const files = [];
      walkUploads(path.join(root, 'static', 'uploads'), 'uploads', files);
      walkUploads(path.join(root, 'static', 'data'), 'data', files);

      const existing = new Set(files.map((f) => f.path));
      // Битые ссылки: в базе путь есть, файла на диске нет
      const missing = [];
      for (const [rel, usages] of usage) {
        if (existing.has(rel)) continue;
        missing.push({ path: rel, usages: usages.slice(0, 4) });
      }

      const photos = [];
      let bytesTotal = 0, bytesUsed = 0, bytesHidden = 0, bytesUnused = 0;
      let nUsed = 0, nHidden = 0, nUnused = 0;
      const scopeStats = { uploads: { files: 0, bytes: 0 }, data: { files: 0, bytes: 0 } };

      for (const f of files) {
        const usages = usage.get(f.path) || [];
        const visible = usages.some((x) => !x.hidden);
        const status = visible ? 'used' : (usages.length ? 'hidden' : 'unused');
        bytesTotal += f.bytes;
        if (status === 'used') { nUsed++; bytesUsed += f.bytes; }
        else if (status === 'hidden') { nHidden++; bytesHidden += f.bytes; }
        else { nUnused++; bytesUnused += f.bytes; }
        const sc = f.path.startsWith('data/') ? 'data' : 'uploads';
        scopeStats[sc].files++; scopeStats[sc].bytes += f.bytes;
        if (scope !== 'all' && scope !== sc) continue;
        if (filter !== 'all' && filter !== status) continue;
        if (query && !f.path.toLowerCase().includes(query)) continue;
        photos.push({
          path: f.path, name: path.basename(f.path), bytes: f.bytes, mtime: f.mtime,
          status, scope: sc, usages,
        });
      }

      // Сортировка: сначала то, что можно очистить (hidden → unused), затем used
      const rank = { hidden: 0, unused: 1, used: 2 };
      photos.sort((a, b) => (rank[a.status] - rank[b.status]) || a.path.localeCompare(b.path, 'ru'));

      sendJSON(res, 200, {
        photos: photos.slice((page - 1) * perPage, page * perPage),
        total: photos.length,
        page, per_page: perPage,
        scope,
        stats: {
          files: files.length, used: nUsed, hidden: nHidden, unused: nUnused,
          bytes_total: bytesTotal, bytes_used: bytesUsed,
          bytes_hidden: bytesHidden, bytes_unused: bytesUnused,
          scope_stats: scopeStats,
          missing: missing.length,
          missing_list: missing.slice(0, 50),
        },
      });
    } catch (err) {
      console.error('❌ Ошибка менеджера фото:', err);
      sendJSON(res, 500, { error: err.message });
    }
  }

  // Чистка ссылок на удалённые файлы во всех разделах базы.
  // Слайды, оставшиеся без картинки, удаляются целиком (пустая картинка = битый слайд).
  function removePhotoRefs(db, removedSet) {
    const hit = (v) => typeof v === 'string' && removedSet.has(v.trim().replace(/^\/+/, ''));
    const cleared = { sliders: 0, programAlbum: 0, trainerAlbum: 0, newsPhotos: 0, album: 0, images: 0 };

    if (Array.isArray(db.sliders)) {
      const keep = [];
      for (const s of db.sliders) {
        if (hit(s.image)) { cleared.sliders++; continue; }
        keep.push(s);
      }
      db.sliders = keep;
    }
    for (const p of (db.programs || [])) {
      if (Array.isArray(p.photoAlbum)) {
        const before = p.photoAlbum.length;
        p.photoAlbum = p.photoAlbum.filter((x) => !hit(x && x.image));
        cleared.programAlbum += before - p.photoAlbum.length;
      }
      if (hit(p.image)) { p.image = ''; cleared.images++; }
    }
    for (const t of (db.trainers || [])) {
      if (Array.isArray(t.photoAlbum)) {
        const before = t.photoAlbum.length;
        t.photoAlbum = t.photoAlbum.filter((x) => !hit(x && x.image));
        cleared.trainerAlbum += before - t.photoAlbum.length;
      }
      if (hit(t.image)) { t.image = ''; cleared.images++; }
    }
    for (const n of (db.news || [])) {
      if (Array.isArray(n.photos)) {
        const before = n.photos.length;
        n.photos = n.photos.filter((x) => !hit(x));
        cleared.newsPhotos += before - n.photos.length;
      }
      if (hit(n.image)) { n.image = ''; cleared.images++; }
    }
    if (Array.isArray(db.album)) {
      const before = db.album.length;
      db.album = db.album.filter((a) => !(hit(a.image) || hit(a.thumb)));
      cleared.album = before - db.album.length;
    }
    for (const d of (db.directions || [])) {
      if (hit(d.image)) { d.image = ''; cleared.images++; }
      for (const p of (d.programs || [])) if (hit(p.image)) { p.image = ''; cleared.images++; }
    }
    for (const s of (db.staff || [])) if (hit(s.image)) { s.image = ''; cleared.images++; }
    for (const e of (db.employees || [])) if (hit(e.image)) { e.image = ''; cleared.images++; }
    for (const h of (db.halls || [])) if (hit(h.image)) { h.image = ''; cleared.images++; }
    for (const g of (db.schedule || [])) {
      if (hit(g.image)) { g.image = ''; cleared.images++; }
      for (const el of (g.elements || [])) if (hit(el.image)) { el.image = ''; cleared.images++; }
    }
    for (const pr of (db.prices || [])) {
      if (hit(pr.image)) { pr.image = ''; cleared.images++; }
      for (const it of (pr.items || [])) if (hit(it.image)) { it.image = ''; cleared.images++; }
    }
    for (const it of (db.priceItems || [])) if (hit(it.image)) { it.image = ''; cleared.images++; }
    if (db.globalDivider && hit(db.globalDivider.image)) { db.globalDivider.image = ''; cleared.images++; }
    const ss = db.siteSettings || {};
    for (const k of ['logo', 'favicon']) if (hit(ss[k])) { ss[k] = ''; cleared.images++; }

    return cleared;
  }

  // ── POST /api/admin/delete-photos { paths: [...] } ──────────────────
  // Файлы НЕ удаляются напрямую — переносятся в trash/uploads/<timestamp>/,
  // ссылки в базе чистятся, статика перегенерируется.
  async function handleDeletePhotos(req, res) {
    const token = extractTokenFromCookie(req.headers);
    if (!isValidSession(token)) {
      return sendJSON(res, 401, { error: 'Не авторизован' });
    }
    try {
      const data = (await readBody(req)) || {};
      const requested = Array.isArray(data.paths) ? data.paths : [];
      if (!requested.length) return sendJSON(res, 400, { error: 'Не передан список путей' });
      if (requested.length > 2000) return sendJSON(res, 400, { error: 'Слишком много файлов за раз (макс. 2000)' });

      // Нормализация + защита от выхода за пределы static/
      const rels = new Set();
      for (const raw of requested) {
        if (typeof raw !== 'string') continue;
        const rel = raw.trim().replace(/^\/+/, '');
        if (!rel || rel.includes('..')) continue;
        if (!rel.startsWith('uploads/') && !rel.startsWith('data/')) continue;
        if (!PHOTO_EXTS_RE.test(rel)) continue;
        rels.add(rel);
      }
      // Миниатюры album/full/X → album/thumb/X удаляем парами
      for (const rel of Array.from(rels)) {
        const m = rel.match(/^uploads\/album\/full\/(.+)$/);
        if (m) { const t = `uploads/album/thumb/${m[1]}`; if (fs.existsSync(path.join(root, 'static', t))) rels.add(t); }
        const t = rel.match(/^uploads\/album\/thumb\/(.+)$/);
        if (t) { const f = `uploads/album/full/${t[1]}`; if (fs.existsSync(path.join(root, 'static', f))) rels.add(f); }
      }

      // Защита: файлы, на которые ссылывается видимая сущность, не трогаем
      // (пока не запрошено явное force). Скрытые/безымянные — можно.
      const db = readDb();
      const usage = collectPhotoUsage(db);
      const force = data.force === true;
      const skipped = [];
      if (!force) {
        for (const rel of Array.from(rels)) {
          const us = usage.get(rel) || [];
          if (us.some((x) => !x.hidden)) {
            rels.delete(rel);
            skipped.push({ path: rel, reason: 'used', usages: us.slice(0, 3) });
          }
        }
      }
      if (!rels.size) {
        return sendJSON(res, 200, { removed: [], freed_bytes: 0, skipped, note: 'Все файлы используются сайтом' });
      }

      const trashDir = path.join(root, 'trash', 'uploads', String(Date.now()));
      const removed = [];
      let freedBytes = 0;
      for (const rel of rels) {
        const abs = path.join(root, 'static', rel);
        if (!fs.existsSync(abs)) continue;
        const dest = path.join(trashDir, rel);
        try {
          fs.mkdirSync(path.dirname(dest), { recursive: true });
          fs.renameSync(abs, dest);
          let size = 0; try { size = fs.statSync(dest).size; } catch {}
          freedBytes += size;
          removed.push(rel);
        } catch (e) { console.warn('⚠️ Не перенесён в корзину:', rel, e.message); }
      }
      if (!removed.length) return sendJSON(res, 200, { removed: [], freed_bytes: 0, skipped, note: 'Файлы не найдены' });

      const removedSet = new Set(removed);
      const cleared = removePhotoRefs(db, removedSet);
      backupDB();
      writeDb(db);
      await regenerateStatic();

      console.log(`🗑 В корзину: ${removed.length} фото (${(freedBytes / 1048576).toFixed(1)} МБ) → trash/uploads/${path.basename(trashDir)}`);
      sendJSON(res, 200, {
        removed, freed_bytes: freedBytes, cleared, skipped,
        trash: `trash/uploads/${path.basename(trashDir)}`,
        staticRegenerated: true,
      });
    } catch (err) {
      console.error('❌ Ошибка удаления фото:', err);
      sendJSON(res, 500, { error: err.message });
    }
  }

  // Соцсети: id/title/url, только http(s) или пусто
  function sanitizeSocial(raw) {
    const src = Array.isArray(raw) ? raw : [];
    const out = [];
    const seen = new Set();
    for (const s of src) {
      if (!s || typeof s !== 'object') continue;
      const id = String(s.id || '').trim().replace(/[^\w-]/g, '').slice(0, 20);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const url = String(s.url || '').trim();
      out.push({
        id,
        title: cleanPriceText(s.title || id, 40),
        url: /^https?:\/\/[^\s<>"']+/i.test(url) ? url.slice(0, 300) : ''
      });
    }
    return out;
  }

  async function handleGetContacts(req, res) {
    const token = extractTokenFromCookie(req.headers);
    if (!isValidSession(token)) return sendJSON(res, 401, { error: 'Не авторизован' });
    try {
      const db = readDb();
      const c = db.contacts || {};
      sendJSON(res, 200, {
        contacts: {
          address: c.address || '',
          phone: c.phone || '',
          email: c.email || '',
          vk: c.vk || '',
          social: sanitizeSocial(c.social)
        },
        additionalContacts: db.additionalContacts && typeof db.additionalContacts === 'object'
          ? db.additionalContacts : {}
      });
    } catch (err) {
      console.error('❌ Ошибка чтения контактов:', err);
      sendJSON(res, 500, { error: err.message });
    }
  }

  async function handleSaveContacts(req, res) {
    const token = extractTokenFromCookie(req.headers);
    if (!isValidSession(token)) return sendJSON(res, 401, { error: 'Не авторизован' });
    const body = await readBody(req);
    if (!body?.contacts || typeof body.contacts !== 'object') {
      return sendJSON(res, 400, { error: 'Нет данных контактов' });
    }
    try {
      const db = readDb();
      const c = body.contacts;
      const email = String(c.email || '').trim().slice(0, 120);
      db.contacts = {
        address: cleanPriceText(c.address, 200),
        phone: cleanPriceText(c.phone, 40),
        email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '',
        vk: /^https?:\/\/[^\s<>"']+/i.test(String(c.vk || '').trim())
          ? String(c.vk).trim().slice(0, 300) : '',
        social: sanitizeSocial(c.social)
      };
      backupDB();
      writeDb(db);
      regenerateStatic();
      sendJSON(res, 200, { ok: true, contacts: db.contacts });
    } catch (err) {
      console.error('❌ Ошибка сохранения контактов:', err);
      sendJSON(res, 500, { error: err.message });
    }
  }

  function sanitizeAlbum(raw) {
    const src = Array.isArray(raw) ? raw : [];
    const seen = new Set();
    const out = [];
    for (const item of src) {
      if (!item || typeof item !== 'object') continue;
      const image = cleanMediaPath(item.image);
      if (!image) continue;
      let id = Number(item.id);
      if (!Number.isFinite(id) || id <= 0) id = Date.now() + out.length;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({
        id,
        image,
        thumb: cleanMediaPath(item.thumb) || image,
        title: cleanPriceText(item.title, 120),
        category: cleanPriceText(item.category, 60),
        date: /^\d{4}-\d{2}-\d{2}$/.test(String(item.date || '')) ? String(item.date) : ''
      });
    }
    return out;
  }

  async function handleGetAlbum(req, res) {
    const token = extractTokenFromCookie(req.headers);
    if (!isValidSession(token)) return sendJSON(res, 401, { error: 'Не авторизован' });
    try {
      const db = readDb();
      sendJSON(res, 200, { album: sanitizeAlbum(db.album) });
    } catch (err) {
      console.error('❌ Ошибка чтения альбома:', err);
      sendJSON(res, 500, { error: err.message });
    }
  }

  async function handleSaveAlbum(req, res) {
    const token = extractTokenFromCookie(req.headers);
    if (!isValidSession(token)) return sendJSON(res, 401, { error: 'Не авторизован' });
    const body = await readBody(req);
    if (!body?.album || !Array.isArray(body.album)) {
      return sendJSON(res, 400, { error: 'Нет данных альбома' });
    }
    try {
      const db = readDb();
      const album = sanitizeAlbum(body.album);
      db.album = album;
      backupDB();
      writeDb(db);
      regenerateStatic();
      sendJSON(res, 200, { ok: true, album });
    } catch (err) {
      console.error('❌ Ошибка сохранения альбома:', err);
      sendJSON(res, 500, { error: err.message });
    }
  }

  // ============================================
  // S115: Цены позициями и скидки (settings.priceItems / settings.discounts)
  //
  // crud: get-price-items / save-price-items / get-discounts / save-discounts
  // Скрытые CRM-поля (trainerPay, payMode, freeTrainerPay) хранятся в базе,
  // но на сайт не экспортируются (см. export-static.mjs) — их читает только
  // админка и будущий CRM.
  // ============================================

  const PRICE_CRM_DEFAULTS = { trainerPay: 150, payMode: 'base(1)', freeTrainerPay: 150 };
  const DISCOUNT_TYPES = ['percent', 'amount', 'bonus', 'note'];

  // Текст в одну строку без управляющих символов и разметки
  function cleanPriceText(v, max) {
    return String(v == null ? '' : v)
      .replace(/[\u0000-\u001f<>]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, max);
  }

  // «2 800», «2800,50», «900 ₽» → число ≥ 0. Пусто/「-」/мусор → fallback
  function cleanPriceNumber(v, fallback) {
    const s = String(v == null ? '' : v).trim();
    if (!s || s === '-' || s === '—') return fallback === undefined ? null : fallback;
    const n = Number(s.replace(/[^\d.,]/g, '').replace(',', '.'));
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : (fallback === undefined ? null : fallback);
  }

  // Порядок массива = порядок payload (его задаёт админка перетаскиванием)
  function sanitizePriceItems(raw, db) {
    const src = Array.isArray(raw) ? raw : [];
    const prev = new Map((db.priceItems || []).map(i => [String(i.id), i]));
    const programById = new Map((db.programs || []).map(p => [String(p.id), p]));
    const trainerById = new Map((db.trainers || []).map(t => [String(t.id), t]));
    const usedIds = new Set();
    let nextId = src.reduce((m, i) => Math.max(m, Number(i.id) || 0), 0) + 1;

    const items = [];
    for (const i of src) {
      if (!i || typeof i !== 'object') continue;
      const title = cleanPriceText(i.title, 160);
      const price = cleanPriceNumber(i.price, null);
      if (!title || price === null) continue;   // без названия или цены — не позиция

      let id = String(i.id == null ? '' : i.id).trim();
      if (!/^\d+$/.test(id) || usedIds.has(id)) id = String(nextId++);
      usedIds.add(id);

      const old = prev.get(id) || {};
      // Привязки — только к существующим объектам, тип id берём из базы
      const prog = i.programId == null || i.programId === '' ? null : programById.get(String(i.programId));
      const tr = i.trainerId == null || i.trainerId === '' ? null : trainerById.get(String(i.trainerId));

      items.push({
        id: Number(id),
        group: cleanPriceText(i.group, 80) || 'Цены',
        title,
        variant: cleanPriceText(i.variant, 80),
        price,
        priceOld: cleanPriceNumber(i.priceOld, null),
        unit: cleanPriceText(i.unit, 60),
        note: cleanPriceText(i.note, 400),
        programId: prog ? prog.id : null,
        trainerId: tr ? tr.id : null,
        discountIds: Array.isArray(old.discountIds) ? old.discountIds : [],
        visible: i.visible !== false,
        order: items.length + 1,
        // Скрытые CRM-поля: если админка их не прислала — берём прежние, иначе дефолты
        trainerPay: cleanPriceNumber(i.trainerPay ?? old.trainerPay, PRICE_CRM_DEFAULTS.trainerPay),
        payMode: cleanPriceText(i.payMode ?? old.payMode, 32) || PRICE_CRM_DEFAULTS.payMode,
        freeTrainerPay: cleanPriceNumber(i.freeTrainerPay ?? old.freeTrainerPay, PRICE_CRM_DEFAULTS.freeTrainerPay)
      });
    }
    return items;
  }

  function sanitizeDiscounts(raw, db, items) {
    const src = Array.isArray(raw) ? raw : [];
    const itemIds = new Set(items.map(i => String(i.id)));
    const usedIds = new Set();
    let nextId = src.reduce((m, d) => Math.max(m, Number(d.id) || 0), 0) + 1;

    const list = [];
    for (const d of src) {
      if (!d || typeof d !== 'object') continue;
      const title = cleanPriceText(d.title, 160);
      if (!title) continue;

      let id = String(d.id == null ? '' : d.id).trim();
      if (!/^\d+$/.test(id) || usedIds.has(id)) id = String(nextId++);
      usedIds.add(id);

      // Привязка только к позициям, которые реально есть в новом списке
      const seen = new Set();
      const appliesTo = [];
      for (const ref of Array.isArray(d.appliesTo) ? d.appliesTo : []) {
        const key = String(ref);
        if (!itemIds.has(key) || seen.has(key)) continue;
        seen.add(key);
        appliesTo.push(items.find(i => String(i.id) === key).id);
      }

      list.push({
        id: Number(id),
        title,
        type: DISCOUNT_TYPES.includes(d.type) ? d.type : 'note',
        value: cleanPriceNumber(d.value, 0),
        condition: cleanPriceText(d.condition, 1000),
        appliesTo,
        visible: d.visible !== false,
        order: list.length + 1
      });
    }
    return list;
  }

  // Обратные ссылки позиций — производные от discounts.appliesTo, всегда пересобираем
  function syncPriceDiscountLinks(items, discounts) {
    items.forEach(i => { i.discountIds = []; });
    for (const d of discounts) {
      for (const ref of d.appliesTo) {
        const item = items.find(i => String(i.id) === String(ref));
        if (item && !item.discountIds.includes(d.id)) item.discountIds.push(d.id);
      }
    }
  }

  async function handleGetPriceItems(req, res) {
    const token = extractTokenFromCookie(req.headers);
    if (!isValidSession(token)) {
      return sendJSON(res, 401, { error: 'Не авторизован' });
    }
    try {
      const db = readDb();
      const items = sanitizePriceItems(db.priceItems || [], db);
      syncPriceDiscountLinks(items, db.discounts || []);
      sendJSON(res, 200, {
        priceItems: items,
        groups: [...new Set(items.map(i => i.group))],
        programs: (db.programs || []).filter(p => !p.hidden).map(p => ({ id: p.id, name: p.name || '' })),
        trainers: (db.trainers || []).filter(t => !t.hidden).map(t => ({ id: t.id, name: t.name || '' }))
      });
    } catch (err) {
      console.error('❌ Ошибка чтения позиций цен:', err);
      sendJSON(res, 500, { error: err.message });
    }
  }

  async function handleSavePriceItems(req, res) {
    const token = extractTokenFromCookie(req.headers);
    if (!isValidSession(token)) {
      return sendJSON(res, 401, { error: 'Не авторизован' });
    }
    const body = await readBody(req);
    if (!body?.priceItems || !Array.isArray(body.priceItems)) {
      return sendJSON(res, 400, { error: 'Нет данных позиций цен' });
    }
    try {
      const db = readDb();
      const items = sanitizePriceItems(body.priceItems, db);
      // Скидки остаются, но теряют ссылки на удалённые позиции
      const discounts = sanitizeDiscounts(db.discounts || [], db, items);
      syncPriceDiscountLinks(items, discounts);

      db.priceItems = items;
      db.discounts = discounts;
      backupDB();
      writeDb(db);
      regenerateStatic();
      sendJSON(res, 200, { ok: true, priceItems: items, discounts });
    } catch (err) {
      console.error('❌ Ошибка сохранения позиций цен:', err);
      sendJSON(res, 500, { error: err.message });
    }
  }

  async function handleGetDiscounts(req, res) {
    const token = extractTokenFromCookie(req.headers);
    if (!isValidSession(token)) {
      return sendJSON(res, 401, { error: 'Не авторизован' });
    }
    try {
      const db = readDb();
      const items = sanitizePriceItems(db.priceItems || [], db);
      const discounts = sanitizeDiscounts(db.discounts || [], db, items);
      sendJSON(res, 200, {
        discounts,
        priceItems: items.map(i => ({
          id: i.id, group: i.group, title: i.title, variant: i.variant, price: i.price
        }))
      });
    } catch (err) {
      console.error('❌ Ошибка чтения скидок:', err);
      sendJSON(res, 500, { error: err.message });
    }
  }

  async function handleSaveDiscounts(req, res) {
    const token = extractTokenFromCookie(req.headers);
    if (!isValidSession(token)) {
      return sendJSON(res, 401, { error: 'Не авторизован' });
    }
    const body = await readBody(req);
    if (!body?.discounts || !Array.isArray(body.discounts)) {
      return sendJSON(res, 400, { error: 'Нет данных скидок' });
    }
    try {
      const db = readDb();
      const items = sanitizePriceItems(db.priceItems || [], db);
      const discounts = sanitizeDiscounts(body.discounts, db, items);
      syncPriceDiscountLinks(items, discounts);

      db.discounts = discounts;
      db.priceItems = items;
      backupDB();
      writeDb(db);
      regenerateStatic();
      sendJSON(res, 200, { ok: true, discounts, priceItems: items });
    } catch (err) {
      console.error('❌ Ошибка сохранения скидок:', err);
      sendJSON(res, 500, { error: err.message });
    }
  }

  // S135: Персонал (staff / администраторы)
  async function handleGetStaff(req, res) {
    try {
      const db = flattenDb(JSON.parse(fs.readFileSync(dbPath, 'utf-8')));
      sendJSON(res, 200, { staff: db.staff || [] });
    } catch (err) {
      sendJSON(res, 500, { error: err.message });
    }
  }

  async function handleSaveStaff(req, res) {
    const token = extractTokenFromCookie(req.headers);
    if (!isValidSession(token)) {
      return sendJSON(res, 401, { error: 'Не авторизован' });
    }
    const body = await readBody(req);
    if (!body?.staff || !Array.isArray(body.staff)) {
      return sendJSON(res, 400, { error: 'Нет данных персонала' });
    }
    try {
      const db = readDb();
      // Санитизация
      const sanitized = body.staff.map(s => {
        const img = s.image || '';
        const localImg = /^https?:\/\//i.test(img) ? '' : (img.replace(/^\//, '') || '');
        return {
          id: String(s.id || 'staff-' + Date.now()),
          name: String(s.name || '').trim().slice(0, 120),
          role: String(s.role || '').trim().slice(0, 60),
          image: localImg,
          hidden: !!s.hidden
        };
      }).filter(s => s.name); // без пустых имён
      if (sanitized.length === 0 && (db.staff || []).length > 0) {
        // S140: удаление всех администраторов — предупреждение и бэкап
        console.warn('⚠️ S140: удаляются ВСЕ администраторы. Бэкап перед изменением.');
        backupDB();
      }
      db.staff = sanitized;
      backupDB();
      writeDb(db);
      regenerateStatic();
      sendJSON(res, 200, { ok: true, staff: sanitized });
    } catch (err) {
      console.error('❌ Ошибка сохранения персонала:', err);
      sendJSON(res, 500, { error: err.message });
    }
  }

  // S141: журнал ошибок 404 + письмо на техпочту
  const emailThrottle = {}; // url → timestamp последней отправки
  const EMAIL_COOLDOWN_MS = 5 * 60 * 1000; // 5 минут

  async function handleLog404(req, res) {
    try {
      const body = await readBody(req);
      const logDir = path.join(root, 'logs');
      if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
      const entry = {
        url: String(body.url || '').slice(0, 500),
        from: String(body.from || '').slice(0, 500),
        id: String(body.id || '').slice(0, 100),
        ua: String(body.ua || '').slice(0, 500),
        screen: String(body.screen || '').slice(0, 20),
        ts: String(body.ts || new Date().toISOString()).slice(0, 30)
      };
      // JSONL — каждая строка отдельный JSON
      fs.appendFileSync(path.join(logDir, '404.log'), JSON.stringify(entry) + '\n', 'utf-8');

      // Письмо на техпочту (анти-спам: 5 мин на URL)
      const urlKey = entry.url;
      const now = Date.now();
      if (!emailThrottle[urlKey] || now - emailThrottle[urlKey] > EMAIL_COOLDOWN_MS) {
        emailThrottle[urlKey] = now;
        sendEmail404(entry).catch(function () {}); // ошибка письма не ломает ответ
      }

      sendJSON(res, 200, { ok: true });
    } catch (err) {
      console.error('❌ Ошибка log-404:', err.message);
      sendJSON(res, 500, { error: err.message });
    }
  }

  async function sendEmail404(entry) {
    try {
      const db = flattenDb(JSON.parse(fs.readFileSync(dbPath, 'utf-8')));
      const ec = db.emailConfig || {};
      const smtpHost = ec.smtpHost || 'smtp.yandex.ru';
      const smtpPort = ec.smtpPort || 465;
      const smtpSecure = ec.smtpSecure !== false;
      const smtpUser = ec.smtpUser;
      const smtpPass = ec.smtpPass;
      if (!smtpUser || !smtpPass) return; // нет SMTP — пропускаем
      const nodemailer = (await import('nodemailer')).default;
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: { user: smtpUser, pass: smtpPass }
      });
      const to = ec.adminEmail || smtpUser;
      const subject = '404 на центр-фр.рф: ' + entry.url;
      const html = '<h3>Ошибка 404</h3>' +
        '<p><b>URL:</b> ' + escapeHtml(entry.url) + '</p>' +
        '<p><b>Откуда пришёл:</b> ' + escapeHtml(entry.from || '—') + '</p>' +
        '<p><b>ID:</b> ' + escapeHtml(entry.id || '—') + '</p>' +
        '<p><b>UA:</b> ' + escapeHtml(entry.ua) + '</p>' +
        '<p><b>Экран:</b> ' + escapeHtml(entry.screen) + '</p>' +
        '<p><b>Время:</b> ' + entry.ts + '</p>';
      await transporter.sendMail({
        from: ec.fromName ? ec.fromName + ' <' + smtpUser + '>' : smtpUser,
        to: to,
        subject: subject,
        html: html
      });
    } catch (e) {
      console.warn('Не удалось отправить письмо 404:', e.message);
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ============================================
  // S151: Leads (заявки «Вызовы форм обратной связи»)
  // ============================================
  const LEADS_DB_PATH = path.join(root, 'leads.json');
  const LEADS_STATUS_WHITELIST = [
    'Новая', 'Звонок', 'Объяснено',
    'Клиент_пришёл_на_первую', 'Клиент_ходит'
  ];
  // Анти-спам: один IP → максимум 1 запись в период 30 секунд
  const LEADS_THROTTLE = {};
  const LEADS_THROTTLE_MS = 30 * 1000;

  function readLeads() {
    try {
      const raw = JSON.parse(fs.readFileSync(LEADS_DB_PATH, 'utf-8'));
      return Array.isArray(raw.leads) ? raw.leads : [];
    } catch { return []; }
  }

  function writeLeads(list) {
    const dir = path.join(root, 'backups');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(LEADS_DB_PATH, JSON.stringify({ leads: list }, null, 2), 'utf-8');
  }

  function backupLeads() {
    try {
      const ts = Date.now();
      const backupPath = path.join(root, 'backups', `leads.json.backup.${ts}`);
      fs.copyFileSync(LEADS_DB_PATH, backupPath);
    } catch { /* бэкап необязателен */ }
  }

  function getClientIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
    return req.socket.remoteAddress || '';
  }

  async function handleCreateLead(req, res) {
    try {
      const ip = getClientIp(req);
      const now = Date.now();
      // Анти-спам: один IP — 1 запись за 30 секунд
      if (LEADS_THROTTLE[ip] && now - LEADS_THROTTLE[ip] < LEADS_THROTTLE_MS) {
        return sendJSON(res, 429, { error: 'Слишком часто. Повторите через 30 секунд.' });
      }
      LEADS_THROTTLE[ip] = now;

      const body = await readBody(req);
      if (!body) return sendJSON(res, 400, { error: 'Нет данных' });

      const name = String(body.name || '').trim().slice(0, 120);
      const phone = String(body.phone || '').trim().slice(0, 60);
      if (!name || !phone) {
        return sendJSON(res, 400, { error: 'Имя и телефон обязательны' });
      }

      const lead = {
        id: now,
        ts: new Date().toISOString(),
        name,
        phone,
        email: String(body.email || '').trim().slice(0, 200),
        message: String(body.message || '').trim().slice(0, 2000),
        reason: String(body.reason || '').trim().slice(0, 500),
        page: String(body.page || '').trim().slice(0, 120),
        ua: String(body.ua || '').trim().slice(0, 500),
        status: 'Новая'
      };

      const leads = readLeads();
      leads.unshift(lead);
      writeLeads(leads);

      console.log(`📣 Новая заявка от "${lead.name}" (${lead.page})`);

      // S153: уведомление на adminEmail о новой заявке
      sendLeadNotification(lead).catch(() => {}); // ошибка письма не блокирует ответ

      sendJSON(res, 200, { ok: true });
    } catch (err) {
      console.error('❌ Ошибка lead-create:', err.message);
      sendJSON(res, 500, { error: err.message });
    }
  }

  // S153/S155: отправка уведомления о новой заявке.
  // Результат пишется в logs/leads-email.log + обновляется emailSent в leads.json
  // (раньше .catch(() => {}) скрывал причину, и баг искали вслепую).
  function logLeadEmail(entry) {
    try {
      const logDir = path.join(root, 'logs');
      if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
      fs.appendFileSync(path.join(logDir, 'leads-email.log'),
        JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n', 'utf-8');
    } catch { /* журнал не критичен */ }
  }

  /**
   * S155: обновить поле emailSent в записи лида (для диагностики в UI).
   * После успешной/неудачной отправки — записать результат в leads.json,
   * чтобы в CRM админ видел, отправлено ли письмо о заявке.
   */
  function markLeadEmailSent(leadId, sent, error) {
    try {
      const leads = readLeads();
      const lead = leads.find(l => l.id === leadId);
      if (!lead) return;
      lead.emailSent = sent;
      if (error) {
        lead.emailError = String(error).slice(0, 300);
      } else {
        delete lead.emailError;
      }
      writeLeads(leads);
    } catch { /* не критично — письмо и так отправлено/не отправлено */ }
  }

  // S155: письмо проходит фильтр Яндекса «От кого содержит centr-fr@yandex.ru
  // И Тема содержит Заявка: → папка Заявки с сайта». Тема начинается с
  // «Заявка:», от = smtpUser (как в старом шаблоне Next.js-версии).
  function formatLeadTime(iso) {
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      return d.toLocaleString('ru-RU', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Yekaterinburg'
      }) + ' (Екб)';
    } catch { return iso; }
  }

  async function sendLeadNotification(lead) {
    try {
      const db = flattenDb(JSON.parse(fs.readFileSync(dbPath, 'utf-8')));
      const ec = db.emailConfig || {};
      const smtpHost = ec.smtpHost || 'smtp.yandex.ru';
      const smtpPort = ec.smtpPort || 465;
      const smtpSecure = ec.smtpSecure !== false;
      const smtpUser = ec.smtpUser;
      const smtpPass = ec.smtpPass;
      if (!smtpUser || !smtpPass) {
        console.warn('⚠️ SMTP пароль не установлен — уведомление о заявке не отправлено');
        logLeadEmail({ leadId: lead.id, ok: false, error: 'smtpUser или smtpPass пустой' });
        markLeadEmailSent(lead.id, false, 'smtpUser или smtpPass пустой');
        return;
      }
      const nodemailer = (await import('nodemailer')).default;
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: { user: smtpUser, pass: smtpPass }
      });
      const to = ec.adminEmail || smtpUser;
      // S155: тема «Заявка: ...» — по фильтру Яндекса (папка «Заявки с сайта»)
      const subject = '🐼 Заявка: ' + lead.name + ' (' + (lead.page || 'Сайт') + ')';
      const time = formatLeadTime(lead.ts);
      const text = 'Имя: ' + lead.name +
        '\nТелефон: ' + lead.phone +
        '\nEmail: ' + (lead.email || '—') +
        '\nЖелание: ' + (lead.reason || '—') +
        '\nСообщение: ' + (lead.message || '—') +
        '\nВремя: ' + time;
      // Старый шаблон (Next.js send-email/route.ts): зелёный блок + «Срочно перезвоните».
      // S155: UA в письмо не пишем (есть в leads.json), время — человекочитаемое.
      const html =
        '<div style="font-family: Arial, sans-serif; max-width: 600px;">' +
        '<h2 style="color: #10b981;">🐼 Новая заявка!</h2>' +
        '<div style="background: #d1fae5; padding: 20px; border-radius: 12px; border-left: 5px solid #10b981;">' +
        '<p style="margin:6px 0;"><strong>👤 Имя:</strong> ' + escapeHtml(lead.name) + '</p>' +
        '<p style="margin:6px 0;"><strong>📱 Телефон:</strong> <a href="tel:' + escapeHtml(lead.phone.replace(/[^\d+]/g, '')) + '" style="color:#059669;">' + escapeHtml(lead.phone) + '</a></p>' +
        '<p style="margin:6px 0;"><strong>✉️ Email:</strong> ' + escapeHtml(lead.email || '—') + '</p>' +
        '<p style="margin:6px 0;"><strong>🎯 Желание:</strong> ' + escapeHtml(lead.reason || '—') + '</p>' +
        '<p style="margin:6px 0;"><strong>💬 Сообщение:</strong> ' + escapeHtml(lead.message || '—').replace(/\n/g, '<br>') + '</p>' +
        '<p style="margin:6px 0;opacity:.75;font-size:.9em;">🕐 ' + escapeHtml(time) + '</p>' +
        '</div>' +
        '<hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">' +
        '<p style="color: #ef4444; font-weight: bold;">⚡ Срочно перезвоните клиенту!</p>' +
        '</div>';
      const info = await transporter.sendMail({
        // S155: from = «"<адрес>" <адрес>» — ровно как в старом шаблоне,
        // чтобы проходил фильтр Яндекса «От кого содержит "centr-fr@yandex.ru" <centr-fr@yandex.ru>»
        from: '"' + smtpUser + '" <' + smtpUser + '>',
        to: to,
        subject: subject,
        text: text,
        html: html
      });
      console.log('📧 Уведомление о заявке отправлено на ' + to + ' (id: ' + info.messageId + ')');
      logLeadEmail({ leadId: lead.id, ok: true, to: to, subject: subject, messageId: info.messageId, response: info.response });
      markLeadEmailSent(lead.id, true);
    } catch (e) {
      console.warn('⚠️ Не удалось отправить уведомление о заявке:', e.message);
      logLeadEmail({ leadId: lead && lead.id, ok: false, error: e.message, code: e.code || '' });
      markLeadEmailSent(lead.id, false, e.message);
    }
  }

  async function handleGetLeads(req, res) {
    const token = extractTokenFromCookie(req.headers);
    if (!isValidSession(token)) {
      return sendJSON(res, 401, { error: 'Не авторизован' });
    }
    const leads = readLeads();
    // Новые первыми
    const sorted = leads.slice().sort((a, b) => {
      const order = LEADS_STATUS_WHITELIST.indexOf(a.status) - LEADS_STATUS_WHITELIST.indexOf(b.status);
      if (order !== 0) return order;
      return (b.id || 0) - (a.id || 0);
    });
    sendJSON(res, 200, { leads: sorted });
  }

  async function handleSaveLeads(req, res) {
    const token = extractTokenFromCookie(req.headers);
    if (!isValidSession(token)) {
      return sendJSON(res, 401, { error: 'Не авторизован' });
    }
    const body = await readBody(req);
    const updated = body?.leads;
    if (!Array.isArray(updated)) {
      return sendJSON(res, 400, { error: 'Нет списка заявок' });
    }
    try {
      const leads = readLeads();
      const map = new Map(leads.map(l => [l.id, l]));
      for (const item of updated) {
        const lead = map.get(Number(item.id));
        if (!lead) continue;
        // Whitelist статусов
        const st = String(item.status || '').trim();
        if (LEADS_STATUS_WHITELIST.includes(st)) {
          lead.status = st;
        }
      }
      backupLeads();
      writeLeads(leads);
      sendJSON(res, 200, { ok: true });
    } catch (err) {
      console.error('❌ Ошибка save-leads:', err.message);
      sendJSON(res, 500, { error: err.message });
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
      title: '🥋 Наши тренировки',
      content: `# Наши тренировки\n\nУправление программами тренировок, которые отображаются на сайте.\n\n## Возможности:\n- Добавление программ с описанием\n- Загрузка обложки\n- Привязка фотоальбома\n- Категории программ\n\n## Поля программы:\n- **Название** — отображается в карточке\n- **Категория** — группа программ\n- **Описание** — текст программы\n- **Обложка** — главное изображение\n- **Фотоальбом** — дополнительные фото`,
      category: 'data'
    },
    {
      id: 'trainers',
      title: '👨‍🏫 Тренеры',
      content: `# Тренеры\n\nУправление информацией о тренерах центра.\n\n## Возможности:\n- Добавление тренеров с фото\n- Указание опыта и специализации\n- Описание\n- Фотоальбом тренера\n\n## Поля тренера:\n- **Имя** — отображается на карточке\n- **Фото** — портрет тренера\n- **Опыт** — стаж работы\n- **Специализация** — направления\n- **Описание** — биография и достижения`,
      category: 'data'
    },
    {
      id: 'staff',
      title: '👥 Персонал',
      content: `# Персонал (S135)\n\nАдминистраторы и персонал центра (не тренеры).\n\n## Возможности:\n- Добавление сотрудника с фото и ролью\n- 👁/🙈 — показывать или скрыть на сайте\n- Порядок перетаскиванием\n\n## Поля:\n- **ФИО** — имя на сайте\n- **Роль** — должность (например «Администратор»)\n- **Фото** — портрет\n\n## На сайте\nНа странице «Коллектив» показывается отдельная панель «Администраторы», **только если** хотя бы один сотрудник видим (👁). Скрытый персонал не попадает в экспорт.`,
      category: 'data'
    },
    {
      id: 'schedule',
      title: '📅 Расписание',
      content: `# Расписание\n\nУправление расписанием занятий.\n\n## ⚠️ Картинки расписания переехали\nКартинки залов (режим «Картинки») теперь управляются в разделе «🏋️ Залы». В этом разделе — только таблица занятий (scheduleStructured).\n\n## Режимы отображения:\n- **Картинки** — картинки залов (редактируются в «Залы»)\n- **Таблица** — таблица занятий\n\n## Возможности:\n- Переключение режима отображения на сайте\n- CRUD для занятий\n- Привязка к тренерам и программам\n- Выбор зала (большой/малый)\n- Режим проведения (зал/онлайн/гибрид)\n- Видимость и архивирование\n\n## Поля занятия:\n- **День** — день недели\n- **Время** — временной интервал\n- **Тренер** — привязка к тренеру\n- **Программа** — привязка к программе\n- **Зал** — большой или малый\n- **Режим** — зал, онлайн или гибрид`,
      category: 'data'
    },
    {
      id: 'halls',
      title: '🏋️ Залы',
      content: `# Залы\n\nЗалы центра. Здесь живут **картинки расписания** — по одной на каждый зал.\n\n## Возможности:\n- Название зала\n- Загрузка / замена / удаление картинки расписания\n- Порядок залов (перетаскивание)\n- 👁/🙈 — показывать или скрыть на сайте\n\n## Поля зала:\n- **Название** — подпись над картинкой на сайте\n- **Картинка расписания** — показывается в режиме «Картинки»\n- **Видимость** — скрытый зал не попадает на сайт\n\n## Связь с расписанием\nРаньше картинки были в разделе «Расписание». Теперь там только таблица занятий, а картинки — здесь.`,
      category: 'data'
    },
    {
      id: 'directions',
      title: '📁 Направления',
      content: `# Направления\n\nНаправления — это группы программ (например, «ДЕТСКИЕ НАПРАВЛЕНИЯ», «БОЕВЫЕ НАПРАВЛЕНИЯ»).\n\n## Возможности:\n- Создать новое направление (➕ Добавить направление)\n- Переименовать, изменить описание\n- Загрузить обложку (кнопка «📤 Загрузить»)\n- 👁/🙈 — показывать или скрыть направление на сайте\n- Удалить направление (кроме встроенных)\n- Состав программ: добавить из списка, убрать (✕), переставить (↑/↓)\n- Порядок направлений — перетаскиванием за ⠿\n\n## Поля направления:\n- **Название** — заголовок направления\n- **Описание** — текст направления\n- **Обложка** — изображение\n- **Программы** — состав (порядок важен)\n- **Видимость** — скрытое направление не попадает на сайт\n\n## Важно\nУдаление направления НЕ удаляет программы — они просто теряют привязку к направлению.`,
      category: 'data'
    },
    {
      id: 'prices',
      title: '💰 Цены',
      content: `# Цены\n\nПозиции прайса — структурированно, по группам. Отсюда собирается раздел «Наши цены» на главной.\n\n## Возможности\n- **Добавить позицию** (➕) и **удалить** (✕)\n- **Заголовок** — название услуги/абонемента\n- **Группа** — раздел витрины («Фитнес-абонементы», «Массаж»…)\n- **Подвид** — вариант цены внутри позиции: «55 мин», «Премиум 55 мин», «Большой зал», «Категория А»\n- **Цена** и **старая цена** (перечёркивается на сайте)\n- **Срок/единица** — «60 дней», «1 календарный месяц», «15 мин»\n- **Пояснение** — сноска под строкой\n- **Программа / Тренер** — привязка, на сайте становится ссылкой\n- **👁/🙈** — скрытая позиция не попадает на сайт\n- **Порядок** — перетаскивание за ⠿ (работает и внутри группы, и между группами)\n\n## Служебное (CRM)\nУ каждой позиции три скрытых поля: **оплата тренеру**, **режим оплаты**, **оплата тренеру за бесплатную**. Они нужны будущему CRM и **никогда не показываются клиенту** — на сайт не экспортируются.\n\n## Источник данных\nПрайс из документа парсится скриптом \`npm run parse-price\` (LibreOffice → таблицы → позиции). Повторный запуск обновляет цены, но **не затирает** правки админки: id, порядок, видимость, привязки и скрытые CRM-поля сохраняются.`,
      category: 'settings'
    },
    {
      id: 'discounts',
      title: '🏷 Скидки',
      content: `# Скидки\n\nСкидки и условия к позициям прайса.\n\n## Возможности\n- **Название** — как видно клиенту («Скидка 5% на абонемент 4 / 8 тренировок»)\n- **Тип**: % (процент), ₽ (сумма), 🎁 (бонус), ℹ (пояснение)\n- **Значение** — для процента и суммы\n- **Условие** — текст, при каком основании скидка действует\n- **Применяется к позициям** — список позиций прайса, у которых нарисовать бейдж\n- **👁/🙈**, **порядок** (перетаскивание), **удаление**\n\n## Как связано\nУ позиции прайса поле \`discountIds\` собирается автоматически из списка скидок — менять его вручную не нужно: отметили скидку на позиции, бейдж появится на сайте.\n\n## Тип «пояснение»\nБейджа не даёт, попадает в блок «Скидки и условия» внизу раздела (например, «Первая групповая тренировка — бесплатно»).`,
      category: 'settings'
    },
    {
      id: 'crm-leads',
      title: '📣 Вызовы форм обратной связи',
      content: `# Вызовы форм обратной связи\n\nЗаявки с формы «Заказать обратный звонок» на сайте.\n\n## Воронка статусов\n**Новая** → **Звонок** → **Объяснено** → **Клиент_пришёл_на_первую** → **Клиент_ходит**.\nКаждый статус — столбец в таблице. Клик по селекту меняет статус.\n\n## Поля заявки\n- **Дата** — время получения\n- **Имя / Телефон / Email** — данные клиента\n- **Причина** — что привело к вызову (напр. «Расписание: Вт 18:00 — Шифу Панда»)\n- **Страница** — откуда нажали\n- **Статус** — этап воронки\n\n## Правила\n- Новые заявки подсвечены зелёным\n- Статусы сохраняются в \`leads.json\` (не db.json)\n- Бэкап создаётся автоматически при сохранении\n\n## Анти-спам\nОдин IP → максимум 1 заявка за 30 секунд.`,
      category: 'crm'
    },
    {
      id: 'integrations-dance',
      title: '💃 Dance (DanceStudio)',
      content: `# Dance — интеграция с DanceStudio\n\nСинхронизация данных центра из DanceStudio в PostgreSQL с экспортом на сайт.\n\n## Компоненты\n- **XML-донор** — 64 файла DanceStudio (~140 МБ) в \`данные/_DB/\`\n- **PostgreSQL (Docker)** — целевая база\n- **Мост синхронизации** — импорт XML → PG\n- **Периодическая синхронизация** — cron / systemd timer\n- **ЛК клиента** — работает через Dropbox API напрямую (не зависит от моста)\n- **Экспорт на сайт** — мост → db.json → static:export\n\n## Статус\nВсе компоненты кроме ЛК — в ожидании. Реализация — мультитикет \`MULTITICKET-DANCESTUDIO\` (тикеты 2.1–2.3).\n\n## Кнопка «Ручной запуск»\nНеактивна до реализации моста. После — запустит полную синхронизацию XML → PG вручную.`,
      category: 'integrations'
    },
    {
      id: 'album',
      title: '📸 Альбом',
      content: `# Фотоальбом\n\nСвободные фотографии общего альбома.\n\n## Возможности:\n- Просмотр фото\n- Загрузка через ночного парсера\n- Привязка к программам и тренерам\n\n## Поля фото:\n- **Изображение** — файл фото\n- **Миниатюра** — уменьшенная копия\n- **Заголовок** — описание\n- **Дата** — дата загрузки`,
      category: 'data'
    },
    {
      id: 'templates',
      title: '🧩 Шаблоны',
      content: `# Шаблоны (S142/S145/S148)\n\nЗадел на будущее.\n\n## Подразделы — отдельные разделы в сайдбаре:\n\n### Макеты\n- **🏠 Макеты разделов главной** — компоновка разделов главной страницы\n- **🧩 Макеты разделов сайта** — компоновка разделов на всех страницах сайта\n- **📦 Макеты сущностей** — карточки, плитки и страницы сущностей (тренер, программа, новость, направление)\n- **📄 Макеты страниц** — каркасы статических страниц\n\n### Текстовые маски\n- **📝 Текстовые маски сайта** — заголовки, описания, призывы к действию\n- **💬 Текстовые маски СМС** — SMS с переменными и лимитом длины\n- **✉️ Текстовые маски почты** — письма (тема + тело)\n- **🌐 Текстовые маски ботов соцсетей** — посты и сообщения для ботов\n\n## Статус\nВсе подразделы — скелеты. Наполнение — отдельными тикетами.`,
      category: 'templates'
    },
    {
      id: 'appearance',
      title: '🖌 Оформление',
      content: `# Оформление сайта\n\nНастройка внешнего вида сайта.\n\n## Возможности:\n- Редактор CSS-переменных\n- Цветовая схема (в будущих версиях)\n- Кастомный CSS\n\n## CSS-переменные:\n- **--fs-*** — размеры шрифтов\n- **--fw-*** — начертания\n- **--ff-*** — шрифты\n- **--lh-*** — межстрочные интервалы`,
      category: 'settings'
    },
    {
      id: 'bots-email',
      title: '✉️ Почта (SMTP, уведомления)',
      content: `# Почта (SMTP, уведомления)\n\nЕдиный раздел всех почтовых настроек и писем сайта (S154: перенесён из «Настроек сайта» в «Боты»).\n\n## Возможности:\n- Настройка SMTP-сервера\n- Тестовая отправка писем\n- Настройка адресов для ошибок\n- Обзор всех почтовых маршрутов сайта\n- Ручное напоминание о незаполненных фото\n\n## Поля:\n- **SMTP-хост** — адрес SMTP-сервера\n- **SMTP-порт** — порт (465 для SSL, 587 для TLS)\n- **SSL/TLS** — использовать защищённое соединение\n- **Пользователь** — логин SMTP\n- **Пароль** — пароль приложения Яндекса (пустое поле = не менять)\n- **Имя отправителя** — отображается в письмах\n- **Email админа** — основной адрес получателя\n- **Email ошибок** — через запятую\n\n## Почтовые маршруты\n- **Заявка с формы** → Email админа (тема «🐼 Заявка: …», попадает в фильтр «Заявки с сайта»)\n- **Ошибка 404** → Email админа\n- **Нет фото у объектов** → Email админа + Email ошибок (ручной запуск)\n\n## Важно\nПароль SMTP вводится только здесь и хранится на сервере. При деплое он НЕ затирается\nсерверным мержем базы — прод всегда источник истины для пароля.`,
      category: 'bots'
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
      content: `# Главные данные сайта\n\nОсновные настройки сайта.\n\n## Поля:\n- **Логотип** — favicon и шапка\n- **Первое название** — текст в шапке, alt логотипа\n- **Второе название** — footer, title страницы\n- **🌐 Адрес сайта (baseUrl)** — хост для canonical, og:url, sitemap.xml и robots.txt. Только https:// и домен, без завершающего / и без пути. Пусто = адрес по умолчанию (https://центр-фр.рф)\n- **🔑 Пароль к админке** — новый пароль + подтверждение (мин. 8 символов). После смены все сессии сбрасываются\n\n## SEO (S133)\nsitemap.xml и robots.txt генерируются из данных сайта автоматически при каждом сохранении. Кнопка «🔄 Перегенерировать sitemap и robots» обновляет их без правки базы. Предпросмотр показывает число URL по разделам. В sitemap попадают только публичные страницы; admin.html, lk.html, crm.html, album.html и скрытые сущности исключены. Новости представлены deep-link вида news.html?id=<id> (открывают модалку).`,
      category: 'settings'
    },
    {
      id: 'home-sections',
      title: '🧩 Разделы главной',
      content: `# Разделы главной страницы\n\nУправление разделами главной: слайдер, расписание, цены, программы, тренера, новости.\n\n## Возможности:\n- **Заголовок** — текст заголовка раздела (пусто = заголовок не показывается и не занимает место)\n- **Цвет фона заголовка** — hex (#RRGGBB или #RGB), пусто = без фона\n- **Видимость** — 👁/🙈: раздел скрывается на главной, но не удаляется из системы\n- **Порядок** — перетаскиванием за ⠿\n\n## Важно\n- Шрифт и размер заголовков настраиваются в разделе «🖌 Оформление» — здесь только текст и цвет.\n- Скрытие раздела не удаляет данные: раздел просто выключается на главной.\n- Скрытие раздела «Расписание»/«Цены» скрывает и соответствующий пункт меню.`,
      category: 'settings'
    },
    {
      id: 'footer-links',
      title: '🔗 Ссылки подвала',
      content: `# Ссылки подвала\n\nСсылки в блоках «Перейти к» и «Наши партнёры» в подвале сайта.\n\n## Поля\n- **Название** — текст ссылки (до 80 символов)\n- **Адрес** — http(s)-ссылка, #якорь на главной или внутренняя страница (*.html)\n- **Группа** — «Перейти к» или «Наши партнёры»\n- **Видимость** — 👁/🙈\n- **Порядок** — перетаскиванием за ⠿ (внутри общей списочной порядка)\n\n## Важно\n- Ссылки на скрытые разделы главной (#schedule, #prices) не отображаются, даже если сама ссылка видима.\n- Внешние ссылки («Наши партнёры») открываются в новой вкладке.`,
      category: 'settings'
    },
    {
      id: 'pages',
      title: '📄 Страницы',
      content: `# Страницы\n\nСтатические страницы сайта (например, «О центре», «Правила», «Документы»).\n\n## Поля\n- **Заголовок** — название страницы (до 80 символов), показывается в шапке страницы и меню\n- **Адрес (url)** — часть адреса страницы (ASCII-slug: латиница/цифры/«-»/«_»).\n  По умолчанию — числовой id; кириллица транслитерируется автоматически, можно задать вручную\n- **Текст** — содержимое в markdown, редактируется визуальным редактором с предпросмотром\n- **Видимость** — 👁/🙈: скрытая страница недоступна на сайте\n- **Показывать в меню** — пункт появляется в шапке (desktop и мобильной)\n- **Порядок** — перетаскиванием за ⠿\n\n## Важно\n- Адрес должен быть уникальным: при совпадении сервер добавит «-2», «-3»…\n- Страница открывается по адресу **page.html?url=<адрес>** (или page.html?id=<id>).\n- Скрытые страницы не попадают ни на сайт, ни в меню.`,
      category: 'settings'
    }
  ];

  function getHelpSections() {
    const db = readDb();
    const help = db.help || { sections: [] };
    // S154: раздел почты переехал из «Настроек сайта» в «Боты» —
    // миграция сохранённой в базе справки по старому id.
    for (const s of help.sections) {
      if (s && s.id === 'email') { s.id = 'bots-email'; s.category = 'bots'; }
    }
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
  // S133: перегенерация sitemap/robots без правки базы
  if (pathname === '/api/admin/regenerate-seo' && method === 'POST') {
    return handleRegenerateSeo(req, res);
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
  // S138: слайдер совместных фото на «Коллективе» (вкл/выкл + интервал)
  if (pathname === '/api/admin/get-trainer-slider-settings' && method === 'POST') {
    return handleGetTrainerSliderSettings(req, res);
  }
  if (pathname === '/api/admin/save-trainer-slider-settings' && method === 'POST') {
    return handleSaveTrainerSliderSettings(req, res);
  }
  // Занятия расписания (S3)
  if (pathname === '/api/admin/save-schedule-slots' && method === 'POST') {
    return handleSaveScheduleSlots(req, res);
  }

  // Залы (S99): название + картинка расписания
  if (pathname === '/api/admin/get-halls' && method === 'POST') {
    return handleGetHalls(req, res);
  }
  if (pathname === '/api/admin/save-halls' && method === 'POST') {
    return handleSaveHalls(req, res);
  }

  // S23: Направления
  if (pathname === '/api/admin/get-directions' && method === 'POST') {
    return handleGetDirections(req, res);
  }
  if (pathname === '/api/admin/save-directions' && method === 'POST') {
    return handleSaveDirections(req, res);
  }
  if (pathname === '/api/admin/get-home-sections' && method === 'POST') {
    return handleGetHomeSections(req, res);
  }
  if (pathname === '/api/admin/save-home-sections' && method === 'POST') {
    return handleSaveHomeSections(req, res);
  }

  // S127: единые имена разделов (Р1)
  if (pathname === '/api/admin/get-section-names' && method === 'POST') {
    return handleGetSectionNames(req, res);
  }
  if (pathname === '/api/admin/save-section-names' && method === 'POST') {
    return handleSaveSectionNames(req, res);
  }

  // S113: Ссылки подвала
  if (pathname === '/api/admin/get-footer-links' && method === 'POST') {
    return handleGetFooterLinks(req, res);
  }
  if (pathname === '/api/admin/save-footer-links' && method === 'POST') {
    return handleSaveFooterLinks(req, res);
  }

  // S114: CRUD бывших разделов «только просмотр»
  if (pathname === '/api/admin/get-slides' && method === 'POST') {
    return handleGetSlides(req, res);
  }
  if (pathname === '/api/admin/save-slides' && method === 'POST') {
    return handleSaveSlides(req, res);
  }
  // S162: удаление всех скрытых слайдов
  if (pathname === '/api/admin/delete-hidden-slides' && method === 'POST') {
    return handleDeleteHiddenSlides(req, res);
  }
  // S166: мероприятия (CRUD + авто-новости/скрытие/уведомления)
  if (pathname === '/api/admin/get-events' && method === 'POST') {
    return handleGetEvents(req, res);
  }
  if (pathname === '/api/admin/save-events' && method === 'POST') {
    return handleSaveEvents(req, res);
  }
  // S158: менеджер фото (popup в админке)
  if (pathname === '/api/admin/get-photo-album' && method === 'POST') {
    return handleGetPhotoAlbum(req, res);
  }
  // S159: менеджер фотографий — полный обзор (в настройках сайта)
  if (pathname === '/api/admin/get-photo-manager' && method === 'POST') {
    return handleGetPhotoManager(req, res);
  }
  if (pathname === '/api/admin/delete-photos' && method === 'POST') {
    return handleDeletePhotos(req, res);
  }
  if (pathname === '/api/admin/get-contacts' && method === 'POST') {
    return handleGetContacts(req, res);
  }
  if (pathname === '/api/admin/save-contacts' && method === 'POST') {
    return handleSaveContacts(req, res);
  }
  if (pathname === '/api/admin/get-album' && method === 'POST') {
    return handleGetAlbum(req, res);
  }
  if (pathname === '/api/admin/save-album' && method === 'POST') {
    return handleSaveAlbum(req, res);
  }

  // S120: статические страницы
  if (pathname === '/api/admin/get-pages' && method === 'POST') {
    return handleGetPages(req, res);
  }
  if (pathname === '/api/admin/save-pages' && method === 'POST') {
    return handleSavePages(req, res);
  }

  // S122: настройки шапки
  if (pathname === '/api/admin/get-header-settings' && method === 'POST') {
    return handleGetHeaderSettings(req, res);
  }
  if (pathname === '/api/admin/save-header-settings' && method === 'POST') {
    return handleSaveHeaderSettings(req, res);
  }

  // S115: Цены позициями и скидки
  if (pathname === '/api/admin/get-price-items' && method === 'POST') {
    return handleGetPriceItems(req, res);
  }  if (pathname === '/api/admin/save-price-items' && method === 'POST') {
    return handleSavePriceItems(req, res);
  }
  if (pathname === '/api/admin/get-discounts' && method === 'POST') {
    return handleGetDiscounts(req, res);
  }
  if (pathname === '/api/admin/save-discounts' && method === 'POST') {
    return handleSaveDiscounts(req, res);
  }

  // S135: Персонал (staff / администраторы)
  if (pathname === '/api/admin/get-staff' && method === 'POST') {
    return handleGetStaff(req, res);
  }
  if (pathname === '/api/admin/save-staff' && method === 'POST') {
    return handleSaveStaff(req, res);
  }

  // S141: журнал ошибок 404 (без авторизации, только запись)
  if (pathname === '/api/admin/log-404' && method === 'POST') {
    return handleLog404(req, res);
  }

  // S151: заявки с форм обратного звонка (lead-create — публичный, как log-404)
  if (pathname === '/api/admin/lead-create' && method === 'POST') {
    return handleCreateLead(req, res);
  }
  if (pathname === '/api/admin/get-leads' && method === 'POST') {
    return handleGetLeads(req, res);
  }
  if (pathname === '/api/admin/save-leads' && method === 'POST') {
    return handleSaveLeads(req, res);
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

  // S161/S163: посещаемость и состояние сайта
  // Пиксель учёта — публичный (без авторизации), отдаёт 1×1 GIF.
  if (pathname === '/api/admin/track-visit' && method === 'GET') {
    return handleTrackVisit(req, res, url);
  }
  if (pathname === '/api/admin/get-visits' && method === 'POST') {
    return handleGetVisits(req, res);
  }
  if (pathname === '/api/admin/site-status' && method === 'POST') {
    return handleSiteStatus(req, res);
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

  // S133 п.4: sitemap.xml и robots.txt — из static/, а при отсутствии файла
  // или если он старше db.json — генерируем на лету тем же модулем, что экспортёр.
  if (method === 'GET' || method === 'HEAD') {
    if (pathname === '/sitemap.xml' || pathname === '/robots.txt') {
      const isSitemap = pathname === '/sitemap.xml';
      const filePath = path.join(staticDir, isSitemap ? 'sitemap.xml' : 'robots.txt');
      let fresh = false;
      try {
        const dbMtime = fs.statSync(dbPath).mtimeMs;
        fresh = fs.statSync(filePath).mtimeMs >= dbMtime;
      } catch { fresh = false; }
      if (fresh) return sendFile(res, filePath, 'application/octet-stream');
      try {
        const db = flattenDb(JSON.parse(fs.readFileSync(dbPath, 'utf-8')));
        const content = isSitemap
          ? renderSitemap(db, new Date().toISOString())
          : renderRobots(db, new Date().toISOString());
        res.writeHead(200, {
          'Content-Type': isSitemap ? 'application/xml; charset=utf-8' : 'text/plain; charset=utf-8'
        });
        return res.end(content);
      } catch { /* нет базы — отдадим файл, если он есть */ }
      if (fs.existsSync(filePath)) return sendFile(res, filePath, 'application/octet-stream');
    }
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
            '.ico': 'image/x-icon', '.mov': 'video/quicktime', '.mp4': 'video/mp4',
            // S133: XML и TXT с правильным MIME (роботы не читают octet-stream)
            '.xml': 'application/xml; charset=utf-8',
            '.txt': 'text/plain; charset=utf-8',
            '.webmanifest': 'application/manifest+json'
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
// S161/S163: посещаемость (заходы на сайт) + состояние сайта и сервера
// ============================================
//
// Визиты храним в ОТДЕЛЬНОМ файле visits.json, а не в db.json:
//  • db.json коммитится и мержится при деплое (deploy-merge-db.mjs) —
//    поток сервисных записей раздул бы базу и ломал мерж;
//  • backupDB() перед каждой записью залил бы backups/ мусором.
//
// MAC-адрес посетителя записать невозможно: он не выходит за пределы
// L2 и браузер его не передаёт (и не отдаёт скриптам). Поле mac есть в
// структуре записи и всегда пустое — см. тикет S163. Реально фиксируются:
// IP, URL страницы, referer (откуда перешли), User-Agent, экран, язык.

const visitsPath = path.join(root, 'visits.json');
const VISITS_MAX = 20000;          // записей в кольцевом буфере
const VISITS_FLUSH_MS = 1500;      // как часто сбрасываем буфер на диск
const VISITS_DEDUPE_MS = 15000;    // повторный заход на ту же страницу за это время не считаем

let visitsCache = null;
let visitsSaveTimer = null;

function loadVisits() {
  if (visitsCache) return visitsCache;
  try {
    const raw = JSON.parse(fs.readFileSync(visitsPath, 'utf-8'));
    visitsCache = Array.isArray(raw) ? raw : [];
  } catch {
    visitsCache = [];
  }
  return visitsCache;
}

function writeVisitsNow() {
  if (visitsSaveTimer) { clearTimeout(visitsSaveTimer); visitsSaveTimer = null; }
  try {
    fs.writeFileSync(visitsPath, JSON.stringify(visitsCache || []), 'utf-8');
  } catch (err) {
    console.error('❌ Не удалось записать visits.json:', err.message);
  }
}

function scheduleVisitsSave() {
  if (visitsSaveTimer) return;
  visitsSaveTimer = setTimeout(writeVisitsNow, VISITS_FLUSH_MS);
  if (visitsSaveTimer.unref) visitsSaveTimer.unref();
}

// IP: на проде за запросом стоит NGINX, поэтому настоящий адрес только
// в x-forwarded-for (первый в цепочке). При прямом обращении — сокет.
function clientIp(req) {
  const xff = String(req.headers['x-forwarded-for'] || '');
  if (xff) {
    const first = xff.split(',')[0].trim();
    if (first) return first.slice(0, 60);
  }
  const real = String(req.headers['x-real-ip'] || '').trim();
  if (real) return real.slice(0, 60);
  const addr = (req.socket && req.socket.remoteAddress) || '';
  return String(addr).replace(/^::ffff:/, '').slice(0, 60);
}

function visitStr(v, max) {
  return String(v == null ? '' : v)
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, max || 200);
}

// Путь страницы → раздел сайта (для группировки «по разделам»)
const VISIT_SECTIONS = [
  [/^index\.html?$|^\/$/, 'Главная'],
  [/^programs?\.html/, 'Программы'],
  [/^trainers?\.html/, 'Тренеры'],
  [/^news\.html/, 'Новости'],
  [/^album\.html/, 'Альбом'],
  [/^directions\.html/, 'Направления'],
  [/^page\.html/, 'Статические страницы'],
  [/^lk\.html/, 'Личный кабинет'],
  [/^crm\.html/, 'CRM'],
  [/^admin\.html/, 'Админка'],
  [/^hall\.html/, 'Залы'],
  [/^prices?\.html/, 'Цены'],
  [/^schedule\.html/, 'Расписание'],
  [/^contacts\.html/, 'Контакты'],
];

function visitSection(page) {
  const clean = String(page || '').split('?')[0].split('#')[0].replace(/^\//, '') || 'index.html';
  for (const [re, name] of VISIT_SECTIONS) if (re.test(clean)) return name;
  return 'Прочее';
}

function visitFileName(page) {
  const clean = String(page || '').split('?')[0].split('#')[0].replace(/^\//, '') || 'index.html';
  return clean;
}

// Локальные дата/время (не UTC!) — иначе статистика «по дням» разъезжается
function localDay(ts) {
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function localTime(ts) {
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

const PIXEL_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

function sendPixel(res) {
  res.writeHead(200, {
    'Content-Type': 'image/gif',
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    'Pragma': 'no-cache',
  });
  res.end(PIXEL_GIF);
}

// GET /api/admin/track-visit?page=…&ref=…&scr=…&lang=…&sid=…
// Публичный (без авторизации) — вызывается пикселем с pages сайта.
function handleTrackVisit(req, res, url) {
  try {
    const q = url.searchParams;
    const now = Date.now();
    const list = loadVisits();
    const sid = visitStr(q.get('sid'), 40);
    const file = visitFileName(q.get('page') || '');

    // Троттлинг повторных заходов (перезагрузка страницы, два пикселя)
    const last = list[list.length - 1];
    if (last && sid && last.sid === sid && last.page === file &&
        now - Number(last.t) < VISITS_DEDUPE_MS) {
      return sendPixel(res);
    }

    // ref (document.referrer) — ОТКУДА пришёл посетитель. Если скрипт его
    // не прислал, берём заголовок Referer запроса = сама страница-источник.
    const ref = visitStr(q.get('ref') || req.headers.referer || req.headers.referrer || '', 300);

    list.push({
      t: now,
      d: localDay(now),
      tm: localTime(now),
      ip: clientIp(req),
      mac: '',                                    // недоступен из HTTP (см. тикет S163)
      page: file,
      section: visitSection(file),
      url: visitStr(q.get('page') || '', 300),
      ref,
      ref_host: ref ? (ref.replace(/^https?:\/\//, '').split('/')[0] || '') : '',
      ua: visitStr(req.headers['user-agent'], 250),
      scr: visitStr(q.get('scr'), 20),
      lang: visitStr(q.get('lang'), 20),
      sid,
    });
    if (list.length > VISITS_MAX) list.splice(0, list.length - VISITS_MAX);
    scheduleVisitsSave();
  } catch (err) {
    console.error('❌ Ошибка учёта визита:', err.message);
  }
  // Пиксель всегда отвечает картинкой — сломанный учёт не должен
  // показывать битую картинку/ошибку на странице сайта.
  return sendPixel(res);
}

function topCount(items, keyFn, limit) {
  const map = new Map();
  for (const it of items) {
    const k = keyFn(it);
    if (!k) continue;
    const cur = map.get(k);
    if (cur) { cur.count++; cur.ipSet.add(it.ip); }
    else map.set(k, { name: k, count: 1, ipSet: new Set([it.ip]) });
  }
  return [...map.values()]
    .map(v => ({ name: v.name, count: v.count, unique: v.ipSet.size }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit || 15);
}

function aggregateVisits(list, periodDays) {
  const now = Date.now();
  const from = periodDays == null ? 0 : now - periodDays * 86400000;
  const rows = list.filter(v => Number(v.t) >= from);
  const byDay = new Map();
  for (const v of rows) {
    const d = v.d || localDay(Number(v.t));
    const cur = byDay.get(d);
    if (cur) { cur.count++; cur.ipSet.add(v.ip); }
    else byDay.set(d, { date: d, count: 1, ipSet: new Set([v.ip]) });
  }
  const uniq = new Set(rows.map(v => v.ip));
  return {
    total: rows.length,
    unique: uniq.size,
    days: [...byDay.values()]
      .map(v => ({ date: v.date, count: v.count, unique: v.ipSet.size }))
      .sort((a, b) => (a.date < b.date ? -1 : 1)),
    sections: topCount(rows, v => v.section || visitSection(v.page)),
    pages: topCount(rows, v => v.page),
    sources: topCount(rows, v => (v.ref_host || (/^https?:/.test(v.ref || '') ? '' : 'напрямую'))),
    langs: topCount(rows, v => v.lang, 8),
  };
}

async function handleGetVisits(req, res) {
  const token = extractTokenFromCookie(req.headers);
  if (!isValidSession(token)) return sendJSON(res, 401, { error: 'Не авторизован' });
  try {
    const list = loadVisits();
    sendJSON(res, 200, {
      ok: true,
      stored: list.length,
      max: VISITS_MAX,
      mac_note: 'MAC-адреса недоступны на уровне HTTP — поле всегда пустое',
      day: aggregateVisits(list, 1),
      week: aggregateVisits(list, 7),
      month: aggregateVisits(list, 30),
      year: aggregateVisits(list, 365),
      all: aggregateVisits(list, null),
      last: list.slice(-30).reverse(),
    });
  } catch (err) {
    console.error('❌ Ошибка чтения посещаемости:', err.message);
    sendJSON(res, 500, { error: err.message });
  }
}

// ── S161: состояние сайта и сервера ───────────────────────────────

const SITE_PAGES = [
  'index.html', 'programs.html', 'program.html', 'trainers.html', 'trainer.html',
  'news.html', 'album.html', 'directions.html', 'page.html', 'lk.html',
  'crm.html', '404.html',
];

function dirStats(dir) {
  const st = { files: 0, bytes: 0 };
  if (!fs.existsSync(dir)) return st;
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    let entries;
    try { entries = fs.readdirSync(cur, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      const full = path.join(cur, e.name);
      if (e.isDirectory()) { stack.push(full); continue; }
      try {
        const s = fs.statSync(full);
        st.files++; st.bytes += s.size;
      } catch { /* гонка/права — пропускаем */ }
    }
  }
  return st;
}

function runShell(cmd, timeoutMs) {
  try {
    return String(execSync(cmd, { encoding: 'utf-8', timeout: timeoutMs || 3000, stdio: ['ignore', 'pipe', 'ignore'] })).trim();
  } catch { return ''; }
}

function staticCacheVersion() {
  try {
    const html = fs.readFileSync(path.join(staticDir, 'index.html'), 'utf-8');
    const m = html.match(/[?&]v=(\d+)/);
    return m ? Number(m[1]) : null;
  } catch { return null; }
}

function gitInfo() {
  const quoted = JSON.stringify(root).replace(/^"|"$/g, '');
  const sha = runShell('git -C ' + quoted + ' rev-parse --short HEAD');
  const branch = runShell('git -C ' + quoted + ' rev-parse --abbrev-ref HEAD');
  const dirty = runShell('git -C ' + quoted + ' status --porcelain');
  return {
    commit: sha || '',
    branch: branch || '',
    dirty: dirty ? dirty.split('\n').filter(Boolean).length : 0,
    available: !!sha,
  };
}

// Проверки «битости»: ссылки слайдов и картинки, на которые ссылаются данные
// S166: разбор даты мероприятия «2026-12-06T11:00» → Date | null
// (хелпер на верхнем уровне — нужен и collectSiteProblems, и обработкам)
function eventDate(v) {
  const s = String(v || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(s)) return null;
  const d = new Date(s.length === 10 ? s + 'T00:00' : s);
  return isNaN(d.getTime()) ? null : d;
}

function eventIsPast(ev, now) {
  const end = eventDate(ev.dateEnd) || eventDate(ev.dateStart);
  if (!end) return false;
  return end.getTime() < (now || Date.now());
}

// S166: нормализация URL видео — внешняя ссылка http(s) либо загруженный файл uploads/...
function normalizeEventVideoUrl(raw) {
  const s = String(raw == null ? '' : raw).trim().slice(0, 300);
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  const rel = s.replace(/^\/+/, '');
  if (rel.startsWith('uploads/')) return rel;
  return '';
}

function collectSiteProblems(db, problems) {
  const add = (level, title, detail) => problems.push({ level, title, detail: detail || '' });

  // 1. Ссылки слайдера должны вести на существующие сущности
  const programs = db.programs || [];
  const trainers = db.trainers || [];
  const news = db.news || [];
  const findIn = (arr, id) => arr.some(x => String(x.id) === String(id));
  for (const s of (db.sliders || [])) {
    if (s.hidden) continue;
    const link = String(s.link || '');
    if (!link || !/^(index|programs?|trainers?|news|album|directions|page|lk|crm)\.html/.test(link) && !/^[#.?a-zA-Z]/.test(link)) continue;
    let m;
    if ((m = link.match(/^program\.html\?id=(.+)$/))) {
      if (!findIn(programs, m[1])) add('error', `Слайд «${s.title || s.id}»: ссылка ведёт на несуществующую программу`, link);
    } else if ((m = link.match(/^trainer\.html\?id=(.+)$/))) {
      if (!findIn(trainers, m[1])) add('error', `Слайд «${s.title || s.id}»: ссылка ведёт на несуществующего тренера`, link);
    } else if ((m = link.match(/^news\.html\?id=(.+)$/))) {
      if (!findIn(news, m[1])) add('error', `Слайд «${s.title || s.id}»: ссылка ведёт на несуществующую новость`, link);
    } else if ((m = link.match(/^directions\.html\?id=(.+)$/))) {
      const dirs = db.directions || [];
      if (!findIn(dirs, m[1])) add('error', `Слайд «${s.title || s.id}»: ссылка ведёт на несуществующее направление`, link);
    } else if ((m = link.match(/^page\.html\?url=(.+)$/))) {
      const pages = db.pages || [];
      const want = decodeURIComponent(m[1]);
      if (!pages.some(p => String(p.url) === want)) add('warn', `Слайд «${s.title || s.id}»: ссылка на страницу, которой нет в разделе «Страницы»`, link);
    } else if (!/^(index|programs?|trainers?|news|album|directions|page|lk|crm)\.html/.test(link) && !link.startsWith('#')) {
      add('warn', `Слайд «${s.title || s.id}»: нестандартная ссылка`, link);
    }
  }

  // 2. Картинки слайдов должны лежать на диске
  for (const s of (db.sliders || [])) {
    if (s.hidden) continue;
    const img = String(s.image || '');
    if (!img) { add('warn', `Слайд «${s.title || s.id}»: нет картинки`, ''); continue; }
    if (!fs.existsSync(path.join(staticDir, img.replace(/^\//, '')))) {
      add('error', `Слайд «${s.title || s.id}»: файл картинки отсутствует`, img);
    }
  }

  // 3. Скрытые слайды (информационно)
  const hidden = (db.sliders || []).filter(s => s.hidden).length;
  if (hidden) add('info', 'В слайдере есть скрытые слайды', `Скрытых: ${hidden}`);

  // 4. Файлы картинок новостей/программ/тренеров — выборочно, чтобы не сканировать всё
  const checkPic = (kind, name, pic) => {
    const p = String(pic || '');
    if (!p || /^https?:/.test(p)) return;
    if (!fs.existsSync(path.join(staticDir, p.replace(/^\//, '')))) {
      add('error', `Отсутствует файл ${kind}`, `${name}: ${p}`);
    }
  };
  for (const n of news.slice(0, 50)) if (n.hidden) continue; else checkPic('картинки новости', n.title, n.image);
  for (const p of programs.slice(0, 80)) if (p.hidden) continue; else checkPic('обложки программы', p.name, p.image);
  for (const t of trainers.slice(0, 80)) if (t.hidden) continue; else checkPic('фото тренера', t.name, t.image);

  // S166: прошедшие мероприятия без фотогалереи/видео — просим загрузить
  for (const ev of (db.events || [])) {
    if (ev.hidden) continue;
    checkPic('обложки мероприятия', ev.name, ev.image);
    const end = eventDate(ev.dateEnd) || eventDate(ev.dateStart);
    if (end && end.getTime() < Date.now()) {
      const hasMedia = (ev.photoAlbum && ev.photoAlbum.length) || (ev.videos && ev.videos.length);
      if (!hasMedia) {
        add('warn', `Мероприятие «${ev.name || ev.id}» прошло — нет фото и видео`,
          'Загрузите в админке: Данные → Мероприятия (фотогалерея, видео, отзывы)');
      }
    }
  }
}

function collectServerProblems(status, problems) {
  const add = (level, title, detail) => problems.push({ level, title, detail: detail || '' });
  const mem = status.server.memory;
  if (mem && mem.usedPercent > 92) add('error', 'Память сервера почти заполнена', `${mem.usedPercent}%`);
  else if (mem && mem.usedPercent > 82) add('warn', 'Высокое потребление памяти', `${mem.usedPercent}%`);
  const disk = status.server.disk;
  if (disk) {
    if (disk.freeGB != null && disk.freeGB < 1) add('error', 'Мало свободного места на диске', `${disk.freeGB} ГБ`);
    else if (disk.usedPercent > 90) add('error', 'Диск почти заполнен', `${disk.usedPercent}%`);
    else if (disk.usedPercent > 80) add('warn', 'Заполнение диска', `${disk.usedPercent}%`);
  }
  const load = status.server.load1m;
  const cpus = status.server.cpus;
  if (load != null && cpus && load > cpus * 2) add('warn', 'Высокая загрузка CPU', `load1=${load} при ${cpus} ядрах`);
  if (!status.server.pm2.available) add('info', 'pm2 не виден админ-серверу', 'Команда pm2 jlist недоступна (окружение без pm2)');
  if (!status.site.git.available) add('info', 'git недоступен', 'Метрики кода не собираются');
}

function collectSiteHealth(db, status, problems) {
  const add = (level, title, detail) => problems.push({ level, title, detail: detail || '' });

  // 5. Статика устарела: js/data/* старше db.json
  const dbMtime = fs.existsSync(dbPath) ? fs.statSync(dbPath).mtimeMs : 0;
  const genFile = path.join(staticDir, 'js', 'data', 'slider.js');
  if (dbMtime && fs.existsSync(genFile)) {
    const genMtime = fs.statSync(genFile).mtimeMs;
    if (genMtime < dbMtime - 5000) {
      add('error', 'Статика не перегенерирована после изменений базы',
        `js/data/slider.js старше db.json на ${Math.round((dbMtime - genMtime) / 60000)} мин`);
    }
  } else if (!fs.existsSync(genFile)) {
    add('error', 'Отсутствует сгенерированный файл данных', 'static/js/data/slider.js');
  }

  // 6. Обязательные страницы
  for (const p of SITE_PAGES) {
    if (p === '404.html') continue;
    if (!fs.existsSync(path.join(staticDir, p))) add('error', 'Отсутствует страница сайта', p);
  }

  // 7. Версия кэша одинакова во всех страницах
  const versions = new Set();
  for (const p of SITE_PAGES) {
    const f = path.join(staticDir, p);
    if (!fs.existsSync(f)) continue;
    try {
      const html = fs.readFileSync(f, 'utf-8');
      const m = html.match(/[?&]v=(\d+)/);
      if (m) versions.add(Number(m[1]));
    } catch { /* ignore */ }
  }
  if (versions.size > 1) add('warn', 'Разные версии кэша CSS/JS на страницах', [...versions].join(', '));

  // 8. Размер базы
  const dbKB = status.site.db.sizeKB;
  if (dbKB > 8192) add('error', 'Файл db.json слишком большой', `${(dbKB / 1024).toFixed(1)} МБ`);
  else if (dbKB > 4096) add('warn', 'db.json растёт', `${(dbKB / 1024).toFixed(1)} МБ`);

  // 9. Логи 404 за сегодня
  try {
    const logFile = path.join(root, 'logs', '404.log');
    if (fs.existsSync(logFile)) {
      const tail = fs.readFileSync(logFile, 'utf-8').split('\n').filter(Boolean).slice(-500);
      const today = localDay(Date.now());
      const hits = tail.filter(l => l.includes(today)).length;
      if (hits > 20) add('warn', 'Много 404-ошибок за сегодня', `${hits} записей в logs/404.log`);
      else if (hits) add('info', 'Есть 404-ошибки за сегодня', `${hits} записей`);
    }
  } catch { /* ignore */ }
}

async function handleSiteStatus(req, res) {
  const token = extractTokenFromCookie(req.headers);
  if (!isValidSession(token)) return sendJSON(res, 401, { error: 'Не авторизован' });
  try {
    const db = readDb();
    const problems = [];

    // ── сайт ──
    let dbSize = 0;
    try { dbSize = fs.statSync(dbPath).size; } catch { problems.push({ level: 'error', title: 'Не читается db.json', detail: 'файл отсутствует' }); }
    const uploads = dirStats(path.join(staticDir, 'uploads'));
    const dataDir = dirStats(path.join(staticDir, 'js', 'data'));
    const counters = {
      sliders: (db.sliders || []).length,
      slidersVisible: (db.sliders || []).filter(s => !s.hidden).length,
      news: (db.news || []).length,
      programs: (db.programs || []).length,
      trainers: (db.trainers || []).length,
      directions: (db.directions || []).length,
      pages: (db.pages || []).length,
      halls: (db.halls || []).length,
      album: (db.album || []).length,
      schedule: (db.schedule || []).length,
    };
    const pagesExist = SITE_PAGES.map(p => ({
      page: p,
      exists: fs.existsSync(path.join(staticDir, p)),
      sizeKB: fs.existsSync(path.join(staticDir, p)) ? Math.round(fs.statSync(path.join(staticDir, p)).size / 1024) : 0,
    }));

    const site = {
      domain: 'центр-фр.рф',
      git: gitInfo(),
      cacheVersion: staticCacheVersion(),
      db: {
        sizeKB: Math.round(dbSize / 1024),
        mtime: fs.existsSync(dbPath) ? new Date(fs.statSync(dbPath).mtimeMs).toISOString() : null,
      },
      counters,
      files: {
        uploadsFiles: uploads.files,
        uploadsMB: Math.round(uploads.bytes / 1024 / 1024 * 10) / 10,
        dataFiles: dataDir.files,
        dataMB: Math.round(dataDir.bytes / 1024 / 1024 * 10) / 10,
      },
      pages: pagesExist,
    };

    // ── сервер ──
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const load = os.loadavg();
    let disk = null;
    const df = runShell(`df -Pk "${root}" 2>/dev/null | tail -1`);
    if (df) {
      const parts = df.split(/\s+/);
      if (parts.length >= 5) {
        const totalKB = Number(parts[1]), usedKB = Number(parts[2]), availKB = Number(parts[3]);
        disk = {
          totalGB: Math.round(totalKB / 1024 / 1024 * 10) / 10,
          usedGB: Math.round(usedKB / 1024 / 1024 * 10) / 10,
          freeGB: Math.round(availKB / 1024 / 1024 * 10) / 10,
          usedPercent: totalKB ? Math.round(usedKB / totalKB * 100) : 0,
        };
      }
    }
    const pm2Raw = runShell('pm2 jlist 2>/dev/null', 5000);
    let pm2 = { available: false, processes: [] };
    if (pm2Raw) {
      try {
        const list = JSON.parse(pm2Raw);
        pm2 = {
          available: true,
          processes: list.map(p => ({
            name: p.name,
            status: p.pm2_env ? p.pm2_env.status : 'unknown',
            restarts: p.pm2_env ? p.pm2_env.restart_time : null,
            uptime: p.pm2_env && p.pm2_env.pm_uptime ? new Date(p.pm2_env.pm_uptime).toISOString() : null,
            memMB: p.monit && p.monit.memory ? Math.round(p.monit.memory / 1024 / 1024 * 10) / 10 : null,
          })),
        };
      } catch { pm2 = { available: false, processes: [] }; }
    }
    let nginx = '';
    const pgrep = runShell('pgrep -x nginx 2>/dev/null | head -1');
    nginx = pgrep ? 'работает' : 'не найден';

    const server = {
      hostname: os.hostname(),
      platform: os.platform() + ' ' + os.release(),
      node: process.version,
      uptimeSec: Math.round(os.uptime()),
      procUptimeSec: Math.round(process.uptime()),
      cpus: os.cpus().length,
      cpuModel: (os.cpus()[0] || {}).model || '',
      load1m: Math.round(load[0] * 100) / 100,
      load5m: Math.round(load[1] * 100) / 100,
      load15m: Math.round(load[2] * 100) / 100,
      memory: {
        totalGB: Math.round(totalMem / 1024 / 1024 / 1024 * 10) / 10,
        freeGB: Math.round(freeMem / 1024 / 1024 / 1024 * 10) / 10,
        usedGB: Math.round((totalMem - freeMem) / 1024 / 1024 / 1024 * 10) / 10,
        usedPercent: totalMem ? Math.round((totalMem - freeMem) / totalMem * 100) : 0,
      },
      disk,
      nginx,
      pm2,
    };

    // ── посещаемость ──
    const list = loadVisits();
    const visits = {
      stored: list.length,
      day: aggregateVisits(list, 1),
      week: aggregateVisits(list, 7),
      month: aggregateVisits(list, 30),
      year: aggregateVisits(list, 365),
    };

    const status = { ok: true, generatedAt: new Date().toISOString(), site, server, visits };

    // ── автодиагностика проблем ──
    collectSiteProblems(db, problems);
    collectSiteHealth(db, status, problems);
    collectServerProblems(status, problems);
    if (!visits.day.total) problems.push({ level: 'info', title: 'За сегодня заходов не зафиксировано', detail: 'Пиксель учёта мог не отработать (локальный просмотр, блокировщик, не задеплоен)' });

    const rank = { error: 0, warn: 1, info: 2 };
    problems.sort((a, b) => rank[a.level] - rank[b.level]);
    status.problems = {
      count: problems.length,
      errors: problems.filter(p => p.level === 'error').length,
      warns: problems.filter(p => p.level === 'warn').length,
      infos: problems.filter(p => p.level === 'info').length,
      list: problems,
    };
    status.state = status.problems.errors ? 'error' : status.problems.warns ? 'warn' : 'ok';

    sendJSON(res, 200, status);
  } catch (err) {
    console.error('❌ Ошибка сбора статуса:', err);
    sendJSON(res, 500, { error: err.message });
  }
}

// ============================================
// Запуск
// ============================================

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n🚀 Админка запущена: http://127.0.0.1:${PORT}/admin.html`);
  console.log(`   Пароль: ${loadPasswordRecord() ? 'задан в .admin-password.json (сменён в админке)' : 'из ADMIN_PASSWORD окружения'}`);
  console.log(`   Только localhost — не для продакшна!\n`);
  // Сигнал готовности для PM2 (ecosystem: wait_ready: true)
  if (typeof process.send === 'function') process.send('ready');

  // S166: переходы мероприятий (будущее→прошедшее) не зависят от сохранений:
  // первая проверка через 20 сек после старта, далее каждые 6 часов
  setTimeout(() => checkEventsTransitions(), 20000).unref?.();
  setInterval(() => checkEventsTransitions(), EVENTS_CHECK_MS).unref?.();
});

// Graceful shutdown
process.on('SIGINT', () => {
  writeVisitsNow();   // S163: не теряем накопленные визиты
  console.log('\n👋 Сервер остановлен');
  process.exit(0);
});
