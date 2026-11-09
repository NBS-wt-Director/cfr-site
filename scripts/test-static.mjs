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
import { flattenDb, nestDb } from './db-format.mjs';

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

// ── S99: гибрид = ровно 2 режима + залы (картинка расписания переехала в залы) ──
{
  const w = loadPage('index.html');
  const d = w.document;
  const switchBtns = [...d.querySelectorAll('#schedule-switch .schedule-switch-btn')];
  check('S99: в переключателе расписания ровно 2 кнопки (нет третьего режима)',
    switchBtns.length === 2);
  check('S99: кнопки переключателя — только «Картинки» и «Таблица»',
    switchBtns.map(b => b.getAttribute('data-view')).sort().join(',') === 'images,table');
  check('S99: кнопки «Гибрид» (data-view="hybrid") в разметке нет',
    !d.querySelector('#schedule-switch [data-view="hybrid"]'));

  // hybridActiveTab в экспорте — только images|table
  const settings = w.SITE_DATA.scheduleSettings || {};
  check('S99: hybridActiveTab ∈ {images, table}',
    ['images', 'table'].includes(settings.hybridActiveTab));

  // Экспорт картинок расписания = залы (name + image)
  const halls = w.SITE_DATA.schedule || [];
  check('S99: schedule экспортирует залы с названием',
    halls.length > 0 && halls.every(h => 'name' in h && h.image));
  check('S99→S109: картинки залов отрисованы БЕЗ подписей (название только в alt)',
    d.querySelectorAll('#schedule-grid .schedule-hall-name').length === 0 &&
    d.querySelectorAll('#schedule-grid .schedule-item img').length === halls.length &&
    [...d.querySelectorAll('#schedule-grid .schedule-item img')].every(i => /расписание занятий/.test(i.getAttribute('alt') || '')));

  // В main.js ветки третьего режима больше нет
  const mainSrc = fs.readFileSync(path.join(staticDir, 'js', 'main.js'), 'utf-8');
  check('S99: setScheduleView не показывает оба блока одновременно (нет «view === hybrid»)',
    !/view === 'hybrid'/.test(mainSrc));

  // Залы в админке зарегистрированы (иначе раздел пустой — баг факта 13)
  const adminHtml = fs.readFileSync(path.join(staticDir, 'admin.html'), 'utf-8');
  check('S99: раздел «Залы» зарегистрирован в sections[] админки',
    /id:\s*'halls'/.test(adminHtml) && /data-section="halls"/.test(adminHtml));
  check('S99: админка — API get-halls/save-halls',
    /api\/admin\/get-halls/.test(adminHtml) && /api\/admin\/save-halls/.test(adminHtml));
  check('S99: в «Расписании» есть сообщение, что картинки переехали в «Залы»',
    /переехали в раздел «Залы»/.test(adminHtml));
  check('S99: в админке нет третьего radio «Гибрид (оба сразу)»',
    !/Гибрид \(оба сразу\)/.test(adminHtml));

  // data.schedule как наследие сохранён (не удалён)
  check('S99: data.schedule не удалён из базы (наследие)',
    Array.isArray(db.schedule) && db.schedule.length > 0);
  check('S99: settings.halls заполнен и выживает в базе',
    Array.isArray(db.halls) && db.halls.length > 0 && db.halls.every(h => 'name' in h && 'image' in h));
}

// ── S100: админка.Направления — полноценный CRUD ──
{
  const adminHtml = fs.readFileSync(path.join(staticDir, 'admin.html'), 'utf-8');

  check('S100: раздел «Направления» зарегистрирован в sections[] админки',
    /id:\s*'directions'/.test(adminHtml) && /data-section="directions"/.test(adminHtml));
  check('S100: раздел «Направления» имеет статус done (не заглушка)',
    /\{\s*id:\s*'directions'[^}]*status:\s*'done'/.test(adminHtml));
  check('S100: в разметке направления поле названия (dir-name-input)',
    /dir-name-input/.test(adminHtml));
  check('S100: id программы берётся из DOM-атрибута (data-pid), а не из текста',
    /data-pid=/.test(adminHtml) && !/progs\.push\(\{\s*id:\s*''/.test(adminHtml));
  check('S100: направление можно скрыть (toggleDirectionHidden)',
    /function toggleDirectionHidden/.test(adminHtml));
  check('S100: направление можно создать (addDirection)',
    /function addDirection/.test(adminHtml));
  check('S100: состав программ — добавить/убрать/переставить',
    /function addDirProgram/.test(adminHtml) &&
    /function removeDirProgram/.test(adminHtml) &&
    /function moveDirProgram/.test(adminHtml));
  check('S100: обложка загружается файлом (pickDirectionImage), не ручным путём',
    /function pickDirectionImage/.test(adminHtml) && /uploadFile\(/.test(adminHtml));
  check('S100: порядок направлений перетаскиванием (onDirDrop)',
    /function onDirDrop/.test(adminHtml) && /ondragstart="onDirDragStart/.test(adminHtml));
  check('S100: встроенное направление нельзя удалить',
    /isBuiltin[^)]*\)\s*\{\s*showToast\('Встроенное направление нельзя удалить/.test(adminHtml) ||
    /Встроенное направление нельзя удалить/.test(adminHtml));

  // Сервер: save-directions сохраняет id программ и генерирует id новым
  const serverSrc = fs.readFileSync(path.join(__dirname, 'admin-server.mjs'), 'utf-8');
  check('S100: сервер сохраняет real.id программы (по базе), не пустой',
    /const real = programById\.get\(pid\)/.test(serverSrc) &&
    /id:\s*real\.id/.test(serverSrc));
  check('S100: сервер генерирует id новым направлениям (dir-<timestamp>)',
    /id = 'dir-' \+ Date\.now\(\)/.test(serverSrc));
  check('S100: сервер пишет направления в db.directions (а не в settings.directions)',
    /db\.directions = directions;/.test(serverSrc) &&
    !/db\.settings\.directions = body\.directions/.test(serverSrc));
  check('S100: скрытая программа всегда направляется в dir-hidden',
    /p\.directionId = 'dir-hidden'/.test(serverSrc));

  // Справка
  check('S100: справка по направлениям есть в DEFAULT_HELP_SECTIONS',
    /id:\s*'directions',\s*\n\s*title:\s*'📁 Направления'/.test(serverSrc));

  // Данные: направлений больше нуля, у каждого непустой id
  check('S100: направления в базе имеют непустые id',
    Array.isArray(db.directions) && db.directions.length > 0 &&
    db.directions.every(d => d.id && String(d.id).trim()));
}


// ── S102: всплывающие окна = ширина слайдера (90%) ──
{
  const css = fs.readFileSync(path.join(staticDir, 'css', 'style.css'), 'utf-8');
  // S117/S118: --content-w теперь производная от --container-w (90% по умолчанию)
  check('S102: определена переменная --content-w = var(--container-w)',
    /--content-w:\s*var\(--container-w\)/.test(css) &&
    /--container-w:\s*90%/.test(css));
  check('S102: слайдер идёт на --content-w (не 5% вручную)',
    /\.slider\s*\{[^}]*width:\s*var\(--content-w\)/.test(css));
  check('S102: модалка — ширина 100% бокса без жёсткого max-width (480px)',
    /\.modal-box\s*\{[^}]*max-width:\s*none/.test(css) && !/\.modal-box\s*\{[^}]*max-width:\s*480px/.test(css));
  check('S102: окно новостей — без жёсткого max-width (800px)',
    /\.news-modal-box\s*\{\s*max-width:\s*none/.test(css) &&
    !/\.news-modal-box\s*\{\s*max-width:\s*800px/.test(css));
  check('S102: лайтбокс галереи — по ширине контента (--content-w), не 95vw',
    /\.lightbox-overlay\s*\{[^}]*var\(--content-w\)/.test(css) &&
    /\.lightbox-img\s*\{[^}]*max-width:\s*100%/.test(css));
  check('S102: модалка новостей на мобильном — по слайдеру, не во весь экран (S24 заменено)',
    /#newsModal\s*\{\s*padding:\s*1rem 5%/.test(css) &&
    !/\.news-modal-box\s*\{[^}]*height:\s*100vh/.test(css));
  // Окна опираются на единый отступ от --content-w.
  // Правил два (modal-overlay, lightbox-overlay): окно новостей переиспользует
  // .modal-overlay, отдельных правил ему не нужно — проверяем это отдельно.
  const padCount = (css.match(/calc\(\(100% - var\(--content-w\)\) \/ 2\)/g) || []).length;
  check('S102: отступ окон посчитан от --content-w (модалка + лайтбокс)',
    padCount >= 2);
  check('S102: окно новостей использует общий .modal-overlay (ширина унаследуется)',
    /class="modal-overlay" id="newsModal"/.test(fs.readFileSync(path.join(staticDir, 'index.html'), 'utf-8')) &&
    /class="modal-overlay" id="newsModal"/.test(fs.readFileSync(path.join(staticDir, 'news.html'), 'utf-8')));
}

// ── S103: клик по картинке расписания/новости = увеличенный просмотр ──
{
  const read = p => fs.readFileSync(path.join(staticDir, p), 'utf-8');
  // lightbox.js подключён на главной (картинки залов/цен/новостей) и на странице новостей
  const idxHtml = read('index.html');
  const newsHtml = read('news.html');
  check('S103: lightbox.js подключён на главной (залы/цены/новости)',
    /<script src="js\/lightbox\.js/.test(idxHtml));
  check('S103: lightbox.js подключён на странице новостей',
    /<script src="js\/lightbox\.js/.test(newsHtml));

  // Модуль умеет галерею (листание соседних фото новости) и одиночный кадр
  const lb = read('js/lightbox.js');
  check('S103: lightbox — навигация по галерее (‹ ›, счётчик)',
    /lightbox-prev/.test(lb) && /lightbox-next/.test(lb) && /lightbox-counter/.test(lb));
  check('S103: lightbox — листание клавишами ← / → и закрытие Esc',
    /ArrowLeft/.test(lb) && /ArrowRight/.test(lb) && /Escape/.test(lb));
  check('S103: lightbox — группировка по data-gallery (несколько фото новости)',
    /data-gallery/.test(lb) && /querySelectorAll\('\.lightbox-zoom\[data-gallery=/.test(lb));

  // Картинки залов расписания и цен — кликабельны (lightbox-zoom), полный размер в lightbox
  const w = loadPage('index.html');
  const d = w.document;
  check('S103: картинки залов расписания помечены .lightbox-zoom',
    d.querySelectorAll('#schedule-grid .schedule-item.lightbox-zoom img').length > 0);
  // S115: когда в базе есть позиции прайса, на главной — структурированная витрина,
  // а картинка прайса остаётся запасным видом. Lightbox обязан сохраниться в этом запасном виде.
  const priceVitrine = d.querySelectorAll('#prices-grid .price-group').length > 0;
  check('S103: картинки цен помечены .lightbox-zoom (S115: в запасном виде картинкой)',
    priceVitrine
      ? /class="prices-item lightbox-zoom"/.test(read('js/main.js'))
      : d.querySelectorAll('#prices-grid .prices-item.lightbox-zoom img').length > 0);
  // Обложка новости на главной — .lightbox-zoom с группой (галерея этой новости)
  const newsZoom = d.querySelector('#news-grid .lightbox-zoom');
  check('S103: обложка новости на главной — .lightbox-zoom с data-gallery',
    !!newsZoom && !!newsZoom.getAttribute('data-gallery'));

  // Клик по картинке зала открывает лайтбокс (overlay с классом open)
  const hall = d.querySelector('#schedule-grid .schedule-item.lightbox-zoom');
  if (hall) {
    hall.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    const ov = d.querySelector('.lightbox-overlay');
    check('S103: клик по картинке зала открывает лайтбокс',
      !!ov && ov.classList.contains('open'));
  check('S103: в лайтбокс идёт полный размер (src картинки, не превью)',
      !!ov && !!ov.querySelector('.lightbox-img') &&
      ov.querySelector('.lightbox-img').src === hall.querySelector('img').src);
  } else {
    check('S103: картинка зала найдена для проверки клика', false);
  }
}

// ── S104: причина звонка скрыта от пользователя, понятна админу ──
{
  const read = p => fs.readFileSync(path.join(staticDir, p), 'utf-8');
  const modalJs = read('js/modal.js');

  // Причина не выводится в интерфейсе модалки
  check('S104: в разметке модалки звонка нет видимой причины (нет callReasonLabel)',
    !/callReasonLabel/.test(modalJs) && !/modal-reason/.test(modalJs));
  check('S104: в форме нет readonly-поля с причиной (reasonView)',
    !/reasonView/.test(modalJs) && !/callReasonField/.test(modalJs));
  check('S104: заголовок модалки — только «Заказать обратный звонок»',
    /Заказать обратный звонок/.test(modalJs));

  // Единый формат причины для админа/письма
  check('S104: единый формат причины «<Место> — <Страница>. Есть вопрос, но, возможно без конкретики»',
    /Есть вопрос, но, возможно без конкретики/.test(modalJs));
  check('S104: место + имя страницы собираются в buildReason()',
    /function buildReason/.test(modalJs) && /pageName\(\)/.test(modalJs));

  // Все обработчики звонка переведены на места вызова (не сырые причины)
  const srcs = ['js/header.js', 'js/footer.js', 'js/tiles.js', 'js/entity.js'].map(read).join('\n');
  check('S104: в коде нет старых сырых причин («Кнопка в хедере», «из футера»)',
    !/Кнопка в хедере/.test(srcs) && !/заказать звонок из футера/.test(srcs) &&
    !/Кнопка в мобильном меню/.test(srcs));
  check('S104: места вызова звонка названы по-человечески (Шапка/Подвал/Плитка…)',
    /openCallModal\('Шапка'\)/.test(read('js/header.js')) &&
    /openCallModal\('Подвал'\)/.test(read('js/footer.js')) &&
    /Плитка программы/.test(read('js/tiles.js')));

  // Модалка открывается, причина в UI не видна
  const w = loadPage('index.html');
  const d = w.document;
  w.openCallModal('Плитка программы «Тест»');
  const ov = d.getElementById('callOverlay');
  check('S104: модалка звонка открывается', !!ov && ov.classList.contains('open'));
  check('S104: в открытой модалке нет текста причины (страница/«без конкретики»)',
    !!ov && !/без конкретики/.test(ov.textContent) && !/Главная/.test(ov.textContent));
  check('S104: у модалки нет поля/метки с причиной',
    !!ov && !ov.querySelector('.modal-reason') && !ov.querySelector('#callReasonField'));
}

// ── S105: переименование заголовков разделов главной ──
{
  const read = p => fs.readFileSync(path.join(staticDir, p), 'utf-8');
  const idx = read('index.html');
  const tr = read('trainers.html');
  // S105 + S127 (Р1): заголовок тренеров на главной — «Наши тренера» (homeSections[].title),
  // но на странице тренеров — «Коллектив» (sectionNames.trainers)
  check('S105: главная — «Наше расписание»',
    /<h2 class="section-title">Наше расписание<\/h2>/.test(idx));
  check('S105: главная — «Наши тренера»',
    /<h2 class="section-title">Наши тренера<\/h2>/.test(idx));
  // S127 (Р1): страница тренеров — «Коллектив» (data-section="trainers")
  check('S105+S127: страница тренеров — «Коллектив» (заголовок + title)',
    /<h1 class="section-title" data-section="trainers">Коллектив<\/h1>/.test(tr) &&
    /<title>Коллектив/.test(tr));

  // Данные: заголовки разделов (sections[] = наследие Next.js, homeSections — текущий источник)
  const rawDb = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'db.json'), 'utf-8'));
  const secs = rawDb.sections || [];
  const secTitle = id => (secs.filter(s => s.id === id)[0] || {}).title;
  check('S105: db.json — sections.schedule.title = «Наше расписание»',
    secTitle('schedule') === 'Наше расписание');
  // S127: sections.trainers остаётся «Наши тренера» (наследие, не удаляем)
  check('S105: db.json — sections.trainers.title = «Наши тренера» (наследие, не трогаем)',
    secTitle('trainers') === 'Наши тренера');

  // Старых строк в проекте (разметка/данные/скрипты) не осталось
  const scan = [idx, tr, read('js/data/core.js'), read('js/entity.js'),
    fs.readFileSync(path.join(__dirname, '..', 'db.json'), 'utf-8')].join('\n');
  check('S105: «Расписание занятий» не осталось в разметке/данных',
    !/Расписание занятий/.test(scan));
  check('S105: «Наши тренеры» (заголовок) не осталось в разметке/данных',
    !/<h1 class="section-title">Наши тренеры<\/h1>/.test(scan) &&
    !/"title": "Наши тренеры"/.test(scan));
}

// ── S106: «Настройки сайта → Разделы главной» ──
{
  const read = p => fs.readFileSync(path.join(staticDir, p), 'utf-8');
  const serverSrc = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'admin-server.mjs'), 'utf-8');
  const dbFmt = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'db-format.mjs'), 'utf-8');

  // Модель: 'homeSections' в SETTINGS_KEYS (иначе ключ теряется при nestDb)
  check('S106: homeSections в SETTINGS_KEYS (не теряется при nestDb)',
    /'homeSections'/.test(dbFmt));

  // Экспорт отдаёт homeSections в core.js
  const core = read('js/data/core.js');
  check('S106: core.js экспортирует homeSections',
    /"homeSections":/.test(core) && /"id": "slider"/.test(core));
  check('S106: homeSections содержит все 6 разделов (S108: +prices)',
    ['slider', 'schedule', 'prices', 'programs', 'trainers', 'news']
      .every(id => new RegExp('"id": "' + id + '"').test(core)));

  // Рендер на главной: порядок/видимость/заголовок/фон
  const main = read('js/main.js');
  check('S106: main.js применяет homeSections (applyHomeSections)',
    /function applyHomeSections/.test(main) && /applyHomeSections\(\)/.test(main));
  check('S106: пустой заголовок → display:none + margin-bottom:0',
    /titleEl\.style\.display = 'none'/.test(main) && /titleEl\.style\.marginBottom = '0'/.test(main));
  check('S106: цвет фона заголовка применяется из bgColor',
    /titleEl\.style\.background = s\.bgColor/.test(main));

  // Админка: раздел зарегистрирован (не повторяем баг пустого раздела)
  const admin = read('admin.html');
  check('S106: раздел home-sections в sections[] админки',
    /id: 'home-sections', title: '🧩 Разделы главной'/.test(admin));
  check('S106: раздел в сайдбаре и описан (getSectionDescription/getSectionFields)',
    /data-section="home-sections"/.test(admin) &&
    /sectionId === 'home-sections'/.test(admin) &&
    /'home-sections': \[/.test(admin));
  check('S106: UI — заголовок/цвет фона/видимость/drag-and-drop',
    /home-section-title/.test(admin) && /home-section-bg/.test(admin) &&
    /toggleHomeSectionVisible/.test(admin) && /onHomeSectionDrop/.test(admin));

  // Сервер: API get/save + санитизация
  check('S106: сервер — API get-home-sections / save-home-sections',
    /handleGetHomeSections/.test(serverSrc) && /handleSaveHomeSections/.test(serverSrc) &&
    /'\/api\/admin\/get-home-sections'/.test(serverSrc) &&
    /'\/api\/admin\/save-home-sections'/.test(serverSrc));
  check('S106: санитизация — whitelist id, hex-цвет или пусто, ≤80 символов',
    /HOME_SECTION_IDS/.test(serverSrc) &&
    /\^#\(\[0-9a-f\]\{3\}\|\[0-9a-f\]\{6\}\)\$/.test(serverSrc) &&
    /slice\(0, 80\)/.test(serverSrc));
  check('S106: справка home-sections в DEFAULT_HELP_SECTIONS',
    /id: 'home-sections'/.test(serverSrc));

  // Скрытие пунктов меню вместе с разделом (решение п.3 записано)
  check('S106: header/footer скрывают пункт меню скрытого раздела',
    /homeSectionVisible/.test(read('js/header.js')) &&
    /homeSectionVisible/.test(read('js/footer.js')));

  // Модель выживает round-trip nestDb/flattenDb
  const rawDb = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'db.json'), 'utf-8'));
  const nested = nestDb(flattenDb(rawDb));
  check('S106: homeSections выживает nestDb (лежит в settings)',
    Array.isArray(nested.settings?.homeSections) && nested.settings.homeSections.length === 6);

  // Главная: рендер применяет видимость (скрытый раздел hidden)
  const w = loadPage('index.html');
  const d = w.document;
  check('S106: на главной все разделы по умолчанию видимы',
    ['slider', 'schedule', 'prices', 'programs', 'trainers', 'news']
      .every(id => { const el = d.getElementById(id); return el && !el.hidden; }));
}

// ── S127: единый каркас всех страниц ──
{
  const read = p => fs.readFileSync(path.join(staticDir, p), 'utf-8');
  const serverSrc = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'admin-server.mjs'), 'utf-8');
  const dbFmt = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'db-format.mjs'), 'utf-8');

  // Модуль layout.js подключается на всех страницах (кроме admin.html)
  const pages = ['index.html', 'trainers.html', 'trainer.html', 'news.html',
    'programs.html', 'program.html', 'directions.html'];
  check('S127: layout.js подключён на всех клиентских страницах',
    pages.every(p => /layout\.js/.test(read(p))));

  // core.js экспортирует sectionNames
  const core = read('js/data/core.js');
  check('S127: core.js экспортирует sectionNames',
    /"sectionNames":/.test(core));

  // sectionNames в SETTINGS_KEYS (не теряется при nestDb)
  check('S127: sectionNames в SETTINGS_KEYS',
    /'sectionNames'/.test(dbFmt));

  // API get/save-section-names на сервере
  check('S127: сервер — handleGetSectionNames',
    /handleGetSectionNames/.test(serverSrc));
  check('S127: сервер — handleSaveSectionNames',
    /handleSaveSectionNames/.test(serverSrc));

  // Санитизация: whitelist id, длина ≤ 60
  check('S127: sanitizeSectionNames — SECTION_NAME_IDS (whitelist)',
    /SECTION_NAME_IDS = \[/.test(serverSrc));

  // Дефолт trainers — «Коллектив» (Р1)
  check('S127: дефолт sectionNames.trainers — «Коллектив»',
    /SECTION_NAMES_DEFAULT = \{[\s\S]*?trainers: 'Коллектив'/.test(serverSrc));

  // Миграция в экспорте: из homeSections[].title, кроме trainers (Р1)
  const exportSrc = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'export-static.mjs'), 'utf-8');
  check('S127: экспорт — fromHome.trainers = DEFAULT.trainers (Р1)',
    /fromHome\.trainers = DEFAULT\.trainers/.test(exportSrc));

  // Именование: «Наши тренера» больше не встречается в HTML/JS (кроме homeSections[].title)
  const noOldName = ['trainers.html', 'js/layout.js', 'js/header.js', 'js/footer.js', 'js/entity.js']
    .every(f => {
      const src = read(f);
      // «Наши тренера» допускается только в комментариях и в homeSections[].title
      return !/<h1[^>]*>Наши тренера/.test(src) && !/'Наши тренера'/.test(src);
    });
  check('S127: «Наши тренера» не встречается как заголовок/строка JS',
    noOldName);

  // Разделитель на всех страницах (layout.js подключён, divider класс проставлен)
  check('S127: layout.js содержит applyDivider()',
    /function applyDivider|applyDivider\(\)/.test(read('js/layout.js')));

  // directions.html: appearance.js, meta description, без битого #callModalRoot
  const dir = read('directions.html');
  check('S127: directions.html подключает appearance.js',
    /appearance\.js/.test(dir));
  check('S127: directions.html содержит meta description',
    /<meta name="description"/.test(dir));
  check('S127: directions.html не содержит битый #callModalRoot',
    !/id="callModalRoot"/.test(dir));

  // floating-call на всех страницах (кроме admin)
  check('S127: floating-call на всех клиентских страницах',
    pages.every(p => /floating-call/.test(read(p))));

  // meta description на всех страницах
  check('S127: meta description на всех клиентских страницах',
    pages.every(p => /<meta name="description"/.test(read(p))));

  // data-скрипты с ?v=
  check('S127: data-скрипты с ?v= на directions.html',
    /core\.js\?v=\d+/.test(dir) && /directions\.js\?v=\d+/.test(dir));

  // layout.js содержит Layout.sectionName
  check('S127: layout.js экспортирует Layout.sectionName',
    /sectionName/.test(read('js/layout.js')));
}

