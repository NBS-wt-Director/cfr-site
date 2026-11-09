#!/usr/bin/env node
/**
 * scripts/build-album.mjs — альбом из всех скачанных фото (S37).
 *
 * Собирает ВСЕ пригодные фото из static/data/trainers/ и static/data/programs/,
 * гонит через ImageMagick:
 *   full  ≤1600px q82 → static/uploads/album/full/<slug>-<n>.jpg
 *   thumb ≤400px  q80 → static/uploads/album/thumb/<slug>-<n>.jpg
 * HEIC/HEIF, замаскированные под .jpg, отсеиваются (convert на них падает).
 *
 * Результат — db.album = [{ id, image, thumb, title, category, date }]:
 *   title    — папка-владелец (тренер / программа);
 *   category — группа для фильтров страницы «Альбом» (TICKET-DONOR-FORMAT.md T7).
 * Обходятся ВСЕ вложенности, включая архивы и служебные папки диска (,СОВМЕСТНЫЕ ФОТО,
 * ,Фото тренеров , ,Тренера архив, Архив направлений, программ).
 *
 * T6.2: фото из «,СОВМЕСТНЫЕ ФОТО» дополнительно кладутся в db.sliders с hidden:true —
 * это «скрытые слайды главной», видимые только в админке.
 *
 * Идемпотентно: готовые full/thumb не перегенерируются. Бэкапит db.json.
 *
 *   npm run build-album
 */
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { flattenDb, nestDb } from './db-format.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const dataDir = path.join(root, 'static', 'data');
const albumFull = path.join(root, 'static', 'uploads', 'album', 'full');
const albumThumb = path.join(root, 'static', 'uploads', 'album', 'thumb');
const dbPath = path.join(root, 'db.json');

const IMG_RE = /\.(jpe?g|png|webp)$/i;

const TRANSLIT = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i',
  й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't',
  у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '',
  э: 'e', ю: 'yu', я: 'ya'
};

function slug(name) {
  return String(name).toLowerCase().split('')
    .map(ch => TRANSLIT[ch] !== undefined ? TRANSLIT[ch] : ch)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'img';
}

// Числовой id по строке (стабилен между запусками)
function hashId(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h;
}

// Квадрат без обрезки (S43): вписать целиком, добелая подложка до квадрата
function convert(src, dest, size, quality) {
  execFileSync('convert', [src, '-auto-orient', '-resize', `${size}x${size}>`,
    '-background', 'white', '-gravity', 'center', '-extent', `${size}x${size}`,
    '-quality', String(quality), dest],
    { stdio: 'pipe' });
}

// ── Категории альбома (T7.3) ───────────────────────────────────────────────
// Служебные папки диска начинаются с запятой — это не сущности, а группы фото.
const CAT_JOINT = 'Совместные фото';
const CAT_TRAINER_PHOTOS = 'Фото тренеров';
const CAT_TRAINERS_REST = 'Тренеры отдыхают';
const CAT_TRAINERS_GROUP = 'Тренеры общая';
const CAT_TRAINERS = 'Тренеры';
const CAT_TRAINERS_ARCHIVE = 'Архив тренеров';
const CAT_PROGRAMS = 'Программы';
const CAT_PROGRAMS_ARCHIVE = 'Архив программ';

function isService(name) {
  return /^\s*,/.test(String(name || ''));
}

function serviceBase(name) {
  return String(name || '').replace(/^\s*,\s*/, '').trim();
}

// Категория по пути относительно static/data/trainers|programs
function trainerCategory(relParts) {
  const [top, sub] = relParts;
  if (isService(top)) {
    const base = serviceBase(top);
    if (/СОВМЕСТНЫЕ/i.test(base)) return CAT_JOINT;
    if (/архив/i.test(base)) return CAT_TRAINERS_ARCHIVE;
    if (/Фото\s*тренеров/i.test(base)) {
      const s = String(sub || '');
      if (/отдыхают/i.test(s)) return CAT_TRAINERS_REST;
      if (/общая/i.test(s)) return CAT_TRAINERS_GROUP;
      return CAT_TRAINER_PHOTOS;
    }
    return CAT_TRAINERS;
  }
  return CAT_TRAINERS;
}

function programCategory(relParts) {
  const [cat] = relParts;
  if (/^Архив/i.test(String(cat || '').trim())) return CAT_PROGRAMS_ARCHIVE;
  return CAT_PROGRAMS;
}

