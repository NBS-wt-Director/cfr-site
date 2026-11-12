/**
 * events.js — S166 «Мероприятия».
 *
 * Один модуль на две страницы:
 *   events.html — список: планируемые плиткой, прошедшие слайдером (SliderCore);
 *   event.html?id=... — страница мероприятия (как entity у программ/тренеров).
 *
 * Статус считается на клиенте по dateEnd: если окончание прошло — мероприятие
 * «прошедшее», у него кнопка «Запросить запись и/или фото» вместо «Записаться».
 * Данные (window.SITE_DATA.events) не зависят от свежести сборки: просрочка
 * события видна сразу, даже если статика собиралась раньше.
 */
(function () {
  'use strict';

  var EVENT_TYPES = {
    'семинар': '🎓 Семинар',
    'тестирование': '📋 Тестирование',
    'праздник': '🎉 Праздник',
    'беседа': '💬 Беседа',
    'открытое_мероприятие': '🔓 Открытое мероприятие',
    'выездной_семинар': '🚌 Выездной семинар',
  };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function events() {
    var list = (window.SITE_DATA || {}).events || [];
    return list.filter(function (e) { return e && e.name; });
  }

  function isPast(e) {
    var end = parseDate(e.dateEnd) || parseDate(e.dateStart);
    if (!end) return false;
    return end.getTime() < Date.now();
  }

  function parseDate(s) {
    if (!s) return null;
    var d = new Date(String(s));
    return isNaN(d.getTime()) ? null : d;
  }

  function typeLabel(t) {
    return EVENT_TYPES[t] || (t ? esc(t) : '');
  }

  // «6 декабря 2026, 11:00 – 14:00» / для прошедшего периода — до конца
  var MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

  function fmtDateTime(s) {
    var d = parseDate(s);
    if (!d) return '';
    var hh = d.getHours(), mm = d.getMinutes();
    return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear() +
      (hh || mm ? ', ' + (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm : '');
  }

  function periodLabel(e) {
    var a = parseDate(e.dateStart), b = parseDate(e.dateEnd);
    if (!a) return '';
    if (!b || a.toDateString() === b.toDateString()) {
      return '📅 ' + fmtDateTime(e.dateStart) +
        (b ? ' – ' + (b.getHours() < 10 ? '0' : '') + b.getHours() + ':' +
          (b.getMinutes() < 10 ? '0' : '') + b.getMinutes() : '');
    }
    return '📅 ' + fmtDateTime(e.dateStart) + ' – ' + fmtDateTime(e.dateEnd);
  }

  function md(src) {
    return window.MD ? window.MD.render(src) : '<p>' + esc(src || '').replace(/\n/g, '<br>') + '</p>';
  }

  function albumSliderOpts(id, cssClass) {
    var gs = (window.SITE_DATA || {}).sliderSettings || {};
    return {
      id: id || 'events',
      cssClass: cssClass || 'slider--embed',
      autoplay: gs.autoplay !== false,
      showArrows: gs.showArrows !== false,
      showDots: gs.showDots !== false,
      interval: Number(gs.albumInterval) > 0 ? Number(gs.albumInterval) : 6,
      showCaption: true
    };
  }

  /* ── Кнопка действия: у планируемых — «Записаться», у прошедших — запрос ── */
  function actionButton(e) {
    if (isPast(e)) {
      return '<button type="button" class="btn-event btn-event-request" ' +
        'onclick="openCallModal(\'Запрос записи и/или фото мероприятия: ' +
        escAttrJs(e.name) + '\')">🎬 Запросить запись и/или фото</button>';
    }
    return '<button type="button" class="btn-event btn-event-signup" ' +
      'onclick="openCallModal(\'Запись на мероприятие: ' +
      escAttrJs(e.name) + '\')">Записаться</button>';
  }

  function escAttrJs(s) {
    return String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
  }

  /* ============================ ПЛИТКА мероприятия ============================ */
  function eventTile(e) {
    var href = 'event.html?id=' + encodeURIComponent(e.id);
    var past = isPast(e);
    var photos = Array.isArray(e.photoAlbum) ? e.photoAlbum.map(function (a) { return a.image; }) : [];
    var photoBlock = e.image
      ? '<div class="tile-photo"' + (photos.length > 1 ? ' data-photos="' + esc(photos.join('|')) + '"' : '') + '>' +
        '<a href="' + esc(href) + '"><img src="' + esc(e.image) + '" alt="' + esc(e.name) + '"' +
        (past ? ' loading="lazy"' : '') + '></a></div>'
      : '<div class="tile-photo tile-photo-empty"><a href="' + esc(href) + '">🎪</a></div>';

    return '<div class="tile tile-event' + (past ? ' tile-event-past' : '') + '" id="event-' + esc(String(e.id)) + '">' +
      photoBlock +
      '<div class="tile-title tile-title-2"><a href="' + esc(href) + '">' + esc(e.name) + '</a></div>' +
      '<div class="event-tile-meta">' +
      (e.type ? '<span class="event-type-chip">' + typeLabel(e.type) + '</span>' : '') +
      '<span class="event-date-chip">' + esc(periodLabel(e)) + '</span>' +
      '</div>' +
      (e.shortDescription ? '<p class="event-tile-short">' + esc(e.shortDescription) + '</p>' : '') +
      '<div class="tile-actions">' +
      '<a class="tile-btn tile-btn-more" href="' + esc(href) + '">Подробнее</a>' +
      actionButton(e) +
      '</div>' +
      '</div>';
  }

  /* ============================ СТРАНИЦА СПИСКА ============================ */
  function renderListPage() {
    var box = document.getElementById('events-list-container');
    if (!box) return;
    var list = events();

    if (!list.length) {
      box.innerHTML = '<div class="events-empty">' +
        '<p>Мероприятия пока не загружены.</p>' +
        '<p class="meta">Загляните позже или <a href="index.html#contacts">напишите нам</a> — ' +
        'мы проводим семинары, тестирования и праздники в течение всего года.</p>' +
        '</div>';
      return;
    }

    var planned = list.filter(function (e) { return !isPast(e); })
      .sort(function (a, b) { return String(a.dateStart).localeCompare(String(b.dateStart)); });
    var past = list.filter(isPast)
      .sort(function (a, b) { return String(b.dateStart).localeCompare(String(a.dateStart)); });

    var html = '';

    if (planned.length) {
      html += '<h2 class="section-subtitle events-h2">🗓 Планируемые мероприятия</h2>' +
        '<div class="tiles-grid events-tiles">' +
        planned.map(eventTile).join('') +
        '</div>';
    }

    if (past.length) {
      html += '<h2 class="section-subtitle events-h2">✅ Прошедшие мероприятия</h2>';
      if (window.SliderCore && window.SliderCore.render) {
        var items = past.map(function (e) {
          return {
            image: e.image || 'uploads/logo.png',
            title: e.name + ' · ' + fmtDateTime(e.dateStart),
            link: 'event.html?id=' + encodeURIComponent(e.id),
            linkTarget: '_self'
          };
        });
        html += '<div class="events-past-slider">' +
          window.SliderCore.render(items, albumSliderOpts('events-past', 'slider--album')) + '</div>';
        // Подписи кликабельны через link слайда (SliderCore рендерит <a class="slider-text-link">)
      } else {
        // SliderCore не загружен — прошедшие тоже плиткой
        html += '<div class="tiles-grid events-tiles">' + past.map(eventTile).join('') + '</div>';
      }
    }

    if (!planned.length) {
      html += '<div class="events-empty"><p>Планируемые мероприятия пока не загружены.</p></div>';
    }

    box.innerHTML = html;

    // Слайдер прошедших — общая инициализация
    if (window.SliderCore && window.SliderCore.initAll) {
      var opts = albumSliderOpts();
      window.SliderCore.initAll(box, opts);
    }
    // Свайп фото в плитках (если у прошедших включён fallback-плиткой)
    if (window.Tiles && window.Tiles.initAll) window.Tiles.initAll(box);
  }

  /* ============================ СТРАНИЦА МЕРОПРИЯТИЯ ============================ */
  function reviewsBlock(reviews) {
    if (!reviews || !reviews.length) return '';
    var items = reviews.map(function (r) {
      return '<blockquote class="entity-review">' +
        (r.text ? md(r.text) : '') +
        '<footer class="entity-review-foot">' + esc(r.name || 'Гость') + '</footer>' +
        '</blockquote>';
    }).join('');
    return '<h2 class="entity-subtitle">💬 Отзывы</h2><div class="entity-reviews">' + items + '</div>';
  }

  /* ================================================================
     S166: видеоплеер мероприятия
     — ссылка YouTube/VK/Rutube → iframe embed
     — загруженный файл (uploads/*.mp4) → <video controls>
     — плеер в цветах сайта (рамка accent, скруглённый)
  */
  function videoEmbed(v) {
    var url = String(v.url || '').trim();
    var title = v.title ? String(v.title) : '';
    if (!url) return '';

    // 1) Встроенный embed (YouTube / VK / Rutube)
    var embed = externalEmbedUrl(url);
    if (embed) {
      return '<div class="event-video">' +
        '<div class="event-video-frame">' +
        '<iframe src="' + esc(embed) + '" title="' + esc(title || 'Видео') + '" ' +
        'loading="lazy" allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture;fullscreen" ' +
        'allowfullscreen referrerpolicy="no-referrer-when-downgrade"></iframe>' +
        '</div>' +
        (title ? '<p class="event-video-cap">' + esc(title) + '</p>' : '') +
        '</div>';
    }

    // 2) Прямой файл видео (uploads/*.mp4 или http(s) *.mp4/.webm/.ogg)
    if (/^uploads\//i.test(url) || /\.(mp4|webm|ogg|ogv|mov|m4v)(\?|#|$)/i.test(url)) {
      return '<div class="event-video">' +
        '<div class="event-video-frame event-video-frame--native">' +
        '<video controls playsinline preload="metadata" src="' + esc(url) + '">' +
        'Ваш браузер не поддерживает видео.</video>' +
        '</div>' +
        (title ? '<p class="event-video-cap">' + esc(title) + '</p>' : '') +
        '</div>';
    }

    // 3) Фолбэк: ссылка — но оформлена как карточка
    return '<div class="event-video">' +
      '<div class="event-video-frame event-video-frame--link">' +
      '<a href="' + esc(url) + '" target="_blank" rel="noopener nofollow">' +
      '<span class="event-video-play-icon">▶</span> ' + esc(title || 'Открыть видео') +
      '</a></div></div>';
  }

  // URL → embed URL. Возвращает null если не удалось конвертировать.
  function externalEmbedUrl(raw) {
    var url = String(raw || '').trim();
    if (!url) return null;
    var m;

    // YouTube: watch?v=, youtu.be/, embed/
    if ((m = url.match(/(?:youtube\.com\/watch\?.*v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{10,})/i))) {
      return 'https://www.youtube-nocookie.com/embed/' + m[1] + '?rel=0';
    }
    // VK: video-123456789_12345678
    if ((m = url.match(/vk\.com\/video(-?\d+)_(\d+)/i))) {
      return 'https://vk.com/video_ext.php?oid=' + m[1] + '&id=' + m[2] + '&hd=2';
    }
    // Rutube: rutube.ru/video/ID/
    if ((m = url.match(/rutube\.ru\/video\/([a-f0-9]+)(?:\/|$)/i))) {
      return 'https://rutube.ru/play/embed/' + m[1];
    }
    return null;
  }

  function videosBlock(videos) {
    if (!videos || !videos.length) return '';
    var html = videos.map(function (v) { return videoEmbed(v); }).join('');
    return '<h2 class="entity-subtitle">🎬 Видео</h2><div class="event-videos">' + html + '</div>';
  }

  function galleryBlock(e) {
    // S167: галерея = слайдер с полными полями слайда (как главный слайдер)
    var album = (Array.isArray(e.photoAlbum) ? e.photoAlbum : [])
      .filter(function (a) { return a && (typeof a === 'string' ? a : a.image) && !a.hidden; })
      .map(function (a, i) {
        var image = typeof a === 'string' ? a : a.image;
        return {
          image: image,
          title: a.title || a.caption || (e.name + ' — фото ' + (i + 1)),
          description: a.description || '',
          link: a.link || '',
          linkTarget: a.linkTarget || '_self',
          interval: Number(a.interval) > 0 ? Number(a.interval) : 0,
          position: a.position || '',
          textColor: a.textColor || '',
          textSize: Number(a.textSize) > 0 ? Number(a.textSize) : 0,
          textMargin: a.textMargin || null,
          overlay: a.overlay || null
        };
      });
    if (!album.length) return '';
    if (window.SliderCore && window.SliderCore.render) {
      return '<h2 class="entity-subtitle">📸 Фотогалерея</h2>' +
        '<div class="entity-album">' + window.SliderCore.render(album, albumSliderOpts('event-gallery')) + '</div>';
    }
    if (window.Carousel && window.Carousel.render) {
      return '<h2 class="entity-subtitle">📸 Фотогалерея</h2>' +
        '<div class="entity-album">' + window.Carousel.render(album, e.name) + '</div>';
    }
    return '';
  }

  function renderEntityPage() {
    var mount = document.getElementById('entity');
    if (!mount) return;
    var id = new URLSearchParams(location.search).get('id');
    var list = events();
    var e = list.filter(function (x) { return String(x.id) === String(id); })[0];

    if (!e) {
      mount.innerHTML = '<h1 class="entity-title">Мероприятие не найдено</h1>' +
        '<p class="meta">Возможно, оно уже не актуально. ' +
        '<a href="events.html">Все мероприятия →</a></p>';
      return;
    }

    var past = isPast(e);
    var cover = e.image
      ? '<div class="entity-cover"><img src="' + esc(e.image) + '" alt="' + esc(e.name) + '"></div>'
      : '';
    var crumbs = [{ href: 'index.html', label: 'Главная' },
      { href: 'events.html', label: 'Мероприятия' },
      { label: e.name }];
    if (window.Layout && window.Layout.renderCrumbs) window.Layout.renderCrumbs(mount, crumbs);

    var head =
      '<h1 class="entity-title">' + esc(e.name) + '</h1>' +
      '<div class="event-page-meta">' +
      (e.type ? '<span class="event-type-chip">' + typeLabel(e.type) + '</span>' : '') +
      '<span class="event-date-chip">' + esc(periodLabel(e)) + '</span>' +
      '<span class="event-status-chip ' + (past ? 'event-status-past' : 'event-status-planned') + '">' +
      (past ? 'Прошедшее' : 'Планируется') + '</span>' +
      '</div>' +
      (e.shortDescription ? '<p class="event-page-short">' + esc(e.shortDescription) + '</p>' : '');

    var notice = '';
    if (past) {
      notice = '<div class="event-past-notice">Мероприятие состоялось. ' +
        'Если хотите получить видеозапись или фотографии — нажмите кнопку ниже.</div>';
    }

    mount.innerHTML = cover + head + notice +
      '<div class="event-actions">' + actionButton(e) + '</div>' +
      (e.description ? '<div class="entity-description">' + md(e.description) + '</div>' : '') +
      galleryBlock(e) +
      reviewsBlock(e.reviews) +
      videosBlock(e.videos);

    if (window.Layout && window.Layout.renderCrossLinks) {
      window.Layout.renderCrossLinks(mount, 'news');
    }

    // Фотогалерея + lightbox по клику (тот же паттерн, что у программ/тренеров)
    if (window.SliderCore && window.SliderCore.initAll) {
      var opts = albumSliderOpts();
      opts.onClick = function (slide) {
        if (!window.openLightbox) return;
        var img = slide.querySelector('img');
        window.openLightbox((img && img.getAttribute('src')) || '', img && img.getAttribute('alt'));
      };
      window.SliderCore.initAll(mount, opts);
    }
    if (window.Carousel && window.Carousel.initAll && !window.SliderCore) window.Carousel.initAll(mount);

    // SEO: заголовок вкладки — название мероприятия
    document.title = e.name + ' — ' + ((window.SITE_BRAND || {}).title1 || 'Шифу Панда');
  }

  function init() {
    var page = document.body.getAttribute('data-doc-title') || '';
    if (document.getElementById('events-list-container')) renderListPage();
    else if (document.body.getAttribute('data-entity') === 'event') renderEntityPage();
    else if (page) { /* страница без контейнеров — ничего не делаем */ }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
