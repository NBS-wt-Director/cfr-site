#!/usr/bin/env node

/**
 * extract-donor.mjs — Извлечение структуры и сводок из XML-файлов DanceStudio
 * 
 * Читает все XML-файлы в данных/_DB/ (кроме Files/, LastSave/, Options/)
 * и сохраняет:
 *   - данные/DB/json_schema.json — полная схема всех сущностей
 *   - данные/DB/json_summary.json — сводка по каждой сущности
 *   - данные/DB/client_uuids.json — список UUID клиентов
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { XMLParser } from 'fast-xml-parser';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', 'данные', '_DB');
const OUT_DIR = join(__dirname, '..', 'данные', 'DB');

// Исключаемые директории
const EXCLUDE_DIRS = new Set(['Files', 'LastSave', 'Options']);

// Сегментированные сущности
const SEGMENT_MAP = ['SingleTraining', 'Account', 'Client'];

// ==================== Утилиты ====================

function getEntityBase(filename) {
  const base = basename(filename, '.xml');
  for (const entityName of SEGMENT_MAP) {
    if (base === entityName) return entityName;
    if (base.startsWith(entityName) && /^\d+$/.test(base.slice(entityName.length))) {
      return entityName;
    }
  }
  return base;
}

function isDataXml(filepath, filename) {
  const st = statSync(filepath);
  if (!st.isFile()) return false;
  if (!filename.endsWith('.xml')) return false;
  const dir = basename(dirname(filepath));
  if (EXCLUDE_DIRS.has(dir)) return false;
  return true;
}

function detectType(value) {
  if (!value || String(value).trim() === '') return 'empty';
  const s = String(value).trim();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) return 'UUID';
  if (/^(true|false|True|False)$/i.test(s)) return 'boolean';
  if (/^-?\d+$/.test(s)) return 'integer';
  if (/^-?\d+\.\d+$/.test(s)) return 'float';
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(s)) return 'date (DD.MM.YYYY)';
  if (/^\d{2}\.\d{2}\.\d{4} \d{2}:\d{2}:\d{2}$/.test(s)) return 'datetime';
  return 'string';
}

// ==================== Парсер ====================

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  trimValues: true,
  arrayMode: false,
  cdataPositionKey: '@_cdata',
});

/**
 * Извлекает все Item-элементы верхнего уровня из парсера.
 */
function extractTopLevelItems(parsedData, rootTag) {
  if (!parsedData || !parsedData[rootTag]) return [];
  const topLevel = parsedData[rootTag];
  const result = [];
  
  if (Array.isArray(topLevel.Item)) {
    result.push(...topLevel.Item);
  } else if (topLevel.Item) {
    result.push(topLevel.Item);
  }
  
  return result;
}

/**
 * Извлекает поля из одного Item (без вложенных Item).
 */
function extractFieldsFromItem(item) {
  const fields = {};
  if (!item || typeof item !== 'object') return fields;
  
  for (const [key, value] of Object.entries(item)) {
    if (key === '$' || key === '@' || key.startsWith('@_')) continue;
    // Пропускаем вложенные Item
    if (key === 'Item') continue;
    // Пропускаем массивы вложенных Item
    if (Array.isArray(value) && value.length > 0 && value[0] && value[0].Item) continue;
    
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      fields[key] = String(value);
    } else if (typeof value === 'object' && value !== null) {
      // Поле с атрибутами: { "#text": "value", "@_Updated": "..." }
      if (value['#text'] !== undefined) {
        fields[key] = String(value['#text']);
      } else if (value['@_cdata'] !== undefined) {
        fields[key] = String(value['@_cdata']);
      } else if (value.content !== undefined) {
        fields[key] = String(value.content);
      } else {
        // Вложенная структура без текстового значения — пропускаем
        continue;
      }
    }
  }
  
  return fields;
}

/**
 * Парсит один XML-файл.
 */
function parseXmlFile(filepath) {
  const content = readFileSync(filepath, 'utf-8');
  
  let parsed;
  try {
    parsed = parser.parse(content);
  } catch (e) {
    return { error: `XML parse error: ${e.message}` };
  }
  
  const rootKeys = Object.keys(parsed).filter(k => k !== '?xml');
  if (rootKeys.length === 0) return { error: 'Empty XML' };
  const rootTag = rootKeys[0];
  
  const items = extractTopLevelItems(parsed, rootTag);
  
  // Анализируем первые 20 записей для структуры
  const samples = [];
  const fieldInfo = {};
  const totalItems = items.length;
  
  for (let i = 0; i < Math.min(items.length, 20); i++) {
    const item = items[i];
    const fields = extractFieldsFromItem(item);
    
    samples.push({
      attrs: item['@_'] || {},
      fields,
    });
    
    for (const [fname, fvalue] of Object.entries(fields)) {
      if (!fieldInfo[fname]) {
        fieldInfo[fname] = { types: new Set(), sampleValue: fvalue };
      }
      fieldInfo[fname].types.add(detectType(fvalue));
      if (!fieldInfo[fname].sampleValue && fvalue) {
        fieldInfo[fname].sampleValue = fvalue;
      }
    }
  }
  
  return {
    rootTag,
    itemTag: 'Item',
    totalItems,
    samples,
    fieldInfo,
  };
}

