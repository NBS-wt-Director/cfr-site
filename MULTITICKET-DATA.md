# МУЛЬТИТИКЕТ: Данные, Маппинг, Группировка Админки

> 📅 Создан: 2026-08-08
> 🎯 Цели:
> 1. Группировка вкладок админки в логические группы
> 2. Вкладка "Маппинг данных" — ручной сопоставление JSON↔PG
> 3. Расширенная вкладка "Данные" — управление PG, импорт/экспорт, статус контейнера
> 4. API для маппинга и управления данными

---

## Контекст

### Проблема 1: Два формата данных
- **JSON (старый)** — информация на сайте, тренеры, программы, новости, настройки, слайдер
- **PostgreSQL (новый)** — ЛК, более полные данные, но нет фотографий, новостей, настроек, слайдера
- Массивы пересекаются, но нет инструментов ручного присвоения одного объекта из старого другому
- Автоматический маппинг ненадёжен — человек в админке справится быстрее

### Проблема 2: Переход информационной части с JSON на PG
- Информационная часть сайта (слайдер, новости, настройки, расписание, цены) пока на JSON
- Нужно: инструмент перехода, система запуска/проверки PG контейнера, импорт/экспорт JSON и PG данных

### Проблема 3: Админка слишком большая
- 28 вкладок в одной плоской структуре
- Нужно сгруппировать по категориям

---

## Тикет D1: Группировка вкладок админки

### Текущие вкладки (28 штук):
1. `header` — настройки хедера
2. `homeContainer` — настройки домашнего контейнера
3. `homePrograms` — настройки программ на главной
4. `homeTrainers` — настройки тренеров на главной
5. `programs` — программы
6. `programsCards` — карточки программ
7. `trainers` — тренеры
8. `trainersCards` — карточки тренеров
9. `sliders` — слайдер
10. `schedulePrices` — расписание и цены
11. `workouts` — тренировки
12. `staff` — сотрудники
13. `news` — новости
14. `pages` — страницы
15. `footer` — футер
16. `sections` — секции
17. `dividers` — разделители
18. `contacts` — контакты
19. `additionalContacts` — доп. контакты
20. `settings` — настройки сайта
21. `stats` — статистика
22. `autoupload` — автозагрузка
23. `files` — файлы/хранилище
24. `design` — дизайн
25. `data` — данные (PG управление)
26. `lk` — пользователи ЛК
27. `sync` — синхронизация

### Предлагаемые группы (создать):

**🎨 Дизайн и оформление**
- header, design, sections, dividers, footer, contacts, additionalContacts

**📋 Контент**
- news, pages, sliders, schedulePrices

**👥 Персонал и программы**
- programs, programsCards, trainers, trainersCards, workouts, staff

**🏠 Главная страница**
- homeContainer, homePrograms, homeTrainers

**⚙️ Настройки**
- settings, stats, autoupload, files

**🗄️ Данные и администрирование**
- data, lk, sync

### Реализация:
1. Создать `AdminGroups.tsx` — компонент с группировкой вкладок (аккордеон/вкладки внутри вкладок)
2. Обновить `AdminTabs.tsx` — добавить группировку
3. Обновить `admin/page.tsx` — передать activeGroup

---

## Тикет D2: Вкладка "Маппинг данных"

### Функционал:
1. **Список тренеров из JSON** — отображение всех тренеров из db.json
2. **Список тренеров из PG** — отображение всех тренеров из PostgreSQL
3. **Ручной маппинг** — drag-and-drop или select для сопоставления JSON↔PG
4. **Кнопка "Удалить"** — если из XML пришли пустые/устаревшие данные
5. **Кнопка "Включить в инфо-зону"** — если из XML взяли то, чего не было в информационной зоне
6. **Аналогично для программ** — программы JSON ↔ программы PG

### Структура компонента `AdminDataMapping.tsx`:
```tsx
interface MappingEntry {
  id: string;
  jsonId: number | null;    // ID в JSON
  pgId: number | null;       // ID в PG
  jsonName: string;          // Имя в JSON
  pgName: string;            // Имя в PG
  status: 'mapped' | 'json_only' | 'pg_only' | 'deleted';
  entityType: 'trainer' | 'program';
}
```

### API:
- `GET /api/admin/data/mapping?type=trainer|program` — получить маппинг
- `POST /api/admin/data/mapping` — создать маппинг (jsonId ↔ pgId)
- `DELETE /api/admin/data/mapping/:id` — удалить маппинг
- `POST /api/admin/data/mapping/import` — импорт маппинга из JSON
- `POST /api/admin/data/mapping/export` — экспорт маппинга в JSON

