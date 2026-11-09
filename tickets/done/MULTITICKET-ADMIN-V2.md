# МУЛЬТИТИКЕТ: Админка v2 — Оформление, Расписание, Структура, Слияние

> ⚠️ **ВНИМАНИЕ:** Задача разбита на 8 тикетов (S1–S8).
> **НЕ НАЧИНАТЬ ВЫПОЛНЕНИЕ БЕЗ КОМАНДЫ.**
>
> **Команда запуска:**
> ```
> Прочитай документ cfr-site/MULTITICKET-ADMIN-V2.md
> и выполни тикет S<N>
> ```
>
> **ПЕРЕДАЧА МЕЖДУ СЕССИЯМИ — ОБЯЗАТЕЛЬНО:**
> 1. В начале работы прочитать раздел **«📊 СОСТОЯНИЕ»** и **«ЖУРНАЛ»**.
> 2. В конце работы **обязательно** обновить раздел **«📊 СОСТОЯНИЕ»** и добавить строку в **«ЖУРНАЛ»**.
> 3. Не начинать следующий тикет, пока не записан итог текущего.

---

## 🎯 ЦЕЛЬ

Масштабное обновление админки статического сайта:
1. **Оформление** — полноценный цветовой колорпикер (код ↔ пикер ↔ превью)
2. **Расписание** — переключатель режимов (картинки/таблица/гибрид) + полная таблица с CRUD
3. **Структура данных** — разделение на «настройки» и «данные»
4. **Структура навигации** — суперразделы: «Данные», «Настройки сайта», заглушки (CRM, боты, Интеграции), «Справка»
5. **Механизм слияния** — безопасный забор данных с прода на дев

---

## 📂 КОРЕНЬ И СТЕК

- **Корень проекта:** `/home/ivan/Рабочий стол/проекты/цфр/cfr-site/`
- **Статический сайт:** `static/` (HTML + JS + CSS, без сборки)
- **Данные:** `db.json` в корне репо
- **Генератор статики:** `scripts/export-static.mjs` → `npm run static:export` → `static/js/data/*.js`
- **Админка:** `static/admin.html` + `scripts/admin-server.mjs` (Node, порт 3456)
- **Пароль админки:** `ЦФР_2026.10.21` (в `.env.local` и `ecosystem.config.js`)
- **Данные Яндекс.Диска:** `static/data/` (не коммитить)
- **Загрузки:** `static/uploads/`
- **Стек:** чистый HTML + ES6 JS + `css/style.css`
- **Сайт:** `https://xn----itbymbjqk.xn--p1ai` (центр-фр.рф)

### Пайплайн данных

```
Яндекс.Диск → scripts/ → db.json → export-static.mjs → static/js/data/*.js → статика
Админка (admin-server :3456) → db.json → export-static.mjs → статика
```

---

## 🔑 КЛЮЧЕВЫЕ РЕШЕНИЯ (приняты, не переигрывать)

| # | Решение | Обоснование |
|---|---------|-------------|
| 1 | **Админка — отдельный Node-сервер** (`scripts/admin-server.mjs`), localhost:3456 | Голоя статика не хранит данные |
| 2 | **Пароль** через `process.env.ADMIN_PASSWORD`, не хардкод | Правило безопасности AGENTS.md |
| 3 | **API админки** — только POST-методы | Сервер фильтрует по `method === 'POST'` |
| 4 | **Экранирование кавычек** в `onclick` — `\'` | Иначе `Uncaught SyntaxError` |
| 5 | **DB_MODE=json** — данные в `db.json`, не PostgreSQL | Быстро, просто, без лишней сложности |
| 6 | **Статика перегенерируется** при каждом сохранении из админки | `export-static.mjs` → `static/js/data/*.js` |
| 7 | **db.json на сервере** — источник истины. `git pull` НЕ должен его перезаписывать | `deploy/deploy.sh` бэкапит и восстанавливает |
| 8 | **NGINX** проксирует `/api/admin/` → `127.0.0.1:3456` | `deploy/nginx-site.conf` |
| 9 | **PM2** запускает `admin-server.mjs`, не Next.js | `deploy/ecosystem.config.js` |
| 10 | **Разделение «данные»/«настройки»** — разные API endpoints, разные пути в db.json | Не перегружать страницу лишними данными |

