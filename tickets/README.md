# 🎫 Система тикетов — CFR-Site

## 📖 Оглавление

Этот каталог — централизованный индекс всех тикетов проекта **CFR-Site** (центр-фр.рф).

Каждый тикет — отдельный `.md`-файл с полной информацией.

### 📁 Структура

| Путь | Назначение |
|------|-----------|
| `activ/*.md` | **Активные** и **спорные** тикеты — требуют работы |
| `activ/withLord/*.md` | Тикеты, где **обязательно участие пользователя** (SSH на сервер, решение вопросов) |
| `activ/periodic/*.md` | **Периодические** задачи (деплой, проверка, тестирование, подгрузка данных, уборка) |
| `definded/*.md` | **Отложенные** тикеты — готовы к выполнению, но ждут решения пользователя |
| `done/*.md` | **Выполненные** тикеты — перенесены по завершении |
| `trash/*.md` | **Устаревшие** тикеты (неактуальная архитектура, дубли) |
| `info/*.md` | **Справочная информация** (сканы, анализ форматов, команды сервера) — не тикеты, а справочники |

### 📚 Источник данных

Каждый тикет в `tickets/` — отдельный файл с полной информацией.

> **В новой сессии:** прочитай `tickets/README.md` → найди нужный тикет по индексу ниже → прочитай его файл → выполни.

### 📋 Индекс-указатель

> 🗺 **Планы развития проекта** (субфреймворк + psql, забор DanceStudio CRM, своя CRM + ЛК,
> шаблоны ботов, боты): [`../documentation/ROADMAP.md`](../documentation/ROADMAP.md)

#### 🔴 Активные тикеты (`activ/`)

**Волна 5** — ✅ выполнена полностью (S134…S142 + S101 в `done/`, деплой 2026-11-10).

**Волна 6** — ✅ выполнена и задеплоена (коммиты `4ab61d2`…`3484ae8`);
все исправленные тикеты в `done/` (S140–S146, S148–S150, S62, S63).

**Волна 7** — ✅ выполнена (закрыта 2026-11-14). Все тикеты в `done/`.

**Волна 8** — ✅ выполнена (закрыта 2026-11-14). Все тикеты в `done/`.

Очередь:

**Волна ARCH — новая архитектура (поставлена 2026-11-14): Docker + PostgreSQL + SSR, «никакой статики».**
Концепция: всё в контейнерах (Postgres 17, Fastify-приложение, Caddy TLS), все данные в pg,
страницы рендерятся на сервере из pg; дизайн не меняется (клиентский JS сохранён через
инъекцию `window.SITE_DATA`). Цепочка зависимостей — по номерам.

| Тикет | Статус | Описание |
|-------|--------|----------|
| [ARCH-001](activ/ARCH-001-docker-compose-caddy.md) | 📋 Запланирован | Инфраструктура: docker-compose (db+app+proxy), Caddy TLS, тома, секреты. Прод не трогает |
| [ARCH-002](activ/ARCH-002-postgres-schema-import.md) | 📋 Запланирован | Схема pg (~22 таблицы: контент/settings-JSONB/visits/leads/сессии), миграции, импорт из db.json/visits/leads |
| [ARCH-003](activ/ARCH-003-fastify-admin-pg-adapter.md) | 📋 Запланирован | Fastify-каркас + pg-адаптер readDb/saveDb (кэш+транзакции), переезд админки 1:1 (60+ ручек) |
| [ARCH-004](activ/ARCH-004-ssr-site-no-static.md) | 📋 Запланирован | SSR-сайт: 14 страниц (Eta), URL/404/S18-slug 1:1, meta/OG/sitemap живые, контент-кэш; упразднение export-static/js-data/?v= |
| [ARCH-005](activ/ARCH-005-visits-leads-status-pg.md) | 📋 Запланирован | Пиксель/агрегаты посещаемости и лиды → SQL; «Статус/Проблемы» на pg-метрики; опц. sharp |
| [ARCH-006](activ/ARCH-006-tests-migration.md) | 📋 Запланирован | Перенос ~875 проверок test-static → Vitest+supertest (шаблоны/API/юниты на pg-фикстурах), TESTS-MAP.md |
| [ARCH-007](activ/ARCH-007-cutover.md) | 📋 Запланирован, withLord | Переключение прода: DNS/Caddy, прогрев, smoke, откат. Деплой-регламент здесь НЕ переписывается |

