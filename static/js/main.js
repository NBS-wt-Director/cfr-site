/**
 * Основная логика страницы: рендер секций из данных, слайдер, мобильное меню.
 */
(function () {
  const data = window.SITE_DATA || {};

  /* ============================================
     РЕНДЕР СЛАЙДЕРА
     ============================================ */
  function renderSlider() {
    const el = document.getElementById('slider');
    if (!el || !data.slider) return;

    const slides = data.slider.map((s, i) => `
      <div class="slide ${i === 0 ? 'active' : ''}">
        <img src="${s.image}" alt="${s.title}">
        <div class="slider-text">
          <h1 class="slider-title">${s.title}</h1>
        </div>
      </div>
    `).join('');

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
     ============================================ */

  function renderSchedule() {
    const grid = document.getElementById('schedule-grid');
    if (!grid || !data.schedule) return;

    grid.innerHTML = data.schedule.map(s => `
      <div class="schedule-item lightbox-zoom">
        <img src="${s.image}" alt="Расписание" loading="lazy">
      </div>
    `).join('');

    const hasTable = data.scheduleTable && data.scheduleTable.length;
    const toggle = document.getElementById('schedule-switch');
    if (toggle && hasTable) {
      toggle.hidden = false;
      toggle.querySelectorAll('.schedule-switch-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          setScheduleView(btn.getAttribute('data-view'));
          try { localStorage.setItem('schedule-view', btn.getAttribute('data-view')); } catch (e) {}
        });
      });
    } else if (toggle) {
      toggle.remove(); // расписания нет — показываем только картинки
    }

    // По умолчанию — картинки; сохранённый выбор пользователя переопределяет
    let view = 'images';
    try { view = localStorage.getItem('schedule-view') || 'images'; } catch (e) {}
    if (!hasTable) view = 'images';
    setScheduleView(view);
  }

  function setScheduleView(view) {
    const grid = document.getElementById('schedule-grid');
    const tableEl = document.getElementById('schedule-table-view');
    const toggle = document.getElementById('schedule-switch');
    if (!grid || !tableEl) return;

    const table = view === 'table';
    grid.hidden = table;
    tableEl.hidden = !table;
    if (table && !tableEl.innerHTML) {
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
     РЕНДЕР ЦЕН (картинка)
     ============================================ */
  function renderPrices() {
    const el = document.getElementById('prices-grid');
    if (!el || !data.prices) return;

    el.innerHTML = data.prices.map(p => `
      <div class="prices-item lightbox-zoom">
        <img src="${p.image}" alt="Цены" loading="lazy">
      </div>
    `).join('');
  }

  // Экранирование для вставки в onclick="...('...')"
  function shortQuote(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ============================================
     РЕНДЕР ПРОГРАММ (без текста — только фото, заголовок, кнопки)
     Текст по клику → отдельная страница
     ============================================ */
  // Фото в плитках (S46): есть фото — на всю плитку (маленькое растягивается),
  // нет фото — логотип вместо эмодзи
  function tileImage(src, href, alt) {
    const img = src
      ? `<img class="lightbox-zoom" src="${src}" alt="${shortQuote(alt)}" loading="lazy">`
      : `<img src="logo.png" alt="Шифу Панда" loading="lazy">`;
    return `<a href="${href}">${img}</a>`;
  }

  function renderPrograms() {
    const el = document.getElementById('programs-grid');
    if (!el || !data.programs) return;

    el.innerHTML = data.programs.map(p => `
      <div class="program-card" id="program-${p.id}">
        ${tileImage(p.image, `program.html?id=${p.id}`, p.name)}
        <div class="program-content">
          <h3 class="program-title"><a href="program.html?id=${p.id}">${shortQuote(p.name)}</a></h3>
          <div class="program-actions">
            <a href="program.html?id=${p.id}" class="program-btn program-btn-primary">Подробнее</a>
            <button class="program-btn program-btn-secondary" onclick="openCallModal('Записаться: ${shortQuote(p.name)}')">
              <i class="icon-call"></i> Записаться
            </button>
          </div>
        </div>
      </div>
    `).join('');
  }

  /* ============================================
     РЕНДЕР ТРЕНЕРОВ (без текста — только фото, заголовок, кнопки)
     Текст по клику → отдельная страница
     ============================================ */
  function renderTrainers() {
    const el = document.getElementById('trainers-grid');
    if (!el || !data.trainers) return;

    el.innerHTML = data.trainers.map(t => `
      <div class="trainer-card" id="trainer-${t.id}">
        <div class="trainer-photo-tile">${tileImage(t.image, `trainer.html?id=${t.id}`, t.name)}</div>
        <h3 class="trainer-name"><a href="trainer.html?id=${t.id}">${shortQuote(t.name)}</a></h3>
        <p class="trainer-exp">${shortQuote(t.experience || '')}</p>
        <div class="trainer-actions">
          <a href="trainer.html?id=${t.id}" class="trainer-btn trainer-btn-primary">Подробнее</a>
          <button class="trainer-btn trainer-btn-secondary" onclick="openCallModal('Заказать звонок: ${shortQuote(t.name)}')">
            <i class="icon-call"></i> Заказать звонок
          </button>
        </div>
      </div>
    `).join('');
  }

  /* ============================================
     РЕНДЕР НОВОСТЕЙ
     news.js несёт 8 последних и только превью (первые 200 символов).
     Полный текст — в news-full.js (SITE_DATA.newsFull), рендерит md.js.
     Клик по новости открывает модалку прямо на главной (S73),
     без перехода на news.html.
     ============================================ */
  function renderNews() {
    const el = document.getElementById('news-grid');
    if (!el) return;

    const news = Array.isArray(data.news) ? data.news : [];
    if (news.length === 0) {
      el.innerHTML = '<p class="empty-note">Новостей пока нет</p>';
      return;
    }

    el.innerHTML = news.slice(0, 8).map(n => `
      <article class="news-card" id="news-${n.id}">
        ${n.image ? `<a href="#" onclick="openNewsModal(${n.id});return false;"><img src="${n.image}" alt="${shortQuote(n.title)}" loading="lazy"></a>` : '<div class="news-noimage"></div>'}
        <div class="news-content">
          <h3 class="news-title">${shortQuote(n.title)}</h3>
          ${n.date ? `<p class="news-date">${formatDate(n.date)}</p>` : ''}
          <p class="news-excerpt">${shortQuote(n.preview || '')}</p>
          <div class="news-actions">
            <button type="button" class="news-more" onclick="openNewsModal(${n.id})">${n.long ? 'Читать полностью →' : 'Подробнее →'}</button>
          </div>
        </div>
      </article>
    `).join('');
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
    bodyEl.innerHTML = window.MD ? window.MD.render(src) : escHtml(src);

    let media = '';
    if (n.image) {
      media += `<div class="lightbox-zoom"><img src="${n.image}" alt="${escHtml(n.title)}"></div>`;
    }
    const photos = Array.isArray(n.photos) ? n.photos : [];
    if (photos.length) {
      media += `<div class="news-photos">` + photos.map(p =>
        `<div class="lightbox-zoom news-photo"><img src="${p}" alt="${escHtml(n.title)}" loading="lazy"></div>`
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
    slideTimer = setInterval(window.nextSlide, 5000);
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

    // Разделители между секциями — управляются из админки (globalDivider)
    const dividers = document.querySelectorAll('.divider');
    if (dividers.length && data.divider) {
      if (data.divider.enabled) {
        dividers.forEach(d => {
          d.textContent = data.divider.text || '';
          d.classList.add('divider--on');
          // Высота
          if (data.divider.height) d.classList.add('divider--' + data.divider.height);
          // Фон
          if (data.divider.background) d.classList.add('divider--bg-' + data.divider.background);
          // Размер шрифта
          if (data.divider.fontSize) d.classList.add('divider--fs-' + data.divider.fontSize);
        });
      }
      // иначе оставляем display:none (из CSS)
    }
  });
})();
