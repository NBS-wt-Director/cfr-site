#!/usr/bin/env node
/**
 * scripts/test-static.mjs
 *
 * Смоук-тест статики без браузера (jsdom):
 *   - главная: рендер расписания + переключатель Картинки/Таблица (S23);
 *   - страница программы: блоки «Ведёт» и «Расписание» (S22);
 *   - страница тренера: бейджи стажа, девиз, «Мои тренировки» (S22);
 *   - битые картинки в данных (предупреждение, не ошибка — фото зависят от S1).
 *
 *   node scripts/test-static.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { JSDOM } from 'jsdom';
import { flattenDb } from './db-format.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const staticDir = path.join(__dirname, '..', 'static');

let passed = 0, failed = 0;
function check(name, ok, extra = '') {
  if (ok) { passed++; console.log(`✅ ${name}`); }
  else { failed++; console.log(`❌ ${name}${extra ? ' — ' + extra : ''}`); }
}

// Загружает HTML и выполняет подключённые локальные скрипты, как браузер
function loadPage(htmlFile, query = '') {
  const html = fs.readFileSync(path.join(staticDir, htmlFile), 'utf-8');
  const dom = new JSDOM(html, {
    url: 'http://localhost/' + htmlFile + query,
    runScripts: 'outside-only',
    pretendToBeVisual: true
  });
  const { window } = dom;
  const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)]
    .map(m => m[1].replace(/\?.*$/, ''))
    .filter(s => !/^https?:/.test(s));
  for (const s of scripts) {
    const file = path.join(staticDir, s);
    if (!fs.existsSync(file)) throw new Error(`нет скрипта ${s}`);
    window.eval(fs.readFileSync(file, 'utf-8'));
  }
  window.document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));
  return window;
}

const db = flattenDb(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'db.json'), 'utf-8')));
const visPrograms = db.programs.filter(p => !p.hidden);
const visTrainers = db.trainers.filter(t => !t.hidden);

// ── Главная: расписание (S2: режим управляется админкой; S3: зал/режимы) ──
{
  const w = loadPage('index.html');
  const d = w.document;
  check('главная: картинки расписания отрисованы',
    d.querySelectorAll('#schedule-grid .schedule-item img').length > 0);

  // S2: режим задаётся админкой (scheduleSettings.defaultView), переключатель — только в гибрид
  const settings = w.SITE_DATA.scheduleSettings || {};
  const sw = d.getElementById('schedule-switch');
  check('главная: scheduleSettings экспортирован в core.js (S2)',
    ['images', 'table', 'hybrid'].includes(settings.defaultView));
  check('главная: переключатель скрыт в режиме картинок / виден в гибриде (S2)',
    settings.defaultView === 'hybrid' ? (sw && !sw.hidden) : (sw && sw.hidden));
  check('главная: в режиме картинок таблица скрыта',
    d.getElementById('schedule-table-view').hidden);

  // Недельная доска — напрямую через общий ScheduleUI (S45/S3)
  const board = d.createElement('div');
  board.innerHTML = w.ScheduleUI.weekBoard(w.SITE_DATA.scheduleTable);
  check('главная: доска = 7 колонок-дней (S32)', board.querySelectorAll('.week-col').length === 7);
  check('главная: тренировки — овальные чипы со ссылками (S32)',
    board.querySelectorAll('.week-chip[href^="program.html?id="]').length > 0 &&
    board.querySelectorAll('.week-chip-time').length > 0);
  check('главная: чипы с режимом зал/онлайн/гибрид (S3)',
    board.querySelectorAll('.week-chip.mode-hall, .week-chip.mode-online, .week-chip.mode-hybrid').length > 0);
  check('главная: чипы показывают зал (S3)', board.querySelectorAll('.week-chip-place').length > 0);
  check('главная: чипы показывают тренера (S3)', board.querySelectorAll('.week-chip-trainer').length > 0);
  // S45: сортировка времени по возрастанию внутри каждого дня
  {
    const mins = t => { const m = /^(\d{1,2})[:.](\d{2})/.exec(t); return m ? +m[1] * 60 + +m[2] : 0; };
    const okTime = [...board.querySelectorAll('.week-col-body')].every(col => {
      const arr = [...col.querySelectorAll('.week-chip-time')].map(e => mins(e.textContent));
      return arr.every((v, i) => i === 0 || arr[i - 1] <= v);
    });
    check('главная: время в колонках по возрастанию (S45)', okTime);
  }
  // S40: hidden должен скрывать на самом деле — display из класса не должен перебивать
  const cssText = fs.readFileSync(path.join(staticDir, 'css', 'style.css'), 'utf-8');
  check('CSS: правило [hidden] { display: none !important } (S40)',
    /\[hidden\]\s*\{[^}]*display:\s*none\s*!important/.test(cssText));
  // S2: режим больше не хранится в localStorage — только настройка админки
  const mainJs = fs.readFileSync(path.join(staticDir, 'js', 'main.js'), 'utf-8');
  check('главная: localStorage для режима расписания не используется (S2)',
    !/localStorage\.(get|set)Item\(['"]schedule-view/.test(mainJs));
}

// ── Страница программы: блоки S22 ──
{
  const p = visPrograms.find(x => (x.scheduleStructured || []).length && (x.trainers || []).some(t => t.id != null));
  const w = loadPage('program.html', '?id=' + p.id);
  const d = w.document;
  check(`программа «${p.name}»: блок «Ведёт»`, !!d.querySelector('.entity-trainers'));
  check(`программа «${p.name}»: ссылка на тренера`, !!d.querySelector('.entity-trainers a[href^="trainer.html?id="]'));
  check(`программа «${p.name}»: блок «Расписание»`, !!d.querySelector('.entity-subtitle') &&
    [...d.querySelectorAll('.entity-subtitle')].some(h => h.textContent.includes('Расписание')));
  check(`программа «${p.name}»: таблица расписания`, d.querySelectorAll('.schedule-table tbody tr').length === (p.scheduleStructured || []).length);
  check('программа: в таблице НЕТ колонки «Место» (S26)', ![...d.querySelectorAll('.schedule-table th')].some(h => /мест/i.test(h.textContent)));
  // S62: фотоальбом программы — карусель необрезанных фото
  {
    const pa = visPrograms.find(x => (x.photoAlbum || []).length);
    if (pa) {
      const wp = loadPage('program.html', '?id=' + pa.id);
      const dp = wp.document;
      check(`программа «${pa.name}»: фотоальбом = карусель (S62)`,
        !!dp.querySelector('.entity-album .entity-carousel .carousel-track'));
      check(`программа «${pa.name}»: слайдов = фото в альбоме (S62)`,
        dp.querySelectorAll('.carousel-item').length === pa.photoAlbum.length);
      check(`программа «${pa.name}»: в альбоме НЕТ старой сетки .album-grid (S62)`,
        !dp.querySelector('.entity-album .album-grid'));
      check(`программа «${pa.name}»: есть счётчик и стрелки карусели (S62)`,
        !!dp.querySelector('.carousel-counter') && !!dp.querySelector('.carousel-prev') && !!dp.querySelector('.carousel-next'));
    }
  }
  // На Яндекс.Диске нет папок с фото для этих трёх программ — обложку взять неоткуда (S28)
  const NO_PHOTO_ON_DISK = ['Специальное ОФП (6-12 лет)', 'Основы работы с оружием', 'Массаж внутренних органов'];
  check('обложки: у всех видимых программ (кроме 3 без фото на диске) есть image и файл существует (S28)',
    flattenDb(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'db.json'), 'utf-8')))
      .programs.filter(x => !x.hidden && !NO_PHOTO_ON_DISK.includes(x.name))
      .every(x => x.image && fs.existsSync(path.join(staticDir, x.image.replace(/^\//, '')))));
}

// ── Страница тренера: блоки S22 ──
{
  const t = visTrainers.find(x => x.motto && x.education);
  const w = loadPage('trainer.html', '?id=' + t.id);
  const d = w.document;
  check(`тренер «${t.name}»: бейджи стажа`, d.querySelectorAll('.entity-badge').length >= 1);
  check(`тренер «${t.name}»: образование`, [...d.querySelectorAll('.entity-subtitle')].some(h => h.textContent.includes('Образование')));
  check(`тренер «${t.name}»: девиз`, !!d.querySelector('.entity-quote'));
  const my = [...d.querySelectorAll('.entity-subtitle')].some(h => h.textContent.includes('Мои тренировки'));
  const hasSlots = db.programs.some(pr => !pr.hidden && (pr.trainers || []).some(tr => Number(tr.id) === Number(t.id)) && (pr.scheduleStructured || []).length);
  check(`тренер «${t.name}»: «Мои тренировки» ${hasSlots ? '(есть слоты)' : '(нет слотов)'}`, my === hasSlots);
  // Дубли marcеров в описании не должно
  const text = d.querySelector('.entity-text')?.textContent || '';
  check(`тренер «${t.name}»: описание без дублей маркеров`, !/Тренерский стаж\s*:/.test(text) && !/Образование\s*:/.test(text));
  check('тренер: в таблице «Мои тренировки» НЕТ колонки «Место» (S26)', ![...d.querySelectorAll('.schedule-table th')].some(h => /мест/i.test(h.textContent)));
  // S61: регрессия — «Мои тренировки» должен быть НЕ вложенным week-board
  {
    const twb = d.querySelector('.trainer-week-board');
    check('тренер: «Мои тренировки» обёрнут в .trainer-week-board (S61)', !!twb);
    // Вложенность .week-board .week-board — баг, сжимающий доску в 1/7 ширины
    const nested = d.querySelector('.week-board .week-board');
    check('тренер: НЕТ вложенной .week-board .week-board (S61 — фикс)', !nested);
    // Внутри .trainer-week-board должен быть .week-board-wrap
    check('тренер: внутри .trainer-week-board есть .week-board-wrap (S61)',
      !!d.querySelector('.trainer-week-board .week-board-wrap'));
    // CSS: full-bleed для .trainer-week-board
    const cssT = fs.readFileSync(path.join(staticDir, 'css', 'style.css'), 'utf-8');
    check('CSS: .trainer-week-board full-bleed 100vw (S61)',
      /trainer-week-board[^}]*100vw/s.test(cssT));
    // CSS: overflow-x: clip для body[data-entity="trainer"]
    check('CSS: body[data-entity="trainer"] overflow-x: clip (S61)',
      /trainer[^}]*overflow-x:\s*clip/s.test(cssT));
  }
  // S62: фотоальбом тренера — карусель + подключение модуля + стили без crop
  {
    const ta = visTrainers.find(x => (x.photoAlbum || []).length > 1);
    const srcCss = fs.readFileSync(path.join(staticDir, 'css', 'style.css'), 'utf-8');
    check('S62: carousel.js подключён на program.html и trainer.html',
      ['program.html', 'trainer.html'].every(f =>
        /carousel\.js/.test(fs.readFileSync(path.join(staticDir, f), 'utf-8'))));
    check('S62: CSS — фото карусели без обрезки (object-fit: contain)',
      /\.carousel-item img\s*\{[^}]*object-fit:\s*contain/.test(srcCss));
    if (ta) {
      const wt = loadPage('trainer.html', '?id=' + ta.id);
      check(`тренер «${ta.name}»: фотоальбом = карусель (S62)`,
        !!wt.document.querySelector('.entity-album .entity-carousel .carousel-track') &&
        wt.document.querySelectorAll('.carousel-item').length === ta.photoAlbum.length);
    }
  }
  const footDoc = loadPage('index.html').document;
  check('футер: логотип вместо эмодзи (S27)', !!footDoc.querySelector('.footer-logo img'));
  check('футер: MAX со ссылкой (S27)', !!footDoc.querySelector('.footer-social a[href^="https://max.ru/"]'));
  check('футер: CRM/Админка — отдельное подменю «Служебное», не в «Перейти к» (S34)',
    !footDoc.querySelector('.footer-links a[href="crm.html"]') && !footDoc.querySelector('.footer-links a[href="admin.html"]') &&
    !!footDoc.querySelector('details.footer-service-menu a[href="crm.html"]') &&
    !!footDoc.querySelector('details.footer-service-menu a[href="admin.html"]'));
  check('шапка: CRM/Админка полностью отсутствуют (S34)',
    !footDoc.querySelector('.header a[href="crm.html"]') && !footDoc.querySelector('.header a[href="admin.html"]'));
  check('шапка: логотип — ссылка на index.html (S35)',
    footDoc.querySelector('.logo') && footDoc.querySelector('.logo').getAttribute('href') === 'index.html');
  check('шапка: ссылка «Личный кабинет» (S31)', !!footDoc.querySelector('.nav-list a[href="lk.html"]'));
  check('ЛК: страница-заглушка существует (S31)',
    fs.existsSync(path.join(staticDir, 'lk.html')) && /Личный кабинет/.test(fs.readFileSync(path.join(staticDir, 'lk.html'), 'utf-8')));
  // S45: общий модуль расписания подключён и используется
  check('ScheduleUI: модуль существует и подключён на 3 страницах (S45)',
    fs.existsSync(path.join(staticDir, 'js', 'schedule-ui.js')) &&
    ['index.html', 'program.html', 'trainer.html'].every(f =>
      /schedule-ui\.js/.test(fs.readFileSync(path.join(staticDir, f), 'utf-8'))));
  // S46: ни одного эмодзи-панды в плитках, фолбэк — logo.png
  {
    const src = ['js/main.js', 'js/entity.js', 'trainers.html', 'programs.html']
      .map(f => fs.readFileSync(path.join(staticDir, f), 'utf-8')).join('');
    check('плитки: нет 🐼, фолбэк logo.png (S46)', !src.includes('🐼') && src.includes('logo.png'));
  }
  // S47: адрес кликабелен, карты в «Мы в сети», подпись
  {
    const f = fs.readFileSync(path.join(__dirname, '..', 'static', 'js', 'footer.js'), 'utf-8');
    check('футер: адрес → Яндекс.Карты, 2ГИС в «Мы в сети», подпись (S47)',
      f.includes('https://yandex.ru/maps/-/CXRGU2p2') && f.includes('https://go.2gis.com/WzwQ2') &&
      f.includes('OIA.UYe by KodaCode'));
  }
  const albumData = flattenDb(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'db.json'), 'utf-8'))).album || [];
  check(`альбом: заполнен из скачанных фото (S37, ${albumData.length} шт.)`,
    albumData.length > 100 && albumData.every(a =>
      a.thumb && fs.existsSync(path.join(staticDir, a.thumb.replace(/^\//, '')))));
  // S43: все генерированные картинки — квадратные (w == h)
  {
    const { execFileSync } = await import('child_process');
    const files = [];
    for (const dir of ['uploads/covers', 'uploads/album/full', 'uploads/album/thumb']) {
      const abs = path.join(staticDir, dir);
      if (fs.existsSync(abs)) files.push(...fs.readdirSync(abs).filter(f => f.endsWith('.jpg')).map(f => path.join(abs, f)));
    }
    const out = execFileSync('identify', ['-format', '%w %h\n', ...files], { maxBuffer: 1 << 24 }).toString().trim().split('\n');
    check(`картинки квадратные без обрезки (S43, ${files.length} шт.)`, out.length === files.length && out.every(d => { const [w, h] = d.split(' '); return w === h; }));
  }
}

// ── S73: Пакет 2 — оформление, просмотр данных, 5 фото, модалка на главной ──
{
  const read = p => fs.readFileSync(path.join(staticDir, p), 'utf-8');
  const readScript = p => fs.readFileSync(path.join(__dirname, '..', 'scripts', p), 'utf-8');
  const adminHtml = read('admin.html');
  const adminSrv = readScript('admin-server.mjs');
  const exporter = readScript('export-static.mjs');
  const coreJs = read('js/data/core.js');
  const indexHtml = read('index.html');
  const mainJs = read('js/main.js');
  const newsHtml = read('news.html');

  // 1. Раздел «Оформление»
  check('S73: admin.html — loadAppearanceSection определена',
    /async function loadAppearanceSection/.test(adminHtml));
  check('S73: admin.html — форма оформления + живой предпросмотр',
    /function renderAppearanceForm/.test(adminHtml) &&
    /function updatePreview/.test(adminHtml) &&
    /function saveAppearance/.test(adminHtml) &&
    /appearance-preview-frame/.test(adminHtml) &&
    /appearance-layout/.test(adminHtml));
  check('S73: admin.html — обращение к API get/save-appearance',
    /\/api\/admin\/get-appearance/.test(adminHtml) && /\/api\/admin\/save-appearance/.test(adminHtml));
  check('S73: admin-server — маршруты get/save-appearance + sanitizeAppearance',
    /\/api\/admin\/get-appearance/.test(adminSrv) &&
    /\/api\/admin\/save-appearance/.test(adminSrv) &&
    /function sanitizeAppearance/.test(adminSrv));
  check('S73: export — appearance в core; core.js содержит appearance',
    /appearance:\s*{/.test(exporter) && /appearance/.test(coreJs));
  check('S73: appearance.js существует и подключён на всех страницах',
    fs.existsSync(path.join(staticDir, 'js', 'appearance.js')) &&
    ['index.html', 'programs.html', 'trainers.html', 'program.html', 'trainer.html',
     'news.html', 'album.html', 'crm.html'].every(f => /appearance\.js/.test(read(f))));
  check('S73: style.css — CSS-переменные текста (--fs/--fw/--ff/--lh)',
    /--fs-body:/.test(read('css/style.css')) && /--fw-headings:/.test(read('css/style.css')));

  // 2. Отображение существующих данных (только просмотр)
  check('S73: admin.html — get-data + рендер разделов просмотра',
    /\/api\/admin\/get-data/.test(adminHtml) &&
    /function loadViewSection/.test(adminHtml) &&
    /renderScheduleView/.test(adminHtml) && /renderContactsView/.test(adminHtml) &&
    /renderAlbumView/.test(adminHtml) && /renderNewsSettingsView/.test(adminHtml));
  check('S73: admin.html — просмотр сущностей (👁) + модалка + сводка «Данные»',
    /function viewProgram/.test(adminHtml) && /function viewTrainer/.test(adminHtml) &&
    /function viewNews/.test(adminHtml) && /id="view-modal"/.test(adminHtml) &&
    /function viewDbKey/.test(adminHtml) && /data-grid/.test(adminHtml));
  check('S73: admin-server — маршрут get-data',
    /\/api\/admin\/get-data/.test(adminSrv) && /function handleGetData/.test(adminSrv));

  // 3. До 5 фото новости
  check('S73: admin.html — форма с фото-слотами (до 5)',
    /MAX_NEWS_PHOTOS\s*=\s*5/.test(adminHtml) &&
    /function renderPhotoSlots/.test(adminHtml) && /id="news-photos"/.test(adminHtml));
  check('S73: export — photos в newsSlice', /photos:/.test(exporter) && /\.slice\(0, 5\)/.test(exporter));
  check('S73: news.html — галерея photos в модалке', /news-photos/.test(newsHtml) && /n\.photos/.test(newsHtml));
  check('S73: admin-server — удаление медиа включает photos', /news\.photos/.test(adminSrv));

  // 4. Главная — открытие новости в модалке без перехода
  check('S73: index.html — подключены news-full.js + md.js + разметка #newsModal',
    /news-full\.js/.test(indexHtml) && /js\/md\.js/.test(indexHtml) && /id="newsModal"/.test(indexHtml));
  check('S73: main.js — openNewsModal определена и вешается на карточку',
    /function openNewsModal/.test(mainJs) && /window\.openNewsModal/.test(mainJs) &&
    /onclick="openNewsModal/.test(mainJs));
  check('S73: main.js — на главной больше нет ссылки-перехода news.html?id в карточках новостей',
    !/class="news-more" href="news\.html/.test(mainJs));
}

// ── Битые картинки в данных (предупреждение) ──
{
  const missing = new Set();
  const checkImg = p => { if (p && !fs.existsSync(path.join(staticDir, p))) missing.add(p); };
  visPrograms.forEach(p => { checkImg((p.image || '').replace(/^\//, '')); (p.photoAlbum || []).forEach(a => checkImg((a.image || '').replace(/^\//, ''))); });
  visTrainers.forEach(t => { checkImg((t.image || '').replace(/^\//, '')); (t.photoAlbum || []).forEach(a => checkImg((a.image || '').replace(/^\//, ''))); });
  if (missing.size) console.log(`⚠️  битых картинок в данных: ${missing.size} (зависит от S1/S2/S3)`);
  else console.log('✅ битых картинок в данных нет');
}

console.log(`\n${passed}/${passed + failed} пройдено`);
process.exit(failed ? 1 : 0);
