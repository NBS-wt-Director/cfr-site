/**
 * tiles.js — ЕДИНЫЕ плитки программ и тренеров (S90).
 *
 * Одна плитка на весь сайт: главная, programs.html, trainers.html,
 * страница направления. Различается только количество строк заголовка
 * (2 — тренер, 3 — программа) и наличие свайпа фото у тренера.
 *
 * Структура плитки:
 *   .tile > .tile-photo (2:3, вся ширина) > .tile-title > .tile-actions
 *
 * Кнопки — столбиком: «Подробнее», затем зелёная «Заказать звонок».
 * Отступ содержимого от границы плитки — 5px (см. style.css).
 */
(function () {
  'use strict';

  var FALLBACK_IMG = 'logo.png';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Все фото плитки без дублей: обложка + фотоальбом (для свайпа у тренеров)
  function photosOf(entity) {
    var list = [entity && entity.image ? entity.image : ''];
    var album = (entity && Array.isArray(entity.photoAlbum)) ? entity.photoAlbum : [];
    album.forEach(function (a) { if (a && a.image) list.push(a.image); });
    return list.filter(Boolean).filter(function (src, i) { return list.indexOf(src) === i; });
  }

  // Кадры 2:3 (ширина : высота) — сам размер задаёт CSS (aspect-ratio)
  function photoHtml(photos, href, alt) {
    var first = photos.length ? photos[0] : FALLBACK_IMG;
    var dots = '';
    if (photos.length > 1) {
      dots = '<span class="tile-photo-dots">' + photos.map(function (_, i) {
        return '<i class="tile-photo-dot' + (i === 0 ? ' active' : '') + '"></i>';
      }).join('') + '</span>';
    }
    return '<div class="tile-photo" data-photos="' + esc(photos.join('|')) + '">' +
      '<a href="' + esc(href) + '"><img src="' + esc(first) + '" alt="' + esc(alt) + '" loading="lazy"></a>' +
      dots + '</div>';
  }

  function actionsHtml(href, callPlace) {
    return '<div class="tile-actions">' +
      '<a class="tile-btn tile-btn-more" href="' + esc(href) + '">Подробнее</a>' +
      // S104: причина звонка — в data-атрибуте (место вызова); полную формулировку
      // («<Место> — <Страница>. Есть вопрос…») собирает modal.js и показывает только админу.
      '<button type="button" class="tile-btn tile-btn-call" data-call="' +
      esc(callPlace) + '"><i class="icon-call"></i> Заказать звонок</button>' +
      '</div>';
  }

  /**
   * Плитка программы: фото 2:3, название в 3 строки по центру, кнопки столбиком.
   * У программы в плитке только обложка (свайп фото — у тренеров, S90).
   */
  function programTile(p) {
    if (!p) return '';
    var href = 'program.html?id=' + p.id;
    var photos = p.image ? [p.image] : [];
    return '<div class="tile tile-program" id="program-' + p.id + '">' +
      photoHtml(photos, href, p.name) +
      '<div class="tile-title tile-title-3"><a href="' + esc(href) + '">' + esc(p.name) + '</a></div>' +
      actionsHtml(href, 'Плитка программы «' + p.name + '»') +
      '</div>';
  }

  /**
   * Плитка тренера: фото 2:3, ФИО в 2 строки по центру, кнопки столбиком.
   * Если фото несколько — показываются по движению мыши/пальца влево-вправо.
   */
  function trainerTile(t) {
    if (!t) return '';
    var href = 'trainer.html?id=' + t.id;
    return '<div class="tile tile-trainer" id="trainer-' + t.id + '">' +
      photoHtml(photosOf(t), href, t.name) +
      '<div class="tile-title tile-title-2"><a href="' + esc(href) + '">' + esc(t.name) + '</a></div>' +
      actionsHtml(href, 'Плитка тренера «' + t.name + '»') +
      '</div>';
  }

  // Сетка одинаковых плиток (программы, тренеры, направления).
  // cls — дополнительные классы контейнера (S132: блоку «Ведёт» нужен класс
  // .entity-trainers, чтобы прежняя разметка и тесты не разъехались).
  // S139 п.1:Tiles.grid допускает и строку, и МАССИВ плиток. Раньше массив
  // молча превращался в строку через конкатенацию — между плитками
  // появлялись текстовые узлы «,», которые сетка считала анонимными
  // элементами: плитки вставили через одну (2 на 4 колонки).
  function grid(tilesHtml, id, cls) {
    var html = Array.isArray(tilesHtml) ? tilesHtml.join('') : (tilesHtml || '');
    var idAttr = id ? ' id="' + esc(id) + '"' : '';
    var classAttr = 'tiles-grid' + (cls ? ' ' + cls : '');
    return '<div class="' + classAttr + '"' + idAttr + '>' + html + '</div>';
  }

  /* ============================================
     СВАЙП ФОТО В ПЛИТКЕ (S90)
     Движение указателя влево/вправо по фотографии переключает кадр.
     ============================================ */
  function bindSwipe(frame) {
    var photos = (frame.getAttribute('data-photos') || '').split('|').filter(Boolean);
    if (photos.length < 2) return;
    if (frame.getAttribute('data-swipe-bound') === '1') return;
    frame.setAttribute('data-swipe-bound', '1');

    var img = frame.querySelector('img');
    var dots = frame.querySelectorAll('.tile-photo-dot');
    if (!img) return;

    var idx = -1;
    function show(i) {
      i = Math.max(0, Math.min(photos.length - 1, i));
      if (i === idx) return;
      idx = i;
      img.src = photos[i];
      for (var k = 0; k < dots.length; k++) {
        dots[k].classList.toggle('active', k === i);
      }
    }

    function moveTo(clientX) {
      var rect = frame.getBoundingClientRect();
      if (!rect.width) return;
      var rel = (clientX - rect.left) / rect.width;
      show(Math.floor(rel * photos.length));
    }

    frame.addEventListener('mousemove', function (e) { moveTo(e.clientX); });
    frame.addEventListener('mouseleave', function () { show(0); });
    frame.addEventListener('touchmove', function (e) {
      if (e.touches && e.touches[0]) moveTo(e.touches[0].clientX);
    }, { passive: true });
    frame.addEventListener('touchend', function () { show(0); });
  }

  function initAll(root) {
    var scope = root || document;
    scope.querySelectorAll('.tile-photo').forEach(bindSwipe);
  }

  /* ============================================
     КНОПКА «ЗАКАЗАТЬ ЗВОНОК» (делегирование)
     Работает на любой странице, где подключён tiles.js.
     ============================================ */
  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest ? e.target.closest('.tile-btn-call') : null;
    if (!btn) return;
    var reason = btn.getAttribute('data-call') || 'Плитка на сайте';
    if (window.openCallModal) window.openCallModal(reason);
  });

  window.Tiles = {
    program: programTile,
    trainer: trainerTile,
    grid: grid,
    photosOf: photosOf,
    initAll: initAll
  };
})();