> 📌 Процедура деплоя намеренно не трогается до ARCH-008 (`definded/`) — по указанию пользователя от 2026-11-14.

**Приёмка волны S140–S150** — за пользователем (мобильная шапка S149, карусель дней S150,
админка S144–S148). После успешной приёмки — старт работ по ROADMAP.

**Тикеты безопасности/схемы БД (Next.js-версия)** — разморожены вместе с мультитикетами,
но направлены в архивированный Next.js-код (`trash/`). Детали и вопрос пользователю:

| Тикет | Статус | Описание |
|-------|--------|----------|
| [SEC-DB-NEXTJS-ARCHIVED](definded/SEC-DB-NEXTJS-ARCHIVED.md) | ✅ Решение принято | 11 тикетов (SEC-01…10, DB-001) остаются в `definded/` до старта NEXT-001 |
| [NEXT-001](definded/NEXT-001-next-return-3-apps.md) | 📋 План | **Возврат Next.js: 3 приложения (CRM, API, WEB на дизайне static) + одна PostgreSQL в Docker + docker-compose**. Env-файлы и сессии при переезде уходят в volumes. См. ROADMAP п.1–3 |

#### 🟡 Отложенные тикеты (`definded/`)

| Тикет | Статус | Источник | Описание |
|-------|--------|----------|----------|
| [S136](definded/S136-admin-album.md) | 🕐 Ожидает  | Админка «Альбом»: CRUD, неиспользуемые фото — после деплоя |
| [S147](definded/S147-rebind-broken-photoalbum.md) | 🕐 Ожидает  | 14 битых кадров photoAlbum (Бобров, Казанцев) — перепривязка к «Архиву тренеров» |
| [S17](definded/S17-fill-album-covers.md) | 🕐 Ожидает  | Заполнение альбома и фото-обложек (частично закрыт S28) |
| [S20](definded/S20-final-check-S14-S19.md) | 🕐 Ожидает  | Финальная проверка S14–S19 |
| [S52](definded/S52-final-check-S49-S51.md) | 🕐 Ожидает  | Финальная проверка S49–S51 |
| [S1–S3](definded/S1-S3-yandex-photos.md) | ⏸ Приостановлены  | Фото с Яндекс.Диска: скачка → оптимизация → раскладка |
| [MULTITICKET](definded/MULTITICKET.md) | 🕐 Отложен  | PostgreSQL миграция: T1–T4 выполнены, T5–T8 заблокированы |
| [MULTITICKET-DANCESTUDIO](definded/MULTITICKET-DANCESTUDIO.md) | 🕐 Отложен  | DanceStudio: 1 выполнен (1.4), 14 заблокированы — ROADMAP п.2 |
| [TICKET-DONOR-FORMAT](definded/TICKET-DONOR-FORMAT.md) | 🕐 Отложен  | Парсер донора: T1–T5 выполнены, T6–T9 ждут. См. `info/DONOR-FORMAT-ANALYSIS.md` |
| [ARCH-008](definded/ARCH-008-deploy-regulation.md) | 🕐 Отложен (указание пользователя 2026-11-14) | Волна ARCH | Переписывание процедуры деплоя под Docker/PG/SSR (AGENTS.md, periodic, pg_dump-бэкапы, мержер). Разморозка — после ARCH-007 |

#### 🟠 С участием пользователя (`activ/withLord/`)

> ✅ S101 (подготовка к деплою) — выполнен, перенесён в `done/` (2026-11-10).

| Тикет | Статус | Источник | Описание |
|-------|--------|----------|----------|
| — | — | — | нет активных |

#### 🟢 Периодические задачи (`activ/periodic/`)

| Тикет | Периодичность | Описание |
|-------|--------------|----------|
| [deploy](activ/periodic/deploy.md) | По готовности | Стандартный деплой на сервер |
| [check](activ/periodic/check.md) | Регулярно | Проверка сайта, тесты, смоук |
| [test](activ/periodic/test.md) | Перед каждым деплоем | Полный прогон тестов |
| [sync-data](activ/periodic/sync-data.md) | Регулярно | Подгрузка данных с сайта и CRM |
| [trash-cleanup](activ/periodic/trash-cleanup.md) | По мере роста | Перенос неактуальных документов и кода в trash |

#### ⚪ Выполненные (`done/`)

