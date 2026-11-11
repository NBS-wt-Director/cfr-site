/**
 * Основная логика страницы: рендер секций из данных, слайдер, мобильное меню.
 */
(function () {
  const data = window.SITE_DATA || {};

  /* ============================================
     РЕНДЕР СЛАЙДЕРА
     ============================================ */
  function escAttr(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
  function escHtml(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
  function escText(s) {
    return String(s || '').replace(/\n/g,'<br>');
  }

  function renderSlider() {
    const el = document.getElementById('slider');
    if (!el || !data.slider) return;

    const slides = data.slider.map((s, i) => {
      const pos = s.position || 'center';
      const tm = s.textMargin || {};
      const ov = s.overlay || {};
      // Инлайн-стили для текстового блока
      const textStyle = [
        s.textColor ? 'color:' + s.textColor : '',
        s.textSize ? 'font-size:' + s.textSize + 'px' : '',
        (tm.top !== undefined || tm.right !== undefined || tm.bottom !== undefined || tm.left !== undefined)
          ? 'margin:' + (tm.top ?? 20) + 'px ' + (tm.right ?? 20) + 'px ' + (tm.bottom ?? 20) + 'px ' + (tm.left ?? 20) + 'px'
          : ''
      ].filter(Boolean).join(';');
      // Инлайн-стиль для overlay
      const overlayStyle = (ov.enabled !== false)
        ? 'background:' + (ov.color || '#000') + ';opacity:' + (ov.opacity ?? 0.4)
        : 'display:none';
      // Описание
      const descHtml = s.description ? '<p class="slider-desc">' + escText(s.description) + '</p>' : '';
      // Заголовок: ссылка или текст
      const titleHtml = s.link
        ? '<a class="slider-link" href="' + escAttr(s.link) + '" target="' + escAttr(s.linkTarget === '_blank' ? '_blank' : '_self') + '">' + escHtml(s.title) + '</a>'
        : escHtml(s.title);

      return `
        <div class="slide ${i === 0 ? 'active' : ''}">
          <img src="${escAttr(s.image)}" alt="${escAttr(s.title)}">
          <div class="slide-overlay" style="${overlayStyle}"></div>
          <div class="slider-text pos-${pos}" style="${textStyle}">
            <h1 class="slider-title">${titleHtml}</h1>
            ${descHtml}
          </div>
        </div>
      `;
    }).join('');

    const dots = data.slider.map((_, i) =>
      `<button class="slider-dot ${i === 0 ? 'active' : ''}" onclick="goToSlide(${i})"></button>`
    ).join('');

    el.innerHTML = `
      ${slides}
      <button class="slider-nav slider-prev" onclick="prevSlide()">‹</button>
      <button class="slider-nav slider-next" onclick="nextSlide()">›</button>
      <div class="slider-dots">${dots}</div>
    `;
  }

  /* ============================================
     РЕНДЕР РАСПИСАНИЯ: картинки / таблица (вкладки, S23/S32).
     Недельная доска строится общим модулем ScheduleUI (S45).
     S99: картинок по одной на каждый ЗАЛ (settings.halls), режимов ровно два.
     ============================================ */

  // Картинки расписания = залы. Экспорт кладёт их в модуль schedule
  // как [{id, name, image}]; если залов в базе нет, отдаёт наследие data.schedule.
  function scheduleHalls() {
    return Array.isArray(data.schedule) ? data.schedule : [];
  }

  function renderSchedule() {
    const grid = document.getElementById('schedule-grid');
    if (!grid) return;

    const halls = scheduleHalls();
    if (!halls.length) {
      grid.innerHTML = '';
      if (grid.parentElement) grid.hidden = true;
    } else {
      grid.hidden = false;
      // S109: подписи залов над картинками убраны (название остаётся только в alt)
      grid.innerHTML = halls.map(h => `
        <div class="schedule-item lightbox-zoom">
          <img src="${h.image}" alt="${escHtml((h.name || 'Расписание') + ': расписание занятий')}" loading="lazy">
        </div>
      `).join('');
    }

    const hasTable = data.scheduleTable && data.scheduleTable.length;
    const toggle = document.getElementById('schedule-switch');

    // Читаем настройки режима из core.js (S2)
    const settings = data.scheduleSettings || {};
    const forcedView = settings.defaultView || 'images';
    const hybridTab = settings.hybridActiveTab === 'table' ? 'table' : 'images';

    if (forcedView === 'images') {
      // Только картинки — переключатель скрыт
      if (toggle) toggle.hidden = true;
      setScheduleView('images');
    } else if (forcedView === 'table') {
      // Только таблица (без картинок) — переключатель скрыт
      if (toggle) toggle.hidden = true;
      setScheduleView('table', { hideImages: true });
    } else if (forcedView === 'hybrid' && hasTable) {
      // Гибрид — переключатель виден, активна вкладка по умолчанию
      if (toggle) {
        toggle.hidden = false;
        toggle.querySelectorAll('.schedule-switch-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            setScheduleView(btn.getAttribute('data-view'), { hybrid: true });
          });
        });
      }
      setScheduleView(hybridTab, { hybrid: true });
    } else {
      // Гибрид запрошен, но таблицы нет — fallback на картинки
      if (toggle) toggle.hidden = true;
      setScheduleView('images');
    }
  }

  // S99: режимов ровно два — «Картинки» и «Таблица» ('hybrid' = показать переключатель).
  // S139 6.а (решение пользователя, отменяет «вариант B» от 2026-11-06):
  // в ЛЮБОМ режиме вкладка «Таблица» = только таблица, вкладка «Картинки» = только
  // картинки. «Гибрид» — это наличие переключателя, а не показ всего сразу.
  // Многолетняя регрессия (S40/S99/S109, пользователь указывал ~9 раз): картинки
  // оставались видимыми во «Таблице» гибрида, т.к. hideImages передавался только
  // при принудительном forcedView === 'table'. Регресс-тест — в scripts/test-static.mjs.
  function setScheduleView(view, opts) {
    const o = opts || {};
    const grid = document.getElementById('schedule-grid');
    const tableEl = document.getElementById('schedule-table-view');
    const toggle = document.getElementById('schedule-switch');
    if (!grid || !tableEl) return;

    const showTable = view === 'table';
    grid.hidden = showTable;                      // S139 6.а: таблица = только таблица
    tableEl.hidden = !showTable;                  // в «Картинках» таблица скрыта
    if (showTable && !tableEl.innerHTML) {
      tableEl.innerHTML = window.ScheduleUI
        ? window.ScheduleUI.weekBoard(data.scheduleTable)
        : '';
    }

    if (toggle) {
      toggle.querySelectorAll('.schedule-switch-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-view') === view);
      });
    }
  }

  /* ============================================
     РЕНДЕР ЦЕН (S115)
     Есть позиции (settings.priceItems) — структурированная витрина:
     группы → строки (позиция + варианты) → бейджи скидок → блок «Скидки и условия».
     Позиций нет — прежний вид: картинки прайса (data.prices) с lightbox.
     Скрытые CRM-поля (оплата тренеру и т.п.) в данные сайта не попадают вовсе.
     ============================================ */
  function formatMoney(n) {
    return String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0') + '\u00A0₽';
  }

  function discountBadge(d) {
    if (d.type === 'percent') return { text: '−' + (Number(d.value) || 0) + '%', cls: 'percent' };
    if (d.type === 'amount') return { text: '−' + formatMoney(d.value), cls: 'amount' };
    if (d.type === 'bonus') return { text: '🎁 Бонус', cls: 'bonus' };
    return null;   // 'note' — пояснение, живёт в блоке внизу
  }

  function priceLink(item) {
    const prog = (data.navPrograms || []).filter(p => String(p.id) === String(item.programId))[0];
    const tr = (data.navTrainers || []).filter(t => String(t.id) === String(item.trainerId))[0];
    const links = [];
    if (prog) links.push('<a href="program.html?id=' + encodeURIComponent(prog.slug || prog.id) + '">' + escHtml(prog.name) + ' →</a>');
    if (tr) links.push('<a href="trainer.html?id=' + encodeURIComponent(tr.slug || tr.id) + '">' + escHtml(tr.name) + '</a>');
    return links.length ? '<div class="price-row-links">' + links.join(' · ') + '</div>' : '';
  }

  function renderPrices() {
    const el = document.getElementById('prices-grid');
    if (!el) return;

    const items = Array.isArray(data.priceItems) ? data.priceItems : [];
    if (!items.length) {
      const imgs = Array.isArray(data.prices) ? data.prices : [];
      el.innerHTML = imgs.map(p => `
        <div class="prices-item lightbox-zoom">
          <img src="${p.image}" alt="Цены" loading="lazy">
        </div>
      `).join('');
      return;
    }

    const discounts = Array.isArray(data.discounts) ? data.discounts : [];
    const byId = {};
    discounts.forEach(d => { byId[String(d.id)] = d; });

    // Группы — в порядке первого появления в массиве (порядок задаёт админка)
    const groups = [];
    const groupIndex = {};
    items.forEach(item => {
      const g = item.group || 'Цены';
      if (groupIndex[g] === undefined) {
        groupIndex[g] = groups.length;
        groups.push({ name: g, rows: [], unit: item.unit || '' });
      }
      const grp = groups[groupIndex[g]];
      // Строка = позиция; одинаковый title внутри группы склеивает варианты в одну строку
      let row = grp.rows.filter(r => r.title === (item.title || ''))[0];
      if (!row) {
        row = { title: item.title || '', unit: item.unit || '', variants: [], notes: [], links: [] };
        grp.rows.push(row);
      }
      row.variants.push({
        label: item.variant || '',
        price: item.price,
        priceOld: item.priceOld,
        badges: (item.discountIds || [])
          .map(id => byId[String(id)])
          .filter(Boolean)
          .map(discountBadge)
          .filter(Boolean)
      });
      if (item.note && row.notes.indexOf(item.note) === -1) row.notes.push(item.note);
      if (item.programId != null || item.trainerId != null) {
        const html = priceLink(item);
        if (html && row.links.indexOf(html) === -1) row.links.push(html);
      }
    });

    const html = groups.map(grp => `
      <section class="price-group">
        <h3 class="price-group-title">${escHtml(grp.name)}</h3>
        <div class="price-group-rows">
        ${grp.rows.map(row => `
          <div class="price-row">
            <div class="price-row-head">
              <span class="price-row-title">${escHtml(row.title)}</span>
              ${row.unit && row.unit !== grp.unit ? `<span class="price-row-unit">${escHtml(row.unit)}</span>` : ''}
            </div>
            <div class="price-variants">
              ${row.variants.map(v => `
                <div class="price-variant">
                  ${v.label ? `<span class="price-variant-label">${escHtml(v.label)}</span>` : ''}
                  <span class="price-variant-value">
                    ${v.priceOld ? `<s class="price-old">${formatMoney(v.priceOld)}</s> ` : ''}${formatMoney(v.price)}
                  </span>
                  ${v.badges.length ? `<span class="price-badges">${v.badges.map(b => `<span class="price-badge price-badge--${b.cls}">${b.text}</span>`).join('')}</span>` : ''}
                </div>`).join('')}
            </div>
            ${row.notes.length ? `<p class="price-row-note">${row.notes.map(escHtml).join(' ')}</p>` : ''}
            ${row.links.join('')}
          </div>`).join('')}
        </div>
      </section>`).join('');

    const shown = discounts.filter(d => d.type !== 'note');
    const notes = discounts.filter(d => d.type === 'note');
    // S139 п.6.в: пояснения — такие же отдельные плитки, а не список строками
    const tail = (shown.length || notes.length) ? `
      <div class="price-discounts">
        <h4 class="price-discounts-title">Скидки и условия</h4>
        <div class="price-discounts-grid">
        ${shown.map(d => `
          <div class="price-discount price-discount--${d.type}">
            <span class="price-discount-badge">${discountBadge(d) ? discountBadge(d).text : ''}</span>
            <span class="price-discount-title">${escHtml(d.title)}</span>
            ${d.condition ? `<p class="price-discount-condition">${escHtml(d.condition)}</p>` : ''}
          </div>`).join('')}
        ${notes.map(d => `
          <div class="price-discount price-discount--note">
            <span class="price-discount-title">${escHtml(d.title)}</span>
            ${d.condition ? `<p class="price-discount-condition">${escHtml(d.condition)}</p>` : ''}
          </div>`).join('')}
        </div>
      </div>` : '';

    el.innerHTML = `<div class="price-groups">${html}</div>${tail}`;
  }

  // Экранирование для вставки в onclick="...('...')"
  function shortQuote(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ============================================
     РЕНДЕР ПРОГРАММ (S90: единые плитки из js/tiles.js)
     Плитка: фото 2:3, название в 3 строки по центру, кнопки столбиком.
     Группировка по направлениям — сворачиваемые панели, у заголовка
     панели — ссылка на страницу направления.
     ============================================ */
  function renderPrograms() {
    const el = document.getElementById('programs-grid');
    if (!el || !data.programs) return;

    var T = window.Tiles;
    var P = window.Panels;
    var directions = data.navDirections || data.directions || [];
    // S131 п.4: showOnHome === false — панель не показывается на главной
    var visibleDirs = directions.filter(function (d) { return !d.hidden && d.showOnHome !== false; });

    // S130 п.1/п.2: группировка и панель — общий модуль js/panels.js
    // (тот же компонент и тот же localStorage-ключ, что на programs.html).
    // На главной резервные панели по category НЕ выводим: здесь только направления,
    // как было до S130 (правило «дефолт = текущее поведение»).
    if (P && visibleDirs.length > 0) {
      var byId = {};
      data.programs.forEach(function (p) { byId[String(p.id)] = p; });
      var items = visibleDirs.map(function (d) {
        var list = (d.programs || []).map(function (dp) { return byId[String(dp.id)]; }).filter(Boolean);
        if (!list.length) return null;
        return {
          key: 'dir:' + d.id,
          title: P.directionName(d),
          count: list.length,
          moreHref: 'directions.html?id=' + encodeURIComponent(d.id),
          bodyHtml: T.grid(list.map(function (p) { return T.program(p); }).join(''))
        };
      }).filter(Boolean);
      P.render(el, items);
    } else if (visibleDirs.length > 0) {
      // Панели без общего модуля (прежний путь, если panels.js не загрузился)
      var state = {};
      try { state = JSON.parse(localStorage.getItem(P ? P.STORE_KEY : 'home_sections') || '{}'); } catch (e) {}

      el.innerHTML = visibleDirs.map(function (d) {
        var dirPrograms = (d.programs || []).map(function (dp) {
          return data.programs.find(function (p) { return p.id === dp.id; });
        }).filter(Boolean);

        var tiles = dirPrograms.map(function (p) { return T.program(p); }).join('');

        const open = state[d.id] !== false; // по умолчанию раскрыто
        return `<div class="collapsible${open ? ' open' : ''}" data-panel-key="${d.id}">
          <div class="collapsible-head">
            <button type="button" class="collapsible-toggle" aria-expanded="${open}">
              <span class="collapsible-title">${escHtml(d.name)} <span class="collapsible-count">${dirPrograms.length}</span></span>
              <span class="caret">▾</span>
            </button>
            <a class="collapsible-more" href="directions.html?id=${encodeURIComponent(d.id)}">Подробнее →</a>
          </div>
          <div class="collapsible-body">
            ${T.grid(tiles)}
          </div>
        </div>`;
      }).join('');

      // Сворачивание + сохранение состояния
      el.querySelectorAll('.collapsible').forEach(function (panel) {
        const btn = panel.querySelector('.collapsible-toggle');
        btn.addEventListener('click', function () {
          const isOpen = panel.classList.toggle('open');
          btn.setAttribute('aria-expanded', String(isOpen));
          try {
            const st = JSON.parse(localStorage.getItem('home_sections') || '{}');
            st[panel.dataset.panelKey] = isOpen;
            localStorage.setItem('home_sections', JSON.stringify(st));
          } catch (e) {}
        });
      });
    } else {
      // Плоская сетка (обратная совместимость, если направлений нет)
      el.innerHTML = T.grid(data.programs.map(function (p) { return T.program(p); }).join(''));
    }
  }

  /* ============================================
     РЕНДЕР ТРЕНЕРОВ (S90: единые плитки из js/tiles.js)
     Плитка: фото 2:3, ФИО в 2 строки по центру, кнопки столбиком.
     Несколько фото — показываются по движению мыши по фотографии.
     ============================================ */
  function renderTrainers() {
    const el = document.getElementById('trainers-grid');
    if (!el || !data.trainers) return;

    var T = window.Tiles;
    el.innerHTML = T.grid(data.trainers.map(function (t) { return T.trainer(t); }).join(''));
    T.initAll(el);
  }

  /* ============================================
     РЕНДЕР НОВОСТЕЙ
     news.js несёт 8 последних и только превью (первые 200 символов).
     Полный текст — в news-full.js (SITE_DATA.newsFull), рендерит md.js.
     Клик по новости открывает модалку прямо на главной (S73),
     без перехода на news.html.
     Разметка плитки/сетки — общая с news.html: js/news-grid.js (S124/S125).
     ============================================ */
  function renderNews() {
    const el = document.getElementById('news-grid');
    if (!el) return;

    // Фильтруем: только showOnHome !== false
    const news = (Array.isArray(data.news) ? data.news : []).filter(n => n.showOnHome !== false);
    if (news.length === 0) {
      el.innerHTML = '<p class="empty-note">Новостей пока нет</p>';
      return;
    }

    el.innerHTML = window.NewsGrid.build(
      news.slice(0, 8),
      'openNewsModal',
      n => (n.long ? 'Читать полностью →' : 'Подробнее →')
    );
  }

  /* ============================================
     МОДАЛКА НОВОСТИ НА ГЛАВНОЙ (S73)
     Использует разметку #newsModal из index.html,
     полные тексты — SITE_DATA.newsFull, markdown — MD.render.
     ============================================ */
  function escHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function openNewsModal(id) {
    const news = Array.isArray(data.news) ? data.news : [];
    const full = data.newsFull || {};
    const n = news.filter(x => String(x.id) === String(id))[0];
    if (!n) return;

    const overlay = document.getElementById('newsModal');
    if (!overlay) { location.href = 'news.html?id=' + id; return; }

    document.getElementById('newsModalTitle').textContent = n.title;
    document.getElementById('newsModalDate').textContent = formatDate(n.date);
    const bodyEl = document.getElementById('newsModalBody');
    const src = full[n.id] || n.preview || '';
    const gal = 'news-modal-' + n.id;
    // S111: обложка — первый объект в теле новости, текст огибает; фото/видео — в конце (news-media)
    const coverHtml = n.image
      ? `<span class="lightbox-zoom news-cover-float" data-gallery="${gal}"><img src="${n.image}" alt="${escHtml(n.title)}"></span>`
      : '';
    bodyEl.innerHTML = coverHtml + (window.MD ? window.MD.render(src) : escHtml(src));

    let media = '';
    const photos = Array.isArray(n.photos) ? n.photos : [];
    if (photos.length) {
      media += `<div class="news-photos">` + photos.map(p =>
        `<div class="lightbox-zoom news-photo" data-gallery="${gal}"><img src="${p}" alt="${escHtml(n.title)}" loading="lazy"></div>`
      ).join('') + `</div>`;
    }
    if (n.video) {
      media += `<video controls playsinline><source src="${n.video}">Ваш браузер не поддерживает видео.</video>`;
    }
    document.getElementById('newsModalMedia').innerHTML = media;

    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeNewsModal() {
    const overlay = document.getElementById('newsModal');
    if (!overlay) return;
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  window.openNewsModal = openNewsModal;
  window.closeNewsModal = closeNewsModal;

  function shorten(text, max) {
    const clean = String(text).replace(/\n/g, ' ').trim();
    return clean.length > max ? clean.slice(0, max).trim() + '…' : clean;
  }

  function formatDate(iso) {
    try {
      return new Date(iso).toLocaleDateString('ru-RU');
    } catch {
      return iso;
    }
  }

  /* ============================================
     РАЗДЕЛЫ ГЛАВНОЙ (S106): заголовок, фон заголовка, видимость, порядок.
     Управляется из админки (settings.homeSections), экспорт — core.js.
     Разделы: slider, schedule, prices (S108), programs, trainers, news.
     Порядок = порядок массива; скрытый раздел остаётся в DOM, но hidden.
     Пустой заголовок → блок заголовка не занимает места.
     ============================================ */
  function applyHomeSections() {
    const hs = Array.isArray(data.homeSections) ? data.homeSections : [];
    if (!hs.length) return;

    const els = {};
    hs.forEach(function (s) {
      const el = document.getElementById(s.id);
      if (el) els[s.id] = el;
    });

    // Порядок: переставляем ТОЛЬКО управляемые разделы между их текущими
    // позициями. Неуправляемые соседи (разделители) остаются на месте —
    // поэтому «включил настройку → сайт выглядит как до включения».
    const ordered = hs.filter(function (s) { return els[s.id]; })
      .map(function (s) { return els[s.id]; });
    if (ordered.length > 1) {
      const parent = ordered[0].parentNode;
      const children = Array.prototype.slice.call(parent.children);
      // Слоты = позиции управляемых разделов в исходном DOM (по возрастанию)
      const slots = children
        .map(function (c, i) { return { c: c, i: i }; })
        .filter(function (x) { return ordered.indexOf(x.c) !== -1; })
        .map(function (x) { return x.i; });
      // Раскладываем ordered по слотам в порядке homeSections
      slots.forEach(function (slotIdx, k) {
        const el = ordered[k];
        const anchor = parent.children[slotIdx];
        if (anchor && anchor !== el) parent.insertBefore(el, anchor);
      });
    }

    // Видимость, заголовок, подзаголовок, цвет фона заголовка
    hs.forEach(function (s) {
      const el = els[s.id];
      if (!el) return;
      el.hidden = s.visible === false;

      const titleEl = el.querySelector('.section-title');
      if (!titleEl) return;   // у слайдера заголовка нет

      // S127 п.3: заголовок блока = homeSections[].title, пусто → sectionNames[id]
      const L = window.Layout;
      const text = s.title || (L ? L.sectionName(s.id, '') : '');
      titleEl.textContent = text;
      if (!text) {
        // Пустой заголовок — блок не должен занимать место (в т.ч. margin-bottom)
        titleEl.style.display = 'none';
        titleEl.style.marginBottom = '0';
        titleEl.style.background = '';
        titleEl.style.padding = '';
        titleEl.style.borderRadius = '';
      } else {
        titleEl.style.display = '';
        titleEl.style.marginBottom = '';
        titleEl.style.background = s.bgColor || '';
        // Фон заголовка → внутренние отступы, чтобы текст не прилипал
        titleEl.style.padding = s.bgColor ? '0.5rem 1.25rem' : '';
        titleEl.style.borderRadius = s.bgColor ? '0.5rem' : '';
      }

      // S127 п.3: подзаголовок раздела (пусто → блока нет, вид как раньше)
      const sub = (s.subtitle || '').trim();
      let subEl = el.querySelector('.section-subtitle');
      if (sub) {
        if (!subEl) {
          subEl = document.createElement('p');
          subEl.className = 'section-subtitle';
          titleEl.insertAdjacentElement('afterend', subEl);
        }
        subEl.textContent = sub;
      } else if (subEl) {
        subEl.remove();
      }
    });
  }

  /* ============================================
     МОБИЛЬНОЕ МЕНЮ
     ============================================ */
  window.toggleMobileMenu = function () {
    var menu = document.getElementById('mobileMenu');
    if (!menu) return;
    var open = menu.classList.toggle('open');
    document.body.style.overflow = open ? 'hidden' : '';

    // Синхронизируем aria-expanded у бургера
    var burger = document.querySelector('.mobile-toggle');
    if (burger) burger.setAttribute('aria-expanded', String(open));

    // При закрытии сбрасываем все аккордеоны
    if (!open) {
      menu.querySelectorAll('.m-group.open').forEach(function (g) {
        g.classList.remove('open');
        var btn = g.querySelector('.m-group-toggle');
        if (btn) btn.setAttribute('aria-expanded', 'false');
      });
    }
  };

  /* ============================================
     СЛАЙДЕР (навигация)
     ============================================ */
  let currentSlide = 0;
  let slideTimer = null;

  function showSlide(index) {
    const slides = document.querySelectorAll('.slide');
    const dots = document.querySelectorAll('.slider-dot');
    if (!slides.length) return;
    slides.forEach((s, i) => s.classList.toggle('active', i === index));
    dots.forEach((d, i) => d.classList.toggle('active', i === index));
    currentSlide = index;
  }

  window.nextSlide = function () {
    const total = document.querySelectorAll('.slide').length;
    showSlide((currentSlide + 1) % total);
    resetTimer();
  };

  window.prevSlide = function () {
    const total = document.querySelectorAll('.slide').length;
    showSlide((currentSlide - 1 + total) % total);
    resetTimer();
  };

  window.goToSlide = function (index) {
    showSlide(index);
    resetTimer();
  };

  function resetTimer() {
    clearInterval(slideTimer);
    // S86: интервал показа — из данных текущего слайда (сек), fallback 5с
    const slide = (data.slider || [])[currentSlide];
    const sec = slide && Number(slide.interval) > 0 ? Number(slide.interval) : 5;
    slideTimer = setInterval(window.nextSlide, sec * 1000);
  }

  /* ============================================
     СТАРТ
     ============================================ */
  document.addEventListener('DOMContentLoaded', function () {
    renderSlider();
    renderSchedule();
    renderPrices();
    renderPrograms();
    renderTrainers();
    renderNews();
    applyHomeSections();
    resetTimer();

    // Закрытие модалки новости (S73): крестик, клик по фону, Escape
    const newsOverlay = document.getElementById('newsModal');
    if (newsOverlay) {
      const closeBtn = document.getElementById('newsModalClose');
      if (closeBtn) closeBtn.addEventListener('click', function (e) { e.stopPropagation(); closeNewsModal(); });
      newsOverlay.addEventListener('click', function (e) { if (e.target === newsOverlay) closeNewsModal(); });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && newsOverlay.classList.contains('open')) closeNewsModal();
      });
    }

    // Разделители между секциями — общий модуль js/layout.js (S127):
    // та же логика работала только на главной, из-за чего <div class="divider">
    // на остальных страницах был мёртвым элементом.
  });
})();
