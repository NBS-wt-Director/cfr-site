#!/usr/bin/env node

/**
 * migrate-donor-to-pg.mjs — Миграция данных из XML-донора в PostgreSQL
 * 
 * Этапы:
 * 1. Извлечение данных из XML → JSON в данные/DB/json_data/
 * 2. Загрузка JSON в PostgreSQL по новой схеме
 * 
 * Запуск: node scripts/migrate-donor-to-pg.mjs
 * 
 * Переменные окружения:
 *   PG_HOST, PG_PORT, PG_DATABASE, PG_USER, PG_PASSWORD
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync, rmSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { XMLParser } from 'fast-xml-parser';
import pg from 'pg';

const { Pool } = pg;

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', 'данные', '_DB');
const OUT_DIR = join(__dirname, '..', 'данные', 'DB');
const JSON_DATA_DIR = join(OUT_DIR, 'json_data');

// Конфигурация БД
const pgConfig = {
  host: process.env.PG_HOST || 'localhost',
  port: parseInt(process.env.PG_PORT || '5432', 10),
  database: process.env.PG_DATABASE || 'balloo',
  user: process.env.PG_USER || 'balloo',
  password: process.env.PG_PASSWORD || 'balloo',
};

// ==================== Утилиты ====================

const EXCLUDE_DIRS = new Set(['Files', 'LastSave', 'Options']);
const SEGMENT_MAP = ['SingleTraining', 'Account', 'Client'];

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
  if (!filename.endsWith('.xml')) return false;
  const dir = basename(dirname(filepath));
  if (EXCLUDE_DIRS.has(dir)) return false;
  const st = statSync(filepath);
  return st.isFile();
}

/** Парсит дату DD.MM.YYYY → YYYY-MM-DD */
function parseDate(str) {
  if (!str || String(str).trim() === '') return null;
  const m = String(str).trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/** Парсит datetime DD.MM.YYYY HH:MM:SS → ISO */
function parseDateTime(str) {
  if (!str || String(str).trim() === '') return null;
  const m = String(str).trim().match(/^(\d{2})\.(\d{2})\.(\d{4}) (\d{2}):(\d{2}):(\d{2})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}:${m[6]}`;
}

/** Parse boolean-like strings */
function parseBool(str) {
  if (!str) return false;
  const s = String(str).trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'yes';
}

/** Извлекает поля из одного XML Item (без вложенных Item) */
function extractFields(item) {
  const fields = {};
  if (!item || typeof item !== 'object') return fields;
  
  for (const [key, value] of Object.entries(item)) {
    if (key === '$' || key === '@' || key.startsWith('@_')) continue;
    if (key === 'Item') continue;
    if (Array.isArray(value) && value.length > 0 && value[0] && value[0].Item) continue;
    
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      fields[key] = String(value);
    } else if (typeof value === 'object' && value !== null) {
      if (value['#text'] !== undefined) {
        fields[key] = String(value['#text']);
      } else if (value['@_cdata'] !== undefined) {
        fields[key] = String(value['@_cdata']);
      } else if (value.content !== undefined) {
        fields[key] = String(value.content);
      }
      // Пропускаем вложенные структуры без текстового значения
    }
  }
  
  return fields;
}

/** Извлекает все Item-элементы верхнего уровня */
function extractItems(parsedData, rootTag) {
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

// ==================== Парсер XML ====================

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  trimValues: true,
  arrayMode: false,
});

function parseXmlFile(filepath) {
  const content = readFileSync(filepath, 'utf-8');
  try {
    return xmlParser.parse(content);
  } catch (e) {
    return { error: `XML parse error: ${e.message}` };
  }
}

// ==================== Извлечение данных из XML ====================

function extractAllData() {
  console.log('📂 Сканирование донорской БД:', ROOT);
  
  const files = readdirSync(ROOT).filter(f => isDataXml(join(ROOT, f), f));
  console.log(`📄 Найдено XML-файлов: ${files.length}`);
  
  // Группировка по сущностям
  const entityFiles = {};
  for (const file of files) {
    const entity = getEntityBase(file);
    if (!entityFiles[entity]) entityFiles[entity] = [];
    entityFiles[entity].push(file);
  }
  
  console.log(`📦 Найдено сущностей: ${Object.keys(entityFiles).length}`);
  
  // Создаём директорию для JSON данных
  if (!existsSync(JSON_DATA_DIR)) {
    mkdirSync(JSON_DATA_DIR, { recursive: true });
  }
  
  const extracted = {};
  
  for (const [entityName, fileNames] of Object.entries(entityFiles)) {
    console.log(`\n  ⏳ ${entityName} (${fileNames.length} файлов)...`);
    
    let rootTag = entityName;
    const allItems = [];
    
    for (const fileName of fileNames) {
      const filepath = join(ROOT, fileName);
      const parsed = parseXmlFile(filepath);
      
      if (parsed.error) {
        console.warn(`    ⚠️ ${fileName}: ${parsed.error}`);
        continue;
      }
      
      if (!rootTag) rootTag = parsed.rootTag || entityName;
      const items = extractItems(parsed, rootTag);
      allItems.push(...items);
    }
    
    // Извлекаем поля из каждой записи
    const records = [];
    for (const item of allItems) {
      records.push(extractFields(item));
    }
    
    extracted[entityName.toLowerCase()] = {
      rootTag,
      recordCount: records.length,
      records,
    };
    
    console.log(`    ✅ ${records.length} записей сохранено в ${entityName}.json`);
    
    // Сохраняем JSON
    const jsonPath = join(JSON_DATA_DIR, `${entityName}.json`);
    writeFileSync(jsonPath, JSON.stringify(records, null, 2), 'utf-8');
    const sizeKB = (statSync(jsonPath).size / 1024).toFixed(1);
    console.log(`    💾 ${sizeKB} КБ`);
  }
  
  return extracted;
}

// ==================== Маппинг данных ====================

/**
 * Маппинг XML-данных в новую схему PostgreSQL.
 * Каждая функция принимает массив записей из JSON и возвращает массив объектов для вставки.
 */

// --- Справочники ---

function mapStyles(data) {
  if (!data || !data.records) return [];
  const styleMap = new Map();
  for (const rec of data.records) {
    const id = rec.ID;
    if (!id) continue;
    const name = rec.Name || rec.ClientName || '';
    if (!name) continue;
    styleMap.set(id, {
      name,
      client_name: rec.ClientName || null,
      description: rec.Description || null,
      type: rec.Type || null,
    });
  }
  console.log(`   📊 Стили: ${styleMap.size} уникальных`);
  return Array.from(styleMap.values());
}

function mapBranches(data) {
  if (!data || !data.records) return [];
  const branches = [];
  for (const rec of data.records) {
    if (!rec.ID) continue;
    branches.push({
      id: rec.ID,
      name: rec.Name || 'Главный филиал',
      address: rec.Address || null,
      phone: rec.Phone || null,
      email: rec.Email || null,
      website: rec.Website || null,
    });
  }
  console.log(`   📊 Филиалы: ${branches.length}`);
  return branches;
}

function mapHalls(data) {
  if (!data || !data.records) return [];
  const halls = [];
  for (const rec of data.records) {
    if (!rec.ID) continue;
    halls.push({
      id: rec.ID,
      name: rec.Name || '',
      branch_id: rec.ID_Branch || null,
      hall_status: rec.Status === 'Inactive' ? 'inactive' : 'active',
      can_combine: parseBool(rec.CanCombine),
      floor_type: rec.FloorType || 'мат',
      max_capacity: parseInt(rec.MaxCapacity) || 5000,
      area_sqm: rec.Area ? parseFloat(rec.Area) : null,
    });
  }
  console.log(`   📊 Залы: ${halls.length}`);
  return halls;
}

function mapTags(data) {
  if (!data || !data.records) return [];
  const tags = [];
  for (const rec of data.records) {
    if (!rec.ID) continue;
    tags.push({
      id: rec.ID,
      name: rec.Name || '',
      colour: rec.Colour || null,
      position: parseInt(rec.Position) || 0,
      description: rec.Description || null,
    });
  }
  console.log(`   📊 Теги: ${tags.length}`);
  return tags;
}

function mapInformers(data) {
  if (!data || !data.records) return [];
  const informers = [];
  for (const rec of data.records) {
    if (!rec.ID) continue;
    informers.push({
      id: rec.ID,
      name: rec.Name || '',
    });
  }
  console.log(`   📊 Источники: ${informers.length}`);
  return informers;
}

function mapReservationStatuses(data) {
  if (!data || !data.records) return [];
  const statuses = [];
  for (const rec of data.records) {
    if (!rec.ID) continue;
    statuses.push({
      id: rec.ID,
      name: rec.Name || '',
      colour: rec.Colour || null,
      position: parseInt(rec.Position) || 0,
      description: rec.Description || null,
    });
  }
  console.log(`   📊 Статусы бронирования: ${statuses.length}`);
  return statuses;
}

function mapCharges(data) {
  if (!data || !data.records) return [];
  const charges = [];
  for (const rec of data.records) {
    if (!rec.ID) continue;
    charges.push({
      id: rec.ID,
      name: rec.Name || '',
      description: rec.Description || null,
      annotation: rec.Annotation || null,
    });
  }
  console.log(`   📊 Статьи расходов: ${charges.length}`);
  return charges;
}

function mapProducts(data) {
  if (!data || !data.records) return [];
  const products = [];
  for (const rec of data.records) {
    if (!rec.ID) continue;
    products.push({
      id: rec.ID,
      name: rec.Name || '',
      barcode: rec.Barcode || null,
      measurement: rec.Measurement || null,
      unit: rec.Unit || null,
      product_status: rec.Status === 'Inactive' ? 'inactive' : (rec.Status === 'Discontinued' ? 'discontinued' : 'active'),
      purchase_cost: parseInt(rec.PurchaseCost) || 0,
      markup: parseInt(rec.Markup) || 0,
      markup_percent: parseInt(rec.MarkupPercent) || 0,
      annotation: rec.Annotation || null,
    });
  }
  console.log(`   📊 Товары: ${products.length}`);
  return products;
}

function mapTeacherBalanceTypes(data) {
  if (!data || !data.records) return [];
  const types = [];
  for (const rec of data.records) {
    if (!rec.ID) continue;
    types.push({
      id: rec.ID,
      name: rec.Name || '',
      slug: rec.Slug || '',
      factor: rec.Factor ? parseFloat(rec.Factor) : 1,
      annotation: rec.Annotation || null,
    });
  }
  console.log(`   📊 Типы баланса тренеров: ${types.length}`);
  return types;
}

// --- Персоны и роли ---

function mapPersons(data) {
  if (!data || !data.records) return [];
  const persons = new Map();
  
  for (const rec of data.records) {
    const id = rec.ID;
    if (!id) continue;
    
    const lastName = (rec.LastName || '').trim();
    const firstName = (rec.FirstName || '').trim();
    const middleName = (rec.MiddleName || '').trim();
    
    // Пропускаем пустые записи
    if (!lastName && !firstName) continue;
    
    persons.set(id, {
      id,
      last_name: lastName || null,
      first_name: firstName || null,
      middle_name: middleName || null,
      sex: rec.ID_Sex ? (rec.ID_Sex === '87364c6f-a6d3-483f-931e-84b6a8b8d8d2' ? 'female' : 'male') : null,
      birth_date: parseDate(rec.BirthDate),
      mobile_phone: rec.MobilePhone || rec.MobilePhone1 || null,
      additional_phone: rec.MobilePhone2 || rec.AdditionalPhone || null,
      email: rec.Email || null,
      address: rec.Address || null,
      notes: rec.Note || null,
      status: rec.Removed === 'true' ? 'removed' : 'normal',
    });
  }
  
  console.log(`   📊 Персоны: ${persons.size}`);
  return Array.from(persons.values());
}

function mapClients(data, personsMap) {
  if (!data || !data.records) return [];
  const clients = [];
  
  for (const rec of data.records) {
    const id = rec.ID; // Это UUID клиента → person_id
    if (!id) continue;
    
    // Пропускаем удалённых клиентов
    if (rec.Removed === 'true') continue;
    
    clients.push({
      person_id: id,
      agreement_number: rec.AgreementNumber ? parseInt(rec.AgreementNumber) : null,
      barcode: rec.Barcode || null,
      archive: parseBool(rec.Archive),
      friend_person_id: rec.FriendID || null,
      id_foto: rec.ID_Foto || null,
      annotation: rec.Annotation || null,
      status: 'normal',
    });
  }
  
  console.log(`   📊 Клиенты: ${clients.length}`);
  return clients;
}

function mapTeachers(data, personsMap) {
  if (!data || !data.records) return [];
  const teachers = [];
  
  for (const rec of data.records) {
    const id = rec.ID;
    if (!id) continue;
    
    let status = 'active';
    const st = (rec.Status || '').toLowerCase();
    if (st === 'inactive' || st === 'fired') status = 'fired';
    
    teachers.push({
      person_id: id,
      short_code: rec.ShortCode || null,
      status,
      own_salary_options: parseBool(rec.OwnSalaryOptions),
      own_second_salary_options: parseBool(rec.OwnSecondSalaryOptions),
      id_foto: rec.ID_Foto || null,
      image: rec.Image || null,
      experience: rec.Experience || null,
      description: rec.Description || null,
      specialization: rec.Specialization || null,
      is_director: parseBool(rec.IsDirector),
      sort_order: parseInt(rec.SortOrder) || 0,
    });
  }
  
  console.log(`   📊 Преподаватели: ${teachers.length}`);
  return teachers;
}

// --- Бизнес-сущности ---

function mapStylesByName(data) {
  /** Извлекаем уникальные имена стилей для создания справочника */
  if (!data || !data.records) return [];
  const nameSet = new Set();
  const result = [];
  
  for (const rec of data.records) {
    const styleName = (rec.StyleName || rec.Style || '').trim();
    if (!styleName || nameSet.has(styleName)) continue;
    nameSet.add(styleName);
    
    const style = { name: styleName, client_name: null, description: null, type: null };
    
    // Пытаемся найти полный объект стиля
    if (rec.StyleObject && typeof rec.StyleObject === 'object') {
      style.client_name = rec.StyleObject.ClientName || null;
      style.description = rec.StyleObject.Description || null;
      style.type = rec.StyleObject.Type || null;
    }
    
    result.push(style);
  }
  
  console.log(`   📊 Стили (по именам): ${result.length}`);
  return result;
}

function mapEntitiesFromGroups(data) {
  if (!data || !data.records) return [];
  const entities = [];
  const groups = [];
  
  for (const rec of data.records) {
    if (!rec.ID) continue;
    
    const styleId = rec.ID_Style || null;
    const teacherId = rec.ID_Teacher || null;
    const hallId = rec.ID_Hall || null;
    const branchId = rec.ID_Branch || null;
    
    // Находим/создаём style_id по имени (SERIAL PK)
    let styleIdNumeric = null;
    if (styleId && styleMap.has(styleId)) {
      // styleMap имеет name → index, ищем по name
      const styleObj = styleMap.get(styleId);
      styleIdNumeric = null; // Будем заполнять после создания стилей
    }
    
    // Статус группы
    const status = (rec.Status || '').toLowerCase();
    let groupStatus = 'active';
    if (status === 'admission') groupStatus = 'admission';
    else if (status === 'closed' || status === 'inactive') groupStatus = 'closed';
    else if (status === 'paused') groupStatus = 'paused';
    
    // Цвет
    let colour = rec.Colour || null;
    if (colour && colour.length > 7) colour = colour.slice(0, 7);
    
    entities.push({
      id: rec.ID,
      entity_type: 'group',
      online_type: 'offline',
      name: rec.Name || null,
      style_id_ref: styleId, // временно сохраняем UUID
      teacher_person_id: teacherId,
      hall_id: hallId,
      branch_id: branchId,
      colour,
      max_capacity: parseInt(rec.MaxCapacity) || 100,
      price_per_session: rec.PricePerSession ? parseFloat(rec.PricePerSession) : null,
      group_status,
    });
  }
  
  console.log(`   📊 Сущности (группы): ${entities.length}`);
  return entities;
}

function mapAccounts(data) {
  if (!data || !data.records) return [];
  const accounts = [];
  
  for (const rec of data.records) {
    if (!rec.ID) continue;
    
    const idClient = rec.ID_Client || null;
    
    // Маппинг payment type
    let paymentType = 'cash';
    const pt = (rec.PaymentType || 'Cash').toLowerCase();
    if (pt.includes('card')) paymentType = 'card';
    else if (pt.includes('cash')) paymentType = 'cash';
    else if (pt.includes('deposit')) paymentType = 'deposit';
    else if (pt.includes('bonus')) paymentType = 'bonus';
    else if (pt.includes('transfer') || pt.includes('transfer')) paymentType = 'transfer';
    else if (pt.includes('prepayment')) paymentType = 'prepayment';
    
    const number = rec.Number ? parseInt(rec.Number) : null;
    
    // Legacy data: сохраняем Groups, Reservations, Stages, Visits, BurnRes, Bonus
    const legacyData = {
      groups: rec.Groups,
      reservations: rec.Reservations,
      stages: rec.Stages,
      visits: rec.Visits,
      burnRes: rec.BurnRes,
      bonus: rec.Bonus,
    };
    
    accounts.push({
      id: rec.ID,
      number,
      person_id: idClient,
      entity_type: null, // группы привяжем позже
      entity_type_name: rec.AccountTypeName || null,
      account_type_cost: rec.AccountTypeCost ? parseFloat(rec.AccountTypeCost) : 0,
      original_cost: rec.OriginalCost ? parseFloat(rec.OriginalCost) : 0,
      discount: rec.Discount ? parseFloat(rec.Discount) : 0,
      discount_percent: rec.DiscountPercent ? parseFloat(rec.DiscountPercent) : 0,
      payment_type: paymentType,
      create_date: parseDate(rec.CreateDate),
      begin_date: parseDate(rec.BeginDate),
      days_count: rec.DaysCount ? parseInt(rec.DaysCount) : null,
      add_days_count: rec.AddDaysCount ? parseInt(rec.AddDaysCount) : 0,
      training_count: rec.TrainingCount ? parseInt(rec.TrainingCount) : 0,
      free_training_count: rec.FreeTrainingCount ? parseInt(rec.FreeTrainingCount) : 0,
      is_perpetual: parseBool(rec.IsPerpetual),
      is_unlimited: parseBool(rec.IsUnlimited),
      annotation: rec.Annotation || null,
      account_status: rec.Removed === 'true' ? 'cancelled' : 'active',
      legacy_data: JSON.stringify(legacyData),
    });
  }
  
  console.log(`   📊 Абонементы: ${accounts.length}`);
  return accounts;
}

function mapVisits(data) {
  if (!data || !data.records) return [];
  const visits = [];
  
  for (const rec of data.records) {
    if (!rec.ID_Client) continue;
    
    const id_group = rec.ID_Group || rec.ID_Entity || null;
    const trainingType = (rec.TrainingTypeName || rec.TrainingType || '').trim();
    
    let paymentType = 'cash';
    const pt = (rec.PaymentType || 'Cash').toLowerCase();
    if (pt.includes('card')) paymentType = 'card';
    else if (pt.includes('cash')) paymentType = 'cash';
    else if (pt.includes('bonus')) paymentType = 'bonus';
    else if (pt.includes('free')) paymentType = 'free';
    
    visits.push({
      visit_date: parseDate(rec.Date || rec.TrainingDate || rec.VisitDate),
      person_id: rec.ID_Client,
      entity_id: id_group,
      entity_type: 'group',
      account_id: rec.ID_Account || null,
      cost: rec.Cost ? parseFloat(rec.Cost) : 0,
      payment_type: paymentType,
      training_type_name: trainingType || null,
      training_type_cost: rec.TrainingTypeCost ? parseFloat(rec.TrainingTypeCost) : 0,
      annotation: rec.Annotation || rec.Comment || null,
      branch_id: rec.ID_Branch || null,
      legacy_data: null, // Visits дублируются, не сохраняем
    });
  }
  
  console.log(`   📊 Визиты: ${visits.length}`);
  return visits;
}

function mapReservations(data) {
  if (!data || !data.records) return [];
  const reservations = [];
  
  for (const rec of data.records) {
    if (!rec.ID) continue;
    
    const reservationType = (rec.ReservationType || rec.Type || 'group').toLowerCase();
    let typeEnum = 'group';
    if (reservationType.includes('individual')) typeEnum = 'individual';
    else if (reservationType.includes('rent')) typeEnum = 'rent';
    else if (reservationType === 'group') typeEnum = 'group';
    
    // Статус
    let statusEnum = 'pending';
    const st = (rec.Status || '').toLowerCase();
    if (st === 'confirmed' || st === 'подтверждено') statusEnum = 'confirmed';
    else if (st === 'cancelled' || st === 'отменено') statusEnum = 'cancelled';
    else if (st === 'checked_in' || st === 'checkedin') statusEnum = 'checked_in';
    else if (st === 'no_show') statusEnum = 'no_show';
    
    const clientType = (rec.ClientType || 'new').toLowerCase();
    let clientTypeEnum = 'new';
    if (clientType.includes('existing') || clientType.includes('существ')) clientTypeEnum = 'existing';
    
    reservations.push({
      id: rec.ID,
      reservation_type: typeEnum,
      status_id: null, // будет заполнен позже
      person_id: rec.ID_Client || null,
      entity_id: rec.ID_Group || rec.ID_Entity || null,
      entity_type: typeEnum === 'group' ? 'group' : 'individual',
      last_name: rec.LastName || null,
      first_name: rec.Name || null,
      birth_date: parseDate(rec.BirthDate),
      mobile_phone: rec.MobilePhone || rec.Phone || null,
      client_type: clientTypeEnum,
      reservation_time: parseDateTime(rec.ReservationTime || rec.Date),
      parent_last_name: rec.ParentLastName || null,
      parent_mobile_phone: rec.ParentMobilePhone || null,
      comments: rec.Comments || null,
      branch_id: rec.ID_Branch || null,
    });
  }
  
  console.log(`   📊 Бронирования: ${reservations.length}`);
  return reservations;
}

function mapIndividualTrainings(data) {
  if (!data || !data.records) return [];
  const entities = [];
  
  for (const rec of data.records) {
    if (!rec.ID) continue;
    
    const styleId = rec.ID_Style || null;
    const teacherId = rec.ID_Teacher || null;
    const hallId = rec.ID_Hall || null;
    
    entities.push({
      id: rec.ID,
      entity_type: 'individual',
      online_type: 'offline',
      name: rec.Name || null,
      style_id_ref: styleId,
      teacher_person_id: teacherId,
      hall_id: hallId,
      branch_id: rec.ID_Branch || null,
      price_per_session: rec.PricePerSession ? parseFloat(rec.PricePerSession) : null,
    });
  }
  
  console.log(`   📊 Индивидуальные тренировки: ${entities.length}`);
  return entities;
}

function mapRent(data) {
  if (!data || !data.records) return [];
  const entities = [];
  
  for (const rec of data.records) {
    if (!rec.ID) continue;
    
    // Создаём персону для арендатора
    const lastName = (rec.LastName || '').trim();
    const firstName = (rec.Name || '').trim();
    const rentPersonId = rec.ID || `rent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    
    entities.push({
      id: rentPersonId,
      entity_type: 'rent',
      online_type: 'offline',
      name: `${lastName} ${firstName}`.trim() || 'Арендатор',
      branch_id: null,
      hall_id: null,
    });
  }
  
  console.log(`   📊 Аренды: ${entities.length}`);
  return entities;
}

