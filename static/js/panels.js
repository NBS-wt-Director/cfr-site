/**
 * js/panels.js — общий компонент «панель-аккордеон» (S130).
 *
 * Почему отдельный модуль: разметка панели жила в двух местах — в `main.js`
 * (главная, с `.collapsible-head` + ссылкой «Подробнее →») и в inline-скрипте
 * `programs.html` (без шапки и ссылки). Из-за этого одна и та же группировка
 * выглядела по-разному, а состояние свёрнутости хранилось в ДВУХ ключах
 * (`home_sections` и `programs_sections`). Теперь один рендерер и один ключ.
 *
 * Таксономия (S130 п.1): группы строятся по НАПРАВЛЕНИЯМ (`directions` /
 * `navDirections`), а не по `programs[].category`. `category` остаётся в данных
 * и используется только как fallback для программ без `directionId`.
 *
 * Имена панелей (S130 п.3): `direction.publicTitle` → `direction.name`;
 * для fallback-панелей по `category` — справочник CATEGORY_TITLES
 * (включает «ИНДИВИДУАЛЬНЫЕ ЗАНЯТИЯ», которого в прежнем CAT_TITLES не было).
 */
(function () {
  'use strict';

  // Единый ключ: главная и programs.html запоминают свёрнутость вместе
  var STORE_KEY = 'site_sections';
  // Прежние ключи — мигрируем в новый, чтобы пользователь не потерял состояние
  var LEGACY_KEYS = ['home_sections', 'programs_sections'];

  // Справочник красивых имён для fallback-панелей по category (S130 п.3).
  // CAPS-ключ — как лежит в db.json (programs[].category).
  var CATEGORY_TITLES = {
    'БОЕВЫЕ НАПРАВЛЕНИЯ': '🥋 Боевые направления',
    'БОЕВЫЕ НАПРАВЛЕНИЕ': '🥋 Боевые направления',
    'БОЕВЫЕ НАПРАВЛ': '🥋 Боевые направления',
    'ДЕТСКИЕ НАПРАВЛЕНИЯ': '🧒 Детские направления',
    'ДЕТСКИЕ НАПРАВЛ': '🧒 Детские направления',
    'ОБУЧАЮЩИЕ ПРОГРАММЫ': '📚 Обучающие программы',
    'ОБУЧАЮЩИЕ': '📚 Обучающие программы',
    'ОЗДОРОВИТЕЛЬНЫЕ НАПРАВЛЕНИЯ': '💚 Оздоровительные направления',
    'ОЗДОРОВИТЕЛЬНЫЕ': '💚 Оздоровительные направления',
    'ФУНКЦИОНАЛЬНЫЕ НАПРАВЛЕНИЯ': '💪 Функциональные направления',
    'ФУНКЦИОНАЛЬНЫЕ': '💪 Функциональные направления',
    'ИНДИВИДУАЛЬНЫЕ ЗАНЯТИЯ': '🎯 Индивидуальные занятия',
    'ПРОЧИЕ': '📁 Прочие тренировки'
  };

  // Порядок fallback-панелей по category
  var CATEGORY_ORDER = [
    'БОЕВЫЕ НАПРАВЛЕНИЯ',
    'ДЕТСКИЕ НАПРАВЛЕНИЯ',
    'ОБУЧАЮЩИЕ ПРОГРАММЫ',
    'ОЗДОРОВИТЕЛЬНЫЕ НАПРАВЛЕНИЯ',
    'ФУНКЦИОНАЛЬНЫЕ НАПРАВЛЕНИЯ',
    'ИНДИВИДУАЛЬНЫЕ ЗАНЯТИЯ'
  ];

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ============================================
     ИМЕНА
     ============================================ */
  // S130 п.3: имя направления = publicTitle (челочитаемое), иначе name (может быть CAPS)
  function directionName(dir) {
    if (!dir) return '';
    var pt = String(dir.publicTitle == null ? '' : dir.publicTitle).trim();
    if (pt) return pt;
    var n = String(dir.name == null ? '' : dir.name).trim();
    // CAPS-название из старой разметки диска приводим к справочнику,
    // чтобы рядом не стояли «🥋 Боевые направления» и «БОЕВЫЕ НАПРАВЛЕНИЯ»
    return CATEGORY_TITLES[n.toUpperCase()] || n;
  }

  function categoryName(cat) {
    var key = String(cat == null ? '' : cat).trim().toUpperCase();
    return CATEGORY_TITLES[key] || String(cat || 'Прочие тренировки');
  }

  /* ============================================
     СОСТОЯНИЕ СВЁРНУТОСТИ (один ключ, миграция старых)
     ============================================ */
  function readState() {
    var st = {};
    // сначалаlegacy, затем новый — новый перетирает
    LEGACY_KEYS.concat([STORE_KEY]).forEach(function (k) {
      try {
        var raw = localStorage.getItem(k);
        if (raw) {
          var parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') Object.keys(parsed).forEach(function (id) { st[id] = parsed[id]; });
        }
      } catch (e) { /* приватный режим / битый JSON — просто дефолт */ }
    });
    return st;
  }

  function writeState(key, open) {
    try {
      var st = readState();
      st[key] = open;
      localStorage.setItem(STORE_KEY, JSON.stringify(st));
    } catch (e) { /* ignore */ }
  }

  /* ============================================
     РЕНДЕР ПАНЕЛИ
     item: { key, title, count, moreHref, moreLabel, bodyHtml }
     ============================================ */
  function panel(item, state) {
    var open = state ? state[item.key] !== false : true;   // по умолчанию раскрыто
    var more = item.moreHref
      ? '<a class="collapsible-more" href="' + esc(item.moreHref) + '">' + esc(item.moreLabel || 'Подробнее →') + '</a>'
      : '';
    return '<div class="collapsible' + (open ? ' open' : '') + '" data-panel-key="' + esc(item.key) + '">' +
      '<div class="collapsible-head">' +
        '<button type="button" class="collapsible-toggle" aria-expanded="' + open + '">' +
          '<span class="collapsible-title">' + esc(item.title) +
            ' <span class="collapsible-count">' + (item.count || 0) + '</span></span>' +
          '<span class="caret">▾</span>' +
        '</button>' + more +
      '</div>' +
      '<div class="collapsible-body">' + (item.bodyHtml || '') + '</div>' +
    '</div>';
  }

  function panelsHtml(items) {
    var state = readState();
    return items.map(function (it) { return panel(it, state); }).join('');
  }

  // Вешаем сворачивание на отрендеренные панели
  function bind(mount) {
    if (!mount) return;
    mount.querySelectorAll('.collapsible').forEach(function (panelEl) {
      var btn = panelEl.querySelector('.collapsible-toggle');
      if (!btn || btn.dataset.panelsBound === '1') return;
      btn.dataset.panelsBound = '1';
      btn.addEventListener('click', function () {
        var open = panelEl.classList.toggle('open');
        btn.setAttribute('aria-expanded', String(open));
        writeState(panelEl.getAttribute('data-panel-key'), open);
      });
    });
  }

  // Полный цикл: отрендерить группы в контейнер и подвязать сворачивание
  function render(mount, items) {
    if (!mount) return;
    mount.innerHTML = panelsHtml(items);
    bind(mount);
  }

  /* ============================================
     ГРУППИРОВКА ПО НАПРАВЛЕНИЯМ (S130 п.1)
     programs — полный список (programs.js), directions — navDirections или directions.js
     Возвращает [{ key, title, count, moreHref, bodyHtml, programs, isDirection }]
     Ни одна программа не теряется: без направления → резервная панель по category.
     ============================================ */
  function groupByDirections(programs, directions, tileFn, gridFn) {
    var byId = {};
    (programs || []).forEach(function (p) { byId[String(p.id)] = p; });

    var used = {};
    var items = [];

    (directions || []).forEach(function (d) {
      if (d.hidden) return;
      var list = (d.programs || []).map(function (dp) {
        return byId[String(dp.id)] || (dp.id == null ? null : null);
      }).filter(Boolean);
      // Направление без видимых программ не выводим (как в экспорте navDirections)
      if (!list.length) return;
      list.forEach(function (p) { used[String(p.id)] = true; });
      items.push({
        key: 'dir:' + d.id,
        dirId: d.id,
        title: directionName(d),
        count: list.length,
        moreHref: 'directions.html?id=' + encodeURIComponent(d.id),
        programs: list,
        // S139 п.1: join('') обязателен — массив плитами создавать нельзя
        bodyHtml: gridFn(list.map(tileFn).join(''))
      });
    });

    // Резерв: программы вне составов направлений — панелями по category
    var leftovers = (programs || []).filter(function (p) { return !used[String(p.id)]; });
    if (leftovers.length) {
      var byCat = {};
      leftovers.forEach(function (p) {
        var cat = String(p.category || 'ПРОЧИЕ').trim().toUpperCase() || 'ПРОЧИЕ';
        (byCat[cat] = byCat[cat] || []).push(p);
      });
      var cats = Object.keys(byCat).sort(function (a, b) {
        var ia = CATEGORY_ORDER.indexOf(a), ib = CATEGORY_ORDER.indexOf(b);
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      });
      cats.forEach(function (cat) {
        items.push({
          key: 'cat:' + cat,
          title: categoryName(cat),
          count: byCat[cat].length,
          programs: byCat[cat],
          bodyHtml: gridFn(byCat[cat].map(tileFn).join(''))
        });
      });
    }

    return items;
  }

  window.Panels = {
    STORE_KEY: STORE_KEY,
    CATEGORY_TITLES: CATEGORY_TITLES,
    CATEGORY_ORDER: CATEGORY_ORDER,
    esc: esc,
    directionName: directionName,
    categoryName: categoryName,
    readState: readState,
    writeState: writeState,
    panel: panel,
    panelsHtml: panelsHtml,
    bind: bind,
    render: render,
    groupByDirections: groupByDirections
  };
})();
