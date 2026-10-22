#!/usr/bin/env node
/**
 * scripts/match-photos.mjs — фотографии-обложки (S28, часть S17).
 *
 * Для каждой программы/тренера берёт фото из уже скачанных папок
 *   static/data/programs/<CAT>/<Имя>/   и   static/data/trainers/<Имя>/
 * по правилам: coverFile из docx → файл с именем папки → первое по алфавиту.
 *
 * Обрабатывает через ImageMagick (≤1600px, q82, авто-поворот) в
 *   static/uploads/covers/<slug>.jpg   (slug — транслит, ASCII)
 * и пишет в db.json: image = /uploads/covers/<slug>.jpg
 *
 *   npm run match-photos            — заполняет только пустые image
 *   npm run match-photos -- --force — переставляет обложки заново
 *
 * Идемпотентен, бэкапит db.json перед записью.
 */
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const dataDir = path.join(root, 'static', 'data');
const coversDir = path.join(root, 'static', 'uploads', 'covers');
const dbPath = path.join(root, 'db.json');
const FORCE = process.argv.includes('--force');

// Те же исправления имён папок, что в parse-docs.mjs
const NAME_FIXES = {
  'Гимнастика для шеи и органов чуств': 'Гимнастика для шеи и органов чувств',
  'ОФП УШУ (10+)': 'ОФП Ушу (10+)',
  'Оздоровительное УШУ (6-12 лет)': 'Оздоровительное Ушу для детей (6-12 лет)',
  'Тайцзи-цигун': 'Тайцзи-Цигун',
  'Тайцзи-цюань': 'Тайцзи-Цюань',
  'Борьба': 'Греко-римская борьба'
};

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
    .slice(0, 60) || 'cover';
}

function normalizeName(name) {
  let n = (name || '').trim().replace(/\s{2,}/g, ' ');
  n = n.replace(/^в расписании нет\s+/i, '');
  return NAME_FIXES[n] || n;
}

// Ключ: первые два токена (фамилия+имя) — прощает опечатки отчества
function key2(name) {
  return normalizeName(name).toLowerCase().split(/\s+/).filter(Boolean).slice(0, 2).sort().join(' ');
}

const IMG_RE = /\.(jpe?g|png|webp)$/i;

// Папки с фото: нормализованное имя → абсолютный путь папки
function scanFolders(base) {
  const map = new Map();
  if (!fs.existsSync(base)) return map;
  for (const dir of fs.readdirSync(base)) {
    const full = path.join(base, dir);
    if (!fs.statSync(full).isDirectory()) continue;
    const imgs = fs.readdirSync(full).filter(f => IMG_RE.test(f)).sort((a, b) => a.localeCompare(b, 'ru'));
    if (imgs.length) map.set(normalizeName(dir), { full, imgs });
  }
  return map;
}

// Программы: папки лежат на уровень глубже (по категориям)
function scanProgramFolders() {
  const base = path.join(dataDir, 'programs');
  const map = new Map();
  if (!fs.existsSync(base)) return map;
  for (const cat of fs.readdirSync(base)) {
    const catDir = path.join(base, cat);
    if (!fs.statSync(catDir).isDirectory()) continue;
    for (const [name, val] of scanFolders(catDir)) map.set(name, val);
  }
  return map;
}

// Кандидаты обложки: coverFile → файл с именем папки → остальные по алфавиту.
// Встречаются HEIC/HEIF с расширением .jpg — convert на них падает, поэтому
// processList перебирает кандидатов до первого успешного.
function coverCandidates(folder, entity) {
  const { full, imgs } = folder;
  const out = [];
  const push = f => { if (f && !out.includes(path.join(full, f))) out.push(path.join(full, f)); };
  if (entity.coverFile) {
    const want = entity.coverFile.toLowerCase();
    push(imgs.find(f => f.toLowerCase() === want || path.parse(f).name.toLowerCase() === path.parse(want).name));
  }
  // Файл с именем папки: «РАСТЯЖКА.jpg» в папке «Растяжка»
  const base = path.basename(full).toLowerCase();
  imgs.filter(f => path.parse(f).name.toLowerCase() === base).forEach(push);
  imgs.forEach(f => push(f));
  return out;
}

// ImageMagick: квадрат ≤1600px без обрезки (S43): вписываем целиком,
// добелая подложка по бокам (extent), q82, авто-поворот по EXIF
function makeCover(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  execFileSync('convert', [src, '-auto-orient', '-resize', '1600x1600>',
    '-background', 'white', '-gravity', 'center', '-extent', '1600x1600',
    '-quality', '82', dest],
    { stdio: 'pipe' });
}

function backupDB() {
  const dir = path.join(root, 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const dst = path.join(dir, `db.json.backup.${Date.now()}`);
  fs.copyFileSync(dbPath, dst);
  console.log(`💾 Бэкап: ${dst}`);
}

const db = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
const usedSlugs = new Set();
let set = 0, skipped = 0, missing = [];

function processList(list, folders, kind) {
  for (const entity of list) {
    if (entity.image && !FORCE) { skipped++; continue; }
    let folder = folders.get(normalizeName(entity.name));
    if (!folder) {
      // нестрогий матчинг: фамилия+имя (тренеры) / нормализованное имя (программы)
      const k = key2(entity.name);
      for (const [name, val] of folders) if (key2(name) === k) { folder = val; break; }
    }
    if (!folder) { missing.push(`${kind}: ${entity.name}`); continue; }

    const candidates = coverCandidates(folder, entity);
    let s = `${kind === 'program' ? 'p' : 't'}-${slug(entity.name)}`;
    while (usedSlugs.has(s)) s += '2';
    const destName = `${s}.jpg`;
    const dest = path.join(coversDir, destName);
    let lastErr = null;
    for (const src of candidates) {
      try {
        makeCover(src, dest);
        usedSlugs.add(s);
        entity.image = `/uploads/covers/${destName}`;
        set++;
        console.log(`  ✅ ${entity.name} ← ${path.basename(src)}`);
        lastErr = null;
        break;
      } catch (e) {
        lastErr = e; // битый/HEIC файл — пробуем следующий кандидат
      }
    }
    if (lastErr) missing.push(`${kind}: ${entity.name} (convert: ${String(lastErr.message).slice(0, 60)})`);
  }
}

console.log(`🖼 Подбор обложек ${FORCE ? '(--force)' : '(только пустые)'}`);
processList(db.programs || [], scanProgramFolders(), 'program');
processList(db.trainers || [], scanFolders(path.join(dataDir, 'trainers')), 'trainer');

if (set) {
  backupDB();
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf-8');
  console.log('✅ db.json сохранён');
} else {
  console.log('✅ Изменений нет');
}
if (missing.length) {
  console.log(`\n⚠️ Нет локальных фото (${missing.length}) — нужна дозагрузка:`);
  missing.forEach(m => console.log('   ' + m));
}
console.log(`\n📊 Обложек проставлено: ${set}, уже было: ${skipped}, без фото: ${missing.length}`);