function mapSubstitutes(data) {
  if (!data || !data.records) return [];
  const subs = [];
  for (const rec of data.records) {
    if (!rec.ID) continue;
    subs.push({
      id: rec.ID,
      original_teacher_id: rec.ID_Teacher || null,
      substitute_teacher_id: rec.ID_Substitute || null,
      date: parseDate(rec.Date),
    });
  }
  console.log(`   📊 Замены тренеров: ${subs.length}`);
  return subs;
}

function mapTasks(data) {
  if (!data || !data.records) return [];
  const tasks = [];
  for (const rec of data.records) {
    if (!rec.ID) continue;
    
    let taskType = 'other';
    const t = (rec.Type || '').toLowerCase();
    if (t.includes('call')) taskType = 'call';
    else if (t.includes('meeting')) taskType = 'meeting';
    else if (t.includes('payment')) taskType = 'payment';
    else if (t.includes('notification')) taskType = 'notification';
    
    tasks.push({
      id: rec.ID,
      text: (rec.Text || rec.Description || '').substring(0, 255),
      closed: parseBool(rec.Closed),
      task_type: taskType,
      creator_person_id: rec.ID_Creator || null,
      closer_person_id: rec.ID_Closer || null,
      assignee_person_id: rec.ID_Assignee || null,
      task_time: parseDateTime(rec.TaskTime || rec.Time),
      close_time: parseDateTime(rec.CloseTime),
    });
  }
  console.log(`   📊 Задачи: ${tasks.length}`);
  return tasks;
}

