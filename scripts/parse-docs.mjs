#!/usr/bin/env node
/**
 * scripts/parse-docs.mjs
 *
 * Умный автопарсер .docx из static/data/trainers/ и static/data/programs/.
 *
 * Возможности:
 *   - Поддержка двух типов docx в одной папке:
 *     • "Описание.docx" / "Описание трен.docx" (общий файл)
 *     • "Именное.docx" (имя программы/тренера, например "Кравец Оксана.docx")
 *   - Если оба — парсит оба, объединяет данные (dedup расписания, объединение тренеров)
 *   - Если один — парсит то, что есть
 *   - Если нет ни одного — не добавляет из docx (если есть фото → создаёт как скрытый)
 *   - locked.png в папке → hidden: true
 *   - "СКРЫТЬ ЭТИ ДАННЫЕ" в docx → hidden: true
 *   - Папка только с фото → скрытый объект в db.json
 *   - Папка без фото и без docx → email-уведомление
 *   - Создание новых объектов из папок на диске, которых нет в db.json
 *
 *   npm run parse-docs            — заполняет только пустые поля
 *   npm run parse-docs -- --force — перезаписывает всё из документов
 *   npm run parse-docs -- --dry-run — только отчёт, без записи
 *   npm run parse-docs -- --no-email — не отправлять email
 *
 * Форматы документов программ:
 *   Новый: секции через «====»: название / описание / тренера / расписание / обложка / фото
 *   Старый: название, строки расписания (дни+время), описание, секция «Тренер(а)/Педагог»
 *
 * Формат документов тренеров: маркеры «ФИО:», «Стаж Ушу:», «Тренерский стаж:»,
 *   «Специализация:», «Образование:», «Девиз:» (могут слипаться в одну строку).
 */

import fs from 'fs';
import path from 'path';
import mammoth from 'mammoth';
import nodemailer from 'nodemailer';
import { fileURLToPath } from 'url';
import { flattenDb, nestDb } from './db-format.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const dataDir = path.join(root, 'static', 'data');
const dbPath = path.join(root, 'db.json');

const FORCE = process.argv.includes('--force');
const DRY_RUN = process.argv.includes('--dry-run');
const SEND_EMAIL = !process.argv.includes('--no-email');

const IMG_EXTS = ['.jpg', '.jpeg', '.png', '.webp'];
const DOCX_EXTS = ['.docx'];
const DAYS = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье', 'Воскресение'];
const DAYS_RE = new RegExp('(' + DAYS.join('|') + ')', 'gi');
const TIME_RE = /\d{1,2}[:.]\d{2}\s*[-–—]\s*\d{1,2}[:.]\d{2}/;
const PHOTO_RE = /\.(jpg|jpeg|png|webp)\b/i;
const HIDDEN_MARKER_RE = /СКРЫТЬ( ЭТИ ДАННЫЕ)?/i;

// Маппинг опечаток в названиях папок на диске → правильные имена в db.json
const NAME_FIXES = {
  'Гимнастика для шеи и органов чуств': 'Гимнастика для шеи и органов чувств',
  'ОФП УШУ (10+)': 'ОФП Ушу (10+)',
  'Растяжка': 'Растяжка',
  'Оздоровительное УШУ (6-12 лет)': 'Оздоровительное Ушу для детей (6-12 лет)',
  'Тайцзи-цигун': 'Тайцзи-Цигун',
  'Тайцзи-цюань': 'Тайцзи-Цюань',
  'Борьба': 'Греко-римская борьба',
  // Новое название программы (2026-10-29): «Основы работы с оружием» → «Координация…»
  'Координация. Основы работы с оружием в УШУ': 'Координация. Основы работы с оружием в УШУ',
  'Координация. Основы работы с оружием в ушу.': 'Координация. Основы работы с оружием в УШУ',
  'Основы работы с оружием': 'Координация. Основы работы с оружием в УШУ'
};

// Ключевые слова для определения типа docx
const GENERIC_DOCX_KEYWORDS = ['описание трен', 'описание.doc', 'описание', 'description'];

// ── Служебные папки диска (начинаются с запятой) ──────────────────────────
// Не являются сущностями, но их содержимое нужно маршрутизировать:
//   ,СОВМЕСТНЫЕ ФОТО → слайдер страницы тренеров + скрытые слайды главной
//   ,Фото тренеров   → альбом (категории)
//   ,Тренера архив   → тренеры hidden:true
const SERVICE_JOINT = 'СОВМЕСТНЫЕ ФОТО';
const SERVICE_TRAINER_ARCHIVE = 'Тренера архив';
const SERVICE_TRAINER_PHOTOS = 'Фото тренеров';
const PROGRAM_ARCHIVE_ROOT = 'Архив направлений, программ';
const ARCHIVE_SUBDIR = 'архив';

function isServiceFolder(name) {
  return /^\s*,/.test(String(name || ''));
}

// «,Фото тренеров » → «Фото тренеров»
function serviceBase(name) {
  return String(name || '').replace(/^\s*,\s*/, '').trim();
}

// Приоритет обложки: ГЛАВНОЕ ФОТО → coverFile из docx → имя папки → первое по алфавиту
function chooseCover(folderPath, imgFiles, coverFile) {
  if (!imgFiles || !imgFiles.length) return null;
  const main = imgFiles.find(f => /^главное\s*фото\.[a-z0-9]+$/i.test(f));
  if (main) return main;
  if (coverFile) {
    const want = String(coverFile).toLowerCase();
    const byDoc = imgFiles.find(f =>
      f.toLowerCase() === want ||
      path.parse(f).name.toLowerCase() === path.parse(want).name);
    if (byDoc) return byDoc;
  }
  const base = path.basename(folderPath).toLowerCase();
  const byFolder = imgFiles.find(f => path.parse(f).name.toLowerCase() === base);
  if (byFolder) return byFolder;
  return imgFiles[0];
}

