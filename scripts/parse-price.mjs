#!/usr/bin/env node
/**
 * scripts/parse-price.mjs — S115: прайс (.doc/.docx) → модель цен и скидок в db.json.
 *
 *   node scripts/parse-price.mjs                    # разбор, ничего не пишем (dry-run)
 *   node scripts/parse-price.mjs --write            # то же + запись в db.json (с бэкапом)
 *   node scripts/parse-price.mjs --input "<путь.doc>" --write
 *   node scripts/parse-price.mjs --html "<путь.html>" --write   # уже сконвертированный прайс
 *   node scripts/parse-price.mjs --write --prune    # удалять позиции, исчезнувшие из прайса
 *
 * Источник по умолчанию: static/data/prices/*.doc (самый «свежий» по имени),
 * если его нет — /home/ivan/Загрузки/Прайс октябрь 2026.doc.
 *
 * Конвертация .doc → HTML делается LibreOffice (`soffice --headless`), он же
 * ставит кириллические таблицы в предсказуемую разметку. Если LibreOffice нет —
 * передайте HTML файлом через --html.
 *
 * ИНКРЕМЕНТАЛЬНОСТЬ (прайс будет приходить снова):
 *   позиция опознаётся по ключу group|title|variant. Повторный парсинг
 *   обновляет цену/срок/пояснение, но НЕ трогает правки админки:
 *   id, порядок, видимость, связи programId/trainerId и скрытые CRM-поля.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { flattenDb, nestDb } from './db-format.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const dbPath = path.join(root, 'db.json');
const priceDir = path.join(root, 'static', 'data', 'prices');
const fallbackDoc = '/home/ivan/Загрузки/Прайс октябрь 2026.doc';

// ── Аргументы ────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
const opt = (n) => {
  const i = argv.indexOf(n);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : null;
};

const WRITE = flag('--write');
const PRUNE = flag('--prune');

// ── Модель: группы витрины (порядок = порядок на сайте) ──────────
const GROUPS = [
  'Тренерские абонементы',
  'Фитнес-абонементы',
  'Персональные тренировки',
  'Массаж',
  'Аренда и прочее'
];

// Значения скрытых CRM-полей по умолчанию (на сайт не экспортируются)
const CRM_DEFAULTS = {
  trainerPay: 150,        // оплата тренеру за занятие
  payMode: 'base(1)',     // режим оплаты
  freeTrainerPay: 150     // оплата тренеру за бесплатную тренировку
};

// ── Мелкие утилиты ───────────────────────────────────────────────
const ENTITIES = {
  '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"',
  '&laquo;': '«', '&raquo;': '»', '&mdash;': '—', '&ndash;': '–',
  '&deg;': '°', '&hellip;': '…', '&copy;': '©', '&num;': '#'
};

function decode(s) {
  return String(s)
    .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(Number(c)))
    .replace(/&[a-z]+;/gi, (m) => ENTITIES[m.toLowerCase()] || m);
}

// HTML ячейки/абзаца → одна чистая строка текста.
// Инлайн-теги (soffice дробит слово на <font>/<span> куски) снимаем БЕЗ пробела,
// иначе «20:55» превращается в «2 0 : 55». Блочные разделители — в пробел.
function text(html) {
  return decode(String(html)
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|td|th|tr|li|ul|ol)>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim());
}

// Нормализация: регистр, ё→е, только буквы/цифры/пробелы.
// Важно: \p{L} с флагом u — без него \w срезает кириллицу и все русские правила не работают.
const norm = (s) => text(s).toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();

// Цена в ячейке: «3300 руб.», «1100руб.», «2700 руб. / 55 мин.»
const PRICE_RE = /(\d[\d\s]*)\s*руб/i;
const hasPrice = (cell) => PRICE_RE.test(String(cell || ''));
const priceOf = (cell) => {
  const m = String(cell).match(PRICE_RE);
  return m ? Number(m[1].replace(/\s+/g, '')) : null;
};

// Чистое название позиции: убираем сноски-звёздочки и их пояснения в скобках
function stripFootnotes(title) {
  return text(title)
    .replace(/\([^)]*\*[^)]*\)/g, '')   // «(***при единовременной покупке 10 тренировок)»
    .replace(/\*+\s*$/g, '')
    .replace(/[.\s]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Подпись варианта внутри ячейки («Большой зал - 1300 руб.», «760 руб. / 55 мин.»).
// Сноски вида «(2800***)» подписью не считаем — это особая цена, см. conditionalOf.
function looksLikeLabel(s) {
  const v = String(s || '').trim();
  if (!v || v.length > 40) return false;
  if (/\*/.test(v)) return false;
  if (/\d{3,}/.test(v)) return false;
  return /[^\d\s]/.test(v) || /^\d{1,2}\s*мин$/i.test(v);
}