function mapNotes(data) {
  if (!data || !data.records) return [];
  const notes = [];
  for (const rec of data.records) {
    if (!rec.ID) continue;
    notes.push({
      id: rec.ID,
      text: rec.Text || '',
      closed: parseBool(rec.Closed),
      colour: rec.Colour || null,
      note_date: parseDateTime(rec.NoteDate || rec.Time || rec.Created),
      close_date: parseDateTime(rec.CloseDate),
    });
  }
  console.log(`   📊 Заметки: ${notes.length}`);
  return notes;
}

function mapMessages(data) {
  if (!data || !data.records) return [];
  const messages = [];
  for (const rec of data.records) {
    if (!rec.ID) continue;
    
    let target = 'sms';
    const t = (rec.Target || '').toLowerCase();
    if (t.includes('viber')) target = 'viber';
    else if (t.includes('whatsapp')) target = 'whatsapp';
    else if (t.includes('telegram')) target = 'telegram';
    else if (t.includes('email')) target = 'email';
    
    let status = 'pending';
    const st = (rec.Status || '').toLowerCase();
    if (st === 'sent') status = 'sent';
    else if (st === 'delivered') status = 'delivered';
    else if (st === 'failed') status = 'failed';
    else if (st === 'auth_failed') status = 'auth_failed';
    
    messages.push({
      id: rec.ID,
      person_id: rec.ID_Client || rec.ID_Person || null,
      target,
      phone: rec.Phone || null,
      text: rec.Text || '',
      msg_status: status,
      cost: rec.Cost || null,
      message_time: parseDateTime(rec.MessageTime || rec.Time),
    });
  }
  console.log(`   📊 Сообщения: ${messages.length}`);
  return messages;
}

