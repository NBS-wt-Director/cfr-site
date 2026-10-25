#!/usr/bin/env node
/**
 * scripts/merge-db-structures.mjs
 *
 * Безопасное слияние структур db.json:
 *   - Старые ключи из dev остаются без изменений
 *   - Новые ключи из prod добавляются с пустыми значениями
 *   - Существующие данные НЕ перезаписываются
 *   - Генерируется отчёт о различиях
 *
 * Использование:
 *   node scripts/merge-db-structures.mjs <prod-db.json> <dev-db.json> <output-db.json>
 *
 * Пример:
 *   node scripts/merge-db-structures.mjs db-prod-sync.json db.json db-merged.json
 */

import fs from 'fs';
import path from 'path';

// ============================================
// Утилиты
// ============================================

function parseArgs() {
  const args = process.argv.slice(2);
  if (args.length < 3 || args.includes('-h') || args.includes('--help')) {
    console.log(`
Безопасное слияние структур db.json.

Использование:
  node scripts/merge-db-structures.mjs <prod-db.json> <dev-db.json> <output-db.json>

Пример:
  node scripts/merge-db-structures.mjs db-prod-sync.json db.json db-merged.json

Правила слияния:
  1. Ключи из dev остаются без изменений (данные не перезаписываются)
  2. Новые ключи из prod добавляются с пустыми значениями
  3. Существующие данные НЕ затрагиваются
  4. Вложенные объекты: рекурсивное слияние по ключам
`);
    process.exit(args.length < 3 ? 1 : 0);
  }

  return {
    prodFile: args[0],
    devFile: args[1],
    outputFile: args[2]
  };
}

