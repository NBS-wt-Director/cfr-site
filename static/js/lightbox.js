/**
 * Lightbox — увеличение картинок (S103: галерея + навигация).
 *
 * Элемент с классом .lightbox-zoom по клику открывается в полном размере.
 * Полный размер берётся из data-full, иначе — из src картинки внутри.
 *
 * Галерея: если у элементов один и тот же data-gallery, по ним можно листать
 * (кнопки ‹ › , клавиши ← / →), счётчик «N / M». Так листается галерея фото
 * новости (обложка + до 5 фото) и любых других наборов.
 */
(function () {
  let overlay = null;
  let img = null;
  let caption = null;
  let closeBtn = null;
  let prevBtn = null;
  let nextBtn = null;
  let counter = null;

  let gallery = [];   // [{ src, alt }]
  let index = 0;

  function createLightbox() {
    overlay = document.createElement('div');
    overlay.className = 'lightbox-overlay';
    overlay.innerHTML = `
      <div class="lightbox-box">
        <button class="lightbox-close" aria-label="Закрыть">&times;</button>
        <button class="lightbox-nav lightbox-prev" aria-label="Предыдущее" hidden>&#8249;</button>
        <button class="lightbox-nav lightbox-next" aria-label="Следующее" hidden>&#8250;</button>
        <img class="lightbox-img" src="" alt="">
        <div class="lightbox-caption"></div>
        <div class="lightbox-counter" hidden></div>
      </div>
    `;
    document.body.appendChild(overlay);
    img = overlay.querySelector('.lightbox-img');
    caption = overlay.querySelector('.lightbox-caption');
    closeBtn = overlay.querySelector('.lightbox-close');
    prevBtn = overlay.querySelector('.lightbox-prev');
    nextBtn = overlay.querySelector('.lightbox-next');
    counter = overlay.querySelector('.lightbox-counter');

    closeBtn.addEventListener('click', close);
    prevBtn.addEventListener('click', function (e) { e.stopPropagation(); step(-1); });
    nextBtn.addEventListener('click', function (e) { e.stopPropagation(); step(1); });
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) close();
    });
    document.addEventListener('keydown', function (e) {
      if (!overlay.classList.contains('open')) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') step(-1);
      if (e.key === 'ArrowRight') step(1);
    });
  }

  /** Показ текущего кадра галереи + обновление навигации. */
  function show() {
    const item = gallery[index] || { src: '', alt: '' };
    img.src = item.src;
    img.alt = item.alt || '';
    caption.textContent = item.alt || '';

    const many = gallery.length > 1;
    prevBtn.hidden = !many;
    nextBtn.hidden = !many;
    counter.hidden = !many;
    if (many) counter.textContent = (index + 1) + ' / ' + gallery.length;
  }

  function step(delta) {
    if (gallery.length < 2) return;
    index = (index + delta + gallery.length) % gallery.length;
    show();
  }

  /**
   * @param {Array<{src,alt}>} items — кадры
   * @param {number} startIndex — с какого начать
   */
  function openGallery(items, startIndex) {
    if (!overlay) createLightbox();
    gallery = (items || []).filter(it => it && it.src);
    if (!gallery.length) return;
    index = Math.min(Math.max(startIndex || 0, 0), gallery.length - 1);
    show();
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function open(src, alt) {
    openGallery([{ src: src, alt: alt }], 0);
  }

  function close() {
    if (!overlay) return;
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    setTimeout(function () { img.src = ''; gallery = []; }, 300);
  }

  /** Полный src элемента .lightbox-zoom (data-full → img.src → src). */
  function srcOf(el) {
    return el.getAttribute('data-full') ||
      (el.tagName === 'IMG' ? el.src : '') ||
      (el.querySelector('img') || {}).src || '';
  }

  function altOf(el) {
    return el.getAttribute('data-alt') || el.getAttribute('alt') ||
      (el.querySelector('img') || {}).alt || '';
  }

  // Делегирование: клик по .lightbox-zoom открывает кадр (или галерею)
  document.addEventListener('click', function (e) {
    const target = e.target.closest('.lightbox-zoom');
    if (!target) return;

    const src = srcOf(target);
    if (!src) return;
    e.preventDefault();
    e.stopPropagation();

    const group = target.getAttribute('data-gallery');
    if (group) {
      // Все элементы этой группы — в порядке следования в DOM
      const items = Array.from(document.querySelectorAll('.lightbox-zoom[data-gallery="' + group + '"]'))
        .map(el => ({ src: srcOf(el), alt: altOf(el) }))
        .filter(it => it.src);
      const start = Math.max(0, Array.from(document.querySelectorAll('.lightbox-zoom[data-gallery="' + group + '"]')).indexOf(target));
      openGallery(items, start);
    } else {
      open(src, altOf(target));
    }
  });

  window.openLightbox = open;
  window.openLightboxGallery = openGallery;
  window.closeLightbox = close;
})();

