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
  // S130 п.3: справочник красивых имён разделов больше не дублируется здесь —
  // он в общем модуле js/panels.js (Panels.categoryName / Panels.directionName),
  // которым пользуются главная и programs.html. Дубль в entity.js давал
  // расхождение имён и не содержал «ИНДИВИДУАЛЬНЫЕ ЗАНЯТИЯ».

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // S18: нестрогое сравнение slug — регистр + ё/е (для вручную набранных ссылок)
  function slugFold(s) {
    return String(s).toLowerCase().replace(/ё/g, 'е');
  }

  // S126: название сайта берётся из «Главных данных» (siteSettings.title1),
  // а не захардкожено в разметке фолбэка логотипа.
  function brandAlt() {
    var b = window.SITE_BRAND || {};
    return esc(b.title1 || 'Логотип');
  }

  // Суффикс заголовка вкладки — второе название из «Главных данных»
  function brandTitle(fallback) {
    var b = window.SITE_BRAND || {};
    return b.title2 || b.title1 || fallback || 'ЦФР';
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

  // S132 п.4: расписание — тот же компонент, что на главной/у тренера/направления,
  // с переключателем «Доска/Таблица» (общий helper ScheduleUI.boardOrTable).
  // Если ScheduleUI не загружен — остаётся прежняя компактная таблица.
  function scheduleView(slots, withProgram, storeKey, selfProgram) {
    if (!window.ScheduleUI) return '';
    if (window.ScheduleUI.boardOrTable) {
      return window.ScheduleUI.boardOrTable(slots, withProgram, storeKey, selfProgram);
    }
    return window.ScheduleUI.weekBoard(slots, selfProgram);
  }

  // Блок «Ведёт» на странице программы.
  // S132 п.2: ПЛИТКИ тренеров (единое решение S90 о плитках). Текстовые чипсы
  // остаются fallback, если tiles.js не загружен.
  function trainersBlock(refs) {
    if (!refs || !refs.length) return '';
    var T = window.Tiles;
    if (T) {
      var all = (window.SITE_DATA || {}).trainers || [];
      var cards = refs.map(function (tr) {
        var full = tr.id != null
          ? all.filter(function (t) { return Number(t.id) === Number(tr.id); })[0]
          : null;
        if (full) return T.trainer(full);
        // тренер без записи в базе (id: null) — плитка невозможна, остаётся подписью
        return '<span class="entity-trainer-card entity-trainer-card-plain">🧑‍🏫 ' + esc(tr.name) + '</span>';
      }).join('');
      // S132 п.2: плитки тренеров. Класс .entity-trainers сохранён —
      // это контракт блока «Ведёт» (тесты S22, ссылки на тренеров).
      return '<h2 class="entity-subtitle">👨‍🏫 Ведёт</h2>' + T.grid(cards, '', 'entity-trainers');
    }
    var chips = refs.map(function (tr) {
      if (tr.id == null) {
        return '<span class="entity-trainer-card entity-trainer-card-plain">🧑‍🏫 ' + esc(tr.name) + '</span>';
      }
      // S18: ищем slug тренера в navTrainers или полных trainers
      var all = (window.SITE_DATA || {}).navTrainers || (window.SITE_DATA || {}).trainers || [];
      var found = all.filter(function (t) { return Number(t.id) === Number(tr.id); })[0];
      return '<a class="entity-trainer-card" href="trainer.html?id=' + ((found && found.slug) || tr.id) + '">🧑‍🏫 ' + esc(tr.name) + '</a>';
    }).join('');
    return '<h2 class="entity-subtitle">👨‍🏫 Ведёт</h2>' +
      '<div class="entity-trainers">' + chips + '</div>';
  }

  // S132 п.3: мета-строка «возраст · уровень · место · длительность».
  // Все части опциональны: пусто → не выводится (дефолт = прежнее поведение).
  function programMeta(p) {
    var bits = [];
    if (p.ageFrom || p.ageTo) {
      var from = p.ageFrom || p.ageTo, to = p.ageTo;
      bits.push('👤 ' + (to && to !== from ? from + '–' + to + ' лет' : from + '+ лет'));
    }
    if (p.level) bits.push('🎯 ' + esc(p.level));
    var places = (p.scheduleStructured || []).map(function (s) { return s.place; })
      .filter(Boolean).filter(function (v, i, a) { return a.indexOf(v) === i; });
    if (places.length) bits.push('📍 ' + esc(places.join(', ')));
    if (p.duration) bits.push('⏱ ' + esc(p.duration));
    return bits.length
      ? '<p class="entity-meta-line">' + bits.join(' <span class="entity-meta-sep">·</span> ') + '</p>'
      : '';
  }

  // S132 п.5: «Отзывы» — данные из базы, которые раньше не экспортировались
  // и не выводились. Структуру записи не выдумываем: берём известные варианты полей.
  function reviewsBlock(reviews) {
    if (!reviews || !reviews.length) return '';
    var items = reviews.map(function (r) {
      if (typeof r === 'string') return '<blockquote class="entity-review">' + md(r) + '</blockquote>';
      var who = r.author || r.name || r.who || '';
      var when = r.date || '';
      var head = (who || when)
        ? '<footer class="entity-review-foot">' + esc(who) +
          (when ? '<span class="entity-review-date"> · ' + esc(when) + '</span>' : '') + '</footer>'
        : '';
      var title = r.title ? '<strong class="entity-review-title">' + esc(r.title) + '</strong>' : '';
      var body = r.text || r.review || r.content || '';
      return '<blockquote class="entity-review">' + title + md(body) + head + '</blockquote>';
    }).join('');
    return '<h2 class="entity-subtitle">💬 Отзывы</h2><div class="entity-reviews">' + items + '</div>';
  }

  // S132 п.5: «Программа тренировок» — день/время/параметры.
  // params выводится «как есть», без домысливания структуры.
  function workoutsBlock(workouts) {
    if (!workouts || !workouts.length) return '';
    function paramText(v) {
      if (v == null) return '';
      if (typeof v === 'string' || typeof v === 'number') return String(v);
      if (Array.isArray(v)) return v.map(paramText).filter(Boolean).join(', ');
      return Object.keys(v).map(function (k) { return k + ': ' + paramText(v[k]); }).join(', ');
    }
    var rows = workouts.map(function (w) {
      var params = (w.params || []).map(paramText).filter(Boolean);
      return '<tr><td>' + esc(w.day || '—') + '</td><td>' + esc(w.time || '—') + '</td>' +
        '<td>' + esc(params.join(' · ')) + '</td></tr>';
    }).join('');
    // Свой класс, а НЕ .schedule-table: под тем же селектором тесты ищут
    // таблицу расписания, и вторая таблица сбивала бы их счётчик строк.
    return '<h2 class="entity-subtitle">🏋️ Программа тренировок</h2>' +
      '<div class="schedule-table-wrap"><table class="entity-workouts-table">' +
      '<thead><tr><th>День</th><th>Время</th><th>Параметры</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table></div>';
  }

  // S132 п.5: trainings — список занятий (в базе пока пуст у всех).
  function trainingsBlock(trainings) {
    if (!trainings || !trainings.length) return '';
    var items = trainings.map(function (t) {
      return '<li>' + (typeof t === 'string' ? esc(t) : esc(t.name || t.title || JSON.stringify(t))) + '</li>';
    }).join('');
    return '<h2 class="entity-subtitle">📌 Занятия</h2><ul class="entity-trainings">' + items + '</ul>';
  }

  // Блок «Расписание» на странице программы (S132 п.4 — доска с переключателем)
  function scheduleBlock(slots, storeKey, selfProgram) {
    if (!slots || !slots.length) return '';
    // Обогащаем слоты hall/mode/trainer/place (trainer уже в exported данных)
    var enriched = slots.map(function (s) {
      return { day: s.day, time: s.time, hall: s.hall, mode: s.mode, place: s.place, trainer: s.trainer || '' };
    });
    return '<h2 class="entity-subtitle">📅 Расписание</h2>' + scheduleView(enriched, false, storeKey, selfProgram);
  }

  /* ============================================
     S115: блок «Стоимость» на странице программы/тренера.
     Показывает позиции прайса, привязанные к сущности (programId / trainerId).
     Скрытых CRM-полей здесь быть не может — они не экспортируются на сайт.
     S131: рендер вынесен в общий модуль js/prices-ui.js (тот же блок
     использует страница направления).
     S132 п.7: если у программы своих позиций нет — показываем цену её
     направления (поле direction.priceGroup), а не оставляем блок пустым.
     ============================================ */
  function pricesBlock(entityId, dirForFallback) {
    if (!window.PricesUI) return '';
    var own = window.PricesUI.block(window.PricesUI.byEntity(entityId));
    if (own) return own;
    if (dirForFallback && dirForFallback.priceGroup) {
      var group = String(dirForFallback.priceGroup).trim();
      return window.PricesUI.block(
        function (i) { return i.group && String(i.group).trim() === group; },
        { title: '💰 Стоимость направления' }
      );
    }
    return '';
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
          // S128 п.10: place раньше терялся при обогащении слотов,
          // поэтому «где проходят занятия» не показывал никто
          place: s.place,
          program: p.name, programId: p.id,
          // S151: slug + флаг альбома — нужны меню чипа («Подробнее»/«Посмотреть»)
          programSlug: p.slug,
          programHasAlbum: !!(p.photoAlbum && p.photoAlbum.length),
          trainer: s.trainer || ''
        });
      });
    });
    return slots;
  }

  // S128 п.6: программы, которые ведёт тренер (блок «Ведёт» плитками программ)
  function trainerPrograms(t, programs) {
    return (programs || []).filter(function (p) {
      return (p.trainers || []).some(function (tr) { return sameTrainer(tr, t); });
    });
  }

  // Ссылка на программу по началу названия — для строки
  // «Ведёт: персональные тренировки · сплит · массаж» (S128 п.6).
  // Новых сущностей не создаём: ищем существующие по имени.
  function programLinkByName(programs, name) {
    var found = (programs || []).filter(function (p) {
      return String(p.name || '').trim().toLowerCase().indexOf(String(name).toLowerCase()) === 0;
    })[0];
    return found
      ? '<a href="program.html?id=' + (found.slug || found.id) + '">' + esc(found.name) + '</a>'
      : '';
  }

  /* ============================================
     НАПРАВЛЕНИЕ СущНОСТИ (S132 п.1)
     directionId экспортируется с S23, но не читался ни одним JS:
     не было ни крошек «… → <Направление>», ни «других тренировок направления».
     ============================================ */
  function directionOf(p) {
    if (!p || !p.directionId) return null;
    var d = window.SITE_DATA || {};
    var dirs = d.navDirections || d.directions || [];
    return dirs.filter(function (x) { return String(x.id) === String(p.directionId); })[0] || null;
  }

  // «Другие тренировки направления» — плитки, до 4, без текущей (S132 п.1)
  function relatedDirectionPrograms(p, dir) {
    if (!dir || !window.Tiles) return '';
    var ids = {};
    (dir.programs || []).forEach(function (dp) { ids[String(dp.id)] = true; });
    var others = ((window.SITE_DATA || {}).programs || []).filter(function (x) {
      return String(x.id) !== String(p.id) && ids[String(x.id)];
    }).slice(0, 4);
    if (!others.length) return '';
    var T = window.Tiles;
    var name = window.Panels ? Panels.directionName(dir) : dir.name;
    return '<h2 class="entity-subtitle">Другие тренировки направления «' + esc(name) + '»</h2>' +
      T.grid(others.map(function (x) { return T.program(x); }).join(''));
  }

  // S128 п.8: related «Другие тренеры» — до 4, без текущего
  function relatedTrainers(t) {
    if (!window.Tiles) return '';
    var all = (window.SITE_DATA || {}).trainers || [];
    var others = all.filter(function (x) { return String(x.id) !== String(t.id); }).slice(0, 4);
    if (!others.length) return '';
    var T = window.Tiles;
    return '<h2 class="entity-subtitle">Другие в разделе «' + esc(secName('trainers', 'Коллектив')) + '»</h2>' +
      T.grid(others.map(function (x) { return T.trainer(x); }).join(''));
  }

  /* ============================================
     CTA (S132 п.8 / S128 п.8)
     «Записаться» был единственным путём; добавляем телефон центра,
     личный кабинет, пробное занятие (если задано) и якорь на цену.
     ============================================ */
  function ctaButtons(reason, opts) {
    opts = opts || {};
    var d = window.SITE_DATA || {};
    var c = d.contacts || {};
    var out = [];
    out.push('<button class="program-btn program-btn-primary" onclick="openCallModal(\'' +
      reason + '\')"><i class="icon-call"></i> ' + esc(opts.mainLabel || 'Записаться') + '</button>');
    if (c.phone) {
      out.push('<a class="program-btn program-btn-secondary" href="tel:' +
        String(c.phone).replace(/\D/g, '') + '">' + esc(c.phone) + '</a>');
    }
    if (opts.withLk) {
      out.push('<a class="program-btn program-btn-secondary" href="lk.html">🗓 Личный кабинет</a>');
    }
    if (opts.trial) {
      var label = (typeof opts.trial === 'string' && opts.trial.trim()) ? opts.trial : 'Пробное занятие';
      out.push('<button class="program-btn program-btn-secondary" onclick="openCallModal(\'' +
        reason + ' — пробное занятие\')">✨ ' + esc(label) + '</button>');
    }
    return '<div class="entity-actions entity-cta">' + out.join('') + '</div>';
  }

  // S62: «Фотоальбом» = горизонтальная карусель необрезанных фото
  function albumHtml(album, altBase) {
    if (!album || !album.length) return '';
    // Если модуль карусели загружен — карусель (фото целиком, без crop)
    if (window.Carousel && window.Carousel.render) {
      return '<h2 class="entity-subtitle">Фотоальбом</h2>' +
        '<div id="album" class="entity-album">' + window.Carousel.render(album, altBase) + '</div>';
    }
    // Фолбэк: старая сетка (если carousel.js не подключён)
    var items = album.map(function (a) {
      return '<div class="album-item lightbox-zoom" data-full="' + a.image + '">' +
        '<img src="' + a.image + '" alt="' + esc(a.caption || altBase) + '" loading="lazy">' +
        '</div>';
    }).join('');
    return '<h2 class="entity-subtitle">Фотоальбом</h2>' +
      '<div id="album" class="album-grid">' + items + '</div>';
  }

  function notFound(backHref, backLabel) {
    return '<div class="entity-not-found">' +
      '<h1 class="entity-title">Не найдено</h1>' +
      '<p class="entity-meta">Такой записи нет или она скрыта с сайта.</p>' +
      '<div class="entity-actions"><a class="program-btn program-btn-primary" href="' + backHref + '">← ' + backLabel + '</a></div>' +
      '</div>';
  }

  /* ============================================
     СТРАНИЦА ПРОГРАММЫ (S132)
     ============================================ */
  function programBody(p) {
    var dir = directionOf(p);
    // S130 п.3: имя раздела — общий справочник js/panels.js
    // (publicTask направления, иначе name, иначе справочник category)
    var catLabel = '';
    if (window.Panels) {
      catLabel = dir ? Panels.directionName(dir) : Panels.categoryName(p.category);
    } else {
      catLabel = p.category || '';
    }

    var dirName = dir ? (window.Panels ? Panels.directionName(dir) : dir.name) : '';
    var dirLink = dir
      ? '<p class="entity-direction"><a href="directions.html?id=' + encodeURIComponent(dir.id) +
        '">📁 ' + esc(dirName) + ' →</a></p>'
      : '';

    return (p.image
        // S132 п.6: обложка страницы — тот же кадр 2:3, что в плитке (стиль .entity-cover)
        ? '<img class="entity-cover lightbox-zoom" src="' + p.image + '" alt="' + esc(p.name) + '">'
        : '<img class="entity-cover entity-cover-logo" src="logo.png" alt="' + brandAlt() + '">') +
      '<h1 class="entity-title">' + esc(p.name) + '</h1>' +
      (catLabel ? '<p class="entity-meta">📁 ' + esc(catLabel) + '</p>' : '') +
      programMeta(p) +
      dirLink +
      '<div class="entity-text">' + md(p.description) + '</div>' +
      trainersBlock(p.trainers) +
      // S151: selfProgram — чтобы чипы расписания на странице программы открывали
      // меню («Подробнее» / «Посмотреть» / «Записаться»); без него слоты теряют
      // programId/programSlug и чип остаётся пустой ссылкой.
      scheduleBlock(p.scheduleStructured, 'program-view-' + p.id, {
        id: p.id, slug: p.slug, hasAlbum: !!(p.photoAlbum && p.photoAlbum.length)
      }) +
      workoutsBlock(p.workouts) +
      trainingsBlock(p.trainings) +
      reviewsBlock(p.reviews) +
      pricesBlock(p.id, dir) +
      albumHtml(p.photoAlbum, p.name) +
      ctaButtons('Записаться на программу «' + esc(p.name) + '»', {
        withLk: true,
        trial: p.trialLesson
      }) +
      relatedDirectionPrograms(p, dir);
  }

  /* ============================================
     СТРАНИЦА ТРЕНЕРА (S128 п.6)
     Порядок блоков приведён к странице программы:
     фото → ФИО → специализация → регалии → девиз → bio → «Ведёт» плитками
     программ → «Мои тренировки» → стоимость → альбом → CTA → related.
     ============================================ */
  function trainerBody(t, programs) {
    // Бейджи стажа: новые структурированные поля или старый experience.
    // S146: подписи зависят от категории — у преподавателей ИЗО другие формулировки.
    var badges = '';
    if (t.experienceUshu || t.experienceCoach) {
      var iso = /изо/i.test(String(t.category || ''));
      var ushuLabel = iso ? '🎨 Занимается ИЗО' : '🥋 Стаж в ушу';
      var coachLabel = iso ? '📚 Преподавательский стаж' : '🏆 Тренерский стаж';
      badges = '<div class="entity-info-grid">' +
        (t.experienceUshu ? '<div class="entity-badge"><span class="entity-badge-label">' + ushuLabel + '</span><span class="entity-badge-value">' + esc(t.experienceUshu) + '</span></div>' : '') +
        (t.experienceCoach ? '<div class="entity-badge"><span class="entity-badge-label">' + coachLabel + '</span><span class="entity-badge-value">' + esc(t.experienceCoach) + '</span></div>' : '') +
        '</div>';
    }
    var education = t.education
      ? '<h2 class="entity-subtitle">🎓 Образование</h2><div class="entity-text">' + md(t.education) + '</div>'
      : '';
    var motto = t.motto
      ? '<blockquote class="entity-quote">💬 ' + esc(t.motto) +
        '<cite>— ' + esc(t.name) + '</cite></blockquote>'
      : '';

    var specLine = t.specialization ? '<p class="entity-spec">🎯 ' + esc(t.specialization) + '</p>' : '';

    // S128 п.3/п.6: флаги personal/split/massage и category экспортировались,
    // но не читались ни одним JS — теперь строка «Ведёт: …» со ссылками на сущности
    var leads = [];
    if (t.personal) leads.push(programLinkByName(programs, 'Персональные тренировки'));
    if (t.split) leads.push(programLinkByName(programs, 'Сплит'));
    if (t.massage) leads.push(programLinkByName(programs, 'Массаж'));
    leads = leads.filter(Boolean);
    var leadsLine = leads.length ? '<p class="entity-leads">Ведёт: ' + leads.join(' · ') + '</p>' : '';
    var catLine = t.category ? '<p class="entity-meta">📁 ' + esc(t.category) + '</p>' : '';

    // S128 п.6: «Ведёт» — плитками программ этого тренера
    var ledPrograms = trainerPrograms(t, programs);
    var ledBlock = (ledPrograms.length && window.Tiles)
      ? '<h2 class="entity-subtitle">🥋 Ведёт тренировки</h2>' +
        window.Tiles.grid(ledPrograms.map(function (p) { return window.Tiles.program(p); }).join(''))
      : '';

    var slots = trainerSlots(t, programs);
    // S61: weekBoard() сам возвращает .week-board-wrap > .week-board —
    // оборачивать в grid-классы НЕЛЬЗЯ (сетка-в-сетке сжимала доску в 1/7 ширины)
    var mySchedule = slots.length
      ? '<h2 class="entity-subtitle">📅 Мои тренировки</h2>' +
        (window.ScheduleUI
          ? '<div class="trainer-week-board">' + scheduleView(slots, true, 'trainer-view-' + t.id) + '</div>'
          : slotsTable(slots, true))
      : '';

    // S137: заголовок — первой строкой по центру; обложка — float у левого края
    // контейнера (общий класс .entity-head-float, как на странице направления);
    // описание и мета-строки обтекают справа; всё, что ниже описания
    // (регалии, девиз, образование, плитки, расписание, цена, альбом, CTA) —
    // после обтекания (flow-root снимает float).
    return '<h1 class="entity-title">' + esc(t.name) + '</h1>' +
      '<div class="entity-head-float">' +
      (t.image
        // S128 п.7: кадр 2:3, как у плитки (стиль .entity-photo)
        ? '<img class="entity-photo entity-head-cover lightbox-zoom" src="' + t.image + '" alt="' + esc(t.name) + '">'
        : '<img class="entity-photo entity-head-cover entity-cover-logo" src="logo.png" alt="' + brandAlt() + '">') +
      (!t.experienceUshu && t.experience ? '<p class="entity-meta">' + esc(t.experience) + '</p>' : '') +
      catLine +
      specLine +
      leadsLine +
      '<div class="entity-text">' + md(cleanTrainerDesc(t.description, t)) + '</div>' +
      '</div>' +
      badges +
      motto +
      education +
      ledBlock +
      mySchedule +
      pricesBlock(t.id) +
      albumHtml(t.photoAlbum, t.name) +
      ctaButtons('Страница тренера «' + esc(t.name) + '»', {
        mainLabel: 'Записаться',
        withLk: true
      }) +
      relatedTrainers(t);
  }

  // S127 (Р1): имя раздела берётся из справочника settings.sectionNames
  function secName(id, fallback) {
    return (window.Layout && window.Layout.sectionName(id, fallback)) || fallback;
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
      // Единожды заведенное имя раздела: «Коллектив» (не «Наш коллектив»/«Наши тренера»)
      backLabel: secName('trainers', 'Коллектив'),
      pageTitle: secName('trainers', 'Коллектив'),
      render: trainerBody
    }
  };

  function init() {
    var type = document.body.getAttribute('data-entity');
    var conf = TYPES[type];
    var mount = document.getElementById('entity');
    if (!conf || !mount) return;

    var rawId = new URLSearchParams(location.search).get('id');
    var items = (window.SITE_DATA || {})[conf.list] || [];
    var item;

    // S18: slug — КИРИЛЛИЦЕЙ, «как записано» в имени (без транслитерации).
    // 1) числовой id → поиск по id (обратная совместимость внешних ссылок);
    // 2) строка → точное совпадение slug; при промахе — нестрогое
    //    (регистр + ё/е — для ссылок, набранных вручную);
    // 3) всё остальное (пусто, нет id, нет совпадения) → 404.
    if (rawId !== null) {
      if (/^\d+$/.test(rawId) && Number(rawId) > 0) {
        item = items.filter(function (x) { return Number(x.id) === Number(rawId); })[0];
      } else {
        item = items.filter(function (x) { return x.slug === rawId; })[0];
        if (!item) {
          var key = slugFold(rawId);
          item = items.filter(function (x) { return x.slug && slugFold(x.slug) === key; })[0];
        }
      }
    }

    if (!item) {
      // S141: единая страница 404 с редиректом
      location.replace('404.html?from=' + encodeURIComponent(conf.back + '?id=' + (rawId || '')) + '&id=' + encodeURIComponent(rawId || ''));
      return;
    }

    document.title = item.name + ' — ' + brandTitle(conf.pageTitle);
    var meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute('content', (window.MD ? window.MD.plainText(item.description) : item.name).slice(0, 160));
    }
    // Странице тренера нужны программы (блок «Мои тренировки»)
    mount.innerHTML = conf.render(item, (window.SITE_DATA || {}).programs || []);

    // S132 п.1: хлебные крошки через directionId
    // («Главная → Наши тренировки → <Направление> → <Программа>»)
    if (window.Layout) {
      var page = document.querySelector('.entity-page');
      if (page) {
        var crumbs = [{ href: 'index.html', label: 'Главная' }];
        if (type === 'program') {
          crumbs.push({ href: 'programs.html', label: secName('programs', 'Наши тренировки') });
          var dir = directionOf(item);
          if (dir) {
            crumbs.push({
              href: 'directions.html?id=' + encodeURIComponent(dir.id),
              label: window.Panels ? Panels.directionName(dir) : dir.name
            });
          }
        } else {
          crumbs.push({ href: 'trainers.html', label: secName('trainers', 'Коллектив') });
        }
        crumbs.push({ label: item.name });
        Layout.renderCrumbs(page, crumbs);
        // Единый блок перекрёстных ссылок внизу (S127 п.6)
        Layout.renderCrossLinks(page, type === 'trainer' ? 'trainers' : 'programs');
      }
    }

    // S62: повесить обработчики карусели фотоальбома
    if (window.Carousel && window.Carousel.initAll) window.Carousel.initAll(mount);
    // S132 п.4: переключатель «Доска / Таблица»
    if (window.ScheduleUI && window.ScheduleUI.initSwitches) window.ScheduleUI.initSwitches(mount);
    // S132 п.2 / S128 п.6: свайп фото в плитках (тренеры у программы, программы у тренера)
    if (window.Tiles && window.Tiles.initAll) window.Tiles.initAll(mount);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
