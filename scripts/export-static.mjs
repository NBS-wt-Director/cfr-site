#!/usr/bin/env node
/**
 * scripts/export-static.mjs
 *
 * Генерирует данные статического сайта из db.json.
 *   npm run static:export
 *
 * Поток данных:
 *   Админка (пишет db.json) → этот скрипт → static/js/data/*.js → сайт
 *
 * Разбиение — по потребителю, а не по объекту:
 *   core.js       — всегда нужен: контакты, настройки, разделитель, навигационный срез
 *   programs.js   — полные программы (описания, фото)   → страница с секцией программ
 *   trainers.js   — полные тренеры                      → страница с секцией тренеров
 *   news.js       — новости                             → страница с секцией новостей
 *   slider.js     — слайдер                             → главная
 *   schedule.js   — картинки расписания                 → страница расписания
 *   prices.js     — картинка цен                        → страница цен
 *
 * Меню в шапке читает лёгкий срез navPrograms/navTrainers (только id + name),
 * поэтому работает на любой странице, даже без тяжёлых модулей.
 */

import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

// Markdown-логика живёт в браузерном файле static/js/md.js.
// Генератор грузит его в изолированное vm-состояние, чтобы превью новостей
// на сервере считалось ровно теми же правилами, что и в браузере.
const mdSource = fs.readFileSync(path.join(root, 'static', 'js', 'md.js'), 'utf-8');
const mdBox = { globalThis: {} };
mdBox.globalThis = mdBox;
vm.createContext(mdBox);
vm.runInContext(mdSource, mdBox);
const MD = mdBox.MD;