---

## 📥 ИСХОДНЫЕ ДАННЫЕ

### Яндекс.Диск

| Что | Ссылка |
|-----|--------|
| Тренера 2026 | `https://disk.yandex.ru/d/XddntkTpcYF2XA` |
| Программы | `https://disk.yandex.ru/d/5kP8jYbCBg4sDg` |
| Расписание | `https://disk.yandex.ru/d/...` |
| Цены | `https://disk.yandex.ru/d/...` |

---

## 📊 ТЕКУЩАЯ СТРУКТУРА ДАННЫХ (db.json)

```json
{
  "sliders": [],
  "trainers": [],
  "news": [],
  "programs": [],
  "schedule": [],
  "contacts": {},
  "sections": [],
  "prices": [],
  "globalDivider": {},
  "sliderSettings": {},
  "emailConfig": {},
  "appearance": { "variables": {}, "customCss": "" },
  "siteSettings": { "title1": "", "title2": "", "logo": "" },
  "newsSettings": { "defaultImage": "", "defaultVideo": "", "autoPublish": false },
  "album": []
}
```

---

## 📊 ТЕКУЩАЯ НАВИГАЦИЯ АДМИНКИ (с чем работаем)

```
📰 Новости          (data: news)
🥋 Программы        (data: programs)
👨‏ Тренеры          (data: trainers)
📅 Расписание       (view: schedule)
💰 Цены             (view: prices)
🎞 Слайдер          (view: sliders)
📞 Контакты         (view: contacts)
⚙️ Настройки новостей  (view: newsSettings)
🎨 Разделители      (data: globalDivider)
🖌 Оформление       (data: appearance)
🏠 Главные данные   (data: siteSettings)
📸 Альбом           (view: album)
📊 CRM              (wip: заглушка)
💾 Данные           (view: весь db.json)
```

---

## 📊 ЦЕЛЕВАЯ СТРУКТУРА НАВИГАЦИИ

```
📦 ДАННЫЕ (суперраздел, первый)
  ├─ 📰 Новости
  ├─ 🥋 Программы
  ├─ 👨‏ Тренеры
  ├─ 📅 Расписание
  ├─ 💰 Цены
  └─ 📸 Альбом

⚙️ НАСТРОЙКИ САЙТА (суперраздел, второй)
  ├─ 🖌 Оформление
  ├─ ✉️ Настройки электронной почты
  ├─ 📞 Контакты
  ├─ 🎞 Слайдер
  ├─ 🎨 Разделители
  └─ 🏠 Главные данные

📊 CRM (заглушка)
🤖 БОТЫ (заглушка)
🔗 ИНТЕГРАЦИИ (заглушка)

📖 СПРАВКА ДЛЯ АДМИНИСТРАТОРОВ
```

---

## 🗺 ТИКЕТЫ

### S1 — Цветовой колорпикер в «Оформление»

**Зависимости:** нет
**Сложность:** средняя
**Что меняем:** `static/admin.html` (JS/CSS), API не нужен

**Задачи:**
1. В разделе «🖌 Оформление» добавить секцию «Цвета» с редактором для каждой CSS-переменной (--primary, --danger, --success, --bg, --card, --text, --text-secondary, --border)
2. Для каждой переменной:
   - Полноразмерный `<input type="color">` — колорпикер
   - Поле ввода hex-кода (`#2563eb`) — синхронизировано с пикером
   - Предпросмотр цвета (квадрат 40×40 с фоном выбранного цвета)
3. Синхронизация: изменение в пикере → обновление кода и превью; изменение кода → обновление пикера и превью
4. Кнопка «Сбросить» — возвращает дефолтные цвета (из CSS `:root`)
5. Кнопка «Применить» — сохраняет в `db.appearance.variables` + перегенерирует статику

**Структура данных:**
```json
{
  "appearance": {
    "variables": {
      "--primary": "#2563eb",
      "--primary-hover": "#1d4ed8",
      "--danger": "#dc2626",
      "--danger-hover": "#b91c1c",
      "--success": "#16a34a",
      "--success-hover": "#15803d",
      "--bg": "#f8fafc",
      "--card": "#ffffff",
      "--text": "#1e293b",
      "--text-secondary": "#64748b",
      "--border": "#e2e8f0"
    },
    "customCss": ""
  }
}
```

