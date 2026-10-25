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
  'Борьба': 'Греко-римская борьба'
};

// Ключевые слова для определения типа docx
const GENERIC_DOCX_KEYWORDS = ['описание трен', 'описание.doc', 'описание', 'description'];

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
  const imgFiles = entries.filter(f => IMG_EXTS.includes(path.extname(f).toLowerCase()));
  const hasLockedPng = entries.some(f => f.toLowerCase() === 'locked.png');

  // Разделяем docx на общие и именные
  let genericDocx = null;
  let namedDocx = null;

  for (const f of docxFiles) {
    const lower = f.toLowerCase();
    const isGeneric = GENERIC_DOCX_KEYWORDS.some(kw => lower.includes(kw));
    if (isGeneric && !genericDocx) {
      genericDocx = f;
    } else if (!isGeneric && !namedDocx) {
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
// Обработка тренеров
// ============================================

async function processTrainers(db) {
  const dir = path.join(dataDir, 'trainers');
  if (!fs.existsSync(dir)) return { updated: 0, created: 0, hidden: 0, missing: [] };
  let updated = 0, created = 0, hidden = 0;
  const missing = [];

  const folders = fs.readdirSync(dir).filter(f => fs.statSync(path.join(dir, f)).isDirectory());
  log(`\n📂 Тренеры: ${folders.length} папок`);

  for (const folderName of folders) {
    const folderPath = path.join(dir, folderName);
    const scanned = scanFolder(folderPath);

    // Определяем скрытие
    let shouldBeHidden = false;
    if (scanned.hasLockedPng) {
      shouldBeHidden = true;
      log(`  🔒 ${folderName} — locked.png → hidden`);
    }

    // Создаём/находим объект
    let trainer = findByName(db.trainers || [], folderName);

    if (!trainer) {
      // Новый объект из папки
      if (scanned.docxFiles.length > 0) {
        // Есть docx → создаём видимый
        trainer = {
          id: (db.trainers || []).length + 1,
          name: normalizeName(folderName),
          hidden: shouldBeHidden
        };
        db.trainers.push(trainer);
        created++;
        log(`  ✨ Создан тренер: ${trainer.name}`);
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
        // Нет ничего → в список пропущенных
        missing.push({ type: 'тренер', name: normalizeName(folderName), issue: 'Нет docx и нет фото' });
        log(`  ⏭️  ${folderName} — пусто (нет docx и фото)`);
        continue;
      }
    } else {
      // Существующий объект
      if (shouldBeHidden) {
        trainer.hidden = true;
        log(`  🔒 ${folderName} → hidden (locked.png)`);
      }
    }

    // Парсим docx
    if (scanned.genericDocx || scanned.namedDocx) {
      let genericParsed = null;
      let namedParsed = null;

      if (scanned.genericDocx) {
        const genericText = await parseDocx(path.join(folderPath, scanned.genericDocx));
        if (genericText) genericParsed = parseTrainerDoc(genericText);
        else log(`  ⚠️ ${folderName}: "${scanned.genericDocx}" пуст/не прочитан`);
      }

      if (scanned.namedDocx) {
        const namedText = await parseDocx(path.join(folderPath, scanned.namedDocx));
        if (namedText) namedParsed = parseTrainerDoc(namedText);
        else log(`  ⚠️ ${folderName}: "${scanned.namedDocx}" пуст/не прочитан`);
      }

      const merged = mergeTrainerParsed(genericParsed, namedParsed);

      if (merged) {
        let changed = false;

        // Структурные поля — всегда из документа
        const structFields = ['experienceUshu', 'experienceCoach', 'education', 'motto'];
        for (const f of structFields) {
          if (merged[f] && trainer[f] !== merged[f]) {
            trainer[f] = merged[f];
            changed = true;
          }
        }
        // Специализация: из документа, если в db пусто или --force
        if (merged.specialization && (!trainer.specialization || FORCE)) {
          trainer.specialization = merged.specialization;
          changed = true;
        }
        // Скрытие из текста
        if (merged.hidden) {
          trainer.hidden = true;
          changed = true;
          log(`  🔒 ${folderName} — "СКРЫТЬ" в docx → hidden`);
        }
        // Опыт (experience) — если пусто, берём стаж ушу
        if (!trainer.experience && merged.experienceUshu) {
          trainer.experience = merged.experienceUshu;
          changed = true;
        }
        // Описание — заполняем только пустое или --force
        const cleanDesc = cleanTrainerDescription(merged.fio ? '' : ''); // Уже чистый
        if (!trainer.description || FORCE) {
          // Берём чистое описание из merged (без ФИО/Девиза)
          trainer.description = merged.fio ? cleanTrainerDescription(
            (genericParsed ? await parseDocx(path.join(folderPath, scanned.genericDocx)) : '') +
            (namedParsed ? await parseDocx(path.join(folderPath, scanned.namedDocx)) : '')
          ) : '';
          changed = true;
        }

        if (changed) {
          updated++;
          const tags = structFields.filter(f => merged[f]).length;
          log(`  ✅ ${trainer.name} — структ. полей: ${tags}${scanned.genericDocx && scanned.namedDocx ? ' (2 docx)' : ''}`);
        }
      }
    } else {
      // Нет docx, но есть фото → добавляем фото в photoAlbum
      if (scanned.imgFiles.length > 0) {
        if (!trainer.photoAlbum) trainer.photoAlbum = [];
        for (const img of scanned.imgFiles) {
          if (!trainer.photoAlbum.find(a => a.image === `uploads/${img}`)) {
            trainer.photoAlbum.push({ image: `uploads/${img}`, caption: '' });
          }
        }
        // Пробуем найти фото для обложки
        if (!trainer.image) {
          trainer.image = `uploads/${scanned.imgFiles[0]}`;
          log(`  📸 ${trainer.name}: обложка из ${scanned.imgFiles[0]}`);
        }
      }
    }
  }

  return { updated, created, hidden, missing };
}

// ============================================
// Обработка программ
// ============================================

async function processPrograms(db) {
  const dir = path.join(dataDir, 'programs');
  if (!fs.existsSync(dir)) return { updated: 0, created: 0, hidden: 0, missing: [] };
  let updated = 0, created = 0, hidden = 0;
  const missing = [];

  const categories = fs.readdirSync(dir).filter(f => {
    const fp = path.join(dir, f);
    return fs.statSync(fp).isDirectory();
  });

  for (const cat of categories) {
    const catDir = path.join(dir, cat);
    if (!fs.statSync(catDir).isDirectory()) continue;

    const folders = fs.readdirSync(catDir).filter(f => {
      const fp = path.join(catDir, f);
      return fs.statSync(fp).isDirectory();
    });

    log(`\n📂 ${cat}: ${folders.length} папок`);

    for (const folderName of folders) {
      const folderPath = path.join(catDir, folderName);
      const scanned = scanFolder(folderPath);

      // Определяем скрытие
      let shouldBeHidden = false;
      if (scanned.hasLockedPng) {
        shouldBeHidden = true;
        log(`  🔒 ${folderName} — locked.png → hidden`);
      }

      // Создаём/находим объект
      const normalizedName = normalizeName(folderName);
      let program = findByName(db.programs || [], normalizedName);

      if (!program) {
        // Новый объект из папки
        if (scanned.docxFiles.length > 0) {
          program = {
            id: (db.programs || []).length + 1,
            name: normalizedName,
            category: cat,
            hidden: shouldBeHidden
          };
          db.programs.push(program);
          created++;
          log(`  ✨ Создана программа: ${program.name}`);
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
        // Существующий объект — обновляем category на случай опечатки
        if (program.category !== cat) {
          program.category = cat;
        }
        if (shouldBeHidden) {
          program.hidden = true;
          log(`  🔒 ${folderName} → hidden (locked.png)`);
        }
      }

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

          // Структурные поля — всегда из документа
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

          // Скрытие из текста
          if (merged.hidden) {
            program.hidden = true;
            changed = true;
            log(`  🔒 ${program.name} — "СКРЫТЬ" в docx → hidden`);
          }

          // Описание — только если пусто или --force
          if (!program.description || FORCE) {
            program.description = merged.description;
            changed = true;
          }

          if (changed) {
            updated++;
            log(`  ✅ ${program.name}: расписание=${merged.scheduleStructured.length}, тренеры=${merged.trainers.length}${scanned.genericDocx && scanned.namedDocx ? ' (2 docx)' : ''}`);
          }
        }
      } else {
        // Нет docx, но есть фото → добавляем в photoAlbum
        if (scanned.imgFiles.length > 0) {
          if (!program.photoAlbum) program.photoAlbum = [];
          for (const img of scanned.imgFiles) {
            if (!program.photoAlbum.find(a => a.image === `uploads/${img}`)) {
              program.photoAlbum.push({ image: `uploads/${img}`, caption: '' });
            }
          }
          if (!program.image) {
            program.image = `uploads/${scanned.imgFiles[0]}`;
            log(`  📸 ${program.name}: обложка из ${scanned.imgFiles[0]}`);
          }
        }
      }
    }
  }

  return { updated, created, hidden, missing };
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

  // 4. Собираем полный список пропущенных папок
  log('\n📋 Шаг 4: Проверка пропущенных папок...');
  const trainerFolderMissing = getUnfilledFolders(db, path.join(dataDir, 'trainers'), 'trainers');
  const programFolderMissing = getUnfilledFolders(db, path.join(dataDir, 'programs'), 'programs');
  const allMissing = [...baseMissing, ...trainerFolderMissing, ...programFolderMissing];

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
  log('='.repeat(60));
}

main().catch(err => {
  log(`❌ Ошибка: ${err.message}`);
  console.error(err);
  process.exit(1);
});