function mapScheduleChanges(data) {
  if (!data || !data.records) return [];
  const changes = [];
  for (const rec of data.records) {
    if (!rec.ID) continue;
    
    let changeType = 'cancel';
    const ct = (rec.ChangeType || '').toLowerCase();
    if (ct.includes('move')) changeType = 'move';
    else if (ct.includes('replace')) changeType = 'replace';
    
    changes.push({
      id: rec.ID,
      entity_id: rec.ID_Group || rec.ID_Entity || null,
      entity_type: 'group',
      change_time: parseDateTime(rec.ChangeTime || rec.Time),
      change_type: changeType,
      change_date_time: parseDateTime(rec.ChangeDateTime),
      new_date_time: parseDateTime(rec.NewDateTime),
      reason: rec.Reason || null,
      original_teacher_person_id: rec.ID_Teacher || null,
      replacement_teacher_person_id: rec.ID_Substitute || null,
      sum_type: null,
    });
  }
  console.log(`   📊 Изменения расписания: ${changes.length}`);
  return changes;
}

function mapCharges2(data) {
  if (!data || !data.records) return [];
  const charges = [];
  for (const rec of data.records) {
    if (!rec.ID) continue;
    charges.push({
      id: rec.ID,
      name: rec.Name || '',
      description: rec.Description || null,
      annotation: rec.Annotation || null,
    });
  }
  console.log(`   📊 Статьи расходов (Charge): ${charges.length}`);
  return charges;
}

