/**
 * Смоук API: S125/S126 — главные данные (title1/title2), смена пароля админки,
 * newsTileWidth в «Оформлении». Запускается на отдельном порту :3461,
 * db.json и .admin-sessions.json восстанавливаются вызывающим скриптом.
 */
process.env.ADMIN_PORT = '3461';
process.env.ADMIN_PASSWORD = 'smoke-test-pass-1';

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const BASE = 'http://127.0.0.1:3461';
const PW_FILE = path.join(root, '.admin-password.json');

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log('✅', name); }
  else { fail++; console.log('❌', name); }
}

async function api(pathname, { token, body, method = 'POST' } = {}) {
  const res = await fetch(BASE + pathname, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': 'Bearer ' + token } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

// Ждём готовности сервера
async function waitForServer() {
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch(BASE + '/api/admin/get-data', { method: 'POST' });
      if (r.status === 401) return true; // сервер жив, просто не авторизованы
    } catch { /* ещё не поднялся */ }
    await new Promise(r => setTimeout(r, 200));
  }
  return false;
}

const server = spawn('node', [path.join(root, 'scripts', 'admin-server.mjs')], {
  cwd: root,
  env: process.env,
  stdio: ['ignore', 'pipe', 'pipe']
});
server.stdout.on('data', d => process.stdout.write('[srv] ' + d));
server.stderr.on('data', d => process.stderr.write('[srv:err] ' + d));

try {
  check('сервер поднялся на :3461', await waitForServer());

  // 1. Логин по паролю из окружения (файла переопределения ещё нет)
  let r = await api('/api/admin/login', { body: { password: 'smoke-test-pass-1' } });
  check('логин env-паролем → 200 + токен', r.status === 200 && !!r.json.token);
  const token = r.json.token;

  // 2. Главные данные: title1/title2
  r = await api('/api/admin/save-site-settings', {
    token,
    body: { siteSettings: { title1: 'Смоук Название 1', title2: 'Смоук Название 2' } }
  });
  check('save-site-settings (только названия) → 200', r.status === 200 && r.json.ok === true);
  r = await api('/api/admin/get-site-settings', { token });
  check('get-site-settings вернул названия',
    r.json.siteSettings?.title1 === 'Смоук Название 1' && r.json.siteSettings?.title2 === 'Смоук Название 2');

  // 3. Смена пароля: несовпадающее подтверждение → 400
  r = await api('/api/admin/save-site-settings', {
    token,
    body: { siteSettings: { title1: 'x', title2: 'y' }, adminPassword: 'new-pass-12345', adminPasswordConfirm: 'other-pass-999' }
  });
  check('смена пароля без совпадения → 400', r.status === 400);

  // 4. Слишком короткий пароль → 400
  r = await api('/api/admin/save-site-settings', {
    token,
    body: { siteSettings: { title1: 'x', title2: 'y' }, adminPassword: 'коротко', adminPasswordConfirm: 'коротко' }
  });
  check('короткий пароль → 400', r.status === 400);

  // 5. Корректная смена пароля → 200 + passwordChanged, файл создан, в db.json пароля НЕТ
  r = await api('/api/admin/save-site-settings', {
    token,
    body: { siteSettings: { title1: 'x', title2: 'y' }, adminPassword: 'новый-пароль-2026', adminPasswordConfirm: 'новый-пароль-2026' }
  });
  check('смена пароля → 200 + passwordChanged', r.status === 200 && r.json.passwordChanged === true);
  check('файл .admin-password.json создан', fs.existsSync(PW_FILE));
  const pwRec = JSON.parse(fs.readFileSync(PW_FILE, 'utf-8'));
  check('в файле хэш+salt, открытого пароля нет',
    typeof pwRec.hash === 'string' && pwRec.hash.length === 64 &&
    typeof pwRec.salt === 'string' && !JSON.stringify(pwRec).includes('новый-пароль'));
  const rawDb = JSON.parse(fs.readFileSync(path.join(root, 'db.json'), 'utf-8'));
  check('в db.json пароля нет (siteSettings без пароля)',
    !JSON.stringify(rawDb.siteSettings || {}).includes('новый-пароль') &&
    !JSON.stringify(rawDb).includes('adminPassword'));

  // 6. После смены сессии сброшены: старый токен → 401, env-пароль → 401
  r = await api('/api/admin/get-site-settings', { token });
  check('старая сессия инвалидирована → 401', r.status === 401);
  r = await api('/api/admin/login', { body: { password: 'smoke-test-pass-1' } });
  check('логин старым (env) паролем → 401', r.status === 401);

  // 7. Логин новым паролем → 200
  r = await api('/api/admin/login', { body: { password: 'новый-пароль-2026' } });
  check('логин новым паролем → 200', r.status === 200 && !!r.json.token);

  // 8. «Оформление»: newsTileWidth round-trip (валидные + невалидные значения)
  const token2 = r.json.token;
  r = await api('/api/admin/save-appearance', {
    token: token2,
    body: { appearance: { newsTileWidth: { unit: 'px', value: 420 }, containerWidth: { unit: '%', value: 90 } } }
  });
  check('save-appearance с newsTileWidth → 200', r.status === 200);
  r = await api('/api/admin/get-appearance', { token: token2 });
  check('get-appearance вернул newsTileWidth 420px',
    r.json.appearance?.newsTileWidth?.unit === 'px' && r.json.appearance?.newsTileWidth?.value === 420);
  // Экспорт отдал newsTileWidth в core.js
  const core = fs.readFileSync(path.join(root, 'static', 'js', 'data', 'core.js'), 'utf-8');
  check('core.js содержит newsTileWidth', /newsTileWidth/.test(core));

  // 9. Невалидная ширина плитки → дефолт
  r = await api('/api/admin/save-appearance', {
    token: token2,
    body: { appearance: { newsTileWidth: { unit: 'px', value: 99999 } } }
  });
  r = await api('/api/admin/get-appearance', { token: token2 });
  check('newsTileWidth 99999px → дефолт 360px',
    r.json.appearance?.newsTileWidth?.unit === 'px' && r.json.appearance?.newsTileWidth?.value === 360);

  // 10. Неавторизованный доступ → 401
  r = await api('/api/admin/save-site-settings', { body: { siteSettings: {} } });
  check('save-site-settings без токена → 401', r.status === 401);
  r = await api('/api/admin/login', { body: { password: '__probe__' } });
  check('логин с неверным паролем → 401', r.status === 401);
} catch (err) {
  fail++;
  console.error('💥 Ошибка смоука:', err);
} finally {
  server.kill('SIGTERM');
  await new Promise(r => setTimeout(r, 300));
}

console.log(`\nИтог: ${pass}/${pass + fail}`);
process.exit(fail ? 1 : 0);
