// Временный тест логики меню (jsdom). Запуск: node scripts/test-menu.mjs
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'static');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf-8');

const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true });
const { window } = dom;
const { document } = window;

window.scrollTo = () => {};
window.HTMLElement.prototype.scrollIntoView = function () {};

// Подключаем скрипты в том же порядке, что в index.html
const dataFiles = ['core', 'slider', 'schedule', 'prices', 'programs', 'trainers', 'news']
  .map(n => `js/data/${n}.js`);
for (const src of [...dataFiles, 'js/header.js', 'js/footer.js', 'js/modal.js', 'js/main.js']) {
  window.eval(fs.readFileSync(path.join(root, src), 'utf-8'));
}
document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));

const results = [];
const check = (name, cond) => results.push([cond ? '✓' : '✗', name, cond]);

// --- Разметка ---
const desktop = document.querySelectorAll('[data-dropdown]');
check('desktop dropdowns отрисованы (2: программы, коллектив)', desktop.length === 2);
check('у каждого есть .dropdown-toggle', [...desktop].every(d => !!d.querySelector('.dropdown-toggle')));
check('у каждого есть .dropdown-menu', [...desktop].every(d => !!d.querySelector('.dropdown-menu')));

const mgroups = document.querySelectorAll('[data-mgroup]');
check('mobile аккордеоны отрисованы (2: программы, коллектив)', mgroups.length === 2);
check('у каждого есть .m-group-list', [...mgroups].every(g => !!g.querySelector('.m-group-list')));

// Пункты внутри
const progItems = desktop[0].querySelectorAll('.dropdown-menu a');
check('в "Программы" есть пункты (1 + N)', progItems.length >= 2);
const collItems = desktop[1].querySelectorAll('.dropdown-menu a');
check('в "Коллектив" есть пункты (1 + N)', collItems.length >= 2);
check('mobile "Программы" раскрывается в список', mgroups[0].querySelectorAll('.m-group-list a').length >= 2);

// --- Клик по toggle открывает/закрывает ---
const toggle = desktop[0].querySelector('.dropdown-toggle');
toggle.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
check('клик открыл desktop-выпадашку (класс dropdown-open)', desktop[0].classList.contains('dropdown-open'));
check('aria-expanded=true', toggle.getAttribute('aria-expanded') === 'true');

toggle.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
check('повторный клик закрыл', !desktop[0].classList.contains('dropdown-open'));

// Открыл одну — вторая не открыта
toggle.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
desktop[1].querySelector('.dropdown-toggle').dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
check('одновременно открыта только одна', desktop[1].classList.contains('dropdown-open') && !desktop[0].classList.contains('dropdown-open'));

// Клик мимо шапки закрывает
document.body.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
check('клик мимо шапки закрыл всё', !document.querySelector('.dropdown.dropdown-open'));

// НЕТ inline-стилей display (главный баг прошлых версий)
const inlineDisplay = [...document.querySelectorAll('.dropdown-menu')].some(m => m.style.display !== '');
check('ни у одного .dropdown-menu нет inline display', !inlineDisplay);

// --- Mobile аккордеон ---
const mtoggle = mgroups[0].querySelector('.m-group-toggle');
mtoggle.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
check('клик открыл мобильный аккордеон', mgroups[0].classList.contains('open'));
mtoggle.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
check('повторный клик закрыл аккордеон', !mgroups[0].classList.contains('open'));

// --- Модалка ---
check('openCallModal определена', typeof window.openCallModal === 'function');
window.openCallModal('тест');
const overlay = document.getElementById('callOverlay');
check('модалка открыта (класс open)', overlay.classList.contains('open'));
document.getElementById('callCloseBtn').dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
check('крестик закрыл модалку', !overlay.classList.contains('open'));

window.openCallModal('тест2');
overlay.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
check('клик по фону закрыл модалку', !overlay.classList.contains('open'));

// Клик внутри окна НЕ должен закрывать
window.openCallModal('тест3');
const box = document.querySelector('.modal-box');
box.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
check('клик внутри окна НЕ закрывает', overlay.classList.contains('open'));

// Кнопки у программ и тренеров
check('у программ есть кнопка "Подробнее"', !!document.querySelector('#programs-grid .program-btn-secondary'));
check('у тренеров есть кнопка "Подробнее"', !!document.querySelector('#trainers-grid .trainer-btn-secondary'));

// Итог
let failed = 0;
for (const [icon, name, ok] of results) {
  if (!ok) failed++;
  console.log(`${icon} ${name}`);
}
console.log(`\n${results.length - failed}/${results.length} пройдено`);
process.exit(failed ? 1 : 0);
