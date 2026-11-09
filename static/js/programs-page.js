/**
 * js/programs-page.js — страница ВСЕХ программ (S130).
 *
 * Таксономия (S130 п.1): группы строятся по НАПРАВЛЕНИЯМ — тем же
 * `navDirections`, что шапка и главная. Прежняя группировка по
 * `programs[].category` давала две разные классификации одного и того же
 * набора («Изобразительное искусство (4+)» на главной была в своём
 * направлении, а здесь — в «🧒 Детские направления»).
 * `category` осталась в данных и служит fallback для программ без направления.
 *
 * Панель — общий компонент js/panels.js (тот же, что на главной),
 * состояние свёрнутости хранится в одном ключе `site_sections`.
 *
 * Добавлено (S130 п.4–5): счётчик «N тренировок в M направлениях»,
 * клиентские фильтры (возраст / тренер / только с расписанием),
 * CTA-подвал со ссылками на расписание и цены.
 */
(function () {
  'use strict';

  var data = window.SITE_DATA || {};
  var L = window.Layout;
  var P = window.Panels;
  var T = window.Tiles;
  if (!T) return;

  var programs = data.programs || [];
  var directions = data.directions || data.navDirections || [];
  var pageMain = document.getElementById('page-main');
  var mount = document.getElementById('programs-categories');
  if (!mount) return;

  /* ============================================
     Каркас страницы (S127 п.5/п.6)
     ============================================ */
  if (L) {
    L.applyDocumentTitle('programs', 'Наши тренировки');
    L.renderCrumbs(pageMain, [
      { href: 'index.html', label: 'Главная' },
      { label: L.sectionName('programs', 'Наши тренировки') }
    ]);
  }

  /* ============================================
     ФИЛЬТРЫ (S130 п.5). Только клиентские, по уже загруженным данным.
     ============================================ */

  // Возраст: из явных полей ageFrom/ageTo (S132), иначе — из названия «(2-4 года)»
  function ageRange(p) {
    var from = Number(p.ageFrom), to = Number(p.ageTo);
    if (from > 0 || to > 0) return { from: from || 0, to: to || 0 };
    var m = String(p.name || '').match(/(\d+)\s*[-–—]\s*(\d+)\s*(?:лет|года|л\.?)/i);
    if (m) return { from: Number(m[1]), to: Number(m[2]) };
    var single = String(p.name || '').match(/\((\d+)\s*\+\s*лет\s*\)/i);
    if (single) return { from: Number(single[1]), to: 0 };
    return null;
  }

  function isKids(p) {
    var r = ageRange(p);
    if (!r) return false;
    var upper = r.to || r.from;
    return upper > 0 && upper <= 15;
  }

  function hasSchedule(p) {
    return Array.isArray(p.scheduleStructured) && p.scheduleStructured.length > 0;
  }

  // Тренер программы: экспортируется список { id, name }
  function trainerIds(p) {
    return (p.trainers || []).map(function (t) { return String(t.id); }).filter(function (x) { return x && x !== 'undefined'; });
  }

  function trainerOptions() {
    var seen = {};
    var out = [];
    programs.forEach(function (p) {
      (p.trainers || []).forEach(function (t) {
        if (!t || !t.name || !t.id) return;
        var k = String(t.id);
        if (seen[k]) return;
        seen[k] = true;
        out.push({ id: k, name: t.name });
      });
    });
    return out.sort(function (a, b) { return a.name.localeCompare(b.name, 'ru'); });
  }

  var filters = { age: '', trainer: '', schedule: false };
  var anyTrainer = trainerOptions().length > 0;
  var anyAge = programs.some(function (p) { return ageRange(p); });

  var filtersEl = document.getElementById('programs-filters');
  var ageSel = document.getElementById('filter-age');
  var trainerSel = document.getElementById('filter-trainer');
  var scheduleChk = document.getElementById('filter-schedule');
  var resetBtn = document.getElementById('filter-reset');
  var emptyEl = document.getElementById('programs-empty');
  var summaryEl = document.getElementById('programs-summary');

  function filterActive() {
    return !!(filters.age || filters.trainer || filters.schedule);
  }

  function matches(p) {
    if (filters.age === 'kids' && !isKids(p)) return false;
    if (filters.age === 'adult' && isKids(p)) return false;
    if (filters.trainer && trainerIds(p).indexOf(filters.trainer) === -1) return false;
    if (filters.schedule && !hasSchedule(p)) return false;
    return true;
  }

  /* ============================================
     РЕНДЕР
     ============================================ */
  function plural(n, one, few, many) {
    var m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
    return many;
  }

  function render() {
    var visible = programs.filter(matches);
    // Направления с showInMenu/showOnHome не фильтруем по главной:
    // здесь страница всех программ, показываем все непустые направления
    var groups = P.groupByDirections(visible, directions, T.program, T.grid);

    P.render(mount, groups);
    T.initAll(mount);

    // Ни одна программа не должна потеряться: сверяем сумму по панелям со списком
    var shown = groups.reduce(function (acc, g) { return acc + g.count; }, 0);
    if (summaryEl) {
      var dirCount = groups.filter(function (g) { return g.dirId; }).length;
      summaryEl.textContent = filterActive()
        ? 'Найдено: ' + shown + ' ' + plural(shown, 'тренировка', 'тренировки', 'тренировок') +
          ' в ' + groups.length + ' ' + plural(groups.length, 'разделе', 'разделах', 'разделах')
        : 'Всего: ' + shown + ' ' + plural(shown, 'тренировка', 'тренировки', 'тренировок') +
          ' в ' + dirCount + ' ' + plural(dirCount, 'направлении', 'направлениях', 'направлениях');
    }

    if (emptyEl) emptyEl.hidden = shown !== 0;
  }

  /* ============================================
     ИНИЦИАЛИЗАЦИЯ ФИЛЬТРОВ
     Фильтры выводим только когда их есть чем наполнить —
     иначе пустые селекты портят вид страницы (правило «дефолт = как было»).
     ============================================ */
  if (filtersEl) {
    if (anyAge && ageSel) {
      // опции уже в разметке
    } else if (ageSel) {
      ageSel.closest('.programs-filter').hidden = true;
    }

    if (anyTrainer && trainerSel) {
      trainerOptions().forEach(function (t) {
        var o = document.createElement('option');
        o.value = t.id;
        o.textContent = t.name;
        trainerSel.appendChild(o);
      });
    } else if (trainerSel) {
      trainerSel.closest('.programs-filter').hidden = true;
    }

    function sync() {
      filters.age = ageSel ? ageSel.value : '';
      filters.trainer = trainerSel ? trainerSel.value : '';
      filters.schedule = scheduleChk ? scheduleChk.checked : false;
      render();
    }

    if (ageSel) ageSel.addEventListener('change', sync);
    if (trainerSel) trainerSel.addEventListener('change', sync);
    if (scheduleChk) scheduleChk.addEventListener('change', sync);
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        if (ageSel) ageSel.value = '';
        if (trainerSel) trainerSel.value = '';
        if (scheduleChk) scheduleChk.checked = false;
        sync();
      });
    }

    // Показываем панель фильтров, если хоть один фильтр доступен
    if (anyAge || anyTrainer) filtersEl.hidden = false;
  }

  render();

  /* ============================================
     CTA-подвал (S130 п.4)
     ============================================ */
  var ctaEl = document.getElementById('programs-cta');
  if (ctaEl) {
    var contacts = data.contacts || {};
    var tel = contacts.phone
      ? '<a class="program-btn program-btn-secondary" href="tel:' +
        String(contacts.phone).replace(/\D/g, '') + '">' + P.esc(contacts.phone) + '</a>'
      : '';
    ctaEl.innerHTML =
      '<div class="programs-cta-inner">' +
        '<h2 class="programs-cta-title">Не нашли подходящую тренировку?</h2>' +
        '<p class="programs-cta-text">Расскажем про все направления, подберём группу и удобное время.</p>' +
        '<div class="programs-cta-actions">' +
          '<button type="button" class="program-btn program-btn-primary" onclick="openCallModal(\'Страница всех программ\')">' +
            '<i class="icon-call"></i> Заказать звонок</button>' + tel +
          '<a class="program-btn program-btn-secondary" href="index.html#schedule">📅 Расписание</a>' +
          '<a class="program-btn program-btn-secondary" href="index.html#prices">💰 Цены и скидки</a>' +
        '</div>' +
      '</div>';
  }

  if (L) L.renderCrossLinks(pageMain, 'programs');
})();
