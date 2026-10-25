/**
 * entity.js — рендер страницы программы или тренера по ?id=.
 *
 * Один шаблон на все сущности: static/program.html и static/trainer.html
 * различаются только подключённым модулем данных и data-entity на <body>.
 *
 * Данные берутся из window.SITE_DATA.programs / .trainers —
 * отдельных HTML-файлов на каждую сущность не генерируется.
 */
(function () {
  var CAT_TITLES = {
    'БОЕВЫЕ НАПРАВЛЕНИЯ': '🥋 Боевые направления',
    'ДЕТСКИЕ НАПРАВЛЕНИЯ': '🧒 Детские направления',
    'ОБУЧАЮЩИЕ ПРОГРАММЫ': '📚 Обучающие программы',
    'ОЗДОРОВИТЕЛЬНЫЕ НАПРАВЛЕНИЯ': '💚 Оздоровительные направления',
    'ФУНКЦИОНАЛЬНЫЕ НАПРАВЛЕНИЯ': '💪 Функциональные направления'
  };

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function md(src) {
    return window.MD ? window.MD.render(src) : '<p>' + esc(src || '').replace(/\n/g, '<br>') + '</p>';
  }

  // ── Структурные данные (S22). Расписание рендерит общий ScheduleUI (S45) ──

  // Ключ ФИО для нестрогого сравнения: ё→е, токены, порядок первых двух
  function tokKey(name) {
    return String(name || '').toLowerCase().replace(/ё/g, 'е')
      .trim().split(/\s+/).filter(Boolean);
  }

  function sameTrainer(ref, t) {
    if (ref.id != null) return Number(ref.id) === Number(t.id);
    var a = tokKey(ref.name), b = tokKey(t.name);
    if (a.length < 2 || b.length < 2) return false;
    return a.slice(0, 2).sort().join(' ') === b.slice(0, 2).sort().join(' ');
  }

  // Обёртки над общим модулем (если он не загружен — пустой блок вместо ошибки)
  function slotsTable(slots, withProgram) {
    return window.ScheduleUI ? window.ScheduleUI.table(slots, withProgram) : '';
  }

  // Блок «Ведёт» на странице программы
  function trainersBlock(refs) {
    if (!refs || !refs.length) return '';
    var cards = refs.map(function (tr) {
      return tr.id != null
        ? '<a class="entity-trainer-card" href="trainer.html?id=' + tr.id + '">🧑‍🏫 ' + esc(tr.name) + '</a>'
        : '<span class="entity-trainer-card entity-trainer-card-plain">🧑‍🏫 ' + esc(tr.name) + '</span>';
    }).join('');
    return '<h2 class="entity-subtitle">👨‍🏫 Ведёт</h2>' +
      '<div class="entity-trainers">' + cards + '</div>';
  }

  // Блок «Расписание» на странице программы
  function scheduleBlock(slots) {
    if (!slots || !slots.length) return '';
    // Обогощаем слоты hall/mode/trainer (trainer уже в exported данных)
    var enriched = slots.map(function (s) {
      return { day: s.day, time: s.time, hall: s.hall, mode: s.mode, trainer: s.trainer || '' };
    });
    return '<h2 class="entity-subtitle">📅 Расписание</h2>' + slotsTable(enriched, false);
  }

  // Убирает из описания тренера секции, которые выводятся отдельными блоками
  var TRAINER_MARKERS = {
    'ФИО': true, 'Стаж Ушу': 'experienceUshu', 'Стаж УШУ': 'experienceUshu', 'Стаж ушу': 'experienceUshu',
    'Тренерский стаж': 'experienceCoach', 'Специализация': 'specialization',
    'Образование': 'education', 'Девиз': 'motto'
  };

  function cleanTrainerDesc(text, t) {
    if (!text) return '';
    var markerRe = /^(ФИО|Стаж Ушу|Стаж УШУ|Стаж ушу|Тренерский стаж|Специализация|Образование|Девиз)\s*:?/;
    var out = [], skip = false;
    text.split('\n').forEach(function (line) {
      var m = line.trim().match(markerRe);
      if (m) {
        var field = TRAINER_MARKERS[m[1]];
        // Убираем секцию, только если её содержимое есть где показать
        skip = field === true || (field && t[field]);
        return;
      }
      if (!skip) out.push(line);
    });
    return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  // Слоты всех программ, где тренер указан в trainers[]
  function trainerSlots(t, programs) {
    var slots = [];
    (programs || []).forEach(function (p) {
      var refs = p.trainers || [];
      var mine = refs.some(function (tr) { return sameTrainer(tr, t); });
      if (!mine) return;
      (p.scheduleStructured || []).forEach(function (s) {
        slots.push({
          day: s.day, time: s.time, hall: s.hall, mode: s.mode,
          program: p.name, programId: p.id,
          trainer: s.trainer || ''
        });
      });
    });
    return slots;
  }

  // S62: «Фотоальбом» = горизонтальная карусель необрезанных фото
  function albumHtml(album, altBase) {
    if (!album || !album.length) return '';
    // Если модуль карусели загружен — карусель (фото целиком, без crop)
    if (window.Carousel && window.Carousel.render) {
      return '<h2 class="entity-subtitle">Фотоальбом</h2>' +
        '<div class="entity-album">' + window.Carousel.render(album, altBase) + '</div>';
    }
    // Фолбэк: старая сетка (если carousel.js не подключён)
    var items = album.map(function (a) {
      return '<div class="album-item lightbox-zoom" data-full="' + a.image + '">' +
        '<img src="' + a.image + '" alt="' + esc(a.caption || altBase) + '" loading="lazy">' +
        '</div>';
    }).join('');
    return '<h2 class="entity-subtitle">Фотоальбом</h2>' +
      '<div class="album-grid">' + items + '</div>';
  }

  function notFound(backHref, backLabel) {
    return '<div class="entity-not-found">' +
      '<h1 class="entity-title">Не найдено</h1>' +
      '<p class="entity-meta">Такой записи нет или она скрыта с сайта.</p>' +
      '<div class="entity-actions"><a class="program-btn program-btn-primary" href="' + backHref + '">← ' + backLabel + '</a></div>' +
      '</div>';
  }

  function programBody(p) {
    var cat = CAT_TITLES[p.category] || p.category;
    return (p.image
        ? '<img class="entity-cover lightbox-zoom" src="' + p.image + '" alt="' + esc(p.name) + '">'
        : '<img class="entity-cover entity-cover-logo" src="logo.png" alt="Шифу Панда">') +
      '<h1 class="entity-title">' + esc(p.name) + '</h1>' +
      (cat ? '<p class="entity-meta">📁 ' + esc(cat) + '</p>' : '') +
      trainersBlock(p.trainers) +
      '<div class="entity-text">' + md(p.description) + '</div>' +
      scheduleBlock(p.scheduleStructured) +
      albumHtml(p.photoAlbum, p.name) +
      '<div class="entity-actions">' +
      '<button class="program-btn program-btn-primary" onclick="openCallModal(\'Записаться: ' + esc(p.name) + '\')"><i class="icon-call"></i> Записаться</button>' +
      '</div>';
  }

  function trainerBody(t, programs) {
    // Бейджи стажа: новые структурированные поля или старый experience
    var badges = '';
    if (t.experienceUshu || t.experienceCoach) {
      badges = '<div class="entity-info-grid">' +
        (t.experienceUshu ? '<div class="entity-badge"><span class="entity-badge-label">🥋 Стаж в ушу</span><span class="entity-badge-value">' + esc(t.experienceUshu) + '</span></div>' : '') +
        (t.experienceCoach ? '<div class="entity-badge"><span class="entity-badge-label">🏆 Тренерский стаж</span><span class="entity-badge-value">' + esc(t.experienceCoach) + '</span></div>' : '') +
        '</div>';
    }
    var education = t.education
      ? '<h2 class="entity-subtitle">🎓 Образование</h2><div class="entity-text">' + md(t.education) + '</div>'
      : '';
    var motto = t.motto
      ? '<blockquote class="entity-quote">💬 ' + esc(t.motto) +
        '<cite>— ' + esc(t.name) + '</cite></blockquote>'
      : '';
    var slots = trainerSlots(t, programs);
    // S61: weekBoard() сам возвращает .week-board-wrap > .week-board —
    // оборачивать в grid-классы НЕЛЬЗЯ (сетка-в-сетке сжимала доску в 1/7 ширины)
    var mySchedule = slots.length
      ? '<h2 class="entity-subtitle">📅 Мои тренировки</h2>' +
        (window.ScheduleUI
          ? '<div class="trainer-week-board">' + window.ScheduleUI.weekBoard(slots) + '</div>'
          : slotsTable(slots, true))
      : '';

    return (t.image
        ? '<img class="entity-photo lightbox-zoom" src="' + t.image + '" alt="' + esc(t.name) + '">'
        : '<img class="entity-photo entity-cover-logo" src="logo.png" alt="Шифу Панда">') +
      '<h1 class="entity-title">' + esc(t.name) + '</h1>' +
      (!t.experienceUshu && t.experience ? '<p class="entity-meta">' + esc(t.experience) + '</p>' : '') +
      (t.specialization ? '<p class="entity-spec">🎯 ' + esc(t.specialization) + '</p>' : '') +
      badges +
      education +
      motto +
      '<div class="entity-text">' + md(cleanTrainerDesc(t.description, t)) + '</div>' +
      mySchedule +
      albumHtml(t.photoAlbum, t.name) +
      '<div class="entity-actions">' +
      '<button class="program-btn program-btn-primary" onclick="openCallModal(\'Заказать звонок: ' + esc(t.name) + '\')"><i class="icon-call"></i> Заказать звонок</button>' +
      '</div>';
  }

  var TYPES = {
    program: {
      list: 'programs',
      back: 'programs.html',
      backLabel: 'Все программы',
      pageTitle: 'Программы',
      render: programBody
    },
    trainer: {
      list: 'trainers',
      back: 'trainers.html',
      backLabel: 'Наш коллектив',
      pageTitle: 'Наши тренеры',
      render: trainerBody
    }
  };

  function init() {
    var type = document.body.getAttribute('data-entity');
    var conf = TYPES[type];
    var mount = document.getElementById('entity');
    if (!conf || !mount) return;

    var id = Number(new URLSearchParams(location.search).get('id'));
    var items = (window.SITE_DATA || {})[conf.list] || [];
    var item = items.filter(function (x) { return Number(x.id) === id; })[0];

    if (!item) {
      mount.innerHTML = notFound(conf.back, conf.backLabel);
      document.title = 'Не найдено — ' + conf.pageTitle;
      return;
    }

    document.title = item.name + ' — ' + conf.pageTitle;
    var meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute('content', (window.MD ? window.MD.plainText(item.description) : item.name).slice(0, 160));
    }
    // Странице тренера нужны программы (блок «Мои тренировки»)
    mount.innerHTML = conf.render(item, (window.SITE_DATA || {}).programs || []);
    // S62: повесить обработчики карусели фотоальбома
    if (window.Carousel && window.Carousel.initAll) window.Carousel.initAll(mount);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