function loadJSON(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch (err) {
    console.error(`❌ Ошибка чтения ${file}: ${err.message}`);
    process.exit(1);
  }
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function defaultValueForType(value) {
  if (Array.isArray(value)) return [];
  if (isPlainObject(value)) return {};
  if (typeof value === 'string') return '';
  if (typeof value === 'number') return 0;
  if (typeof value === 'boolean') return false;
  return null;
}

// ============================================
// Основная логика
// ============================================

async function main() {
  const { prodFile, devFile, outputFile } = parseArgs();

  console.log('📦 Загрузка файлов:');
  console.log('   Prod:', prodFile);
  console.log('   Dev :', devFile);

  const prodDb = loadJSON(prodFile);
  const devDb = loadJSON(devFile);

  console.log('\n📊 Структура prod:', Object.keys(prodDb).length, 'ключей');
  console.log('   Структура dev:', Object.keys(devDb).length, 'ключей');

  // Слияние
  console.log('\n🔀 Слияние структур...');
  const merged = mergeStructures(prodDb, devDb);

  // Отчёт
  console.log('\n📝 Отчёт о слиянии:');
  const report = generateReport(devDb, prodDb, merged);
  printReport(report);

  // Сохранение
  const outPath = path.resolve(outputFile);
  try {
    fs.writeFileSync(outPath, JSON.stringify(merged, null, 2), 'utf-8');
    console.log(`\n💾 Сохранено в: ${outPath}`);
  } catch (err) {
    console.error('❌ Ошибка записи:', err.message);
    process.exit(1);
  }

  console.log('\n✅ Готово!');
}

/**
 * Рекурсивное слияние структур:
 * - dev имеет приоритет (данные не перезаписываются)
 * - Новые ключи из prod добавляются с пустыми значениями
 */
function mergeStructures(prodDb, devDb) {
  const merged = { ...devDb };

  for (const [key, prodValue] of Object.entries(prodDb)) {
    if (key in merged) {
      // Ключ уже есть — рекурсивное слияние для объектов
      if (isPlainObject(prodValue) && isPlainObject(merged[key])) {
        merged[key] = mergeStructures(prodValue, merged[key]);
      }
      // Массивы и примитивы — не трогаем (dev приоритет)
    } else {
      // Новый ключ из prod — добавляем с пустым значением
      merged[key] = defaultValueForType(prodValue);
    }
  }

  return merged;
}

/**
 * Генерация отчёта о различиях структур
 */
function generateReport(devDb, prodDb, merged) {
  const report = {
    added: [],        // новые ключи из prod
    removed: [],      // ключи из dev, которых нет в prod
    changedType: [],  // изменён тип данных
    changedSize: [],  // изменён размер массивов
    nestedAdded: [],  // новые вложенные ключи
    nestedRemoved: [],// удалённые вложенные ключи
  };

  const devKeys = new Set(Object.keys(devDb));
  const prodKeys = new Set(Object.keys(prodDb));

  // Добавлено в prod (есть в prod, нет в dev)
  for (const k of prodKeys) {
    if (!devKeys.has(k)) {
      report.added.push({
        key: k,
        type: describeType(prodDb[k]),
        value: prodDb[k]
      });
    }
  }

  // Удалено из prod (есть в dev, нет в prod)
  for (const k of devKeys) {
    if (!prodKeys.has(k)) {
      report.removed.push({
        key: k,
        type: describeType(devDb[k]),
        value: devDb[k]
      });
    }
  }

  // Изменён тип данных
  for (const k of devKeys) {
    if (prodKeys.has(k) && typeof devDb[k] !== typeof prodDb[k]) {
      report.changedType.push({
        key: k,
        from: typeof devDb[k],
        to: typeof prodDb[k]
      });
    }
  }

  // Изменён размер массивов
  for (const k of devKeys) {
    if (prodKeys.has(k)) {
      const isDevArray = Array.isArray(devDb[k]);
      const isProdArray = Array.isArray(prodDb[k]);
      if (isDevArray && isProdArray && devDb[k].length !== prodDb[k].length) {
        report.changedSize.push({
          key: k,
          from: devDb[k].length,
          to: prodDb[k].length
        });
      }
    }
  }

  // Вложенные ключи (в объектах)
  for (const [parentKey, parentProd] of Object.entries(prodDb)) {
    if (!isPlainObject(parentProd)) continue;
    if (!isPlainObject(devDb[parentKey])) continue;

    const devChildKeys = new Set(Object.keys(devDb[parentKey]));
    const prodChildKeys = new Set(Object.keys(parentProd));

    for (const k of prodChildKeys) {
      if (!devChildKeys.has(k)) {
        report.nestedAdded.push({
          parent: parentKey,
          key: k,
          type: describeType(parentProd[k])
        });
      }
    }

    for (const k of devChildKeys) {
      if (!prodChildKeys.has(k)) {
        report.nestedRemoved.push({
          parent: parentKey,
          key: k,
          type: describeType(devDb[parentKey][k])
        });
      }
    }
  }

  return report;
}

function describeType(value) {
  if (Array.isArray(value)) return `массив (${value.length} шт.)`;
  if (isPlainObject(value)) return `объект (${Object.keys(value).length} ключей)`;
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  return typeof value;
}

function printReport(report) {
  // Добавлено
  if (report.added.length) {
    console.log('\n🆕 Добавлено полей:');
    for (const item of report.added) {
      console.log(`   + ${item.key}: ${item.type}`);
    }
  } else {
    console.log('\n🆕 Добавлено полей: (нет)');
  }

  // Удалено
  if (report.removed.length) {
    console.log('\n🗑 Удалено полей:');
    for (const item of report.removed) {
      console.log(`   - ${item.key}: ${item.type}`);
    }
  } else {
    console.log('\n🗑 Удалено полей: (нет)');
  }

  // Изменён тип
  if (report.changedType.length) {
    console.log('\n⚠️ Изменён тип данных:');
    for (const item of report.changedType) {
      console.log(`   ~ ${item.key}: ${item.from} → ${item.to}`);
    }
  }

  // Изменён размер
  if (report.changedSize.length) {
    console.log('\n📏 Изменён размер массивов:');
    for (const item of report.changedSize) {
      console.log(`   ~ ${item.key}: ${item.from} → ${item.to}`);
    }
  }

  // Вложенные добавлено
  if (report.nestedAdded.length) {
    console.log('\n🆕 Новые вложенные поля:');
    for (const item of report.nestedAdded) {
      console.log(`   + ${item.parent}.${item.key}: ${item.type}`);
    }
  }

  // Вложенные удалено
  if (report.nestedRemoved.length) {
    console.log('\n🗑 Удалённые вложенные поля:');
    for (const item of report.nestedRemoved) {
      console.log(`   - ${item.parent}.${item.key}: ${item.type}`);
    }
  }
}

main().catch(err => {
  console.error('❌ Неожиданная ошибка:', err);
  process.exit(1);
});
