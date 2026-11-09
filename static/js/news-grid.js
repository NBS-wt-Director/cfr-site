/**
 * news-grid.js — единая сетка плиток новостей (главная и news.html).
 *
 * Правила (S124 + S125, уточнение пользователя):
 *  - сетка = сетка плиток тренеров/программ (--tile-cols, --tiles-gap);
 *    стандартная ячейка по умолчанию того же размера, из админки её ширину
 *    можно переопределить («Оформление» → «Ширина плитки новости» → --news-tile-max);
 *  - у новости ЕСТЬ обложка И обложка высокая (высота больше ширины) →
 *    плитка занимает ДВЕ ячейки одну под другой (grid-row: span 2,
 *    как ячейки «1 и 5» в сетке 4×2) — класс .news-card-tall;
 *  - иначе — одиночная плитка; новости БЕЗ обложки или с НЕ высокой обложкой
 *    выводятся компактными карточками, 2–3 таких в ОДНОЙ ячейке одну под
 *    другой (.news-grid-compact-stack);
 *  - остальное (превью 200 символов, кнопка, модалка) — без изменений.
 *
 * Раньше разметка была продублирована в main.js и inline-скрипте news.html,
 * из-за чего главная и страница новостей могли расходиться — поэтому логика
 * вынесена в один модуль, который подключается на обеих страницах.
 */
(function () {
  'use strict';

  // «2–3 одну под другой»: не больше трёх компактных карточек в одной ячейке
  var STACK_MAX = 3;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatDate(iso) {
    if (!iso) return '';
    try { return new Date(iso).toLocaleDateString('ru-RU'); } catch (e) { return String(iso); }
  }

  // Высокая плитка: обложка есть И она высокая (высота больше ширины).
  // coverTall считает экспортёр по реальным пикселям файла обложки.
  function isTall(n) {
    return !!(n && n.image && n.coverTall === true);
  }

  // Компактная плитка: всё, что не высокая (нет обложки / не высокая обложка)
  function isCompact(n) {
    return !isTall(n);
  }

  /**
   * Карточка новости.
   * @param {object} n        новость (срез news.js / news-all.js)
   * @param {string} openFn   имя глобальной функции открытия (`openNewsModal` / `openNews`)
   * @param {boolean} compact компактный вид
   * @param {function} labelFn (n) => текст кнопки | null (null — кнопки нет)
   */
  function cardHtml(n, openFn, compact, labelFn) {
    var label = typeof labelFn === 'function' ? labelFn(n) : 'Подробнее →';
    var actions = label
      ? '<div class="news-actions"><button type="button" class="news-more" onclick="' +
        openFn + '(' + n.id + ')">' + esc(label) + '</button></div>'
      : '';
    // В компактной плитке без обложки пустое изображение не нужно — только текст
    var cover;
    if (n.image) {
      cover = '<span class="lightbox-zoom" data-gallery="news-' + n.id + '">' +
        '<img src="' + esc(n.image) + '" alt="' + esc(n.title) + '" loading="lazy"></span>';
    } else {
      cover = compact ? '' : '<div class="news-noimage"></div>';
    }
    var cls = 'news-card' +
      (compact ? ' news-card-compact' : '') +
      (!compact && isTall(n) ? ' news-card-tall' : '');
    return '<article class="' + cls + '"' +
      (n.image ? '' : ' data-no-cover="1"') + ' id="news-' + n.id + '">' +
      cover +
      '<div class="news-content">' +
      '<h3 class="news-title">' + esc(n.title) + '</h3>' +
      (n.date ? '<p class="news-date">' + formatDate(n.date) + '</p>' : '') +
      '<p class="news-excerpt">' + esc(n.preview || '') + '</p>' +
      actions +
      '</div></article>';
  }

  /**
   * Сборка сетки: высокая обложка — плитка на 2 ячейки по вертикали,
   * компактные — стопками по 2–3 в одной ячейке (одну под другой).
   */
  function build(list, openFn, labelFn) {
    var html = '';
    var stack = [];

    function flush() {
      if (!stack.length) return;
      html += '<div class="news-grid-compact-stack">' + stack.join('') + '</div>';
      stack = [];
    }

    (Array.isArray(list) ? list : []).forEach(function (n) {
      if (isCompact(n)) {
        stack.push(cardHtml(n, openFn, true, labelFn));
        if (stack.length >= STACK_MAX) flush();
      } else {
        flush();
        html += cardHtml(n, openFn, false, labelFn);
      }
    });
    flush();
    return html;
  }

  window.NewsGrid = {
    build: build,
    cardHtml: cardHtml,
    isTall: isTall,
    isCompact: isCompact,
    STACK_MAX: STACK_MAX
  };
})();