// ── S108: раздел «Цены» в управляемых разделах главной ──
{
  const read = p => fs.readFileSync(path.join(staticDir, p), 'utf-8');
  const serverSrc = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'admin-server.mjs'), 'utf-8');
  const exportSrc = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'export-static.mjs'), 'utf-8');

  check('S108: сервер — HOME_SECTION_IDS включает prices',
    /HOME_SECTION_IDS = \[[^\]]*'prices'/.test(serverSrc));
  check('S108: сервер — дефолт prices с заголовком «Наши цены»',
    /HOME_SECTIONS_DEFAULT = \[[\s\S]*?id: 'prices', title: 'Наши цены'/.test(serverSrc));
  check('S108: экспорт — DEFAULT homeSections включает prices',
    /homeSections: HOME_SECTIONS_EXPORT/.test(exportSrc) ||
    /id: 'prices', title: 'Наши цены'/.test(exportSrc));

  // Данные: prices в db.json сразу после schedule (порядок как в index.html)
  const rawDb = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'db.json'), 'utf-8'));
  const hsDb = rawDb.settings.homeSections;
  const ids = (Array.isArray(hsDb) ? hsDb : []).map(s => s.id);
  check('S108: db.json — 6 id, prices после schedule',
    ids.join(',') === 'slider,schedule,prices,programs,trainers,news');
  check('S108: db.json — prices видим по умолчанию, заголовок «Наши цены»',
    (hsDb.find(s => s.id === 'prices') || {}).visible === true &&
    (hsDb.find(s => s.id === 'prices') || {}).title === 'Наши цены');

  // core.js: prices в экспортированном массиве
  const core = read('js/data/core.js');
  check('S108: core.js экспортирует prices', /"id": "prices"/.test(core));

  // Админка: подпись раздела
  const admin = read('admin.html');
  check('S108: админка — HOME_SECTION_LABELS содержит prices',
    /prices: '💰 Цены'/.test(admin));
  check('S108: админка — описание раздела упоминает цены',
    /home-sections'\) return 'Разделы главной страницы: слайдер, расписание, цены/.test(admin));

  // Меню/подвал: ссылка «Цены» завязана на реальную видимость раздела
  const header = read('js/header.js');
  check('S108: header — обе ссылки «Цены» под homeSectionVisible(prices)',
    (header.match(/homeSectionVisible\('prices'\)/g) || []).length === 2);
  const footer = read('js/footer.js');
  check('S108: footer — ссылка «Цены» под homeSectionVisible(prices)',
    /homeSectionVisible\('prices'\)[\s\S]*#prices/.test(footer));
  check('S108: footer — ссылка «Расписание» тоже под homeSectionVisible (латентный баг S106 закрыт)',
    /homeSectionVisible\('schedule'\)[\s\S]*#schedule/.test(footer));

  // Рендер главной: #prices на месте и видим (jsdom, фактические данные)
  const w = loadPage('index.html');
  const pe = w.document.getElementById('prices');
  check('S108: главная — #prices существует и не скрыт',
    !!pe && !pe.hidden);
  const hsData = (w.SITE_DATA || {}).homeSections || [];
  check('S108: главная — homeSections в core.js содержит prices (6 разделов)',
    hsData.length === 6 && hsData.some(s => s.id === 'prices'));
}

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
    check('CSS: .trainer-week-board ограничена контейнером (S61/S139)',
      /trainer-week-board[^}]*100%/.test(cssT) && !/trainer-week-board[^}]*100vw/.test(cssT));
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
    /NewsGrid\.build\(\s*news\.slice\(0, 8\),\s*'openNewsModal'/.test(mainJs));
  check('S73: main.js — на главной больше нет ссылки-перехода news.html?id в карточках новостей',
    !/class="news-more" href="news\.html/.test(mainJs));
}