// Обход рекурсивный: архивы («архив/», «Архив направлений, программ») и
// служебные папки (,СОВМЕСТНЫЕ ФОТО, ,Фото тренеров , ,Тренера архив) тоже обходятся.
// owner = имя папки-владельца (лист), category = группа по пути.
function collectPhotos() {
  const items = [];

  const walkTree = (dir, relParts) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const dirs = entries.filter(e => e.isDirectory()).map(e => e.name).sort((a, b) => a.localeCompare(b, 'ru'));
    const files = entries.filter(e => e.isFile() && IMG_RE.test(e.name)).map(e => e.name).sort((a, b) => a.localeCompare(b, 'ru'));

    if (files.length) {
      const owner = relParts[relParts.length - 1];
      const category = relParts[0] === 'trainers'
        ? trainerCategory(relParts.slice(1))
        : programCategory(relParts.slice(1));
      files.forEach((f, i) => items.push({
        src: path.join(dir, f),
        owner,
        // relDir — путь без имени листа: нужен, когда разные ветки дают одинаковый slug
        relDir: relParts.slice(1, -1).join('/'),
        category,
        n: i + 1
      }));
    }
    for (const d of dirs) walkTree(path.join(dir, d), relParts.concat(d));
  };

  for (const sub of ['trainers', 'programs']) {
    const root = path.join(dataDir, sub);
    if (!fs.existsSync(root)) continue;
    for (const d of fs.readdirSync(root, { withFileTypes: true }).filter(e => e.isDirectory())
      .map(e => e.name).sort((a, b) => a.localeCompare(b, 'ru'))) {
      walkTree(path.join(root, d), [sub, d]);
    }
  }
  return items;
}

fs.mkdirSync(albumFull, { recursive: true });
fs.mkdirSync(albumThumb, { recursive: true });

const items = collectPhotos();
console.log(`🖼 Фото на диске: ${items.length}`);

// Детерминированный порядок: имена файлов и разбор коллизий slug'ов
// должны быть одинаковы между запусками (иначе album[] «прыгает»).
items.sort((a, b) => (a.relDir.localeCompare(b.relDir, 'ru') ||
  a.owner.localeCompare(b.owner, 'ru') || a.n - b.n));

const album = [];
const usedNames = new Set();
let made = 0, reused = 0, skipped = 0;

for (const it of items) {
  // Разные ветки могут дать одинакового владельца («Глазырина Илона» в корне
  // и в «,Фото тренеров ») — уточняем имя путём, чтобы не затирать файлы
  let name = `${slug(it.owner)}-${it.n}`;
  if (usedNames.has(name)) {
    name = `${slug(it.relDir)}-${slug(it.owner)}-${it.n}`;
    let k = 2;
    while (usedNames.has(name)) name = `${slug(it.relDir)}-${slug(it.owner)}-${it.n}x${k++}`;
  }
  usedNames.add(name);

  const fullRel = `uploads/album/full/${name}.jpg`;
  const thumbRel = `uploads/album/thumb/${name}.jpg`;
  const fullAbs = path.join(root, 'static', fullRel);
  const thumbAbs = path.join(root, 'static', thumbRel);

  if (fs.existsSync(fullAbs) && fs.existsSync(thumbAbs)) {
    reused++;
  } else {
    try {
      convert(it.src, fullAbs, 1600, 82);
      convert(it.src, thumbAbs, 400, 80);
      made++;
    } catch {
      skipped++; // HEIC под .jpg и прочие битые
      continue;
    }
  }
  album.push({
    id: hashId(name),
    image: `/${fullRel}`,
    thumb: `/${thumbRel}`,
    // Служебные папки диска (,СОВМЕСТНЫЕ ФОТО и т.п.) — подпись берём из категории без запятой
    title: /^\s*,/.test(it.owner) ? it.category : it.owner,
    category: it.category,
    date: ''
  });
}

album.sort((a, b) => a.title.localeCompare(b.title, 'ru') || a.id - b.id);

// ── T6.2: «,СОВМЕСТНЫЕ ФОТО» → скрытые слайды главной (hidden:true) ────────
// Видны только в админке; на главную не попадают (export их фильтрует).
function syncJointSlides(db) {
  const joint = album.filter(a => a.category === CAT_JOINT);
  if (!joint.length) return 0;
  if (!Array.isArray(db.sliders)) db.sliders = [];
  const byImage = new Map(db.sliders.map(s => [s.image, s]));
  let added = 0;
  joint.forEach((a, i) => {
    const image = `/${a.image.replace(/^\//, '')}`;
    const existing = byImage.get(image);
    if (existing) {
      if (existing.hidden !== true) existing.hidden = true;
      return;
    }
    db.sliders.push({
      id: 1790000000000 + i,
      title: a.title || CAT_JOINT,
      image,
      interval: 5,
      position: 'center',
      hidden: true
    });
    added++;
  });
  console.log(`🎞 Скрытые слайды главной из «${CAT_JOINT}»: добавлено ${added}, всего ${joint.length}`);
  return added;
}

const db = flattenDb(JSON.parse(fs.readFileSync(dbPath, 'utf8')));
const slidesAdded = syncJointSlides(db);
const changed = JSON.stringify(db.album || []) !== JSON.stringify(album);
if (changed || made || slidesAdded) {
  const dir = path.join(root, 'backups');
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(dbPath, path.join(dir, `db.json.backup.${Date.now()}`));
  db.album = album;
  fs.writeFileSync(dbPath, JSON.stringify(nestDb(db), null, 2), 'utf-8');
  console.log('✅ db.json сохранён');
} else {
  console.log('✅ Изменений нет');
}
const byCat = {};
album.forEach(a => { byCat[a.category] = (byCat[a.category] || 0) + 1; });
console.log('🗂 Категории альбома:', Object.entries(byCat).map(([k, v]) => `${k}: ${v}`).join(', '));
console.log(`📊 В альбоме: ${album.length} (новых: ${made}, готово было: ${reused}, пропущено битых: ${skipped})`);
