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
 *   price-items.js— цены позициями (S115, без скрытых CRM-полей) → главная, страницы сущностей
 *   discounts.js  — скидки и пояснения (S115)      → главная, страницы сущностей
 *
 * Меню в шапке читает лёгкий срез navPrograms/navTrainers (только id + name),
 * поэтому работает на любой странице, даже без тяжёлых модулей.
 */

import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';
import { flattenDb } from './db-format.mjs';
import { renderSitemap, renderRobots } from './lib/sitemap.mjs';
import { slugify } from './lib/slug.mjs';

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

// Читаем db.json (S4: плоский или вложенный — работаем с плоским представлением)
const dbPath = path.join(root, 'db.json');
const db = flattenDb(JSON.parse(fs.readFileSync(dbPath, 'utf-8')));

// Скрытые объекты (hidden: true) не попадают ни в данные, ни в меню, ни в страницы
const visiblePrograms = (db.programs || []).filter(p => !p.hidden);
const visibleTrainers = (db.trainers || []).filter(t => !t.hidden);
const visibleTrainerIds = new Set(visibleTrainers.map(t => Number(t.id)));
const visibleProgramIds = new Set(visiblePrograms.map(p => String(p.id)));

// Преобразуем пути: db.json использует /uploads/ → static использует uploads/
function fixPath(p) {
  if (!p) return '';
  return p.replace(/^\//, '');
}

// S132 п.3: числовое поле возраста — пустое остаётся пустым (не нулём),
// иначе страница показала бы «с 0 лет» там, где админ ничего не вводил.
function numOrEmpty(v) {
  const n = Number(v);
  return (v !== '' && v !== null && v !== undefined && Number.isFinite(n) && n > 0) ? n : '';
}

// S158: утилиты для слайдера
function clamp(v, lo, hi) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : lo;
}

const SLIDER_POS = [
  'top-left','top-center','top-right',
  'center-left','center','center-right',
  'bottom-left','bottom-center','bottom-right'
];
// Старые позиции left/right → center-left/right
const SLIDER_POS_MIGRATE = { left: 'center-left', right: 'center-right' };

// S124: размеры картинки (ширина/высота) — по заголовкам файла, без зависимостей.
// Нужно, чтобы определить «горизонтальная обложка» для компактной плитки новости.
// Поддержка JPEG/PNG/WebP/GIF; при неудаче возвращает null (трактуем как «нет данных»).
function imageSize(relPath) {
  try {
    const file = path.join(root, 'static', fixPath(relPath));
    if (!fs.existsSync(file)) return null;
    const buf = fs.readFileSync(file);
    // PNG: 8-байтовая сигнатура, далее IHDR с размерами
    if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) {
      return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    }
    // GIF
    if (buf.length > 10 && buf.toString('ascii', 0, 3) === 'GIF') {
      return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
    }
    // WebP (VP8X/VP8/VP8L)
    if (buf.length > 30 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
      const fourcc = buf.toString('ascii', 12, 16);
      if (fourcc === 'VP8X') {
        const w = 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16));
        const h = 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16));
        return { width: w, height: h };
      }
      if (fourcc === 'VP8 ' && buf.length > 30) {
        return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
      }
      if (fourcc === 'VP8L' && buf.length > 25) {
        const bits = buf.readUInt32LE(21);
        return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
      }
    }
    // JPEG: идём по маркерам до SOF0–SOF15
    if (buf.length > 4 && buf[0] === 0xFF && buf[1] === 0xD8) {
      let i = 2;
      while (i + 9 < buf.length) {
        if (buf[i] !== 0xFF) { i++; continue; }
        const marker = buf[i + 1];
        if (marker >= 0xC0 && marker <= 0xCF && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) {
          return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
        }
        i += 2 + buf.readUInt16BE(i + 2);
      }
    }
  } catch { /* размер не определился — не критично */ }
  return null;
}

