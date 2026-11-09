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
   * slots: [{ day, time, hall, mode, program, programId, trainer }]
   */
  function weekBoard(slots) {
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
        var href = s.programId != null ? 'program.html?id=' + s.programId : '#';
        return '<a class="week-chip mode-' + m + '" href="' + href + '" title="' + esc(s.program || '') + '">' +
          '<span class="week-chip-mode">' + MODES[m].icon + '</span>' +
          '<span class="week-chip-time">' + esc(s.time) + '</span>' +
          '<span class="week-chip-name">' + esc(s.program || '') + '</span>' + hall + place + trainer + '</a>';
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
            ? '<td><a class="schedule-program-link" href="program.html?id=' + s.programId + '">' + esc(s.program) + '</a></td>'
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
  function boardOrTable(slots, withProgram, storeKey) {
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
      '<div class="schedule-view schedule-view-board"' + (view === 'board' ? '' : ' hidden') + '>' + weekBoard(slots) + '</div>' +
      '<div class="schedule-view schedule-view-table"' + (view === 'table' ? '' : ' hidden') + '>' + table(slots, withProgram) + '</div>' +
    '</div>';
  }

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
    modeBadge: modeBadge
  };

  // S150: инициализируем карусель сразу после загрузки скрипта
  // (все обработчики — через document, поэтому работает и для DOM, добавленного позже)
  initDayCarousel();
})();
