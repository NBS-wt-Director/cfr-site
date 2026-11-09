document.addEventListener('DOMContentLoaded', function() {
  const container = document.getElementById('header-container');
  if (!container) return;

  const data = window.SITE_DATA;

  // S106: раздел главной скрыт из админки → не рендерим и пункт меню, ведущий к нему.
  // Разделы главной: slider, schedule, prices, programs, trainers, news (S108: prices).
  function homeSectionVisible(id) {
    var hs = (window.SITE_DATA || {}).homeSections;
    if (!Array.isArray(hs)) return true;   // настройка не задана — показываем как раньше
    var s = hs.filter(function (x) { return x.id === id; })[0];
    return !s || s.visible !== false;
  }

  // S127 (Р1): единое имя раздела из справочника settings.sectionNames —
  // одна настройка меняет меню, подвал, крошки, <h1> и <title>.
  function secName(id, fallback) {
    return (window.Layout && window.Layout.sectionName(id, fallback)) || fallback;
  }

  // Пункты выпадающих списков — лёгкий навигационный срез (id + name).
  // Сущность открывает общий шаблон: program.html?id=... / trainer.html?id=...
  const programNav = data.navPrograms || data.programs || [];
  const trainerNav = data.navTrainers || data.trainers || [];
  // S23: направления — лёгкий срез из core.js (есть на всех страницах)
  // S131 п.2: showInMenu === false — направление не показывается в шапке
  var directions = (data.navDirections || data.directions || [])
    .filter(function (d) { return !d.hidden && d.showInMenu !== false && d.programs && d.programs.length > 0; });

  // S120: статические страницы, отмеченные «показывать в меню» (navPages из core.js).
  // Открываются общим шаблоном page.html?url=<slug>.
  var navPages = (data.navPages || []).filter(function (p) { return p && p.title && p.url; });
  var pagesMenu = navPages.map(function (p) {
    return '<li><a href="page.html?url=' + encodeURIComponent(p.url) + '" data-nav="page-' + p.id + '">' + p.title + '</a></li>';
  }).join('');

  // S122: настройки шапки (цвета меню, текст кнопки, видимость пунктов, стиль hover)
  var hs = data.headerSettings || {};
  var hsItems = Array.isArray(hs.items) ? hs.items : [];
  var hsColors = hs.colors || {};
  var hsHover = (hs.hover && hs.hover.style) || 'color';
  var callText = (hs.buttons && hs.buttons.callText) || 'Заказать звонок';
  // Пункт меню виден, если его нет в настройках или visible !== false
  function itemVisible(id) {
    var it = hsItems.filter(function (x) { return x && x.id === id; })[0];
    return !it || it.visible !== false;
  }
  // Класс hover-стиля — на контейнер шапки (стили в css/style.css)
  var hoverClass = 'header-hover-' + (['color', 'underline', 'background', 'scale'].indexOf(hsHover) !== -1 ? hsHover : 'color');

  // S23: многоуровневое меню программ по направлениям (desktop)
  // Группы сворачиваемые: заголовок-кнопка раскрывает список программ.
  // S131 п.2: название группы — ссылка на страницу направления (directions.html?id=),
  // стрелка рядом по-прежнему раскрывает список (раскрытие не пропало).
  var desktopProgramsMenu;
  if (directions.length > 0) {
    desktopProgramsMenu = directions.map(function (d) {
      var items = (d.programs || []).map(function (p) {
        return '<li><a href="program.html?id=' + p.id + '">' + p.name + '</a></li>';
      }).join('');
      return '<li class="dgroup">' +
        '<div class="dgroup-head">' +
          '<a class="dgroup-title" href="directions.html?id=' + encodeURIComponent(d.id) + '">' + d.name + '</a>' +
          '<button type="button" class="dgroup-toggle" aria-expanded="false" aria-label="Раскрыть список">' +
            '<span class="caret">▾</span>' +
          '</button>' +
        '</div>' +
        '<ul class="dgroup-list">' + items + '</ul>' +
      '</li>';
    }).join('');
  } else {
    desktopProgramsMenu = programNav.map(function (p) {
      return '<li><a href="program.html?id=' + p.id + '">' + p.name + '</a></li>';
    }).join('');
  }

  // Плоский список программ (fallback для страниц без navDirections)
  const programsMenu = programNav.map(p =>
    `<li><a href="program.html?id=${p.id}">${p.name}</a></li>`
  ).join('');

  const trainersMenu = trainerNav.map(t =>
    `<li><a href="trainer.html?id=${t.id}">${t.name}</a></li>`
  ).join('');

  // S23: мобильный аккордеон направлений (вложенный)
  // S131 п.2: название группы ведёт на страницу направления, стрелка раскрывает список
  var directionsMenu = directions
    .map(function (d) {
      var items = (d.programs || []).map(function (p) {
        return '<li><a href="program.html?id=' + p.id + '">' + p.name + '</a></li>';
      }).join('');
      return '<li class="m-dropdown">' +
        '<div class="m-dropdown-head">' +
          '<a class="m-dropdown-title" href="directions.html?id=' + encodeURIComponent(d.id) + '">' + d.name + '</a>' +
          '<button type="button" class="m-dropdown-toggle" aria-label="Раскрыть список"><span class="caret">▾</span></button>' +
        '</div>' +
        '<ul class="m-dropdown-menu">' + items + '</ul>' +
      '</li>';
    }).join('');

  // Секции расписания и цен живут только на главной.
  // На главной — плавный якорь, с любой другой страницы — ссылка на index.html
  const page = (location.pathname.split('/').pop() || '') || 'index.html';
  const isHome = page === 'index.html';
  const scheduleHref = isHome ? '#schedule' : 'index.html#schedule';
  const pricesHref = isHome ? '#prices' : 'index.html#prices';
  // S119: «Контакты» — якорь на подвал. На главной он есть; с других страниц
  // сначала ведём на index.html#footer, чтобы подвал точно был в зоне видимости.
  const contactsHref = isHome ? '#footer' : 'index.html#footer';

  container.innerHTML = `
    <header class="header ${hoverClass}">
      <div class="header-top">
        <a href="index.html" class="logo">
          <img src="uploads/logo.png" alt="Логотип">
          <span class="logo-text" id="header-title1">Шифу Панда</span>
        </a>

        <!-- Desktop: выпадашки (hover + клик) -->
        <nav class="nav-desktop" aria-label="Основное меню">
          <ul class="nav-list">
            ${itemVisible('schedule') && homeSectionVisible('schedule') ? `<li><a href="${scheduleHref}" data-nav="schedule">Расписание</a></li>` : ''}
            ${itemVisible('prices') && homeSectionVisible('prices') ? `<li><a href="${pricesHref}" data-nav="prices">Цены</a></li>` : ''}
            ${itemVisible('programs') ? `<li class="dropdown" data-dropdown>
              <button type="button" class="dropdown-toggle" data-nav="programs" aria-expanded="false" aria-haspopup="true">
                Программы <span class="caret">▾</span>
              </button>
              <div class="dropdown-menu">
                <a href="programs.html">Все программы</a>
                <ul>${desktopProgramsMenu}</ul>
              </div>
            </li>` : ''}
            ${itemVisible('staff') ? `<li class="dropdown dropdown-right" data-dropdown>
              <button type="button" class="dropdown-toggle" data-nav="staff" aria-expanded="false" aria-haspopup="true">
                ${secName('trainers', 'Коллектив')} <span class="caret">▾</span>
              </button>
              <div class="dropdown-menu">
                <a href="trainers.html">${secName('trainers', 'Коллектив')}</a>
                <ul>${trainersMenu}</ul>
              </div>
            </li>` : ''}
            ${itemVisible('news') ? `<li><a href="news.html" data-nav="news">Новости</a></li>` : ''}
            ${pagesMenu}
            ${itemVisible('contacts') ? `<li><a href="${contactsHref}" data-nav="contacts">Контакты</a></li>` : ''}
            <!-- Альбом временно выключен (логика перерабатывается) -->
            ${itemVisible('lk') ? `<li><a href="lk.html" data-nav="lk">Личный кабинет</a></li>` : ''}
          </ul>
        </nav>

        <div class="header-actions">
          <button type="button" class="header-call-btn" onclick="openCallModal('Шапка')">
            <i class="icon-call"></i><span class="btn-text"> ${callText}</span>
          </button>
          <button type="button" class="mobile-toggle" onclick="toggleMobileMenu()" aria-label="Меню" aria-expanded="false">☰</button>
        </div>
      </div>

      <!-- Mobile: те же выпадашки, но аккордеоном -->
      <div class="mobile-menu" id="mobileMenu">
        <button type="button" class="mobile-close" onclick="toggleMobileMenu()" aria-label="Закрыть">×</button>
        <button type="button" class="header-call-btn mobile-call" onclick="openCallModal('Шапка (мобильное меню)')">
          <i class="icon-call"></i> ${callText}
        </button>

        <ul class="mobile-list">
          ${itemVisible('schedule') && homeSectionVisible('schedule') ? `<li><a href="${scheduleHref}" data-nav="schedule">📅 Расписание</a></li>` : ''}
          ${itemVisible('prices') && homeSectionVisible('prices') ? `<li><a href="${pricesHref}" data-nav="prices">💰 Цены</a></li>` : ''}

          ${itemVisible('programs') ? `<li class="m-group" data-mgroup>
            <button type="button" class="m-group-toggle" data-nav="programs" aria-expanded="false">
              🥋 Программы <span class="caret">▾</span>
            </button>
            <ul class="m-group-list">
              <li><a href="programs.html">Все программы</a></li>
              ${directionsMenu || programsMenu}
            </ul>
          </li>` : ''}

          ${itemVisible('staff') ? `<li class="m-group" data-mgroup>
            <button type="button" class="m-group-toggle" data-nav="staff" aria-expanded="false">
              👥 ${secName('trainers', 'Коллектив')} <span class="caret">▾</span>
            </button>
            <ul class="m-group-list">
              <li><a href="trainers.html">${secName('trainers', 'Коллектив')}</a></li>
              ${trainersMenu}
            </ul>
          </li>` : ''}

          ${itemVisible('news') ? `<li><a href="news.html" data-nav="news">📰 Новости</a></li>` : ''}
          ${pagesMenu ? navPages.map(function (p) {
            return '<li><a href="page.html?url=' + encodeURIComponent(p.url) + '" data-nav="page-' + p.id + '">📄 ' + p.title + '</a></li>';
          }).join('') : ''}
          ${itemVisible('contacts') ? `<li><a href="${contactsHref}" data-nav="contacts">📞 Контакты</a></li>` : ''}
          <!-- Альбом временно выключен -->
          ${itemVisible('lk') ? `<li><a href="lk.html" data-nav="lk">👤 Личный кабинет</a></li>` : ''}
        </ul>
      </div>
    </header>
  `;

  // S122: цвета меню из настроек → CSS-переменные на корне
  (function applyHeaderColors() {
    var map = {
      menuBg: '--header-menu-bg', menuText: '--header-menu-text',
      hoverBg: '--header-hover-bg', hoverText: '--header-hover-text',
      activeBg: '--header-active-bg', activeText: '--header-active-text'
    };
    Object.keys(map).forEach(function (k) {
      if (hsColors[k]) document.documentElement.style.setProperty(map[k], hsColors[k]);
    });
  })();

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
    });
  }

  // Применяем siteSettings (S75)
  var settings = (window.SITE_DATA || {}).siteSettings || {};
  var title1El = document.getElementById('header-title1');
  if (title1El && settings.title1) title1El.textContent = settings.title1;
  var logoImg = document.querySelector('.logo img');
  if (logoImg && settings.logo) { logoImg.src = settings.logo; logoImg.alt = settings.title1 || 'Логотип'; }

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
     S23: сворачиваемые группы направлений в desktop-меню
     ============================================ */
  document.querySelectorAll('.dgroup-toggle').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var group = btn.closest('.dgroup');
      var open = group.classList.toggle('open');
      btn.setAttribute('aria-expanded', String(open));
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
     MOBILE ВЫПАДАШКИ НАПРАВЛЕНИЙ (S23)
     ============================================ */
  document.querySelectorAll('.m-dropdown').forEach(function (dd) {
    var btn = dd.querySelector('.m-dropdown-toggle');
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var open = dd.classList.toggle('open');
      btn.setAttribute('aria-expanded', String(open));
    });
  });

  /* ============================================
      S98: реальная высота шапки → CSS-переменная --header-h.
      Нужна для scroll-margin-top: sticky-шапка не должна наезжать
      на верх блока при переходе по якорю (#schedule, #prices, …).
      ============================================ */
  var headerEl = container.querySelector('.header');
  if (headerEl) {
    document.documentElement.style.setProperty('--header-h', headerEl.offsetHeight + 'px');
  }

  /* ============================================
      ВЫДЕЛЕНИЕ ВЫБРАННОГО ПУНКТА МЕНЮ (замечание администратора):
      фон + цвет текста + размер (класс nav-active, стили в css/style.css).

      - на общих страницах активен пункт раздела, к которому ведёт адрес;
      - на главной «Расписание» и «Цены» — якоря одного и того же документа,
        поэтому активный пункт определяется по прокрутке: какой раздел
        уже прошёл верх экрана под шапкой.
      ============================================ */
  var NAV_BY_PAGE = {
    'programs.html': 'programs',
    'program.html': 'programs',
    'directions.html': 'programs',
    'trainers.html': 'staff',
    'trainer.html': 'staff',
    'news.html': 'news',
    'lk.html': 'lk'
  };

  // S120: на page.html активный пункт — по ?url=<slug> среди страниц меню
  function activePageNavKey() {
    var url = new URLSearchParams(location.search).get('url');
    if (!url) return null;
    var p = navPages.filter(function (x) { return String(x.url) === String(url); })[0];
    return p ? 'page-' + p.id : null;
  }

  function setActiveNav(key) {
    // Сначала снять nav-active со всех — не дублировать на десктоп и мобиль
    document.querySelectorAll('[data-nav]').forEach(function (el) {
      el.classList.remove('nav-active');
    });
    // Поставить на первый найденный с нужным ключом
    if (key) {
      var first = document.querySelector('[data-nav="' + key + '"]');
      if (first) first.classList.add('nav-active');
    }
  }

  // Пункты-якоря главной: только реально существующие и видимые разделы
  var spyIds = ['schedule', 'prices'].filter(function (id) {
    var el = document.getElementById(id);
    return homeSectionVisible(id) && el && !el.hidden;
  });

  function updateNavByScroll() {
    if (!isHome) return;
    var limit = (headerEl ? headerEl.offsetHeight : 0) + 24;
    var current = null;
    for (var i = 0; i < spyIds.length; i++) {
      var r = document.getElementById(spyIds[i]).getBoundingClientRect();
      // height === 0 — в jsdom/скрытом блоке геометрии нет: подсветку не включаем
      if (r.height > 0 && r.top <= limit) current = spyIds[i];
    }
    setActiveNav(current);
  }

  if (isHome) {
    var navQueued = false;
    window.addEventListener('scroll', function () {
      if (navQueued) return;
      navQueued = true;
      window.requestAnimationFrame(function () {
        navQueued = false;
        updateNavByScroll();
      });
    }, { passive: true });
    window.addEventListener('resize', updateNavByScroll);
    window.addEventListener('hashchange', updateNavByScroll);
    // Вход на index.html#prices извне: браузер прокручивает к якорю после DOMContentLoaded,
    // поэтому сверяем подсветку ещё раз по полной загрузке страницы.
    window.addEventListener('load', updateNavByScroll);
    updateNavByScroll();
  } else {
    setActiveNav(NAV_BY_PAGE[page] || activePageNavKey() || null);
  }

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
          // Пункт-якорь подсвечиваем сразу, не дожидаясь конца плавной прокрутки
          if (spyIds.indexOf(href.slice(1)) !== -1) setActiveNav(href.slice(1));
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