// S124/S125: обложка «высокая» (вертикальная с запасом, h/w ≥ 1.25)?
// Только такие новости занимают целую плитку A4-вертикаль. Нет обложки,
// размер не определился, горизонтальная или почти квадратная → false → компактная плитка.
function isTallCover(relPath) {
  if (!relPath) return false;
  const s = imageSize(relPath);
  return !!(s && s.height >= s.width * 1.25);
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
   S106/S127: разделы главной (заголовок/подзаголовок/фон/видимость/порядок)
   и единые имена разделов (settings.sectionNames, решение Р1).
   Вычисляется до core — имена разделов миграционно опираются на homeSections.
   ============================================ */
const HOME_SECTIONS_EXPORT = (function () {
  const DEFAULT = [
    { id: 'slider', title: '', subtitle: '', bgColor: '', visible: true },
    { id: 'schedule', title: 'Наше расписание', subtitle: '', bgColor: '', visible: true },
    { id: 'prices', title: 'Наши цены', subtitle: '', bgColor: '', visible: true },
    { id: 'programs', title: 'Наши тренировки', subtitle: '', bgColor: '', visible: true },
    { id: 'trainers', title: 'Наши тренера', subtitle: '', bgColor: '', visible: true },
    { id: 'news', title: 'Новости центра', subtitle: '', bgColor: '', visible: true }
  ];
  const KNOWN = DEFAULT.map(d => d.id);
  const raw = Array.isArray(db.homeSections) ? db.homeSections : DEFAULT;
  const seen = new Set();
  const list = [];
  for (const item of raw) {
    const id = item && item.id;
    if (!KNOWN.includes(id) || seen.has(id)) continue;
    seen.add(id);
    list.push({
      id,
      title: typeof item.title === 'string' ? item.title.slice(0, 80) : '',
      // S127: подзаголовок раздела (общие страницы выводят его как .section-subtitle)
      subtitle: typeof item.subtitle === 'string' ? item.subtitle.slice(0, 200) : '',
      // Цвет — строгий hex #RGB/#RRGGBB, иначе пусто (без фона)
      bgColor: /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(item.bgColor || '').trim())
        ? String(item.bgColor).trim() : '',
      visible: item.visible !== false
    });
  }
  // Недостающие известные разделы дописываем в конец (данные не теряются)
  for (const d of DEFAULT) if (!seen.has(d.id)) list.push({ ...d });
  return list;
})();