**Волна 5 (закрыты 2026-11-07, задеплоены 2026-11-10):**

| Файл | Дата закрытия | Примечание |
|------|---------------|------------|
| [S137](done/S137-head-trainer-direction.md) | 2026-11-07 | Верх страниц тренера/направления: float-обтекание, h1 по центру |
| [S138](done/S138-disable-collective-slider.md) | 2026-11-07 | Слайдер совместных фото на «Коллективе» выключен |
| [S139](done/S139-render-bugs.md) | 2026-11-07 | 6 багов рендеринга: переключатель, ширина расписания, nav-active, регресс-тест |
| [S134](done/S134-dynamic-baseurl.md) | 2026-11-07 | Динамический baseUrl: sitemap/robots, fallback, тесты |
| [S135](done/S135-collective-staff.md) | 2026-11-07 | «Коллектив»: персонал/администраторы, админка «👥 Персонал», панель на сайте |
| [S140-direction-descriptions](done/S140-direction-descriptions.md) | 2026-11-07 | Генерация описаний пустых направлений, идемпотентный скрипт |
| [S141-unified-404](done/S141-unified-404.md) | 2026-11-07 | Единая 404: каркас сайта, случайные ссылки, log-404, email, redirect |
| [S142-admin-templates](done/S142-admin-templates.md) | 2026-11-07 | Админка «🧩 Шаблоны» — три пустых подраздела (переформатированы S145/S148) |

**Волна 7 (закрыты 2026-11-10, ждут деплоя):**

| Файл | Дата закрытия | Примечание |
|------|---------------|------------|
| [S151](done/S151-schedule-tile-actions-and-leads.md) | 2026-11-10 | Чипы расписания (3 кнопки) + `leads.json` + CRM «Вызовы форм»; в S155 добавлена колонка ✉️ Письмо |
| [S152](done/S152-call-success-text-and-dance-integration.md) | 2026-11-10 | Текст успеха модалки из «Главных данных»; сабраздел 💃 Dance в Интеграциях |
| [S153](done/S153-lead-email-notification.md) | 2026-11-10 | `sendLeadNotification` + исправлен `sendEmail404` (smtpHost/smtpUser); доработан в S155 |
| [S154](done/S154-email-settings-move-to-bots.md) | 2026-11-10 | Почта → `#bots-email` в «БОТАХ» + 8 заглушек ботов + таблица маршрутов + напоминания о фото |

**Волна 8 (закрыта 2026-11-14, ждёт деплоя):**

| Файл | Дата закрытия | Примечание |
|------|---------------|------------|
| [S155](done/S155-lead-email-not-sent-critical.md) | 2026-11-14 | КРИТИЧНО: письмо из формы. Журнал логов, защита smtpPass, шаблон фильтра Яндекса, emailSent в UI |
| [S156](done/S156-sidebar-group-counters.md) | 2026-11-14 | Счётчики активных/заглушек в заголовках групп сайдбара |
| [S157](done/S157-schedule-chip-menu-fix.md) | 2026-11-14 | ✅ Задеплоен. Меню чипа на program.html и trainer.html |
| [S158](done/S158-slider-redesign-tz.md) | 2026-11-14 | Полная переработка слайдера: описание, ссылка, цвет/размер/отступы, overlay, 9 позиций, менеджер фото, снят лимит 10 |
| [S159](done/S159-albums-use-slider-engine.md) | 2026-11-14 | Все альбомы на SliderCore вместо carousel.js |
| [S160](done/S160-photo-manager.md) | 2026-11-14 | Менеджер фото: обзор всех фото, статистика, удаление в корзину, scope uploads/data |
| [S162](done/S162-slider-batch-save-fix.md) | 2026-11-14 | sanitizeSlides НЕ выбрасывает слайды без картинки, кнопка «удалить все скрытые» |
| [S166](done/S166-events.md) | 2026-11-14 | Мероприятия: 6 типов, photoAlbum (SliderCore), видео, seed, auto-news |
| [S167](done/S167-album-slider.md) | 2026-11-14 | Универсальный альбом-слайдер: 12 полей, drag-n-drop, универсальный редактор |
| [S168](done/S168-stub-sections.md) | 2026-11-14 | 25 stub-страниц (Информация, Данные, Настройки, CRM, Интеграции) |
| [S169](done/S169-md-preview-and-no-crop.md) | 2026-11-14 | Markdown-предпросмотр mode-split, все object-fit:cover → contain |
| [S170](done/S170-video-manager.md) | 2026-11-14 | Менеджер видео: аналог менеджера фото для видео (mp4/webm/mov/m4v/ogv) |
| [S161](done/S161-site-status-section.md) | 2026-11-14 | Раздел «📟 Статус»: API site-status, карточки сайта/сервера/посещаемости/проблем |
| [S163](done/S163-visitor-tracking.md) | 2026-11-14 | Трекер посещаемости: visit-tracker.js (13 HTML), track-visit/get-visits, visits.json (20000, дедуп 15с) |
| [S164](done/S164-status-section.md) | 2026-11-14 | Суперраздел «📋 Информация»: кнопка в шапке (цвет+цифры), «🚨 Проблемы» (автодиагностика) |
| [S165](done/S165-link-preserve-order.md) | 2026-11-14 | sanitizeSlides сохраняет item.id и порядок массива, дубликаты через Set |