**API:** уже есть `/api/admin/save-appearance` — принимает `{ appearance: { variables, customCss } }`

**Дефолтные цвета (для сброса):**
```
--primary: #2563eb
--primary-hover: #1d4ed8
--danger: #dc2626
--danger-hover: #b91c1c
--success: #16a34a
--success-hover: #15803d
--bg: #f8fafc
--card: #ffffff
--text: #1e293b
--text-secondary: #64748b
--border: #e2e8f0
```

**Валидация:**
- Только допустимые hex-коды (`#[0-9a-fA-F]{6}`)
- Пикер возвращает `#RRGGBB` — автоматически

**Стили для колорпикера:**
```css
.color-editor {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem;
  background: #f8fafc;
  border-radius: 8px;
  margin-bottom: 1rem;
}
.color-editor input[type="color"] {
  width: 50px;
  height: 50px;
  border: 2px solid var(--border);
  border-radius: 8px;
  cursor: pointer;
  padding: 0;
}
.color-editor input[type="text"] {
  flex: 1;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-family: monospace;
  font-size: 1rem;
}
.color-preview {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  border: 1px solid var(--border);
}
```

---

### S2 — Переключатель режимов расписания в админке

**Зависимости:** нет (но зависит от структуры данных S3)
**Сложность:** низкая
**Что меняем:** `db.json` (новая структура), `static/admin.html`

**Задачи:**
1. Добавить в `db.json` раздел `scheduleSettings`:
   ```json
   {
     "scheduleSettings": {
       "defaultView": "images",  // "images" | "table" | "hybrid"
       "hybridActiveTab": "images" // для режима hybrid — какая вкладка активна по умолчанию
     }
   }
   ```
2. В разделе «📅 Расписание» в админке добавить переключатель:
   - Три кнопки-радио: `🖼 Картинки`, `📋 Таблица`, `🔄 Гибрид`
   - Кнопка «Сохранить режим» → POST `/api/admin/save-schedule-settings`
3. На главной странице сайта (`static/index.html`, `static/js/main.js`):
   - Считывать `scheduleSettings.defaultView` при инициализации
   - Отображать ТОЛЬКО тот режим, который выбран в админке
   - Для `hybrid` — показывать вкладки, активная = `hybridActiveTab`

**API:**
- Новый endpoint: `POST /api/admin/save-schedule-settings`
- Тело: `{ scheduleSettings: { defaultView, hybridActiveTab } }`
- Сохраняет в `db.scheduleSettings`, вызывает `export-static.mjs`

**Как работает на сайте:**
```js
// При загрузке главной:
const settings = window.__DATA__.scheduleSettings || {};
const view = settings.defaultView || 'images';

if (view === 'images') {
  // показать только картинки
} else if (view === 'table') {
  // показать только таблицу
} else if (view === 'hybrid') {
  // показать вкладки, активная = settings.hybridActiveTab || 'images'
}
```

---

### S3 — Полная таблица расписания с CRUD

**Зависимости:** S2 (структура данных)
**Сложность:** высокая
**Что меняем:** `db.json`, `static/admin.html`, `scripts/admin-server.mjs`, `scripts/export-static.mjs`, `static/js/`

**Задачи:**
1. **Новая структура расписания в db.json:**
   ```json
   {
     "schedule": [
       {
         "id": 1,
         "day": "Понедельник",
         "time": "10:00-11:00",
         "trainerId": 3,
         "programId": 5,
         "title": "Детская группа",
         "image": "uploads/schedule-1.jpg",
         "visible": true,
         "archived": false,
         "order": 1
       }
     ],
     "scheduleSettings": {
       "defaultView": "images",
       "hybridActiveTab": "images"
     }
   }
   ```

2. **Админка — таблица расписания:**
   - Таблица с колонками: День, Время, Тренер, Программа, Заголовок, Картинка, Видимость, Архив, Действия
   - Кнопки: «Добавить», «Редактировать», «Удалить», «Скрыть/Показать», «Архивировать/Восстановить»
   - Выпадающий список тренеров (из `db.trainers`)
   - Выпадающий список программ (из `db.programs`)
   - Фильтры: по дню, по видимости, по архиву

