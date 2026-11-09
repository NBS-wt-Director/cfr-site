/**
 * seo.js — единый SEO-слой всех страниц (S133).
 *
 * Подключается сразу после core.js + appearance.js на ВСЕХ страницах.
 * Проставляет:
 *   <link rel="canonical">  — по baseUrl + путь + ?id=
 *   og:* / twitter:*        — тип, заголовок, описание, картинка, URL, locale
 *   <meta name="description"> — если страница его не задала
 *   JSON-LD                 — Organization+SportsActivityLocation (все страницы),
 *                             Course (программа), Person (тренер),
 *                             NewsArticle (новость в модалке), ItemList (направление)
 *
 * Хост: SITE_DATA.siteSettings.baseUrl (дефолт https://центр-фр.рф, Р3).
 * Локальный прогон (python http.server / :3456): если baseUrl не задан явно —
 * fallback на location.origin, чтобы canonical не писал прод-домен на локальном стенде.
 *
 * По решению Р2 новость — это news.html?id=<id> с модалкой: такой URL
 * самодостаточен (self-canonical), og:type=article, NewsArticle. При закрытии
 * модалки страница возвращает URL к news.html — canonical/meta пересобираются
 * (перехват changeUrl через pushState/replaceState).
 *
 * По решению Р1 раздел тренеров называется «Коллектив» — подписи берутся из
 * SITE_DATA.sectionNames.trainers, литералов «Тренеры» здесь нет.
 */
