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
 * Результат — db.album = [{ id, image, thumb, title, date }], title = папка-владелец.
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

// Обход: тренеры — папки 1 уровня, программы — 2 уровня (категория/программа)
function collectPhotos() {
  const items = [];
  const walk = (dir, owner) => {
    const files = fs.readdirSync(dir).filter(f => IMG_RE.test(f)).sort((a, b) => a.localeCompare(b, 'ru'));
    files.forEach((f, i) => items.push({ src: path.join(dir, f), owner, n: i + 1 }));
  };
  const tDir = path.join(dataDir, 'trainers');
  if (fs.existsSync(tDir)) {
    for (const d of fs.readdirSync(tDir)) {
      const full = path.join(tDir, d);
      if (fs.statSync(full).isDirectory()) walk(full, d);
    }
  }
  const pDir = path.join(dataDir, 'programs');
  if (fs.existsSync(pDir)) {
    for (const cat of fs.readdirSync(pDir)) {
      const catDir = path.join(pDir, cat);
      if (!fs.statSync(catDir).isDirectory()) continue;
      for (const d of fs.readdirSync(catDir)) {
        const full = path.join(catDir, d);
        if (fs.statSync(full).isDirectory()) walk(full, d);
      }
    }
  }
  return items;
}

fs.mkdirSync(albumFull, { recursive: true });
fs.mkdirSync(albumThumb, { recursive: true });

const items = collectPhotos();
console.log(`🖼 Фото на диске: ${items.length}`);

const album = [];
let made = 0, reused = 0, skipped = 0;

for (const it of items) {
  const name = `${slug(it.owner)}-${it.n}`;
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
    title: it.owner,
    date: ''
  });
}

album.sort((a, b) => a.title.localeCompare(b.title, 'ru') || a.id - b.id);

const db = flattenDb(JSON.parse(fs.readFileSync(dbPath, 'utf-8')));
const changed = JSON.stringify(db.album || []) !== JSON.stringify(album);
if (changed || made) {
  const dir = path.join(root, 'backups');
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(dbPath, path.join(dir, `db.json.backup.${Date.now()}`));
  db.album = album;
  fs.writeFileSync(dbPath, JSON.stringify(nestDb(db), null, 2), 'utf-8');
  console.log('✅ db.json сохранён');
} else {
  console.log('✅ Изменений нет');
}
console.log(`📊 В альбоме: ${album.length} (новых: ${made}, готово было: ${reused}, пропущено битых: ${skipped})`);
