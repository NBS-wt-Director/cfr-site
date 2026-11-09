#!/usr/bin/env node
/**
 * scripts/tmp-repro.mjs — временный_probe: воспроизводим баг «удаление
 * администратора выбило весь сайт».
 */
import { execSync } from 'child_process';

const BASE = 'http://127.0.0.1:3456';

async function post(pathname, body, cookie) {
  const res = await fetch(BASE + pathname, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* не JSON */ }
  return { status: res.status, json, text: text.slice(0, 200) };
}

async function alive() {
  try {
    const r = await fetch(BASE + '/js/data/core.js', { method: 'HEAD' });
    return r.status;
  } catch (e) { return 'DOWN: ' + String(e.message).slice(0, 60); }
}

function pid() {
  try { return execSync('pgrep -f "node --env-file" | head -1').toString().trim(); }
  catch { return 'НЕТ ПРОЦЕССА'; }
}

console.log('PID сервера до:', pid());
const login = await post('/api/admin/login', { password: process.env.ADM_PW || '' });
const ck = 'admin_token=' + (login.json?.token || '');
console.log('login:', login.status, login.json?.ok ? 'OK' : JSON.stringify(login.json));

console.log('\n1) добавляем администратора с фото');
const add = await post('/api/admin/save-staff', {
  staff: [{ id: 'staff-test', name: 'Тест Администратор', role: 'Администратор', image: 'uploads/1770874476663.jpg', hidden: false }]
}, ck);
console.log('   →', add.status, JSON.stringify(add.json)?.slice(0, 160));
console.log('   сайт:', await alive(), '| PID:', pid());

console.log('\n2) удаляем его (пустой список)');
const del = await post('/api/admin/save-staff', { staff: [] }, ck);
console.log('   →', del.status, JSON.stringify(del.json)?.slice(0, 160));
for (let i = 1; i <= 6; i++) {
  console.log(`   проверка ${i}: сайт=${await alive()} PID=${pid()}`);
  await new Promise(r => setTimeout(r, 1000));
}

console.log('\n3) страницы сайта');
for (const u of ['/', '/trainers.html', '/js/data/staff.js', '/js/data/core.js', '/admin.html']) {
  try {
    const r = await fetch(BASE + u);
    console.log(`   ${u.padEnd(22)} ${r.status} ${r.headers.get('content-length') || '?'} Б`);
  } catch (e) { console.log(`   ${u.padEnd(22)} DOWN ${String(e.message).slice(0, 50)}`); }
}