// ==================== Главный анализ ====================

function analyzeAll() {
  console.log('📂 Сканирование директории:', ROOT);
  
  const files = readdirSync(ROOT).filter(f => {
    const fp = join(ROOT, f);
    return isDataXml(fp, f);
  });
  
  console.log(`📄 Найдено XML-файлов: ${files.length}`);
  
  // Группируем по сущностям
  const entityFiles = {};
  for (const file of files) {
    const entity = getEntityBase(file);
    if (!entityFiles[entity]) entityFiles[entity] = [];
    entityFiles[entity].push(file);
  }
  
  console.log(`📦 Найдено сущностей: ${Object.keys(entityFiles).length}`);
  
  const schema = {};
  const summary = {};
  const clientUuids = new Set();
  
  // UUID клиентов — используем regex для скорости
  console.log('\n🔍 Извлечение UUID клиентов...');
  for (const fileName of ['Client.xml', 'Client001.xml']) {
    const filepath = join(ROOT, fileName);
    if (!existsSync(filepath)) continue;
    const content = readFileSync(filepath, 'utf-8');
    const idRegex = /<ID>([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})<\/ID>/gi;
    let match;
    while ((match = idRegex.exec(content)) !== null) {
      clientUuids.add(match[1]);
    }
  }
  console.log(`   UUID клиентов найдено: ${clientUuids.size}`);
  
  // Обрабатываем каждую сущность
  for (const [entityName, fileNames] of Object.entries(entityFiles)) {
    console.log(`  ⏳ ${entityName} (${fileNames.length} файлов)`);
    
    let totalItems = 0;
    const allFieldNames = new Set();
    const fieldTypes = {};
    const fieldSampleValues = {};
    let rootTag = entityName;
    
    for (const fileName of fileNames) {
      const filepath = join(ROOT, fileName);
      const parsed = parseXmlFile(filepath);
      
      if (parsed.error) {
        console.warn(`    ⚠️ ${fileName}: ${parsed.error}`);
        continue;
      }
      
      if (!rootTag) rootTag = parsed.rootTag;
      totalItems += parsed.totalItems;
      
      for (const [fname, info] of Object.entries(parsed.fieldInfo)) {
        allFieldNames.add(fname);
        if (!fieldTypes[fname]) {
          const nonEmpty = [...info.types].find(t => t !== 'empty');
          fieldTypes[fname] = nonEmpty || 'string';
        }
        if (!fieldSampleValues[fname] && info.sampleValue) {
          fieldSampleValues[fname] = info.sampleValue;
        }
      }
    }
    
    // Схема
    const fieldsSchema = Array.from(allFieldNames).map(name => ({
      name,
      type: fieldTypes[name] || 'unknown',
    }));
    
    schema[entityName.toLowerCase()] = {
      root_tag: rootTag,
      item_tag: 'Item',
      fields: fieldsSchema,
      source_files: fileNames,
    };
    
    // Сводка
    summary[entityName.toLowerCase()] = {
      record_count: totalItems,
      fields: Array.from(allFieldNames).sort(),
      field_types: fieldTypes,
      sample_values: fieldSampleValues,
      source_files: fileNames,
    };
    
    console.log(`    ✅ ${totalItems} записей, ${allFieldNames.size} полей`);
  }
  
  return { schema, summary, clientUuids };
}

// ==================== Главная ====================

function main() {
  console.log('🚀 Extract Donor XML → JSON\n');
  
  if (!existsSync(OUT_DIR)) {
    mkdirSync(OUT_DIR, { recursive: true });
  }
  
  const { schema, summary, clientUuids } = analyzeAll();
  
  // json_schema.json
  const schemaPath = join(OUT_DIR, 'json_schema.json');
  writeFileSync(schemaPath, JSON.stringify(schema, null, 2), 'utf-8');
  console.log(`\n✅ json_schema.json — ${(statSync(schemaPath).size / 1024).toFixed(1)} КБ`);
  
  // json_summary.json
  const summaryPath = join(OUT_DIR, 'json_summary.json');
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf-8');
  console.log(`✅ json_summary.json — ${(statSync(summaryPath).size / 1024).toFixed(1)} КБ`);
  
  // client_uuids.json
  const uuidsPath = join(OUT_DIR, 'client_uuids.json');
  writeFileSync(uuidsPath, JSON.stringify(Array.from(clientUuids), null, 2), 'utf-8');
  console.log(`✅ client_uuids.json — ${(statSync(uuidsPath).size / 1024).toFixed(1)} КБ, ${clientUuids.size} UUID`);
  
  // Итого
  console.log(`\n📊 ИТОГО: ${Object.keys(schema).length} сущностей`);
  for (const [entity, data] of Object.entries(summary)) {
    console.log(`   ${entity}: ${data.record_count} записей, ${data.fields.length} полей`);
  }
  console.log('\n✅ Готово!');
}

try {
  main();
} catch (err) {
  console.error('❌ Ошибка:', err.message);
  console.error(err.stack);
  process.exit(1);
}