// ============================================
// Утилиты
// ============================================

function log(msg) {
  const ts = new Date().toISOString().slice(0, 19);
  console.log(`[${ts}] ${msg}`);
  // Запись в лог-файл
  const logDir = path.join(dataDir);
  const logFile = path.join(logDir, '.parse-docs.log');
  try {
    fs.appendFileSync(logFile, `[${ts}] ${msg}\n`);
  } catch {}
}

function backupDB() {
  if (!fs.existsSync(dbPath)) return;
  const timestamp = Date.now();
  const backupPath = path.join(root, 'backups', `db.json.backup.${timestamp}`);
  const backupsDir = path.dirname(backupPath);
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }
  fs.copyFileSync(dbPath, backupPath);
  log(`💾 Бэкап: ${backupPath}`);
}

function readDb() {
  try {
    // S4: плоский или вложенный — обработчики работают с плоским
    return flattenDb(JSON.parse(fs.readFileSync(dbPath, 'utf-8')));
  } catch {
    return {};
  }
}

function writeDb(db) {
  // S4: всегда пишем вложенный формат (data.*/settings.*)
  fs.writeFileSync(dbPath, JSON.stringify(nestDb(db), null, 2), 'utf-8');
}

async function parseDocx(filePath) {
  try {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value.trim();
  } catch (err) {
    console.warn(`  ⚠️ Ошибка парсинга ${filePath}: ${err.message}`);
    return '';
  }
}

function normalizeName(name) {
  let normalized = (name || '')
    .trim()
    .replace(/\s+$/, '')
    .replace(/\s{2,}/g, ' ');
  // Служебный префикс папок: «в расписании нет    Основы массажа» → «Основы массажа»
  normalized = normalized.replace(/^в расписании нет\s+/i, '');
  if (NAME_FIXES[normalized]) normalized = NAME_FIXES[normalized];
  return normalized;
}

// Ключ ФИО: токены в нижнем регистре, отсортированы — «Иван Оберюхтин» == «Оберюхтин Иван»
function nameKey(name) {
  return normalizeName(name)
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(' ');
}

function findByName(list, name) {
  const normalized = normalizeName(name);
  let item = list.find(x => normalizeName(x.name) === normalized);
  if (!item) {
    const key = nameKey(name);
    item = list.find(x => nameKey(x.name) === key);
  }
  return item;
}

// Поиск тренера с прощением опечаток в отчестве и неполного ФИО
function findTrainerByName(list, name) {
  let item = findByName(list, name);
  if (item) return item;
  const toks = normalizeName(name).toLowerCase().split(/\s+/).filter(Boolean);
  if (toks.length < 2) return undefined;
  const key2 = toks.slice(0, 2).sort().join(' ');
  return list.find(x => {
    const xt = normalizeName(x.name).toLowerCase().split(/\s+/).filter(Boolean);
    return xt.slice(0, 2).sort().join(' ') === key2;
  });
}

// ============================================
// Сканирование папки: определение типа набора
// ============================================

function scanFolder(folderPath) {
  const entries = fs.readdirSync(folderPath);

  const docxFiles = entries.filter(f => DOCX_EXTS.includes(path.extname(f).toLowerCase()));
  // Стабильный порядок (ru) — чтобы «первое фото» было предсказуемым
  const imgFiles = entries
    .filter(f => IMG_EXTS.includes(path.extname(f).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, 'ru'));
  const hasLockedPng = entries.some(f => f.toLowerCase() === 'locked.png');

  // Разделяем docx на общие и именные
  let genericDocx = null;
  let namedDocx = null;

  for (const f of docxFiles) {
    const lower = f.toLowerCase();
    const isGeneric = GENERIC_DOCX_KEYWORDS.some(kw => lower.includes(kw));
    // Второй файл в папке нельзя терять: если «общий» уже занят, а новый файл
    // тоже подходит под ключевые слова («описание ТЦ утро.docx» +
    // «описание ТЦ КАВ КОБ.docx»), берём его как именной и сливаем оба.
    if (isGeneric && !genericDocx) {
      genericDocx = f;
    } else if (!namedDocx) {
      namedDocx = f;
    }
  }

  // Если оба типа есть — берём общий и именной
  // Если только один тип — берём его

  return {
    docxFiles,
    genericDocx,    // "Описание.docx" / "Описание трен.docx"
    namedDocx,      // "Кравец Оксана.docx" и т.п.
    imgFiles,
    hasLockedPng
  };
}

// ============================================
// Парсер расписания (существующий, рабочий)
// ============================================

const DAY_ALT = DAYS.join('|');
const DAY_RE_SRC = '(' + DAY_ALT + ')';

function normDay(day) {
  return /^воскрес/i.test(day)
    ? 'Воскресенье'
    : day.charAt(0).toUpperCase() + day.slice(1).toLowerCase();
}