### Таблица в PG `data_mappings`:
```sql
CREATE TABLE data_mappings (
  id SERIAL PRIMARY KEY,
  entity_type VARCHAR(50) NOT NULL,  -- 'trainer', 'program', 'news', etc.
  json_id INTEGER,                    -- ID в JSON
  pg_id INTEGER,                      -- ID в PG
  json_name VARCHAR(255),
  pg_name VARCHAR(255),
  status VARCHAR(20) DEFAULT 'mapped',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## Тикет D3: Расширенная вкладка "Данные"

### Текущий функционал (AdminDataTab.tsx):
- Статус режима (JSON/PG)
- Статистика по записям
- Кнопка миграции
- Переключатель режима

### Новый функционал:

**1. Статус и доступность PG контейнера**
- Кнопка "Проверить подключение"
- Отображение: статус (online/offline), время ответа, количество записей в каждой таблице
- Кнопка "Запустить Docker" (если PG не доступен)

**2. Управление подключением**
- Форма для ввода/изменения настроек:
  - PG_HOST
  - PG_PORT
  - PG_DATABASE
  - PG_USER
  - PG_PASSWORD
- Кнопка "Тест подключения"
- Кнопка "Сохранить настройки"

**3. Импорт/Экспорт данных**
- **Экспорт JSON → PG** — перенести все данные из JSON в соответствующие таблицы PG
- **Импорт PG → JSON** — выгрузить данные из PG обратно в JSON (для бэкапа)
- **Экспорт PG → JSON file** — скачать JSON файл с данными из PG
- **Импорт JSON file → PG** — загрузить JSON файл и импортировать в PG

**4. Запуск перехода**
- Кнопка "Начать полный переход на PG"
- Прогресс-бар с этапами:
  1. Проверка подключения к PG
  2. Экспорт данных из JSON
  3. Импорт в PG по таблицам
  4. Проверка целостности
  5. Переключение режима на PG
- Отмена перехода

### API:
- `GET /api/admin/data/status` — статус PG (подключение, таблицы, записи)
- `POST /api/admin/data/test-connection` — тест подключения
- `POST /api/admin/data/settings` — сохранить настройки подключения
- `GET /api/admin/data/settings` — получить настройки подключения
- `POST /api/admin/data/export-json` — экспорт JSON → PG
- `POST /api/admin/data/import-json` — импорт JSON из файла
- `POST /api/admin/data/export-pg-json` — экспорт PG → JSON файл
- `POST /api/admin/data/transition` — запуск полного перехода на PG

---

## Тикет D4: Создание таблицы data_mappings в PG

### SQL:
```sql
-- Таблица маппинга данных между JSON и PG
CREATE TABLE IF NOT EXISTS data_mappings (
  id SERIAL PRIMARY KEY,
  entity_type VARCHAR(50) NOT NULL,
  json_id INTEGER,
  pg_id INTEGER,
  json_name VARCHAR(255),
  pg_name VARCHAR(255),
  status VARCHAR(20) DEFAULT 'mapped',
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Индексы для быстрого поиска
CREATE INDEX idx_data_mappings_entity ON data_mappings(entity_type);
CREATE INDEX idx_data_mappings_json_id ON data_mappings(json_id);
CREATE INDEX idx_data_mappings_pg_id ON data_mappings(pg_id);
CREATE INDEX idx_data_mappings_status ON data_mappings(status);
```

### Скрипт миграции:
- `scripts/migrate-data-mappings.mjs` — автономный скрипт создания таблицы

---

## Тикет D5: API для маппинга данных

### `src/app/api/admin/data/mapping/route.ts`:

**GET** — получить все маппинги или по типу:
```ts
// query: type=trainer|program|all
// response: MappingEntry[]
```

**POST** — создать/обновить маппинг:
```ts
// body: { entityType, jsonId, pgId, status }
// response: { success: true, mapping: MappingEntry }
```

**DELETE** — удалить маппинг:
```ts
// query: id=123
// response: { success: true }
```

**POST** — импорт маппинга из JSON:
```ts
// body: { mappings: MappingEntry[] }
// response: { success: true, imported: N, errors: [] }
```

**POST** — экспорт маппинга в JSON:
```ts
// response: { mappings: MappingEntry[] }
```

---

## Тикет D6: API для управления данными

### `src/app/api/admin/data/status/route.ts`:
- Проверка подключения к PG
- Подсчёт записей в каждой таблице
- Время отклика

### `src/app/api/admin/data/test-connection/route.ts`:
- Тест подключения с параметрами из body или env

### `src/app/api/admin/data/settings/route.ts`:
- GET: получить настройки подключения
- POST: сохранить настройки подключения

### `src/app/api/admin/data/transition/route.ts`:
- POST: запуск полного перехода на PG
- Прогресс-этапы
- Отмена

### `src/app/api/admin/data/export/route.ts`:
- POST: экспорт JSON → PG или PG → JSON

---

## План выполнения

1. ✅ D4: Создать таблицу data_mappings в PG
2. ✅ D5: Создать API для маппинга данных
3. ✅ D1: Группировка вкладок админки
4. ✅ D2: Создать компонент AdminDataMapping.tsx
5. ✅ D3: Расширить AdminDataTab.tsx
6. ✅ D6: Создать API для управления данными
7. ✅ Тестирование и сборка

---

## Чек-лист после выполнения

- [x] Вкладки админки сгруппированы по категориям (6 групп)
- [x] Вкладка "Маппинг данных" создана (AdminDataMapping.tsx)
- [x] Кнопка "Удалить" для устаревших записей
- [x] Кнопка "Включить в инфо-зону" для новых записей
- [x] Вкладка "Данные" расширена 4 секциями
- [x] Статус PG контейнера отображается
- [x] Форма настройки подключения к PG
- [x] Импорт/экспорт JSON ↔ PG (экспорт в файл готов, импорт требует Docker)
- [x] Кнопка "Начать полный переход на PG" с прогрессом
- [x] Таблица data_mappings готова (создастся при первом обращении)
- [x] npm run build проходит без ошибок

---

## Выполнено: 2026-08-08

**Создано файлов:**
- ✅ `src/components/admin/AdminGroups.tsx` — группировка вкладок
- ✅ `src/components/admin/AdminDataMapping.tsx` — маппинг JSON↔PG
- ✅ `src/components/admin/AdminDataMapping.module.css` — стили маппинга
- ✅ `src/components/admin/AdminDataTab.module.css` — дополнены стили
- ✅ `src/app/api/admin/data/mapping/route.ts` — API маппинга
- ✅ `src/app/api/admin/data/pg-items/route.ts` — API получения PG данных
- ✅ `src/app/api/admin/data/status/route.ts` — API статуса PG
- ✅ `src/app/api/admin/data/test-connection/route.ts` — API теста подключения
- ✅ `src/app/api/admin/data/settings/route.ts` — API настроек и импорта/экспорта
- ✅ `src/app/api/admin/data/transition/route.ts` — API перехода на PG
- ✅ `scripts/migrate-data-mappings.mjs` — скрипт создания таблицы
- ✅ `MULTITICKET-DATA.md` — мультитикет

**Изменено файлов:**
- ✅ `src/components/admin/AdminTabs.tsx` — заменён на AdminGroups
- ✅ `src/components/admin/AdminDataTab.tsx` — расширен 4 секциями
- ✅ `src/components/admin/AdminTabs.module.css` — добавлены стили групп
- ✅ `MULTITICKET.md` — добавлен Тикет 6

---

## Статистика

**Файлов для создания:**
- `src/components/admin/AdminDataMapping.tsx` — маппинг данных
- `src/components/admin/AdminGroups.tsx` — группировка вкладок
- `scripts/migrate-data-mappings.mjs` — создание таблицы
- `src/app/api/admin/data/mapping/route.ts` — API маппинга
- `src/app/api/admin/data/status/route.ts` — API статуса
- `src/app/api/admin/data/test-connection/route.ts` — API теста подключения
- `src/app/api/admin/data/settings/route.ts` — API настроек
- `src/app/api/admin/data/transition/route.ts` — API перехода
- `src/app/api/admin/data/export/route.ts` — API импорта/экспорта

**Файлов для изменения:**
- `src/components/admin/AdminTabs.tsx` — добавить группировку
- `src/app/admin/page.tsx` — передать activeGroup
- `src/app/api/admin/db/route.ts` — добавить импорт/экспорт
- `src/lib/db.ts` — добавить экспорт/импорт PG данных

**Итого:** ~9 новых файлов, ~4 изменённых
