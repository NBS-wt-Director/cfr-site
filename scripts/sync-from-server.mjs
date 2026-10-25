#!/usr/bin/env node
/**
 * scripts/sync-from-server.mjs
 *
 * Забор db.json с продакшн-сервера через API админки.
 *
 * Использование:
 *   node scripts/sync-from-server.mjs <server-url> [output-file] [password]
 *
 * Примеры:
 *   node scripts/sync-from-server.mjs http://127.0.0.1:3456
 *   node scripts/sync-from-server.mjs http://127.0.0.1:3456 ./backup-prod.json ЦФР_2026.10.21
 *   node scripts/sync-from-server.mjs https://xn----itbymbjqk.xn--p1ai/admin.html
 *
 * ⚠️ Требуется авторизация в админке. Пароль можно передать как 3-й аргумент
 *    или ввести интерактивно (по умолчанию берётся из .env.local).
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

// ============================================
// Утилиты
// ============================================

function parseArgs() {
  const args = process.argv.slice(2);
  let serverUrl = null;
  let outputFile = null;
  let password = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-h' || args[i] === '--help') {
      console.log(`
Забор db.json с продакшн-сервера через API админки.

Использование:
  node scripts/sync-from-server.mjs <server-url> [output-file] [password]

Примеры:
  node scripts/sync-from-server.mjs http://127.0.0.1:3456
  node scripts/sync-from-server.mjs http://127.0.0.1:3456 ./backup-prod.json
  node scripts/sync-from-server.mjs https://xn----itbymbjqk.xn--p1ai/admin.html

Аргументы:
  server-url     URL админки (с протоколом http/https)
  output-file    Файл для сохранения (по умолчанию: db-prod-sync.json)
  password       Пароль админки (по умолчанию: из .env.local или ЦФР_2026.10.21)
`);
      process.exit(0);
    }
    if (!serverUrl) {
      serverUrl = args[i].replace(/\/$/, ''); // убираем trailing slash
    } else if (!outputFile) {
      outputFile = args[i];
    } else {
      password = args[i];
    }
  }

  if (!serverUrl) {
    console.error('❌ Не указан URL сервера. Используйте --help для справки.');
    process.exit(1);
  }

  return {
    serverUrl,
    outputFile: outputFile || path.join(root, 'db-prod-sync.json'),
    password: password ||
      (fs.existsSync(path.join(root, '.env.local'))
        ? fs.readFileSync(path.join(root, '.env.local'), 'utf-8').trim()
        : 'ЦФР_2026.10.21')
  };
}

function httpRequest(url, method, body, token) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const agent = parsedUrl.protocol === 'https:' ? new https.Agent() : undefined;
    const req = (parsedUrl.protocol === 'https:' ? https : http).request({
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Cookie: `admin_token=${token}` } : {}),
      },
      agent,
      timeout: 30000,
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Таймаут 30 сек'));
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();

    const chunks = [];
    req.on('response', (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const data = Buffer.concat(chunks).toString('utf-8');
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: { raw: data } });
        }
      });
    });
  });
}

// ============================================
// Основная логика
// ============================================

async function main() {
  const { serverUrl, outputFile, password } = parseArgs();

  console.log('📡 Подключение к серверу:', serverUrl);
  console.log('🔑 Авторизация...');

  // 1. Авторизация
  let token = null;
  try {
    const loginUrl = serverUrl + '/api/admin/login';
    console.log('   Запрос на:', loginUrl);
    const result = await httpRequest(loginUrl, 'POST', { password });

    if (result.status !== 200 || !result.body?.ok) {
      console.error('❌ Ошибка авторизации:', result.body?.error || 'Неверный статус');
      process.exit(1);
    }

    token = result.body.token;
    console.log('✅ Авторизация успешна');
  } catch (err) {
    console.error('❌ Ошибка подключения к серверу:', err.message);
    process.exit(1);
  }

  // 2. Запрос экспорта БД
  console.log('📦 Запрос данных с сервера...');
  const exportUrl = serverUrl + '/api/admin/export-db';
  console.log('   Запрос на:', exportUrl);

  let exportResult;
  try {
    exportResult = await httpRequest(exportUrl, 'POST', null, token);
  } catch (err) {
    console.error('❌ Ошибка запроса экспорта:', err.message);
    process.exit(1);
  }

  if (exportResult.status === 429) {
    console.error('❌ Превышен лимит запросов. Подождите минуту.');
    process.exit(1);
  }

  if (exportResult.status === 413) {
    console.error('❌ Файл БД слишком большой:', exportResult.body.error);
    process.exit(1);
  }

  if (exportResult.status !== 200 || !exportResult.body?.data) {
    console.error('❌ Ошибка экспорта:', exportResult.body?.error || 'Неверный статус');
    process.exit(1);
  }

  const dbData = exportResult.body.data;
  const size = exportResult.body.size;
  console.log(`✅ Данные получены (${(size / 1024).toFixed(1)} KB, ${exportResult.body.sizeMB} МБ)`);

  // 3. Сохранение в файл
  const output = path.resolve(outputFile);
  try {
    fs.writeFileSync(output, JSON.stringify(dbData, null, 2), 'utf-8');
    console.log(`💾 Сохранено в: ${output}`);
  } catch (err) {
    console.error('❌ Ошибка записи файла:', err.message);
    process.exit(1);
  }

  // 4. Сравнение со структурой dev
  console.log('\n📊 Сравнение со структурой dev:');
  try {
    const devDb = JSON.parse(fs.readFileSync(path.join(root, 'db.json'), 'utf-8'));
    compareStructure(devDb, dbData);
  } catch (err) {
    console.log('   (db.json dev не найден — сравнение пропущено)');
  }

  console.log('\n✅ Готово!');
}

function compareStructure(devDb, prodDb) {
  const devKeys = new Set(Object.keys(devDb));
  const prodKeys = new Set(Object.keys(prodDb));

  // Добавлено в prod
  const added = [...prodKeys].filter(k => !devKeys.has(k));
  if (added.length) {
    console.log('\n🆕 Добавлено в prod:');
    for (const k of added) {
      const val = prodDb[k];
      const type = Array.isArray(val) ? `массив (${val.length} шт.)` :
        typeof val === 'object' && val !== null ? `объект (${Object.keys(val).length} ключей)` :
          typeof val;
      console.log(`   + ${k}: ${type}`);
    }
  } else {
    console.log('\n🆕 Добавлено в prod: (нет)');
  }

  // Удалено из prod (есть в dev, нет в prod)
  const removed = [...devKeys].filter(k => !prodKeys.has(k));
  if (removed.length) {
    console.log('\n🗑 Удалено из prod:');
    for (const k of removed) {
      const val = devDb[k];
      const type = Array.isArray(val) ? `массив (${val.length} шт.)` :
        typeof val === 'object' && val !== null ? `объект (${Object.keys(val).length} ключей)` :
          typeof val;
      console.log(`   - ${k}: ${type}`);
    }
  } else {
    console.log('\n🗑 Удалено из prod: (нет)');
  }

  // Различия в типах данных
  const changedType = [...devKeys].filter(k => prodKeys.has(k) && typeof devDb[k] !== typeof prodDb[k]);
  if (changedType.length) {
    console.log('\n⚠️ Изменён тип данных:');
    for (const k of changedType) {
      console.log(`   ~ ${k}: ${typeof devDb[k]} → ${typeof prodDb[k]}`);
    }
  } else {
    console.log('\n⚠️ Изменён тип данных: (нет)');
  }

  // Различия в размерах массивов
  const changedSize = [...devKeys].filter(k => {
    if (!prodKeys.has(k)) return false;
    return Array.isArray(devDb[k]) && Array.isArray(prodDb[k]) &&
      devDb[k].length !== prodDb[k].length;
  });
  if (changedSize.length) {
    console.log('\n📏 Изменён размер массивов:');
    for (const k of changedSize) {
      console.log(`   ~ ${k}: ${devDb[k].length} → ${prodDb[k].length}`);
    }
  }
}

main().catch(err => {
  console.error('❌ Неожиданная ошибка:', err);
  process.exit(1);
});
