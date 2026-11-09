/**
 * js/directions.js — страница ОДНОГО направления (S90, S127, S131).
 *
 * URL: directions.html?id=<dirId> (старые ссылки вида directions.html#<dirId>
 * тоже понимаются). Страницы «все направления» больше нет.
 *
 * Порядок блоков (S131 п.5):
 *   заголовок → обложка 2:3 + описание → счётчик «N тренировок» → плитки программ
 *   → тренеры направления → стоимость → расписание → CTA → другие направления.
 *
 * Новые опциональные поля направления (S131 п.4, дефолт = прежнее поведение):
 *   publicTitle · subtitle · showOnHome · showInMenu · showSchedule · priceGroup.
 */
(function () {
  'use strict';

  var data = window.SITE_DATA || {};
  var directions = data.directions || [];
  var programs = data.programs || [];
  var trainers = data.trainers || [];
  var scheduleTable = data.scheduleTable || [];
  var T = window.Tiles;
  var L = window.Layout;

  var mount = document.getElementById('direction-page');
  if (!mount || !T) return;

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // S125 п.6: бренд из «Главных данных», а не из захардкоженного siteTitle
  function brandTitle() {
    var b = window.SITE_BRAND || {};
    return b.title2 || b.title1 || data.siteTitle || 'ЦФР';
  }

  // S131 п.3: описание — через markdown (как программа/тренер/новость)
  function md(src) {
    return window.MD ? window.MD.render(src) : '<p>' + esc(src || '').replace(/\n/g, '<br>') + '</p>';
  }

  // id направления: ?id=… либо старый якорь #dir-N
  function currentDirId() {
    var q = new URLSearchParams(location.search).get('id');
    if (q) return q;
    var h = (location.hash || '').replace(/^#/, '');
    return /^dir-/.test(h) ? h : '';
  }

  function findDirection(id) {
    if (!id) return null;
    return directions.filter(function (d) { return String(d.id) === String(id) && !d.hidden; })[0] || null;
  }

  // Отображаемое имя: publicTitle → name (S131 п.4)
  function dirName(dir) {
    return (dir.publicTitle && String(dir.publicTitle).trim()) || dir.name || '';
  }

  // Плитки программ направления: полные данные берём из programs.js,
  // порядок — как в составе направления
  function dirPrograms(dir) {
    return (dir.programs || []).map(function (dp) {
      var full = programs.filter(function (p) { return String(p.id) === String(dp.id); })[0];
      return full || { id: dp.id, name: dp.name || '', image: dp.image || '' };
    }).filter(Boolean);
  }

  // Слоты расписания всех программ направления
  function dirSlots(dirList) {
    var ids = {};
    dirList.forEach(function (p) { ids[String(p.id)] = true; });
    return scheduleTable.filter(function (s) { return ids[String(s.programId)]; });
  }

  // S131 п.5: тренеры направления — все тренеры состава программ
  function dirTrainers(dirList) {
    var seen = {};
    var out = [];
    dirList.forEach(function (p) {
      (p.trainers || []).forEach(function (tr) {
        if (tr.id == null) return;
        if (seen[String(tr.id)]) return;
        seen[String(tr.id)] = true;
        var full = trainers.filter(function (t) { return String(t.id) === String(tr.id); })[0];
        if (full) out.push(full);
      });
    });
    return out;
  }

  // Обложка: своя картинка направления, иначе — ротация обложек программ (S87).
  // S131 п.6: точки-индикатор, пауза на hover, интервал из sliderSettings (дефолт 4 с).
  // S137: общий класс .entity-head-cover — float у левого края (стиль общий со страницей тренера).
  function coverHtml(dir, dirList) {
    if (dir.image) {
      return '<div class="direction-cover entity-head-cover lightbox-zoom"><img src="' + esc(dir.image) +
        '" alt="' + esc(dirName(dir)) + '" loading="lazy"></div>';
    }
    var covers = dirList.map(function (p) { return p.image; }).filter(Boolean);
    if (!covers.length) return '';
    var imgs = covers.map(function (src, i) {
      return '<img class="direction-cover-img' + (i === 0 ? ' active' : '') + '" src="' + esc(src) +
        '" alt="' + esc(dirName(dir)) + '" loading="lazy">';
    }).join('');
    var dots = covers.length > 1
      ? '<div class="direction-cover-dots">' + covers.map(function (_, i) {
          return '<button type="button" class="direction-cover-dot' + (i === 0 ? ' active' : '') +
            '" data-idx="' + i + '" aria-label="Фото ' + (i + 1) + '"></button>';
        }).join('') + '</div>'
      : '';
    return '<div class="direction-cover direction-cover-dynamic entity-head-cover lightbox-zoom">' + imgs + dots + '</div>';
  }

  // S131 п.5: CTA-блок — запись + телефон центра + все цены
  function ctaHtml() {
    var c = data.contacts || {};
    var tel = c.phone ? '<a class="program-btn program-btn-secondary" href="tel:' + esc(String(c.phone).replace(/\D/g, '')) + '">' + esc(c.phone) + '</a>' : '';
    return '<div class="direction-cta">' +
      '<button class="program-btn program-btn-primary" onclick="openCallModal(\'Страница направления\')"><i class="icon-call"></i> Записаться</button>' +
      tel +
      '<a class="program-btn program-btn-secondary" href="index.html#prices">Все цены и скидки →</a>' +
      '</div>';
  }

  // S131 п.5: «Другие направления» — ссылки на соседние непустые направления
  function relatedHtml(dir) {
    var others = directions.filter(function (d) {
      return String(d.id) !== String(dir.id) && !d.hidden && (d.programs || []).length > 0;
    }).slice(0, 4);
    if (!others.length) return '';
    var items = others.map(function (d) {
      return '<a class="direction-related-item" href="directions.html?id=' + encodeURIComponent(d.id) + '">' +
        esc(dirName(d)) + ' <span class="direction-related-count">' + (d.programs || []).length + '</span></a>';
    }).join('');
    return '<h2 class="entity-subtitle">Другие направления</h2>' +
      '<div class="direction-related">' + items + '</div>';
  }

  function notFound() {
    return '<h1 class="page-title">Направление не найдено</h1>' +
      '<p class="direction-desc">Такого направления нет или оно скрыто с сайта.</p>' +
      '<div class="entity-actions"><a class="program-btn program-btn-primary" href="programs.html">← ' +
      (L ? L.sectionName('programs', 'Наши тренировки') : 'Наши тренировки') + '</a></div>';
  }

  function plural(n, one, few, many) {
    var m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
    return many;
  }

  function render(dir) {
    var dirList = dirPrograms(dir);
    var cover = coverHtml(dir, dirList);
    // subtitle (teaser) — короткая строка под заголовком; описание — markdown (S131 п.3)
    var subtitle = dir.subtitle
      ? '<p class="direction-subtitle">' + esc(dir.subtitle) + '</p>'
      : '';
    var desc = dir.description
      ? '<div class="direction-desc">' + md(dir.description) + '</div>'
      : '';

    // S137: обложка float у левого края, описание обтекает справа.
    // Общий класс .entity-head-float — та же разметка, что на странице тренера.
    var head = (cover || desc)
      ? '<div class="direction-head entity-head-float">' + cover + desc + '</div>'
      : '';

    // S131 п.5/7: счётчик «N тренировок»
    var counter = '<p class="direction-count">' + dirList.length + ' ' +
      plural(dirList.length, 'тренировка', 'тренировки', 'тренировок') + '</p>';

    var tiles = T.grid(dirList.map(function (p) { return T.program(p); }).join(''));

    // Блок тренеров направления
    var dirTr = dirTrainers(dirList);
    var trainersBlock = dirTr.length
      ? '<h2 class="entity-subtitle">👥 Тренеры направления</h2>' + T.grid(dirTr.map(function (t) { return T.trainer(t); }).join(''))
      : '';

    // Блок стоимости: позиции программ направления + группа прайса (S131 п.5)
    var pricesBlock = '';
    if (window.PricesUI) {
      pricesBlock = window.PricesUI.block(
        window.PricesUI.byProgramIds(dirList.map(function (p) { return p.id; }), dir.priceGroup)
      );
    }

    // Расписание: недельная доска с легендой режимов; showSchedule === false — без блока
    var slots = dirSlots(dirList);
    var schedule = slots.length && window.ScheduleUI && dir.showSchedule !== false
      ? '<h2 class="entity-subtitle">📅 Расписание направления</h2>' + window.ScheduleUI.weekBoard(slots)
      : '';

    return '<h1 class="entity-title">' + esc(dirName(dir)) + '</h1>' +
      subtitle +
      head +
      counter +
      '<div class="direction-programs">' + tiles + '</div>' +
      (trainersBlock ? '<div class="direction-trainers">' + trainersBlock + '</div>' : '') +
      (pricesBlock ? '<div class="direction-prices">' + pricesBlock + '</div>' : '') +
      (schedule ? '<div class="direction-schedule">' + schedule + '</div>' : '') +
      ctaHtml() +
      relatedHtml(dir);
  }

  var dir = findDirection(currentDirId());
  if (!dir) {
    location.replace('404.html?from=' + encodeURIComponent('directions.html?id=' + currentDirId()) + '&id=' + encodeURIComponent(currentDirId()));
    return;
  }

  mount.innerHTML = render(dir);
  // S125 п.6: <title> через бренд из «Главных данных»
  document.title = dirName(dir) + ' — ' + brandTitle();

  // S127/S131 п.2: хлебные крошки «Главная → Наши тренировки → <Направление>»
  if (L) {
    var pageMain = document.getElementById('page-main');
    L.renderCrumbs(pageMain, [
      { href: 'index.html', label: 'Главная' },
      { href: 'programs.html', label: L.sectionName('programs', 'Наши тренировки') },
      { label: dirName(dir) }
    ]);
    L.renderCrossLinks(pageMain, 'programs');
  }

  // S131 п.7: свайп фото в плитках программы/тренера
  T.initAll(mount);

  // S131 п.6: ротация обложек — точки, пауза на hover, интервал из sliderSettings (дефолт 4 с)
  var dynamic = mount.querySelector('.direction-cover-dynamic');
  if (dynamic) {
    var imgs = dynamic.querySelectorAll('.direction-cover-img');
    var dots = dynamic.querySelectorAll('.direction-cover-dot');
    if (imgs.length > 1) {
      var ss = data.sliderSettings || {};
      var interval = (Number(ss.coverInterval) > 0 ? Number(ss.coverInterval) : 4) * 1000;
      var idx = 0, timer = null;
      function show(i) {
        imgs[idx].classList.remove('active');
        if (dots[idx]) dots[idx].classList.remove('active');
        idx = (i + imgs.length) % imgs.length;
        imgs[idx].classList.add('active');
        if (dots[idx]) dots[idx].classList.add('active');
      }
      function start() { if (!timer) timer = setInterval(function () { show(idx + 1); }, interval); }
      function stop() { clearInterval(timer); timer = null; }
      dynamic.addEventListener('mouseenter', stop);
      dynamic.addEventListener('mouseleave', start);
      dots.forEach(function (dot) {
        dot.addEventListener('click', function (e) {
          e.stopPropagation();
          show(Number(dot.getAttribute('data-idx')));
          stop(); start();
        });
      });
      start();
    }
  }
})();