**Волна 6 (закрыты 2026-11-09/10, задеплоены 2026-11-10):**

| Файл | Дата закрытия | Примечание |
|------|---------------|------------|
| [S140-critical-empty-db-overwrite](done/S140-critical-empty-db-overwrite.md) | 2026-11-09 | БД восстановлена; validateDbData() блокирует затирание |
| [S141-critical-table-shows-images](done/S141-critical-table-shows-images.md) | 2026-11-09 | Режим «Таблица» показывал картинки (корень — CSS, S143) |
| [S142-price-tiles-verify](done/S142-price-tiles-verify.md) | 2026-11-09 | Плитки цен/скидок — CSS верный, проблема была в пустой БД |
| [S143-css-hidden-comment-bug](done/S143-css-hidden-comment-bug.md) | 2026-11-09 | КОРНЕВОЙ CSS-баг 9 лет: вложенный комментарий ломал [hidden] |
| [S144-admin-trainer-row-buttons](done/S144-admin-trainer-row-buttons.md) | 2026-11-09 | Админка: кнопка ✏️ на всю строку, ФИО не видно |
| [S145-admin-templates-help-subsections](done/S145-admin-templates-help-subsections.md) | 2026-11-09 | Админка: подразделы «Шаблоны» и заглушки «Справка» |
| [S146-admin-trainer-photos-and-experience](done/S146-admin-trainer-photos-and-experience.md) | 2026-11-09 | Админка: фотоальбом тренера, стаж годами, подписи по категории |
| [S148-admin-templates-8-separate-sections](done/S148-admin-templates-8-separate-sections.md) | 2026-11-09 | «Шаблоны» — 8 отдельных разделов сайдбара |
| [S149-mobile-header-call-button](done/S149-mobile-header-call-button.md) | 2026-11-09 | Мобильная шапка: заказ звонка в меню, бургер доступен |
| [S150-mobile-schedule-day-carousel](done/S150-mobile-schedule-day-carousel.md) | 2026-11-09 | Мобильное расписание: 1 день + карусель (вкладки + свайп) |
| [S62-photo-album-carousel](done/S62-photo-album-carousel.md) | 2026-11-10 | Подтверждён тестами S62 в test-static |
| [S63-deploy-prep](done/S63-deploy-prep.md) | 2026-11-10 | Перекрыт S101; деплой выполнен |
| [S101](done/S101-deploy-prep.md) | 2026-11-10 | Деплой-подготовка: мерж баз, регламент, деплой волны выполнен |
| [S18-anchors-by-name](done/S18-anchors-by-name.md) | 2026-11-10 | Slug КИРИЛЛИЦЕЙ «как записано»: резолв точный+нестрогий, всё лишнее → 404, ссылки/после sitemap — slug. 32 теста. Принято пользователем |

**Мультитикеты (закрыты):**

| Файл | Дата закрытия | Тикетов | Примечание |
|------|---------------|---------|------------|
| [MULTITICKET-ADMIN-V2](done/MULTITICKET-ADMIN-V2.md) | 2026-11-07 | 8/8 | Все тикеты выполнены |
| [MULTITICKET-DATA](done/MULTITICKET-DATA.md) | 2026-11-07 | 6/6 | Все тикеты выполнены, build зелёный |
| [MULTITICKET-FIXES](done/MULTITICKET-FIXES.md) | 2026-11-07 | 11/20 | Все актуальные выполнены |
| [TICKET-STATIC-FIXES](done/TICKET-STATIC-FIXES.md) | 2026-11-07 | 3/3 | Все 3 раунда закрыты |