function mapCards(data) {
  if (!data || !data.records) return [];
  const cards = [];
  for (const rec of data.records) {
    if (!rec.ID) continue;
    cards.push({
      id: rec.ID,
      card_data: rec.CardNumber || rec.CardData || '',
      used_at: parseDateTime(rec.UsedAt || rec.Time),
      person_id: rec.ID_Person || rec.ID_Client || null,
    });
  }
  console.log(`   📊 Использование карт: ${cards.length}`);
  return cards;
}

function mapTransactions(data) {
  if (!data || !data.records) return [];
  const transactions = [];
  
  for (const rec of data.records) {
    // Deposit — массив транзакций внутри абонемента
    const deposit = rec.Deposit;
    if (!deposit) continue;
    
    const items = deposit.Item || (Array.isArray(deposit.Item) ? deposit.Item : [deposit.Item]);
    if (!Array.isArray(items)) continue;
    
    const idClient = rec.ID_Client;
    
    for (const item of items) {
      let txType = 'payment';
      const itemType = (item.ItemType || '').toLowerCase();
      if (itemType === 'pay' || itemType === 'payin') txType = 'deposit_add';
      else if (itemType === 'writeoff' || itemType === 'write_off') txType = 'deposit_use';
      else if (itemType === 'refund') txType = 'deposit_refund';
      else if (itemType === 'bonus') txType = 'bonus_add';
      
      // PaymentType из депозита
      const paymentType = (item.PaymentType || '').toLowerCase();
      if (paymentType === 'cash' || paymentType === '') txType = 'deposit_add';
      
      transactions.push({
        id: item.ID || null,
        person_id: idClient,
        transaction_type: txType,
        amount: item.Sum ? parseFloat(item.Sum) : 0,
        balance_after: null, // не хранится в доноре
        account_id: rec.ID || null,
        visit_id: null,
        description: `Deposit: ${item.ItemType}`,
        transaction_date: parseDateTime(item.Time),
      });
    }
  }
  
  console.log(`   📊 Транзакции (из Deposit): ${transactions.length}`);
  return transactions;
}

// ==================== Загрузка в PostgreSQL ====================

/** Создаёт INSERT-запрос с ON CONFLICT для idempotency */
function buildUpsertQuery(tableName, fields, idField = 'id') {
  const colNames = fields.map(f => f.name);
  const placeholders = colNames.map((_, i) => `$${i + 1}`).join(', ');
  const updateSet = colNames
    .filter(c => c !== idField)
    .map(c => `${c} = EXCLUDED.${c}`)
    .join(', ');
  
  return `INSERT INTO ${tableName} (${colNames.join(', ')}) VALUES (${placeholders}) ON CONFLICT (${idField}) DO UPDATE SET ${updateSet}`;
}

