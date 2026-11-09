import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';
const staticDir = 'static';
function loadPage(htmlFile, query = '') {
  const html = fs.readFileSync(path.join(staticDir, htmlFile), 'utf-8');
  const dom = new JSDOM(html, { url: 'http://localhost/' + htmlFile + query, runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;
  const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1].replace(/\?.*$/, '')).filter(s => !/^https?:/.test(s));
  for (const s of scripts) {
    const file = path.join(staticDir, s);
    if (!fs.existsSync(file)) throw new Error(`нет скрипта ${s}`);
    window.eval(fs.readFileSync(file, 'utf-8'));
  }
  window.document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));
  return window;
}
for (const q of ['?id=dir-0', '?id=dir-ind', '?id=dir-4', '?id=nope']) {
  const w = loadPage('directions.html', q);
  const d = w.document;
  const m = d.getElementById('direction-page');
  console.log('───', q);
  console.log('  title:', d.title);
  console.log('  h1:', (m.querySelector('h1')||{}).textContent);
  console.log('  crumbs:', [...d.querySelectorAll('.crumbs .crumb')].map(x=>x.textContent).join(' → '));
  console.log('  count block:', (m.querySelector('.direction-count')||{}).textContent);
  console.log('  tiles:', m.querySelectorAll('.tile').length, 'trainers tiles:', m.querySelectorAll('.tile-trainer').length);
  console.log('  prices:', !!m.querySelector('.entity-prices'), 'schedule:', !!m.querySelector('.week-board'), 'cta:', !!m.querySelector('.direction-cta'), 'related:', m.querySelectorAll('.direction-related-item').length);
  console.log('  cross-links:', d.querySelectorAll('.cross-links .cross-link').length);
  console.log('  md rendered (no raw **):', !/\*\*|\\n/.test(m.innerHTML));
  const errs = [];
  try { if (w.openCallModal) w.openCallModal('test'); } catch(e){ errs.push(e.message); }
  console.log('  openCallModal:', errs.length ? 'ERROR '+errs[0] : 'ok', 'modal root:', !!d.getElementById('callModalRoot'));
}
