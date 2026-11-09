#!/usr/bin/env node
/**
 * scripts/pull-prod-news.mjs — S97
 *
 * Стягивает раздел «Новости» с боевого сайта (центр-фр.рф) вместе с картинками
 * и мержит их в локальную db.json.
 *
 * Зачем: серверный db.json устаревает по всем разделам, кроме новостей — новости
 * живут только на проде. Обычный деплой (git pull) затирал бы их девелоперской
 * версией. Этот скрипт делает единственную операцию, которую надо уметь повторять
 * и локально, и на сервере: «новости прода → в базу, без дублей, без потерь».
 *
 * Источник (по приоритету):
 *   1. Прод:   <PROD_ORIGIN>/js/data/news-all.js  + /js/data/news-full.js
 *   2. Снимок: static/data/prod-snapshot/prod-news-all.js + prod-news-full.js
 *      (на сервере снимка нет — там работает только пункт 1)
 *
 * Идемпотентно: второй запуск даёт «0 изменений». Картинки не перекачиваются,
 * если уже лежат на месте и валидны.
 *
 *   npm run pull-prod-news                — применить
 *   npm run pull-prod-news -- --dry-run   — только отчёт, ничего не писать
 *   npm run pull-prod-news -- --keep-test-news — не удалять тестовую новость
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';
import { flattenDb, nestDb } from './db-format.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const dbPath = path.join(root, 'db.json');
const staticDir = path.join(root, 'static');
const uploadsDir = path.join(staticDir, 'uploads');
const snapshotDir = path.join(staticDir, 'data', 'prod-snapshot');

/** Боевой домен. Не секрет — он и так в AGENTS.md и в ссылках сайта. */
const PROD_ORIGIN = process.env.PROD_ORIGIN || 'https://центр-фр.рф';
const FETCH_TIMEOUT = Number(process.env.PROD_FETCH_TIMEOUT || 30000);

const DRY_RUN = process.argv.includes('--dry-run');
const KEEP_TEST = process.argv.includes('--keep-test-news');

/** Мусорные тестовые новости (заголовок «ждш», текст «бодл») — S97 шаг 3. */
const TEST_NEWS_IDS = new Set([1792778262406]);

/** Полевым порядок новости — единственный источник истины для сравнения. */
const NEWS_FIELDS = ['id', 'title', 'text', 'date', 'image', 'video', 'photos', 'showOnHome'];

function log(msg) {
  console.log(`[${new Date().toISOString().slice(0, 19)}] ${msg}`);
}

// ============================================================
// Чтение источника
// ============================================================

/** Выполняет браузерный модуль данных в изолированном vm и достаёт SITE_DATA. */
function evalSiteModule(source) {
  const box = { window: {} };
  box.globalThis = box;
  vm.createContext(box);
  vm.runInContext(source, box);
  return box.window.SITE_DATA || {};
}

async function fetchText(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT) });
  if (!res.ok) throw new Error(`HTTP ${res.status} на ${url}`);
  return await res.text();
}

/**
 * Читает новости прода: сначала с сайта, при любой ошибке — из локального снимка.
 * Возвращает { newsAll, newsFull, origin }.
 */
async function readProdNews() {
  const errors = [];

  // 1. Боевой сайт
  try {
    const [allSrc, fullSrc] = await Promise.all([
      fetchText(`${PROD_ORIGIN}/js/data/news-all.js`),
      fetchText(`${PROD_ORIGIN}/js/data/news-full.js`)
    ]);
    const all = evalSiteModule(allSrc).newsAll;
    const full = evalSiteModule(fullSrc).newsFull;
    if (!Array.isArray(all) || !all.length) throw new Error('newsAll пуст или отсутствует');
    return { newsAll: all, newsFull: full || {}, origin: PROD_ORIGIN };
  } catch (e) {
    errors.push(`прод: ${e.message}`);
    log(`⚠️  Не удалось прочитать прод — пробую локальный снимок (${e.message})`);
  }

  // 2. Снимок в static/data/prod-snapshot/
  try {
    const allSrc = fs.readFileSync(path.join(snapshotDir, 'prod-news-all.js'), 'utf-8');
    const fullSrc = fs.readFileSync(path.join(snapshotDir, 'prod-news-full.js'), 'utf-8');
    const all = evalSiteModule(allSrc).newsAll;
    const full = evalSiteModule(fullSrc).newsFull;
    if (!Array.isArray(all) || !all.length) throw new Error('в снимке newsAll пуст');
    return { newsAll: all, newsFull: full || {}, origin: `снимок ${path.relative(root, snapshotDir)}` };
  } catch (e) {
    errors.push(`снимок: ${e.message}`);
  }

  throw new Error(`Нет источника новостей.\n  ${errors.join('\n  ')}`);
}

// ============================================================
// Нормализация под конвенцию девела
// ============================================================

/** Путь из прод-модуля (uploads/x.jpg) → в базу (/uploads/x.jpg). */
function toDbPath(p) {
  const s = String(p || '').trim();
  if (!s) return '';
  return s.startsWith('/') ? s : '/' + s;
}

