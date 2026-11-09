/**
 * scripts/lib/sitemap.mjs — генерация sitemap.xml и robots.txt из данных сайта.
 *
 * S133: sitemap и robots — производные от db.json, а не рукописные файлы.
 * Общий модуль для export-static.mjs (запись static/sitemap.xml, static/robots.txt)
 * и admin-server.mjs (маршруты GET /sitemap.xml, GET /robots.txt с генерацией на лету).
 *
 * Хост: siteSettings.baseUrl (дефолт https://центр-фр.рф, решение Р3).
 * В <loc> и Sitemap: домен пишется punycode (требование протокола sitemap)
 * через url.domainToASCII() — оба варианта не хардкодятся.
 */
import { domainToASCII } from 'url';
import { slugify } from './slug.mjs';

export const DEFAULT_BASE_URL = 'https://центр-фр.рф';

// Нормализация baseUrl: https://, без завершающего /, без пути/query
export function normalizeBaseUrl(raw) {
  const v = String(raw == null ? '' : raw).trim().replace(/\/+$/, '');
  if (!v) return DEFAULT_BASE_URL;
  return /^https:\/\//i.test(v) ? v : DEFAULT_BASE_URL;
}

// Punycode-хост из baseUrl (для <loc> и Sitemap:)
function asciiHost(baseUrl) {
  try {
    const u = new URL(baseUrl);
    const ascii = domainToASCII(u.hostname);
    if (!ascii) throw new Error('empty');
    return u.protocol + '//' + ascii + (u.port ? ':' + u.port : '');
  } catch {
    return DEFAULT_BASE_URL;
  }
}

// Экранирование XML-текста (& < > " ')
export function escXml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ISO-дата для <lastmod> (ГгГг-ММ-ДД)
function lastmodOf(value) {
  const s = String(value == null ? '' : value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}

/**
 * Сбор публичных URL из плоских данных (то, что уже отфильтровано экспортёром:
 * скрытые сущности сюда не попадают).
 * @param {object} db flattenDb(db.json)
 * @param {string} buildDateISO дата сборки (fallback для lastmod)
 * @returns {{ loc: string, lastmod: string, changefreq: string, priority: string }[]}
 */
export function collectUrls(db, buildDateISO) {
  const host = asciiHost(normalizeBaseUrl(db.siteSettings && db.siteSettings.baseUrl));
  const fallback = lastmodOf(buildDateISO) || new Date().toISOString().slice(0, 10);
  const urls = [];
  const push = (path, lastmod, changefreq, priority) => {
    urls.push({ loc: host + '/' + path, lastmod: lastmod || fallback, changefreq, priority });
  };

  // Главная
  push('index.html', fallback, 'weekly', '1.0');

  // Общие страницы
  const visible = (db.homeSections || []).filter(s => !s || s.visible !== false);
  const isVisible = (id) => !visible.length || visible.some(s => s.id === id);
  if (isVisible('trainers')) push('trainers.html', fallback, 'weekly', '0.8');
  if (isVisible('programs')) push('programs.html', fallback, 'weekly', '0.8');
  if (isVisible('news')) push('news.html', fallback, 'weekly', '0.8');

  // Направления (уже отфильтрованы: !hidden, непустой состав — как в navDirections)
  (db.directions || []).filter(d => !d.hidden && (d.programs || []).length > 0)
    .forEach(d => push('directions.html?id=' + encodeURIComponent(d.id), fallback, 'weekly', '0.7'));

  // Видимые программы (lastmod — updatedAt программы, дефолт — дата сборки).
  // S18: slug = имя «как записано» (кириллицей). Берём slugify(name) —
  // flattenDb(db.json) поля slug не имеет, он вычисляется здесь же, где и в экспорте.
  (db.programs || []).filter(p => !p.hidden)
    .forEach(p => push('program.html?id=' + encodeURIComponent(slugify(p.name) || p.id),
      lastmodOf(p.updatedAt), 'monthly', '0.6'));

  // Видимые тренеры
  (db.trainers || []).filter(t => !t.hidden)
    .forEach(t => push('trainer.html?id=' + encodeURIComponent(slugify(t.name) || t.id),
      fallback, 'monthly', '0.6'));

  // Все новости (включая showOnHome:false — они есть на news.html).
  // По решению Р2 новость — это news.html?id=<id> с модалкой, URL допустим
  // только вместе с self-canonical (см. static/js/seo.js).
  (db.news || [])
    .slice()
    .sort((a, b) => String(a.date || '') < String(b.date || '') ? 1 : -1)
    .forEach(n => push('news.html?id=' + encodeURIComponent(n.id),
      lastmodOf(n.date || n.updatedAt), 'monthly', '0.5'));

  // Видимые статические страницы (slug уже ASCII — транслит в sanitizePages, S120)
  (db.pages || []).filter(p => p && p.visible !== false && p.url)
    .forEach(p => push('page.html?url=' + encodeURIComponent(p.url),
      fallback, 'monthly', '0.5'));

  // НЕ включаются: admin.html, lk.html, crm.html, album.html, 404.html, 500.html,
  // скрытые сущности (фильтр выше).

  return urls;
}

/**
 * Генерация содержимого sitemap.xml (urlset, без индекса — URL < 50 000;
 * при росте — sitemap-<раздел>.xml + sitemapIndex).
 */
export function renderSitemap(db, buildDateISO) {
  const urls = collectUrls(db, buildDateISO);
  const body = urls.map(u =>
    '  <url>\n' +
    '    <loc>' + escXml(u.loc) + '</loc>\n' +
    (u.lastmod ? '    <lastmod>' + u.lastmod + '</lastmod>\n' : '') +
    '    <changefreq>' + u.changefreq + '</changefreq>\n' +
    '    <priority>' + u.priority + '</priority>\n' +
    '  </url>'
  ).join('\n');
  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    body + '\n</urlset>\n';
}

/**
 * Генерация содержимого robots.txt.
 * Sitemap: — тот же punycode-хост, что в <loc>.
 */
export function renderRobots(db, buildDateISO) {
  const host = asciiHost(normalizeBaseUrl(db.siteSettings && db.siteSettings.baseUrl));
  return 'User-agent: *\n' +
    'Allow: /\n' +
    'Disallow: /admin.html\n' +
    'Disallow: /lk.html\n' +
    'Disallow: /crm.html\n' +
    'Sitemap: ' + host + '/sitemap.xml\n';
}
