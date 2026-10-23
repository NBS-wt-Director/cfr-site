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
  var ap = data.appearance;
  if (!ap) return;

  var vars = ap.variables || {};
  var rootStyle = document.documentElement.style;

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