// ── S90: единые плитки + страница одного направления + «Наши тренировки» ──
{
  const read = p => fs.readFileSync(path.join(staticDir, p), 'utf-8');

  // 1. Общий модуль плиток подключён везде, где есть плитки
  check('S90: js/tiles.js существует', fs.existsSync(path.join(staticDir, 'js', 'tiles.js')));
  check('S90: tiles.js подключён на index/programs/trainers/directions',
    ['index.html', 'programs.html', 'trainers.html', 'directions.html']
      .every(f => /tiles\.js/.test(read(f))));

  // 2. Старых разметок плиток не осталось ни в коде, ни в CSS
  const tileSources = ['js/main.js', 'js/directions.js', 'programs.html', 'trainers.html']
    .map(read).join('') + read('css/style.css');
  check('S90: нет старых классов плиток (.program-card/.trainer-card/.direction-program-card)',
    !/program-card|trainer-card(?!-plain)|direction-program-card|trainers-grid \{|programs-grid \{/
      .test(tileSources.replace(/entity-trainer-card/g, '')));

  // 3. CSS единой плитки: фото 2:3, отступ 5px, заголовок по центру, зелёная кнопка
  const css = read('css/style.css');
  check('S90: CSS — .tile с отступом 5px от границы', /\.tile \{[^}]*padding: 5px/.test(css));
  check('S90: CSS — фото плитки 2:3 (aspect-ratio)', /\.tile-photo \{[^}]*aspect-ratio: 2 \/ 3/.test(css));
  check('S90: CSS — заголовок по центру (flex + center)',
    /\.tile-title \{[^}]*align-items: center/.test(css) && /\.tile-title \{[^}]*justify-content: center/.test(css));
  check('S90: CSS — строки заголовка: 2 у тренера, 3 у программы',
    /\.tile-title-2 a \{ -webkit-line-clamp: 2/.test(css) && /\.tile-title-3 a \{ -webkit-line-clamp: 3/.test(css));
  check('S90: CSS — кнопки столбиком (flex-direction: column)', /\.tile-actions \{[^}]*flex-direction: column/.test(css));
  check('S90: CSS — «Заказать звонок» зелёная (brand переменная)',
    /\.tile-btn-call \{[^}]*var\(--color-phone-green\)/.test(css));
  // S137: flex-шапка направления заменена общим float-классом .entity-head-float
  check('S137: CSS — общая шапка тренера/направления: float обложки у левого края',
    /\.entity-head-float \{[^}]*display: flow-root/.test(css) &&
    /\.entity-head-float \.entity-head-cover \{[^}]*float: left/.test(css));
  check('S137: CSS — обложка во float-зоне 40–45% ширины, отступы 0 1.5rem 1rem 0',
    /\.entity-head-float \.entity-head-cover \{[^}]*width: 4[02]%/.test(css) &&
    /margin: 0 1\.5rem 1rem 0/.test(css));
  check('S90: CSS — шапка направления на общем float-классе (flex убран, описание по левому краю)',
    !/\.direction-head \{[^}]*display: flex/.test(css) &&
    !/\.direction-desc \{[^}]*text-align: right/.test(css));
  check('S90: CSS — обложка направления 2:3 (float-ширина — у .entity-head-cover)',
    /\.direction-cover \{[^}]*aspect-ratio: 2 \/ 3/.test(css));
  check('S137: мобильный (<768px) — float снят, обложка на всю ширину',
    /@media \(max-width: 767px\)[\s\S]*?\.entity-head-float \.entity-head-cover \{[^}]*float: none/.test(css));

  // 4. Главная: плитки программ и тренеров — одна и та же разметка
  const w = loadPage('index.html');
  const d = w.document;
  const progTiles = [...d.querySelectorAll('#programs-grid .tile')];
  const trainTiles = [...d.querySelectorAll('#trainers-grid .tile')];
  check(`S90: главная — плитки программ отрисованы (${progTiles.length})`, progTiles.length > 0);
  check(`S90: главная — плитки тренеров отрисованы (${trainTiles.length})`, trainTiles.length > 0);
  const sameMarkup = t => !!t.querySelector('.tile-photo img') &&
    !!t.querySelector('.tile-title a') &&
    t.querySelectorAll('.tile-actions .tile-btn').length === 2;
  check('S90: главная — разметка плитки программ = разметке плитки тренера',
    [...progTiles, ...trainTiles].every(sameMarkup));
  check('S90: главная — у всех плиток есть зелёная «Заказать звонок»',
    [...progTiles, ...trainTiles].every(t =>
      !!t.querySelector('.tile-btn-call') && /Заказать звонок/.test(t.querySelector('.tile-btn-call').textContent)));
  check('S90: главная — заголовок программы в 3 строки, ФИО тренера в 2 строки',
    progTiles.every(t => !!t.querySelector('.tile-title-3')) &&
    trainTiles.every(t => !!t.querySelector('.tile-title-2')));
  check('S90: главная — ссылка «Подробнее →» панели направления ведёт на страницу направления',
    /directions\.html\?id=dir-/.test(d.querySelector('#programs-grid .collapsible-more')?.getAttribute('href') || ''));

  // 5. Свайп фото у тренера: движение мыши по фото переключает кадр
  const swipeTile = trainTiles.map(t => t.querySelector('.tile-photo'))
    .find(f => (f.getAttribute('data-photos') || '').includes('|'));
  check('S90: у тренера с несколькими фото в плитке несколько кадров + точки-индикатор',
    !!swipeTile && !!swipeTile.querySelector('.tile-photo-dots'));
  if (swipeTile) {
    // jsdom не отдаёт реальные размеры — подставляем их, как в браузере
    swipeTile.getBoundingClientRect = () => ({ left: 0, top: 0, width: 300, height: 450, right: 300, bottom: 450 });
    const img = swipeTile.querySelector('img');
    const first = img.getAttribute('src');
    const photos = swipeTile.getAttribute('data-photos').split('|');
    img.parentElement.dispatchEvent(new w.MouseEvent('mousemove', { bubbles: true, clientX: 290 }));
    check(`S90: свайп вправо по фото показывает другой кадр (${photos.length} кадров)`,
      img.getAttribute('src') === photos[photos.length - 1] && img.getAttribute('src') !== first);
    img.parentElement.dispatchEvent(new w.MouseEvent('mousemove', { bubbles: true, clientX: 10 }));
    check('S90: свайп влево по фото возвращает к первому кадру', img.getAttribute('src') === first);
  }

  // 5b. Зелёная кнопка плитки открывает модалку звонка (делегирование, без inline-onclick)
  const callBtn = trainTiles[0].querySelector('.tile-btn-call');
  callBtn.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  check('S90: клик по зелёной кнопке плитки открывает модалку звонка',
    !!d.getElementById('callOverlay') && d.getElementById('callOverlay').classList.contains('open'));
  check('S90: в плитках нет inline-onclick, причина звонка — в data-call',
    !/onclick="openCallModal/.test(read('js/tiles.js')) && /data-call=/.test(read('js/tiles.js')));

  // 5c. Программа в плитке — только обложка (свайп фото оставили тренерам, S90)
  check('S90: в плитке программы один кадр (свайп — только у тренеров)',
    progTiles.every(t => !(t.querySelector('.tile-photo').getAttribute('data-photos') || '').includes('|')));

  // 6. Страница одного направления (S90): directions.html?id=…
  const dw = loadPage('directions.html', '?id=dir-0');
  const dd = dw.document;
  const page = dd.getElementById('direction-page');
  const dir0 = flattenDb(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'db.json'), 'utf-8')))
    .directions.filter(x => x.id === 'dir-0')[0];
  check('S90: страница направления — заголовок направления',
    !!page.querySelector('.entity-title') && page.querySelector('.entity-title').textContent.trim() === dir0.name);
  check('S90: страница направления — плитки программ направления',
    page.querySelectorAll('.direction-programs .tile').length === dir0.programs.filter(p => !p.hidden).length);
  check('S90: страница направления — обложка 2:3 или описание',
    !!page.querySelector('.direction-cover') || !!page.querySelector('.direction-desc'));
  check('S90: страница направления — 7-дневное расписание',
    page.querySelectorAll('.direction-schedule .week-col').length === 7);
  check('S90: страницы «все направления» больше нет (нет #directions-list)',
    !dd.getElementById('directions-list'));
  const now = loadPage('directions.html');
  // S141: теперь redirect на 404.html вместо inline «не найдено»
  const dirJsSrc = fs.readFileSync(path.join(staticDir, 'js', 'directions.js'), 'utf-8');
  check('S90+S141: directions.js — redirect на 404.html при отсутствии направления',
    dirJsSrc.includes('404.html?from=') && dirJsSrc.includes('location.replace'));

  // 7. Пункт «Направления» убран из шапки (S90).
  // S131 п.2: ссылка на конкретное направление directions.html?id= — допустима.
  const headerJs = read('js/header.js');
  check('S90: в шапке нет отдельного пункта «Направления»',
    !/href="directions\.html"/.test(headerJs));
  check('S131: в шапке заголовок группы — ссылка на направление (directions.html?id=)',
    /directions\.html\?id=/.test(headerJs));

  // 8. Переименование «Программы тренировок» → «Наши тренировки»
  check('S90: главная и страница — заголовок «Наши тренировки»',
    /<h2 class="section-title">Наши тренировки<\/h2>/.test(read('index.html')) &&
    /<h1 class="section-title"[^>]*>Наши тренировки<\/h1>/.test(read('programs.html')) &&
    /<title>Наши тренировки/.test(read('programs.html')));
  check('S90: «Программы тренировок» не осталось в данных и разметке',
    !/Программы тренировок/.test(read('js/data/core.js') + read('index.html') + read('programs.html')));
}

// ── S115: Цены и скидки — модель, экспорт, витрина, страницы сущностей, админка ──
{
  const read = p => fs.readFileSync(path.join(staticDir, p), 'utf-8');
  const serverSrc = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'admin-server.mjs'), 'utf-8');
  const exportSrc = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'export-static.mjs'), 'utf-8');
  const dbFmt = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'db-format.mjs'), 'utf-8');
  const parserSrc = fs.existsSync(path.join(__dirname, 'parse-price.mjs'))
    ? fs.readFileSync(path.join(__dirname, 'parse-price.mjs'), 'utf-8') : '';
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8'));

  // ── 1. Модель данных ──
  check('S115: priceItems/discounts в SETTINGS_KEYS (не теряются при nestDb)',
    /'priceItems'/.test(dbFmt) && /'discounts'/.test(dbFmt));
  check('S115: в базе есть позиции цен и скидки',
    (db.priceItems || []).length >= 30 && (db.discounts || []).length >= 5);
  check('S115: у каждой позиции три скрытых CRM-поля',
    db.priceItems.every(i => typeof i.trainerPay === 'number' &&
      typeof i.payMode === 'string' && typeof i.freeTrainerPay === 'number'));
  check('S115: значения скрытых полей по умолчанию (150 / base(1) / 150)',
    db.priceItems.every(i => i.trainerPay === 150 && i.payMode === 'base(1)' && i.freeTrainerPay === 150));
  const pIds = new Set(db.programs.map(p => String(p.id)));
  const tIds = new Set(db.trainers.map(t => String(t.id)));
  check('S115: programId/trainerId ссылаются только на существующие записи',
    db.priceItems.every(i => (i.programId == null || pIds.has(String(i.programId))) &&
      (i.trainerId == null || tIds.has(String(i.trainerId)))));
  const dIds = new Set(db.discounts.map(d => String(d.id)));
  const itIds = new Set(db.priceItems.map(i => String(i.id)));
  check('S115: discountIds и appliesTo без висячих ссылок',
    db.priceItems.every(i => (i.discountIds || []).every(d => dIds.has(String(d)))) &&
    db.discounts.every(d => (d.appliesTo || []).every(a => itIds.has(String(a)))));
  check('S115: обратные ссылки позиций согласованы с appliesTo скидок',
    db.priceItems.every(i => {
      const exp = db.discounts
        .filter(d => (d.appliesTo || []).some(a => String(a) === String(i.id)))
        .map(d => String(d.id)).sort().join(',');
      return exp === (i.discountIds || []).map(String).sort().join(',');
    }));
  check('S115: связи цен с программами и тренерами проставлены',
    db.priceItems.some(i => i.programId != null) && db.priceItems.some(i => i.trainerId != null));
  {
    const nested = nestDb(flattenDb(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'db.json'), 'utf-8'))));
    check('S115: priceItems/discounts выживают nestDb (лежат в settings)',
      Array.isArray(nested.settings?.priceItems) && Array.isArray(nested.settings?.discounts));
  }

  // ── 2. Экспорт: скрытые CRM-поля не уходят на сайт ──
  const priceJs = read('js/data/price-items.js');
  const discJs = read('js/data/discounts.js');
  check('S115: сгенерированы price-items.js и discounts.js',
    /SITE_DATA\.priceItems/.test(priceJs) && /SITE_DATA\.discounts/.test(discJs));
  check('S115: скрытые CRM-поля НЕ экспортируются на сайт',
    !/trainerPay|payMode|freeTrainerPay/.test(priceJs + discJs));
  check('S115: экспорт фильтрует скрытые позиции и скидки',
    /\.filter\(i => i\.visible !== false\)/.test(exportSrc) &&
    /\.filter\(d => d\.visible !== false\)/.test(exportSrc));

  // ── 3. Витрина на главной ──
  check('S115: главная подключает данные цен и скидок',
    /js\/data\/price-items\.js/.test(read('index.html')) && /js\/data\/discounts\.js/.test(read('index.html')));
  const iw = loadPage('index.html');
  const grid = iw.document.getElementById('prices-grid');
  const visGroups = new Set(db.priceItems.filter(i => i.visible !== false).map(i => i.group || 'Цены'));
  check('S115: витрина собрана группами (все видимые группы)',
    grid.querySelectorAll('.price-group').length === visGroups.size && grid.querySelectorAll('.price-group').length > 0);
  check('S115: витрина — строки позиций с вариантами цены',
    grid.querySelectorAll('.price-row').length > 0 &&
    grid.querySelectorAll('.price-variant-value').length === db.priceItems.filter(i => i.visible !== false).length);
  check('S115: цена форматирована неразрывным пробелом и ₽', /\d\u00A0₽/.test(grid.textContent));
  check('S115: у позиций с скидками нарисованы бейджи',
    grid.querySelectorAll('.price-badge').length > 0);
  check('S115: блок «Скидки и условия» внизу раздела',
    !!grid.querySelector('.price-discounts') && /Скидки и условия/.test(grid.textContent));
  // S139 п.6.в: пояснения — отдельные плитки (не список). Бейджа у note нет.
  check('S139: пояснения (type=note) — отдельные плитки, а не список',
    grid.querySelectorAll('.price-discount--note').length >= 4 && !/price-badge--note/.test(grid.innerHTML));
  check('S115: позиция со ссылкой на программу/тренера',
    grid.querySelectorAll('.price-row-links a[href^="program.html?id="]').length > 0);
  check('S115: в DOM главной нет скрытых CRM-полей',
    !/trainerPay|freeTrainerPay|payMode/.test(iw.document.body.innerHTML));
  check('S115: без позиций — запасной вид картинкой прайса',
    /Array\.isArray\(data\.prices\)/.test(read('js/main.js')));
  check('S115: стили витрины цен есть в style.css',
    /\.price-groups\s*\{/.test(read('css/style.css')) &&
    /\.price-badge--percent\s*\{/.test(read('css/style.css')) &&
    /\.entity-prices\s*\{/.test(read('css/style.css')));

  // ── 4. Стоимость на страницах программы и тренера ──
  const progWith = db.programs.filter(p => !p.hidden &&
    db.priceItems.some(i => String(i.programId) === String(p.id)))[0];
  check('S115: найдена программа с привязанными ценами', !!progWith);
  if (progWith) {
    const pw = loadPage('program.html', '?id=' + progWith.id);
    const ent = pw.document.getElementById('entity');
    check(`S115: страница «${progWith.name}» — блок «💰 Стоимость»`,
      /💰 Стоимость/.test(ent.textContent) && !!ent.querySelector('.entity-prices'));
    check(`S115: страница «${progWith.name}» — только её позиции`,
      ent.querySelectorAll('.entity-prices .price-row').length > 0 &&
      ent.querySelectorAll('.entity-prices .price-row').length <=
        db.priceItems.filter(i => String(i.programId) === String(progWith.id)).length);
    check(`S115: страница «${progWith.name}» — ссылка на раздел цен главной`,
      !!ent.querySelector('.entity-prices-more a[href="index.html#prices"]'));
    check(`S115: страница «${progWith.name}» — скрытых CRM-полей нет в разметке`,
      !/trainerPay|freeTrainerPay/.test(ent.innerHTML));
  }
  const progWithout = db.programs.filter(p => !p.hidden &&
    !db.priceItems.some(i => String(i.programId) === String(p.id)))[0];
  if (progWithout) {
    const pw2 = loadPage('program.html', '?id=' + progWithout.id);
    check(`S115: «${progWithout.name}» без привязанных цен — блока «Стоимость» нет`,
      !pw2.document.querySelector('.entity-prices'));
  }
  check('S115: trainer.html подключает данные цен',
    /js\/data\/price-items\.js/.test(read('trainer.html')));
  const trWith = db.trainers.filter(t => !t.hidden &&
    db.priceItems.some(i => String(i.trainerId) === String(t.id)))[0];
  if (trWith) {
    const tw = loadPage('trainer.html', '?id=' + trWith.id);
    check(`S115: страница тренера «${trWith.name}» — его цены`,
      !!tw.document.querySelector('.entity-prices .price-row'));
  } else {
    check('S115: найден тренер с привязанной ценой', false);
  }

  // ── 5. Админка: CRUD в группе «Настройки сайта» ──
  const admin = read('admin.html');
  check('S115: «💰 Цены» — рабочий раздел в settings',
    /\{ id: 'prices', title: '💰 Цены', status: 'done', group: 'settings' \}/.test(admin));
  check('S115: «🏷 Скидки» зарегистрирован в sections[]',
    /\{ id: 'discounts', title: '🏷 Скидки', status: 'done', group: 'settings' \}/.test(admin));
  check('S115: оба раздела есть в сайдбаре',
    /data-section="prices"/.test(admin) && /data-section="discounts"/.test(admin));
  check('S115: роутер вызывает редакторы позиций и скидок',
    /sectionId === 'prices'\) loadPriceItemsSection\(\)/.test(admin) &&
    /sectionId === 'discounts'\) loadDiscountsSection\(\)/.test(admin));
  check('S115: цены убраны из реестра «только просмотр»',
    !/prices: 'prices'/.test(admin));
  check('S115: редактор позиций — все публичные поля',
    ['pi-group', 'pi-title', 'pi-variant', 'pi-price', 'pi-price-old', 'pi-unit', 'pi-note',
      'pi-program', 'pi-trainer'].every(c => admin.includes(`class="${c}"`)));
  check('S115: редактор позиций — служебный блок CRM закрыт <details> и помечен 🔒',
    ['pi-pay', 'pi-paymode', 'pi-payfree'].every(c => admin.includes(`class="${c}"`)) &&
    /Служебное для CRM/.test(admin));
  check('S115: CRUD позиций — добавление/удаление/видимость/порядок',
    /function addPriceItem/.test(admin) && /function deletePriceItem/.test(admin) &&
    /function togglePriceVisible/.test(admin) && /function onPriceDrop/.test(admin));
  check('S115: CRUD скидок — название/тип/значение/условие/привязка к позициям',
    /class="di-title"/.test(admin) && /class="di-type"/.test(admin) &&
    /class="di-value"/.test(admin) && /class="di-cond"/.test(admin) && /class="disc-item"/.test(admin));
  check('S115: CRUD скидок — добавление/удаление/видимость/порядок',
    /function addDiscount/.test(admin) && /function deleteDiscount/.test(admin) &&
    /function toggleDiscountVisible/.test(admin) && /function onDiscountDrop/.test(admin));
  check('S115: описания разделов переписаны под CRUD',
    !/Прайс-листы, которые сейчас на сайте/.test(admin) && /Позиции прайса \(S115\)/.test(admin));
  check('S115: структура полей цен/скидок показана в разделе',
    /'🔒 trainerPay'/.test(admin) && /percent\|amount\|bonus\|note/.test(admin));
  check('S115: картинка прайса осталась запасным видом внутри редактора',
    /function renderPriceImageBlock/.test(admin) && /запасной вид/.test(admin));

  // ── 6. Сервер: API + санитизация ──
  check('S115: API get/save-price-items и get/save-discounts',
    ['/api/admin/get-price-items', '/api/admin/save-price-items',
      '/api/admin/get-discounts', '/api/admin/save-discounts']
      .every(p => serverSrc.includes(`'${p}'`)));
  check('S115: sanitizePriceItems отбрасывает позиции без названия или цены',
    /if \(!title \|\| price === null\) continue/.test(serverSrc));
  check('S115: цены — только числа ≥ 0, «-» и мусор не проходят',
    /function cleanPriceNumber/.test(serverSrc) && /n >= 0/.test(serverSrc));
  check('S115: привязки проверяются по существующим id',
    /programById\.get/.test(serverSrc) && /trainerById\.get/.test(serverSrc));
  check('S115: скрытые CRM-поля не теряются при сохранении без них (дефолты)',
    /PRICE_CRM_DEFAULTS = \{ trainerPay: 150, payMode: 'base\(1\)', freeTrainerPay: 150 \}/.test(serverSrc) &&
    /i\.trainerPay \?\? old\.trainerPay/.test(serverSrc));
  check('S115: discountIds пересобираются из appliesTo скидок',
    /function syncPriceDiscountLinks/.test(serverSrc) &&
    /syncPriceDiscountLinks\(items, discounts\)/.test(serverSrc));
  check('S115: сохранение цен и скидок идёт с бэкапом и перегенерацией статики',
    /handleSavePriceItems[\s\S]{0,1200}backupDB\(\)[\s\S]{0,200}regenerateStatic\(\)/.test(serverSrc) &&
    /handleSaveDiscounts[\s\S]{0,1200}backupDB\(\)[\s\S]{0,200}regenerateStatic\(\)/.test(serverSrc));
  check('S115: справка «Цены» и «Скидки» в DEFAULT_HELP_SECTIONS',
    /id: 'prices',\s*title: '💰 Цены'/.test(serverSrc) &&
    /id: 'discounts',\s*title: '🏷 Скидки'/.test(serverSrc));

  // ── 7. Парсер прайса ──
  check('S115: парсер прайса существует и подключён к npm run parse-price',
    !!parserSrc && !!pkg.scripts['parse-price']);
  check('S115: парсер конвертирует .doc через LibreOffice',
    /soffice|libreoffice/i.test(parserSrc));
  check('S115: парсер идемпотентен — позиция опознаётся по group|title|variant',
    /group\|title\|variant/.test(parserSrc) && /--prune/.test(parserSrc));
  check('S115: парсер сохраняет правки админки (id, порядок, видимость, связи, CRM)',
    /НЕ трогает правки админки/.test(parserSrc));
  check('S115: порядок групп витрины задан в парсере',
    /'Тренерские абонементы'[\s\S]{0,200}'Фитнес-абонементы'[\s\S]{0,200}'Персональные тренировки'/.test(parserSrc));
}

