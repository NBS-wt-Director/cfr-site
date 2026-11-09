#!/usr/bin/env node
/**
 * gen-direction-descriptions.mjs — S140
 *
 * Для каждого видимого направления без описания генерирует краткое описание
 * на основе описаний входящих программ (эвристика, без LLM).
 *
 * Использование:
 *   node scripts/gen-direction-descriptions.mjs [--dry-run] [--verbose]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { flattenDb } from './db-format.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const dryRun = process.argv.includes('--dry-run');
const verbose = process.argv.includes('--verbose');

const dbPath = path.join(root, 'db.json');
const db = flattenDb(JSON.parse(fs.readFileSync(dbPath, 'utf-8')));

const directions = (db.directions || []).filter(d => !d.hidden);
const programs = (db.programs || []).filter(p => !p.hidden);

// Получить программы направления
function dirPrograms(dir) {
  return (dir.programs || [])
    .map(dp => programs.find(p => String(p.id) === String(dp.id)))
    .filter(Boolean);
}

// Собрать уникальные возрастные диапазоны
function extractAges(text) {
  const ages = [];
  const re = /(\d+)\s*[-–—]\s*(\d+)\s*(?:лет|год|возр)/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    ages.push(m[1] + '-' + m[2]);
  }
  // Простые "с N лет" / "N+"
  const re2 = /(?:с|от)\s*(\d+)\s*(?:лет|год)/gi;
  while ((m = re2.exec(text)) !== null) {
    if (!ages.includes(m[1] + '+')) ages.push(m[1] + '+');
  }
  return [...new Set(ages)];
}

// Первое предложение из markdown-текста
function firstSentence(md) {
  const plain = String(md || '')
    .replace(/[#*_~`>\[\]()!-]/g, ' ')
    .replace(/\n+/g, '. ')
    .replace(/\.\s*\./g, '.')
    .trim();
  const idx = plain.indexOf('. ');
  return idx > 0 ? plain.slice(0, idx + 1) : (plain.length > 120 ? plain.slice(0, 120) + '…' : plain);
}

// Эвристическая генерация описания направления
function genDescription(dir, progs) {
  if (!progs.length) return '';

  const name = dir.publicTitle || dir.name || '';
  const parts = [];

  // 1. Общее вступление
  parts.push(name + ' — ' + progs.length + ' ' + pluralize(progs.length, 'программа', 'программы', 'программ') + ' центра.');

  // 2. Возрастные диапазоны (если есть)
  const allText = progs.map(p => p.description || '').join(' ');
  const ages = extractAges(allText);
  if (ages.length) {
    parts.push('Занятия для возрастов: ' + ages.join(', ') + '.');
  }

  // 3. Первые предложения из описаний программ (до 2, самые содержательные)
  const sentences = progs
    .map(p => firstSentence(p.description))
    .filter(s => s && s.length > 20)
    .slice(0, 2);
  if (sentences.length) {
    parts.push(sentences.join(' '));
  }

  // 4. Перечисление программ
  const names = progs.map(p => p.name).filter(Boolean);
  if (names.length) {
    parts.push('В направлении: ' + names.join(', ') + '.');
  }

  return parts.filter(Boolean).join('\n\n');
}

function pluralize(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}

// Основной проход
let changed = 0;
for (const dir of directions) {
  const desc = String(dir.description || '').trim();
  if (desc) {
    if (verbose) console.log('⏭  %s — описание уже есть, пропускаю', dir.id);
    continue;
  }
  const progs = dirPrograms(dir);
  if (!progs.length) {
    if (verbose) console.log('⏭  %s — нет программ, пропускаю', dir.id);
    continue;
  }
  const generated = genDescription(dir, progs);
  if (!generated) {
    if (verbose) console.log('⏭  %s — нечего генерировать', dir.id);
    continue;
  }

  console.log('📝 %s (%s):', dir.id, dir.publicTitle || dir.name);
  console.log(generated);
  console.log('');

  if (!dryRun) {
    dir.description = generated;
    changed++;
  }
}

if (!dryRun && changed) {
  // Запись обратно в db.json (вложенный формат)
  const nested = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
  // directions в settings (вложенный формат) или на верхнем уровне (плоский)
  if (nested.data) {
    // Плоский → ищем в data
    const idx = (nested.data.directions || []).findIndex(d => d.id === undefined); // fallback
    // directions обычно в settings.directions вложенного формата
    if (nested.settings && Array.isArray(nested.settings.directions)) {
      for (const dir of directions) {
        const target = nested.settings.directions.find(d => d.id === dir.id);
        if (target && !String(target.description || '').trim()) {
          target.description = dir.description;
        }
      }
    }
  } else if (Array.isArray(nested.directions)) {
    // Плоский формат
    for (const dir of directions) {
      const target = nested.directions.find(d => d.id === dir.id);
      if (target && !String(target.description || '').trim()) {
        target.description = dir.description;
      }
    }
  }

  fs.writeFileSync(dbPath, JSON.stringify(nested, null, 2) + '\n', 'utf-8');
  console.log('✅ Обновлено %d направлени(й).', changed);
} else if (!dryRun) {
  console.log('ℹ️  Нечего обновлять — все направления с описаниями или пусты без программ.');
} else {
  console.log('🔍 DRY RUN — изменения не записаны. Уберите --dry-run для применения.');
}