// S127 (Р1): единые имена разделов — меню · подвал · крошки · <h1> · <title>.
// Миграция: если ключа в базе нет, имена берутся из homeSections[].title,
// кроме trainers → «Коллектив» (решение пользователя).
const SECTION_NAMES_EXPORT = (function () {
  const DEFAULT = {
    schedule: 'Наше расписание',
    prices: 'Наши цены',
    programs: 'Наши тренировки',
    trainers: 'Коллектив',
    news: 'Новости центра',
    contacts: 'Контакты'
  };
  const fromHome = {};
  HOME_SECTIONS_EXPORT.forEach(s => {
    if (DEFAULT[s.id] !== undefined && String(s.title || '').trim()) {
      fromHome[s.id] = String(s.title).trim().slice(0, 60);
    }
  });
  fromHome.trainers = DEFAULT.trainers;   // Р1: не «Наши тренера»
  const src = (db.sectionNames && typeof db.sectionNames === 'object') ? db.sectionNames : {};
  const out = {};
  for (const id of Object.keys(DEFAULT)) {
    const v = String(src[id] == null ? '' : src[id]).trim();
    out[id] = (v || fromHome[id] || DEFAULT[id]).slice(0, 60);
  }
  return out;
})();

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
  headerSettings: (function () {
    const hs = (db.headerSettings && typeof db.headerSettings === 'object') ? db.headerSettings : {};
    const COLORS = ['menuBg', 'menuText', 'hoverBg', 'hoverText', 'activeBg', 'activeText'];
    const ITEMS = ['schedule', 'prices', 'programs', 'staff', 'news', 'contacts', 'lk'];
    const hex = v => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(v || '').trim()) ? String(v).trim() : '';
    const colors = {};
    for (const k of COLORS) colors[k] = hex(hs.colors && hs.colors[k]);
    const items = ITEMS.map(id => {
      const found = (Array.isArray(hs.items) ? hs.items : []).filter(x => x && x.id === id)[0];
      return { id, visible: !found || found.visible !== false };
    });
    return {
      titleSuffix: typeof hs.titleSuffix === 'string' ? hs.titleSuffix : '',
      secondLineText: typeof hs.secondLineText === 'string' ? hs.secondLineText : '',
      // S122: цвета меню, текст кнопки звонка, видимость пунктов, стиль hover
      colors,
      buttons: { callText: typeof hs.buttons?.callText === 'string' && hs.buttons.callText ? hs.buttons.callText.slice(0, 40) : 'Заказать звонок' },
      items,
      hover: { style: ['color', 'underline', 'background', 'scale'].includes(hs.hover?.style) ? hs.hover.style : 'color' }
    };
  })(),
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
    customCss: typeof db.appearance?.customCss === 'string' ? db.appearance.customCss : '',
    // S118: ширина контейнеров (px/% + значение). Дефолт = ширина слайдера (90%).
    containerWidth: (function () {
      const cw = db.appearance?.containerWidth;
      const unit = cw?.unit === 'px' ? 'px' : '%';
      const n = Number(cw?.value);
      const def = { unit: '%', value: 90 };
      if (!Number.isFinite(n)) return def;
      if (unit === 'px') return (n >= 320 && n <= 3840) ? { unit: 'px', value: Math.round(n) } : def;
      return (n >= 20 && n <= 100) ? { unit: '%', value: Math.round(n) } : def;
    })(),
    // S125: максимальная ширина плитки новости (px/% + значение). Дефолт 360px.
    newsTileWidth: (function () {
      const nw = db.appearance?.newsTileWidth;
      const unit = nw?.unit === '%' ? '%' : 'px';
      const n = Number(nw?.value);
      const def = { unit: 'px', value: 360 };
      if (!Number.isFinite(n)) return def;
      if (unit === 'px') return (n >= 200 && n <= 800) ? { unit: 'px', value: Math.round(n) } : def;
      return (n >= 20 && n <= 100) ? { unit: '%', value: Math.round(n) } : def;
    })()
  },

  // Главные данные (S75)
  siteSettings: {
    title1: typeof db.siteSettings?.title1 === 'string' ? db.siteSettings.title1 : 'Шифу Панда',
    title2: typeof db.siteSettings?.title2 === 'string' ? db.siteSettings.title2 : 'Центр Функционального Развития',
    // S133: хост для canonical/og (пусто → дефолт https://центр-фр.рф в seo.js)
    baseUrl: typeof db.siteSettings?.baseUrl === 'string' ? db.siteSettings.baseUrl.trim() : '',
    // S152: текст подтверждения после отправки формы обратного звонка
    callSuccessText: typeof db.siteSettings?.callSuccessText === 'string' && db.siteSettings.callSuccessText.trim()
      ? db.siteSettings.callSuccessText.trim() : '',
    // logo: путь uploads/... → '/uploads/...'; data: URI (наследие) → как есть
    logo: (function () {
      const l = typeof db.siteSettings?.logo === 'string' ? db.siteSettings.logo.trim() : '';
      if (!l) return '';
      if (l.startsWith('data:')) return l;
      return '/' + l.replace(/^\//, '');
    })()
  },
  sections: (db.sections || []).map(s => ({ id: s.id, title: s.title || '' })),

  // S106: разделы главной — заголовок/фон/видимость/порядок. Порядок = порядок массива.
  // Только visible-разделы (скрытые не выводятся на главной, но остаются в базе).
  // id сопоставлены с секциями index.html (slider/schedule/prices/programs/trainers/news).
  // S108: добавлен 'prices'.
  homeSections: HOME_SECTIONS_EXPORT,
  sectionNames: SECTION_NAMES_EXPORT,

  // S113: ссылки подвала — только видимые, порядок = порядок массива.
  // null = ключа в базе нет (footer.js рисует жёсткий fallback);
  // []  = админ осознанно удалил все ссылки (ничего не выводим).
  footerLinks: (function () {
    const GROUPS = ['nav', 'partners'];
    const raw = Array.isArray(db.footerLinks) ? db.footerLinks : null;
    if (!raw) return null;
    const out = [];
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue;
      if (!GROUPS.includes(item.group) || item.visible === false) continue;
      const title = typeof item.title === 'string' ? item.title.slice(0, 80) : '';
      const url = typeof item.url === 'string' ? item.url.trim().slice(0, 500) : '';
      // Тот же whitelist, что на сервере (javascript:/data: не проходят)
      const ok = /^#[\w-]|^https?:\/\//i.test(url) ||
        /^[\w.-]+\.html(#[\w-]*)?$/.test(url) || /^\/[\w.-]+$/.test(url);
      if (!title || !url || !ok) continue;
      out.push({ group: item.group, title, url });
    }
    return out;
  })(),

  // S120: статические страницы — лёгкий срез для меню (id/title/url).
  // Только видимые (visible !== false) и отмеченные «показывать в меню».
  // Полные тексты — в отдельном модуле pages.js (грузится на page.html).
  navPages: (Array.isArray(db.pages) ? db.pages : [])
    .filter(p => p && p.visible !== false && p.showInMenu === true)
    .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0))
    .map(p => ({
      id: p.id,
      title: typeof p.title === 'string' ? p.title.slice(0, 80) : '',
      url: typeof p.url === 'string' ? p.url : ''
    }))
    .filter(p => p.title && p.url),

  // Настройки расписания (S2)
  scheduleSettings: {
    defaultView: ['images', 'table', 'hybrid'].includes(db.scheduleSettings?.defaultView)
      ? db.scheduleSettings.defaultView
      : 'images',
    // S99: режимов ровно два — 'images' | 'table'. Значение 'hybrid'
    // (третий режим «оба сразу», S84) больше не допускается → приводим к 'images'.
    hybridActiveTab: ['images', 'table'].includes(db.scheduleSettings?.hybridActiveTab)
      ? db.scheduleSettings.hybridActiveTab
      : 'images'
  },

  // S138: слайдер совместных фото на странице «Коллектив» (trainers.html).
  // enabled === false (дефолт) — слайдер не выводится; код и данные (trainer-slider.js)
  // целы, S136 вернёт его наполненным. Вкл/выкл — настройка, не удаление кода.
  trainerSliderSettings: {
    enabled: db.trainerSliderSettings?.enabled === true,
    interval: (function () {
      const n = Number(db.trainerSliderSettings?.interval);
      return Number.isFinite(n) && n >= 2 && n <= 20 ? Math.round(n) : 5;
    })()
  },

  // S18: slug = имя «как записано» (кириллицей) — URL-ссылки program/trainer.html.
  // S151: hasAlbum — есть ли у программы фотоальбом (кнопка «Посмотреть» в чипе расписания).
  navPrograms: visiblePrograms.map(p => ({ id: p.id, name: p.name || '', slug: slugify(p.name), hasAlbum: (p.photoAlbum || []).length > 0 })),
  navTrainers: visibleTrainers.map(t => ({ id: t.id, name: t.name || '', slug: slugify(t.name) })),

  // S23: лёгкий срез направлений для меню и группировки на главной
  // (полные данные — в directions.js, он грузится только на directions.html)
  // Скрытые направления и скрытые программы исключены; пустые направления не попадают в меню
  navDirections: (db.directions || [])
    .filter(d => !d.hidden)
    .map(d => ({
      id: d.id,
      name: (typeof d.publicTitle === 'string' && d.publicTitle.trim()) ? d.publicTitle.trim() : (d.name || ''),
      // S131 п.4: showInMenu — пункт шапки, showOnHome — панель на главной
      showInMenu: d.showInMenu !== false,
      showOnHome: d.showOnHome !== false,
      // S132 п.7: страница программы берёт цену направления как fallback,
      // когда у самой программы привязанных позиций прайса нет
      priceGroup: typeof d.priceGroup === 'string' ? d.priceGroup.trim() : '',
      programs: (d.programs || []).filter(p => visibleProgramIds.has(String(p.id)))
    }))
    .filter(d => d.programs.length > 0),

  // Заглушки: тяжёлые данные подмешивают свои модули
  slider: null,
  schedule: null,
  prices: null,
  priceItems: null,
  discounts: null,
  programs: null,
  trainers: null,
  news: null,
  newsAll: null,
  newsFull: null,
  album: null,
  trainerSlider: null
};