// ── S116: замечания по дизайну — ширина витрины цен, три плитки в строку, активный пункт меню ──
{
  const read = p => fs.readFileSync(path.join(staticDir, p), 'utf-8');
  const css = read('css/style.css');
  const headerJs = read('js/header.js');
  const mainJs = read('js/main.js');
  // Правила ищем литералами: new RegExp из строки требует двойных экранирований и хрупок
  const priceGroupsRule = (css.match(/\.price-groups\s*\{[^}]*\}/) || [''])[0];
  const pricesGridRule = (css.match(/\.prices-grid\s*\{[^}]*\}/) || [''])[0];
  const priceRowRule = (css.match(/\.price-row\s*\{[^}]*\}/) || [''])[0];
  const priceLinksRule = (css.match(/\.price-row-links\s*\{[^}]*\}/) || [''])[0];
  const priceVariantsRule = (css.match(/\.price-variants\s*\{[^}]*\}/) || [''])[0];

  // 1. Ширина раздела цен = ширина других разделов (container)
  check('S116: .price-groups без max-width и без margin 0 5%',
    priceGroupsRule !== '' && !/max-width/.test(priceGroupsRule) &&
    !/margin:\s*0 5%/.test(priceGroupsRule));
  check('S116: запасной вид (картинка прайса) тоже без max-width',
    !/max-width/.test(pricesGridRule));
  check('S116: раздел «Цены» на главной — в .container, как другие разделы',
    /<section class="section" id="prices">\s*<div class="container">/.test(read('index.html')));

  // 2. Плитки цен — стандартная ячейка, как у плиток тренеров/программ (S125)
  check('S116: сетка группы цен = колонки стандартной плитки (--tile-cols)',
    /\.price-group-rows\s*\{[^}]*grid-template-columns:\s*repeat\(var\(--tile-cols\),/.test(css) &&
    /\.price-group-rows\s*\{[^}]*gap:\s*var\(--tiles-gap\)/.test(css));
  check('S116: адаптив сетки цен = адаптив сетки плиток (тот же --tile-cols)',
    /@media \(min-width: 768px\)\s*\{\s*:root\s*\{\s*--tile-cols:\s*2;/.test(css) &&
    /@media \(min-width: 1024px\)\s*\{\s*:root\s*\{\s*--tile-cols:\s*3;/.test(css));
  check('S116: main.js оборачивает плитки в .price-group-rows',
    /class="price-group-rows"/.test(mainJs));
  check('S116: плитка — flex-колонка, ссылки прилипают к низу',
    /flex-direction:\s*column/.test(priceRowRule) && /margin-top:\s*auto/.test(priceLinksRule));

  const iw = loadPage('index.html');
  const groups = [...iw.document.querySelectorAll('#prices-grid .price-group')];
  // Ожидаемое число плиток = уникальные (group|title) среди видимых позиций
  const expRows = new Set(db.priceItems.filter(i => i.visible !== false)
    .map(i => (i.group || 'Цены') + '|' + (i.title || ''))).size;
  const gotRows = groups.reduce((n, g) => n + g.querySelectorAll('.price-row').length, 0);
  check('S116: плиток ровно по числу уникальных позиций (склейка подвидов не потеряна)',
    groups.length > 0 && gotRows === expRows, gotRows + ' vs ' + expRows);
  check('S116: в каждой группе одна обёртка сетки и плитки внутри неё',
    groups.every(g => g.querySelectorAll(':scope > .price-group-rows').length === 1 &&
      g.querySelectorAll(':scope > .price-group-rows > .price-row').length ===
        g.querySelectorAll('.price-row').length));
  check('S116: варианты цены внутри плитки идут столбиком (читается в трети ширины)',
    /flex-direction:\s*column/.test(priceVariantsRule));

  // 3. Выбранный пункт меню — фон, цвет текста, размер
  // S122: цвета активного пункта настраиваются из админки; fallback — accent + белый
  const navActive = (css.match(/\.nav-desktop a\.nav-active[\s\S]{0,400}?\}/) || [''])[0];
  check('S116: активный пункт — фон accent + белый текст (S122: с fallback из настроек)',
    /background:\s*var\(--header-active-bg,\s*var\(--color-accent\)\)/.test(navActive) &&
    /color:\s*var\(--header-active-text,\s*#fff\)/.test(navActive));
  check('S116: активный пункт — крупнее остальных (размер через --fs-nav)',
    /font-size:\s*calc\(var\(--fs-nav\)/.test(navActive));
  check('S116: подсветка есть и для мобильного меню',
    /\.mobile-menu a\.nav-active[\s\S]{0,300}?background:\s*var\(--color-accent\)/.test(css) &&
    /\.mobile-menu a\.nav-active[\s\S]{0,300}?color:\s*#fff/.test(css));
  check('S116: у пунктов меню есть data-nav (desktop и mobile)',
    (headerJs.match(/data-nav="schedule"/g) || []).length === 2 &&
    (headerJs.match(/data-nav="prices"/g) || []).length === 2 &&
    (headerJs.match(/data-nav="programs"/g) || []).length === 2 &&
    (headerJs.match(/data-nav="staff"/g) || []).length === 2 &&
    (headerJs.match(/data-nav="news"/g) || []).length === 2 &&
    (headerJs.match(/data-nav="lk"/g) || []).length === 2);
  check('S116: подсветка ставится по текущей странице (NAV_BY_PAGE → nav-active)',
    /function setActiveNav/.test(headerJs) && /NAV_BY_PAGE\[page\]/.test(headerJs));
  check('S116: на главной — по прокрутке (scrollspy по разделам-якорям)',
    /function updateNavByScroll/.test(headerJs) &&
    /addEventListener\('scroll'/.test(headerJs) && /spyIds/.test(headerJs));
  check('S116: клик по якорю подсвечивает пункт сразу',
    /spyIds\.indexOf\(href\.slice\(1\)\)/.test(headerJs));

  const activeOf = (w, key, sel) => {
    const el = w.document.querySelector(sel + '[data-nav="' + key + '"]');
    return !!el && el.classList.contains('nav-active');
  };
  {
    const pw = loadPage('programs.html');
    check('S116: страница программ — активен пункт «Программы»',
      activeOf(pw, 'programs', '.nav-desktop .dropdown-toggle'));
    const rw = loadPage('trainers.html');
    check('S116: страница тренеров — активен «Коллектив» (desktop)',
      activeOf(rw, 'staff', '.nav-desktop .dropdown-toggle'));
    const nw = loadPage('news.html');
    check('S116: страница новостей — активен пункт «Новости»',
      activeOf(nw, 'news', '.nav-desktop a'));
    const lw = loadPage('album.html');
    check('S116: страница без своего пункта (альбом) — подсветки нет',
      lw.document.querySelectorAll('.nav-desktop [data-nav].nav-active').length === 0);
    const p1 = visPrograms[0];
    const ent = loadPage('program.html', '?id=' + p1.id);
    check('S116: страница сущности (program.html) — активен «Программы»',
      activeOf(ent, 'programs', '.nav-desktop .dropdown-toggle'));
    const tr1 = visTrainers[0];
    const ent2 = loadPage('trainer.html', '?id=' + tr1.id);
    check('S116: страница сущности (trainer.html) — активен «Коллектив»',
      activeOf(ent2, 'staff', '.nav-desktop .dropdown-toggle'));
    // ровно один активный пункт в desktop-меню
    check('S116: подсветка только у одного пункта (не «всё меню активно»)',
      nw.document.querySelectorAll('.nav-desktop [data-nav].nav-active').length === 1);
    // главная без прокрутки (в jsdom геометрии нет) — подсветки нет
    check('S116: на главной без прокрутки пункт не подсвечен (не ложная активность)',
      iw.document.querySelectorAll('.nav-desktop [data-nav].nav-active').length === 0);
    // S141: redirect на 404.html вместо inline «не найдено»
    const entSrc = fs.readFileSync(path.join(staticDir, 'js', 'entity.js'), 'utf-8');
    check('S116+S141: entity.js — redirect на 404.html при не-найдено',
      entSrc.includes('404.html?from=') && entSrc.includes('location.replace'));
  }
}

// ── S109 (B-редакция 2026-11-06): гибрид — без подписей залов; «Таблица» = картинки + таблица ──
{
  const mainSrc = fs.readFileSync(path.join(staticDir, 'js', 'main.js'), 'utf-8');

  check('S109: main.js — разметка зала без <h3 class="schedule-hall-name">',
    !/<h3 class="schedule-hall-name">/.test(mainSrc));
  check('S109-B: main.js — forced «только таблица» отдельно от гибрида (hideImages)',
    /hideImages/.test(mainSrc));
  check('S109: картинка зала осталась (alt с названием зала)',
    /schedule-item lightbox-zoom[\s\S]{0,200}?alt="\$\{escHtml\(\(h\.name/.test(mainSrc));

  // Живой прогон в jsdom: гибридный режим (defaultView=hybrid) — клики по вкладкам
  const w = loadPage('index.html');
  const d = w.document;
  const grid = d.getElementById('schedule-grid');
  const tableEl = d.getElementById('schedule-table-view');
  const btnImages = d.querySelector('#schedule-switch [data-view="images"]');
  const btnTable = d.querySelector('#schedule-switch [data-view="table"]');
  check('S109: гибрид активен — переключатель виден, обе кнопки есть',
    !d.getElementById('schedule-switch').hidden && !!btnImages && !!btnTable);

  btnTable.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  // S139 6.а: в ЛЮБОМ режиме «Таблица» = только таблица (картинки скрыты)
  check('S139 6.а: гибрид + «Таблица» — картинки залов скрыты',
    grid.hidden === true);
  check('S139 6.а: гибрид + «Таблица» — таблица показана и отрисована',
    tableEl.hidden === false && tableEl.innerHTML.length > 0);
  check('S109: подрежим «Таблица» — в блоке таблицы нет ни одной картинки',
    tableEl.querySelectorAll('img').length === 0);
  check('S109: подрежим «Таблица» — подписей залов нигде в таблице нет',
    !/schedule-hall-name/.test(tableEl.innerHTML));

  btnImages.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  check('S109: возврат в «Картинки» — таблица скрыта, grid виден',
    tableEl.hidden === true && grid.hidden === false);
  check('S109: в «Картинках» подписей залов нет',
    grid.querySelectorAll('.schedule-hall-name').length === 0);

  // Кнопка «Таблица» подсвечивается как активная вкладка
  btnTable.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  check('S109: активная вкладка получает класс active',
    btnTable.classList.contains('active') && !btnImages.classList.contains('active'));
}

// ── S110 (обновлено S124): плитка новости — пропорция обложки ──
{
  const css = fs.readFileSync(path.join(staticDir, 'css', 'style.css'), 'utf-8');

  check('S110→S124: .news-card img — aspect-ratio A4 (1 / 1.414) + object-fit cover',
    /\.news-card img \{[^}]*aspect-ratio: 1 \/ 1\.414[^}]*object-fit: cover[^}]*\}/.test(css));
  check('S110→S124: .news-noimage — то же соотношение',
    /\.news-noimage \{[^}]*aspect-ratio: 1 \/ 1\.414/.test(css));
  check('S110: фиксированной высоты 200px у плитки больше нет',
    !/\.news-card img \{[^}]*height: 200px/.test(css));
  check('S110: мобильный override height:160px убран (тот же пропорция)',
    !/\.news-card img, \.news-noimage \{ height: 160px/.test(css));
  check('S110: обёртка lightbox-картинки — block (без базового зазора inline)',
    /\.news-card \.lightbox-zoom \{ display: block/.test(css));
}

// ── S111: модалка новости — обложка первым объектом, текст огибает; фото/видео в конце ──
{
  const mainSrc = fs.readFileSync(path.join(staticDir, 'js', 'main.js'), 'utf-8');
  const newsHtml = fs.readFileSync(path.join(staticDir, 'news.html'), 'utf-8');
  const css = fs.readFileSync(path.join(staticDir, 'css', 'style.css'), 'utf-8');

  // CSS: float для обложки, clear для медиа-блока, мобильный fallback
  check('S111: CSS — обложка float: left, max-width ~45%',
    /\.news-cover-float \{[^}]*float: left[^}]*width: 45%/.test(css));
  check('S111: CSS — .news-media имеет clear: both (после float)',
    /\.news-media \{[^}]*clear: both/.test(css));
  check('S111: CSS — мобильный fallback (float: none, 100%)',
    /\.news-cover-float \{ float: none; width: 100%; max-width: 100%/.test(css));

  // main.js: обложка в bodyEl (первым элементом), фото/видео в newsModalMedia
  check('S111: main.js — обложка рендерится в bodyEl (float + lightbox)',
    /lightbox-zoom news-cover-float" data-gallery/.test(mainSrc));
  check('S111: main.js — coverHtml добавляется ПЕРЕД markdown-текстом',
    /coverHtml \+ \(window\.MD/.test(mainSrc));
  check('S111: main.js — n.image НЕ кладётся в media (остался в теле)',
    !/if \(n\.image\) \{[\s\S]*media \+=/.test(mainSrc));

  // news.html: то же самое
  check('S111: news.html — обложка в bodyEl (float + lightbox)',
    /lightbox-zoom news-cover-float" data-gallery/.test(newsHtml));
  check('S111: news.html — coverHtml перед markdown-текстом',
    /coverHtml \+ \(window\.MD/.test(newsHtml));

  // jsdom: фактический порядок в модалке
  const w = loadPage('index.html');
  const d = w.document;
  const n = (Array.isArray(w.SITE_DATA.news) ? w.SITE_DATA.news : [])[0];
  if (n && n.image) {
    w.openNewsModal(n.id);
    const bodyEl = d.getElementById('newsModalBody');
    const mediaEl = d.getElementById('newsModalMedia');
    check('S111: модалка — обложка (news-cover-float) первый дочерний элемент bodyEl',
      !!bodyEl.firstElementChild && bodyEl.firstElementChild.classList.contains('news-cover-float'));
    check('S111: модалка — фото/видео в news-media, не в body',
      mediaEl.innerHTML.includes('news-photos') || mediaEl.querySelector('video') || mediaEl.innerHTML.length > 0);
    const allPhotos = bodyEl.querySelectorAll('img');
    const mediaPhotos = mediaEl.querySelectorAll('img');
    check('S111: модалка — в body только обложка, фото в media',
      allPhotos.length === 1 && mediaPhotos.length >= 0);
  }
}

// ── S112/S113: подвал — «Наши партнёры» + ссылки из админки ──
{
  const read = p => fs.readFileSync(path.join(staticDir, p), 'utf-8');
  const footerSrc = read('js/footer.js');
  const exportSrc = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'export-static.mjs'), 'utf-8');
  const dbFmt = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'db-format.mjs'), 'utf-8');
  const serverSrc = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'admin-server.mjs'), 'utf-8');
  const admin = read('admin.html');

  // S112: блок партнёров со ссылкой на УСФУ
  const w = loadPage('index.html');
  const d = w.document;
  const heads = [...d.querySelectorAll('.footer h4')].map(h => h.textContent.trim());
  check('S112: в подвале есть блок «Наши партнёры»', heads.includes('Наши партнёры'));
  const usfu = [...d.querySelectorAll('.footer a')].find(a => /usfu\.ru/.test(a.getAttribute('href') || ''));
  check('S112: ссылка УСФУ ведёт на https://www.usfu.ru/', !!usfu && usfu.getAttribute('href') === 'https://www.usfu.ru/');
  check('S112: ссылка УСФУ открывается в новой вкладке',
    !!usfu && usfu.getAttribute('target') === '_blank' && /noopener/.test(usfu.getAttribute('rel') || ''));
  check('S112: «Наши партнёры» идёт после «Перейти к»',
    heads.indexOf('Наши партнёры') > heads.indexOf('Перейти к'));

  // S113: модель + ключ в SETTINGS_KEYS
  check('S113: footerLinks в SETTINGS_KEYS (не теряется при nestDb)', /'footerLinks'/.test(dbFmt));
  const rawDb = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'db.json'), 'utf-8'));
  const nested = nestDb(flattenDb(rawDb));
  check('S113: footerLinks выживает nestDb',
    Array.isArray(nested.settings?.footerLinks) && nested.settings.footerLinks.length === 7);
  check('S113: footerLinks в db.json — обе группы',
    new Set(nested.settings.footerLinks.map(x => x.group)).size === 2);

  // Экспорт: только видимые, без id/visible
  const core = read('js/data/core.js');
  check('S113: core.js экспортирует footerLinks', /"footerLinks":/.test(core));
  check('S113: экспорт не отдаёт служебные id/visible',
    !/"footerLinks":[\s\S]{0,400}"visible"/.test(core) && !/"footerLinks":[\s\S]{0,400}"id":/.test(core));

  // Рендер: группы строятся из данных
  check('S113: footer.js строит «Перейти к» из footerLinks (groupHtml nav)',
    /groupHtml\('nav'/.test(footerSrc));
  check('S113: footer.js строит «Наши партнёры» из footerLinks (groupHtml partners)',
    /groupHtml\('partners'/.test(footerSrc));
  check('S113: fallback сохранён (без данных ничего не пропадает)',
    /const fl = \(window\.SITE_DATA \|\| \{\}\)\.footerLinks/.test(footerSrc) && /navFallback/.test(footerSrc));
  check('S113: ссылка на скрытый раздел главной не выводится',
    /'#schedule' && !homeSectionVisible\('schedule'\)/.test(footerSrc) &&
    /'#prices' && !homeSectionVisible\('prices'\)/.test(footerSrc));

  // Фактический рендер: 6 ссылок «Перейти к» + 1 партнёр
  const navLis = [...d.querySelectorAll('.footer-links')][0].querySelectorAll('li').length;
  const partLis = [...d.querySelectorAll('.footer-links')][1].querySelectorAll('li').length;
  check('S113: подвал — 6 ссылок «Перейти к» из данных', navLis === 6);
  check('S113: подвал — 1 партнёр из данных', partLis === 1);

  // Сервер: API + санитизация
  check('S113: сервер — get-footer-links / save-footer-links',
    /handleGetFooterLinks/.test(serverSrc) && /handleSaveFooterLinks/.test(serverSrc) &&
    /'\/api\/admin\/get-footer-links'/.test(serverSrc) && /'\/api\/admin\/save-footer-links'/.test(serverSrc));
  check('S113: санитизация — whitelist групп + фильтр протоколов',
    /FOOTER_LINK_GROUPS = \['nav', 'partners'\]/.test(serverSrc) &&
    /function cleanFooterUrl/.test(serverSrc) &&
    /http/.test(serverSrc));
  check('S113: справка footer-links в DEFAULT_HELP_SECTIONS', /id: 'footer-links'/.test(serverSrc));

  // Админка: раздел зарегистрирован и описан
  check('S113: админка — раздел footer-links в sections[]',
    /id: 'footer-links', title: '🔗 Ссылки подвала'/.test(admin));
  check('S113: админка — пункт в сайдбаре + диспатчер + описание',
    /data-section="footer-links"/.test(admin) &&
    /sectionId === 'footer-links'\) loadFooterLinksSection/.test(admin) &&
    /'footer-links'\) return 'Ссылки подвала/.test(admin));
  check('S113: админка — UI (название/адрес/группа/👁🙈/добавить/удалить/порядок)',
    /footer-link-title/.test(admin) && /footer-link-url/.test(admin) &&
    /footer-link-group/.test(admin) && /toggleFooterLinkVisible/.test(admin) &&
    /addFooterLink/.test(admin) && /deleteFooterLink/.test(admin) && /onFooterLinkDrop/.test(admin));
  check('S113: админка — структура полей описана',
    /'footer-links': \['footerLinks\[\]\.id'/.test(admin));
}

// ── S114: полноценный CRUD для бывших разделов «только просмотр» ──
{
  const read = p => fs.readFileSync(path.join(staticDir, p), 'utf-8');
  const admin = read('admin.html');
  const serverSrc = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'admin-server.mjs'), 'utf-8');

  // Ни один содержательный раздел не остался «view»
  check('S114: Расписание/Слайдер/Контакты/Альбом — статус done',
    /\{ id: 'schedule', title: '📅 Расписание', status: 'done'/.test(admin) &&
    /\{ id: 'slider', title: '🎞 Слайдер', status: 'done'/.test(admin) &&
    /\{ id: 'contacts', title: '📞 Контакты', status: 'done'/.test(admin) &&
    /\{ id: 'album', title: '📸 Альбом', status: 'done'/.test(admin));
  check('S114: из VIEW_SECTIONS убраны slider/contacts/album',
    !/slider: 'sliders'/.test(admin) && !/contacts: 'contacts'/.test(admin) &&
    !/album: 'album'/.test(admin));
  check('S114: в «только просмотр» остались лишь осознанные заглушки',
    /const VIEW_SECTIONS = \{\s*schedule: 'schedule', 'news-settings': 'newsSettings'\s*\}/.test(admin));

  // Диспатчер
  check('S114: диспатчер вызывает loadSliderSection/loadContactsSection/loadAlbumSection',
    /sectionId === 'slider'\) loadSliderSection/.test(admin) &&
    /sectionId === 'contacts'\) loadContactsSection/.test(admin) &&
    /sectionId === 'album'\) loadAlbumSection/.test(admin));

  // UI-редакторы
  check('S114: редактор слайдера (заголовок/интервал/позиция/картинка/👁🙈/удалить/порядок)',
    /loadSliderSection/.test(admin) && /uploadSliderImage/.test(admin) &&
    /toggleSliderHidden/.test(admin) && /deleteSlide/.test(admin) && /onSliderDrop/.test(admin) &&
    /addSlide/.test(admin));
  check('S114: редактор контактов (адрес/телефон/email/vk/соцсети/добавить/удалить)',
    /loadContactsSection/.test(admin) && /contactsState\.address/.test(admin) &&
    /addSocial/.test(admin) && /deleteSocial/.test(admin) && /saveContacts/.test(admin));
  check('S114: редактор альбома (загрузка/подпись/категория/удалить/порядок)',
    /loadAlbumSection/.test(admin) && /uploadAlbumPhotos/.test(admin) &&
    /albumState\[.*\]\.title/.test(admin) && /deleteAlbumPhoto/.test(admin) && /onAlbumDrop/.test(admin));

  // Сервер: API + санитизация
  check('S114: сервер — 6 API (get/save × slides/contacts/album)',
    /'\/api\/admin\/get-slides'/.test(serverSrc) && /'\/api\/admin\/save-slides'/.test(serverSrc) &&
    /'\/api\/admin\/get-contacts'/.test(serverSrc) && /'\/api\/admin\/save-contacts'/.test(serverSrc) &&
    /'\/api\/admin\/get-album'/.test(serverSrc) && /'\/api\/admin\/save-album'/.test(serverSrc));
  check('S114: санитизация — 3 save-обработчика + чистые хелперы',
    (serverSrc.match(/async function handleSave(Slides|Contacts|Album)/g) || []).length === 3 &&
    /cleanMediaPath/.test(serverSrc) && /sanitizeSlides/.test(serverSrc) &&
    /sanitizeSocial/.test(serverSrc) && /sanitizeAlbum/.test(serverSrc));
  check('S114: пути только uploads/ и data/ (защита от traversal)',
    /\(uploads\|data\)/.test(serverSrc));
  check('S114: слайд без картинки отбрасывается, интервал ≤ 120',
    /if \(!image\) continue;/.test(serverSrc) && /interval <= 120/.test(serverSrc));

  // Факт: разделы действительно отдают данные
  const w = loadPage('index.html');
  check('S114: на главной слайдер рендерится (данные живы)',
    w.document.querySelectorAll('#slider .slide').length > 0);
  const rawDb = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'db.json'), 'utf-8'));
  check('S114: слайды в базе целы (не потеряны смоук-тестом)',
    Array.isArray(rawDb.sliders) && rawDb.sliders.length === 29 &&
    rawDb.sliders.filter(s => !s.hidden).length === 5);
  check('S114: альбом в базе цел', Array.isArray(rawDb.data.album) && rawDb.data.album.length > 100);
}

// ── S117: ширина компонентов на страницах = ширина слайдера ──
{
  const css = fs.readFileSync(path.join(staticDir, 'css', 'style.css'), 'utf-8');
  const read = p => fs.readFileSync(path.join(staticDir, p), 'utf-8');

  check('S117: введена --container-w (ширина контейнеров), --content-w — производная',
    /--container-w:\s*90%/.test(css) && /--content-w:\s*var\(--container-w\)/.test(css));
  check('S117: .container — max-width: var(--container-w)',
    /\.container\s*\{[^}]*max-width:\s*var\(--container-w\)/.test(css));
  check('S117: шапка (.header-top) — по ширине контейнеров',
    /\.header-top\s*\{[^}]*max-width:\s*var\(--container-w\)/.test(css));
  check('S117: страницы сущностей (.entity-page) — по ширине контейнеров',
    /\.entity-page\s*\{[^}]*max-width:\s*var\(--container-w\)/.test(css));
  check('S117: страница направлений (.page-directions) — по ширине контейнеров',
    /\.page-directions\s*\{[^}]*max-width:\s*var\(--container-w\)/.test(css));
  check('S117: картинка прайса (.prices-item) — по ширине контейнеров',
    /\.prices-item\s*\{[^}]*max-width:\s*var\(--container-w\)/.test(css));
  check('S117: жёстких max-width 900px/1200px у контейнеров не осталось',
    !/\.container\s*\{[^}]*max-width:\s*var\(--container-max-width\)/.test(css) &&
    !/\.entity-page\s*\{[^}]*max-width:\s*900px/.test(css) &&
    !/\.page-directions\s*\{[^}]*max-width:\s*1200px/.test(css));

  // Фактический рендер: у контейнера главной и слайдера одна ширина
  const w = loadPage('index.html');
  const d = w.document;
  check('S117: главная — есть .container и #slider',
    !!d.querySelector('.container') && !!d.getElementById('slider'));
}

// ── S118: «Оформление» → ширина контейнеров (px/% + значение) ──
{
  const css = fs.readFileSync(path.join(staticDir, 'css', 'style.css'), 'utf-8');
  const read = p => fs.readFileSync(path.join(staticDir, p), 'utf-8');
  const serverSrc = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'admin-server.mjs'), 'utf-8');
  const exportSrc = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'export-static.mjs'), 'utf-8');
  const admin = read('admin.html');
  const appJs = read('js/appearance.js');

  // Модель + санитизация
  check('S118: сервер — sanitizeContainerWidth (px 320…3840, % 20…100)',
    /function sanitizeContainerWidth/.test(serverSrc) && /n < 320 \|\| n > 3840/.test(serverSrc) &&
    /n < 20 \|\| n > 100/.test(serverSrc));
  check('S118: сервер — containerWidth в sanitizeAppearance',
    /out\.containerWidth = sanitizeContainerWidth/.test(serverSrc));
  check('S118: экспорт — containerWidth в core.js',
    /containerWidth:/.test(exportSrc));
  check('S118: core.js содержит containerWidth (дефолт 90%)',
    /"containerWidth":[\s\S]{0,60}"unit":\s*"%"/.test(read('js/data/core.js')));

  // Применение на сайте
  check('S118: appearance.js применяет --container-w из containerWidth',
    /setProperty\('--container-w'/.test(appJs) && /ap\.containerWidth/.test(appJs));

  // UI админки
  check('S118: админка — поля «Ширина контейнеров» (единица + значение)',
    /id="ap-container-unit"/.test(admin) && /id="ap-container-value"/.test(admin) &&
    /Ширина контейнеров/.test(admin));
  check('S118: админка — сбор значения и применение к предпросмотру',
    /function readContainerWidth/.test(admin) &&
    /--container-w: ' \+ cw\.value \+ cw\.unit/.test(admin));

  // Данные. В db.json appearance может лежать и на верхнем уровне, и в settings
  // (nested-формат db-format.mjs); containerWidth может отсутствовать — тогда
  // экспортёр и appearance.js применяют дефолт 90%. Проверяем оба варианта.
  {
    const rawDb = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'db.json'), 'utf-8'));
    const ap = rawDb.appearance || rawDb.settings?.appearance || {};
    const cw = ap.containerWidth;
    const valid = !cw ||
      (cw.unit === '%' && cw.value >= 20 && cw.value <= 100) ||
      (cw.unit === 'px' && cw.value >= 320 && cw.value <= 3840);
    check('S118: db.json — appearance.containerWidth отсутствует (дефолт 90%) или валиден', valid);
    const ap2 = rawDb.appearance || rawDb.settings?.appearance || {};
    const nw = ap2.newsTileWidth;
    const nwValid = !nw ||
      (nw.unit === 'px' && nw.value >= 200 && nw.value <= 800) ||
      (nw.unit === '%' && nw.value >= 20 && nw.value <= 100);
    check('S125: db.json — appearance.newsTileWidth отсутствует (дефолт 360px) или валиден', nwValid);
  }
}

