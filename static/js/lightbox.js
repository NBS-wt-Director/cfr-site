/**
 * Lightbox — увеличение картинок
 */
(function () {
  let overlay = null;
  let img = null;
  let caption = null;
  let closeBtn = null;

  function createLightbox() {
    overlay = document.createElement('div');
    overlay.className = 'lightbox-overlay';
    overlay.innerHTML = `
      <div class="lightbox-box">
        <button class="lightbox-close" aria-label="Закрыть">&times;</button>
        <img class="lightbox-img" src="" alt="">
        <div class="lightbox-caption"></div>
      </div>
    `;
    document.body.appendChild(overlay);
    img = overlay.querySelector('.lightbox-img');
    caption = overlay.querySelector('.lightbox-caption');
    closeBtn = overlay.querySelector('.lightbox-close');

    closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) close();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') close();
    });
  }

  function open(src, alt) {
    if (!overlay) createLightbox();
    img.src = src;
    img.alt = alt || '';
    caption.textContent = alt || '';
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function close() {
    if (!overlay) return;
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    setTimeout(function () { img.src = ''; }, 300);
  }

  // Attach to all images in .section
  document.addEventListener('click', function (e) {
    const target = e.target.closest('.lightbox-zoom');
    if (target) {
      // data-full — полный размер для превьюшек; иначе src самой картинки
      const src = target.getAttribute('data-full') || target.src || (target.querySelector('img') || {}).src || '';
      if (!src) return;
      e.preventDefault();
      const alt = target.getAttribute('alt') || (target.querySelector('img') || {}).alt || '';
      open(src, alt);
    }
  });

  window.openLightbox = open;
  window.closeLightbox = close;
})();