/* ============================================
   Новости: превью считается от markdown-текста
   ============================================ */
// Новые первыми: сначала по дате (ISO-строка сравнима лексикографически),
// при равенстве — по id (timestamp создания)
// S129: скрытые новости (hidden: true) не экспортируются на сайт;
// закреплённые (pinned) — первыми, затем по дате (новые), id
const newsSorted = (db.news || [])
  .filter(n => !n.hidden)
  .slice()
  .sort((a, b) => {
    if (!!b.pinned !== !!a.pinned) return b.pinned ? 1 : -1;
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
    // S124/S125: высокая вертикальная обложка → обычная плитка; иначе — компактная
    coverTall: isTallCover(n.image),
    video: fixPath(n.video),
    // Галерея: до 5 фото новости (S73), каждое — отдельной кнопкой в модалке
    photos: (Array.isArray(n.photos) ? n.photos : []).slice(0, 5).map(fixPath).filter(Boolean),
    // S78: флаг показа на главной
    showOnHome: n.showOnHome !== false,
    // S129: рубрика, закрепление, связи, дата обновления
    category: n.category || '',
    pinned: n.pinned === true,
    programId: n.programId != null ? n.programId : null,
    trainerId: n.trainerId != null ? n.trainerId : null,
    updatedAt: n.updatedAt || '',
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
    slug: slugify(p.name),  // S18: URL-якорь
    image: fixPath(p.image),
    description: p.description || '',
    category: p.category || '',
    directionId: p.directionId || '',  // связь с направлением (S23)
    photoAlbum: (p.photoAlbum || []).map(a => ({ image: fixPath(a.image), caption: a.caption || '' })),
    // Структурные поля (S21/S22); mode — зал/онлайн/гибрид (S3), по умолчанию hybrid;
    // hall — big/small; trainerId — ссылку на тренера (fallback — первый тренер программы),
    // trainer — ФИО для отображения без загрузки trainers.js
    scheduleStructured: (p.scheduleStructured || [])
      .filter(s => s.visible !== false)
      .map(s => {
        const tid = s.trainerId != null ? Number(s.trainerId)
          : (p.trainers && p.trainers[0] && p.trainers[0].id != null ? Number(p.trainers[0].id) : null);
        const trainer = tid != null ? (visibleTrainers.find(t => Number(t.id) === tid) || {}).name || '' : '';
        return {
          day: s.day || '',
          time: s.time || '',
          place: s.place || '',
          hall: s.hall === 'small' ? 'small' : 'big',
          mode: ['hall', 'online', 'hybrid'].includes(s.mode) ? s.mode : 'hybrid',
          trainerId: tid,
          trainer
        };
      }),
    // Ссылки на тренеров: скрытые исключены, нераспознанные (id: null) остаются текстом
    trainers: (p.trainers || [])
      .filter(tr => tr.id == null || visibleTrainerIds.has(Number(tr.id)))
      .map(tr => ({ name: tr.name || '', id: tr.id != null ? Number(tr.id) : null })),
    // S132 п.3: мета-строка страницы программы. Все поля опциональны:
    // пусто → блок не выводится, поведение страницы не меняется.
    ageFrom: numOrEmpty(p.ageFrom),
    ageTo: numOrEmpty(p.ageTo),
    level: typeof p.level === 'string' ? p.level.trim() : '',
    duration: typeof p.duration === 'string' ? p.duration.trim() : '',
    trialLesson: p.trialLesson === true || (typeof p.trialLesson === 'string' && p.trialLesson.trim()) ? p.trialLesson : '',
    takeWith: typeof p.takeWith === 'string' ? p.takeWith.trim() : '',
    // S132 п.5: данные, которые лежат в базе, но раньше не экспортировались
    // и нигде не выводились (мёртвые данные). Выводим как есть; пустые массивы
    // → блок на странице не показывается. Из базы ничего не удаляем.
    reviews: Array.isArray(p.reviews) ? p.reviews : [],
    workouts: Array.isArray(p.workouts) ? p.workouts : [],
    trainings: Array.isArray(p.trainings) ? p.trainings : [],
    // S133 п.2: lastmod в sitemap; поля в базе пока нет → дата сборки (см. sitemap.mjs)
    updatedAt: typeof p.updatedAt === 'string' ? p.updatedAt : ''
  })),

  trainers: visibleTrainers.map(t => ({
    id: t.id,
    name: t.name || '',
    slug: slugify(t.name),  // S18: URL-якорь
    image: fixPath(t.image),
    experience: t.experience || '',
    specialization: t.specialization || '',
    description: t.description || '',
    photoAlbum: (t.photoAlbum || []).map(a => ({ image: fixPath(a.image), caption: a.caption || '' })),
    // Структурные поля (S21/S22)
    experienceUshu: t.experienceUshu || '',
    experienceCoach: t.experienceCoach || '',
    education: t.education || '',
    motto: t.motto || '',
    // TICKET-DONOR-FORMAT.md T9.1: категория и услуги.
    // category влияет только на формулировки («тренер ушу» / «преподаватель изо»).
    // isDirector наружу НЕ экспортируется — пометка «Директор» видна только
    // в админке/CRM, которые читают db.json через API.
    category: t.category || 'тренер ушу',
    personal: !!t.personal,
    split: !!t.split,
    massage: !!t.massage
  })),

  // S135: персонал (администраторы) — только видимые, image — только локальные пути
  staff: (function () {
    const raw = db.staff || [];
    return raw.filter(s => !s.hidden).map(s => {
      const img = s.image || '';
      // Внешний URL → фолбэк на logo.png
      const localImg = /^https?:\/\//i.test(img) ? 'logo.png' : fixPath(img);
      return {
        id: String(s.id || ''),
        name: s.name || '',
        image: localImg,
        role: s.role || ''
      };
    });
  })(),

  // S23: Направления (отдельная сущность)
  // hidden: true не экспортируется на сайт (виден только в админке);
  // скрытые программы исключены из состава направления; пустые направления не выводятся
  // S131 п.4: publicTitle/subtitle/showOnHome/showInMenu/showSchedule/priceGroup —
  // опциональные поля, дефолт = текущее поведение
  directions: (db.directions || [])
    .filter(d => !d.hidden)
    .map(d => ({
      id: d.id || '',
      name: d.name || '',
      description: d.description || '',
      image: fixPath(d.image),
      publicTitle: typeof d.publicTitle === 'string' ? d.publicTitle.trim() : '',
      subtitle: typeof d.subtitle === 'string' ? d.subtitle.trim() : '',
      showOnHome: d.showOnHome !== false,
      showInMenu: d.showInMenu !== false,
      showSchedule: d.showSchedule !== false,
      priceGroup: typeof d.priceGroup === 'string' ? d.priceGroup.trim() : '',
      programs: (d.programs || [])
        .filter(p => visibleProgramIds.has(String(p.id)))
        .map(p => ({
          id: p.id,
          name: p.name || '',
          image: fixPath(p.image)
        }))
    }))
    .filter(d => d.programs.length > 0),

  // Новости разделены на три модуля по потребителю:
  //   news.js       — 8 последних, только превью (главная)
  //   news-all.js   — все, только превью (страница новостей)
  //   news-full.js  — полные тексты по id (модалка «Читать полностью»)
  // Полные тексты на главной не грузятся совсем.
  // S78: news.js — только новости с showOnHome !== false
  news: newsSlice(0, 8, true),
  newsAll: newsSlice(Infinity),
  newsFull: newsFullMap(),

  // S86: interval (сек) и position слайда доезжают до сайта — main.js их применяет
  // T6.2: скрытые слайды (hidden:true) на главную НЕ попадают — они видны только в админке
  // S158: добавлены description, link, textColor, textSize, textMargin, overlay,
  //       9 позиций вместо 3, снят лимит .slice(0, 10)
  slider: (db.sliders || []).filter(s => !s.hidden).map(s => {
    const pos = SLIDER_POS_MIGRATE[s.position] || s.position;
    const ov = s.overlay || {};
    return {
      id: s.id,
      title: s.title || '',
      description: s.description || '',
      image: fixPath(s.image),
      link: s.link || '',
      linkTarget: s.linkTarget === '_blank' ? '_blank' : '_self',
      interval: Number(s.interval) > 0 ? Number(s.interval) : 5,
      position: SLIDER_POS.includes(pos) ? pos : 'center',
      textColor: /^#[0-9a-fA-F]{6}$/.test(s.textColor) ? s.textColor : '#ffffff',
      textSize: clamp(s.textSize || 42, 16, 96),
      textMargin: {
        top: clamp(s.textMargin?.top ?? 20, 0, 200),
        right: clamp(s.textMargin?.right ?? 20, 0, 200),
        bottom: clamp(s.textMargin?.bottom ?? 20, 0, 200),
        left: clamp(s.textMargin?.left ?? 20, 0, 200)
      },
      overlay: {
        enabled: ov.enabled !== false,
        color: /^#[0-9a-fA-F]{6}$/.test(ov.color) ? ov.color : '#000000',
        opacity: clamp(ov.opacity ?? 0.4, 0, 0.9)
      }
    };
  }),

  // S99: картинки расписания = залы (settings.halls), по одной на зал.
  // Только visible, только с картинкой. Если залов в базе нет (например, сервер
  // до миграции) — отдаём наследие data.schedule, чтобы режим «Картинки» не опустел.
  schedule: (db.halls && db.halls.length
    ? db.halls.filter(h => h.visible !== false && h.image)
    : (db.schedule || []).filter(s => s.image && s.visible !== false)
        .map(s => ({ id: s.id, name: '', image: s.image }))
  ).map(h => ({ id: h.id, name: h.name || '', image: fixPath(h.image) })),

  // Общий массив всех слотов всех программ — табличный вид расписания (S23/S3).
  // Скрытые (visible:false) исключаются; поля: зал (big/small), режим (hall/online/hybrid), тренер.
  scheduleTable: visiblePrograms.flatMap(p =>
    (p.scheduleStructured || [])
      .filter(s => s.visible !== false)
      .map(s => {
        // Тренер слота: свой trainerId, иначе первый тренер программы
        const tid = s.trainerId != null ? Number(s.trainerId)
          : (p.trainers && p.trainers[0] && p.trainers[0].id != null ? Number(p.trainers[0].id) : null);
        const trainer = tid != null ? (visibleTrainers.find(t => Number(t.id) === tid) || {}).name || '' : '';
        return {
          program: p.name || '',
          programId: p.id,
          programSlug: slugify(p.name),  // S18
          programHasAlbum: (p.photoAlbum || []).length > 0,  // S151: кнопка «Посмотреть»
          day: s.day || '',
          time: s.time || '',
          place: s.place || '',
          hall: s.hall === 'small' ? 'small' : 'big',
          mode: ['hall', 'online', 'hybrid'].includes(s.mode) ? s.mode : 'hybrid',
          trainerId: tid,
          trainer
        };
      })
  ),

  prices: (db.prices || []).map(p => ({ id: p.id, image: fixPath(p.image) })),

  // S115: цены позициями (витрина на главной). Порядок = порядок в базе
  // (его задаёт админка перетаскиванием), скрытые позиции не экспортируются.
  // СКРЫТЫЕ CRM-поля — trainerPay, payMode, freeTrainerPay — на сайт НЕ отдаются:
  // их читает только админка/CRM напрямую из db.json.
  priceItems: (db.priceItems || [])
    .filter(i => i.visible !== false)
    .map(i => ({
      id: i.id,
      group: i.group || 'Цены',
      title: i.title || '',
      variant: i.variant || '',
      price: Number(i.price) || 0,
      priceOld: Number(i.priceOld) > 0 ? Number(i.priceOld) : null,
      unit: i.unit || '',
      note: i.note || '',
      programId: i.programId != null ? i.programId : null,
      trainerId: i.trainerId != null ? i.trainerId : null,
      discountIds: Array.isArray(i.discountIds) ? i.discountIds : []
    })),

  // S115: скидки и пояснения к ценам
  discounts: (db.discounts || [])
    .filter(d => d.visible !== false)
    .map(d => ({
      id: d.id,
      title: d.title || '',
      type: ['percent', 'amount', 'bonus', 'note'].includes(d.type) ? d.type : 'note',
      value: Number(d.value) || 0,
      condition: d.condition || '',
      appliesTo: Array.isArray(d.appliesTo) ? d.appliesTo : []
    })),

  // Фото, не привязанные к тренеру или программе
  album: (db.album || []).map(a => ({
    id: a.id,
    image: fixPath(a.image),
    thumb: fixPath(a.thumb) || fixPath(a.image),
    title: a.title || '',
    category: a.category || '',
    date: a.date || ''
  })),

  // T6.1: слайдер совместных фото на странице тренеров
  // T7.4: берёт фото из категории «Совместные фото»
  trainerSlider: (db.album || []).filter(a => a.category === 'Совместные фото')
    .map(a => ({
      image: fixPath(a.image),
      thumb: fixPath(a.thumb) || fixPath(a.image),
      caption: a.title || ''
    })),

  // S120: статические страницы — полные данные (текст в markdown).
  // Скрытые страницы на сайт не попадают. Порядок = order.
  pages: (Array.isArray(db.pages) ? db.pages : [])
    .filter(p => p && p.visible !== false)
    .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0))
    .map(p => ({
      id: p.id,
      title: typeof p.title === 'string' ? p.title.slice(0, 80) : '',
      url: typeof p.url === 'string' ? p.url : '',
      text: typeof p.text === 'string' ? p.text : '',
      showInMenu: p.showInMenu === true
    }))
    .filter(p => p.title && p.url)
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

/* ============================================
    S133: sitemap.xml и robots.txt — генерируются экспортёром.
    Артефакты сборки (как static/js/data/*), вручную не редактируются.
    ============================================ */
const buildDateISO = new Date().toISOString();
const sitemapPath = path.join(root, 'static', 'sitemap.xml');
const robotsPath = path.join(root, 'static', 'robots.txt');
fs.writeFileSync(sitemapPath, renderSitemap(db, buildDateISO), 'utf-8');
fs.writeFileSync(robotsPath, renderRobots(db, buildDateISO), 'utf-8');