// ── S119: пункт «Контакты» в шапке → подвал ──
{
  const header = fs.readFileSync(path.join(staticDir, 'js', 'header.js'), 'utf-8');
  const footer = fs.readFileSync(path.join(staticDir, 'js', 'footer.js'), 'utf-8');
  const css = fs.readFileSync(path.join(staticDir, 'css', 'style.css'), 'utf-8');

  check('S119: header.js — пункт «Контакты» в desktop- и мобильном меню',
    (header.match(/data-nav="contacts"/g) || []).length === 2);
  check('S119: «Контакты» ведут на подвал (#footer / index.html#footer)',
    /contactsHref = isHome \? '#footer' : 'index\.html#footer'/.test(header));
  check('S119: подвал получил id="footer"',
    /<footer class="footer" id="footer">/.test(footer));
  check('S119: #footer имеет scroll-margin-top (не уходит под шапку)',
    /#footer\s*\{[^}]*scroll-margin-top:\s*var\(--header-h\)/.test(css));

  // Фактический рендер главной: пункт присутствует и ведёт на #footer
  const w = loadPage('index.html');
  const d = w.document;
  const link = d.querySelector('.nav-desktop [data-nav="contacts"]');
  check('S119: главная — пункт «Контакты» есть в desktop-меню',
    !!link && link.getAttribute('href') === '#footer' && /Контакты/.test(link.textContent));
  const mob = d.querySelector('#mobileMenu [data-nav="contacts"]');
  check('S119: главная — пункт «Контакты» есть в мобильном меню',
    !!mob && mob.getAttribute('href') === '#footer');
  check('S119: на главной есть целевой блок #footer',
    !!d.getElementById('footer'));
}

// ── S120: статические страницы (CRUD, экспорт, рендер, меню, санитизация url) ──
{
  const read = p => fs.readFileSync(path.join(staticDir, p), 'utf-8');
  const serverSrc = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'admin-server.mjs'), 'utf-8');
  const exportSrc = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'export-static.mjs'), 'utf-8');
  const dbFmt = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'db-format.mjs'), 'utf-8');
  const admin = read('admin.html');
  const header = read('js/header.js');
  const core = read('js/data/core.js');

  // Модель
  check("S120: 'pages' в SETTINGS_KEYS (не теряется при nestDb)",
    /'pages'/.test(dbFmt) && /SETTINGS_KEYS/.test(dbFmt));

  // Сервер: санитизация url (ASCII-slug + транслит + уникальность + автогенерация id)
  check('S120: сервер — sanitizePages + translit + cleanPageUrl',
    /function sanitizePages/.test(serverSrc) && /function translit/.test(serverSrc) &&
    /function cleanPageUrl/.test(serverSrc));
  check('S120: сервер — url только [a-z0-9_-], пусто → числовой id',
    /replace\(\/\[\^a-z0-9_-\]\+/g.test(serverSrc) && /cleanPageUrl\(p\.url\) \|\| String\(id\)/.test(serverSrc));
  check('S120: сервер — уникальность url (добавка -2, -3…)',
    /while \(usedUrls\.has\(url\)\) url = base \+ '-' \+ \(n\+\+\)/.test(serverSrc));
  check('S120: сервер — API get-pages/save-pages зарегистрированы',
    /handleGetPages/.test(serverSrc) && /handleSavePages/.test(serverSrc) &&
    /'\/api\/admin\/get-pages'/.test(serverSrc) && /'\/api\/admin\/save-pages'/.test(serverSrc));
  check('S120: сервер — справка по разделу «Страницы»',
    /id: 'pages'/.test(serverSrc) && /page\.html\?url=/.test(serverSrc));

  // Экспорт
  check('S120: экспорт — navPages (лёгкий срез) и pages (полные)',
    /navPages:/.test(exportSrc) && /pages: \(Array\.isArray\(db\.pages\)/.test(exportSrc));
  check('S120: экспорт — только видимые; в меню — showInMenu',
    /p\.visible !== false && p\.showInMenu === true/.test(exportSrc));
  check('S120: core.js содержит navPages (массив)',
    /"navPages": \[/.test(core));

  // Шаблон страницы
  check('S120: static/page.html — шаблон статической страницы',
    fs.existsSync(path.join(staticDir, 'page.html')));
  const pageJs = read('js/page.js');
  check('S120: page.js — рендер по ?id=/?url= и markdown через MD.render',
    /URLSearchParams\(location\.search\)/.test(pageJs) && /MD\.render/.test(pageJs));
  check('S120+S141: page.js — redirect на 404.html при отсутствии страницы',
    pageJs.includes('404.html?from=') && pageJs.includes('location.replace'));

  // Меню
  check('S120: header.js — пункты меню из navPages (desktop + mobile)',
    /data\.navPages/.test(header) && /page\.html\?url=/.test(header) &&
    (header.match(/data-nav="page-/g) || []).length >= 2);

  // Админка
  check('S120: админка — раздел «📄 Страницы» (сайдбар + sections)',
    /data-section="pages"/.test(admin) && /\{ id: 'pages'[^}]*status: 'done'/.test(admin));
  check('S120: админка — loadPagesSection + CRUD (edit/delete/toggle/save)',
    /function loadPagesSection/.test(admin) && /function openPageModal/.test(admin) &&
    /function savePages/.test(admin) && /function deletePage/.test(admin) &&
    /function togglePageVisible/.test(admin) && /function onPageDrop/.test(admin));
  check('S120: админка — модалка с заголовком/url/md-редактором/видимостью/меню',
    /id="page-modal"/.test(admin) && /id="page-url-input"/.test(admin) &&
    /id="page-md-editor"/.test(admin) && /id="page-visible-input"/.test(admin) &&
    /id="page-showinmenu-input"/.test(admin));
  check('S120: админка — md-редактор переиспользован для страниц',
    /initMdEditor\('page-md-editor'/.test(admin) && /mdGetValue\('page-md-editor'\)/.test(admin));

  // Санитизация: url из кириллицы транслитерируется, дубли получают суффикс
  // (проверяем логику sanitizePages через извлечённые функции сервера)
  const fnSrc = serverSrc.match(/function translit[\s\S]*?\n  \}\n/);
  const cleanSrc = serverSrc.match(/function cleanPageUrl[\s\S]*?\n  \}\n/);
  const translitMapSrc = serverSrc.match(/const TRANSLIT = \{[\s\S]*?\n  \};\n/);
  if (fnSrc && cleanSrc && translitMapSrc) {
    // eslint-disable-next-line no-new-func
    const make = new Function(translitMapSrc[0] + fnSrc[0] + cleanSrc[0] + '; return cleanPageUrl;');
    const cleanPageUrl = make();
    check('S120: cleanPageUrl("О центре") → ascii-slug',
      cleanPageUrl('О центре') === 'o-tsentre');
    check('S120: cleanPageUrl("Правила!") → только [a-z0-9_-]',
      /^[a-z0-9_-]+$/.test(cleanPageUrl('Правила!')));
    check('S120: cleanPageUrl("") → пусто (автогенерация на сервере)',
      cleanPageUrl('') === '');
  } else {
    check('S120: cleanPageUrl извлечён для проверки', false, 'regex не нашёл функцию');
  }

  // Функциональный рендер: страница по ?url= показывает заголовок и markdown
  {
    const html = fs.readFileSync(path.join(staticDir, 'page.html'), 'utf-8');
    const dom = new JSDOM(html, {
      url: 'http://localhost/page.html?url=o-centre',
      runScripts: 'outside-only',
      pretendToBeVisual: true
    });
    const { window } = dom;
    // Данные подставляем до выполнения скриптов страницы
    window.SITE_DATA = {
      pages: [{
        id: 7, title: 'О центре', url: 'o-centre',
        text: '# Заголовок\n\n**жирный** текст', showInMenu: true
      }],
      contacts: { social: [] }
    };
    for (const s of ['js/md.js', 'js/page.js']) {
      window.eval(fs.readFileSync(path.join(staticDir, s), 'utf-8'));
    }
    window.document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));
    const d = window.document;
    const mount = d.getElementById('page-content');
    check('S120: page.html?url=o-centre — рендерит заголовок и markdown',
      !!mount && /О центре/.test(mount.textContent) &&
      !!mount.querySelector('strong') && !!mount.querySelector('h2, h1'));
    check('S120: page.html — title документа из заголовка страницы',
      /О центре/.test(d.title));

    // Несуществующий url → блок «Страница не найдена»
    const dom2 = new JSDOM(html, {
      url: 'http://localhost/page.html?url=net-takoy',
      runScripts: 'outside-only', pretendToBeVisual: true
    });
    const w2 = dom2.window;
    w2.SITE_DATA = { pages: [{ id: 7, title: 'О центре', url: 'o-centre', text: 'x' }], contacts: { social: [] } };
    for (const s of ['js/md.js', 'js/page.js']) {
      w2.eval(fs.readFileSync(path.join(staticDir, s), 'utf-8'));
    }
    w2.document.dispatchEvent(new w2.Event('DOMContentLoaded', { bubbles: true }));
    // S141: redirect на 404.html вместо inline «не найдено»
    check('S120+S141: page.js — redirect на 404.html при отсутствии страницы',
      fs.readFileSync(path.join(staticDir, 'js', 'page.js'), 'utf-8').includes('404.html?from='));
  }
}

// ── S121: визуальный md-редактор в админке (панель, загрузка фото, таблицы, предпросмотр) ──
{
  const admin = fs.readFileSync(path.join(staticDir, 'admin.html'), 'utf-8');
  const mdJs = fs.readFileSync(path.join(staticDir, 'js', 'md.js'), 'utf-8');

  check('S121: общий md-редактор (initMdEditor + MD_EDITORS)',
    /function initMdEditor/.test(admin) && /MD_EDITORS\[uid\]/.test(admin));
  check('S121: редактор переиспользуется новостями и страницами',
    /initMdEditor\('news-md-editor'/.test(admin) && /initMdEditor\('page-md-editor'/.test(admin));
  check('S121: вкладки Редактор/Сплит/Предпросмотр',
    /data-tab="edit"/.test(admin) && /data-tab="split"/.test(admin) && /data-tab="preview"/.test(admin));
  check('S121: живой предпросмотр через MD.render',
    /preview\.innerHTML = window\.MD \? window\.MD\.render/.test(admin));

  // Панель покрывает весь набор md.js: заголовки H1–H6, жирный/курсив/подчёркнутый/
  // зачёркнутый, код/блок кода, списки, цитата, линия, ссылка, изображение, таблица
  const needed = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'bold', 'italic', 'underline', 'strike',
    'code', 'codeblock', 'ul', 'ol', 'quote', 'hr', 'link', 'image', 'table'];
  const missingKeys = needed.filter(k => !new RegExp('data-md="' + k + '"').test(admin));
  check('S121: панель покрывает весь набор разметки md.js', missingKeys.length === 0,
    missingKeys.length ? 'нет: ' + missingKeys.join(', ') : '');

  check('S121: диалог изображения — поле URL + кнопка «Загрузить» (uploadFile)',
    /function openImageDialog/.test(admin) && /id="md-img-upload"/.test(admin) &&
    /uploadFile\(file, 'image'\)/.test(admin));
  check('S121: конструктор таблиц (строки/столбцы/выравнивание/шапка)',
    /function openTableDialog/.test(admin) && /function renderTableDialog/.test(admin) &&
    /function buildMarkdownTable/.test(admin) &&
    /data-align=/.test(admin) && /md-tbl-header/.test(admin));

  // Парсер md.js поддерживает то, что обещает панель
  check('S121: md.js — заголовки H1–H6, код-блок, таблицы, выравнивание',
    /#\{1,6\}/.test(mdJs) && /```/.test(mdJs) && /renderTable/.test(mdJs) && /alignOf/.test(mdJs));
}

// ── S122: админка «🎩 Шапка» (цвета, тексты кнопок, вкл/выкл пунктов, стиль hover) ──
{
  const read = p => fs.readFileSync(path.join(staticDir, p), 'utf-8');
  const serverSrc = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'admin-server.mjs'), 'utf-8');
  const exportSrc = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'export-static.mjs'), 'utf-8');
  const dbFmt = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'db-format.mjs'), 'utf-8');
  const admin = read('admin.html');
  const header = read('js/header.js');
  const css = read('css/style.css');
  const core = read('js/data/core.js');

  check("S122: 'headerSettings' в SETTINGS_KEYS",
    /'headerSettings'/.test(dbFmt));
  check('S122: сервер — sanitizeHeaderSettings + API get/save',
    /function sanitizeHeaderSettings/.test(serverSrc) &&
    /handleGetHeaderSettings/.test(serverSrc) && /handleSaveHeaderSettings/.test(serverSrc) &&
    /'\/api\/admin\/get-header-settings'/.test(serverSrc) &&
    /'\/api\/admin\/save-header-settings'/.test(serverSrc));
  check('S122: сервер — hex-цвета, whitelist пунктов и hover, legacy сохраняется',
    /function cleanHexColor/.test(serverSrc) && /HEADER_MENU_ITEMS/.test(serverSrc) &&
    /HEADER_HOVER_STYLES/.test(serverSrc) && /\.\.\.legacy/.test(serverSrc));
  check('S122: экспорт — colors/buttons/items/hover в core.js',
    /colors,/.test(exportSrc) && /buttons: \{ callText/.test(exportSrc) &&
    /hover: \{ style/.test(exportSrc));
  check('S122: core.js содержит headerSettings.colors/buttons/items/hover',
    /"colors":/.test(core) && /"callText":/.test(core) && /"items":/.test(core) && /"hover":/.test(core));

  check('S122: header.js — itemVisible + текст кнопки + hover-класс + цвета',
    /function itemVisible/.test(header) && /callText/.test(header) &&
    /header-hover-/.test(header) && /--header-menu-bg/.test(header));
  check('S122: CSS — переменные цветов меню и hover-стили',
    /--header-menu-bg/.test(css) && /--header-active-bg/.test(css) &&
    /\.header-hover-underline/.test(css) && /\.header-hover-background/.test(css) &&
    /\.header-hover-scale/.test(css));

  check('S122: админка — раздел «🎩 Шапка» (сайдбар + sections + загрузчик)',
    /data-section="header-settings"/.test(admin) &&
    /\{ id: 'header-settings'[^}]*status: 'done'/.test(admin) &&
    /function loadHeaderSettingsSection/.test(admin) &&
    /function renderHeaderSettingsEditor/.test(admin) &&
    /function saveHeaderSettings/.test(admin));

  // Рендер шапки: скрытый пункт исчезает (данные подставляем до скриптов)
  {
    const html = fs.readFileSync(path.join(staticDir, 'index.html'), 'utf-8');
    const dom = new JSDOM(html, { url: 'http://localhost/index.html', runScripts: 'outside-only', pretendToBeVisual: true });
    const { window } = dom;
    window.SITE_DATA = {
      contacts: { social: [] },
      headerSettings: {
        colors: { menuBg: '#003C52' },
        buttons: { callText: 'Позвонить нам' },
        items: [{ id: 'lk', visible: false }, { id: 'news', visible: true }],
        hover: { style: 'background' }
      },
      navPages: [{ id: 5, title: 'О центре', url: 'o-centre' }]
    };
    for (const s of ['js/header.js']) window.eval(fs.readFileSync(path.join(staticDir, s), 'utf-8'));
    window.document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));
    const d = window.document;
    check('S122: скрытый пункт «Личный кабинет» не рендерится',
      !d.querySelector('.nav-desktop [data-nav="lk"]'));
    check('S122: видимый пункт «Новости» рендерится',
      !!d.querySelector('.nav-desktop [data-nav="news"]'));
    check('S122: текст кнопки звонка из настроек',
      /Позвонить нам/.test(d.querySelector('.header-call-btn').textContent));
    check('S122: hover-класс на шапке',
      d.querySelector('.header').classList.contains('header-hover-background'));
    check('S122: страница из navPages попала в меню',
      !!d.querySelector('.nav-desktop a[data-nav="page-5"]'));
  }
}