(function () {
  'use strict';

  var DEFAULT_BASE_URL = 'https://центр-фр.рф';

  function data() { return window.SITE_DATA || {}; }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Абсолютный URL ресурса (картинка/лого) от baseUrl
  function absUrl(p) {
    if (!p) return '';
    if (/^https?:\/\//i.test(p) || p.indexOf('data:') === 0) return p;
    return baseUrl() + '/' + String(p).replace(/^\/+/, '');
  }

  // baseUrl: настройка → дефолт. На локальном стенде (не прод-хост) — location.origin,
  // иначе canonical/og укажут на прод с дев-данными.
  function baseUrl() {
    var b = String((data().siteSettings || {}).baseUrl || '').trim().replace(/\/+$/, '');
    if (!b) b = DEFAULT_BASE_URL;
    // локальный прогон: localhost/127.0.0.1/порт → свой origin
    var loc = location.hostname || '';
    if (/^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/.test(loc) || /:\d+$/.test(location.host)) {
      return location.origin;
    }
    return b;
  }

  function pageFile() {
    return (location.pathname.split('/').pop() || '') || 'index.html';
  }

  function param(name) {
    try { return new URLSearchParams(location.search).get(name); } catch (e) { return null; }
  }

  /* ============================================
     <link rel="canonical"> + og:* + twitter:*
     ============================================ */
  function upsertMeta(attr, key, content) {
    if (content == null || content === '') return;
    var sel = 'meta[' + attr + '="' + key + '"]';
    var el = document.head.querySelector(sel);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attr, key);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  }

  function upsertLink(rel, href) {
    var el = document.head.querySelector('link[rel="' + rel + '"]');
    if (!el) {
      el = document.createElement('link');
      el.setAttribute('rel', rel);
      document.head.appendChild(el);
    }
    el.setAttribute('href', href);
  }

  function selfUrl() {
    var page = pageFile() || 'index.html';
    var id = param('id');
    var url = param('url');
    if (id && (page === 'news.html' || page === 'program.html' || page === 'trainer.html' || page === 'directions.html')) {
      return baseUrl() + '/' + page + '?id=' + encodeURIComponent(id);
    }
    if (url && page === 'page.html') {
      return baseUrl() + '/' + page + '?url=' + encodeURIComponent(url);
    }
    return baseUrl() + '/' + page;
  }

  /* ============================================
     Сбор метаданных по типу страницы
     ============================================ */
  function collect() {
    var d = data();
    var brand = (window.SITE_BRAND || {}).title2 || (window.SITE_BRAND || {}).title1 || d.siteTitle || 'ЦФР';
    var page = pageFile();
    var out = {
      title: document.title || '',
      description: '',
      image: absUrl(((d.siteSettings || {}).logo) || ''),
      type: 'website',
      ld: []
    };

    // Organization + SportsActivityLocation — на каждой странице
    var c = d.contacts || {};
    var org = {
      '@context': 'https://schema.org',
      '@type': ['Organization', 'SportsActivityLocation'],
      'name': (d.siteSettings || {}).title1 || brand,
      'alternateName': (d.siteSettings || {}).title2 || '',
      'url': baseUrl() + '/index.html',
      'telephone': c.phone || '',
      'email': c.email || '',
      'address': c.address ? { '@type': 'PostalAddress', 'addressLocality': 'Екатеринбург', 'streetAddress': c.address } : undefined
    };
    if (out.image) org.logo = out.image;
    out.ld.push(org);

    if (page === 'index.html' || page === '') {
      out.description = (document.querySelector('meta[name="description"]') || {}).content || '';
      out.type = 'website';
      return out;
    }

    if (page === 'program.html') {
      var p = (d.programs || []).filter(function (x) { return String(x.id) === String(param('id')); })[0];
      if (p) {
        out.title = p.name + ' — ' + brand;
        out.description = plain(p.description).slice(0, 160);
        out.image = absUrl(p.image) || out.image;
        out.type = 'website';
        var course = {
          '@context': 'https://schema.org',
          '@type': 'Course',
          'name': p.name,
          'description': plain(p.description).slice(0, 300),
          'provider': { '@type': 'Organization', 'name': org.name, 'url': baseUrl() + '/index.html' }
        };
        if (p.image) course.image = absUrl(p.image);
        // offers — из блока стоимости (позиции, привязанные к программе)
        var items = (d.priceItems || []).filter(function (i) { return String(i.programId) === String(p.id); });
        if (items.length) {
          course.hasCourseInstance = {
            '@type': 'CourseInstance',
            'courseWorkload': items.map(function (i) {
              return { '@type': 'Offer', 'price': Number(i.price) || 0, 'priceCurrency': 'RUB',
                'name': i.title + (i.variant ? ' (' + i.variant + ')' : '') };
            })[0]
          };
        }
        // schedule — из scheduleStructured (день/время)
        var slots = (p.scheduleStructured || []).filter(function (s) { return s.day && s.time; });
        if (slots.length) {
          course.schedule = {
            '@type': 'Schedule',
            'repeatFrequency': 'P1W',
            'byDay': slots.map(function (s) { return dayISO(s.day); }).filter(Boolean),
            'byStart': slots[0].time.slice(0, 5),
            'byDuration': 'PT1H'
          };
        }
        out.ld.push(course);
      }
      return out;
    }

    if (page === 'trainer.html') {
      var t = (d.trainers || []).filter(function (x) { return String(x.id) === String(param('id')); })[0];
      if (t) {
        out.title = t.name + ' — ' + brand;
        out.description = plain(t.description).slice(0, 160) || t.specialization || '';
        out.image = absUrl(t.image) || out.image;
        out.type = 'profile';
        // Р1: jobTitle — из category/специализации; имя раздела — из sectionNames
        var person = {
          '@context': 'https://schema.org',
          '@type': 'Person',
          'name': t.name,
          'jobTitle': t.specialization || t.category || secName('trainers', 'Коллектив'),
          'description': plain(t.description).slice(0, 300),
          'worksFor': { '@type': 'Organization', 'name': org.name, 'url': baseUrl() + '/index.html' },
          'memberOf': { '@type': 'Organization', 'name': secName('trainers', 'Коллектив') }
        };
        if (t.image) person.image = absUrl(t.image);
        out.ld.push(person);
      }
      return out;
    }

    if (page === 'news.html') {
      var nid = param('id');
      var n = (d.newsAll || d.news || []).filter(function (x) { return String(x.id) === String(nid); })[0];
      if (n && nid) {
        // Р2: новость в модалке — самодостаточная страница
        var full = (d.newsFull || {})[n.id] || n.preview || '';
        out.title = n.title + ' — ' + secName('news', 'Новости центра') + ' — ' + brand;
        out.description = plain(full).slice(0, 160);
        out.image = absUrl(n.image) || out.image;
        out.type = 'article';
        out.ld.push({
          '@context': 'https://schema.org',
          '@type': 'NewsArticle',
          'headline': n.title,
          'datePublished': n.date || '',
          'dateModified': n.updatedAt || n.date || '',
          'image': n.image ? absUrl(n.image) : (out.image || undefined),
          'author': { '@type': 'Organization', 'name': org.name },
          'publisher': { '@type': 'Organization', 'name': org.name },
          'mainEntityOfPage': selfUrl(),
          'articleSection': secName('news', 'Новости центра'),
          'inLanguage': 'ru-RU'
        });
      } else {
        out.title = secName('news', 'Новости центра') + ' — ' + brand;
        out.type = 'website';
      }
      return out;
    }

    if (page === 'directions.html') {
      var dir = (d.directions || []).filter(function (x) { return String(x.id) === String(param('id')); })[0];
      if (dir) {
        var name = (dir.publicTitle || dir.name || '').trim();
        out.title = name + ' — ' + secName('programs', 'Наши тренировки') + ' — ' + brand;
        out.description = plain(dir.description).slice(0, 160);
        out.image = absUrl(dir.image) || out.image;
        out.type = 'website';
        out.ld.push({
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          'name': name,
          'itemListElement': (dir.programs || []).map(function (pr, i) {
            return {
              '@type': 'ListItem', 'position': i + 1,
              'url': baseUrl() + '/program.html?id=' + encodeURIComponent(pr.slug || pr.id),
              'name': pr.name
            };
          })
        });
      }
      return out;
    }

    if (page === 'page.html') {
      var pg = (d.pages || []).filter(function (x) { return String(x.url) === String(param('url')); })[0];
      if (pg) {
        out.title = pg.title + ' — ' + brand;
        out.description = plain(pg.text).slice(0, 160);
      }
      return out;
    }

    // Остальные страницы (trainers.html, programs.html, album.html и т.п.)
    return out;
  }

  // markdown → текст (для description)
  function plain(text) {
    if (window.MD && window.MD.plainText) return window.MD.plainText(text);
    return String(text || '').replace(/[#*_`~\[\]()!>|-]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  // Имя раздела — из справочника settings.sectionNames (Р1)
  function secName(id, fb) {
    var sn = data().sectionNames || {};
    var v = String(sn[id] == null ? '' : sn[id]).trim();
    return v || fb;
  }

  // День недели → schema.org день
  var DAY_MAP = {
    'понедельник': 'Monday', 'вторник': 'Tuesday', 'среда': 'Wednesday',
    'четверг': 'Thursday', 'пятница': 'Friday', 'суббота': 'Saturday', 'воскресенье': 'Sunday'
  };
  function dayISO(d) { return DAY_MAP[String(d).toLowerCase()] || ''; }

  /* ============================================
     Применение: canonical + og + JSON-LD
     ============================================ */
  var ldScript = null;
  function apply() {
    var meta = collect();
    var url = selfUrl();

    upsertLink('canonical', url);
    upsertMeta('property', 'og:type', meta.type);
    upsertMeta('property', 'og:title', meta.title);
    upsertMeta('property', 'og:description', meta.description);
    upsertMeta('property', 'og:url', url);
    upsertMeta('property', 'og:locale', 'ru_RU');
    upsertMeta('property', 'og:site_name', (data().siteSettings || {}).title1 || '');
    if (meta.image) upsertMeta('property', 'og:image', meta.image);
    upsertMeta('name', 'twitter:card', meta.image ? 'summary_large_image' : 'summary');
    upsertMeta('name', 'twitter:title', meta.title);
    upsertMeta('name', 'twitter:description', meta.description);
    if (meta.image) upsertMeta('name', 'twitter:image', meta.image);

    var descEl = document.querySelector('meta[name="description"]');
    if (meta.description) {
      if (!descEl) {
        descEl = document.createElement('meta');
        descEl.setAttribute('name', 'description');
        document.head.appendChild(descEl);
      }
      descEl.setAttribute('content', meta.description);
    }

    // одна <script type="application/ld+json"> на страницу
    if (!ldScript) {
      ldScript = document.createElement('script');
      ldScript.type = 'application/ld+json';
      document.head.appendChild(ldScript);
    }
    var ld = meta.ld.length === 1 ? meta.ld[0] : meta.ld;
    ldScript.textContent = JSON.stringify(ld).replace(/</g, '\\u003c');

    // title — только когда страница его сама не выставила (entity.js/news.html
    // ставят свой; здесь уточняем для news.html?id= и т.п.)
    if (meta.title && pageFile() === 'news.html') document.title = meta.title;
  }

  // Пересборка при смене URL без загрузки страницы:
  // news.html?id= открывает/закрывает модалку через history.replaceState —
  // canonical/meta должны пересобраться вслед за URL (Р2).
  function wrapHistory() {
    if (!window.history) return;
    ['pushState', 'replaceState'].forEach(function (fn) {
      var orig = history[fn];
      if (typeof orig !== 'function') return;
      history[fn] = function () {
        var r = orig.apply(history, arguments);
        try { apply(); } catch (e) { /* метаданные не критичны */ }
        return r;
      };
    });
    window.addEventListener('popstate', function () { try { apply(); } catch (e) {} });
  }

  window.SEO = { apply: apply, baseUrl: baseUrl, selfUrl: selfUrl };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { wrapHistory(); apply(); });
  } else {
    wrapHistory();
    apply();
  }
})();