/** Путь из базы (/uploads/x.jpg) → относительный для скачивания/диска (uploads/x.jpg). */
function toRelPath(p) {
  return String(p || '').replace(/^\//, '');
}

/**
 * Экспорт вырезает ведущий слэш (fixPath), поэтому прод-модуль отдаёт
 * «uploads/x.jpg», а база хранит «/uploads/x.jpg». Обратное преобразование
 * делаем по тому же правилу, что и admin-server.
 */
function buildNewsItem(raw, newsFull) {
  const id = raw.id;
  const text = newsFull[String(id)] ?? newsFull[id] ?? '';
  return {
    id,
    title: raw.title || '',
    text,
    date: raw.date || '',
    image: toDbPath(raw.image),
    video: toDbPath(raw.video),
    photos: (Array.isArray(raw.photos) ? raw.photos : []).map(toDbPath).filter(Boolean).slice(0, 5),
    // Экспорт уже считал showOnHome как «!== false»; храним как есть
    showOnHome: raw.showOnHome !== false
  };
}

/** Канонический вид новости для сравнения «изменилась ли вообще» (без preview и порядка ключей). */
function canonical(item) {
  const o = {};
  for (const f of NEWS_FIELDS) {
    o[f] = f === 'photos' ? (Array.isArray(item[f]) ? item[f].slice() : []) : item[f];
  }
  return JSON.stringify(o);
}

// ============================================================
// Картинки
// ============================================================

/** Все медиа-пути новости (/uploads/...). */
function mediaPathsOf(item) {
  const list = [item.image, item.video, ...item.photos];
  return [...new Set(list.filter(Boolean))];
}

function looksLikeImage(buf) {
  if (!buf || buf.length < 512) return false;
  const isJpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  const isGif = buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46;
  const isWebp = buf.length > 12 && buf.slice(0, 4).toString('ascii') === 'RIFF' &&
    buf.slice(8, 12).toString('ascii') === 'WEBP';
  return isJpeg || isPng || isGif || isWebp;
}

function looksLikeVideo(buf) {
  if (!buf || buf.length < 12) return false;
  // mp4/mov: «....ftyp»
  return buf.slice(4, 8).toString('ascii') === 'ftyp';
}

/** Файл на диске уже валиден? (идемпотентность: не перекачиваем зря) */
function fileLooksValid(absPath, relPath) {
  try {
    if (!fs.existsSync(absPath)) return false;
    const size = fs.statSync(absPath).size;
    if (size < 512) return false;
    const head = Buffer.alloc(16);
    const fd = fs.openSync(absPath, 'r');
    fs.readSync(fd, head, 0, 16, 0);
    fs.closeSync(fd);
    return /\.mp4$/i.test(relPath) ? looksLikeVideo(head) : looksLikeImage(head);
  } catch {
    return false;
  }
}

/**
 * Скачивает одно медиа. Прогресс печатает в одну строку.
 * @returns {'exists'|'downloaded'|'from-snapshot'|'missing'}
 */
async function ensureMedia(relPath) {
  const absPath = path.join(staticDir, relPath);

  // Защита: пишем только внутрь static/uploads/
  const resolved = path.resolve(absPath);
  if (!resolved.startsWith(path.resolve(uploadsDir) + path.sep)) {
    log(`  ⚠️  Пропущен путь вне uploads/: ${relPath}`);
    return 'missing';
  }

  if (fileLooksValid(absPath, relPath)) {
    log(`  ✓ ${relPath} — уже на месте (${fs.statSync(absPath).size} Б)`);
    return 'exists';
  }

  fs.mkdirSync(path.dirname(absPath), { recursive: true });

  // 1. с прода
  try {
    const res = await fetch(`${PROD_ORIGIN}/${relPath}`, { signal: AbortSignal.timeout(FETCH_TIMEOUT) });
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      const ok = /\.mp4$/i.test(relPath) ? looksLikeVideo(buf) : looksLikeImage(buf);
      if (ok) {
        if (!DRY_RUN) fs.writeFileSync(absPath, buf);
        log(`  ↓ ${relPath} — скачано с прода (${buf.length} Б)`);
        return 'downloaded';
      }
      log(`  ⚠️  ${relPath} — прод отдал не картинку (${buf.length} Б), пробую снимок`);
    } else {
      log(`  ⚠️  ${relPath} — прод HTTP ${res.status}, пробую снимок`);
    }
  } catch (e) {
    log(`  ⚠️  ${relPath} — прод недоступен (${e.message}), пробую снимок`);
  }

  // 2. из снимка (static/data/prod-snapshot/news-<имя>)
  const snapName = 'news-' + path.basename(relPath);
  const snapPath = path.join(snapshotDir, snapName);
  if (fs.existsSync(snapPath)) {
    const buf = fs.readFileSync(snapPath);
    const ok = /\.mp4$/i.test(relPath) ? looksLikeVideo(buf) : looksLikeImage(buf);
    if (ok) {
      if (!DRY_RUN) fs.writeFileSync(absPath, buf);
      log(`  📦 ${relPath} — взят из снимка (${snapName}, ${buf.length} Б)`);
      return 'from-snapshot';
    }
    log(`  ⚠️  ${relPath} — снимок ${snapName} не похож на картинку`);
  }

  log(`  ❌ ${relPath} — НЕ ГДЕ ВЗЯТЬ (ни прода, ни снимка)`);
  return 'missing';
}