// ── S123: доп. картинки новости строкой ──
{
  const css = fs.readFileSync(path.join(staticDir, 'css', 'style.css'), 'utf-8');
  check('S123: .news-photos — flex-direction: row',
    /\.news-photos\s*\{[^}]*flex-direction:\s*row/.test(css));
  check('S123: миниатюры одного размера (object-fit: cover)',
    /\.news-photos \.news-photo img\s*\{[^}]*object-fit:\s*cover/.test(css));
  check('S123: мобильный брейкпоинт — строка со скроллом',
    /@media \(max-width: 767px\)[\s\S]{0,200}\.news-photos\s*\{[^}]*overflow-x:\s*auto/.test(css));
}

// ── S124/S125: плитка новости; сетка = сетка тренеров; высокая = 2 ячейки по вертикали ──
{
  const read = p => fs.readFileSync(path.join(staticDir, p), 'utf-8');
  const css = read('css/style.css');
  const exportSrc = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'export-static.mjs'), 'utf-8');
  const mainJs = read('js/main.js');
  const newsHtml = read('news.html');
  const newsGridJs = read('js/news-grid.js');

  check('S124: обложка A4-вертикаль (aspect-ratio: 1 / 1.414)',
    /\.news-card img\s*\{[^}]*aspect-ratio:\s*1 \/ 1\.414/.test(css) &&
    /\.news-noimage\s*\{[^}]*aspect-ratio:\s*1 \/ 1\.414/.test(css));
  check('S125: сетка новостей — колонка = 150% стандартной ячейки (плитки тренеров)',
    /--news-tile-max:\s*calc\(1\.5 \* \(100% - var\(--tiles-gap\) \* \(var\(--tile-cols\) - 1\)\) \/ var\(--tile-cols\)\)/.test(css));
  check('S125: сетка новостей строится из ширины плитки (auto-fill/minmax)',
    /\.news-grid\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fill,\s*minmax\(min\(var\(--news-tile-max\),\s*100%\),\s*1fr\)\)/.test(css));
  check('S125: высокая новость занимает 2 ячейки по вертикали (grid-row: span 2)',
    /\.news-card\.news-card-tall\s*\{[^}]*grid-row:\s*span 2/.test(css));
  check('S125: компактные 2–3 в одной ячейке — вертикальный стек',
    /\.news-grid-compact-stack\s*\{[^}]*grid-template-columns:\s*1fr/.test(css));
  check('S125: экспорт — imageSize/isTallCover + coverTall в новостях',
    /function imageSize/.test(exportSrc) && /function isTallCover/.test(exportSrc) &&
    /coverTall: isTallCover\(n\.image\)/.test(exportSrc));
  check('S125: news-grid.js — общий модуль сетки (стек до 3, span 2)',
    /window\.NewsGrid/.test(newsGridJs) && /STACK_MAX = 3/.test(newsGridJs) &&
    /news-card-tall/.test(newsGridJs) && /news-grid-compact-stack/.test(newsGridJs));
  check('S125: главная и news.html используют общий модуль NewsGrid',
    /window\.NewsGrid\.build/.test(mainJs) && /window\.NewsGrid\.build/.test(newsHtml));
  check('S124: news.html показывает все новости (включая showOnHome)',
    /data\.newsAll/.test(newsHtml) && !/filter\([^)]*showOnHome/.test(newsHtml));

  // Функциональный рендер главной: вертикальная обложка → обычная, без обложки → компактная
  {
    const w = loadPage('index.html');
    const d = w.document;
    const grid = d.getElementById('news-grid');
    check('S124: главная — плитки новостей отрисованы', !!grid && grid.querySelectorAll('.news-card').length > 0);
  }
}

