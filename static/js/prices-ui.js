/**
 * prices-ui.js — общий рендер блока «💰 Стоимость» (S115/S131/S132).
 *
 * Используется:
 *   - entity.js (страница программы/тренера — позиции по programId/trainerId);
 *   - directions.js (страница направления — позиции программ состава + группа прайса);
 *   - program fallback через направление (S132 п.7 — цена группы направления).
 *
 * Данные: SITE_DATA.priceItems / SITE_DATA.discounts (не экспортируются
 * скрытые CRM-поля — trainerPay/payMode/freeTrainerPay на сайт не уходят).
 */
(function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function money(n) {
    return String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0') + '\u00A0₽';
  }

  function priceBadge(d) {
    if (!d) return null;
    if (d.type === 'percent') return { text: '−' + (Number(d.value) || 0) + '%', cls: 'percent' };
    if (d.type === 'amount') return { text: '−' + money(d.value), cls: 'amount' };
    if (d.type === 'bonus') return { text: '🎁 Бонус', cls: 'bonus' };
    return null;
  }

  // Позиции, привязанные к сущности (страница программы/тренера)
  function byEntity(entityId) {
    return function (i) {
      return (i.programId != null && String(i.programId) === String(entityId)) ||
        (i.trainerId != null && String(i.trainerId) === String(entityId));
    };
  }

  // Позиции направления: programId ∈ состава, либо группа прайса = priceGroup (S131 п.5)
  function byProgramIds(programIds, priceGroupName) {
    var set = {};
    (programIds || []).forEach(function (id) { set[String(id)] = true; });
    return function (i) {
      if (i.programId != null && set[String(i.programId)]) return true;
      if (priceGroupName && i.group && String(i.group).trim() === String(priceGroupName).trim()) return true;
      return false;
    };
  }

  /**
   * Блок «Стоимость». filterFn — предикат по позициям.
   * opts: { title, moreHref, moreText }
   * Пустой результат — '' (блок не показывается).
   */
  function block(filterFn, opts) {
    opts = opts || {};
    var data = window.SITE_DATA || {};
    var mine = (data.priceItems || []).filter(filterFn);
    if (!mine.length) return '';

    var discById = {};
    (data.discounts || []).forEach(function (d) { discById[String(d.id)] = d; });

    // Позиция с разными подвидами = одна строка со списком вариантов (как на главной)
    var rows = [], rowIdx = {};
    mine.forEach(function (i) {
      var key = [i.group || '', i.title || ''].join('|');
      if (rowIdx[key] === undefined) {
        rowIdx[key] = rows.length;
        rows.push({ group: i.group || 'Цены', title: i.title || '', unit: i.unit || '', variants: [], notes: [] });
      }
      var row = rows[rowIdx[key]];
      var badges = (i.discountIds || [])
        .map(function (id) { return priceBadge(discById[String(id)]); })
        .filter(Boolean);
      row.variants.push({ label: i.variant || '', price: i.price, priceOld: i.priceOld, badges: badges });
      if (i.note && row.notes.indexOf(i.note) === -1) row.notes.push(i.note);
    });

    var lastGroup = '';
    var body = rows.map(function (r) {
      var head = r.group !== lastGroup
        ? '<div class="entity-prices-group">' + esc(r.group) + '</div>'
        : '';
      lastGroup = r.group;
      var variants = r.variants.map(function (v) {
        var badgeHtml = v.badges.length
          ? '<span class="price-badges">' + v.badges.map(function (b) {
              return '<span class="price-badge price-badge--' + b.cls + '">' + b.text + '</span>';
            }).join('') + '</span>'
          : '';
        return '<div class="price-variant">' +
          (v.label ? '<span class="price-variant-label">' + esc(v.label) + '</span>' : '') +
          '<span class="price-variant-value">' +
          (v.priceOld ? '<s class="price-old">' + money(v.priceOld) + '</s> ' : '') + money(v.price) +
          '</span>' + badgeHtml + '</div>';
      }).join('');
      return '<div class="price-row">' +
        '<div class="price-row-head"><span class="price-row-title">' + esc(r.title) + '</span>' +
        (r.unit ? '<span class="price-row-unit">' + esc(r.unit) + '</span>' : '') +
        '</div><div class="price-variants">' + variants + '</div>' +
        (r.notes.length ? '<p class="price-row-note">' + r.notes.map(esc).join(' ') + '</p>' : '') +
        '</div>';
    }).join('');

    var moreHref = opts.moreHref || 'index.html#prices';
    var moreText = opts.moreText || 'Все цены и скидки →';
    return '<h2 class="entity-subtitle">' + (opts.title || '💰 Стоимость') + '</h2>' +
      '<div class="entity-prices">' + body +
      '<p class="entity-prices-more"><a href="' + esc(moreHref) + '">' + esc(moreText) + '</a></p></div>';
  }

  window.PricesUI = {
    money: money,
    priceBadge: priceBadge,
    block: block,
    byEntity: byEntity,
    byProgramIds: byProgramIds
  };
})();