/** Вставка БЕЗ ON CONFLICT (для таблиц с auto-generated PK) */
async function safeInsertNoConflict(client, tableName, rows, fields, batchSize = 500) {
  if (!rows || rows.length === 0) return 0;
  
  const colNames = fields.map(f => f.name);
  const placeholders = colNames.map((_, i) => `$${i + 1}`).join(', ');
  const query = `INSERT INTO ${tableName} (${colNames.join(', ')}) VALUES `;
  
  let inserted = 0;
  
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const values = batch.map(row => fields.map(f => row[f.name] !== undefined ? row[f.name] : null));
    
    const paramStr = values.map((_, vi) => {
      return values[vi].map((_, pi) => `$${vi * values[0].length + pi + 1}`).join(', ');
    }).join('), (');
    
    const fullQuery = query + `(${paramStr})`;
    
    try {
      await client.query(fullQuery, values.flat());
      inserted += batch.length;
    } catch (err) {
      console.error(`    ⚠️ Ошибка вставки в ${tableName} (строки ${i}-${i + batch.length}):`, err.message);
      // Пробуем вставить по одной
      for (const row of batch) {
        try {
          await client.query(fullQuery, fields.map(f => row[f.name] !== undefined ? row[f.name] : null));
          inserted++;
        } catch (singleErr) {
          console.error(`    ✗ Ошибка отдельной строки:`, singleErr.message);
        }
      }
    }
  }
  
  return inserted;
}

/** Безопасная вставка с обработкой ошибок */
async function safeInsert(client, tableName, rows, fields, batchSize = 100) {
  if (!rows || rows.length === 0) return 0;
  
  const query = buildUpsertQuery(tableName, fields);
  let inserted = 0;
  
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const values = batch.map(row => fields.map(f => row[f.name] !== undefined ? row[f.name] : null));
    
    const paramStr = values.map((_, vi) => {
      return values[vi].map((_, pi) => `$${vi * values[0].length + pi + 1}`).join(', ');
    }).join('), (');
    
    const fullQuery = `INSERT INTO ${tableName} (${fields.map(f => f.name).join(', ')}) VALUES (${paramStr}) ON CONFLICT (${fields[0].name}) DO UPDATE SET ${fields.filter(f => f.name !== fields[0].name).map(f => `${f.name} = EXCLUDED.${f.name}`).join(', ')}`;
    
    try {
      await client.query(fullQuery, values.flat());
      inserted += batch.length;
    } catch (err) {
      console.error(`    ⚠️ Ошибка вставки в ${tableName} (строки ${i}-${i + batch.length}):`, err.message);
      // Пробуем вставить по одной
      for (const row of batch) {
        try {
          await client.query(fullQuery, fields.map(f => row[f.name] !== undefined ? row[f.name] : null));
          inserted++;
        } catch (singleErr) {
          console.error(`    ✗ Ошибка отдельной строки:`, singleErr.message);
        }
      }
    }
  }
  
  return inserted;
}

/** Проверяет, была ли миграция уже выполнена */
async function checkMigrationAlreadyRun(client) {
  try {
    const result = await client.query(`
      SELECT COUNT(*) FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'cfr_persons'
    `);
    return result.rows[0].count > 0;
  } catch {
    return false;
  }
}

