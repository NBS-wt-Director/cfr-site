// Разовая миграция: данные прода становятся основными (данные на дев — вторичные),
// единственная новость прода оформляется как ПЛАНИРУЕМОЕ МЕРОПРИЯТИЕ.
// Все настройки мероприятия берутся из новости.
//
// Запуск: node scripts/promote-news-to-event.mjs <путь-к-прод-базе>
//   (по умолчанию /tmp/db.server.json)
//
// Источник истины — прод-база. Dev-данные перезаписываются прод-данными.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const prodPath = process.argv[2] || '/tmp/db.server.json';
const dbPath = path.join(root, 'db.json');

const db = JSON.parse(fs.readFileSync(prodPath, 'utf-8'));
const news = db.data?.news || [];
if (news.length !== 1) {
  console.error(`❌ Ожидалась ровно 1 новость на проде, найдено: ${news.length}`);
  process.exit(1);
}

const n = news[0];

// Короткое описание (≤120) — первая содержательная строка текста новости.
function shortFrom(text) {
  const line = String(text || '')
    .split('\n')
    .map(l => l.replace(/^#+\s*/, '').replace(/[*_>`#]/g, '').trim())
    .find(l => l.length > 0) || '';
  return line.slice(0, 120);
}

// Фото новости → слайды фотоальбома мероприятия (поля как у слайдера).
const photoAlbum = (Array.isArray(n.photos) ? n.photos : [])
  .filter(Boolean)
  .map(img => ({
    image: String(img).replace(/^\//, ''),
    caption: '',
    title: n.title,
    description: '',
    link: '',
    linkTarget: '_self',
    position: 'bottom-center',
    textColor: '#ffffff',
    textSize: 42,
    textMargin: { top: 20, right: 20, bottom: 20, left: 20 },
    overlay: { enabled: true, color: '#000000', opacity: 0.4 },
    hidden: false
  }));

const videos = n.video ? [{ title: n.title, url: String(n.video) }] : [];

const today = new Date().toISOString().slice(0, 10);

const event = {
  // id наследуем от новости — мероприятие «выросло» из неё
  id: Number(n.id) || Date.now(),
  name: String(n.title || '').slice(0, 60),
  type: 'семинар',
  // Программа семинара в тексте: Суббота 14 ноября 14:00–20:00, Воскресенье 15 ноября 13:30–20:00
  dateStart: '2026-11-14T14:00',
  dateEnd: '2026-11-15T20:00',
  image: String(n.image || '').replace(/^\//, ''),
  shortDescription: shortFrom(n.text),
  description: String(n.text || '').slice(0, 20000),
  reviews: [],
  photoAlbum,
  videos,
  hidden: false,
  // Новость остаётся на сайте (мероприятие ещё не закончилось) и привязывается
  // к событию: после dateEnd серверный auto-news (S166) сам скроет её и
  // попросит загрузить фото.
  newsId: Number(n.id) || null,
  createdAt: n.date || today,
  updatedAt: today
};

// Новость остаётся в data.news БЕЗ ИЗМЕНЕНИЙ (единственная, pinned, с полной
// программой); она же — анонс мероприятия через newsId.
db.data.news = [n];
db.data.events = [event];

fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf-8');

console.log('✅ Прод-данные записаны в db.json (данные на дев — вторичные).');
console.log(`   Мероприятие: «${event.name}» (id=${event.id}, тип=${event.type})`);
console.log(`   Дата: ${event.dateStart} → ${event.dateEnd}`);
console.log(`   Обложка: ${event.image || '—'}`);
console.log(`   Фотоальбом: ${photoAlbum.length} фото, видео: ${videos.length}`);
console.log(`   data.news: ${db.data.news.length} (новость оформлена как мероприятие)`);
