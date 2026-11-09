/**
 * layout.js — единый каркас страниц (S127).
 *
 * Что сведено сюда, чтобы не жить по одному месту:
 *   1. разделитель между секциями (globalDivider из админки) — раньше логика
 *      была только в main.js, поэтому на всех остальных страницах
 *      <div class="divider"> оставался мёртвым элементом;
 *   2. имена разделов из справочника settings.sectionNames (решение Р1):
 *      одна настройка меняет меню, подвал, крошки, <h1> и <title>;
 *   3. хлебные крошки / back-link на общих страницах (общий helper);
 *   4. единый блок перекрёстных ссылок внизу общей страницы;
 *   5. подзаголовки разделов (homeSections[].subtitle, S127 шаг 3).
 *
 * Подключается на ВСЕХ страницах сразу после appearance.js.
 * Данные: SITE_DATA (core.js) — sectionNames, homeSections, divider.
 */
(function () {
  'use strict';

  var CROSS_LINKS = [
    { id: 'programs', href: 'programs.html', icon: '🥋', key: 'programs' },
    { id: 'trainers', href: 'trainers.html', icon: '👥', key: 'trainers' },
    { id: 'news', href: 'news.html', icon: '📰', key: 'news' },
    { id: 'schedule', href: 'index.html#schedule', icon: '📅', key: 'schedule' },
    { id: 'prices', href: 'index.html#prices', icon: '💰', key: 'prices' }
  ];

  function data() {
    return window.SITE_DATA || {};
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ============================================
     1. РАЗДЕЛИТЕЛЬ (globalDivider из админки)
     ============================================ */
  function applyDivider() {
    var div = data().divider;
    var nodes = document.querySelectorAll('.divider');
    if (!nodes.length || !div || !div.enabled) return;   // иначе остаётся display:none из CSS
    for (var i = 0; i < nodes.length; i++) {
      var d = nodes[i];
      d.textContent = div.text || '';
      d.classList.add('divider--on');
      if (div.height) d.classList.add('divider--' + div.height);
      if (div.background) d.classList.add('divider--bg-' + div.background);
      if (div.fontSize) d.classList.add('divider--fs-' + div.fontSize);
    }
  }

  /* ============================================
     2. ИМЕНА РАЗДЕЛОВ (справочник sectionNames, Р1)
     ============================================ */
  function homeSection(id) {
    var hs = data().homeSections;
    if (!Array.isArray(hs)) return null;
    for (var i = 0; i < hs.length; i++) if (hs[i] && hs[i].id === id) return hs[i];
    return null;
  }

  // Единое имя раздела: настройки → дефолт → переданный fallback
  function sectionName(id, fallback) {
    var sn = data().sectionNames || {};
    var v = String(sn[id] == null ? '' : sn[id]).trim();
    return v || String(fallback == null ? '' : fallback).trim();
  }

  // Заголовок БЛОКА на главной: homeSections[].title, пусто → sectionNames[id]
  function homeTitle(id, fallback) {
    var s = homeSection(id);
    var t = s ? String(s.title || '').trim() : '';
    return t || sectionName(id, fallback);
  }

  // Подзаголовок раздела (homeSections[].subtitle) — управляется из админки
  function sectionSubtitle(id) {
    var s = homeSection(id);
    return s ? String(s.subtitle || '').trim() : '';
  }

  // Раздел главной скрыт настройкой → его не предлагаем в меню/подвале/ссылках
  function sectionVisible(id) {
    var s = homeSection(id);
    return !s || s.visible !== false;
  }

  /* ============================================
     3. ХЛЕБНЫЕ КРОШКИ / BACK-LINK
     items: [{ href, label } | { label }] — последний пункт без href
     ============================================ */
  function crumbs(items) {
    if (!items || !items.length) return '';
    var parts = items.map(function (x, i) {
      var label = esc(x.label);
      var last = i === items.length - 1 || !x.href;
      return last
        ? '<span class="crumb crumb-current" aria-current="page">' + label + '</span>'
        : '<a class="crumb" href="' + esc(x.href) + '">' + label + '</a>' +
          '<span class="crumb-sep" aria-hidden="true">→</span>';
    }).join('');
    return '<nav class="crumbs" aria-label="Хлебные крошки">' + parts + '</nav>';
  }

  // Вставить крошки в начало контейнера (или в .container страницы)
  function renderCrumbs(mount, items) {
    if (!mount || !items || !items.length) return;
    if (mount.querySelector('.crumbs')) return;   // не дублируем
    mount.insertAdjacentHTML('afterbegin', crumbs(items));
  }

  /* ============================================
     4. ПЕРЕКРЁСТНЫЕ ССЫЛКИ ВНИЗУ ОБЩЕЙ СТРАНИЦЫ
     current — id раздела, на котором мы находимся (ссылку на себя не выводим)
     ============================================ */
  function crossLinks(current) {
    var links = CROSS_LINKS.filter(function (l) {
      return l.id !== current && sectionVisible(l.id);
    }).map(function (l) {
      return '<a class="cross-link" href="' + esc(l.href) + '">' +
        '<span class="cross-link-icon" aria-hidden="true">' + l.icon + '</span>' +
        '<span class="cross-link-text">' + esc(sectionName(l.key, l.id)) + ' →</span></a>';
    });
    if (!links.length) return '';
    return '<div class="cross-links"><h2 class="cross-links-title">Разделы сайта</h2>' +
      '<div class="cross-links-grid">' + links.join('') + '</div></div>';
  }

  // Вставить блок перекрёстных ссылок в конец контейнера страницы
  function renderCrossLinks(mount, current) {
    if (!mount || mount.querySelector('.cross-links')) return;
    mount.insertAdjacentHTML('beforeend', crossLinks(current));
  }

  /* ============================================
     5. ЗАГОЛОВКИ ОБЩИХ СТРАНИЦ из справочника + подзаголовки
     Разметка страницы: <h1 class="section-title" data-section="trainers">…</h1>
     Текущая строка в HTML остаётся fallback, если настройка пуста.
     ============================================ */
  function applySectionTitles(root) {
    var scope = root || document;
    var titles = scope.querySelectorAll('h1[data-section], .section-title[data-section]');
    for (var i = 0; i < titles.length; i++) {
      var el = titles[i];
      var id = el.getAttribute('data-section');
      var name = sectionName(id, '');
      if (name) el.textContent = name;
    }
    var subs = scope.querySelectorAll('.section-subtitle[data-section]');
    for (var k = 0; k < subs.length; k++) {
      var s = subs[k];
      var text = sectionSubtitle(s.getAttribute('data-section'));
      if (text) s.textContent = text;
      else if (s.getAttribute('data-subtitle-required') !== '1') s.remove();
    }
    // S127: back-link («← Коллектив») тоже из справочника, а не из литерала страницы
    var backs = scope.querySelectorAll('[data-back-section]');
    for (var m = 0; m < backs.length; m++) {
      var b = backs[m];
      var bn = sectionName(b.getAttribute('data-back-section'), '');
      if (bn) b.textContent = '← ' + bn;
    }
  }

  /* ============================================
     6. <title> общей страницы = «<имя раздела> — <бренд>»
     appearance.js ставит title из data-doc-title (наследие HTML-строки);
     здесь уточняем его именем из справочника, чтобы вкладка, меню и <h1>
     сходились (Р1).
     ============================================ */
  function applyDocumentTitle(id, fallbackPrefix) {
    var name = sectionName(id, fallbackPrefix || '');
    if (!name) return;
    var b = window.SITE_BRAND || {};
    var brand = b.title2 || b.title1 || '';
    document.title = brand ? name + ' — ' + brand : name;
    if (document.body) document.body.setAttribute('data-doc-title', name);
  }

  window.Layout = {
    esc: esc,
    applyDivider: applyDivider,
    sectionName: sectionName,
    sectionSubtitle: sectionSubtitle,
    sectionVisible: sectionVisible,
    homeTitle: homeTitle,
    homeSection: homeSection,
    crumbs: crumbs,
    renderCrumbs: renderCrumbs,
    crossLinks: crossLinks,
    renderCrossLinks: renderCrossLinks,
    applySectionTitles: applySectionTitles,
    applyDocumentTitle: applyDocumentTitle
  };

  // Самостоятельно: разделитель + заголовки страниц, помеченных data-section
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      applyDivider();
      applySectionTitles(document);
    });
  } else {
    applyDivider();
    applySectionTitles(document);
  }
})();