#### 🗑 Устаревшие (`trash/`)

| Файл | Причина |
|------|---------|
| [TICKET-F21-BRIDGE](trash/TICKET-F21-BRIDGE.md) | Устарел: упоминает системный PG вместо Docker |
| [AUDIT-CLIENT-PART](trash/AUDIT-CLIENT-PART.md) | Устарел: срез сессии 24 |
| [todo.md](trash/todo.md) | Устарел: Next.js 15, проект «shifu-panda», архитектура заменена |
| [project-analysis.md](trash/project-analysis.md) | Устарел: снапшот ранней архитектуры, дублируется |
| [SERVER-TASKS.md](trash/SERVER-TASKS.md) | Не относится к cfr-site, сам просит «не грузить в git» |
| [минусы.md](trash/минусы.md) | Пустой файл |
| [DEPLOY.md](trash/DEPLOY.md) | Устарел: дублирует AGENTS.md, содержит несуществующую `npm run static:export` |
| [MULTITICKET-DBSCHEMA](trash/MULTITICKET-DBSCHEMA.md) | Устарел: живая копия переехала в `definded/MULTITICKET.md` |
| [TICKET-DB-001](trash/TICKET-DB-001.md) | Устарел: живая копия — `definded/DB-001-crm-schema.md` |
| [TICKET-SECURITY-FIXES](trash/TICKET-SECURITY-FIXES.md) | Устарел: живые копии — `definded/SEC-01…10` |

#### 📖 Справочная информация (`info/`)

Не тикеты, а рабочие справочники. Владеющие тикеты указаны в колонке «Владелец».

| Файл | Владелец | Описание |
|------|----------|----------|
| [решения.md](../info/решения.md) | — | **Ключевые решения проекта**: 17 решений + Р1–Р3 волны 4. Указатель в `AGENTS.md` |
| [DANCESTUDIO-SCANS.md](../info/DANCESTUDIO-SCANS.md) | definded/MULTITICKET-DANCESTUDIO.md | Сканы XML-донора D1.1–D1.7 + маппинг PostgreSQL |
| [DANCESTUDIO-SCANS_analis.md](../info/DANCESTUDIO-SCANS_analis.md) | definded/MULTITICKET-DANCESTUDIO.md | Оценка структуры донора, DDL-решения, глобальные правила импорта |
| [DONOR-FORMAT-ANALYSIS.md](../info/DONOR-FORMAT-ANALYSIS.md) | definded/TICKET-DONOR-FORMAT.md | Анализ дисков-доноров, форматы DOCX, план работ |
| [SERVER-COMMANDS.md](../info/SERVER-COMMANDS.md) | — | Операционный справочник: деплой, PM2, NGINX, PostgreSQL, логи |

---

## 🛠 Команды для AI

### Выполнить тикет

```
Прочитай документ cfr-site/tickets/README.md
и выполни тикет <N>
```

Пример:
```
Прочитай документ cfr-site/tickets/README.md
и выполни тикет S101
```

### Продолжить

```
продолжай
```
Продолжает выполнение предыдущего тикета или очереди задач.

### Добавить задачу

```
добавь задачу:
- *{ пункт задачи 1 }
- { пункт задачи 2 }
- ...
- *{ пункт задачи N }
```

### Прибраться в задачах

```
приберись в задачах
```
Автоматически переносит выполненные тикеты в `done/`, обновляет индекс и архивирует.

---

## 📐 Правила тикет-системы

1. **Каждый тикет — отдельный файл.** Полная информация, шаги, критерии готовности.
2. **Полный контекст** — в теле каждого тикета. Не нужен внешний файл.
3. **Выполненные тикеты** переносятся в `tickets/done/*.md` с пометкой даты и результата.
4. **Спорные тикеты** (закрытие не подтверждено ЖУРНАЛОМ) остаются в `activ/` с пометкой ⚠️.
5. **Отложенные тикеты** — в `definded/`. Разморожены/выполнены — перенесены в `activ/`.
6. **Параллельная работа:** независимые тикеты можно выполнять параллельно (субагентами).
7. **Журнал:** после каждого тикета — в теле тикета.