3. **API:**
   - `POST /api/admin/get-schedule` → возвращает весь список
   - `POST /api/admin/save-schedule` → сохраняет весь список (как есть)
   - `POST /api/admin/delete-schedule-item` → удаляет по id

4. **Экспорт в статику:**
   - `scripts/export-static.mjs` — фильтрует `visible: false` и `archived: true`
   - Генерирует `schedule.js` и `schedule-table.js` как и раньше
   - `scheduleSettings` экспортируется в `core.js`

5. **На сайте:**
   - Режим `images` — отображает картинки из `schedule[].image`
   - Режим `table` — отображает таблицу из `schedule[]`
   - Режим `hybrid` — вкладки «Картинки» + «Таблица»

**Валидация:**
- `day` — один из: Понедельник, Вторник, ..., Воскресенье
- `time` — формат `HH:MM-HH:MM`
- `trainerId` — ссылка на `db.trainers[].id`
- `programId` — ссылка на `db.programs[].id`

---

### S4 — Разделение данных на «настройки» и «данные»

**Зависимости:** нет
**Сложность:** средняя
**Что меняем:** `db.json`, `scripts/admin-server.mjs`, `scripts/export-static.mjs`

**Задачи:**
1. **Разделение структуры db.json:**
   ```json
   {
     "data": {
       "news": [],
       "programs": [],
       "trainers": [],
       "schedule": [],
       "prices": [],
       "album": []
     },
     "settings": {
       "appearance": { "variables": {}, "customCss": "" },
       "siteSettings": { "title1": "", "title2": "", "logo": "" },
       "newsSettings": {},
       "scheduleSettings": {},
       "emailConfig": {},
       "globalDivider": {},
       "sliderSettings": {},
       "contacts": {}
     },
     "sliders": []
   }
   ```

2. **API — разделение:**
   - `/api/admin/get-data` → возвращает `data.*` (для рендеринга сайта)
   - `/api/admin/get-settings` → возвращает `settings.*` (для админки)
   - `/api/admin/save-data` → сохраняет `data.*`
   - `/api/admin/save-settings` → сохраняет `settings.*`

3. **export-static.mjs:**
   - Читает `db.data` для генерации `*.js` файлов
   - Читает `db.settings` для `core.js`

4. **Обратная совместимость:**
   - При загрузке `db.json` без вложенности — автоматически переносит в `data.*`/`settings.*`
   - Скрипт миграции в `scripts/migrate-db.mjs` (запускается один раз)

**Почему это важно:**
- Сайт загружает только `data.*` (быстро)
- Админка загружает только нужные `settings.*`
- Нет перегрузки страницы лишними данными

---

### S5 — Редизайн навигации админки (суперразделы)

**Зависимости:** S4 (разделение данных)
**Сложность:** средняя
**Что меняем:** `static/admin.html` (HTML/CSS/JS)

