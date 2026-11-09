import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { JSDOM } from 'jsdom';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const staticDir = path.join(__dirname, '..', 'static');

function loadIndex() {
  const html = fs.readFileSync(path.join(staticDir, 'index.html'), 'utf-8');
  const dom = new JSDOM(html, { url: 'http://localhost/index.html', runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;
  const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1].replace(/\?.*$/, '')).filter(s => !/^https?:/.test(s));
  for (const s of scripts) {
    const file = path.join(staticDir, s);
    if (!fs.existsSync(file)) { console.log('MISSING', s); continue; }
    try { window.eval(fs.readFileSync(file, 'utf-8')); } catch(e) { console.log('EVAL FAIL', s, e.message); }
  }
  window.document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));
  return window;
}

const w = loadIndex();
const d = w.document;

function log(name) {
  const grid = d.getElementById('schedule-grid');
  const table = d.getElementById('schedule-table-view');
  const toggle = d.getElementById('schedule-switch');
  console.log(`\n--- ${name} ---`);
  console.log('switch hidden :', toggle ? toggle.hidden : 'no el');
  console.log('grid   hidden :', grid ? grid.hidden : 'no el', '| children:', grid ? grid.children.length : '-');
  console.log('table  hidden :', table ? table.hidden : 'no el', '| html len:', table ? table.innerHTML.length : '-');
  const active = toggle ? [...toggle.querySelectorAll('.schedule-switch-btn')].filter(b => b.classList.contains('active')).map(b => b.dataset.view) : [];
  console.log('active btn    :', active.join(','));
}

log('после загрузки (defaultView=hybrid, hybridActiveTab=images)');

// Клик по «Таблица»
const btnTable = d.querySelector('#schedule-switch .schedule-switch-btn[data-view="table"]');
if (btnTable) {
  btnTable.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  log('после клика «Таблица»');
} else {
  console.log('Кнопка «Таблица» не найдена!');
}

// Цены
const pg = d.getElementById('prices-grid');
console.log('\n=== prices-grid ===');
console.log('children count:', pg ? pg.children.length : 'no el');
if (pg) {
  const priceGroups = pg.querySelectorAll('.price-group');
  console.log('.price-group count:', priceGroups.length);
  const priceRows = pg.querySelectorAll('.price-row');
  console.log('.price-row count:', priceRows.length);
  const priceDiscounts = pg.querySelector('.price-discounts');
  console.log('.price-discounts found:', !!priceDiscounts);
  if (priceDiscounts) {
    const discTiles = priceDiscounts.querySelectorAll('.price-discount');
    console.log('discount tiles:', discTiles.length);
    [...discTiles].forEach((t, i) => {
      console.log(`  [${i}] class="${t.className}" title="${t.querySelector('.price-discount-title')?.textContent?.trim() || ''}"`);
    });
  }
}

process.exit(0);
