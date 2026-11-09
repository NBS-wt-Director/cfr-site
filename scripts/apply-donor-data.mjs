#!/usr/bin/env node
/**
 * scripts/apply-donor-data.mjs
 *
 * T4/T5 из TICKET-DONOR-FORMAT.md: правки данных в db.json, которые парсер
 * сделать не может (на диске этих сущностей нет).
 *
 *   1. Тренеры: категория («тренер ушу» / «преподаватель изо»),
 *      флаги «Ведёт персональные / сплит / массаж», пометка «Директор»,
 *      архивные тренеры → hidden:true.
 *   2. Направление «Изобразительное искусство» — программа
 *      «Изобразительное искусство (4+)» переносится в него из «ДЕТСКИЕ НАПРАВЛЕНИЯ».
 *   3. Направление «Индивидуальные занятия» + программы
 *      «Персональные тренировки», «Сплит», «Массаж» (без расписания,
 *      тренеры — по флагам).
 *
 * Идемпотентно: повторный запуск не плодит дублей. Перед записью — бэкап db.json.
 *
 *   npm run apply-donor-data            — применить
 *   npm run apply-donor-data -- --dry-run — только отчёт
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { flattenDb, nestDb } from './db-format.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const dbPath = path.join(root, 'db.json');

const DRY_RUN = process.argv.includes('--dry-run');

function log(msg) {
  console.log(`[${new Date().toISOString().slice(0, 19)}] ${msg}`);
}

// ── Данные тикета (§1.3) ───────────────────────────────────────────────────
// Флаги «ведёт …» включены по умолчанию этим тренерам (по фамилии + имени).
const FLAG_TRAINERS = [
  'Кузнецов Александр',
  'Кравец Оксана',
  'Глазырин Михаил',
  'Глазырина Илона',
  'Романовский Николай',
  'Половникова Тамара'
];

// Архивные тренеры (папка «,Тренера архив» на диске) — скрыты на сайте
const ARCHIVE_TRAINERS = ['Бобров Константин', 'Казанцев Владимир', 'Поторочин Станислав'];

const CATEGORY_DEFAULT = 'тренер ушу';
const CATEGORY_ISO = 'преподаватель изо';
const ISO_TRAINER = 'Мосоян Лусине';
const DIRECTOR_TRAINER = 'Кравец Оксана';

const ISO_DIR_ID = 'dir-iso';
const IND_DIR_ID = 'dir-ind';

// Программа ИЗО уже есть на диске в «ДЕТСКИЕ НАПРАВЛЕНИЯ» — переносим в своё направление
const ISO_PROGRAM = 'Изобразительное искусство (4+)';

// Стабильные id новых программ (детерминированно: скрипт можно запускать повторно)
const IND_PROGRAMS = [
  {
    id: 1780000000001,
    name: 'Персональные тренировки',
    flag: 'personal',
    description:
      'Заниматься один на один с тренером — самый быстрый путь к результату. ' +
      'Программа строится под ваши задачи: техника УШУ, общая физическая подготовка, ' +
      'восстановление после травм, работа с весом своего тела или подготовка к выступлениям.\n\n' +
      'Тренер видит вашу технику в каждом повторении, сразу исправляет ошибки и дозирует ' +
      'нагрузку — на занятии нет «ожидания своей очереди», как в группе. Время и день ' +
      'выбираете вместе с тренером, включая ранние утра и вечерние слоты.\n\n' +
      'Формат: индивидуальная запись. Расписание на сайте не публикуется — ' +
      'выберите тренера и оставьте заявку, мы согласуем удобное время.'
  },
  {
    id: 1780000000002,
    name: 'Сплит',
    flag: 'split',
    description:
      'Сплит-тренировка — занятие для пары: с партнёром, другом, ребёнком или второй ' +
      'половиной. Двое занимаються с одним тренером в одно время, и это вдвое интереснее: ' +
      'появляется соревнование, поддержка и взаимная страховка в упражнениях.\n\n' +
      'Программу подбираем под уровень обоих — техники отличаются, если один занимается ' +
      'годами, а второй пришёл впервые. Подходит родителям с детьми и тем, кому ' +
      'проще заниматься «за компанию».\n\n' +
      'Формат: индивидуальная запись на двоих. Расписание на сайте не публикуется — ' +
      'оставьте заявку, согласуем день и время с тренером.'
  },
  {
    id: 1780000000003,
    name: 'Массаж',
    flag: 'massage',
    description:
      'Массаж в центре ведут тренеры, которые работают с телом ежедневно и понимают, ' +
      'где и почему появляется зажим. В ход идут классические приёмы, висцеральные ' +
      'техники и проработка суставов и мышц, задействованных в УШУ.\n\n' +
      'Показания типовые: сидячая работа, ноющие спина и шея, головные боли, ' +
      'восстановление после нагрузок и травм, подготовка тела к тренировкам. ' +
      'После сеанса тренер подскажет упражнения, чтобы эффект держался дольше.\n\n' +
      'Формат: индивидуальная запись. Расписание на сайте не публикуется — ' +
      'оставьте заявку, подберём тренера и удобное время.'
  }
];

const NEW_DIRECTIONS = [
  {
    id: ISO_DIR_ID,
    name: 'Изобразительное искусство',
    description:
      'Занятия по изобразительному искусству для детей от 4 лет: рисунок, композиция, ' +
      'цвет, знакомство с материалами и собственное творческое высказывание.',
    image: ''
  },
  {
    id: IND_DIR_ID,
    name: 'Индивидуальные занятия',
    description:
      'Персональные тренировки, занятия для пары (сплит) и массаж. ' +
      'Расписания в общем списке нет — запись индивидуальная, время согласуется с тренером.',
    image: ''
  }
];

// ============================================
// Утилиты
// ============================================

function normalize(s) {
  return String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
}

function matchTrainer(trainers, sample) {
  const want = normalize(sample);
  return trainers.find(t => {
    const n = normalize(t.name);
    return n.includes(want) || want.includes(n.split(' ').slice(0, 2).join(' '));
  });
}

function findProgram(db, name) {
  return (db.programs || []).find(p => normalize(p.name) === normalize(name));
}

function upsertDirection(db, spec) {
  if (!Array.isArray(db.directions)) db.directions = [];
  let dir = db.directions.find(d => d.id === spec.id);
  if (!dir) {
    dir = { ...spec, hidden: false, isBuiltin: false, programs: [] };
    db.directions.push(dir);
    log(`  🆕 Направление: ${spec.name}`);
  } else {
    dir.name = spec.name;
    if (!dir.description) dir.description = spec.description;
    if (!dir.image && spec.image) dir.image = spec.image;
  }
  return dir;
}

function addToDirection(dir, program) {
  if (!Array.isArray(dir.programs)) dir.programs = [];
  if (!dir.programs.find(p => String(p.id) === String(program.id))) {
    dir.programs.push({ id: program.id, name: program.name || '', image: program.image || '' });
    return true;
  }
  // Синхронизируем имя/обложку (переименование и кропы делает парсер и match-photos)
  const existing = dir.programs.find(p => String(p.id) === String(program.id));
  if (existing.name !== program.name) existing.name = program.name || '';
  if (existing.image !== program.image) existing.image = program.image || '';
  return false;
}

function removeFromOtherDirections(db, dirId, programId) {
  for (const d of db.directions || []) {
    if (d.id === dirId) continue;
    const before = (d.programs || []).length;
    d.programs = (d.programs || []).filter(p => String(p.id) !== String(programId));
    if ((d.programs || []).length !== before) {
      log(`  ↔️  Программа ${programId} убрана из направления «${d.name}»`);
    }
  }
}

// ============================================
// Шаг 1. Тренеры
// ============================================

function applyTrainers(db) {
  const trainers = db.trainers || [];
  let changed = 0;

  for (const t of trainers) {
    let dirty = false;

    // Категория влияет только на формулировки на странице тренера
    const wantCat = normalize(t.name).includes(normalize(ISO_TRAINER))
      ? CATEGORY_ISO
      : (t.category || CATEGORY_DEFAULT);
    if (t.category !== wantCat) {
      t.category = wantCat;
      dirty = true;
    }

    // Флаги «ведёт …»: включены списку из тикета, у остальных — выключены
    const on = FLAG_TRAINERS.some(s => matchTrainer([t], s));
    for (const flag of ['personal', 'split', 'massage']) {
      const want = on ? true : (t[flag] === true ? true : false);
      if (!!t[flag] !== want) {
        t[flag] = want;
        dirty = true;
      }
    }

    // Пометка «Директор» — неснимаемая, клиентом не видится
    if (normalize(t.name).includes(normalize(DIRECTOR_TRAINER)) && !t.isDirector) {
      t.isDirector = true;
      dirty = true;
      log(`  ⭐ ${t.name} — isDirector:true (пометка неснимаемая)`);
    }

    // Архивные тренеры — скрыты
    if (ARCHIVE_TRAINERS.some(s => normalize(t.name).includes(normalize(s))) && !t.hidden) {
      t.hidden = true;
      dirty = true;
      log(`  🔒 ${t.name} — архивный тренер → hidden:true`);
    }

    if (dirty) {
      changed++;
      log(`  ✅ ${t.name}: категория «${t.category}», персональные=${!!t.personal}, сплит=${!!t.split}, массаж=${!!t.massage}`);
    }
  }

  return changed;
}

// ============================================
// Шаг 2. Направления и программы
// ============================================

function applyDirections(db) {
  let created = 0;

  // 2.1. «Изобразительное искусство» — отдельное направление для существующей программы
  const isoProgram = findProgram(db, ISO_PROGRAM);
  const isoDir = upsertDirection(db, NEW_DIRECTIONS[0]);
  if (isoProgram) {
    if (addToDirection(isoDir, isoProgram)) {
      log(`  📌 Программа «${isoProgram.name}» → направление «${isoDir.name}»`);
    }
    removeFromOtherDirections(db, ISO_DIR_ID, isoProgram.id);
    if (isoProgram.directionId !== ISO_DIR_ID) isoProgram.directionId = ISO_DIR_ID;
    if (!isoDir.image && isoProgram.image) isoDir.image = isoProgram.image;
  } else {
    log(`  ⚠️ Программа «${ISO_PROGRAM}» не найдена в базе — направление создано пустым`);
  }

  // 2.2. «Индивидуальные занятия» + 3 программы без расписания
  const indDir = upsertDirection(db, NEW_DIRECTIONS[1]);
  for (const spec of IND_PROGRAMS) {
    const withFlag = (db.trainers || []).filter(t => t[spec.flag] === true && !t.hidden);
    const trainerRefs = withFlag.map(t => ({ name: t.name || '', id: t.id }));

    let program = (db.programs || []).find(p => String(p.id) === String(spec.id)) ||
      findProgram(db, spec.name);

    if (!program) {
      program = {
        id: spec.id,
        name: spec.name,
        type: 'program',
        image: '',
        description: spec.description,
        category: 'ИНДИВИДУАЛЬНЫЕ ЗАНЯТИЯ',
        scheduleStructured: [],
        photoAlbum: [],
        trainers: trainerRefs,
        hidden: false,
        autoGenerated: true
      };
      db.programs.push(program);
      created++;
      log(`  🆕 Программа «${spec.name}» (тренеров по флагам: ${trainerRefs.length}, расписания нет)`);
    } else {
      // Программа уже есть — держим тренеров по флагам, расписание не выдумываем
      if (!program.category) program.category = 'ИНДИВИДУАЛЬНЫЕ ЗАНЯТИЯ';
      if (!Array.isArray(program.scheduleStructured)) program.scheduleStructured = [];
      if (!Array.isArray(program.photoAlbum)) program.photoAlbum = [];
      const same = JSON.stringify(program.trainers || []) === JSON.stringify(trainerRefs);
      if (!same && trainerRefs.length) {
        program.trainers = trainerRefs;
        log(`  👥 «${spec.name}»: тренеры обновлены по флагам (${trainerRefs.length})`);
      }
      log(`  ♻️ Программа «${spec.name}» уже есть (id ${program.id}) — обновлена`);
    }

    addToDirection(indDir, program);
    removeFromOtherDirections(db, IND_DIR_ID, program.id);
    program.directionId = IND_DIR_ID;
  }

  return created;
}

// ============================================
// main
// ============================================

function main() {
  log('='.repeat(60));
  log(`🧩 Применение данных доноров (T4/T5) ${DRY_RUN ? '(--dry-run)' : ''}`);
  log('='.repeat(60));

  const db = flattenDb(JSON.parse(fs.readFileSync(dbPath, 'utf8')));
  if (!db.trainers || !db.programs) {
    console.error('❌ В db.json нет trainers или programs');
    process.exit(1);
  }

  log('\n📋 Шаг 1: тренеры...');
  const trainersChanged = applyTrainers(db);

  log('\n📋 Шаг 2: направления и программы...');
  const programsCreated = applyDirections(db);

  const indCount = (db.trainers || []).filter(t => t.personal).length;
  log('\n📊 ИТОГО:');
  log(`  Тренеров изменено: ${trainersChanged}`);
  log(`  Программ создано: ${programsCreated}`);
  log(`  Направлений: ${(db.directions || []).length}`);
  log(`  Флаг «персональные» у тренеров: ${indCount}`);

  if (DRY_RUN) {
    log('  📄 dry-run — данные не записаны');
    return;
  }

  const dir = path.join(root, 'backups');
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(dbPath, path.join(dir, `db.json.backup.${Date.now()}`));
  fs.writeFileSync(dbPath, JSON.stringify(nestDb(db), null, 2), 'utf8');
  log('  ✅ db.json сохранён (бэкап в backups/)');
}

main();