**Задачи:**
1. **Новая структура навигации (HTML):**
   ```html
   <!-- ДАННЫЕ -->
   <div class="sidebar-group">
     <div class="sidebar-group-header" onclick="toggleGroup(this)">📦 ДАННЫЕ ▾</div>
     <div class="sidebar-group-body">
       <a href="#news" data-section="news">📰 Новости</a>
       <a href="#programs" data-section="programs">🥋 Программы</a>
       <a href="#trainers" data-section="trainers">👨‏ Тренеры</a>
       <a href="#schedule" data-section="schedule">📅 Расписание</a>
       <a href="#prices" data-section="prices">💰 Цены</a>
       <a href="#album" data-section="album">📸 Альбом</a>
     </div>
   </div>

   <!-- НАСТРОЙКИ САЙТА -->
   <div class="sidebar-group">
     <div class="sidebar-group-header" onclick="toggleGroup(this)">⚙️ НАСТРОЙКИ САЙТА ▾</div>
     <div class="sidebar-group-body">
       <a href="#appearance" data-section="appearance">🖌 Оформление</a>
       <a href="#email" data-section="email">✉️ Настройки электронной почты</a>
       <a href="#contacts" data-section="contacts">📞 Контакты</a>
       <a href="#slider" data-section="slider">🎞 Слайдер</a>
       <a href="#dividers" data-section="dividers">🎨 Разделители</a>
       <a href="#main-data" data-section="main-data">🏠 Главные данные</a>
     </div>
   </div>

   <!-- ЗАГЛУШКИ -->
   <div class="sidebar-group">
     <div class="sidebar-group-header" onclick="toggleGroup(this)">📊 CRM ▾</div>
     <div class="sidebar-group-body">
       <a href="#crm" data-section="crm" class="sidebar-wip">📊 CRM (скоро)</a>
     </div>
   </div>
   <div class="sidebar-group">
     <div class="sidebar-group-header" onclick="toggleGroup(this)">🤖 БОТЫ ▾</div>
     <div class="sidebar-group-body">
       <a href="#bots" data-section="bots" class="sidebar-wip">🤖 Боты (скоро)</a>
     </div>
   </div>
   <div class="sidebar-group">
     <div class="sidebar-group-header" onclick="toggleGroup(this)">🔗 ИНТЕГРАЦИИ ▾</div>
     <div class="sidebar-group-body">
       <a href="#integrations" data-section="integrations" class="sidebar-wip">🔗 Интеграции (скоро)</a>
     </div>
   </div>

   <!-- СПРАВКА -->
   <div class="sidebar-group">
     <div class="sidebar-group-header" onclick="toggleGroup(this)">📖 СПРАВКА ▾</div>
     <div class="sidebar-group-body">
       <a href="#help" data-section="help">📖 Справка для администраторов</a>
     </div>
   </div>
   ```

2. **CSS для групп:**
   ```css
   .sidebar-group {
     border-bottom: 1px solid var(--border);
   }
   .sidebar-group-header {
     padding: 0.75rem 1.5rem;
     font-weight: 600;
     font-size: 0.85rem;
     cursor: pointer;
     user-select: none;
     background: #f1f5f9;
   }
   .sidebar-group-header:hover {
     background: #e2e8f0;
   }
   .sidebar-group-body {
     max-height: 0;
     overflow: hidden;
     transition: max-height 0.3s ease;
   }
   .sidebar-group-body.open {
     max-height: 1000px;
   }
   .sidebar-group-body a {
     padding-left: 2.5rem;
   }
   .sidebar-wip {
     opacity: 0.5;
     font-style: italic;
   }
   ```

3. **JS для сворачивания/разворачивания:**
   ```js
   function toggleGroup(header) {
     const body = header.nextElementSibling;
     body.classList.toggle('open');
     const arrow = header.textContent.slice(-1);
     header.textContent = header.textContent.slice(0, -1) + (body.classList.contains('open') ? '▾' : '▸');
   }
   ```

4. **Перенос существующих ссылок** в новую структуру (сохранить hash-навигацию)

---

### S6 — Механизм забора данных с прода на дев

**Зависимости:** нет
**Сложность:** высокая
**Что меняем:** `scripts/sync-from-server.mjs` (новый), `scripts/admin-server.mjs` (новый endpoint)

**Задачи:**
1. **API endpoint на сервере:**
   - `POST /api/admin/export-db` — возвращает полный `db.json` в ответе (JSON)
   - Валидация: только авторизованные сессии
   - Лимит: 10 МБ (защита от перебора)

2. **Локальный скрипт `scripts/sync-from-server.mjs`:**
   ```bash
   node scripts/sync-from-server.mjs <server-url> <output-file>
   ```
   - Запрашивает `POST /api/admin/export-db` с авторизацией
   - Сохраняет ответ в `output-file`
   - Проверяет JSON на валидность
   - Показывает diff структуры данных (сравнение с текущим dev)

3. **Скрипт миграции `scripts/merge-db-structures.mjs`:**
   ```bash
   node scripts/merge-db-structures.mjs <prod-db.json> <dev-db.json> <output-db.json>
   ```
   - Объединяет структуру данных:
     - Старые ключи остаются
     - Новые ключи добавляются с пустыми массивами
     - Существующие данные не перезаписываются
   - Генерирует отчёт: какие поля добавлены, какие удалены, какие изменены

