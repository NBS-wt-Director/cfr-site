/**
 * page.js — рендер статической страницы по ?id= или ?url= (S120).
 *
 * Один шаблон на все статические страницы: static/page.html.
 * Данные берутся из window.SITE_DATA.pages (экспорт export-static.mjs).
 *
 * Скрытая/несуществующая страница → блок «Не найдено» + ссылка на главную,
 * а не 404: голая статика не отдаёт коды ответа (решение S16).
 */
(function () {
  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // S126: название сайта — из «Главных данных» (title2, fallback title1)
  function siteName() {
    var b = window.SITE_BRAND || {};
    return b.title2 || b.title1 || 'ЦФР';
  }

  function md(src) {
    return window.MD ? window.MD.render(src) : '<p>' + esc(src || '').replace(/\n/g, '<br>') + '</p>';
  }

  function notFound() {
    return '<div class="entity-not-found">' +
      '<h1 class="entity-title">Страница не найдена</h1>' +
      '<p class="entity-meta">Такой страницы нет или она скрыта с сайта.</p>' +
      '<div class="entity-actions"><a class="program-btn program-btn-primary" href="index.html">← На главную</a></div>' +
      '</div>';
  }

  function init() {
    var mount = document.getElementById('page-content');
    if (!mount) return;

    var params = new URLSearchParams(location.search);
    var idParam = params.get('id');
    var urlParam = params.get('url');
    var pages = (window.SITE_DATA || {}).pages || [];

    var page = null;
    if (idParam != null && idParam !== '') {
      page = pages.filter(function (p) { return String(p.id) === String(idParam); })[0];
    } else if (urlParam) {
      page = pages.filter(function (p) { return String(p.url) === String(urlParam); })[0];
    }

    if (!page) {
      location.replace('404.html?from=' + encodeURIComponent('page.html?url=' + urlParam) + '&id=' + encodeURIComponent(urlParam));
      return;
    }

    document.title = page.title + ' — ' + siteName();
    var meta = document.querySelector('meta[name="description"]');
    if (meta) {
      var plain = window.MD ? window.MD.plainText(page.text || '') : (page.text || '');
      meta.setAttribute('content', plain.slice(0, 160));
    }
    mount.innerHTML =
      '<h1 class="entity-title">' + esc(page.title) + '</h1>' +
      '<div class="entity-text">' + md(page.text || '') + '</div>';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