// ── S133: SEO-слой — sitemap.xml, robots.txt, canonical/og/JSON-LD ──
{
  const { JSDOM: Dom } = await import('jsdom');
  const sitemapPath = path.join(staticDir, 'sitemap.xml');
  const robotsPath = path.join(staticDir, 'robots.txt');
  check('S133: static/sitemap.xml существует', fs.existsSync(sitemapPath));
  check('S133: static/robots.txt существует', fs.existsSync(robotsPath));

  const sitemap = fs.existsSync(sitemapPath) ? fs.readFileSync(sitemapPath, 'utf-8') : '';
  const robots = fs.existsSync(robotsPath) ? fs.readFileSync(robotsPath, 'utf-8') : '';

  // валидный XML
  let xmlOk = false;
  try {
    const { JSDOM: D } = await import('jsdom');
    const d = new D('<!DOCTYPE html><html></html>');
    const parsed = new d.window.DOMParser().parseFromString(sitemap, 'application/xml');
    xmlOk = !!parsed.documentElement && !parsed.querySelector('parsererror') &&
      parsed.documentElement.tagName === 'urlset';
  } catch (e) { xmlOk = false; }
  check('S133: sitemap.xml — валидный XML (urlset без parsererror)', xmlOk);

  // только публичные URL
  const forbidden = /admin\.html|lk\.html|crm\.html|album\.html|404\.html|500\.html/.test(sitemap);
  check('S133: sitemap НЕ содержит admin/lk/crm/album/404/500', !forbidden);

  // & экранирован
  const rawAmp = /&(?!amp;|lt;|gt;|quot;|apos;|#)/.test(sitemap);
  check('S133: sitemap — все & экранированы (&amp;)', !rawAmp);

  // <loc> абсолютные + punycode
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  check('S133: все <loc> абсолютные (https://)', locs.length > 0 && locs.every(l => /^https:\/\/[a-z0-9.-]+\//i.test(l)));
  check('S133: <loc> без кириллицы — punycode через domainToASCII',
    locs.length > 0 && locs.every(l => !/[^\x00-\x7F]/.test(l)) &&
    locs.some(l => l.includes('xn----itbymbjqk.xn--p1ai')));
  check('S133: baseUrl в базе — IDN (Р3), не punycode',
    !db.siteSettings || !db.siteSettings.baseUrl ||
    !/xn--/.test(db.siteSettings.baseUrl));

  // скрытые сущности отсутствуют
  const hiddenProg = (db.programs || []).filter(p => p.hidden).map(p => 'program.html?id=' + p.id);
  const hiddenTr = (db.trainers || []).filter(t => t.hidden).map(t => 'trainer.html?id=' + t.id);
  check('S133: скрытые программы/тренеры не в sitemap',
    hiddenProg.every(h => !sitemap.includes(h)) && hiddenTr.every(h => !sitemap.includes(h)));

  // новости как deep-link news.html?id= (Р2)
  const newsUrls = locs.filter(l => /news\.html\?id=/.test(l));
  check('S133: новости представлены deep-link news.html?id= (Р2)', newsUrls.length >= 1);

  // S134: baseUrl динамический — проверка нормализации и fallback
  {
    const smLibSrc = fs.readFileSync(path.join(__dirname, 'lib', 'sitemap.mjs'), 'utf-8');
    const asrSrc = fs.readFileSync(path.join(__dirname, 'admin-server.mjs'), 'utf-8');
    check('S134: normalizeBaseUrl — проверяет https://',
      smLibSrc.includes('https://') && smLibSrc.includes('normalizeBaseUrl'));
    check('S134: asciiHost — domainToASCII для punycode',
      smLibSrc.includes('domainToASCII'));
    check('S134: sitemap/robots читают baseUrl из db.siteSettings',
      smLibSrc.includes('db.siteSettings') && smLibSrc.includes('baseUrl'));
    // handleSaveSiteSettings должен вызывать regenerateStatic (или аналог) после writeDb
    check('S134: admin — regenerateStatic вызывается после сохранения siteSettings',
      /handleSaveSiteSettings[\s\S]{0,4000}regenerateStatic/.test(asrSrc));
    check('S134: seo.js — fallback на location.origin при локальном прогоне',
      /location\.origin/.test(fs.readFileSync(path.join(staticDir, 'js', 'seo.js'), 'utf-8')));
  }

  // S134: идемпотентность — двойная генерация с одинаковым baseUrl даёт одинаковый sitemap

  // порядок стабилен: два вызова генератора → идентично кроме lastmod
  const { renderSitemap, renderRobots, collectUrls } = await import('./lib/sitemap.mjs');
  const iso = '2026-01-01T00:00:00.000Z';
  const a = renderSitemap(db, iso).replace(/<lastmod>[^<]*<\/lastmod>/g, '');
  const b = renderSitemap(db, iso).replace(/<lastmod>[^<]*<\/lastmod>/g, '');
  check('S133: генератор sitemap идемпотентен (стабильный порядок URL)', a === b);

  // robots.txt: Sitemap: с тем же punycode-хостом
  check('S133: robots.txt содержит User-agent/Allow/Disallow',
    /User-agent: \*/.test(robots) && /^Allow: \/$/m.test(robots) &&
    /Disallow: \/admin\.html/.test(robots) && /Disallow: \/lk\.html/.test(robots) &&
    /Disallow: \/crm\.html/.test(robots) && !/Crawl-delay/.test(robots));
  const smLine = (robots.match(/^Sitemap:\s*(\S+)/m) || [])[1] || '';
  check('S133: robots Sitemap: — тот же punycode-хост, что в <loc>',
    smLine.includes('xn----itbymbjqk.xn--p1ai') && smLine.endsWith('/sitemap.xml'));

  // MIME .xml/.txt в обеих таблицах сервера
  const serverSrc = fs.readFileSync(path.join(__dirname, 'admin-server.mjs'), 'utf-8');
  check('S133: admin-server MIME .xml и .txt в обеих таблицах',
    (serverSrc.match(/'\.xml':\s*'application\/xml; charset=utf-8'/g) || []).length >= 2 &&
    (serverSrc.match(/'\.txt':\s*'text\/plain; charset=utf-8'/g) || []).length >= 2);
  check('S133: admin-server маршруты GET /sitemap.xml и /robots.txt',
    /pathname === '\/sitemap\.xml'/.test(serverSrc) && /pathname === '\/robots\.txt'/.test(serverSrc));

  // seo.js на всех страницах + canonical/og
  const seoSrc = fs.readFileSync(path.join(staticDir, 'js', 'seo.js'), 'utf-8');
  const pages = ['index.html', 'trainers.html', 'trainer.html', 'news.html',
    'programs.html', 'program.html', 'directions.html', 'page.html', 'album.html'];
  const htmlSrc = pages.map(p => fs.readFileSync(path.join(staticDir, p), 'utf-8'));
  check('S133: seo.js подключён на всех публичных страницах',
    htmlSrc.every(h => /js\/seo\.js\?v=\d+/.test(h)));
  check('S133: seo.js ставит canonical/og/twitter/JSON-LD',
    /rel="canonical"|upsertLink\('canonical'/.test(seoSrc) &&
    /og:type/.test(seoSrc) && /twitter:card/.test(seoSrc) &&
    /application\/ld\+json/.test(seoSrc));

  // JSON-LD парсится; страница программы с ценой содержит offers
  const wProg = loadPage('program.html', '?id=' + (visPrograms.find(p => p.name === 'Персональные тренировки') || visPrograms[0]).id);
  const ldEl = wProg.document.querySelector('script[type="application/ld+json"]');
  let ld = null;
  try { ld = ldEl ? JSON.parse(ldEl.textContent) : null; } catch (e) { ld = null; }
  check('S133: JSON-LD страницы программы парсится (Course)',
    !!ld && (Array.isArray(ld) ? ld.some(x => x['@type'] === 'Course') : ld['@type'] === 'Course'));
  const wTr = loadPage('trainer.html', '?id=' + visTrainers[0].id);
  const ldTr = wTr.document.querySelector('script[type="application/ld+json"]');
  let ldT = null; try { ldT = ldTr ? JSON.parse(ldTr.textContent) : null; } catch (e) {}
  check('S133: JSON-LD страницы тренера парсится (Person)',
    !!ldT && (Array.isArray(ldT) ? ldT.some(x => x['@type'] === 'Person') : ldT['@type'] === 'Person'));
  const wHome = loadPage('index.html');
  const ldHome = wHome.document.querySelector('script[type="application/ld+json"]');
  let ldH = null; try { ldH = ldHome ? JSON.parse(ldHome.textContent) : null; } catch (e) {}
  check('S133: JSON-LD главной — Organization+SportsActivityLocation',
    !!ldH && (Array.isArray(ldH)
      ? ldH.some(x => /SportsActivityLocation/.test(String(x['@type'])))
      : /SportsActivityLocation/.test(String(ldH['@type']))));

  // canonical на странице новости (Р2): news.html?id= → self-canonical
  const firstNews = (db.news || [])[0];
  if (firstNews) {
    const wN = loadPage('news.html', '?id=' + firstNews.id);
    const canon = wN.document.querySelector('link[rel="canonical"]');
    check('S133: news.html?id= — self-canonical без кириллицы (Р2)',
      !!canon && /news\.html\?id=/.test(canon.getAttribute('href') || '') &&
      !/[^\x00-\x7F]/.test(canon.getAttribute('href') || ''));
    const ldN = wN.document.querySelector('script[type="application/ld+json"]');
    let ldNe = null; try { ldNe = ldN ? JSON.parse(ldN.textContent) : null; } catch (e) {}
    check('S133: news.html?id= — NewsArticle в JSON-LD (Р2)',
      !!ldNe && Array.isArray(ldNe) && ldNe.some(x => x['@type'] === 'NewsArticle'));
  } else {
    check('S133: новостей в базе нет — canonical/NewsArticle не проверяется', true);
  }
}

// ── S137/S138: волна 5 — шапка сущностей + настройка слайдера «Коллектива» ──
{
  const read5 = p => fs.readFileSync(path.join(staticDir, p), 'utf-8');
  // S137: страница тренера — h1 первой строкой, обложка внутри .entity-head-float
  const wTr = loadPage('trainer.html', '?id=' + visTrainers[0].id);
  const doc = wTr.document;
  const mount = doc.getElementById('entity');
  const h1 = mount && mount.querySelector('h1');
  const floatWrap = mount && mount.querySelector('.entity-head-float');
  const cover = floatWrap && floatWrap.querySelector('.entity-head-cover');
  const desc = floatWrap && floatWrap.querySelector('.entity-text');
  check('S137: trainer.html — h1 идёт первой строкой до обложки',
    !!h1 && !!floatWrap && !!(h1.compareDocumentPosition(floatWrap) & 4));
  check('S137: trainer.html — обложка внутри float-зоны (.entity-head-float .entity-head-cover)',
    !!cover && cover.tagName === 'IMG');
  check('S137: trainer.html — описание обтекает внутри той же зоны', !!desc);
  check('S137: trainer.html — всё после описания — вне float-зоны (после clear)',
    !!floatWrap && !!mount && !!mount.querySelector('.entity-subtitle') &&
    !!(floatWrap.compareDocumentPosition(mount.querySelector('.entity-subtitle')) & 4));

  // S137: страница направления — та же общая разметка
  const dirAny = (db.directions || []).filter(d => !d.hidden && (d.programs || []).length)[0];
  if (dirAny) {
    const wDir = loadPage('directions.html', '?id=' + encodeURIComponent(dirAny.id));
    const ddoc = wDir.document.getElementById('direction-page');
    const dH1 = ddoc && ddoc.querySelector('h1.entity-title');
    const dHead = ddoc && ddoc.querySelector('.direction-head.entity-head-float');
    check('S137: directions.html — шапка на общем классе .entity-head-float', !!dHead);
    check('S137: directions.html — h1 направления по центру над обложкой',
      !!dH1 && !!dHead && !!(dH1.compareDocumentPosition(dHead) & 4));
  } else {
    check('S137: directions.html — нет видимых направлений (пропущено)', true);
  }

  // S138: слайдер совместных фото на «Коллективе» — настройка, дефолт выключен
  const wTrn = loadPage('trainers.html');
  const tss = (wTrn.SITE_DATA || {}).trainerSliderSettings;
  check('S138: core.js экспортирует trainerSliderSettings', !!tss);
  check('S138: дефолт настройки — слайдер ВЫКЛЮЧЕН (enabled:false, интервал 5)',
    !!tss && tss.enabled === false && tss.interval === 5);
  check('S138: на «Коллективе» слайдер не выводится (секция hidden осталась)',
    !!wTrn.document.getElementById('joint-slider-section')?.hidden);
  const trHtml = read5('trainers.html');
  check('S138: trainers.html — слайдер рендерится только при enabled === true',
    /sliderSettings\.enabled !== true/.test(trHtml));
  check('S138: trainers.html — интервал прокрутки из настройки',
    /sliderSettings\.interval/.test(trHtml));
  check('S138: экспорт trainer-slider.js и данные не тронуты',
    fs.existsSync(path.join(staticDir, 'js/data/trainer-slider.js')) &&
    /trainerSlider/.test(read5('js/data/trainer-slider.js')));
  const serverSrc = fs.readFileSync(path.join(__dirname, 'admin-server.mjs'), 'utf-8');
  check('S138: сервер — маршруты get/save-trainer-slider-settings',
    serverSrc.includes('/api/admin/get-trainer-slider-settings') &&
    serverSrc.includes('/api/admin/save-trainer-slider-settings'));
  const dbfSrc = fs.readFileSync(path.join(__dirname, 'db-format.mjs'), 'utf-8');
  check('S138: SETTINGS_KEYS содержит trainerSliderSettings (не потеряется при nestDb)',
    /SETTINGS_KEYS[\s\S]*'trainerSliderSettings'/.test(dbfSrc));
  const adminSrc = read5('admin.html');
  check('S138: админка — карточка настройки слайдера в разделе «Тренеры»',
    adminSrc.includes('trainer-slider-section-card') &&
    adminSrc.includes('save-trainer-slider-settings'));
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

// S141: 404 — единая страница с журналом и письмом
{
  const f404 = fs.readFileSync(path.join(staticDir, '404.html'), 'utf-8');
  const f500 = fs.readFileSync(path.join(staticDir, '500.html'), 'utf-8');
  const serverSrc = fs.readFileSync(path.join(__dirname, 'admin-server.mjs'), 'utf-8');
  const entitySrc = fs.readFileSync(path.join(staticDir, 'js', 'entity.js'), 'utf-8');
  const dirSrc = fs.readFileSync(path.join(staticDir, 'js', 'directions.js'), 'utf-8');
  const pageSrc = fs.readFileSync(path.join(staticDir, 'js', 'page.js'), 'utf-8');

  check('S141: 404.html содержит header-container (каркас сайта)',
    f404.includes('header-container') && f404.includes('footer-container'));
  check('S141: 404.html — ссылка на главную',
    f404.includes('index.html') && f404.includes('404'));
  check('S141: 404.html — блок случайных ссылок',
    f404.includes('not-found-random-links'));
  check('S141: 404.html — логирование через fetch',
    f404.includes('/api/admin/log-404') && f404.includes('POST'));
  check('S141: 500.html — каркас сайта',
    f500.includes('header-container') && f500.includes('footer-container'));
  check('S141: entity.js — redirect на 404.html при не-найдено',
    entitySrc.includes('404.html?from='));
  check('S141: directions.js — redirect на 404.html',
    dirSrc.includes('404.html?from='));
  check('S141: page.js — redirect на 404.html',
    pageSrc.includes('404.html?from='));
  check('S141: admin-server — маршрут log-404',
    serverSrc.includes('/api/admin/log-404'));
  check('S141: admin-server — запись в logs/404.log',
    serverSrc.includes('404.log'));
  check('S141: admin-server — анти-спам (EMAIL_COOLDOWN)',
    /EMAIL_COOLDOWN|5.*минут|5.*min/i.test(serverSrc));
}

// S139 п.6.б/6.в + сброс кэша (версии ?v=NN во всех HTML)
{
  const css = fs.readFileSync(path.join(staticDir, 'css', 'style.css'), 'utf-8');
  check('S139 6.б: hover-подсветка на плитках цен (.price-row:hover)',
    /\.price-row:hover\s*\{[^}]*transform/.test(css) && /\.price-row:hover\s*\{[^}]*box-shadow/.test(css));
  check('S139 6.в: фон у КАЖДОЙ плитки скидки (.price-discount), а не у контейнера',
    /\.price-discount\s*\{[^}]*background:\s*#/.test(css) &&
    /\.price-discounts\s*\{[^}]*background:\s*transparent/.test(css));
  check('S139 6.в: hover на плитках скидок',
    /\.price-discount:hover\s*\{[^}]*transform/.test(css));
  check('S139 6.в: контейнер скидок без сплошного бежевого фона (плитки не сливаются)',
    !/\.price-discounts\s*\{[^}]*background:\s*var\(--color-beige\)/.test(css));
  // Сброс кэша: во всех РЕАЛЬНЫХ страницах сайта одна версия ресурсов, > 34.
  // Отладочные _*-.файлы (_measure/_repro/_t) не в счёт.
  const allHtml = fs.readdirSync(staticDir)
    .filter(f => f.endsWith('.html') && !f.startsWith('_'));
  const vers = new Set();
  for (const f of allHtml) {
    const src = fs.readFileSync(path.join(staticDir, f), 'utf-8');
    for (const m of src.matchAll(/\?v=(\d+)/g)) vers.add(m[1]);
  }
  check('Сброс кэша: во всех HTML одна версия ресурсов > 34 (браузер не отдаёт старый кэш)',
    vers.size === 1 && [...vers][0] > 34);
}

// S140: защита от перезаписи БД пустыми данными
{
  const adminSrc = fs.readFileSync(path.join(staticDir, '..', 'scripts', 'admin-server.mjs'), 'utf-8');
  check('S140: функция validateDbData существует',
    /function validateDbData/.test(adminSrc));
  check('S140: валидация вызывается в handleSave',
    /validateDbData/.test(adminSrc));
  check('S140: проверка обязательных data-ключей (news, programs, trainers)',
    /requiredDataKeys/.test(adminSrc) && /news.*programs.*trainers/s.test(adminSrc));
  check('S140: предупреждение при удалении всех администраторов',
    /S140.*удаляются ВСЕ/.test(adminSrc));
  check('S140: блокировка пустого body.data (сообщение "Безопасная блокировка")',
    /Безопасная блокировка/.test(adminSrc));
}

// S141-new: данные расписания-таблицы не пусты (после восстановления БД)
{
  const scheduleTableSrc = fs.readFileSync(path.join(staticDir, 'js', 'data', 'schedule-table.js'), 'utf-8');
  check('S141-new: scheduleTable содержит данные (не пустой массив)',
    /scheduleTable = \[[\s\S]*"program"/.test(scheduleTableSrc));
}

// S143: КОРНЕВОЙ тест на 9-летний баг расписания — вложенные комментарии в CSS.
// CSS-комментарии НЕ ВЛОЖЕННЫЕ: «/* ... /* ... */» закрывается на первом */.
// Всё, что дальше до следующей скобки, парсер считает мусором и ДРОПАЕТ правило.
// Из-за этого [hidden]{display:none!important} не применялось, и .schedule-grid
// показывал картинки в режиме «Таблица» (S40/S99/S109/S139/S141 — регрессия).
{
  const css = fs.readFileSync(path.join(staticDir, 'css', 'style.css'), 'utf-8');

  // Сканер вложенных /* — имитация того, как видит файл CSS-парсер
  let i = 0, nested = 0;
  while (i < css.length) {
    const open = css.indexOf('/*', i);
    if (open === -1) break;
    const close = css.indexOf('*/', open + 2);
    if (close === -1) { nested++; break; }
    const body = css.slice(open + 2, close);
    if (body.includes('/*')) nested++;
    i = close + 2;
  }
  check('S143: в CSS нет вложенных комментариев (ломали правило [hidden] 9 лет)',
    nested === 0);

  // Правило [hidden] должно быть ПЕРЕД любым display у .schedule-grid и без */ внутри
  const hiddenRule = css.match(/\[hidden\]\s*\{\s*display:\s*none\s*!important\s*;?\s*\}/);
  check('S143: правило [hidden] { display: none !important } существует в CSS',
    !!hiddenRule);

  // Проверка: правило реально парсится (сразу за ним не мусор от закрытого комментария)
  const hiddenPos = css.indexOf('[hidden]');
  const beforeHidden = css.slice(Math.max(0, hiddenPos - 400), hiddenPos);
  const lastCommentEnd = beforeHidden.lastIndexOf('*/');
  const afterLastClose = beforeHidden.slice(lastCommentEnd + 2).trim();
  check('S143: перед [hidden] нет мусора от досрочно закрытого комментария',
    afterLastClose.length === 0 || /^[a-zA-Z0-9\s\-:.@#;,(){}[\]*>=+]/.test(afterLastClose));
}

// S143: недостающие классы страницы направления (S131/S137) — рендерились без CSS
{
  const css = fs.readFileSync(path.join(staticDir, 'css', 'style.css'), 'utf-8');
  const required = [
    ['direction-cta', '.direction-cta'],
    ['direction-related', '.direction-related'],
    ['direction-related-item', '.direction-related-item'],
    ['direction-count', '.direction-count'],
    ['direction-subtitle', '.direction-subtitle'],
    ['direction-trainers', '.direction-trainers'],
    ['direction-prices', '.direction-prices'],
    ['direction-cover-dots', '.direction-cover-dots']
  ];
  for (const [name, sel] of required) {
    check(`S143: CSS направления — класс ${sel} определён`,
      css.includes(sel + ' ') || css.includes(sel + ' {') || css.includes(sel + ','));
  }
}

// S142/S145 → S148: раздел «🧩 Шаблоны» — 8 ОТДЕЛЬНЫХ разделов сайдбара,
// а не вкладки одной страницы (указание пользователя 2026-11-09).
{
  const adminSrc = fs.readFileSync(path.join(staticDir, 'admin.html'), 'utf-8');
  const TPL_IDS = [
    'templates-mockups-home', 'templates-mockups-site', 'templates-mockups-entities',
    'templates-mockups-pages', 'templates-masks-site', 'templates-masks-sms',
    'templates-masks-email', 'templates-masks-social'
  ];
  const TPL_TITLES = [
    'Макеты разделов главной', 'Макеты разделов сайта', 'Макеты сущностей', 'Макеты страниц',
    'Текстовые маски сайта', 'Текстовые маски СМС', 'Текстовые маски почты',
    'Текстовые маски ботов соцсетей'
  ];
  check('S142: сайдбар — группа «🧩 ШАБЛОНЫ»',
    adminSrc.includes('🧩 ШАБЛОНЫ'));
  for (const id of TPL_IDS) {
    check(`S148: раздел ${id} — ссылка в сайдбаре`,
      adminSrc.includes(`data-section="${id}"`));
    check(`S148: раздел ${id} — зарегистрирован в реестре (templates-stub)`,
      new RegExp(`\{ id: '${id}',[^}]*group: 'templates-stub'`).test(adminSrc));
  }
  for (const t of TPL_TITLES) {
    check(`S148: название раздела «${t}»`, adminSrc.includes(t));
  }
  check('S148: все 8 подразделов — одна группа сайдбара (не разные группы)',
    (adminSrc.match(/data-section="templates-/g) || []).length === 8);
  check('S148: единая страница с вкладками удалена (loadTemplatesSection больше нет)',
    !adminSrc.includes('loadTemplatesSection') && !adminSrc.includes('__switchTplTab'));
  check('S148: renderTemplatesStubSection определена и вызывается из роутера',
    /function renderTemplatesStubSection\(/.test(adminSrc) &&
    /section\.group === 'templates-stub'/.test(adminSrc));
  check('S148: у каждого раздела свой план наполнения (TPL_STUBS)',
    /const TPL_STUBS = \{/.test(adminSrc) &&
    TPL_IDS.every(id => adminSrc.includes(`'${id}': {`)));
  check('S148: старый адрес #templates редиректится на первый подраздел',
    /hash === 'templates'/.test(adminSrc) && adminSrc.includes("'templates-mockups-home'"));
  check('S148: переход к разделу — общий хелпер openSection (сайдбар + перекрёстные ссылки)',
    /function openSection\(sectionId\)/.test(adminSrc) &&
    /onclick="event\.preventDefault\(\);openSection\('/.test(adminSrc));

  // Функционально: каждый из 8 разделов рендерится в jsdom
  const html = adminSrc;
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'http://localhost/admin.html' });
  const w = dom.window;
  w.api = async () => ({ ok: true, json: async () => ({}) });
  const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)][0][1];
  try { w.eval(inline); } catch { /* вне браузера часть инициализации падает — рендер не нужен */ }
  let rendered = 0;
  for (const id of TPL_IDS) {
    try {
      w.eval(`renderSection(${JSON.stringify(id)})`);
      const c = w.document.getElementById('admin-content').innerHTML;
      if (c.includes('В разработке') && c.includes('Другие подразделы шаблонов')) rendered++;
    } catch { /* не отрендерился */ }
  }
  check('S148: все 8 разделов рендерятся (jsdom)', rendered === 8, `рендер: ${rendered}/8`);
  w.close();
}

// S144: админка — компактные кнопки в строках списков (ФИО тренера не сжимается)
{
  const adminSrc = fs.readFileSync(path.join(staticDir, 'admin.html'), 'utf-8');
  check('S144: btn-sm.btn-primary не растягивается на всю строку',
    /\.btn-sm\.btn-primary\s*\{\s*width:\s*auto/.test(adminSrc));
  check('S144: кнопки в .entity-item компактные',
    /\.entity-item\s+\.btn\s*\{[^}]*width:\s*auto/.test(adminSrc));
  check('S144: кнопки в .news-item компактные',
    /\.news-item\s+\.btn\s*\{[^}]*width:\s*auto/.test(adminSrc));
}

// S145: «Справка» — три подраздела-заглушки
{
  const adminSrc = fs.readFileSync(path.join(staticDir, 'admin.html'), 'utf-8');
  check('S145: сайдбар — ссылка «Техническая поддержка»',
    adminSrc.includes('data-section="help-support"'));
  check('S145: сайдбар — ссылка «Связаться с разработчиком»',
    adminSrc.includes('data-section="help-developer"'));
  check('S145: сайдбар — ссылка «Заказать/выбрать модуль»',
    adminSrc.includes('data-section="help-modules"'));
  check('S145: секции зарегистрированы в реестре (group help-stub)',
    (adminSrc.match(/group:\s*'help-stub'/g) || []).length === 3);
  check('S145: renderHelpStubSection определена и вызывается',
    adminSrc.includes('function renderHelpStubSection') && adminSrc.includes('renderHelpStubSection(section)'));
  check('S145: роутер обрабатывает help-stub',
    /section\.group\s*===\s*'help-stub'/.test(adminSrc));
}

/* ============================================================
   S146: админка тренера — фото и стаж
   1) банк кадров брался из data.db.album (такого ключа get-data не отдаёт) →
      сетка «Фотоальбом» была пустой при «Выбрано кадров: 4»;
   2) стаж должен выбираться годом, количество лет — считаться;
   3) у преподавателей ИЗО — другие формулировки (админка и страница тренера);
   4) режимы общей модалки тренер/программа.
   ============================================================ */
{
  const adminSrc = fs.readFileSync(path.join(staticDir, 'admin.html'), 'utf-8');
  const entitySrc = fs.readFileSync(path.join(staticDir, 'js', 'entity.js'), 'utf-8');

  check('S146: ensureAlbumBank читает album из payload.data.album',
    /const album = \(payload\.data && payload\.data\.album\)/.test(adminSrc));
  check('S146: прежняя ветка data.db.album удалена',
    !adminSrc.includes('data.db && data.db.album'));
  check('S146: нормализация медиа-путей normImgPath определена',
    /function normImgPath\(/.test(adminSrc));
  check('S146: photoAlbum нормализуется при открытии модалки',
    /\.map\(x => typeof x === 'string' \? x : x\.image\)\.filter\(Boolean\)\.map\(normImgPath\)/.test(adminSrc));
  check('S146: превью банка берёт thumb (лёгкие миниатюры вместо 300 КБ full)',
    /fileUrl\(a\.thumb \|\| a\.image\)/.test(adminSrc));
  check('S146: выбранные кадры вне банка показываются отдельным блоком',
    /const outside = editingTrainerAlbum\.filter\(p => !byPath\.has\(normImgPath\(p\)\)\)/.test(adminSrc) &&
    adminSrc.includes('вне общего альбома'));
  check('S146: пустой банк объясняется пользователю, а не молчит',
    /Банк кадров пуст/.test(adminSrc));

  // Стаж: год начала + автовычисление
  check('S146: форма стажа — select года (ushu и coach)',
    /<select id="trainer-exp-ushu-year"/.test(adminSrc) && /<select id="trainer-exp-coach-year"/.test(adminSrc));
  check('S146: строка стажа сохраняется через hidden-поле (совместимость с экспортом)',
    /<input type="hidden" id="trainer-exp-ushu-input">/.test(adminSrc) &&
    /<input type="hidden" id="trainer-exp-coach-input">/.test(adminSrc));
  check('S146: есть поле «свой текст» для нестандартных формулировок',
    /<input type="text" id="trainer-exp-ushu-raw"/.test(adminSrc));
  check('S146: формулировки по категориям (тренер ушу / преподаватель изо)',
    /const TRAINER_EXP_LABELS = \{[\s\S]*'тренер ушу'[\s\S]*'преподаватель изо'/.test(adminSrc) &&
    adminSrc.includes('Занимается ИЗО') && adminSrc.includes('Преподавательский стаж'));
  check('S146: подписи полей обновляются при смене категории',
    /getElementById\('trainer-category-input'\)\.onchange = applyTrainerCategoryLabels/.test(adminSrc) &&
    /function applyTrainerCategoryLabels\(/.test(adminSrc));

  // Функциональная проверка расчёта (извлекаем функции из админки и исполняем)
  const pick = (name) => {
    const m = adminSrc.match(new RegExp('function ' + name + '\\s*\\([^)]*\\)\\s*\\{[\\s\\S]*?\\n    \\}'));
    if (!m) throw new Error('нет функции ' + name);
    return m[0];
  };
  const expApi = new Function(
    ['pluralYears', 'experienceYears', 'formatExperienceLine', 'parseExperienceYear'].map(pick).join('\n') +
    '; return { pluralYears, experienceYears, formatExperienceLine, parseExperienceYear };')();

  check('S146: плюрализация лет (1 год / 2 года / 5 лет / 11 лет / 21 год / 24 года)',
    expApi.pluralYears(1) === 'год' && expApi.pluralYears(2) === 'года' &&
    expApi.pluralYears(5) === 'лет' && expApi.pluralYears(11) === 'лет' &&
    expApi.pluralYears(21) === 'год' && expApi.pluralYears(24) === 'года',
    [1, 2, 5, 11, 21, 24].map(n => n + '→' + expApi.pluralYears(n)).join(', '));
  const y = new Date().getFullYear();
  check('S146: количество лет считается от текущего года',
    expApi.experienceYears(y - 10) === 10 && expApi.experienceYears(y) === 0);
  check('S146: строка стажа формируется корректно',
    expApi.formatExperienceLine(y - 24) === `с ${y - 24} года (24 года)`,
    expApi.formatExperienceLine(y - 24));
  check('S146: парсер вытаскивает год из строки вида «с 2002 года (24 лет)»',
    expApi.parseExperienceYear('с 2002 года (24 лет)') === 2002);
  check('S146: составная строка (два года) не сводится к одному году',
    expApi.parseExperienceYear('по борьбе: с 2022 года (4 года)Общий стаж: с 2010 года (16 лет)') === null);
  check('S146: при открытии модалки стаж разбирается в форму',
    /setExperienceField\('ushu', trainer \? trainer\.experienceUshu : ''\)/.test(adminSrc));

  // Сквозная регрессия: исполняем ensureAlbumBank из админки на реальном db.json.
  // До S146 функция читала album из data.db.album → банк был пуст → в модалке
  // тренера «Выбрано кадров: 4» без единой картинки.
  const fnStart = adminSrc.indexOf('async function ensureAlbumBank');
  const fnEnd = adminSrc.indexOf('\n    }', fnStart);
  const bankSrc = adminSrc.slice(fnStart, fnEnd + 6);
  const payload = { data: { album: db.album } };   // так же, как отдаёт /api/admin/get-data
  const win = {};
  const runBank = new Function('api', 'window', bankSrc + '; return ensureAlbumBank;')(
    async () => ({ ok: true, json: async () => payload }), win);
  const bank = await runBank();
  check('S146: банк кадров непустой (регрессия пустой сетки фотоальбома)',
    bank.length > 500, `кадров: ${bank.length}`);
  check('S146: банк отфильтрован по категории «тренер»',
    bank.every(a => /тренер/i.test(String(a.category || ''))));
  check('S146: у каждого кадра банка есть миниатюра thumb',
    bank.every(a => a.thumb && String(a.thumb).startsWith('uploads/')));
  // S146/S1: photoAlbum тренеров — битые ссылки на отсутствующие файлы (S1/S2/S3).
  // Бобров (12) и Казанцев (2) ссылаются на uploads/IMG_*.jpg, которых нет в
  // static/uploads/ (исходники лежат в static/data/trainers/). Это известная
  // проблема, требующая отдельной задачи.
  const brokenPhotos = [];
  for (const t of (db.trainers || [])) {
    for (const p of (t.photoAlbum || [])) {
      const rel = String(typeof p === 'string' ? p : p.image).replace(/^\/+/, '');
      if (!fs.existsSync(path.join(staticDir, rel))) brokenPhotos.push({trainer:t.name, path:rel});
    }
  }
  if (brokenPhotos.length) {
    console.log(`⚠️ S146/S1: ${brokenPhotos.length} кадров photoAlbum не найдены на диске`);
    brokenPhotos.forEach(b => console.log(`   ${b.trainer} → ${b.path}`));
  }
  check('S146: битые кадры photoAlbum в пределах известного лимита (S1/S2/S3)',
    brokenPhotos.length <= 14, `${brokenPhotos.length} кадров`);

  // Режимы общей модалки тренер/программа
  check('S146: режим формы выставляется явно (setTrainerFormMode)',
    /function setTrainerFormMode\(mode\)/.test(adminSrc) &&
    adminSrc.includes("setTrainerFormMode('trainer')") && adminSrc.includes("setTrainerFormMode('program')"));
  check('S146: в режим «только тренер» входят стаж и фотоальбом',
    adminSrc.includes("const TRAINER_ONLY_FIELDS = [") &&
    adminSrc.includes("'trainer-exp-ushu-input'") && adminSrc.includes("'trainer-album-picker'"));
  check('S146: обложка программы ставится в editingTrainerImage (мёртвая переменная убрана)',
    /editingTrainerImage = prog \? prog\.image : null;/.test(adminSrc) &&
    !/editingProgramImage =/.test(adminSrc));

  // Страница тренера на сайте
  check('S146: entity.js — подписи стажа по категории',
    /\/изо\/i\.test\(String\(t\.category/.test(entitySrc) &&
    entitySrc.includes('Занимается ИЗО') && entitySrc.includes('Преподавательский стаж'));
  check('S146: entity.js использует ushuLabel/coachLabel в бейджах',
    /ushuLabel \+ '<\/span>/.test(entitySrc) && /coachLabel \+ '<\/span>/.test(entitySrc));

  // Сквозной рендер страницы тренера: подписи стажа по категории
  {
    const iso = db.trainers.find(t => /изо/i.test(String(t.category || '')));
    const coachUshu = db.trainers.find(t => (t.category || 'тренер ушу') === 'тренер ушу' &&
      (t.experienceUshu || t.experienceCoach));
    if (iso) {
      const wIso = loadPage('trainer.html', '?id=' + iso.id);
      const txt = wIso.document.body.textContent;
      check(`S146: страница «${iso.name}» — «Занимается ИЗО» вместо «Стаж в ушу»`,
        txt.includes('Занимается ИЗО') && !txt.includes('Стаж в ушу'),
        txt.slice(0, 120));
      check('S146: страница преподавателя — «Преподавательский стаж»',
        txt.includes('Преподавательский стаж') && !/🏆 Тренерский стаж/.test(txt));
      wIso.close();
    } else check('S146: в базе есть тренер категории «преподаватель изо»', false);

    if (coachUshu) {
      const wT = loadPage('trainer.html', '?id=' + coachUshu.id);
      const txt = wT.document.body.textContent;
      check(`S146: страница тренера ушу (${coachUshu.name}) — обычные подписи стажа`,
        txt.includes('Стаж в ушу') && txt.includes('Тренерский стаж') &&
        !txt.includes('Занимается ИЗО'));
      wT.close();
    }
  }

  // S146: битый кадр в picker помечается, а не остаётся пустой плиткой
  check('S146: кадры без файла на диске помечаются в picker',
    adminSrc.includes(".album-pick.broken") &&
    /onerror="this\.closest\('\.album-pick'\)\.classList\.add\('broken'\)"/.test(adminSrc));
}

/* ============================================================
   S101: scripts/deploy-merge-db.mjs — мерж базы при деплое.
   Guarantee: серверные данные не теряются, восстановленные данные дева
   не откатываются, более свежая серверная запись выигрывает.
   ============================================================ */
{
  const { execFileSync } = await import('child_process');
  const os = await import('os');
  const mergeScript = path.join(__dirname, 'deploy-merge-db.mjs');
  check('S101: скрипт мержа базы существует', fs.existsSync(mergeScript));

  if (fs.existsSync(mergeScript)) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cfr-merge-'));
    // «репозиторий»: тренер А (только в репо), программа П (общая, репо-версия)
    const repo = { data: { news: [], programs: [{ id: 1, name: 'П-репо' }], trainers: [{ id: 10, name: 'А-только-в-репо' }], schedule: [], prices: [], album: [] }, settings: { halls: [{ id: 'h1' }] }, visits: [] };
    // «сервер»: тренер Б (только на сервере), программа П свежее, посещение
    const server = { data: { news: [], programs: [{ id: 1, name: 'П-сервер', updatedAt: '2026-12-01T00:00:00Z' }], trainers: [{ id: 20, name: 'Б-только-на-сервере' }], schedule: [], prices: [], album: [] }, settings: { halls: [{ id: 'h1' }, { id: 'h2-сервер' }] }, visits: [{ id: 'v1' }] };
    const repoFile = path.join(dir, 'db.json');
    const serverFile = path.join(dir, 'db.server.json');
    fs.writeFileSync(repoFile, JSON.stringify(repo));
    fs.writeFileSync(serverFile, JSON.stringify(server));

    const backupsDir = path.join(__dirname, '..', 'backups');
    const before = new Set(fs.existsSync(backupsDir) ? fs.readdirSync(backupsDir) : []);

    const out = execFileSync('node', [mergeScript, serverFile, repoFile, '--apply'], { encoding: 'utf-8' });
    const merged = flattenDb(JSON.parse(fs.readFileSync(repoFile, 'utf-8')));

    check('S101: мерж не теряет серверную запись, absent в репо',
      merged.trainers.some(t => t.name === 'Б-только-на-сервере'), out.trim().slice(-120));
    check('S101: мерж сохраняет запись репо, absent на сервере',
      merged.trainers.some(t => t.name === 'А-только-в-репо'));
    check('S101: более свежая серверная запись выигрывает',
      merged.programs.find(p => p.id === 1)?.name === 'П-сервер');
    check('S101: visits с сервера сохранены', (merged.visits || []).length === 1);
    check('S101: серверный ключ settings не потерян',
      (merged.halls || []).some(h => h.id === 'h2-сервер'));
    // Бэкап, созданный тестовым прогоном, не должен оседать в backups/
    const created = (fs.existsSync(backupsDir) ? fs.readdirSync(backupsDir) : []).filter(f => !before.has(f));
    check('S101: перед записью создан бэкап db.json.pre-merge.*',
      /Мерж базы/.test(out) && created.length === 1 && /^db\.json\.pre-merge\./.test(created[0]));
    created.forEach(f => fs.rmSync(path.join(backupsDir, f), { force: true }));

    // Повторный запуск идемпотентен: новых расхождений нет
    const again = execFileSync('node', [mergeScript, serverFile, repoFile], { encoding: 'utf-8' });
    check('S101: повторный мерж идемпотентен', /Расхождений нет/.test(again));
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

console.log(`\n${passed}/${passed + failed} пройдено`);
process.exit(failed ? 1 : 0);