4. **Пример использования:**
   ```bash
   # Забрать данные с прода
   node scripts/sync-from-server.mjs https://центр-фр.рф /tmp/prod-db.json

   # Слияние структур
   node scripts/merge-db-structures.mjs /tmp/prod-db.json db.json /tmp/merged-db.json

   # Проверить результат
   cat /tmp/merged-db.json | python3 -m json.tool | less
   ```

**Безопасность:**
- Endpoint требует авторизацию (такой же токен, как в админке)
- Ответ только JSON, не HTML
- Rate limiting: 5 запросов в минуту с одного IP

**Структура отчёта merge:**
```
✅ Добавлено полей:
  - data.schedule[].trainerId (new)
  - data.schedule[].programId (new)
  - settings.scheduleSettings (new)

⚠️ Изменено полей:
  - data.news[].text (length changed: 150 → 500)

🗑 Удалено полей:
  - (none)
```

---

### S7 — Настройки электронной почты

**Зависимости:** нет
**Сложность:** низкая
**Что меняем:** `static/admin.html`, `scripts/admin-server.mjs`, `db.json`

**Задачи:**
1. **Новый раздел «✉️ Настройки электронной почты»** в «Настройки сайта»
2. **Поля настроек:**
   ```json
   {
     "emailConfig": {
       "smtpHost": "smtp.yandex.ru",
       "smtpPort": 465,
       "smtpSecure": true,
       "smtpUser": "",
       "smtpPass": "",
       "fromName": "Робот-Автопарсер",
       "adminEmail": "",
       "errorEmail": []
     }
   }
   ```
3. **Форма в админке:**
   - SMTP хост (текст, default: `smtp.yandex.ru`)
   - SMTP порт (число, default: `465`)
   - Secure (checkbox, default: `true`)
   - SMTP пользователь (текст)
   - SMTP пароль (password, не показывать при просмотре)
   - Имя отправителя (текст)
   - Email админа (текст)
   - Email ошибок (множественный, через запятую)
   - Кнопка «Тестовое письмо» → отправляет тест на adminEmail
4. **API:**
   - `POST /api/admin/get-email-config` → возвращает `emailConfig`
   - `POST /api/admin/save-email-config` → сохраняет `emailConfig`
   - `POST /api/admin/send-test-email` → отправляет тестовое письмо

---

### S8 — Справка для администраторов

**Зависимости:** S1–S7 (все разделы должны быть описаны)
**Сложность:** низкая
**Что меняем:** `static/admin.html`, `scripts/admin-server.mjs`

**Задачи:**
1. **Новый раздел «📖 Справка»** в навигации
2. **Структура справки:**
   - Для каждого раздела админки — своя секция с:
     - Описанием раздела
     - Инструкциями по использованию
     - Примерами
     - Ссылками на документацию
   - Поиск по справке (фильтрация по ключевым словам)
3. **Хранение:** в `db.json` → `help.sections[]` (чтобы можно было редактировать из админки)
   ```json
   {
     "help": {
       "sections": [
         {
           "id": "news",
           "title": "📰 Новости",
           "content": "..."
         },
         ...
       ]
     }
   }
   ```
4. **Стартовая страница справки:** список всех разделов с кратким описанием
5. **При добавлении нового раздела** в админку — автоматически создавать шаблон раздела в справке

---

## 🚀 ДЕПЛОЙ

### Штатный деплой (через deploy.sh)

См. `deploy/deploy.sh` и `DEPLOY.md`.

**Порядок:**
1. `git push origin main` с локальной машины
2. На сервере:
   ```bash
   cd /home/cfr_balloo/sites/cfrsite
   cp db.json /tmp/db.server.json
   git checkout -- db.json static/js/data/
   git pull origin main
   cp /tmp/db.server.json db.json
   npm run static:export
   pm2 restart cfrsite --update-env
   ```
3. Проверка:
   ```bash
   curl -sk -o /dev/null -w "%{http_code}\n" https://xn----itbymbjqk.xn--p1ai/
   curl -sk -o /dev/null -w "%{http_code}\n" https://xn----itbymbjqk.xn--p1ai/admin.html
   ```

### Откат

```bash
cd /home/cfr_balloo/sites/cfrsite
cp db.json.backup.* db.json
git checkout HEAD~1 -- .
npm run static:export
pm2 restart cfrsite
```

