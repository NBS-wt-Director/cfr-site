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

const db = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'db.json'), 'utf-8'));
const visPrograms = db.programs.filter(p => !p.hidden);
const visTrainers = db.trainers.filter(t => !t.hidden);

// ── Главная: расписание + переключатель ──
{
  const w = loadPage('index.html');
  const d = w.document;
  check('главная: картинки расписания отрисованы',
    d.querySelectorAll('#schedule-grid .schedule-item img').length > 0);

  const sw = d.getElementById('schedule-switch');
  check('главная: переключатель виден', sw && !sw.hidden);

  const tableBtn = sw && sw.querySelector('[data-view="table"]');
  tableBtn.click();
  const tableView = d.getElementById('schedule-table-view');
  check('главная: недельная доска показана по клику', tableView && !tableView.hidden && d.getElementById('schedule-grid').hidden);
  check('главная: доска = 7 колонок-дней (S32)', tableView.querySelectorAll('.week-col').length === 7);
  check('главная: тренировки — овальные чипы со ссылками (S32)',
    tableView.querySelectorAll('.week-chip[href^="program.html?id="]').length > 0 &&
    tableView.querySelectorAll('.week-chip-time').length > 0);
  check('главная: чипы с режимом онлайн/офлайн/гибрид (S45)',
    tableView.querySelectorAll('.week-chip.mode-offline, .week-chip.mode-online, .week-chip.mode-hybrid').length > 0);
  // S45: сортировка времени по возрастанию внутри каждого дня
  {
    const mins = t => { const m = /^(\d{1,2})[:.](\d{2})/.exec(t); return m ? +m[1] * 60 + +m[2] : 0; };
    const okTime = [...tableView.querySelectorAll('.week-col-body')].every(col => {
      const arr = [...col.querySelectorAll('.week-chip-time')].map(e => mins(e.textContent));
      return arr.every((v, i) => i === 0 || arr[i - 1] <= v);
    });
    check('главная: время в колонках по возрастанию (S45)', okTime);
  }
  check('главная: по умолчанию активна вкладка «Картинки» (S36 откат)',
    loadPage('index.html').document.querySelector('.schedule-switch-btn[data-view="images"]').classList.contains('active'));
  check('главная: в режиме картинок таблица скрыта',
    loadPage('index.html').document.getElementById('schedule-table-view').hidden);
  // S40: hidden должен скрывать на самом деле — display из класса не должен перебивать
  const cssText = fs.readFileSync(path.join(staticDir, 'css', 'style.css'), 'utf-8');
  check('CSS: правило [hidden] { display: none !important } (S40)',
    /\[hidden\]\s*\{[^}]*display:\s*none\s*!important/.test(cssText));
  check('главная: выбор сохранён в localStorage', w.localStorage.getItem('schedule-view') === 'images');

  const imgBtn = sw.querySelector('[data-view="images"]');
  imgBtn.click();
  check('главная: возврат к картинкам', !d.getElementById('schedule-grid').hidden && tableView.hidden);
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
    JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'db.json'), 'utf-8'))
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
  const albumData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'db.json'), 'utf-8')).album || [];
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
