/**
 * slider-core.js — единый движок слайдера (S159).
 *
 * Один и тот же рендеринг и логика у главного слайдера и у всех фотоальбомов
 * сайта: альбомы программ/тренеров, страница «Альбом», слайдер совместных фото.
 * Новости (сетка/модалка) используют свой рендер — по указанию пользователя.
 * Обложки направлений — не альбом, остаются своим ротатором.
 *
 * API:
 *   SliderCore.renderInner(items, opts)  → HTML слайдов и навигации (без обёртки)
 *   SliderCore.render(items, opts)       → HTML + обёртка div.slider
 *   SliderCore.wire(el, opts)            → навесить логику на готовую разметку
 *   SliderCore.initAll(root, opts)       → wire для всех .slider[data-slider-id]
 *   SliderCore.mount(el, items, opts)    → вставить HTML + wire → {destroy,next,prev,goTo}
 *
 * items: [{ image, title, description, link, linkTarget, interval, position,
 *           textColor, textSize, textMargin, overlay }]
 * opts:  { interval, autoplay, showArrows, showDots, overlay, position,
 *          textColor, textSize, textMargin, showCaption, id, cssClass, onClick }
 */
(function () {
  function noop() {}

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function escAttr(s) {
    return esc(s).replace(/"/g, '&quot;');
  }
  function num(v, dflt) {
    var n = Number(v);
    return Number.isFinite(n) ? n : dflt;
  }

  /**
   * Слайды + стрелки + точки/счётчик. Обёртку div.slider не создаёт.
   * Глобальные opts служат значениями по умолчанию, поля слайда их перебивают.
   */
  function renderInner(items, opts) {
    if (!items || !items.length) return '';
    var gs = opts || {};
    var total = items.length;
    var globalOv = gs.overlay || {};
    // Ленивая загрузка: по умолчанию для наборов больше 12 фото
    var lazy = gs.lazy !== undefined ? !!gs.lazy : total > 12;

    var slides = items.map(function (s, i) {
      var p = s.position || gs.position || 'center';
      var tm = s.textMargin || gs.textMargin || {};
      var textStyle = [
        (s.textColor || gs.textColor) ? 'color:' + escAttr(s.textColor || gs.textColor) : '',
        (s.textSize || gs.textSize) ? 'font-size:' + num(s.textSize || gs.textSize, 42) + 'px' : '',
        (tm.top !== undefined || tm.right !== undefined || tm.bottom !== undefined || tm.left !== undefined)
          ? 'margin:' + num(tm.top ?? 20, 20) + 'px ' + num(tm.right ?? 20, 20) + 'px ' +
            num(tm.bottom ?? 20, 20) + 'px ' + num(tm.left ?? 20, 20) + 'px'
          : ''
      ].filter(Boolean).join(';');

      var ov = s.overlay || globalOv;
      var overlayStyle = (ov.enabled !== false)
        ? 'background:' + escAttr(ov.color || '#000') + ';opacity:' + num(ov.opacity ?? 0.4, 0.4)
        : 'display:none';

      var interval = num(s.interval, 0);
      var caption = (gs.showCaption === false) ? '' : esc(s.title || '');
      var descHtml = (gs.showCaption === false || !s.description)
        ? '' : '<p class="slider-desc">' + esc(s.description).replace(/\n/g, '<br>') + '</p>';
      var titleHtml = (gs.showCaption === false || !s.link)
        ? caption
        : '<a class="slider-link" href="' + escAttr(s.link) + '" target="' +
          escAttr(s.linkTarget === '_blank' ? '_blank' : '_self') + '">' + caption + '</a>';

      // lazy: src ставится только видимому и следующему слайду.
      // По умолчанию включается на больших наборах (>12), чтобы альбом
      // на сотни фото не тянул всё сразу.
      var imgAttrs = lazy
        ? 'data-src="' + escAttr(s.image) + '"' + (i === 0 ? ' src="' + escAttr(s.image) + '"' : '')
        : 'src="' + escAttr(s.image) + '"';

      return '<div class="slide' + (i === 0 ? ' active' : '') + '"' +
        (interval > 0 ? ' data-interval="' + interval + '"' : '') + '>' +
        '<img ' + imgAttrs + ' alt="' + escAttr(s.title || '') + '" loading="lazy">' +
        '<div class="slide-overlay" style="' + overlayStyle + '"></div>' +
        '<div class="slider-text pos-' + escAttr(p) + '" style="' + escAttr(textStyle) + '">' +
        '<h1 class="slider-title">' + titleHtml + '</h1>' + descHtml +
        '</div></div>';
    }).join('');

    var multi = total > 1;
    var arrows = (gs.showArrows !== false && multi)
      ? '<button class="slider-nav slider-prev" type="button" aria-label="Предыдущий слайд">‹</button>' +
        '<button class="slider-nav slider-next" type="button" aria-label="Следующий слайд">›</button>'
      : '';

    // Точек больше 12 не бывает читаемо — вместо них счётчик «3 / 57»
    var navHtml = '';
    if (gs.showDots !== false && multi) {
      if (total <= 12) {
        navHtml = '<div class="slider-dots">' + items.map(function (_, i) {
          return '<button class="slider-dot' + (i === 0 ? ' active' : '') + '" type="button"' +
            ' data-slide="' + i + '" aria-label="Слайд ' + (i + 1) + '"></button>';
        }).join('') + '</div>';
      } else {
        navHtml = '<span class="slider-counter" aria-live="polite">1 / ' + total + '</span>';
      }
    }

    return slides + arrows + navHtml;
  }

  /** Обёртка div.slider вокруг контента. */
  function renderWrap(inner, opts) {
    var gs = opts || {};
    var cls = 'slider' + (gs.cssClass ? ' ' + gs.cssClass : '');
    return '<div class="' + escAttr(cls) + '" data-slider-id="' + escAttr(gs.id || '') + '">' + inner + '</div>';
  }

  function render(items, opts) {
    var inner = renderInner(items, opts);
    return inner ? renderWrap(inner, opts) : '';
  }

  /**
   * Логика поверх готовой разметки (своей или вставленной через render).
   * Идемпотентна: повторный вызов на том же контейнере игнорируется.
   */
  function wire(el, opts) {
    if (!el || el.getAttribute('data-slider-ready')) {
      return { destroy: noop, next: noop, prev: noop, goTo: noop };
    }
    el.setAttribute('data-slider-ready', '1');
    opts = opts || {};

    var slides = el.querySelectorAll('.slide');
    var dots = el.querySelectorAll('.slider-dot');
    var counter = el.querySelector('.slider-counter');
    var prevBtn = el.querySelector('.slider-prev');
    var nextBtn = el.querySelector('.slider-next');
    var current = 0;
    var timer = null;
    var live = true;

    function clearTimer() { if (timer) { clearInterval(timer); timer = null; } }

    // lazy-режим: картинка ставится только видимому и следующему слайду.
    // Определяется по факту data-src в разметке, чтобы render и wire не
    // обязаны были получать один и тот же opts.
    var lazy = opts.lazy !== undefined ? !!opts.lazy : !!el.querySelector('img[data-src]');

    function ensureLoaded(i) {
      if (!lazy) return;
      for (var k = 0; k < 2; k++) {
        var s = slides[((i + k) % slides.length + slides.length) % slides.length];
        if (!s) continue;
        var img = s.querySelector('img');
        if (img && !img.getAttribute('src') && img.getAttribute('data-src')) {
          img.setAttribute('src', img.getAttribute('data-src'));
        }
      }
    }

    function show(index) {
      if (!live || !slides.length) return;
      current = ((index % slides.length) + slides.length) % slides.length;
      for (var i = 0; i < slides.length; i++) {
        slides[i].classList.toggle('active', i === current);
      }
      for (var j = 0; j < dots.length; j++) {
        dots[j].classList.toggle('active', j === current);
      }
      if (counter) counter.textContent = (current + 1) + ' / ' + slides.length;
      ensureLoaded(current);
    }

    function restart() {
      clearTimer();
      // Автопрокрутка включена по умолчанию, выключается явным autoplay:false
      if (opts.autoplay === false || slides.length < 2) return;
      var own = Number(slides[current] && slides[current].getAttribute('data-interval'));
      var sec = own > 0 ? own : (num(opts.interval, 0) > 0 ? num(opts.interval, 0) : 5);
      timer = setInterval(function () { show(current + 1); }, sec * 1000);
    }

    function next() { if (live) { show(current + 1); restart(); } }
    function prev() { if (live) { show(current - 1); restart(); } }
    function goTo(i) { if (live) { show(i); restart(); } }

    for (var d = 0; d < dots.length; d++) {
      (function (btn) {
        btn.addEventListener('click', function () { goTo(Number(btn.getAttribute('data-slide'))); });
      })(dots[d]);
    }
    if (prevBtn) prevBtn.addEventListener('click', prev);
    if (nextBtn) nextBtn.addEventListener('click', next);

    // Пауза на наведении — как у главного слайдера
    el.addEventListener('mouseenter', clearTimer);
    el.addEventListener('mouseleave', restart);

    // Клик по фото (альбомы открывают lightbox). Текст/ссылку не перехватываем.
    if (typeof opts.onClick === 'function') {
      el.classList.add('slider-clickable');
      for (var s = 0; s < slides.length; s++) {
        (function (slide, idx) {
          slide.addEventListener('click', function (e) {
            if (e.target.closest('.slider-text')) return;
            opts.onClick(slide, idx);
          });
        })(slides[s], s);
      }
    }

    show(0);
    restart();

    return {
      destroy: function () { live = false; clearTimer(); el.removeAttribute('data-slider-ready'); },
      next: next, prev: prev, goTo: goTo
    };
  }

  /** Вставить разметку в контейнер и навесить логику. */
  function mount(el, items, opts) {
    if (!el || !items || !items.length) {
      return { destroy: noop, next: noop, prev: noop, goTo: noop };
    }
    opts = opts || {};
    // Контейнер уже слайдер (например, <section class="slider" id="slider">) —
    // кладём контент внутрь, иначе оборачиваем в div.slider.
    var isSlider = !!(el.classList && el.classList.contains('slider'));
    el.innerHTML = isSlider ? renderInner(items, opts) : render(items, opts);
    return wire(isSlider ? el : el.querySelector('.slider'), opts);
  }

  /** Инициализация слайдеров, вставленных как HTML-строка (страницы сущностей). */
  function initAll(root, opts) {
    var scope = root || document;
    var list = scope.querySelectorAll('.slider[data-slider-id]:not([data-slider-ready])');
    for (var i = 0; i < list.length; i++) wire(list[i], opts || {});
  }

  window.SliderCore = {
    render: render, renderInner: renderInner, wire: wire, initAll: initAll, mount: mount
  };
})();
