/*
 * S161/S163: учёт посещаемости — заходы на сайт.
 *
 * Ставится на все страницы сайта (кроме админки). При загрузке страницы
 * асинхронно (после готовности DOM) создаёт невидимый пиксель 1×1 и обращается
 * к /api/admin/track-visit. Сервер дополняет запись своими данными: IP,
 * User-Agent, Referer.
 *
 * Что сохраняется: IP, адрес-источник (откуда перешли), URL страницы,
 * User-Agent, разрешение экрана, язык браузера, метка сессии.
 *
 * MAC-адрес сохранить НЕВОЗМОЖНО: он не выходит за пределы L2 (его не видно
 * на сервере за NAT/роутером) и браузеры его не отдают скриптам. Поле mac в
 * записи istnieje и остаётся пустым — зафиксировано в тикете S163.
 *
 * Учёт не должен ни на что влиять: любая ошибка молча пропускается,
 * запрос идёт асинхронно, картинка не видна и не перехватывает клики.
 */
(function () {
  'use strict';

  var ENDPOINT = '/api/admin/track-visit';
  var SID_KEY = 'cfr_visit_sid';

  // Стабильная метка посетителя (localStorage) — чтобы отличать повторы
  // одного человека от разных заходов. Пустая, если хранилище недоступно.
  function visitorSid() {
    try {
      var s = localStorage.getItem(SID_KEY);
      if (!s) {
        s = Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
        localStorage.setItem(SID_KEY, s);
      }
      return s;
    } catch (e) { return ''; }
  }

  function trackVisit() {
    try {
      // Файловый просмотр (file://) и локальные тестовые страницы не считаем
      if (location.protocol !== 'http:' && location.protocol !== 'https:') return;

      var params = [
        'page=' + encodeURIComponent(location.pathname + location.search),
        'ref=' + encodeURIComponent((document.referrer || '').slice(0, 300)),
        'scr=' + encodeURIComponent(window.screen ? (screen.width + 'x' + screen.height) : ''),
        'lang=' + encodeURIComponent((navigator.language || navigator.userLanguage || '').slice(0, 20)),
        'sid=' + encodeURIComponent(visitorSid())
      ];

      var img = new Image(1, 1);
      img.alt = '';
      img.width = 1;
      img.height = 1;
      img.decoding = 'async';
      img.setAttribute('aria-hidden', 'true');
      // Не видим, не ловим клики, не влияем на вёрстку
      img.style.cssText = 'position:absolute;left:0;top:0;width:1px;height:1px;' +
        'opacity:0;pointer-events:none;user-select:none;';
      img.src = ENDPOINT + '?' + params.join('&');

      if (document.body) document.body.appendChild(img);
      else document.addEventListener('DOMContentLoaded', function () {
        if (document.body) document.body.appendChild(img);
      });
    } catch (e) { /* учёт не должен ломать страницу */ }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', trackVisit);
  } else {
    trackVisit();
  }
})();
