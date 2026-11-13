// S163: вставка пикселя учёта посещаемости перед </body> на страницах сайта
import fs from 'fs';
import path from 'path';

const files = ['album', 'crm', 'directions', 'index', 'lk', 'news',
  'page', 'program', 'programs', 'trainer', 'trainers'];

const TAG = '<script src="js/visit-tracker.js?v=50"></script>';
let added = 0;

for (const f of files) {
  const p = path.join('static', `${f}.html`);
  let content = fs.readFileSync(p, 'utf-8');
  if (content.includes('visit-tracker.js')) { console.log('— уже есть:', f); continue; }
  if (!content.includes('</body>')) { console.log('✗ нет </body>:', f); continue; }
  content = content.replace('</body>', `  ${TAG}\n</body>`);
  fs.writeFileSync(p, content, 'utf-8');
  added++;
  console.log('✓', f);
}
console.log(`\nВставлено в ${added} файлов`);
