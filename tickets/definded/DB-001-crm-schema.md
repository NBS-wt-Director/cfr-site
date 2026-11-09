# DB-001: CRM-таблицы в схеме PostgreSQL

> Источник: TICKET-DB-001.md + MULTITICKET-DBSCHEMA.md (объединены, дубль)
> Создан: 2026-11-07

## Проблема
В `docker/init.sql` описаны только базовые таблицы (trainers, programs, news, sliders, users и т.д.), но в коде есть запросы к CRM-таблицам, которые не создаются при инициализации PostgreSQL. Без них PostgreSQL-режим не работает при чистой установке.

## Отсутствующие таблицы (16 шт., из `src/lib/postgres.ts`)

| Таблица | Описание | Где используется |
|---------|----------|-----------------|
| `cfr_persons` | Люди (клиенты, тренеры, сотрудники) | API employees, trainers, autoupload |
| `cfr_clients` | Клиенты (связь persons + договоры) | API auth (LK), admin |
| `cfr_teachers` | Преподаватели (связь persons + специализация) | API trainers |
| `cfr_media` | Медиафайлы (привязка к сущностям) | API news, media |
| `cfr_styles` | Направления/стили | API programs, schedule |
| `cfr_halls` | Залы/площадки | API schedule, LK |
| `cfr_branches` | Филиалы | API employees |
| `cfr_entities` | Сущности расписания (мероприятия) | API schedule, programs |
| `cfr_accounts` | Лицевые счета (абонементы) | API LK profile |
| `cfr_visits` | Визиты/посещения | API LK profile, stats |
| `cfr_reservations` | Бронирования | API admin |
| `cfr_schedule_entries` | Записи расписания | API schedule, LK |
| `cfr_transactions` | Финансовые транзакции | API LK profile (payments) |
| `cfr_tasks` | Задачи/домашние задания | API LK profile (homework) |
| `cfr_messages` | Сообщения/уведомления | API admin |
| `cfr_pages` | Страницы сайта | API pages |
| `cfr_contacts` | Контакты | API contacts |

## Что сделать
1. **Изучить структуру** — посмотреть в API-маршрутах (`src/app/api/*/route.ts`) и `src/lib/postgres.ts` как используются таблицы, какие поля запрашиваются.
2. **Создать DDL** — для каждой таблицы: основные поля (id, created_at, updated_at), foreign keys, индексы (phone, person_id, created_at), типы полей, комментарии к таблицам и полям.
3. **Файл** — `docker/init-crm.sql` (отдельно от init.sql) + обновить `docker-compose.yml`, чтобы он подгружался после `init.sql`.
4. **Совместимость** — DDL не должен конфликтовать с текущим кодом API и данными db.json.

## Критерии готовности
- [ ] Все 16 CRM-таблиц в `docker/init-crm.sql` с PK, FK, индексами, комментариями
- [ ] `docker-compose.yml` подгружает `init-crm.sql` после `init.sql`
- [ ] `docker compose up -d` создаёт БД с полным набором таблиц
- [ ] API-маршруты работают с пустой базой (без ошибок «relation does not exist»)

## Заметки
- Таблицы `trainers`, `programs`, `news`, `sliders`, `schedule_items`, `prices`, `staff`, `sections`, `workouts`, `users`, `user_visits`, `user_payments`, `user_subscriptions`, `settings`, `db_meta` — УЖЕ есть в init.sql, не дублировать.
- `bridge_queue` — для bridge-синхронизации (есть в `getTableCounts`).
- `db_meta` — для миграций.