---

## 📊 СОСТОЯНИЕ

| Тикет | Статус | Дата начала | Дата завершения | Примечания |
|-------|--------|-------------|-----------------|------------|
| S1 | completed | 24.10.2026 | 24.10.2026 | Колорпикер + hex-код + превью, синхронизированы |
| S2 | completed | 24.10.2026 | 24.10.2026 | Переключатель режимов + таблица расписания из программ + загрузка картинок |
| S3 | completed | 24.10.2026 | 24.10.2026 | Полный CRUD для scheduleStructured: CRUD, зал (большой/малый), режим (🏋️/🖥/🔄), тренер, visible |
| S4 | completed | 24.10.2026 | 24.10.2026 | Разделение data/settings: db-format.mjs, migrate-db.mjs, API get-data/get-settings/save-*, все парсеры + админка |
| S5 | completed | 24.10.2026 | 24.10.2026 | Реализованы суперразделы с collapsible-меню |
| S6 | completed | 25.10.2026 | 25.10.2026 | API export-db + sync-from-server.mjs + merge-db-structures.mjs |
| S7 | completed | 25.10.2026 | 25.10.2026 | Настройки SMTP: get/save/send-test-email, форма в админке, статус done |
| S8 | completed | 25.10.2026 | 25.10.2026 | Справка: API get-help/save-help, 12 разделов, поиск, редактирование, markdown |

---

## 📝 ЖУРНАЛ

| Дата | Тикет | Что сделано | Блокеры |
|------|-------|-------------|---------|
| 25.10.2026 | S8 | ✅ Справка для администраторов: API get-help/save-help, 12 разделов с дефолтным содержимым, поиск по ключевым словам, редактирование в модалке (markdown), категории (Данные/Настройки), статус done | Нет |
| 25.10.2026 | S7 | ✅ Настройки электронной почты: API get-email-config (пароль не отдаётся), save-email-config (пароль не перезаписывается если пустой), send-test-email (nodemailer), форма в админке со всеми полями, статус 'done' | Нет |
| 25.10.2026 | S6 | ✅ Механизм забора данных с прода: endpoint POST /api/admin/export-db (авторизация + rate limiting 5/мин), scripts/sync-from-server.mjs (забор БД через API с авторизацией), scripts/merge-db-structures.mjs (безопасное слияние структур с отчётом) | Нет |
| 24.10.2026 | S4 | ✅ Разделение «данные»/«настройки»: db-format.mjs (flat↔nested), migrate-db.mjs (миграция выполнена, бэкап в backups/), endpoints get-data/get-settings/save-data/save-settings, все 9 скриптов-парсеров через flattenDb, admin.html getDbData() объединяет оба endpoint, тесты 65/65 | Нет |
| 24.10.2026 | S3 | ✅ Полный CRUD для scheduleStructured: CRUD + зал (большой/малый) + режим (🏋️/🖥/🔄) + тренер + visible + экспорт + сайт | Нет |
| 24.10.2026 | S2 | ✅ Переключатель режимов + таблица расписания из программ + загрузка картинок | Нет |
| 24.10.2026 | S5 | ✅ Новая навигация с суперразделами | Нет |
| 24.10.2026 | S1 | ✅ Цветовой колорпикер (11 переменных, синхронизация) | Нет |

---

## 🔗 ССЫЛКИ

- **Сайт:** `https://xn----itbymbjqk.xn--p1ai` (центр-фр.рф)
- **Админка:** `https://xn----itbymbjqk.xn--p1ai/admin.html`
- **Пароль:** `ЦФР_2026.10.21`
- **Сервер:** Ubuntu 24.04, путь `/home/cfr_balloo/sites/cfrsite`
- **Порт админки:** 3456 (localhost)
- **PM2:** `cfrsite`
- **NGINX:** `/etc/nginx/sites-enabled/центр-фр.рф`
- **Репозиторий:** `https://github.com/NBS-wt-Director/cfr-site`
- **Яндекс.Диск:** `https://disk.yandex.ru/d/XddntkTpcYF2XA` (тренера), `https://disk.yandex.ru/d/5kP8jYbCBg4sDg` (программы)