/** Загрузка данных в PostgreSQL */
async function loadToPostgreSQL(extracted) {
  console.log('\n🔌 Подключение к PostgreSQL...');
  console.log(`   ${pgConfig.host}:${pgConfig.port} / ${pgConfig.database}`);
  
  const pool = new Pool(pgConfig);
  
  try {
    const client = await pool.connect();
    
    try {
      // Проверяем версию
      const version = await client.query('SELECT version()');
      console.log(`✅ Подключено: ${version.rows[0].version.split('\n')[0]}`);
      
      // Проверяем, была ли миграция
      const alreadyMigrated = await checkMigrationAlreadyRun(client);
      if (alreadyMigrated) {
        console.log('\n⚠️  Таблица cfr_persons уже существует.');
        console.log('   Пропускаем проверку схемы. Данные будут загружены через ON CONFLICT.');
        console.log('   Для полной перезагрузки: DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
      }
      
      // ============================================
      // ЭТАП 1: Справочники
      // ============================================
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📋 ЭТАП 1: Справочники');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      const styles = mapStylesByName(extracted.style);
      const stylesFields = [
        { name: 'name' }, { name: 'client_name' }, { name: 'description' }, { name: 'type' },
      ];
      const stylesInserted = await safeInsert(client, 'cfr_styles', styles, stylesFields, 'name');
      console.log(`   ✅ Стили: ${stylesInserted} записей`);
      
      const branches = mapBranches(extracted.branch);
      const branchesFields = [
        { name: 'id' }, { name: 'name' }, { name: 'address' }, { name: 'phone' },
        { name: 'email' }, { name: 'website' },
      ];
      const branchesInserted = await safeInsert(client, 'cfr_branches', branches, branchesFields, 'id');
      console.log(`   ✅ Филиалы: ${branchesInserted} записей`);
      
      const halls = mapHalls(extracted.hall);
      const hallsFields = [
        { name: 'id' }, { name: 'name' }, { name: 'branch_id' }, { name: 'hall_status' },
        { name: 'can_combine' }, { name: 'floor_type' }, { name: 'max_capacity' }, { name: 'area_sqm' },
      ];
      const hallsInserted = await safeInsert(client, 'cfr_halls', halls, hallsFields, 'id');
      console.log(`   ✅ Залы: ${hallsInserted} записей`);
      
      const tags = mapTags(extracted.tag);
      const tagsFields = [
        { name: 'id' }, { name: 'name' }, { name: 'colour' }, { name: 'position' }, { name: 'description' },
      ];
      const tagsInserted = await safeInsert(client, 'cfr_tags', tags, tagsFields, 'id');
      console.log(`   ✅ Теги: ${tagsInserted} записей`);
      
      const informers = mapInformers(extracted.informer);
      const informersFields = [
        { name: 'id' }, { name: 'name' },
      ];
      const informersInserted = await safeInsert(client, 'cfr_informers', informers, informersFields, 'id');
      console.log(`   ✅ Источники: ${informersInserted} записей`);
      
      const reservationStatuses = mapReservationStatuses(extracted.reservationstatus);
      const rsFields = [
        { name: 'id' }, { name: 'name' }, { name: 'colour' }, { name: 'position' }, { name: 'description' },
      ];
      const rsInserted = await safeInsert(client, 'cfr_reservation_statuses', reservationStatuses, rsFields, 'id');
      console.log(`   ✅ Статусы бронирования: ${rsInserted} записей`);
      
      const charges = mapCharges2(extracted.charge);
      const chargesFields = [
        { name: 'id' }, { name: 'name' }, { name: 'description' }, { name: 'annotation' },
      ];
      const chargesInserted = await safeInsert(client, 'cfr_charges', charges, chargesFields, 'id');
      console.log(`   ✅ Статьи расходов: ${chargesInserted} записей`);
      
      const products = mapProducts(extracted.product);
      const productsFields = [
        { name: 'id' }, { name: 'name' }, { name: 'barcode' }, { name: 'measurement' },
        { name: 'unit' }, { name: 'product_status' }, { name: 'purchase_cost' },
        { name: 'markup' }, { name: 'markup_percent' }, { name: 'annotation' },
      ];
      const productsInserted = await safeInsert(client, 'cfr_products', products, productsFields, 'id');
      console.log(`   ✅ Товары: ${productsInserted} записей`);
      
      const teacherBalanceTypes = mapTeacherBalanceTypes(extracted.teacherbalancetype);
      const tbtFields = [
        { name: 'id' }, { name: 'name' }, { name: 'slug' }, { name: 'factor' }, { name: 'annotation' },
      ];
      const tbtInserted = await safeInsert(client, 'cfr_teacher_balance_types', teacherBalanceTypes, tbtFields, 'id');
      console.log(`   ✅ Типы баланса тренеров: ${tbtInserted} записей`);
      
      // ============================================
      // ЭТАП 2: Персоны
      // ============================================
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📋 ЭТАП 2: Персоны');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      // Клиенты
      const clientData = extracted.client || { records: [] };
      const clientsData = extracted.client001 ? { records: extracted.client001.records || [] } : { records: [] };
      const allClients = [...clientData.records, ...clientsData.records];
      extracted._allClients = { records: allClients };
      
      const persons = mapPersons(extracted.client);
      const personsFields = [
        { name: 'id' }, { name: 'last_name' }, { name: 'first_name' }, { name: 'middle_name' },
        { name: 'sex' }, { name: 'birth_date' }, { name: 'mobile_phone' }, { name: 'additional_phone' },
        { name: 'email' }, { name: 'address' }, { name: 'notes' }, { name: 'status' },
      ];
      const personsInserted = await safeInsert(client, 'cfr_persons', persons, personsFields, 'id');
      console.log(`   ✅ Персоны (из клиентов): ${personsInserted} записей`);
      
      // Преподаватели
      const teachers = mapTeachers(extracted.teacher);
      const teachersFields = [
        { name: 'person_id' }, { name: 'short_code' }, { name: 'status' },
        { name: 'own_salary_options' }, { name: 'own_second_salary_options' },
        { name: 'id_foto' }, { name: 'image' }, { name: 'experience' },
        { name: 'description' }, { name: 'specialization' }, { name: 'is_director' },
        { name: 'sort_order' },
      ];
      const teachersInserted = await safeInsert(client, 'cfr_teachers', teachers, teachersFields, 'person_id');
      console.log(`   ✅ Преподаватели: ${teachersInserted} записей`);
      
      // Клиенты (ролевая таблица)
      const clients = mapClients(extracted._allClients);
      const clientsFields = [
        { name: 'person_id' }, { name: 'agreement_number' }, { name: 'barcode' },
        { name: 'archive' }, { name: 'friend_person_id' }, { name: 'id_foto' },
        { name: 'annotation' }, { name: 'status' },
      ];
      const clientsInserted = await safeInsert(client, 'cfr_clients', clients, clientsFields, 'person_id');
      console.log(`   ✅ Клиенты (роль): ${clientsInserted} записей`);
      
      // ============================================
      // ЭТАП 3: Бизнес-сущности
      // ============================================
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📋 ЭТАП 3: Бизнес-сущности');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      // Группы
      const groups = mapEntitiesFromGroups(extracted.group);
      const entitiesFields = [
        { name: 'id' }, { name: 'entity_type' }, { name: 'online_type' }, { name: 'name' },
        { name: 'teacher_person_id' }, { name: 'hall_id' }, { name: 'branch_id' },
        { name: 'colour' }, { name: 'max_capacity' }, { name: 'price_per_session' },
      ];
      const entitiesInserted = await safeInsert(client, 'cfr_entities', groups, entitiesFields, 'id');
      console.log(`   ✅ Сущности (группы): ${entitiesInserted} записей`);
      
      // Индивидуальные тренировки
      const individualEntities = mapIndividualTrainings(extracted.individualtraining);
      const indInserted = await safeInsert(client, 'cfr_entities', individualEntities.map(e => ({
        ...e,
        entity_type: 'individual',
      })), entitiesFields, 'id');
      console.log(`   ✅ Сущности (индивид.): ${indInserted} записей`);
      
      // Аренда
      const rentEntities = mapRent(extracted.rent);
      const rentInserted = await safeInsert(client, 'cfr_entities', rentEntities.map(e => ({
        ...e,
        entity_type: 'rent',
      })), entitiesFields, 'id');
      console.log(`   ✅ Сущности (аренда): ${rentInserted} записей`);
      
      // ============================================
      // ЭТАП 4: Абонементы
      // ============================================
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📋 ЭТАП 4: Абонементы');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      const accountsData = extracted.account || { records: [] };
      const accountsData001 = extracted.account001 ? { records: extracted.account001.records || [] } : { records: [] };
      const allAccounts = [...accountsData.records, ...accountsData001.records];
      extracted._allAccounts = { records: allAccounts };
      
      const accounts = mapAccounts(extracted._allAccounts);
      const accountsFields = [
        { name: 'id' }, { name: 'number' }, { name: 'person_id' }, { name: 'entity_type_name' },
        { name: 'account_type_cost' }, { name: 'original_cost' }, { name: 'discount' },
        { name: 'discount_percent' }, { name: 'payment_type' }, { name: 'create_date' },
        { name: 'begin_date' }, { name: 'days_count' }, { name: 'add_days_count' },
        { name: 'training_count' }, { name: 'free_training_count' }, { name: 'is_perpetual' },
        { name: 'is_unlimited' }, { name: 'annotation' }, { name: 'account_status' },
        { name: 'legacy_data' },
      ];
      const accountsInserted = await safeInsert(client, 'cfr_accounts', accounts, accountsFields, 'id');
      console.log(`   ✅ Абонементы: ${accountsInserted} записей`);
      
      // ============================================
      // ЭТАП 5: Визиты
      // ============================================
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📋 ЭТАП 5: Визиты');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      const visits = mapVisits(extracted.singletraining);
      const visitsFields = [
        { name: 'visit_date' }, { name: 'person_id' }, { name: 'entity_id' },
        { name: 'entity_type' }, { name: 'account_id' }, { name: 'cost' },
        { name: 'payment_type' }, { name: 'training_type_name' }, { name: 'training_type_cost' },
        { name: 'annotation' }, { name: 'branch_id' },
      ];
      // Визиты: PK auto-generated UUID, поэтому ON CONFLICT не применим
      // Перезапуск = новые записи с новыми UUID (допустимо для логов визитов)
      const visitsInserted = await safeInsertNoConflict(client, 'cfr_visits', visits, visitsFields);
      console.log(`   ✅ Визиты: ${visitsInserted} записей`);
      
      // ============================================
      // ЭТАП 6: Бронирования
      // ============================================
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📋 ЭТАП 6: Бронирования');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      const reservations = mapReservations(extracted.reservation);
      const reservationsFields = [
        { name: 'id' }, { name: 'reservation_type' }, { name: 'person_id' },
        { name: 'entity_id' }, { name: 'entity_type' }, { name: 'last_name' },
        { name: 'first_name' }, { name: 'birth_date' }, { name: 'mobile_phone' },
        { name: 'client_type' }, { name: 'reservation_time' }, { name: 'parent_last_name' },
        { name: 'parent_mobile_phone' }, { name: 'comments' }, { name: 'branch_id' },
      ];
      const reservationsInserted = await safeInsert(client, 'cfr_reservations', reservations, reservationsFields, 'id');
      console.log(`   ✅ Бронирования: ${reservationsInserted} записей`);
      
      // ============================================
      // ЭТАП 7: Задачи, заметки, сообщения
      // ============================================
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📋 ЭТАП 7: Задачи, заметки, сообщения');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      const tasks = mapTasks(extracted.task);
      const tasksFields = [
        { name: 'id' }, { name: 'text' }, { name: 'closed' }, { name: 'task_type' },
        { name: 'creator_person_id' }, { name: 'closer_person_id' }, { name: 'assignee_person_id' },
        { name: 'task_time' }, { name: 'close_time' },
      ];
      const tasksInserted = await safeInsert(client, 'cfr_tasks', tasks, tasksFields, 'id');
      console.log(`   ✅ Задачи: ${tasksInserted} записей`);
      
      const notes = mapNotes(extracted.note);
      const notesFields = [
        { name: 'id' }, { name: 'text' }, { name: 'closed' }, { name: 'colour' },
        { name: 'note_date' }, { name: 'close_date' },
      ];
      const notesInserted = await safeInsert(client, 'cfr_notes', notes, notesFields, 'id');
      console.log(`   ✅ Заметки: ${notesInserted} записей`);
      
      const messages = mapMessages(extracted.message);
      const messagesFields = [
        { name: 'id' }, { name: 'person_id' }, { name: 'target' }, { name: 'phone' },
        { name: 'text' }, { name: 'msg_status' }, { name: 'cost' }, { name: 'message_time' },
      ];
      const messagesInserted = await safeInsert(client, 'cfr_messages', messages, messagesFields, 'id');
      console.log(`   ✅ Сообщения: ${messagesInserted} записей`);
      
      // ============================================
      // ЭТАП 8: Изменения расписания
      // ============================================
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📋 ЭТАП 8: Изменения расписания');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      const scheduleChanges = mapScheduleChanges(extracted.schedulechange);
      const scFields = [
        { name: 'id' }, { name: 'entity_id' }, { name: 'entity_type' },
        { name: 'change_time' }, { name: 'change_type' }, { name: 'change_date_time' },
        { name: 'new_date_time' }, { name: 'reason' },
        { name: 'original_teacher_person_id' }, { name: 'replacement_teacher_person_id' },
      ];
      const scInserted = await safeInsert(client, 'cfr_schedule_changes', scheduleChanges, scFields, 'id');
      console.log(`   ✅ Изменения расписания: ${scInserted} записей`);
      
      // ============================================
      // ЭТАП 9: Транзакции
      // ============================================
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📋 ЭТАП 9: Транзакции');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      const transactions = mapTransactions(extracted._allAccounts);
      const txFields = [
        { name: 'person_id' }, { name: 'transaction_type' }, { name: 'amount' },
        { name: 'balance_after' }, { name: 'account_id' }, { name: 'visit_id' },
        { name: 'description' }, { name: 'transaction_date' },
      ];
      const txInserted = await safeInsert(client, 'cfr_transactions', transactions, txFields, 'id');
      console.log(`   ✅ Транзакции: ${txInserted} записей`);
      
      // ============================================
      // ИТОГИ
      // ============================================
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📊 ИТОГИ МИГРАЦИИ');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      const tablesResult = await client.query(`
        SELECT table_name, (xpath('/row/cnt/text()', xml_count))[1]::text::int as cnt
        FROM (
          SELECT table_name, query_to_xml('SELECT COUNT(*) as cnt FROM ' || quote_ident(table_name), false, true, '') as xml_count
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name LIKE 'cfr_%'
            AND table_type = 'BASE TABLE'
          ORDER BY table_name
        ) t
      `);
      
      let totalRecords = 0;
      for (const row of tablesResult.rows) {
        const cnt = parseInt(row.cnt) || 0;
        totalRecords += cnt;
        console.log(`   📄 ${row.table_name}: ${cnt}`);
      }
      
      console.log(`\n   📊 ВСЕГО записей: ${totalRecords}`);
      console.log(`\n🎉 Миграция завершена!`);
      
      await client.release();
      
    } catch (err) {
      console.error('❌ Ошибка загрузки:', err.message);
      await client.release();
      throw err;
    }
    
  } finally {
    await pool.end();
  }
}

// ==================== Главная ====================

async function main() {
  console.log('🚀 Миграция данных DanceStudio → PostgreSQL\n');
  
  // Шаг 1: Извлечение XML → JSON
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('ЭТАП 1: Извлечение данных из XML');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const extracted = extractAllData();
  
  console.log('\n📦 Извлечённые сущности:');
  for (const [name, data] of Object.entries(extracted)) {
    console.log(`   ${name}: ${data.recordCount} записей`);
  }
  
  // Шаг 2: Загрузка в PostgreSQL
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('ЭТАП 2: Загрузка в PostgreSQL');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  await loadToPostgreSQL(extracted);
}

main().catch(err => {
  console.error('\n❌ Критическая ошибка:', err.message);
  console.error(err.stack);
  process.exit(1);
});
