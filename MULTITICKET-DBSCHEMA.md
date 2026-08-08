# Мультитикет: Схема БД — синхронизация init.sql

## Описание
Файл `docker/init.sql` содержит DDL только для основных таблиц (контент, ЛК, миграции). В коде используются CRM-таблицы, которых нет в `init.sql`:
- `cfr_persons`, `cfr_clients`, `cfr_teachers`, `cfr_media`
- `cfr_styles`, `cfr_halls`, `cfr_branches`, `cfr_entities`
- `cfr_accounts`, `cfr_visits`, `cfr_reservations`
- `cfr_schedule_entries`, `cfr_transactions`, `cfr_tasks`, `cfr_messages`
- `cfr_pages`, `cfr_contacts`

Без этих таблиц PostgreSQL-режим не работает при чистой установке.

## Тикеты

### D1
Прочитай документ cfr-site/MULTITICKET-DBSCHEMA.md
и выполни тикет D1

---

### D1 — Собрать схему CRM-таблиц
**Задача:** Создать файл `docker/init-crm.sql` со всеми DDL для CRM-таблиц, которые используются в коде.

**Что сделать:**
1. Прочитать все API-маршруты в `src/app/api/` и `src/lib/postgres.ts`, чтобы понять структуру таблиц
2. Извлечь CREATE TABLE для всех CRM-таблиц
3. Создать `docker/init-crm.sql` с полными определениями таблиц
4. Обновить `docker-compose.yml`, чтобы подгружался `init-crm.sql` после `init.sql`

**Требования:**
- Все таблицы должны иметь primary key
- Внешние ключи должны ссылаться на существующие таблицы
- Добавить индексы для часто используемых полей (phone, person_id, created_at)
- Добавить комментарии к таблицам и полям
- Сохранить совместимость с существующими данными в db.json

**Результат:** `docker/init-crm.sql` + обновлённый `docker-compose.yml`
