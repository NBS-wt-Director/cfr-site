# Тикет DB-001: Добавить CRM-таблицы в docker/init.sql

## Проблема
В `docker/init.sql` описаны только базовые таблицы (trainers, programs, news, sliders, users и т.д.), но в коде проекта есть запросы к CRM-таблицам, которые не создаются при инициализации PostgreSQL.

## Какие таблицы отсутствуют в init.sql

Файл `src/lib/postgres.ts` выполняет запросы к следующим таблицам, которых нет в `init.sql`:

### CRM-сущности (транслируются из CRM)
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

## Что нужно сделать

1. **Изучить структуру таблиц** — посмотреть в существующих API-маршрутах (`src/app/api/*/route.ts`) как используются эти таблицы, какие поля запрашиваются.

2. **Создать DDL** — для каждой таблицы определить:
   - Основные поля (id, created_at, updated_at)
   - Связи (foreign keys)
   - Индексы для частых запросов
   - Типы полей

3. **Добавить в `docker/init.sql`** — после существующих таблиц, перед секцией «ИНДЕКСЫ».

4. **Проверить совместимость** — убедиться что DDL не конфликтует с текущим кодом API.

## Критерии готовности
- [ ] Все 16 CRM-таблиц добавлены в `docker/init.sql`
- [ ] Таблицы имеют корректные foreign keys и индексы
- [ ] `docker compose up -d` создаёт БД с полным набором таблиц
- [ ] API-маршруты работают с пустой базой (без ошибок «relation does not exist»)

## Заметки
- Таблицы `trainers`, `programs`, `news`, `sliders`, `schedule_items`, `prices`, `staff`, `sections`, `workouts`, `users`, `user_visits`, `user_payments`, `user_subscriptions`, `settings`, `db_meta` — УЖЕ есть в init.sql, их не нужно дублировать.
- Таблица `bridge_queue` — нужна для bridge-синхронизации (есть в `getTableCounts`).
- Таблица `db_meta` — нужна для миграций.
