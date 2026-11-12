/**
 * scripts/db-format.mjs — общий формат db.json (S4).
 *
 * Целевая (вложенная) структура db.json:
 *   {
 *     "data":     { news, programs, trainers, schedule, prices, album },
 *     "settings": { appearance, siteSettings, newsSettings, scheduleSettings,
 *                   emailConfig, globalDivider, sliderSettings, contacts },
 *     "sliders":  [],            // плюс прочие ключи верхнего уровня
 *     ...extras                  // sections, defaultInterval, visits, ...
 *   }
 *
 * Все скрипты-парсеры работают с ПЛОСКИМ представлением (db.trainers, db.news, ...),
 * а на диске хранится вложенное. Граница — flattenDb() при чтении, nestDb() при записи.
 *
 * Обратная совместимость: flattenDb() принимает и плоский, и вложенный вариант;
 * если скрипт прочитал плоский файл и записал обратно через nestDb() — файл
 * стал вложенным. Ничего не ломается ни в одну сторону.
 */

export const DATA_KEYS = ['news', 'programs', 'trainers', 'schedule', 'prices', 'album',
  // S166: мероприятия (смешанная сущность: новости+программы+альбом+страницы).
  // Без записи здесь ключ теряется при nestDb().
  'events'];
export const SETTINGS_KEYS = [
  'appearance', 'siteSettings', 'newsSettings', 'scheduleSettings',
  'emailConfig', 'globalDivider', 'sliderSettings', 'contacts', 'directions',
  // S99: залы (название + картинка расписания). Без записи здесь ключ
  // теряется при nestDb() — база перезаписывается без settings.halls.
  'halls',
  // S106: разделы главной (заголовок/фон/видимость/порядок). Без записи здесь
  // ключ теряется при nestDb() — тот же класс бага, что с halls.
  'homeSections',
  // S115: цены и скидки. Тот же класс бага: не записанный здесь ключ
  // исчезает из db.json при первой же save-операции через nestDb().
  'priceItems', 'discounts',
  // S113: ссылки подвала («Перейти к» / «Наши партнёры»).
  'footerLinks',
  // S120: статические страницы (заголовок/url/markdown/видимость/меню/порядок).
  // Тот же класс бага: не записанный здесь ключ исчезает при nestDb().
  'pages',
  // S122: настройки шапки (цвета меню, тексты кнопок, видимость пунктов, стиль hover).
  'headerSettings',
  // S127 (Р1): единые имена разделов («Коллектив» и т.п.) — меню, подвал, крошки,
  // <h1>, <title>. Тот же класс бага: не записанный здесь ключ исчезает при nestDb().
  'sectionNames',
  // S138: слайдер совместных фото на «Коллективе» (вкл/выкл + интервал).
  // Тот же класс бага: не записанный здесь ключ исчезает при nestDb().
  'trainerSliderSettings'
];

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/** Файл вложенный? Маркер — data.* объектом (в плоской базе такого ключа нет). */
export function isNested(db) {
  return isPlainObject(db && db.data);
}

/** Вложенный/плоский db.json → плоское представление для скриптов. */
export function flattenDb(db) {
  if (!isNested(db)) return db;
  const flat = {};
  // Прочие ключи верхнего уровня (sliders, sections, defaultInterval, ...)
  for (const [k, v] of Object.entries(db)) {
    if (k === 'data' || k === 'settings') continue;
    flat[k] = v;
  }
  if (isPlainObject(db.settings)) Object.assign(flat, db.settings);
  if (isPlainObject(db.data)) Object.assign(flat, db.data);
  return flat;
}

/** Плоский/вложенный db → вложенный для записи на диск. */
export function nestDb(db) {
  if (isNested(db)) return db;
  const nested = { data: {}, settings: {} };
  const used = new Set(['data', 'settings', ...DATA_KEYS, ...SETTINGS_KEYS]);

  for (const k of DATA_KEYS) {
    if (db[k] !== undefined) nested.data[k] = db[k];
  }
  // Старый ключ settings (массив/пусто из легаси) — не теряем непустой объект
  const legacySettings = isPlainObject(db.settings) ? db.settings : null;
  const settingsBase = legacySettings ? { ...legacySettings } : {};
  for (const k of SETTINGS_KEYS) {
    if (db[k] !== undefined) settingsBase[k] = db[k];
  }
  if (Object.keys(settingsBase).length) nested.settings = settingsBase;

  // Прочие ключи верхнего уровня остаются как есть (sliders, sections, ...)
  for (const [k, v] of Object.entries(db)) {
    if (used.has(k)) continue;
    nested[k] = v;
  }
  return nested;
}
