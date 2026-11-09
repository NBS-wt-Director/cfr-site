/**
 * appearance.js — применение «Оформления» из админки.
 *
 * Данные: SITE_DATA.appearance = { variables: { "--fs-body": "18px", ... }, customCss: "..." }
 * Генератор: npm run static:export (db.appearance → core.js)
 *
 * Подключается СРАЗУ после core.js (до отрисовки контента), чтобы не было
 * скачка шрифтов. variables пишутся inline на <html> (перебивают :root),
 * customCss вставляется в <style id="appearance-css">.
 *
 * customCss проходит минимальную санитизацию: вырезаются </style>,
 * @import и expression() — прямой ввод администратора, но защита от случайного
 * обрыва тега обязательна.
 */
(function () {
  var data = window.SITE_DATA || {};

  // Favicon из логотипа (S75): siteSettings.logo → <link rel="icon">
  var settings = data.siteSettings || {};
  if (settings.logo) {
    var icons = document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]');
    for (var k = 0; k < icons.length; k++) icons[k].parentNode.removeChild(icons[k]);
    var link = document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/png';
    link.href = settings.logo;
    document.head.appendChild(link);
  }

  // S126: названия сайта («Главные данные») — единый источник для заголовков вкладки.
  // title1 — шапка/alt логотипа, title2 — подвал и <title> страницы.
  // Страницы, где title собирается динамически (сущность, страница, направление),
  // берут бренд из window.SITE_BRAND.
  var t1 = typeof settings.title1 === 'string' ? settings.title1 : '';
  var t2 = typeof settings.title2 === 'string' ? settings.title2 : '';
  window.SITE_BRAND = {
    title1: t1,
    title2: t2,
    // Полное имя бренда: «Центр Функционального Развития «Шифу Панда»»
    full: t2 ? (t1 ? t2 + ' «' + t1 + '»' : t2) : t1
  };
  // data-doc-title на <body> — префикс страницы («Новости», «Альбом»…).
  // Без него вкладка = полное имя бренда (главная).
  var docPrefix = document.body ? (document.body.getAttribute('data-doc-title') || '') : '';
  if (window.SITE_BRAND.full) {
    document.title = docPrefix ? docPrefix + ' — ' + (t2 || t1) : window.SITE_BRAND.full;
  }

  var ap = data.appearance;
  if (!ap) return;

  var vars = ap.variables || {};
  var rootStyle = document.documentElement.style;

  // S118: ширина контейнеров (px/% + значение) → CSS-переменная --container-w.
  // --content-w (слайдер/окна) — производная от неё в style.css, менять не нужно.
  var cw = ap.containerWidth;
  if (cw && typeof cw === 'object') {
    var unit = cw.unit === 'px' ? 'px' : '%';
    var num = Number(cw.value);
    var okRange = unit === 'px' ? (num >= 320 && num <= 3840) : (num >= 20 && num <= 100);
    if (Number.isFinite(num) && okRange) {
      rootStyle.setProperty('--container-w', Math.round(num) + unit);
    }
  }

  // S125: максимальная ширина плитки новости → CSS-переменная --news-tile-max.
  // Сетка (.news-grid) сама считает число колонок из этой ширины.
  var nw = ap.newsTileWidth;
  if (nw && typeof nw === 'object') {
    var nUnit = nw.unit === '%' ? '%' : 'px';
    var nNum = Number(nw.value);
    var nOk = nUnit === 'px' ? (nNum >= 200 && nNum <= 800) : (nNum >= 20 && nNum <= 100);
    if (Number.isFinite(nNum) && nOk) {
      rootStyle.setProperty('--news-tile-max', Math.round(nNum) + nUnit);
    }
  }

  for (var name in vars) {
    if (!Object.prototype.hasOwnProperty.call(vars, name)) continue;
    // Только CSS-переменные (--*), значения — скалярные строки
    if (name.indexOf('--') !== 0) continue;
    var value = String(vars[name]);
    if (!value || value.length > 100) continue;
    rootStyle.setProperty(name, value);
  }

  var css = ap.customCss;
  if (typeof css === 'string' && css.trim()) {
    var safe = css
      .replace(/<\/style/gi, '<\\/style')
      .replace(/@import[^;]*;?/gi, '')
      .replace(/expression\s*\(/gi, 'expr(');
    var style = document.getElementById('appearance-css');
    if (!style) {
      style = document.createElement('style');
      style.id = 'appearance-css';
      document.head.appendChild(style);
    }
    style.textContent = safe;
  }
})();
