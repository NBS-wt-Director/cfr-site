/**
 * scripts/lib/slug.mjs — транслитерация ФИО/названий в URL-якорь (S18).
 *
 * Совпадает с browser-версией static/js/slug.js.
 * Регресс-тест S18 проверяет эквивалентность двух реализаций.
 *
 * Правила:
 *   - кириллица → латиница (таблица ниже), ё→e, й→i, ы→y, щ→sch;
 *   - всё, что не [a-z0-9], становится «-»; подряд идущие «-» сворачиваются;
 *   - ведущие/замыкающие «-» срезаются.
 */

const MAP = {
  'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e',
  'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'i', 'к': 'k', 'л': 'l', 'м': 'm',
  'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
  'ф': 'f', 'х': 'kh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch',
  'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
};

/**
 * Транслитерация строки в URL-slug.
 * @param {string} str
 * @returns {string}
 */
export function slugify(str) {
  const s = String(str == null ? '' : str).toLowerCase();
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    out += MAP[ch] !== undefined ? MAP[ch] : ch;
  }
  return out
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
