document.addEventListener('DOMContentLoaded', function() {
  const container = document.getElementById('header-container');
  if (!container) return;

  const data = window.SITE_DATA;

  // Пункты выпадающих списков — лёгкий навигационный срез (id + name).
  // Сущность открывает общий шаблон: program.html?id=... / trainer.html?id=...
  const programNav = data.navPrograms || data.programs || [];
  const trainerNav = data.navTrainers || data.trainers || [];

  const programsMenu = programNav.map(p =>
    `<li><a href="program.html?id=${p.id}">${p.name}</a></li>`
  ).join('');

  const trainersMenu = trainerNav.map(t =>
    `<li><a href="trainer.html?id=${t.id}">${t.name}</a></li>`
  ).join('');

  // Секции расписания и цен живут только на главной.
  // На главной — плавный якорь, с любой другой страницы — ссылка на index.html
  const page = (location.pathname.split('/').pop() || '') || 'index.html';
  const isHome = page === 'index.html';
  const scheduleHref = isHome ? '#schedule' : 'index.html#schedule';
  const pricesHref = isHome ? '#prices' : 'index.html#prices';

  container.innerHTML = `
    <header class="header">
      <div class="header-top">
        <a href="index.html" class="logo">
          <img src="uploads/logo.png" alt="Логотип">
          <span class="logo-text" id="header-title1">Шифу Панда</span>
        </a>

        <!-- Desktop: выпадашки (hover + клик) -->
        <nav class="nav-desktop" aria-label="Основное меню">
          <ul class="nav-list">
            <li><a href="${scheduleHref}">Расписание</a></li>
            <li><a href="${pricesHref}">Цены</a></li>
            <li class="dropdown" data-dropdown>
              <button type="button" class="dropdown-toggle" aria-expanded="false" aria-haspopup="true">
                Программы <span class="caret">▾</span>
              </button>
              <div class="dropdown-menu">
                <a href="programs.html">Все программы</a>
                <ul>${programsMenu}</ul>
              </div>
            </li>
            <li class="dropdown dropdown-right" data-dropdown>
              <button type="button" class="dropdown-toggle" aria-expanded="false" aria-haspopup="true">
                Коллектив <span class="caret">▾</span>
              </button>
              <div class="dropdown-menu">
                <a href="trainers.html">Наш коллектив</a>
                <ul>${trainersMenu}</ul>
              </div>
            </li>
            <li><a href="news.html">Новости</a></li>
            <!-- Альбом временно выключен (логика перерабатывается) -->
            <li><a href="lk.html">Личный кабинет</a></li>
          </ul>
        </nav>

        <div class="header-actions">
          <button type="button" class="header-call-btn" onclick="openCallModal('Кнопка в хедере')">
            <i class="icon-call"></i><span class="btn-text"> Заказать звонок</span>
          </button>
          <button type="button" class="mobile-toggle" onclick="toggleMobileMenu()" aria-label="Меню" aria-expanded="false">☰</button>
        </div>
      </div>

      <!-- Mobile: те же выпадашки, но аккордеоном -->
      <div class="mobile-menu" id="mobileMenu">
        <button type="button" class="mobile-close" onclick="toggleMobileMenu()" aria-label="Закрыть">×</button>
        <button type="button" class="header-call-btn mobile-call" onclick="openCallModal('Кнопка в мобильном меню')">
          <i class="icon-call"></i> Заказать звонок
        </button>

        <ul class="mobile-list">
          <li><a href="${scheduleHref}">📅 Расписание</a></li>
          <li><a href="${pricesHref}">💰 Цены</a></li>

          <li class="m-group" data-mgroup>
            <button type="button" class="m-group-toggle" aria-expanded="false">
              🥋 Программы <span class="caret">▾</span>
            </button>
            <ul class="m-group-list">
              <li><a href="programs.html">Все программы</a></li>
              ${programsMenu}
            </ul>
          </li>

          <li class="m-group" data-mgroup>
            <button type="button" class="m-group-toggle" aria-expanded="false">
              👥 Коллектив <span class="caret">▾</span>
            </button>
            <ul class="m-group-list">
              <li><a href="trainers.html">Наш коллектив</a></li>
              ${trainersMenu}
            </ul>
          </li>

          <li><a href="news.html">📰 Новости</a></li>
          <!-- Альбом временно выключен -->
          <li><a href="lk.html">👤 Личный кабинет</a></li>
        </ul>
      </div>
    </header>
  `;

  /* ============================================
     DESKTOP ВЫПАДАШКИ: hover (CSS), клик (JS)
     Состояние — только класс, без inline-стилей.
     ============================================ */
  function setDropdown(dropdown, open) {
    dropdown.classList.toggle('dropdown-open', open);
    var btn = dropdown.querySelector('.dropdown-toggle');
    if (btn) btn.setAttribute('aria-expanded', String(open));
  }

  function closeAllDropdowns(except) {
    document.querySelectorAll('.dropdown.dropdown-open').forEach(function (d) {
      if (d !== except) setDropdown(d, false);
    
  // Применяем siteSettings (S75)
  var settings = (window.SITE_DATA || {}).siteSettings || {};
  var title1El = document.getElementById('header-title1');
  if (title1El && settings.title1) title1El.textContent = settings.title1;
  var logoImg = document.querySelector('.logo img');
  if (logoImg && settings.logo) { logoImg.src = settings.logo; logoImg.alt = settings.title1 || 'Логотип'; }

});
  }

  document.querySelectorAll('[data-dropdown]').forEach(function (dropdown) {
    var toggle = dropdown.querySelector('.dropdown-toggle');

    toggle.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var willOpen = !dropdown.classList.contains('dropdown-open');
      closeAllDropdowns(dropdown);
      setDropdown(dropdown, willOpen);
    });
  });

  /* ============================================
     MOBILE ВЫПАДАШКИ (аккордеон)
     ============================================ */
  document.querySelectorAll('[data-mgroup]').forEach(function (group) {
    var btn = group.querySelector('.m-group-toggle');
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      var open = group.classList.toggle('open');
      btn.setAttribute('aria-expanded', String(open));
    });
  });

  /* ============================================
     Якорный скролл + закрытие меню после клика
     ВНИМАНИЕ: навешиваем ОДИН раз, в конце.
     ============================================ */
  document.addEventListener('click', function (e) {
    var link = e.target.closest('a[href^="#"]');
    if (link) {
      var href = link.getAttribute('href');
      if (href === '#top') {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (href.length > 1) {
        var target = document.querySelector(href);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    }

    // Клик мимо шапки закрывает desktop-выпадашки
    if (!e.target.closest('.header')) {
      closeAllDropdowns(null);
      return;
    }

    // Клик по пункту меню закрывает выпадашки и мобильное меню
    if (link) {
      closeAllDropdowns(null);
      var mm = document.getElementById('mobileMenu');
      if (mm && mm.classList.contains('open')) window.toggleMobileMenu();
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    closeAllDropdowns(null);
    var mm = document.getElementById('mobileMenu');
    if (mm && mm.classList.contains('open')) window.toggleMobileMenu();
  });
});
