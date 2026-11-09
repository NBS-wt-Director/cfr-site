# CFR-Site — Сайт Центра Функционального Развития

**Домен:** [центр-фр.рф](https://центр-фр.рф) · **Репо:** `https://github.com/NBS-wt-Director/cfr-site`

Статический сайт спортивного центра с админкой, генератором данных и пайплайном наполнения из Яндекс.Диска.

> ⚠️ **Важно:** старая Next.js-версия сайта **архивирована** в `trash/` (не деплоится).
> Рабочий сайт — чистый HTML/CSS/JS в `static/`, админка — Node-сервер `scripts/admin-server.mjs`.
> Перед любым деплоем — **обновить этот README.md** (см. `AGENTS.md` → «🚀 Деплой»).

## 🏗 Архитектура

```
Яндекс.Диск (docx/фото) → scripts/ → db.json → scripts/export-static.mjs → static/js/data/*.js → статика
```

| Компонент | Что это |
|-----------|---------|
| `static/` | Публичный сайт: чистый HTML + ES6 JS + один `css/style.css`. Без сборки. |
| `static/admin.html` | Админка (вход по паролю из env, смена пароля в «Главных данных»). Группы сайдбара: ДАННЫЕ · ШАБЛОНЫ (8 отдельных разделов-заготовок) · НАСТРОЙКИ САЙТА · CRM · БОТЫ · ИНТЕГРАЦИИ · СПРАВКА |
| `scripts/admin-server.mjs` | Node-сервер (:3456): раздача сайта + API админки + запись `db.json` + авторегенерация статики. Запись пустого раздела поверх непустой базы блокируется (`validateDbData`, S140); HTML отдаётся с `Cache-Control: no-cache` |
| `db.json` | **Источник данных** (новости, программы, тренеры, расписание, цены, направления, залы, настройки, альбом) |
| `scripts/export-static.mjs` | Генератор `static/js/data/*.js` из `db.json` (+ sitemap.xml/robots.txt) |
| `deploy/` | `deploy.sh`, PM2 (`ecosystem.config.js`), NGINX (`nginx-site.conf`) |
| `tickets/` | Тикет-система (индекс — `tickets/README.md`) |
| `info/` | Справочники: ключевые решения, сканы DanceStudio, анализ доноров, команды сервера |

## 📄 Страницы сайта

| Страница | Назначение |
|----------|-----------|
| `index.html` | Главная: слайдер, расписание (гибрид: картинки/таблица), цены, направления, программы, «Коллектив», новости, контакты |
| `programs.html` | Каталог программ по разделам (сворачиваемые панели, фильтры) |
| `program.html?id=` | Шаблон страницы программы. `?id=` — **slug кириллицей** («как записано»: `Крепыши-2-4-года`) или числовой id (старые ссылки). Резолв: точный → нестрогий (регистр/ё-е) → 404 (S18) |
| `directions.html` / `directions.html?id=` | Направления (группы программ), `?id=` — числовой id направления |
| `trainers.html` / `trainer.html?id=` | «Коллектив» (тренеры) и страница тренера (`?id=` — slug ФИО или числовой id, S18) |
| `news.html` | Новости (сетка, модалка с полным текстом, markdown) |
| `album.html` | Фотоальбом непривязанных фото |
| `page.html?url=` | Ручные страницы из админки (markdown) |
| `crm.html`, `lk.html` | Заглушки CRM и Личного кабинета |
| `404.html` / `500.html` | Страницы ошибок |

## 🛠 Команды

| Команда | Что делает |
|---------|-----------|
| `npm run admin` | Запуск сайта+админки на http://localhost:3456 (пароль из `.env.local`) |
| `npm run static:export` | Перегенерация `static/js/data/*.js` + sitemap/robots из `db.json` |
| `npm run parse-docs` | Парсинг .docx с Яндекс.Диска → описания в `db.json` |
| `npm run match-photos` | Фото-обложки программ/тренеров |
| `npm run build-album` | Построение альбома из скачанных фото |
| `npm run night-sync` | Синхронизация новых файлов с диска (cron в 3:00) |
| `npm run parse-price` | Парсинг прайса (.doc) → `settings.priceItems`/`discounts` |
| `npm run test-menu` | Тесты меню (27 проверок) |
| `npm run test-static` | Смоук-тесты статики (jsdom, 584 проверки) |
| `npm run pull-prod-news` | Стягивание новостей с боевого прода |
| `npm run sync:from-server` | Синхронизация данных с сервера |

## 🚀 Деплой

Полный протокол — `AGENTS.md` → «🚀 Деплой»; периодический регламент — `tickets/activ/periodic/deploy.md`.

**Перед деплоем обязательно:** обновить `README.md`, если менялись страницы/API/структура.

```bash
# С сервера (cfr_balloo):
cd /home/cfr_balloo/sites/cfrsite && ./deploy/deploy.sh
```

Стек прода: **Ubuntu 24.04 · PM2 (`cfrsite`, :3456) · NGINX (443 → статика + прокси API) · Let's Encrypt.**

## 💾 База данных (`db.json`)

```
{
  data:     { news, programs, trainers, schedule, prices, album },
  settings: { appearance, siteSettings, scheduleSettings, emailConfig,
              globalDivider, sliderSettings, contacts, directions, halls,
              homeSections, priceItems, discounts, footerLinks,
              headerSettings, sectionNames },
  sections, sliders, employees, staff, additionalContacts,
  designSettings, visits, mediaUsage, defaultInterval
}
```

- `db.json` — **коммитится** (~460 КБ), на сервере является источником истины (деплой его сохраняет).
- Бэкапы — в `backups/` (в `.gitignore`), правила — `AGENTS.md` → «💾 База данных».

## 🔐 Секреты

Только через переменные окружения (`.env.local` для разработки, `.env.production` на сервере — оба в `.gitignore`).
Перечень переменных: `.env.example`, `.env.production.example`.

## 📁 Структура проекта

```
cfr-site/
├── static/              # Сайт (HTML/CSS/JS) + uploads/ + data/ (донор, не коммитится)
├── scripts/             # Node/Python-скрипты: админка, экспорт, парсеры, тесты
├── deploy/              # deploy.sh, PM2, NGINX
├── tickets/             # Тикет-система (activ / definded / done / trash + README-указатель)
├── info/                # Справочники (решения, анализ доноров, команды сервера)
├── documentation/       # Документация + 🗺 ROADMAP (планы: фреймворк+psql, CRM, ЛК, боты)
├── backups/             # Бэкапы db.json (не коммитится)
├── db.json              # Источник данных (коммитится)
├── AGENTS.md            # Протокол для AI (правила, деплой, тикеты)
└── trash/               # Архив старой Next.js-версии (не коммитится)
```

## 👥 Разработка

- **Стиль:** чистый JS (ES6, без фреймворков), комментарии на русском уместны.
- **Тесты:** `npm run test-menu && npm run test-static` перед каждым коммитом.
- **Тикеты:** `tickets/README.md` → `продолжай` / `добавь задачу` / `приберись в задачах`.

## 📄 Лицензия

© 2026 ЦФР. Екатеринбург. Все права защищены.
