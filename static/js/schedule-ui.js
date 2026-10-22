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
 *   - режим занятия mode ∈ online|offline|hybrid (по умолчанию offline):
 *     пиктограмма 🖥/🏠/🔄 + цвет (классы .mode-online/.mode-offline/.mode-hybrid).
 */
(function () {
  var DAYS = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];

  var MODES = {
    online: { icon: '🖥', label: 'онлайн' },
    offline: { icon: '🏠', label: 'офлайн' },
    hybrid: { icon: '🔄', label: 'гибрид' }
  };

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function modeOf(slot) {
    return MODES[slot.mode] ? slot.mode : 'offline';
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
   * Недельная доска: 7 колонок (Пн–Вс), каждая тренировка — овальный чип
   * с иконкой режима, временем и названием программы.
   * slots: [{ day, time, place, mode, program, programId }]
   */
  function weekBoard(slots) {
    var byDay = {};
    sortSlots(slots).forEach(function (s) {
      (byDay[s.day] = byDay[s.day] || []).push(s);
    });
    var cols = DAYS.map(function (day) {
      var chips = (byDay[day] || []).map(function (s) {
        var m = modeOf(s);
        var place = s.place ? '<span class="week-chip-place">' + esc(s.place) + '</span>' : '';
        var href = s.programId != null ? 'program.html?id=' + s.programId : '#';
        return '<a class="week-chip mode-' + m + '" href="' + href + '" title="' + esc(s.program || '') + '">' +
          '<span class="week-chip-mode">' + MODES[m].icon + '</span>' +
          '<span class="week-chip-time">' + esc(s.time) + '</span>' +
          '<span class="week-chip-name">' + esc(s.program || '') + '</span>' + place + '</a>';
      }).join('');
      return '<div class="week-col">' +
        '<div class="week-col-title">' + day + '</div>' +
        '<div class="week-col-body">' + (chips || '<span class="week-col-empty">—</span>') + '</div>' +
        '</div>';
    }).join('');
    return '<div class="week-board-wrap"><div class="week-board">' + cols + '</div></div>';
  }

  /**
   * Компактная таблица (страницы программ и тренеров).
   * withProgram — добавлять колонку «Программа» (для «Мои тренировки»).
   * Колонка «Место» не выводится (S26).
   */
  function table(slots, withProgram) {
    var rows = sortSlots(slots).map(function (s) {
      var prog = '';
      if (withProgram) {
        prog = s.programId != null
          ? '<td><a class="schedule-program-link" href="program.html?id=' + s.programId + '">' + esc(s.program) + '</a></td>'
          : '<td>' + esc(s.program || '') + '</td>';
      }
      return '<tr>' + prog + '<td>' + esc(s.day) + '</td>' +
        '<td>' + modeBadge(s) + ' ' + esc(s.time) + '</td></tr>';
    }).join('');
    var head = withProgram ? '<th>Программа</th>' : '';
    return '<div class="schedule-table-wrap"><table class="schedule-table">' +
      '<thead><tr>' + head + '<th>День</th><th>Время</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table></div>';
  }

  window.ScheduleUI = {
    DAYS: DAYS,
    MODES: MODES,
    sortSlots: sortSlots,
    weekBoard: weekBoard,
    table: table,
    modeBadge: modeBadge
  };
})();