function extractSchedule(text) {
  const slots = [];
  const consumedLines = [];

  const lines = text.split(/\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (!new RegExp(DAY_RE_SRC, 'i').test(trimmed) || !TIME_RE.test(trimmed)) continue;

    consumedLines.push(trimmed);

    for (const seg of trimmed.split(';')) {
      if (!seg.trim()) continue;

      const times = [];
      const tre = new RegExp(TIME_RE.source, 'g');
      let tm;
      while ((tm = tre.exec(seg)) !== null) {
        times.push({ time: tm[0].replace(/\s+/g, ''), start: tm.index, end: tm.index + tm[0].length });
      }
      if (!times.length) continue;

      const dre = new RegExp(DAY_RE_SRC, 'gi');
      let prevEnd = 0;
      for (let i = 0; i < times.length; i++) {
        const t = times[i];
        const chunk = seg.slice(prevEnd, t.start);
        const days = [];
        let dm;
        dre.lastIndex = 0;
        while ((dm = dre.exec(chunk)) !== null) days.push(dm[1]);

        const after = i === times.length - 1 ? seg.slice(t.end) : seg.slice(t.end, times[i + 1].start);
        const place = after
          .replace(new RegExp(DAY_RE_SRC, 'gi'), '')
          .replace(/^[,.\s:;]+|[,.\s:;]+$/g, '')
          .trim();

        for (const day of days) slots.push({ day: normDay(day), time: t.time, place });
        prevEnd = t.end;
      }
    }
  }

  // Дедупликация
  const seen = new Set();
  const unique = slots.filter(s => {
    const k = `${s.day}|${s.time}|${s.place}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return { slots: unique, consumedLines };
}

// ============================================
// Парсер программы
// ============================================

function splitTrainerNames(text) {
  return text
    .split(/[,\n;]|\s{2,}/)
    .map(s => s.trim().replace(/[.\s]+$/, ''))
    .filter(s => s.length > 2 && /[а-яёa-z]/i.test(s) && !/^(тренера?|педагоги?)$/i.test(s))
    .filter(s => s.split(/\s+/).length >= 2 || /^[А-ЯЁA-Z][а-яёa-z]+$/.test(s));
}

// Слитные маркеры программы: «ТренерКузнецов Александр» → «Тренер\nКузнецов Александр»
function splitGluedMarkers(text) {
  return String(text)
    .replace(/(?<!^)(?<!\n)\s*(Тренер|Тренера|Педагог)(?=[А-ЯЁ][а-яё])/g, '\n$1\n');
}

function parseProgramDoc(text) {
  const result = {
    title: '',
    description: '',
    trainers: [],
    scheduleStructured: [],
    coverFile: '',
    photoFiles: [],
    hidden: false
  };

  // Слитные маркеры: «ТренерКузнецов Александр» → «Тренер\nКузнецов Александр»
  text = splitGluedMarkers(text);

  // Проверка на скрытие
  if (HIDDEN_MARKER_RE.test(text)) {
    result.hidden = true;
  }

  if (text.includes('====')) {
    // ── Новый формат: секции через ==== ──
    const sections = text.split(/={3,}/).map(s => s.trim()).filter(Boolean);

    result.title = sections[0] || '';

    let scheduleIdx = -1, coverIdx = -1, photosIdx = -1;
    sections.forEach((s, i) => {
      if (i === 0) return;
      if (/\.(jpg|jpeg|png|webp)\s*::/i.test(s)) { photosIdx = i; return; }
      if (/^\s*\S.*\.(jpg|jpeg|png|webp)\s*$/i.test(s) && !s.includes('\n')) { coverIdx = i; return; }
      DAYS_RE.lastIndex = 0;
      if (scheduleIdx === -1 && DAYS_RE.test(s) && TIME_RE.test(s)) scheduleIdx = i;
    });

    const { slots } = extractSchedule(scheduleIdx >= 0 ? sections[scheduleIdx] : '');
    result.scheduleStructured = slots;

    if (coverIdx >= 0) result.coverFile = sections[coverIdx].trim();
    if (photosIdx >= 0) {
      result.photoFiles = sections[photosIdx]
        .split(';')
        .map(s => s.trim())
        .filter(Boolean)
        .map(s => {
          const [file, caption] = s.split('::');
          return { file: (file || '').trim(), caption: (caption || '').trim() };
        })
        .filter(p => p.file && PHOTO_RE.test(p.file));
    }

    const specialIdxs = new Set([scheduleIdx, coverIdx, photosIdx].filter(i => i > 0));
    const textIdxs = sections
      .map((s, i) => i)
      .filter(i => i > 0 && !specialIdxs.has(i));

    if (textIdxs.length >= 2) {
      result.description = textIdxs.slice(0, -1).map(i => sections[i]).join('\n\n').trim();
      result.trainers = splitTrainerNames(sections[textIdxs[textIdxs.length - 1]]);
    } else if (textIdxs.length === 1) {
      result.description = sections[textIdxs[0]];
    }
  } else {
    // ── Старый формат ──
    const lines = text.split(/\n/);
    result.title = (lines.find(l => l.trim()) || '').trim();

    const { slots, consumedLines } = extractSchedule(text);
    result.scheduleStructured = slots;
    const consumedSet = new Set(consumedLines);

    const trainerMarkerRe = /^\s*(тренера?|педагоги?)\s*:?\s*$/i;
    let markerLineIdx = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
      if (trainerMarkerRe.test(lines[i])) { markerLineIdx = i; break; }
    }

    const descLines = [];
    const trainerLines = [];
    for (let i = 1; i < lines.length; i++) {
      const t = lines[i].trim();
      if (i === markerLineIdx) continue;
      if (markerLineIdx >= 0 && i > markerLineIdx) {
        if (t) trainerLines.push(t);
        continue;
      }
      if (!t) { descLines.push(''); continue; }
      if (consumedSet.has(t)) continue;
      if (t === result.title) continue;
      descLines.push(t);
    }
    result.description = descLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    result.trainers = splitTrainerNames(trainerLines.join('\n'));
  }

  return result;
}

// ============================================
// Парсер тренера
// ============================================

function parseTrainerDoc(text) {
  const result = {
    fio: '', experienceUshu: '', experienceCoach: '',
    specialization: '', education: '', motto: '',
    hidden: false
  };

  if (HIDDEN_MARKER_RE.test(text)) {
    result.hidden = true;
  }

  const markers = ['ФИО:', 'Стаж Ушу:', 'Стаж УШУ:', 'Стаж ушу:', 'Тренерский стаж', 'Специализация:', 'Образование:', 'Девиз:'];
  let normalized = text;
  for (const m of markers) {
    const re = new RegExp('(?<!^)(?<!\\n)(' + m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'g');
    normalized = normalized.replace(re, '\n$1');
  }
  normalized = normalized.replace(/Тренерский стаж\s*:/g, 'Тренерский стаж:');

  const sectionRe = /^(ФИО|Стаж Ушу|Стаж УШУ|Стаж ушу|Тренерский стаж|Специализация|Образование|Девиз)\s*:?\s*(.*)$/;
  let current = null;
  const buckets = {};

  for (const line of normalized.split('\n')) {
    const m = line.trim().match(sectionRe);
    if (m) {
      current = m[1].replace(/УШУ|ушу/, 'Ушу');
      if (!buckets[current]) buckets[current] = [];
      if (m[2].trim()) buckets[current].push(m[2].trim());
    } else if (current && line.trim()) {
      buckets[current].push(line.trim());
    }
  }

  const join = k => (buckets[k] || []).join('\n').trim();

  result.fio = join('ФИО');
  result.experienceUshu = join('Стаж Ушу');
  result.experienceCoach = join('Тренерский стаж');
  result.specialization = join('Специализация');
  result.motto = join('Девиз');
  result.education = join('Образование');

  if (result.motto) {
    result.motto = result.motto.split(/\n\n/)[0].replace(/^["«„]|["»“]\s*$/g, '').trim();
  }

  return result;
}

/**
 * Описание тренера для сайта: текст без строк ФИО/Девиз
 */
function cleanTrainerDescription(text) {
  const lines = text.split('\n');
  const out = [];
  let skip = false;
  for (const line of lines) {
    const t = line.trim();
    if (/^Девиз\s*:/i.test(t)) { skip = true; continue; }
    if (/^ФИО\s*:/i.test(t)) continue;
    if (!skip) out.push(line);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// ============================================
// Слияние результатов парсинга двух docx
// ============================================

function mergeProgramParsed(generic, named) {
  if (!generic && named) return named;
  if (generic && !named) return generic;
  if (!generic && !named) return null;

  const merged = {
    title: generic.title || named.title || '',
    description: mergeDescriptions(generic.description, named.description),
    trainers: [...new Set([...(generic.trainers || []), ...(named.trainers || [])])],
    scheduleStructured: mergeSchedule(generic.scheduleStructured, named.scheduleStructured),
    coverFile: generic.coverFile || named.coverFile || '',
    photoFiles: [...(generic.photoFiles || []), ...(named.photoFiles || [])],
    hidden: generic.hidden || named.hidden
  };
  return merged;
}

function mergeDescriptions(desc1, desc2) {
  // Берём наиболее полный/длинный
  if (!desc1 && !desc2) return '';
  if (!desc1) return desc2;
  if (!desc2) return desc1;
  // Если оба есть — объединяем, если отличаются
  const combined = [desc1, desc2].filter(Boolean);
  if (combined.length === 1) return combined[0];
  // Если один длиннее другого в 2 раза — берём длинный
  if (desc1.length >= desc2.length * 2) return desc1;
  if (desc2.length >= desc1.length * 2) return desc2;
  // Иначе — первый (предпочитаем generic как более стабильный)
  return desc1;
}

function mergeSchedule(slots1, slots2) {
  // Объединяем с dedup по day+time
  const seen = new Map();
  for (const s of (slots1 || [])) {
    const key = `${s.day}|${s.time}`;
    if (!seen.has(key)) seen.set(key, { ...s });
  }
  for (const s of (slots2 || [])) {
    const key = `${s.day}|${s.time}`;
    if (seen.has(key)) {
      // Обновляем place если новый не пустой
      if (s.place && !seen.get(key).place) {
        seen.get(key).place = s.place;
      }
    } else {
      seen.set(key, { ...s });
    }
  }
  return Array.from(seen.values());
}

function mergeTrainerParsed(generic, named) {
  if (!generic && named) return named;
  if (generic && !named) return generic;
  if (!generic && !named) return null;

  return {
    fio: generic.fio || named.fio || '',
    experienceUshu: generic.experienceUshu || named.experienceUshu || '',
    experienceCoach: generic.experienceCoach || named.experienceCoach || '',
    specialization: generic.specialization || named.specialization || '',
    education: generic.education || named.education || '',
    motto: generic.motto || named.motto || '',
    hidden: generic.hidden || named.hidden
  };
}

// ============================================
// Email-уведомления
// ============================================

function getMissingPhotos(db) {
  const missing = [];

  // Проверяем тренеров
  for (const t of (db.trainers || [])) {
    if (t.hidden) continue;
    if (t.image) continue;
    missing.push({ type: 'тренер', name: t.name, issue: 'Нет фото-обложки' });
  }

  // Проверяем программы
  for (const p of (db.programs || [])) {
    if (p.hidden) continue;
    if (p.image) continue;
    missing.push({ type: 'программа', name: p.name, issue: 'Нет фото-обложки' });
  }

  return missing;
}

function getUnfilledFolders(db, baseDir, type) {
  const missing = [];
  const folderNames = new Set();

  // Собираем имена из db.json
  const list = db[type] || [];
  for (const item of list) {
    folderNames.add(normalizeName(item.name));
  }

  // Сканируем папки
  if (!fs.existsSync(baseDir)) return missing;

  const items = fs.readdirSync(baseDir).filter(f => {
    const fp = path.join(baseDir, f);
    return fs.statSync(fp).isDirectory();
  });

  for (const folder of items) {
    const normalized = normalizeName(folder);
    if (folderNames.has(normalized)) continue;

    const folderPath = path.join(baseDir, folder);
    const scanned = scanFolder(folderPath);

    if (scanned.docxFiles.length > 0) {
      // Есть docx — объект должен быть в базе, но его нет → создадим
      missing.push({ type, name: normalized, issue: 'Объект на диске, но не в базе (создастся)', folder });
    } else if (scanned.imgFiles.length > 0) {
      // Только фото → создадим скрытый
      missing.push({ type, name: normalized, issue: 'Только фото, будет скрытым', folder });
    } else {
      // Пустая папка → уведомление
      missing.push({ type, name: normalized, issue: 'Нет docx и нет фото', folder });
    }
  }

  return missing;
}

async function sendEmailNotification(missing, db) {
  if (!missing.length) {
    log('  📧 Нет объектов для уведомления — email не отправляем');
    return;
  }

  const emailConfig = db.emailConfig || {};
  const smtpHost = emailConfig.smtpHost || 'smtp.yandex.ru';
  const smtpPort = emailConfig.smtpPort || 465;
  const smtpSecure = emailConfig.smtpSecure !== false;
  const smtpUser = emailConfig.smtpUser;
  const smtpPass = emailConfig.smtpPass;
  const fromName = emailConfig.fromName || 'Робот-Автопарсер';
  const adminEmail = emailConfig.adminEmail;
  const errorEmail = emailConfig.errorEmail || [];

  if (!smtpUser || !smtpPass || !adminEmail) {
    log('  ⚠️ SMTP-настройки неполные — выводим список в консоль');
    console.log('\n=== НЕЗАПОЛНЕННЫЕ ОБЪЕКТЫ ===');
    for (const m of missing) {
      console.log(`- ${m.type}: ${m.name} — ${m.issue}`);
    }
    console.log('=============================\n');
    return;
  }

  // Формируем тело письма
  let body = 'Уважаемые Коллеги!\nПросьба дозаполнить:\n';
  for (const m of missing) {
    body += `- ${m.type === 'тренер' ? 'Тренер' : 'Программа'} "${m.name}" — ${m.issue}.\n`;
  }
  body += '\nС Уважением, Ваш Робот-Автопарсер центр-фр.рф.';

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: { user: smtpUser, pass: smtpPass }
  });

  const recipients = [adminEmail, ...errorEmail].filter(Boolean);

  try {
    await transporter.sendMail({
      from: `"${fromName}" <${smtpUser}>`,
      to: recipients.join(', '),
      subject: 'Автоматическое заполнение сайта - уведомление о незаполненных объектах',
      text: body
    });
    log(`  📧 Email отправлен: ${recipients.join(', ')}, объектов: ${missing.length}`);
  } catch (err) {
    log(`  ⚠️ Ошибка отправки email: ${err.message}`);
    console.log('\n=== НЕЗАПОЛНЕННЫЕ ОБЪЕКТЫ (email не отправлен) ===');
    for (const m of missing) {
      console.log(`- ${m.type}: ${m.name} — ${m.issue}`);
    }
    console.log('===================================================\n');
  }
}

// ============================================
// Рекурсивный сбор «листовых» папок сущностей
// ============================================

function listSubdirs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => {
    try { return fs.statSync(path.join(dir, f)).isDirectory(); } catch { return false; }
  });
}

/**
 * Рекурсивно собрать листовые папки сущностей.
 *   - Лист = папка, где есть docx или картинки (folderName = имя сущности).
 *   - Папка без docx/фото, но с подпапками → recurse (категории, «архив»,
 *     архивные корни). Имя сущности наследуется от родителя, если спускаемся
 *     в подпапку «архив» (чтобы не появилось сущности «архив»).
 *   - Пустая папка (ни docx, ни фото, ни подпапок) → лист isEmpty:true, hidden:true.
 *   - Папка «архив» (в любой позиции) → всё её содержимое hidden:true.
 */
function collectEntityFolders(rootDir, { hidden = false, category = null, entityName = null } = {}) {
  const out = [];
  if (!fs.existsSync(rootDir)) return out;
  const base = path.basename(rootDir);
  const isArchiveDir = /^архив$/i.test(base.trim());
  hidden = hidden || isArchiveDir;

  const entries = fs.readdirSync(rootDir);
  const hasDocx = entries.some(f => DOCX_EXTS.includes(path.extname(f).toLowerCase()));
  const hasImg = entries.some(f => IMG_EXTS.includes(path.extname(f).toLowerCase()));
  const subs = entries.filter(f => {
    try { return fs.statSync(path.join(rootDir, f)).isDirectory(); } catch { return false; }
  });

  if (hasDocx || hasImg) {
    out.push({ folderPath: rootDir, folderName: entityName || base, category, hidden, isEmpty: false });
  } else if (subs.length === 0) {
    // Пустая папка → в архив + «требует внимания»
    out.push({ folderPath: rootDir, folderName: entityName || base, category, hidden: true, isEmpty: true });
  } else {
    for (const sub of subs) {
      const subIsArchive = /^архив$/i.test(sub.trim());
      out.push(...collectEntityFolders(path.join(rootDir, sub), {
        hidden,
        category,
        // спуск в «архив» не меняет имя сущности; иначе — имя = имя подпапки
        entityName: subIsArchive ? (entityName || base) : sub
      }));
    }
  }
  return out;
}

// ============================================
// Обработка тренеров
// ============================================

async function processTrainers(db) {
  const dir = path.join(dataDir, 'trainers');
  if (!fs.existsSync(dir)) return { updated: 0, created: 0, hidden: 0, missing: [], attention: [] };
  let updated = 0, created = 0, hidden = 0;
  const missing = [];
  const attention = [];

  const topDirs = listSubdirs(dir);

  // Собираем «листья»: обычные папки тренеров + содержимое архива тренеров
  const leaves = [];
  for (const name of topDirs) {
    if (isServiceFolder(name)) {
      const base = serviceBase(name);
      if (/^Тренера архив/i.test(base)) {
        // Архивные тренеры → hidden:true
        leaves.push(...collectEntityFolders(path.join(dir, name), { hidden: true }));
      }
      // «СОВМЕСТНЫЕ ФОТО» и «Фото тренеров » → альбом/слайдер (обрабатываются build-album.mjs)
      continue;
    }
    leaves.push(...collectEntityFolders(path.join(dir, name), { hidden: false }));
  }

  log(`\n📂 Тренеры: ${topDirs.length} папок верхнего уровня, ${leaves.length} сущностей`);

  for (const leaf of leaves) {
    const folderPath = leaf.folderPath;
    const folderName = leaf.folderName;
    const scanned = scanFolder(folderPath);

    // Определяем скрытие
    let shouldBeHidden = leaf.hidden;
    if (scanned.hasLockedPng) {
      shouldBeHidden = true;
      log(`  🔒 ${folderName} — locked.png → hidden`);
    }
    if (leaf.isEmpty) {
      attention.push({ type: 'тренер', name: normalizeName(folderName), issue: 'Пустая папка (в архиве)' });
      log(`  ⚠️ ${folderName} — пустая папка → архив + внимание`);
    }

    // Создаём/находим объект
    let trainer = findByName(db.trainers || [], folderName);

    if (!trainer) {
      if (scanned.docxFiles.length > 0 || leaf.isEmpty) {
        // Есть docx (или пустая папка в архиве) → создаём
        trainer = {
          id: (db.trainers || []).length + 1,
          name: normalizeName(folderName),
          hidden: shouldBeHidden
        };
        if (leaf.isEmpty) trainer.needsAttention = true;
        db.trainers.push(trainer);
        created++;
        log(`  ✨ Создан тренер: ${trainer.name}${shouldBeHidden ? ' (скрыт)' : ''}`);
      } else if (scanned.imgFiles.length > 0) {
        // Только фото → создаём скрытый
        trainer = {
          id: (db.trainers || []).length + 1,
          name: normalizeName(folderName),
          hidden: true,
          photoAlbum: scanned.imgFiles.map(f => ({ image: `uploads/${f}`, caption: '' }))
        };
        db.trainers.push(trainer);
        hidden++;
        log(`  🙈 Создан скрытый тренер (только фото): ${trainer.name}`);
      } else {
        missing.push({ type: 'тренер', name: normalizeName(folderName), issue: 'Нет docx и нет фото' });
        log(`  ⏭️  ${folderName} — пусто (нет docx и фото)`);
        continue;
      }
    } else {
      if (shouldBeHidden) {
        trainer.hidden = true;
        log(`  🔒 ${folderName} → hidden`);
      }
    }

    // Парсим docx
    if (scanned.genericDocx || scanned.namedDocx) {
      let genericParsed = null;
      let namedParsed = null;
      let genericText = '';
      let namedText = '';

      if (scanned.genericDocx) {
        genericText = await parseDocx(path.join(folderPath, scanned.genericDocx));
        if (genericText) genericParsed = parseTrainerDoc(genericText);
        else log(`  ⚠️ ${folderName}: "${scanned.genericDocx}" пуст/не прочитан`);
      }

      if (scanned.namedDocx) {
        namedText = await parseDocx(path.join(folderPath, scanned.namedDocx));
        if (namedText) namedParsed = parseTrainerDoc(namedText);
        else log(`  ⚠️ ${folderName}: "${scanned.namedDocx}" пуст/не прочитан`);
      }

      const merged = mergeTrainerParsed(genericParsed, namedParsed);

      if (merged) {
        let changed = false;

        const structFields = ['experienceUshu', 'experienceCoach', 'education', 'motto'];
        for (const f of structFields) {
          if (merged[f] && trainer[f] !== merged[f]) {
            trainer[f] = merged[f];
            changed = true;
          }
        }
        if (merged.specialization && (!trainer.specialization || FORCE)) {
          trainer.specialization = merged.specialization;
          changed = true;
        }
        if (merged.hidden) {
          trainer.hidden = true;
          changed = true;
          log(`  🔒 ${folderName} — "СКРЫТЬ" в docx → hidden`);
        }
        if (!trainer.experience && merged.experienceUshu) {
          trainer.experience = merged.experienceUshu;
          changed = true;
        }
        if (!trainer.description || FORCE) {
          trainer.description = cleanTrainerDescription(genericText + '\n' + namedText);
          changed = true;
        }

        // Обложка: только если её ещё нет. Готовые кропы из
        // static/uploads/covers/ (match-photos) не перетираем сырым файлом —
        // иначе на сайт уедет полноразмерный снимок вместо сжатого.
        if (!trainer.image) {
          const cover = chooseCover(folderPath, scanned.imgFiles, merged.coverFile);
          if (cover) {
            trainer.image = `/uploads/${cover}`;
            changed = true;
            log(`  📸 ${trainer.name}: обложка из ${cover}`);
          }
        }

        if (changed) {
          updated++;
          const tags = structFields.filter(f => merged[f]).length;
          log(`  ✅ ${trainer.name} — структ. полей: ${tags}${scanned.genericDocx && scanned.namedDocx ? ' (2 docx)' : ''}`);
        }
      }
    } else if (scanned.imgFiles.length > 0) {
      // Нет docx, но есть фото → добавляем фото в photoAlbum
      if (!trainer.photoAlbum) trainer.photoAlbum = [];
      for (const img of scanned.imgFiles) {
        if (!trainer.photoAlbum.find(a => a.image === `uploads/${img}`)) {
          trainer.photoAlbum.push({ image: `uploads/${img}`, caption: '' });
        }
      }
      if (!trainer.image) {
        const cover = chooseCover(folderPath, scanned.imgFiles, trainer.coverFile);
        if (cover) {
          trainer.image = `uploads/${cover}`;
          log(`  📸 ${trainer.name}: обложка из ${cover}`);
        }
      }
    }
  }

  return { updated, created, hidden, missing, attention };
}

// ============================================
// Обработка программ
// ============================================

async function processPrograms(db) {
  const dir = path.join(dataDir, 'programs');
  if (!fs.existsSync(dir)) return { updated: 0, created: 0, hidden: 0, missing: [], attention: [] };
  let updated = 0, created = 0, hidden = 0;
  const missing = [];
  const attention = [];

  const categories = listSubdirs(dir);

  // Собираем «листья»: обычные программы (категория/программа) + архивы
  const leaves = [];
  for (const cat of categories) {
    const catDir = path.join(dir, cat);
    if (/^Архив/i.test(cat.trim())) {
      // Архив направлений, программ → всё содержимое hidden:true.
      // category=null: не перетирать существующую категорию программы.
      leaves.push(...collectEntityFolders(catDir, { hidden: true, category: null }));
      continue;
    }
    for (const name of listSubdirs(catDir)) {
      leaves.push(...collectEntityFolders(path.join(catDir, name), { hidden: false, category: cat }));
    }
  }

  // Дубль-папки на диске (старое имя рядом с новым, «Растяжка » с пробелом,
  // архивная копия рядом с обычной) ведут к одной программе — обрабатываем
  // её один раз, чтобы не перезаписывать поля дважды.
  // Сначала обычные папки, потом архивные: копия в «архив/» не должна скрывать
  // программу, у которой есть живая папка.
  const processedIds = new Set();
  leaves.sort((a, b) => Number(!!a.hidden) - Number(!!b.hidden));

  log(`\n📂 Программы: ${categories.length} категорий, ${leaves.length} сущностей`);

  for (const leaf of leaves) {
    const folderPath = leaf.folderPath;
    const folderName = leaf.folderName;
    const cat = leaf.category;
    const scanned = scanFolder(folderPath);

    let shouldBeHidden = leaf.hidden;
    if (scanned.hasLockedPng) {
      shouldBeHidden = true;
      log(`  🔒 ${folderName} — locked.png → hidden`);
    }
    if (leaf.isEmpty) {
      attention.push({ type: 'программа', name: normalizeName(folderName), issue: 'Пустая папка (в архиве)' });
      log(`  ⚠️ ${folderName} — пустая папка → архив + внимание`);
    }

    const normalizedName = normalizeName(folderName);
    let program = findByName(db.programs || [], normalizedName);

    // Уже обработан по другой папке-дублю — второй проход не нужен
    if (program && processedIds.has(program.id)) continue;

    if (!program) {
      if (scanned.docxFiles.length > 0 || leaf.isEmpty) {
        program = {
          id: (db.programs || []).length + 1,
          name: normalizedName,
          category: cat,
          hidden: shouldBeHidden
        };
        if (leaf.isEmpty) program.needsAttention = true;
        db.programs.push(program);
        created++;
        log(`  ✨ Создана программа: ${program.name}${shouldBeHidden ? ' (скрыта)' : ''}`);
      } else if (scanned.imgFiles.length > 0) {
        program = {
          id: (db.programs || []).length + 1,
          name: normalizedName,
          category: cat,
          hidden: true,
          photoAlbum: scanned.imgFiles.map(f => ({ image: `uploads/${f}`, caption: '' }))
        };
        db.programs.push(program);
        hidden++;
        log(`  🙈 Создана скрытая программа (только фото): ${program.name}`);
      } else {
        missing.push({ type: 'программа', name: normalizedName, issue: 'Нет docx и нет фото' });
        log(`  ⏭️  ${folderName} — пусто (нет docx и фото)`);
        continue;
      }
    } else {
      if (cat && program.category !== cat) program.category = cat;
      if (shouldBeHidden) {
        program.hidden = true;
        log(`  🔒 ${folderName} → hidden`);
      }
    }

    processedIds.add(program.id);

    // Парсим docx
    if (scanned.genericDocx || scanned.namedDocx) {
      let genericParsed = null;
      let namedParsed = null;

      if (scanned.genericDocx) {
        const genericText = await parseDocx(path.join(folderPath, scanned.genericDocx));
        if (genericText) genericParsed = parseProgramDoc(genericText);
        else log(`  ⚠️ ${folderName}: "${scanned.genericDocx}" пуст/не прочитан`);
      }

      if (scanned.namedDocx) {
        const namedText = await parseDocx(path.join(folderPath, scanned.namedDocx));
        if (namedText) namedParsed = parseProgramDoc(namedText);
        else log(`  ⚠️ ${folderName}: "${scanned.namedDocx}" пуст/не прочитан`);
      }

      const merged = mergeProgramParsed(genericParsed, namedParsed);

      if (merged) {
        let changed = false;

        // Переименование программы на диске («Основы работы с оружием» →
        // «Координация. Основы работы с оружием в УШУ»): обновляем name в базе
        // и в составе направлений, иначе сайт показывает старое имя.
        if (normalizedName && program.name !== normalizedName) {
          log(`  ✏️  ${program.name} → ${normalizedName}`);
          program.name = normalizedName;
          for (const d of db.directions || []) {
            for (const dp of d.programs || []) {
              if (String(dp.id) === String(program.id)) dp.name = normalizedName;
            }
          }
          changed = true;
        }

        if (merged.scheduleStructured.length) {
          program.scheduleStructured = merged.scheduleStructured;
          changed = true;
        }
        if (merged.trainers.length) {
          program.trainers = merged.trainers.map(tn => {
            const t = findTrainerByName(db.trainers || [], tn);
            return { name: tn, id: t ? t.id : null };
          });
          changed = true;
        }
        if (merged.coverFile) {
          program.coverFile = merged.coverFile;
          changed = true;
        }
        if (merged.photoFiles.length) {
          program.photoFiles = merged.photoFiles;
          changed = true;
        }
        if (merged.hidden) {
          program.hidden = true;
          changed = true;
          log(`  🔒 ${program.name} — "СКРЫТЬ" в docx → hidden`);
        }
        if (!program.description || FORCE) {
          program.description = merged.description;
          changed = true;
        }

        if (changed) {
          updated++;
          log(`  ✅ ${program.name}: расписание=${merged.scheduleStructured.length}, тренеры=${merged.trainers.length}${scanned.genericDocx && scanned.namedDocx ? ' (2 docx)' : ''}`);
        }
      }
    } else if (scanned.imgFiles.length > 0) {
      if (!program.photoAlbum) program.photoAlbum = [];
      for (const img of scanned.imgFiles) {
        if (!program.photoAlbum.find(a => a.image === `uploads/${img}`)) {
          program.photoAlbum.push({ image: `uploads/${img}`, caption: '' });
        }
      }
      if (!program.image) {
        const cover = chooseCover(folderPath, scanned.imgFiles, program.coverFile);
        if (cover) {
          program.image = `uploads/${cover}`;
          log(`  📸 ${program.name}: обложка из ${cover}`);
        }
      }
    }
  }

  return { updated, created, hidden, missing, attention };
}

// ============================================
// main
// ============================================

async function main() {
  log('='.repeat(60));
  log(`🔍 Умный автопарсер документов .docx ${FORCE ? '(--force)' : ''}${DRY_RUN ? '(--dry-run)' : ''}${SEND_EMAIL ? '' : '(--no-email)'}`);
  log('='.repeat(60));

  const db = readDb();
  if (!db.trainers || !db.programs) {
    console.error('❌ В db.json нет trainers или programs');
    process.exit(1);
  }

  // 1. Парсим тренеров
  log('\n📋 Шаг 1: Обработка тренеров...');
  const trainerResult = await processTrainers(db);

  // 2. Парсим программы
  log('\n📋 Шаг 2: Обработка программ...');
  const programResult = await processPrograms(db);

  // 3. Проверяем незаполненные объекты в базе
  log('\n📋 Шаг 3: Проверка незаполненных объектов в базе...');
  const baseMissing = getMissingPhotos(db);
  if (baseMissing.length) {
    log(`  ⚠️ Найдено ${baseMissing.length} объектов без фото в базе`);
    for (const m of baseMissing) {
      log(`    - ${m.type}: ${m.name} — ${m.issue}`);
    }
  }

  // 4. Собираем «требующие внимания» (пустые папки, автосозданные записи)
  log('\n📋 Шаг 4: Объекты, требующие внимания...');
  const attention = [...(trainerResult.attention || []), ...(programResult.attention || [])];
  if (attention.length) {
    for (const a of attention) log(`  ⚠️ ${a.type}: ${a.name} — ${a.issue}`);
  } else {
    log('  ✅ Нет объектов, требующих внимания');
  }
  const allMissing = [...baseMissing, ...(trainerResult.missing || []), ...(programResult.missing || [])];

  // 5. Сохранение
  if (trainerResult.updated > 0 || programResult.updated > 0 || trainerResult.created > 0 || programResult.created > 0) {
    log('\n📋 Шаг 5: Сохранение db.json...');
    if (DRY_RUN) {
      log('  📄dry-run режим — данные не записаны');
    } else {
      backupDB();
      writeDb(db);
      log('  ✅ Сохранено');
    }
  } else {
    log('\n✅ Изменений нет');
  }

  // 6. Email-уведомление
  if (SEND_EMAIL && allMissing.length > 0) {
    log('\n📋 Шаг 6: Email-уведомление...');
    await sendEmailNotification(allMissing, db);
  } else if (SEND_EMAIL) {
    log('\n📋 Шаг 6: Email-уведомление — нет объектов для уведомления');
  }

  // 7. Итог
  log('\n' + '='.repeat(60));
  log(`📊 ИТОГО:`);
  log(`  Тренеры: обновлено ${trainerResult.updated}, создано ${trainerResult.created}, скрыто ${trainerResult.hidden}`);
  log(`  Программы: обновлено ${programResult.updated}, создано ${programResult.created}, скрыто ${programResult.hidden}`);
  log(`  Пропущенных папок: ${allMissing.length}`);
  log(`  Требуют внимания: ${attention.length}`);
  log('='.repeat(60));
}

main().catch(err => {
  log(`❌ Ошибка: ${err.message}`);
  console.error(err);
  process.exit(1);
});