// «(2800***)» → особая цена при условии из сноски
function conditionalOf(cell) {
  const m = String(cell).match(/\((\d[\d\s]*)\s*(\*{1,3})\)/);
  if (!m) return null;
  return { price: Number(m[1].replace(/\s+/g, '')), marker: m[2] };
}

// ── Чтение источника ─────────────────────────────────────────────
function defaultInput() {
  if (fs.existsSync(priceDir)) {
    const docs = fs.readdirSync(priceDir)
      .filter(f => /\.(docx?|htm|html)$/i.test(f))
      .sort();
    if (docs.length) return path.join(priceDir, docs[docs.length - 1]);
  }
  return fallbackDoc;
}

function toHtml(src) {
  const ext = path.extname(src).toLowerCase();
  if (ext === '.html' || ext === '.htm') return fs.readFileSync(src, 'utf-8');

  let soffice = null;
  for (const cand of ['soffice', 'libreoffice']) {
    try {
      execFileSync(cand, ['--version'], { stdio: 'pipe', timeout: 60000 });
      soffice = cand;
      break;
    } catch { /* пробуем следующий */ }
  }
  if (!soffice) {
    throw new Error(
      'Нет LibreOffice (soffice) для конвертации .doc. ' +
      'Сконвертируйте вручную и передайте файл через --html <путь>'
    );
  }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cfr-price-'));
  try {
    execFileSync(soffice, ['--headless', '--convert-to', 'html', '--outdir', tmp, src], {
      stdio: 'pipe', timeout: 180000
    });
    const out = fs.readdirSync(tmp).find(f => /\.html?$/i.test(f));
    if (!out) throw new Error('LibreOffice не создал HTML');
    return fs.readFileSync(path.join(tmp, out), 'utf-8');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// ── Разбор таблиц: rowspan/colspan → полная сетка текста ─────────
function expandGrid(rows) {
  const taken = new Map();
  rows.forEach((cells, r) => {
    let c = 0;
    for (const cell of cells) {
      while (taken.has(r + ',' + c)) c++;
      for (let dr = 0; dr < cell.rowspan; dr++) {
        for (let dc = 0; dc < cell.colspan; dc++) {
          // colspanFill — продолжение той же ячейки по горизонтали (его выбрасываем),
          // rowspan-продолжение (dr > 0) оставляем: это заголовок, повторяемый вниз
          taken.set((r + dr) + ',' + (c + dc), { text: cell.text, colspanFill: dc > 0 });
        }
      }
      c += cell.colspan;
    }
  });
  let maxR = -1, maxC = -1;
  for (const key of taken.keys()) {
    const [r, c] = key.split(',').map(Number);
    if (r > maxR) maxR = r;
    if (c > maxC) maxC = c;
  }
  const grid = [];
  for (let r = 0; r <= maxR; r++) {
    const row = [];
    for (let c = 0; c <= maxC; c++) row.push(taken.get(r + ',' + c) || { text: '', colspanFill: false });
    grid.push(row);
  }
  return grid;
}

function parseTables(html) {
  const tables = [];
  for (const t of html.match(/<table[\s\S]*?<\/table>/gi) || []) {
    const rows = [];
    for (const r of t.match(/<tr[\s\S]*?<\/tr>/gi) || []) {
      const cells = [];
      for (const m of r.matchAll(/<t([dh])\b([^>]*)>([\s\S]*?)<\/t\1>/gi)) {
        const attrs = m[2];
        cells.push({
          text: text(m[3]),
          colspan: Number((attrs.match(/colspan="?(\d+)/i) || [])[1] || 1),
          rowspan: Number((attrs.match(/rowspan="?(\d+)/i) || [])[1] || 1)
        });
      }
      rows.push(cells);
    }
    tables.push(expandGrid(rows));
  }
  return tables;
}

// Продолжения colspan-ячеек убираем: они повторяют текст соседней ячейки,
// а «склеивать» реально равные соседние цены (900 и 900) нельзя
function dedupeRow(row) {
  return row.filter(c => !c.colspanFill).map(c => c.text);
}

// ── Правила извлечения позиций ──────────────────────────────────
function mkItem(o) {
  return {
    group: o.group,
    title: o.title,
    variant: o.variant || '',
    price: o.price,
    priceOld: o.priceOld ?? null,
    unit: o.unit || '',
    note: o.note || '',
    sourceTrainer: o.sourceTrainer || ''
  };
}

// «Тренер | Программа, год обучения | Дни тренировок | Стоимость»
function fromTrainerTable(grid) {
  const headIdx = grid.findIndex(r => /тренер/i.test(dedupeRow(r).join(' ')) && /стоимость/i.test(dedupeRow(r).join(' ')));
  if (headIdx === -1) return [];
  const items = [];
  for (const raw of grid.slice(headIdx + 1)) {
    const row = dedupeRow(raw);
    const cells = row.map(c => c.trim());
    const priceCell = cells.find(c => /^\d[\d\s]*$/.test(c) || hasPrice(c));
    if (!priceCell) continue;
    const price = priceOf(priceCell) || Number(priceCell.replace(/\s+/g, ''));
    if (!price) continue;
    items.push(mkItem({
      group: GROUPS[0],
      title: stripFootnotes(cells[1] || cells[0]),
      variant: cells[2] || '',
      price,
      unit: '1 календарный месяц',
      note: 'Оплата до 5 числа',
      sourceTrainer: cells[0] || ''
    }));
  }
  return items;
}

// Матрица «кол-во тренировок × 55 мин / премиум / 80 мин»
function fromFitnessTable(grid) {
  const headIdx = grid.findIndex(r => /кол[-\s]?во тренировок/i.test(dedupeRow(r).join(' ')));
  if (headIdx === -1) return [];
  const header = dedupeRow(grid[headIdx]).filter(Boolean);
  const variants = header.slice(1).map(v => {
    const n = norm(v);
    if (/премиум/.test(n)) return 'Премиум 55 мин';
    if (/80/.test(n)) return '80 мин';
    if (/55/.test(n)) return '55 мин';
    return text(v);
  });

  const items = [];
  for (const raw of grid.slice(headIdx + 1)) {
    const row = dedupeRow(raw);
    const first = (row[0] || '').trim();
    if (!first) continue;
    const m = first.match(/^(\d+)\b(.*)$/);
    let title, dayGroup = false, single = false;
    if (m) {
      const n = Number(m[1]);
      const extra = norm(m[2] || '');
      title = `Абонемент ${n} ${plural(n, ['тренировка', 'тренировки', 'тренировок'])}`;
      if (/дневн/.test(extra)) {
        title += ' (дневная группа)';
        dayGroup = true;
      }
    } else {
      title = stripFootnotes(first);   // «Разовое занятие»
      single = true;
    }
    row.slice(1).forEach((cell, i) => {
      const value = (cell || '').trim();
      if (!value || /^[-–—]$/.test(value)) return;
      const price = Number(value.replace(/\s+/g, ''));
      if (!Number.isFinite(price)) return;
      items.push(mkItem({
        group: GROUPS[1],
        title,
        variant: variants[i] || '',
        price,
        unit: single ? '' : '60 дней',
        note: dayGroup
          ? 'Будни, начало не ранее 12:00 и не позднее 16:00. Дополнительная скидка 5% не предоставляется.'
          : ''
      }));
    });
  }
  return items;
}

// Склонение счётчика: 1 тренировка, 2 тренировки, 5 тренировок
function plural(n, forms) {
  const mod10 = n % 10, mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1];
  return forms[2];
}

// «услуга | цена | цена…» — персональные, массаж, аренда, виброплатформа
// conditional[] — собираем особые цены из сносок («3300 руб. (2800***)»),
// они уходят в скидки, а в позиции остаются пояснением.
function fromServiceTable(grid, footnotes, conditional) {
  const items = [];
  let pendingVariants = [];

  for (const raw of grid) {
    const row = dedupeRow(raw);
    const priceIdxs = row.map((c, i) => (hasPrice(c) ? i : -1)).filter(i => i !== -1);

    // Строка без цен — заголовок колонок-вариантов («55 мин | Сплит»)
    if (!priceIdxs.length) {
      const texts = row.filter(Boolean);
      if (texts.length >= 2) pendingVariants = row.slice(1).map(v => text(v)).filter(Boolean);
      continue;
    }

    const leading = row.slice(0, priceIdxs[0]).filter(Boolean);
    const title = stripFootnotes(leading[0] || '');
    if (!title) continue;

    priceIdxs.forEach((idx, k) => {
      const cell = row[idx];
      const price = priceOf(cell);
      if (!price) return;

      const before = cell.slice(0, cell.search(PRICE_RE)).replace(/[\s.,:;()–—-]+$/, '').trim();
      const after = cell.slice(cell.search(PRICE_RE) + cell.match(PRICE_RE)[0].length)
        .replace(/^[\s.,;/)–—-]+/, '').replace(/[.\s]+$/, '');

      const label = [before, after.replace(/^\/\s*/, '')].find(looksLikeLabel) || '';
      const variant = label
        || (leading.length > 1 && looksLikeLabel(leading[1]) ? stripFootnotes(leading[1]) : '')
        || (priceIdxs.length === pendingVariants.length ? pendingVariants[k] : '');

      const cond = conditionalOf(cell);
      let note = '';
      if (cond) {
        const why = footnotes[cond.marker] || '';
        note = `${cond.price} ₽ ${why}`.trim();
        conditional.push({ marker: cond.marker, why, itemKey: [guessServiceGroup(title, variant), title, variant].join('|') });
      }

      items.push(mkItem({
        group: guessServiceGroup(title, variant),
        title,
        variant,
        price,
        unit: /аренда/i.test(norm(title)) ? 'по согласованию' : '',
        note
      }));
    });
  }
  return items;
}

function guessServiceGroup(title, variant) {
  const n = norm(title + ' ' + variant);
  if (/массаж/i.test(n) && /категор/i.test(n)) return GROUPS[3];
  if (/аренда|виброплатформа|imbodi|посещение тренажер|самостоятельная тренировка/i.test(n)) return GROUPS[4];
  if (/персональн|детская|консультация|инструктаж|сплит/i.test(n)) return GROUPS[2];
  return GROUPS[4];
}

// ── Скидки и пояснения из текста прайса ──────────────────────────
function textBlocks(html) {
  const noTables = html.replace(/<table[\s\S]*?<\/table>/gi, ' ');
  return (noTables.match(/<p\b[^>]*>[\s\S]*?<\/p>/gi) || [])
    .map(text)
    .filter(Boolean);
}

function extractDiscounts(blocks, items) {
  const out = [];
  const fitness = (pred) => items
    .filter(i => i.group === GROUPS[1] && pred(norm(i.title)))
    .map(i => `${i.group}|${i.title}|${i.variant}`);

  // Скидка 5% на абонемент 4/8 + условия-буллеты.
  // Берём абзац, НАЧИНАЮЩИЙСЯ с «Скидка 5%…» — иначе можно схватить
  // пояснение про дневную группу, где «скидка 5%» упоминается внутри.
  const i5 = blocks.findIndex(b => /^скидка\s*5\s*%/i.test(b.trim()));
  if (i5 !== -1) {
    const cond = [blocks[i5]];
    for (let k = i5 + 1; k < blocks.length && /^[-–—]/.test(blocks[k]); k++) cond.push(blocks[k]);
    out.push({
      title: 'Скидка 5% на абонемент 4 / 8 тренировок',
      type: 'percent',
      value: 5,
      condition: cond.map(b => b.replace(/^[-–—]\s*/, '').replace(/[:;]\s*$/, '')).filter(Boolean).join('; '),
      appliesTo: fitness(t => /^абонемент (4|8)\b/.test(t) && !/дневн/.test(t))
    });
  }

  // 12 тренировок — 10% уже в цене
  const b12 = blocks.find(b => /абонемент\s*12/i.test(b) && /10\s*%/.test(b));
  if (b12) {
    out.push({
      title: 'Абонемент 12 тренировок: скидка 10% уже в цене',
      type: 'percent',
      value: 10,
      condition: b12.replace(/^\*+\s*/, ''),
      appliesTo: fitness(t => /абонемент 12/.test(t))
    });
  }

  // Бонус: одна бесплатная тренировка
  const bonusIdx = blocks.findIndex(b => /бонус/i.test(b));
  if (bonusIdx !== -1) {
    const parts = [];
    for (let k = bonusIdx; k < blocks.length && blocks[k].length; k++) {
      parts.push(blocks[k]);
      if (!/бонус|как получить|не предоставляется/i.test(blocks[k]) && parts.length > 3) break;
      if (/не предоставляется/i.test(blocks[k])) break;
    }
    out.push({
      title: 'Бонус — одна бесплатная тренировка',
      type: 'note',
      value: 0,
      condition: parts.join(' '),
      appliesTo: fitness(t => !/дневн/.test(t))
    });
  }

  // Дневная группа — пояснение
  const day = blocks.find(b => /дневная группа\s*[-–—]/i.test(b));
  if (day) {
    out.push({
      title: 'Дневная группа',
      type: 'note',
      value: 0,
      condition: day.replace(/^\*+\s*/, ''),
      appliesTo: fitness(t => /дневн/.test(t))
    });
  }

  // Первая тренировка бесплатно
  const first = blocks.find(b => /первая групповая тренировка/i.test(b));
  if (first) {
    out.push({
      title: 'Первая групповая тренировка — бесплатно',
      type: 'note',
      value: 0,
      condition: first,
      appliesTo: items.filter(i => i.group === GROUPS[1]).map(i => `${i.group}|${i.title}|${i.variant}`)
    });
  }

  if (!out.length) console.warn('⚠️  в тексте прайса не найдено ни одной скидки/пояснения — проверьте разметку документа');
  return out;
}

// ── Связи с программами и тренерами (только при первой вставке) ──
// Связываем уверенно и только там, где прайс называет программу прямо:
// тренерский абонемент — по названию в строке, массаж — по группе,
// персональные — «сплит» / «персональная». Остальное оставляем без связи,
// чтобы не плодить ложные привязки (их правит админка).
function guessProgramId(item, programs) {
  const n = norm(item.title + ' ' + item.variant);
  const find = (name) => {
    const hit = programs.find(p => norm(p.name) === norm(name));
    return hit ? hit.id : null;
  };

  if (item.group === GROUPS[0]) {
    const byName = programs
      .filter(p => norm(p.name).length > 3 && n.includes(norm(p.name)))
      .sort((a, b) => norm(b.name).length - norm(a.name).length)[0];
    return byName ? byName.id : null;
  }
  if (item.group === GROUPS[3]) return find('Массаж');
  if (item.group === GROUPS[2]) {
    if (/сплит/.test(n)) return find('Сплит');
    if (/персональн/.test(n)) return find('Персональные тренировки');
  }
  return null;
}

function guessTrainerId(item, trainers) {
  if (!item.sourceTrainer) return null;
  const surname = norm(item.sourceTrainer).split(' ')[0];
  if (!surname) return null;
  const hit = trainers.find(t => norm(t.name).includes(surname));
  return hit ? hit.id : null;
}

// ── Сборка из документа ──────────────────────────────────────────
// Сноски вида «(***при единовременной покупке 10 тренировок)» → маркер → текст условия
function footnotesOf(html) {
  const map = {};
  for (const m of text(html).matchAll(/\((\*{1,3})([^)]{3,160}?)\)/g)) {
    const marker = m[1], why = m[2].trim();
    if (!map[marker] || map[marker].length < why.length) map[marker] = why;
  }
  return map;
}

function parsePriceDoc(html) {
  const tables = parseTables(html);
  const footnotes = footnotesOf(html);
  const conditional = [];
  let items = [];

  for (const grid of tables) {
    const flat = norm(grid.map(r => r.map(c => c.text).join(' ')).join(' '));
    if (!flat) continue;
    if (/тренер.*программа.*стоимость/.test(flat)) items = items.concat(fromTrainerTable(grid));
    else if (/кол\s*во тренировок/.test(flat)) items = items.concat(fromFitnessTable(grid));
    else if (/персональн|массаж|аренда|виброплатформа/.test(flat)) items = items.concat(fromServiceTable(grid, footnotes, conditional));
  }

  // Особые цены по сноске → одна скидка-пояснение на условие
  const byMarker = new Map();
  for (const c of conditional) {
    if (!c.why) continue;
    const key = c.marker + '|' + c.why;
    if (!byMarker.has(key)) byMarker.set(key, { title: 'Скидка ' + c.why, type: 'note', value: 0, condition: c.why, appliesTo: [] });
    byMarker.get(key).appliesTo.push(c.itemKey);
  }

  const discounts = [...byMarker.values(), ...extractDiscounts(textBlocks(html), items)];
  return { items, discounts };
}

// ── Слияние с базой: правки админки не затираем ──────────────────
const keyOf = (i) => [i.group || '', i.title || '', i.variant || ''].join('|');

function mergeItems(existing, parsed, db) {
  const byKey = new Map(existing.map(e => [keyOf(e), e]));
  let nextId = existing.reduce((m, e) => Math.max(m, Number(e.id) || 0), 0) + 1;
  let maxOrder = existing.reduce((m, e) => Math.max(m, Number(e.order) || 0), 0);

  const added = [], updated = [], kept = [];
  const seen = new Set();

  for (const p of parsed) {
    const key = keyOf(p);
    seen.add(key);
    const prev = byKey.get(key);
    if (prev) {
      updated.push(key);
      Object.assign(prev, {
        group: p.group, title: p.title, variant: p.variant,
        price: p.price, priceOld: p.priceOld, unit: p.unit,
        note: p.note || prev.note || ''
      });
      kept.push(prev);
      continue;
    }
    const fresh = {
      id: nextId++,
      group: p.group,
      title: p.title,
      variant: p.variant,
      price: p.price,
      priceOld: p.priceOld,
      unit: p.unit,
      note: p.note,
      programId: guessProgramId(p, db.programs || []),
      trainerId: guessTrainerId(p, db.trainers || []),
      discountIds: [],
      visible: true,
      order: ++maxOrder,
      ...CRM_DEFAULTS
    };
    added.push(key);
    kept.push(fresh);
  }

  const dropped = existing.filter(e => !seen.has(keyOf(e)));
  const result = PRUNE ? kept : kept.concat(dropped);

  result.sort((a, b) =>
    (GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group)) ||
    (Number(a.order || 0) - Number(b.order || 0)) ||
    (String(a.title).localeCompare(String(b.title), 'ru'))
  );
  // Порядок внутри группы перенумеровываем — витрина читает именно его
  const counters = {};
  result.forEach(i => {
    counters[i.group] = (counters[i.group] || 0) + 1;
    i.order = counters[i.group];
  });

  return { items: result, added, updated, dropped: dropped.map(keyOf) };
}

// Возвращает { list, fresh }. fresh — скидки, которых в базе ещё нет: у них
// appliesTo приходит строковыми ключами позиций и переводится в id отдельно.
// Существующие скидки НЕ перезаписываем ссылками из прайса — привязки правит
// админка, повторный парсинг не должен их затирать.
function mergeDiscounts(existing, parsed) {
  const byKey = new Map(existing.map(e => [String(e.title).toLowerCase(), e]));
  let nextId = existing.reduce((m, e) => Math.max(m, Number(e.id) || 0), 0) + 1;
  let maxOrder = existing.reduce((m, e) => Math.max(m, Number(e.order) || 0), 0);
  const list = [], fresh = [];

  for (const p of parsed) {
    const prev = byKey.get(String(p.title).toLowerCase());
    if (prev) {
      prev.type = p.type;
      prev.value = p.value;
      prev.condition = p.condition;
      list.push(prev);
      continue;
    }
    const entry = {
      id: nextId++,
      title: p.title,
      type: p.type,
      value: p.value,
      condition: p.condition,
      appliesTo: [],
      visible: true,
      order: ++maxOrder
    };
    list.push(entry);
    fresh.push({ entry, keys: Array.isArray(p.appliesTo) ? p.appliesTo : [] });
  }
  // Скидки, которых нет в новом прайсе, сохраняем (админ мог добавить свою)
  existing.forEach(e => {
    if (!parsed.some(p => String(p.title).toLowerCase() === String(e.title).toLowerCase())) list.push(e);
  });

  list.sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
  list.forEach((d, i) => { d.order = i + 1; });
  return { list, fresh };
}

// Ключи «группа|title|variant» → id позиции (только для новых скидок)
function resolveAppliesTo(fresh, items) {
  const keyToId = new Map(items.map(i => [keyOf(i), i.id]));
  for (const { entry, keys } of fresh) {
    entry.appliesTo = keys.map(k => keyToId.get(k)).filter(id => id != null);
  }
}

// Обратная связь discountIds у позиций — по ней витрина рисует бейджи.
// Пересобираем по всему списку скидок: порядок скидок = источник истины.
function syncLinks(discounts, items) {
  items.forEach(i => { i.discountIds = []; });
  for (const d of discounts) {
    if (!Array.isArray(d.appliesTo)) d.appliesTo = [];
    for (const id of d.appliesTo) {
      const item = items.find(i => String(i.id) === String(id));
      if (item && !item.discountIds.includes(d.id)) item.discountIds.push(d.id);
    }
  }
}

// ── Запуск ───────────────────────────────────────────────────────
const inputPath = opt('--input') || opt('--html') || defaultInput();
if (!inputPath || !fs.existsSync(inputPath)) {
  console.error(`❌ Прайс-документ не найден: ${inputPath}\n   Укажите путь через --input "<файл.doc>"`);
  process.exit(1);
}

console.log(`📄 Источник прайса: ${inputPath}`);
const html = toHtml(inputPath);
const parsed = parsePriceDoc(html);

if (!parsed.items.length) {
  console.error('❌ Из документа не извлечена ни одна позиция — проверьте формат прайса');
  process.exit(1);
}

const db = flattenDb(JSON.parse(fs.readFileSync(dbPath, 'utf-8')));
const merged = mergeItems(db.priceItems || [], parsed.items, db);
// Порядок важен: сначала id скидок, затем перевод ключей в appliesTo,
// потом обратная discountIds — иначе в базу уходят null-ссылки.
const mergedDiscounts = mergeDiscounts(db.discounts || [], parsed.discounts);
resolveAppliesTo(mergedDiscounts.fresh, merged.items);
syncLinks(mergedDiscounts.list, merged.items);
const discounts = mergedDiscounts.list;

console.log(`\n=== Позиции прайса (${merged.items.length}) ===`);
for (const g of GROUPS) {
  const list = merged.items.filter(i => i.group === g);
  if (!list.length) continue;
  console.log(`\n${g}:`);
  for (const i of list) {
    const link = [
      i.programId ? `прогр:${i.programId}` : null,
      i.trainerId ? `трен:${i.trainerId}` : null
    ].filter(Boolean).join(' ');
    console.log(`  ${String(i.price).padStart(5)} ₽  ${i.title}${i.variant ? ' — ' + i.variant : ''}` +
      `${i.unit ? '  [' + i.unit + ']' : ''}${link ? '  {' + link + '}' : ''}`);
  }
}
const other = merged.items.filter(i => !GROUPS.includes(i.group));
if (other.length) console.log(`\n⚠️ вне известных групп: ${other.length}`);

console.log(`\n=== Скидки и пояснения (${discounts.length}) ===`);
for (const d of discounts) {
  console.log(`  ${d.type === 'percent' ? d.value + '%' : d.type} — ${d.title}` +
    `${d.appliesTo && d.appliesTo.length ? ' → ' + d.appliesTo.length + ' поз.' : ''}`);
}

console.log(`\nНовых позиций: ${merged.added.length}, обновлено: ${merged.updated.length}, ` +
  `не найдено в прайсе: ${merged.dropped.length}${PRUNE ? ' (удаляю)' : ' (оставляю)'}`);

if (!WRITE) {
  console.log('\n🔎 dry-run: db.json НЕ изменён. Для записи добавьте --write');
  process.exit(0);
}

if (!db.priceItems) db.priceItems = [];
db.priceItems = merged.items;
db.discounts = discounts;

const backup = path.join(root, 'backups', `db.json.backup.${Date.now()}`);
fs.mkdirSync(path.dirname(backup), { recursive: true });
fs.copyFileSync(dbPath, backup);
fs.writeFileSync(dbPath, JSON.stringify(nestDb(db), null, 2), 'utf-8');
console.log(`\n💾 Бэкап: ${backup}`);
console.log('✅ db.json обновлён (settings.priceItems, settings.discounts)');
