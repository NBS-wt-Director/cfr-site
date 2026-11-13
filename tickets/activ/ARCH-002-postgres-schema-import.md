# ARCH-002 — Схема PostgreSQL + миграции + импорт db.json

> **Статус:** 📋 Запланирован (2026-11-14). Блокируется ARCH-001 (нужен контейнер db).
> Поставлен 2026-11-14.

## Постановка

Перенос **всех** данных сайта из файлов (`db.json`, `visits.json`, `leads.json`, сессии/пароль)
в PostgreSQL 17 (Docker, ARCH-001). Один источник истины — pg; файлы уходят в архив.

## ФАКТЫ

- Весь доступ к данным в `admin-server.mjs` идёт через **единую точку** `readDb()/saveDb()`
  (+ flattenDb/nestDb из `db-format.mjs`) — 60+ хендлеров видят только плоскую JSON-форму.
- `validateDbData()` (S140) блокирует затирание непустой базы пустой — логику сохраняем.
- `visits.json` — кольцевой буфер 20000 записей, дедуп 15 с, flush 1.5 с (`VISITS_*`).
- `leads.json` — заявки форм (S151), `emailSent/emailError` (S155).
- Сессии админки — `.admin-sessions.json` (токен→{expireAt}), пароль — sha256+salt в `.admin-password.json`.
- Прод-объёмы (2026-11-14): programs 33, trainers 13, album 982, sliders 29, priceItems 36,
  discounts 6, directions 8, schedule 2, news 1, events 1, staff 1, pages/sections/halls + 15 ключей settings.

## РЕШЕНИЕ — схема (~22 таблицы)

### Контент (нормализованные таблицы)
`news`, `events`, `programs`, `trainers`, `sliders`, `schedule`, `prices`, `price_items`,
`discounts`, `album`, `staff`, `directions`, `halls`, `pages`, `sections`
- PK `id bigint`; поля как в текущих сущностях; вложенности (`photoAlbum`, `overlay`,
  `textMargin`, `reviews`, `videos`, `scheduleStructured`) — **JSONB** (всегда читаются родителем целиком).
- Индексы: `hidden`, `date/dateStart`, `slug` (кириллические slug S18), `programId/trainerId`.
- Порядок слайдов/слайдеров — колонка `sort int` (drag&drop админки).

### Настройки — одна таблица
`settings(key text PK, value jsonb, updated_at)` — по строке на каждый из 15 ключей
(appearance, siteSettings, headerSettings, homeSections, footerLinks, sliderSettings,
emailConfig, contacts, sectionNames, priceItems-наследие…). Не плодить микротаблицы.

### Высокая запись
`visits(id bigserial, ts timestamptz, ip, sid, referer, url, page, section, ua, scr, lang)`
+ индексы `(ts)`, `(page, ts)`; ротация — `DELETE ... WHERE ts < now()-interval` по расписанию админки.
`leads(id, ts, name, phone, email, wish, message, page, reason, ua, status, email_sent, email_error)`.

### Служебное
`admin_password(id=1, salt, hash, changed_at)`, `admin_sessions(token PK, user, expires_at)`.

### Медиа
В pg — только пути (`uploads/…`). Файлы остаются на томе (решение ARCH-001, не меняется).

## ШАГИ

1. `scripts/pg/schema.sql` — DDL всех таблиц + комментарии (назначение, связь с тикетами S-*).
2. `scripts/pg/migrate.mjs` — применение схемы + таблица `schema_migrations` (идемпотентность).
3. `scripts/pg/import-db-to-pg.mjs` — разовый импорт из `db.json` (flattenDb) + `visits.json` +
   `leads.json` + пароля/сессий. Отчёт по строкам: «в файле N → в pg M». Транзакция: всё или ничего.
4. `scripts/pg/export-pg-to-json.mjs` — обратный дамп pg → db.json-форму (для сверок и ночного снапшота).
5. Сверка на реальной прод-базе (`/tmp/db.server.json`, бэкап `backups/db.json.PROD.20261114-030230.json`):
   импорт → export → deep-equal с оригиналом (кроме служебных полей). Расхождений — 0.
6. `pg_dump` регламент: бэкап в `backups/` перед каждым импортом/миграцией (правило бэкапов сохраняется).

## КРИТЕРИИ ГОТОВОСТИ

- [ ] `migrate.mjs` идемпотентен (повторный запуск = no-op)
- [ ] `import-db-to-pg.mjs` на прод-копии: все счётчики совпали, deep-equal export↔оригинал
- [ ] visits/leads импортированы, индексы созданы, `EXPLAIN` выборки top-20 за неделю использует индекс
- [ ] Пароль/сессии в pg; файлы `.admin-*` больше не читаются (после ARCH-003)
- [ ] Схема задокументирована в `documentation/PGSCHEMA.md` (таблица→сущность сайта→тикет-источник)
- [ ] ni secrets, ni db.json-данных в schema.sql

## ЖУРНАЛ

- 2026-11-14: тикет создан (волна ARCH).