// Читаем db.json
const dbPath = path.join(root, 'db.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));

// Скрытые объекты (hidden: true) не попадают ни в данные, ни в меню, ни в страницы
const visiblePrograms = (db.programs || []).filter(p => !p.hidden);
const visibleTrainers = (db.trainers || []).filter(t => !t.hidden);
const visibleTrainerIds = new Set(visibleTrainers.map(t => Number(t.id)));

// Преобразуем пути: db.json использует /uploads/ → static использует uploads/
function fixPath(p) {
  if (!p) return '';
  return p.replace(/^\//, '');
}

const HEADER = `/**
 * AUTO-GENERATED — не редактируйте вручную.
 * Генератор: npm run static:export  (scripts/export-static.mjs)
 * Источник: db.json
 * Сгенерировано: ${new Date().toISOString()}
 */
`;

const outDir = path.join(root, 'static', 'js', 'data');
fs.mkdirSync(outDir, { recursive: true });

/* ============================================
   core.js — обязателен на всех страницах
   ============================================ */
const core = {
  siteName: 'ЦФР - Центр Развития',
  siteTitle: 'Центр Функционального Развития «Шифу Панда»',
  contacts: {
    address: db.contacts?.address || '',
    phone: db.contacts?.phone || '',
    email: db.contacts?.email || '',
    vk: db.contacts?.vk || '',
    social: (db.contacts?.social || [])
      .filter(s => s.id !== 'telegram') // Telegram убран
      .map(s => ({
        id: s.id,
        // Убираем "мы в" и "(скоро)" — статус "скоро" рисует футер по пустому url
        title: (s.title || s.id).replace(/^мы\s+в\s+/i, '').replace(/\s*\(скоро\)\s*/i, '').trim(),
        url: s.url
      }))
  },
  headerSettings: {
    titleSuffix: db.headerSettings?.titleSuffix || '',
    secondLineText: db.headerSettings?.secondLineText || ''
  },
  divider: {
    enabled: db.globalDivider?.enabled === true,
    text: db.globalDivider?.textContent || '🏃 🏋️ 🧘 💪',
    height: db.globalDivider?.height || 'md',
    background: db.globalDivider?.background || 'gradientGreen',
    fontSize: db.globalDivider?.fontSize || 'small'
  },
  // «Оформление» из админки: CSS-переменные текста + произвольный CSS.
  // Применяется static/js/appearance.js (подключён после core.js на всех страницах).
  appearance: {
    variables: db.appearance?.variables && typeof db.appearance.variables === 'object' ? db.appearance.variables : {},
    customCss: typeof db.appearance?.customCss === 'string' ? db.appearance.customCss : ''
  },

  // Главные данные (S75)
  siteSettings: {
    title1: typeof db.siteSettings?.title1 === 'string' ? db.siteSettings.title1 : 'Шифу Панда',
    title2: typeof db.siteSettings?.title2 === 'string' ? db.siteSettings.title2 : 'Центр Функционального Развития',
    // logo: путь uploads/... → '/uploads/...'; data: URI (наследие) → как есть
    logo: (function () {
      const l = typeof db.siteSettings?.logo === 'string' ? db.siteSettings.logo.trim() : '';
      if (!l) return '';
      if (l.startsWith('data:')) return l;
      return '/' + l.replace(/^\//, '');
    })()
  },
  sections: (db.sections || []).map(s => ({ id: s.id, title: s.title || '' })),

  // Лёгкий срез для меню — только id и name (скрытые исключены)
  navPrograms: visiblePrograms.map(p => ({ id: p.id, name: p.name || '' })),
  navTrainers: visibleTrainers.map(t => ({ id: t.id, name: t.name || '' })),

  // Заглушки: тяжёлые данные подмешивают свои модули
  slider: null,
  schedule: null,
  prices: null,
  programs: null,
  trainers: null,
  news: null,
  newsAll: null,
  newsFull: null,
  album: null
};

/* ============================================
   Новости: превью считается от markdown-текста
   ============================================ */
// Новые первыми: сначала по дате (ISO-строка сравнима лексикографически),
// при равенстве — по id (timestamp создания)
const newsSorted = (db.news || [])
  .slice()
  .sort((a, b) => {
    const da = String(a.date || '');
    const dbb = String(b.date || '');
    if (da !== dbb) return da < dbb ? 1 : -1;
    return (b.id || 0) - (a.id || 0);
  });

// Первые 200 символов видимого текста (разметка не считается)
function previewOf(text) {
  return MD.preview(text, 200);
}

function newsSlice(from, to, filterHome) {
  let list = to === undefined ? newsSorted : newsSorted.slice(from, to);
  // S78: фильтрация для главной страницы (showOnHome !== false)
  if (filterHome) {
    list = list.filter(n => n.showOnHome !== false);
  }
  return list.map(n => ({
    id: n.id,
    title: n.title || '',
    date: n.date || '',
    image: fixPath(n.image),
    video: fixPath(n.video),
    // Галерея: до 5 фото новости (S73), каждое — отдельной кнопкой в модалке
    photos: (Array.isArray(n.photos) ? n.photos : []).slice(0, 5).map(fixPath).filter(Boolean),
    // S78: флаг показа на главной
    showOnHome: n.showOnHome !== false,
    preview: previewOf(n.text || ''),
    long: MD.plainText(n.text || '').length > 200
  }));
}

function newsFullMap() {
  const map = {};
  newsSorted.forEach(n => { map[n.id] = n.text || ''; });
  return map;
}

/* ============================================
   Тяжёлые модули — подключаются по необходимости
   ============================================ */
const modules = {
  programs: visiblePrograms.map(p => ({
    id: p.id,
    name: p.name || '',
    image: fixPath(p.image),
    description: p.description || '',
    category: p.category || '',
    photoAlbum: (p.photoAlbum || []).map(a => ({ image: fixPath(a.image), caption: a.caption || '' })),
    // Структурные поля (S21/S22); mode — онлайн/офлайн/гибрид (S45), по умолчанию offline
    scheduleStructured: (p.scheduleStructured || []).map(s => ({
      day: s.day || '', time: s.time || '', place: s.place || '', mode: s.mode || 'offline'
    })),
    // Ссылки на тренеров: скрытые исключены, нераспознанные (id: null) остаются текстом
    trainers: (p.trainers || [])
      .filter(tr => tr.id == null || visibleTrainerIds.has(Number(tr.id)))
      .map(tr => ({ name: tr.name || '', id: tr.id != null ? Number(tr.id) : null }))
  })),

  trainers: visibleTrainers.map(t => ({
    id: t.id,
    name: t.name || '',
    image: fixPath(t.image),
    experience: t.experience || '',
    specialization: t.specialization || '',
    description: t.description || '',
    photoAlbum: (t.photoAlbum || []).map(a => ({ image: fixPath(a.image), caption: a.caption || '' })),
    // Структурные поля (S21/S22)
    experienceUshu: t.experienceUshu || '',
    experienceCoach: t.experienceCoach || '',
    education: t.education || '',
    motto: t.motto || ''
  })),

  // Новости разделены на три модуля по потребителю:
  //   news.js       — 8 последних, только превью (главная)
  //   news-all.js   — все, только превью (страница новостей)
  //   news-full.js  — полные тексты по id (модалка «Читать полностью»)
  // Полные тексты на главной не грузятся совсем.
  // S78: news.js — только новости с showOnHome !== false
  news: newsSlice(0, 8, true),
  newsAll: newsSlice(Infinity),
  newsFull: newsFullMap(),

  slider: (db.sliders || []).map(s => ({
    id: s.id,
    title: s.title || '',
    image: fixPath(s.image)
  })).slice(0, 10),

  schedule: (db.schedule || []).map(s => ({ id: s.id, image: fixPath(s.image) })),

  // Общий массив всех слотов всех программ — табличный вид расписания (S23)
  scheduleTable: visiblePrograms.flatMap(p =>
    (p.scheduleStructured || []).map(s => ({
      program: p.name || '',
      programId: p.id,
      day: s.day || '',
      time: s.time || '',
      place: s.place || '',
      mode: s.mode || 'offline'
    }))
  ),

  prices: (db.prices || []).map(p => ({ id: p.id, image: fixPath(p.image) })),

  // Фото, не привязанные к тренеру или программе
  album: (db.album || []).map(a => ({
    id: a.id,
    image: fixPath(a.image),
    thumb: fixPath(a.thumb) || fixPath(a.image),
    title: a.title || '',
    date: a.date || ''
  }))
};

/* ============================================
   Запись файлов
   ============================================ */
const written = [];

const coreFile = path.join(outDir, 'core.js');
fs.writeFileSync(coreFile, `${HEADER}window.SITE_DATA = ${JSON.stringify(core, null, 2)};\n`, 'utf-8');
written.push(coreFile);

for (const [name, payload] of Object.entries(modules)) {
  // Имя модуля в JS — camelCase (newsAll), имя файла — kebab-case (news-all.js)
  const fileName = name.replace(/[A-Z]/g, c => '-' + c.toLowerCase());
  const file = path.join(outDir, `${fileName}.js`);
  const code =
    `${HEADER}` +
    `window.SITE_DATA = window.SITE_DATA || {};\n` +
    `window.SITE_DATA.${name} = ${JSON.stringify(payload, null, 2)};\n`;
  fs.writeFileSync(file, code, 'utf-8');
  written.push(file);
}

// Старый единый файл больше не нужен — удаляем, чтобы не перезаписывал core
const legacy = path.join(root, 'static', 'js', 'data.js');
if (fs.existsSync(legacy)) {
  fs.unlinkSync(legacy);
  console.log('🗑  удалён устаревший static/js/data.js');
}

/* ============================================
   Отчёт
   ============================================ */
let total = 0;
console.log('\n📦 static/js/data/');
for (const f of written) {
  const size = fs.statSync(f).size;
  total += size;
  console.log(`   ${String(size).padStart(6, ' ')} Б  ${path.basename(f)}`);
}
console.log(`   ${'—'.repeat(28)}`);
console.log(`   ${String(total).padStart(6, ' ')} Б  ИТОГО (было одним файлом)`);
console.log(`
   программ: ${modules.programs.length}, тренеров: ${modules.trainers.length}, новостей: ${modules.news.length}, слайдов: ${modules.slider.length}`);

/* ============================================
   Артефакты прошлой схемы: удаляем
   Раньше генерировался HTML-файл на каждую сущность.
   Теперь один шаблон (program.html / trainer.html) рендерит данные по ?id=.
   ============================================ */
for (const stale of ['programs', 'trainers']) {
  const dir = path.join(root, 'static', stale);
  if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
    fs.rmSync(dir, { recursive: true, force: true });
    console.log(`🗑  удалена папка static/${stale}/ (устаревшая поштучная генерация)`);
  }
}