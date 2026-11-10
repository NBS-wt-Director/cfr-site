/**
 * schedule-ui.js — ЕДИНЫЙ рендер расписания (S45).
 *
 * Один модуль на все места вывода расписания:
 *   - недельная доска на главной (main.js)      → ScheduleUI.weekBoard()
 *   - таблица расписания программы (entity.js)  → ScheduleUI.table()
 *   - «Мои тренировки» тренера (entity.js)       → ScheduleUI.table()
 *
 * Правила:
 *   - сортировка: дни Пн→Вс, внутри дня — по возрастанию времени;
 *   - режим занятия mode ∈ hall|online|hybrid (по умолчанию hybrid):
 *     🏋️ зал / 🖥 онлайн / 🔄 гибрид (классы .mode-hall/.mode-online/.mode-hybrid);
 *   - зал hall ∈ big|small (большой/малый);
 *   - тренер — ФИО из данных слота (trainer).
 */
(function () {
  var DAYS = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
  var DAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  // S150: индекс текущего дня (Пн=0 … Вс=6)
  function todayIndex() {
    var d = (new Date()).getDay(); // Вс=0 … Сб=6
    return d === 0 ? 6 : d - 1;
  }

  // S150: вкладки дней для мобильной карусели (на десктопе скрыты CSS)
  function dayTabs() {
    var ti = todayIndex();
    return '<div class="week-day-tabs" role="tablist">' + DAYS.map(function (day, i) {
      return '<button type="button" class="week-day-tab' + (i === ti ? ' active' : '') +
        '" data-day-idx="' + i + '" role="tab" aria-selected="' + (i === ti) + '">' + DAYS_SHORT[i] + '</button>';
    }).join('') + '</div>';
  }

  var MODES = {
    hall: { icon: '🏋️', label: 'зал' },
    online: { icon: '🖥', label: 'онлайн' },
    hybrid: { icon: '🔄', label: 'гибрид' }
  };

  var HALLS = { big: 'большой зал', small: 'малый зал' };

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function modeOf(slot) {
    return MODES[slot.mode] ? slot.mode : 'hybrid';
  }

  function hallOf(slot) {
    return HALLS[slot.hall] ? slot.hall : 'big';
  }

  function modeBadge(slot) {
    var m = modeOf(slot);
    return '<span class="schedule-mode mode-' + m + '" title="' + MODES[m].label + '">' +
      MODES[m].icon + '</span>';
  }

  function dayIndex(day) {
    var i = DAYS.indexOf(day);
    return i === -1 ? DAYS.length : i;
  }

  // Сортировка: день (Пн→Вс), затем время по возрастанию («8:00» < «18:00» — по минутам)
  function timeMinutes(t) {
    var m = /^(\d{1,2})[:.](\d{2})/.exec(String(t || ''));
    return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
  }

  function sortSlots(slots) {
    return (slots || []).slice().sort(function (a, b) {
      var d = dayIndex(a.day) - dayIndex(b.day);
      if (d !== 0) return d;
      return timeMinutes(a.time) - timeMinutes(b.time);
    });
  }

  /**
   * Легенда режимов занятий (S88).
   * Возвращает HTML строки с бейджами: 🏋️ Зал / 🖥 Онлайн / 🔄 Гибрид.
   * Если есть хотя бы один слот с данным режимом — бейдж подсвечен, иначе — нейтральный.
   */
  function legend(slots) {
    var hasSlots = slots && slots.length > 0;
    var modes = {};
    if (hasSlots) {
      slots.forEach(function (s) {
        var m = modeOf(s);
        modes[m] = true;
      });
    }
    var items = Object.keys(MODES).map(function (key) {
      var m = MODES[key];
      var cls = modes[key] ? ' mode-active' : '';
      return '<span class="schedule-legend-item' + cls + '">' + m.icon + ' ' + m.label + '</span>';
    }).join(' ');
    return '<div class="schedule-legend' + (hasSlots ? '' : ' schedule-legend--hidden') + '">' + items + '</div>';
  }

  /**
   * Недельная доска: 7 колонок (Пн–Вс), каждая тренировка — овальный чип
   * с иконкой режима, временем, названием программы, залом и тренером.
   * slots: [{ day, time, hall, mode, program, programId, programSlug, programHasAlbum, trainer }]
   * selfProgram (опц., S151): { id, slug, hasAlbum } — для страниц, где слоты
   *   самой программы (program.html): чип ведёт на неё же.
   */
  function weekBoard(slots, selfProgram) {
    var byDay = {};
    sortSlots(slots).forEach(function (s) {
      (byDay[s.day] = byDay[s.day] || []).push(s);
    });
    var cols = DAYS.map(function (day, di) {
      var chips = (byDay[day] || []).map(function (s) {
        var m = modeOf(s);
        var hall = '<span class="week-chip-place">' + (s.hall === 'small' ? 'малый зал' : 'большой зал') + '</span>';
        // S128 п.10: place (место занятия) есть в экспорте слотов, но раньше
        // не рендерился нигде — на вопрос «где проходят занятия» сайт не отвечал.
        var place = s.place ? '<span class="week-chip-place">📍 ' + esc(s.place) + '</span>' : '';
        var trainer = s.trainer ? '<span class="week-chip-trainer">🧑‍🏫 ' + esc(s.trainer) + '</span>' : '';
        // S151: ссылок-переходов у чипа больше нет — клик открывает меню (см. chip-menu).
        // Данные цели — в data-атрибутах; если программы нет (слот вне программы) —
        // href остаётся и чип работает как раньше (прямая ссылка).
        var pid = s.programId != null ? s.programId
          : (selfProgram && selfProgram.id != null ? selfProgram.id : null);
        var pslug = s.programSlug || (selfProgram && selfProgram.slug) || '';
        var phasAlbum = s.programHasAlbum != null ? !!s.programHasAlbum
          : (selfProgram ? !!selfProgram.hasAlbum : false);
        if (pid == null && !pslug) {
          return '<div class="week-chip-wrap"><a class="week-chip mode-' + m + '" href="#">' +
            '<span class="week-chip-mode">' + MODES[m].icon + '</span>' +
            '<span class="week-chip-time">' + esc(s.time) + '</span>' +
            '<span class="week-chip-name">' + esc(s.program || '') + '</span>' + hall + place + trainer + '</a></div>';
        }
        var target = 'program.html?id=' + encodeURIComponent(pslug || pid);
        // S155: точное место вызова — кнопка + занятия + тренер (для письма админу)
        var callReason = esc('Кнопка «Записаться» в расписании: ' + (s.day || '') + ' ' + (s.time || '') + ' — ' + (s.program || '') +
          (s.trainer ? ', тренер ' + s.trainer : ''));
        return '<div class="week-chip-wrap" data-target="' + esc(target) + '"' +
          (phasAlbum ? ' data-album="1"' : '') + '>' +
          '<button type="button" class="week-chip mode-' + m + '" aria-expanded="false" title="' + esc(s.program || '') + '">' +
          '<span class="week-chip-mode">' + MODES[m].icon + '</span>' +
          '<span class="week-chip-time">' + esc(s.time) + '</span>' +
          '<span class="week-chip-name">' + esc(s.program || '') + '</span>' + hall + place + trainer + '</button>' +
          '<div class="chip-menu" hidden>' +
            '<a class="chip-menu-btn chip-menu-more" href="' + esc(target) + '">Подробнее</a>' +
            (phasAlbum
              ? '<a class="chip-menu-btn chip-menu-view" href="' + esc(target) + '#album">Посмотреть</a>'
              : '<a class="chip-menu-btn chip-menu-view" hidden></a>') +
            '<button type="button" class="chip-menu-btn chip-menu-signup" data-call="' + callReason + '">Записаться</button>' +
          '</div>' +
          '</div>';
      }).join('');
      return '<div class="week-col' + (di === todayIndex() ? ' day-active' : '') + '" data-day-idx="' + di + '">' +
        '<div class="week-col-title">' + day + '</div>' +
        '<div class="week-col-body">' + (chips || '<span class="week-col-empty">—</span>') + '</div>' +
        '</div>';
    }).join('');
    // S150: вкладки дней (видны только на мобильном — CSS)
    return '<div class="week-board-wrap">' + legend(slots) + dayTabs() + '<div class="week-board">' + cols + '</div></div>';
  }

  /**
   * Компактная таблица (страницы программ и тренеров).
   * withProgram — добавлять колонку «Программа» (для «Мои тренировки»).
   * Колонки: Программа | День | Время | Зал | Место | Тренер
   * S128 п.10: колонка «Место» выводится, если хоть у одного слота есть place.
   * S150: строки сгруппированы по дням в <tbody data-day="..."> для карусели дней.
   */
  function table(slots, withProgram) {
    var hasPlace = (slots || []).some(function (s) { return s.place; });
    // S150: группировка по дням
    var byDay = {};
    sortSlots(slots).forEach(function (s) {
      (byDay[s.day] = byDay[s.day] || []).push(s);
    });
    // S150: tbody на каждый день
    var hasTrainerCol = !!(slots && slots.length && slots[0].trainer != null);
    var dayBodies = DAYS.map(function (day, di) {
      var rows = (byDay[day] || []).map(function (s) {
        var prog = '';
        if (withProgram) {
          prog = s.programId != null
            ? '<td><a class="schedule-program-link" href="program.html?id=' + (s.programSlug || s.programId) + '">' + esc(s.program) + '</a></td>'
            : '<td>' + esc(s.program || '') + '</td>';
        }
        return '<tr>' + prog + '<td>' + esc(s.day) + '</td>' +
          '<td>' + modeBadge(s) + ' ' + esc(s.time) + '</td>' +
          '<td>' + esc(HALLS[hallOf(s)]) + '</td>' +
          (hasPlace ? '<td>' + esc(s.place || '—') + '</td>' : '') +
          (s.trainer != null ? '<td>' + esc(s.trainer || '—') + '</td>' : '') +
          '</tr>';
      }).join('');
      // Пустой день: заглушка на всю ширину (число колонок = как в thead)
      var nCols = (withProgram ? 1 : 0) + 3 + (hasPlace ? 1 : 0) + (hasTrainerCol ? 1 : 0);
      var emptyRow = rows
        ? ''
        : '<tr class="sched-day-empty"><td colspan="' + nCols + '">Нет занятий в этот день</td></tr>';
      return '<tbody class="sched-day-body' + (di === todayIndex() ? ' day-active' : '') + '" data-day-idx="' + di + '">' + rows + emptyRow + '</tbody>';
    }).join('');
    var head = (withProgram ? '<th>Программа</th>' : '') +
      '<th>День</th><th>Время</th><th>Зал</th>' +
      (hasPlace ? '<th>Место</th>' : '') +
      (hasTrainerCol ? '<th>Тренер</th>' : '');
    return '<div class="schedule-table-wrap">' + legend(slots) + dayTabs() + '<table class="schedule-table">' +
      '<thead><tr>' + head + '</tr></thead>' +
      dayBodies + '</table></div>';
  }

  /* ============================================
     Переключатель «Доска / Таблица» (S132 п.4)
     Один helper на все страницы сущностей и направление:
     раньше страница программы показывала только компактную таблицу,
     а главная/тренер/направление — недельную доску (три вида одного объекта).
     Выбор сохраняется в localStorage (ключ передаётся вызывающим).
     ============================================ */
  function boardOrTable(slots, withProgram, storeKey, selfProgram) {
    var key = storeKey || 'schedule-entity-view';
    var view = 'board';
    try { var v = localStorage.getItem(key); if (v === 'table' || v === 'board') view = v; } catch (e) {}

    var switchHtml =
      '<div class="schedule-switch schedule-board-switch" role="tablist">' +
        '<button type="button" class="schedule-switch-btn' + (view === 'board' ? ' active' : '') +
          '" data-view="board" role="tab" aria-selected="' + (view === 'board') + '">🗓 Доска</button>' +
        '<button type="button" class="schedule-switch-btn' + (view === 'table' ? ' active' : '') +
          '" data-view="table" role="tab" aria-selected="' + (view === 'table') + '">📋 Таблица</button>' +
      '</div>';

    return '<div class="schedule-switched" data-store="' + esc(key) + '" data-view="' + view + '">' +
      switchHtml +
      '<div class="schedule-view schedule-view-board"' + (view === 'board' ? '' : ' hidden') + '>' + weekBoard(slots, selfProgram) + '</div>' +
      '<div class="schedule-view schedule-view-table"' + (view === 'table' ? '' : ' hidden') + '>' + table(slots, withProgram) + '</div>' +
    '</div>';
  }

  /* ============================================
     S151: меню действий чипа расписания
     Клик по чипу: чип чуть увеличивается (класс chip-open) и под ним
     появляется меню: «Подробнее» / «Посмотреть» (если есть альбом) /
     «Записаться» (форма звонка; причина = тренировка + страница).
     Делегирование на document — работает на любой странице расписания.
     ============================================ */
  var chipMenuBound = false;
  var chipMenuEl = null;   // меню в body (position:fixed), если открыто
  var chipMenuWrap = null; // обёртка чипа, к которой привязано меню
  var chipRepos = null;    // слушатель репозиционирования

  function detachChipMenu() {
    if (!chipMenuEl) return;
    if (chipRepos) {
      window.removeEventListener('scroll', chipRepos, true);
      window.removeEventListener('resize', chipRepos);
      chipRepos = null;
    }
    var w = chipMenuWrap;
    chipMenuEl.style.position = '';
    chipMenuEl.style.top = '';
    chipMenuEl.style.left = '';
    chipMenuEl.style.width = '';
    if (w) w.appendChild(chipMenuEl); // возвращаем в обёртку
    chipMenuEl = null;
    chipMenuWrap = null;
  }

  function closeAllChipMenus(except) {
    document.querySelectorAll('.week-chip-wrap.chip-open').forEach(function (w) {
      if (w === except) return;
      w.classList.remove('chip-open');
      var menu = w.querySelector('.chip-menu');
      if (menu) menu.hidden = true;
      var chip = w.querySelector('.week-chip');
      if (chip) chip.setAttribute('aria-expanded', 'false');
    });
    // Активное меню (в body) тоже закрыть, если оно не у except
    if (chipMenuEl && chipMenuWrap !== except) {
      var ew = chipMenuWrap;
      detachChipMenu();
      if (ew) {
        ew.classList.remove('chip-open');
        var m = ew.querySelector('.chip-menu');
        if (m) m.hidden = true;
        var c = ew.querySelector('.week-chip');
        if (c) c.setAttribute('aria-expanded', 'false');
      }
    }
  }

  function positionChipMenu(menu, chip) {
    var rect = chip.getBoundingClientRect();
    var menuW = 180;
    var left = rect.left + rect.width / 2 - menuW / 2;
    if (left < 8) left = 8;
    if (left + menuW > window.innerWidth - 8) left = window.innerWidth - 8 - menuW;
    menu.style.left = left + 'px';
    menu.style.top = (rect.bottom + 6) + 'px';
    menu.style.width = menuW + 'px';
  }

  function initChipMenu() {
    if (chipMenuBound) return;
    chipMenuBound = true;

    document.addEventListener('click', function (e) {
      // 1) Кнопка «Записаться» — форма обратной связи с причиной-тренировкой
      var signup = e.target.closest('.chip-menu-signup');
      if (signup) {
        e.preventDefault();
        var reason = signup.getAttribute('data-call') || 'Расписание';
        closeAllChipMenus(null);
        detachChipMenu();
        if (window.openCallModal) window.openCallModal(reason);
        return;
      }
      // 2) Кнопки-ссылки меню («Подробнее»/«Посмотреть») — штатный переход,
      //    меню закрываем, чтобы не мешало следующей странице
      var link = e.target.closest('.chip-menu-btn');
      if (link) { closeAllChipMenus(null); detachChipMenu(); return; }
      // 3) Клик по чипу — открыть/закрыть меню
      var chip = e.target.closest('.week-chip');
      if (chip) {
        var wrap = chip.closest('.week-chip-wrap');
        if (!wrap) return;
        var target = wrap.getAttribute('data-target');
        if (!target) return; // чип без цели — прямая ссылка как раньше
        e.preventDefault();
        var wasOpen = wrap.classList.contains('chip-open');
        closeAllChipMenus(wrap);
        detachChipMenu();
        if (wasOpen) {
          wrap.classList.remove('chip-open');
          var menuClose = wrap.querySelector('.chip-menu');
          if (menuClose) menuClose.hidden = true;
          chip.setAttribute('aria-expanded', 'false');
          return;
        }
        var menu = wrap.querySelector('.chip-menu');
        if (!menu) return;
        wrap.classList.add('chip-open');
        chip.setAttribute('aria-expanded', 'true');
        // Переносим в body → не обрезается overflow и не прячется под компонентами
        document.body.appendChild(menu);
        menu.style.position = 'fixed';
        menu.hidden = false;
        chipMenuEl = menu;
        chipMenuWrap = wrap;
        positionChipMenu(menu, chip);
        chipRepos = function () { positionChipMenu(menu, chip); };
        window.addEventListener('scroll', chipRepos, true);
        window.addEventListener('resize', chipRepos);
        return;
      }
      // 4) Клик мимо — закрыть
      closeAllChipMenus(null);
      detachChipMenu();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { closeAllChipMenus(null); detachChipMenu(); }
    });
  }
  initChipMenu();

  // Подвязка переключения после вставки HTML
  function initSwitches(root) {
    var scope = root || document;
    scope.querySelectorAll('.schedule-switched').forEach(function (wrap) {
      if (wrap.getAttribute('data-switch-bound') === '1') return;
      wrap.setAttribute('data-switch-bound', '1');
      var key = wrap.getAttribute('data-store');
      wrap.querySelectorAll('.schedule-switch-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var v = btn.getAttribute('data-view');
          wrap.setAttribute('data-view', v);
          wrap.querySelectorAll('.schedule-switch-btn').forEach(function (b) {
            var on = b === btn;
            b.classList.toggle('active', on);
            b.setAttribute('aria-selected', String(on));
          });
          wrap.querySelectorAll('.schedule-view').forEach(function (box) {
            box.hidden = box.classList.contains('schedule-view-' + v) ? false : true;
          });
          try { localStorage.setItem(key, v); } catch (e) {}
        });
      });
    });
  }

  /* ============================================
     S150: карусель дней — переключение вкладок + свайп
     Вешается на document (работает на всех .week-board-wrap и .schedule-table-wrap).
     На мобильном ≤767px: одна колонка/таблица на день + вкладки + свайп.
     На десктопе — ничего не меняет (все дни видны).
     ============================================ */
  var dayCarouselBound = false;
  function initDayCarousel() {
    if (dayCarouselBound) return;
    dayCarouselBound = true;

    // matchMedia может отсутствовать (старые браузеры/тестовая среда) —
    // тогда свайп считаем активным по ширине окна
    var mq = (typeof window.matchMedia === 'function')
      ? window.matchMedia('(max-width: 767px)')
      : { matches: false };
    function isMobile() {
      return mq.matches || (window.innerWidth <= 767);
    }

    function setActiveDay(wrap, idx) {
      // Колонки доски
      wrap.querySelectorAll('.week-col').forEach(function (c) {
        c.classList.toggle('day-active', Number(c.getAttribute('data-day-idx')) === idx);
      });
      // Вкладки
      wrap.querySelectorAll('.week-day-tab').forEach(function (t) {
        t.classList.toggle('active', Number(t.getAttribute('data-day-idx')) === idx);
        t.setAttribute('aria-selected', String(Number(t.getAttribute('data-day-idx')) === idx));
      });
      // Строки таблицы
      wrap.querySelectorAll('.sched-day-body').forEach(function (tb) {
        tb.classList.toggle('day-active', Number(tb.getAttribute('data-day-idx')) === idx);
      });
    }

    // Привязка кликов по вкладкам
    document.addEventListener('click', function (e) {
      var tab = e.target.closest('.week-day-tab');
      if (!tab) return;
      var wrap = tab.closest('.week-board-wrap, .schedule-table-wrap');
      if (!wrap) return;
      setActiveDay(wrap, Number(tab.getAttribute('data-day-idx')));
    });

    // Свайп влево/вправо на .week-board-wrap и .schedule-table-wrap
    var SWIPE_THRESHOLD = 40;
    document.addEventListener('touchstart', function (e) {
      var el = e.target.closest('.week-board-wrap, .schedule-table-wrap');
      if (!el || !isMobile()) return;
      el._swipeStartX = e.touches[0].clientX;
    }, { passive: true });

    document.addEventListener('touchend', function (e) {
      var el = e.target.closest('.week-board-wrap, .schedule-table-wrap');
      if (!el || !isMobile() || !el._swipeStartX) return;
      var dx = e.changedTouches[0].clientX - el._swipeStartX;
      el._swipeStartX = null;
      if (Math.abs(dx) < SWIPE_THRESHOLD) return;

      // Найти текущий активный день
      var activeIdx = -1;
      el.querySelectorAll('.week-col, .sched-day-body').forEach(function (el2) {
        if (el2.classList.contains('day-active')) activeIdx = Number(el2.getAttribute('data-day-idx'));
      });
      if (activeIdx === -1) activeIdx = todayIndex();
      var dir = dx > 0 ? -1 : 1; // свайп вправо = предыдущий день, влево = следующий
      var next = (activeIdx + dir + 7) % 7;
      setActiveDay(el, next);
    }, { passive: true });
  }

  window.ScheduleUI = {
    DAYS: DAYS,
    MODES: MODES,
    HALLS: HALLS,
    sortSlots: sortSlots,
    weekBoard: weekBoard,
    table: table,
    boardOrTable: boardOrTable,
    initSwitches: initSwitches,
    initDayCarousel: initDayCarousel,
    initChipMenu: initChipMenu,
    modeBadge: modeBadge
  };

  // S150: инициализируем карусель сразу после загрузки скрипта
  // (все обработчики — через document, поэтому работает и для DOM, добавленного позже)
  initDayCarousel();
})();
