/**
 * js/directions.js — Рендеринг страницы направлений (S23).
 *
 * Отображает:
 *   - Название направления
 *   - Описание (если есть)
 *   - Обложку (если есть)
 *   - Список программ по направлению (плиткой)
 *   - Расписание программ (через ScheduleUI)
 */
(function () {
  'use strict';

  if (!window.SITE_DATA) return;

  var directions = window.SITE_DATA.directions || [];
  var programs = window.SITE_DATA.programs || [];
  var scheduleTable = window.SITE_DATA.scheduleTable || [];

  var container = document.getElementById('directions-list');
  if (!container) return;

  // Фильтруем: показываем только непустые и не скрытые направления
  var visibleDirections = directions.filter(function (d) {
    return !d.hidden && d.programs && d.programs.length > 0;
  });

  // Кэш программ по directionId
  var programsByDirection = {};
  programs.forEach(function (p) {
    if (p.directionId) {
      (programsByDirection[p.directionId] = programsByDirection[p.directionId] || []).push(p);
    }
  });

  // Кэш расписания по programId
  var scheduleByProgram = {};
  scheduleTable.forEach(function (s) {
    (scheduleByProgram[s.programId] = scheduleByProgram[s.programId] || []).push(s);
  });

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function shortQuote(s, max) {
    max = max || 200;
    if (!s) return '';
    var text = s.replace(/<[^>]*>/g, '');
    if (text.length <= max) return text;
    return text.slice(0, max) + '…';
  }

  function tileImage(src, href, alt) {
    if (!src) return '';
    return '<a href="' + href + '" class="tile-image-link"><img src="' + src + '" alt="' + esc(alt || '') + '"></a>';
  }

  function renderDirection(dir) {
    var dirPrograms = dir.programs || [];
    var programsHtml = dirPrograms.map(function (p) {
      var schedule = scheduleByProgram[p.id] || [];
      var scheduleHtml = schedule.length > 0
        ? ScheduleUI.table(schedule, true)
        : '';

      return '<div class="direction-program-card">' +
        '<div class="direction-program-cover">' + tileImage(p.image, 'program.html?id=' + p.id, p.name) + '</div>' +
        '<h3 class="direction-program-title">' +
          '<a href="program.html?id=' + p.id + '">' + esc(p.name) + '</a>' +
          '<a href="program.html?id=' + p.id + '" class="direction-program-more">Подробнее</a>' +
        '</h3>' +
        (scheduleHtml ? '<div class="direction-program-schedule">' + scheduleHtml + '</div>' : '') +
      '</div>';
    }).join('');

    // Обложка: если есть своя — показываем; иначе — ротация обложек программ направления (S87)
    var coverWrap = '';
    if (dir.image) {
      coverWrap = '<div class="direction-cover-wrap"><img class="direction-cover" src="' + dir.image + '" alt="' + esc(dir.name) + '"></div>';
    } else {
      var programCovers = dirPrograms.map(function (p) { return p.image; }).filter(Boolean);
      if (programCovers.length > 0) {
        var coverSlides = programCovers.map(function (src, i) {
          return '<img class="direction-dynamic-cover' + (i === 0 ? ' active' : '') + '" src="' + src + '" alt="' + esc(dir.name) + '">';
        }).join('');
        coverWrap = '<div class="direction-cover-wrap direction-dynamic-cover-wrap">' + coverSlides + '</div>';
        // Запуск ротации
        setTimeout(function () {
          var wraps = document.querySelectorAll('.direction-dynamic-cover-wrap');
          wraps.forEach(function (wrap) {
            var imgs = wrap.querySelectorAll('.direction-dynamic-cover');
            if (imgs.length <= 1) return;
            var idx = 0;
            setInterval(function () {
              imgs[idx].classList.remove('active');
              idx = (idx + 1) % imgs.length;
              imgs[idx].classList.add('active');
            }, 4000);
          });
        }, 100);
      }
    }

    var descHtml = dir.description
      ? '<div class="direction-desc">' + esc(dir.description) + '</div>'
      : '';

    return '<section class="direction-section" id="dir-' + dir.id + '">' +
      '<h2 class="direction-name">' + esc(dir.name) + '</h2>' +
      coverWrap +
      descHtml +
      '<div class="direction-programs">' + programsHtml + '</div>' +
    '</section>';
  }

  container.innerHTML = visibleDirections.map(renderDirection).join('');

  // Устанавливаем title страницы
  document.title = 'Направления — ' + (window.SITE_DATA.siteTitle || 'Центр Развития');

})();
