/**
 * carousel.js — горизонтальная карусель фотоальбома сущности (S62).
 *
 * Фото выводятся ЦЕЛИКОМ (object-fit: contain), без обрезки.
 * Прокрутка: свайп (нативный скролл + scroll-snap), кнопки ‹ ›.
 * Клик по фото — lightbox на весь экран.
 *
 * API:
 *   Carousel.render(items, altBase) → HTML строка карусели
 *   Carousel.initAll(root)          → повесить обработчики (после вставки HTML)
 *
 * items: [{ image, caption }]
 *
 * Если модуль не загружен — сущность откатывается к старой сетке (.album-grid).
 */
(function () {
  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /** HTML карусели (обработчики навешиваются в initAll). */
  function render(items, altBase) {
    if (!items || !items.length) return '';

    var slides = items.map(function (a, i) {
      var alt = a.caption || (altBase ? altBase + ' — фото ' + (i + 1) : '');
      var caption = a.caption
        ? '<span class="carousel-caption">' + esc(a.caption) + '</span>'
        : '';
      // Класс lightbox-zoom НЕ вешаем: обработчик клика своей карусели ниже
      // (иначе глобальный слушатель lightbox.js открыл бы модалку дважды)
      return '<figure class="carousel-item" data-full="' + esc(a.image) + '" tabindex="0" role="button">' +
        '<img src="' + esc(a.image) + '" alt="' + esc(alt) + '" loading="lazy">' +
        caption +
        '</figure>';
    }).join('');

    // Одна кнопка прокрутки не нужна
    var multi = items.length > 1;
    var nav = multi
      ? '<button class="carousel-btn carousel-prev" type="button" aria-label="Предыдущее фото">‹</button>' +
        '<button class="carousel-btn carousel-next" type="button" aria-label="Следующее фото">›</button>'
      : '';
    var counter = multi
      ? '<span class="carousel-counter">1 / ' + items.length + '</span>'
      : '';

    return '<div class="entity-carousel">' +
      nav +
      '<div class="carousel-track">' + slides + '</div>' +
      counter +
      '</div>';
  }

  /** Индекс видимого слайда по позиции прокрутки. */
  function activeIndex(track) {
    var items = track.querySelectorAll('.carousel-item');
    var mid = track.scrollLeft + track.clientWidth / 2;
    var best = 0, bestDist = Infinity;
    for (var i = 0; i < items.length; i++) {
      var c = items[i].offsetLeft + items[i].offsetWidth / 2;
      var d = Math.abs(c - mid);
      if (d < bestDist) { bestDist = d; best = i; }
    }
    return best;
  }

  function scrollByStep(track, dir) {
    // Шаг = ширина видимой области минус небольшой зазор для «захвата» следующего фото
    var step = Math.max(track.clientWidth * 0.8, 200);
    track.scrollBy({ left: dir * step, behavior: 'smooth' });
  }

  function wire(carousel) {
    if (carousel.getAttribute('data-carousel-ready')) return;
    carousel.setAttribute('data-carousel-ready', '1');

    var track = carousel.querySelector('.carousel-track');
    if (!track) return;

    var prev = carousel.querySelector('.carousel-prev');
    var next = carousel.querySelector('.carousel-next');
    var counter = carousel.querySelector('.carousel-counter');
    var total = track.querySelectorAll('.carousel-item').length;

    if (prev) prev.addEventListener('click', function () { scrollByStep(track, -1); });
    if (next) next.addEventListener('click', function () { scrollByStep(track, 1); });

    function refresh() {
      if (!counter) return;
      counter.textContent = (activeIndex(track) + 1) + ' / ' + total;
    }

    var raf = null;
    track.addEventListener('scroll', function () {
      if (raf) return;
      raf = requestAnimationFrame(function () { raf = null; refresh(); });
    });

    // Клик/Enter по слайду — lightbox (если модуль доступен)
    track.addEventListener('click', function (e) {
      var item = e.target.closest('.carousel-item');
      if (!item || !window.openLightbox) return;
      var img = item.querySelector('img');
      window.openLightbox(item.getAttribute('data-full') || (img && img.src) || '', img && img.alt);
    });
    track.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var item = e.target.closest('.carousel-item');
      if (!item || !window.openLightbox) return;
      e.preventDefault();
      var img = item.querySelector('img');
      window.openLightbox(item.getAttribute('data-full') || (img && img.src) || '', img && img.alt);
    });

    // Кнопки ‹ › не должны перетаскивать фокус/скроллить страницу
    refresh();
  }

  function initAll(root) {
    var scope = root || document;
    var list = scope.querySelectorAll('.entity-carousel');
    // Если карусель уже в document, но init вызван до вставки — ищем по всему документу
    if (!list.length && scope === document) return;
    for (var i = 0; i < list.length; i++) wire(list[i]);
  }

  window.Carousel = { render: render, initAll: initAll };
})();