// ============================================================
// Мерж
// ============================================================

function mergeNews(existingNews, prodItems, report) {
  const byId = new Map();
  for (const n of existingNews || []) byId.set(String(n.id), n);

  const result = [];

  for (const item of prodItems) {
    const key = String(item.id);
    const prev = byId.get(key);
    if (!prev) {
      report.added.push(item);
      result.push(item);
      log(`  🆕 [${key}] ${item.title}`);
    } else if (canonical(prev) !== canonical(item)) {
      report.updated.push({ from: prev, to: item });
      result.push(item);
      log(`  ♻️  [${key}] ${item.title} — обновлена (текст/медиа/showOnHome)`);
    } else {
      report.unchanged.push(item);
      result.push(item);
      log(`  =  [${key}] ${item.title} — без изменений`);
    }
    byId.delete(key);
  }

  // Что в базе есть, а на проде отсутствует
  for (const rest of byId.values()) {
    if (!KEEP_TEST && TEST_NEWS_IDS.has(Number(rest.id))) {
      report.removed.push(rest);
      log(`  🗑 [${rest.id}] «${rest.title}» — тестовая новость удалена (S97 шаг 3)`);
      continue;
    }
    report.keptLocal.push(rest);
    result.push(rest);
    log(`  🔒 [${rest.id}] «${rest.title}» — есть только в девеле, оставлена`);
  }

  return result;
}

// ============================================================
// main
// ============================================================

async function main() {
  log('='.repeat(64));
  log(`📰 S97: новости с прода → db.json ${DRY_RUN ? '(--dry-run, ничего не пишем)' : ''}`);
  log('='.repeat(64));

  const { newsAll, newsFull, origin } = await readProdNews();
  log(`Источник: ${origin} (${newsAll.length} новостей)`);

  const prodItems = newsAll.map(raw => buildNewsItem(raw, newsFull));

  // --- Шаг 1. Картинки -------------------------------------------------
  log('\n🖼 Шаг 1: медиа новостей');
  const mediaReport = { exists: 0, downloaded: 0, 'from-snapshot': 0, missing: 0 };
  const wantedMedia = [...new Set(prodItems.flatMap(mediaPathsOf))];
  for (const p of wantedMedia) {
    mediaReport[await ensureMedia(toRelPath(p))]++;
  }
  log(`  Итого: на месте ${mediaReport.exists}, скачано ${mediaReport.downloaded}, ` +
    `из снимка ${mediaReport['from-snapshot']}, потеряно ${mediaReport.missing}`);
  if (mediaReport.missing) {
    log('  ⚠️ Есть недоступные медиа — новости всё равно пишутся, но картинки будут битыми.');
  }

  // --- Шаг 2. Мерж базы ------------------------------------------------
  log('\n🗄 Шаг 2: мерж в db.json');
  if (!fs.existsSync(dbPath)) throw new Error(`Нет ${dbPath}`);
  const db = flattenDb(JSON.parse(fs.readFileSync(dbPath, 'utf-8')));

  const report = {
    added: [], updated: [], unchanged: [], removed: [], keptLocal: []
  };
  const before = (db.news || []).length;
  const merged = mergeNews(db.news, prodItems, report);
  db.news = merged;

  log('\n📊 ИТОГО:');
  log(`  Новостей в базе: ${db.news.length}  (было ${before})`);
  log(`  Добавлено:       ${report.added.length}`);
  log(`  Обновлено:       ${report.updated.length}`);
  log(`  Без изменений:   ${report.unchanged.length}`);
  log(`  Удалено (тест):  ${report.removed.length}`);
  log(`  Оставлено локальных: ${report.keptLocal.length}`);
  log(`  Медиа: на месте ${mediaReport.exists}, новых ${mediaReport.downloaded + mediaReport['from-snapshot']}, битых ${mediaReport.missing}`);

  const changed = report.added.length + report.updated.length + report.removed.length;

  if (DRY_RUN) {
    log('\n  📄 dry-run — db.json НЕ изменён');
    return;
  }

  if (!changed && !(mediaReport.downloaded + mediaReport['from-snapshot'])) {
    log('\n  ✅ Изменений нет — db.json не переписываем (идемпотентно).');
    return;
  }

  const backupsDir = path.join(root, 'backups');
  fs.mkdirSync(backupsDir, { recursive: true });
  const backupPath = path.join(backupsDir, `db.json.backup.${Date.now()}`);
  fs.copyFileSync(dbPath, backupPath);
  log(`\n  💾 Бэкап: ${path.relative(root, backupPath)}`);

  fs.writeFileSync(dbPath, JSON.stringify(nestDb(db), null, 2), 'utf8');
  log('  ✅ db.json записан');
  log('  ➡️  Далее: npm run static:export');
}

main().catch(err => {
  console.error(`\n❌ Ошибка: ${err && err.message ? err.message : err}`);
  process.exit(1);
});
