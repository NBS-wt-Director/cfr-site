# Проектирование новой БД PostgreSQL — «ЦФР / Шифу Панда»

> **Тикет 1.4** | Дата: 2026-08-03
> **Источники:** json_schema.json, init.sql, db.ts/postgres.ts, todo.md/project-analysis.md
> **Принципы:** Плоские таблицы, 3NF, Persons-центричность, Enums, FK, JSONB только в bridge_queue и settings
> **Префикс:** `cfr_` | **Роли:** persons → clients/teachers/admins (FK 1:1) | **Сущности:** единая cfr_entities

---

## 1. Архитектура

### 1.1 Persons

```
cfr_persons (все люди)
    ├── cfr_clients (клиенты)
    ├── cfr_teachers (преподаватели)
    └── cfr_admins (администраторы / CRM)
```

В `cfr_persons`: ФИО, пол, дата рождения, телефоны, email, parent_person_id_1, parent_person_id_2 (ссылки на persons), адрес, заметки.
Без пароля, без роли.

### 1.2 Интеграция с сайтом

| Сущ. таблица | Действие |
|---|---|
| `users` | Остаётся. `cfr_persons.site_user_id` → `users.id` |
| `trainers` | → `cfr_teachers` (данные мигрируют) |
| `trainer_photos` | → `cfr_teacher_photos` |
| `user_subscriptions` | → `cfr_accounts` |
| `user_visits` | → `cfr_visits` |
| `user_payments` | → `cfr_transactions` |
| `staff` | Остаётся |
| `programs` | **Объединяется** с `cfr_styles` → `cfr_styles` |
| `pages.json` | → `cfr_pages` |
| `footer.json` | → `cfr_footer` + `cfr_footer_links` + `cfr_footer_social` + `cfr_footer_menu` |

### 1.3 Принципы

| Принцип | Описание |
|---|---|
| **Плоские таблицы** | Каждая таблица = одна сущность |
| **Persons-центричность** | Все люди → `cfr_persons`. Роли = FK 1:1 |
| **Единые сущности** | Группы/индивид. тренировки/аренда/массаж/сплит → `cfr_entities` |
| **Programs = Styles** | Одна таблица для маркетинга и внутренней категории |
| **JSONB только legacy** | `settings` (унаследована) и `bridge_queue` (мост) |
| **Сегментированные → единые** | SingleTraining001-014, Account+Account001 → единые таблицы |

---

## 2. ENUM-типы

```sql
CREATE TYPE cfr_payment_type AS ENUM ('cash','card','deposit','bonus','free','mixed','prepayment','transfer');
CREATE TYPE cfr_group_status AS ENUM ('admission','active','closed','paused');
CREATE TYPE cfr_hall_status AS ENUM ('active','inactive');
CREATE TYPE cfr_teacher_status AS ENUM ('active','inactive','fired');
CREATE TYPE cfr_product_status AS ENUM ('active','inactive','discontinued');
CREATE TYPE cfr_product_unit AS ENUM ('piece','hour','minute','day','session','month');
CREATE TYPE cfr_reservation_type AS ENUM ('group','individual','rent');
CREATE TYPE cfr_client_type AS ENUM ('new','existing');
CREATE TYPE cfr_tenant_type AS ENUM ('client','external');
CREATE TYPE cfr_reservation_status AS ENUM ('confirmed','cancelled','pending','checked_in','no_show','waitlist');
CREATE TYPE cfr_schedule_change_type AS ENUM ('cancel','move','replace');
CREATE TYPE cfr_sum_type AS ENUM ('target','replacement','bonus','penalty');
CREATE TYPE cfr_task_type AS ENUM ('call','meeting','other','payment','notification');
CREATE TYPE cfr_message_status AS ENUM ('pending','sent','delivered','failed','auth_failed');
CREATE TYPE cfr_message_target AS ENUM ('sms','viber','whatsapp','telegram','email');
CREATE TYPE cfr_transaction_type AS ENUM ('deposit_add','deposit_use','deposit_refund','bonus_add','bonus_use','bonus_expire','payment','charge','refund','adjustment');
CREATE TYPE cfr_entity_type AS ENUM ('group','individual','massage','split','rent');
CREATE TYPE cfr_online_type AS ENUM ('online','offline','hybrid');
CREATE TYPE cfr_bridge_packet_status AS ENUM ('received','processing','completed','error','retry_pending');
CREATE TYPE cfr_sex AS ENUM ('male','female','other');
CREATE TYPE cfr_record_status AS ENUM ('normal','removed','archived');
CREATE TYPE cfr_floor_type AS ENUM ('резина','мат','дерево','металл','бетон','линолиум','комбинированно');
```

---

## 1.4 Общий статус записей (для всех сущностей)

> **Правило:** каждая таблица данных имеет поле `status cfr_record_status` со значениями:
> - `normal` — активная запись
> - `removed` — удалённая запись (скрыта из UI, сохраняется для истории)
> - `archived` — архивированная запись (старые данные, неактивные абоненты)

Поле добавляется ко ВСЕМ сущностям данных. В справочниках (cfr_tags, cfr_informers и т.д.) — nullable (по умолчанию normal, без необходимости удаления).

### 1.5 Онлайн-формат и филиалы

> **`cfr_online_type`** — ENUM (`online` / `offline` / `hybrid`), default `'hybrid'`. Добавлен в `cfr_entities`.
> **`branch_id`** — FK → `cfr_branches(id)`. Добавлен в `cfr_entities`, `cfr_visits`, `cfr_reservations`, `cfr_schedule_entries`.
> NULL допустим только при `online_type = 'online'`.

### 1.6 Контакты филиала

> **`cfr_branches`** — добавлены поля: `address`, `phone`, `email`, `website`, `hours`, `hall_ids` (UUID[]).

---

## 3. Persons

### 3.1 `cfr_persons` — Люди

| Поле | Тип | Nullable | Default | Комментарий |
|---|---|---|---|---|
| id | UUID | NOT NULL | gen_random_uuid() | PK |
| site_user_id | INTEGER | YES | NULL | FK → `users(id)` — обратная совместимость |
| last_name | VARCHAR(255) | YES | NULL | Фамилия |
| first_name | VARCHAR(255) | YES | NULL | Имя |
| middle_name | VARCHAR(255) | YES | NULL | Отчество |
| sex | cfr_sex | YES | NULL | Пол |
| birth_date | DATE | YES | NULL | Дата рождения |
| mobile_phone | VARCHAR(20) | YES | NULL | Телефон |
| additional_phone | VARCHAR(20) | YES | NULL | Доп. телефон |
| email | VARCHAR(255) | YES | NULL | Email |
| avatar_url | VARCHAR(500) | YES | NULL | URL аватара |
| parent_person_id_1 | UUID | YES | NULL | FK → `cfr_persons(id)` — родитель 1 |
| parent_person_id_2 | UUID | YES | NULL | FK → `cfr_persons(id)` — родитель 2 |
| address | TEXT | YES | NULL | Адрес |
| notes | TEXT | YES | NULL | Общие заметки |
| status | cfr_record_status | NOT NULL | 'normal' | normal/removed/archived |
| created_at | TIMESTAMPTZ | NOT NULL | NOW() | |
| updated_at | TIMESTAMPTZ | NOT NULL | NOW() | |

**PK:** `id`
**FK:** `site_user_id` → `users(id)` ON DELETE SET NULL
**FK:** `parent_person_id_1` → `cfr_persons(id)` ON DELETE SET NULL
**FK:** `parent_person_id_2` → `cfr_persons(id)` ON DELETE SET NULL
**Индексы:** `idx_cfr_persons_phone` ON (mobile_phone), `idx_cfr_persons_email` ON (email), `idx_cfr_persons_site_user` ON (site_user_id), `idx_cfr_persons_name` ON (last_name, first_name)

---

## 4. Ролевые таблицы

### 4.1 `cfr_client_statuses` — Статусы клиентов (справочник)
> **Примечание:** справочники не требуют удаления/архивации (статус nullable, по умолчанию normal).
> **✅ Окончательно согласовано — не отменяется.**

| Поле | Тип | Nullable | Default |
|---|---|---|---|
| id | SERIAL | NOT NULL | — | PK |
| name | VARCHAR(100) | NOT NULL | — |
| slug | VARCHAR(50) | NOT NULL | — | UNIQUE |
| colour | VARCHAR(7) | YES | NULL | HEX |
| description | TEXT | YES | NULL |
| sort_order | INTEGER | NOT NULL | 0 |

### 4.2 `cfr_clients` — Клиенты

> FK 1:1 → `cfr_persons`. ФИО/контакты/родственники — в persons.
> **✅ Согласовано с правками — не отменяется.**

| Поле | Тип | Nullable | Default |
|---|---|---|---|
| person_id | UUID | NOT NULL | — | PK + FK → `cfr_persons(id)` CASCADE |
| agreement_number | INTEGER | YES | NULL | Номер договора |
| barcode | VARCHAR(100) | YES | NULL | Штрихкод |
| archive | BOOLEAN | NOT NULL | FALSE | |
| status_id | INTEGER | YES | NULL | FK → `cfr_client_statuses(id)` SET NULL |
| friend_person_id | UUID | YES | NULL | FK → `cfr_persons(id)` — кто привёл |
| id_foto | UUID | YES | NULL | UUID фото из донора |
| annotation | VARCHAR(200) | YES | NULL | |
| status | cfr_record_status | NOT NULL | 'normal' | normal/removed/archived |

### 4.3 `cfr_teachers` — Преподаватели

> FK 1:1 → `cfr_persons`. Слияние с `trainers` (сайт).
> **✅ Согласовано с правками — не отменяется.**
> **⚠️ Фильтры/триггеры:** experience/description/specialization — только plain text / markdown / HTML. Скрипты (`<script>`) и CSS (`<style>`, `style=""`) — режутся на входе.

| Поле | Тип | Nullable | Default |
|---|---|---|---|
| person_id | UUID | NOT NULL | — | PK + FK → `cfr_persons(id)` CASCADE |
| short_code | VARCHAR(10) | YES | NULL | КОБ, КАБ, ОИ (внутренний код) |
| status | cfr_teacher_status | NOT NULL | 'active' |
| own_salary_options | BOOLEAN | NOT NULL | FALSE |
| own_second_salary_options | BOOLEAN | NOT NULL | FALSE |
| id_foto | UUID | YES | NULL | UUID фото из донора |
| image | VARCHAR(500) | YES | NULL | URL (из trainers) |
| experience | VARCHAR(75) | YES | NULL | Опыт (plain/md/html, no script/css) |
| description | VARCHAR(75) | YES | NULL | Описание (plain/md/html, no script/css) |
| specialization | VARCHAR(75) | YES | NULL | Специализация (plain/md/html, no script/css) |
| is_director | BOOLEAN | NOT NULL | FALSE | |
| sort_order | INTEGER | NOT NULL | 0 | |
| status | cfr_record_status | NOT NULL | 'normal' | normal/removed/archived |

### 4.4 `cfr_teacher_photos` — Фото преподавателей (галерея)

> **⚠️ ЗАМЕНЕНО на универсальную таблицу `cfr_media` (см. 4.4a).**
> Эта таблица сохраняется как частный случай — `entity_type = 'teacher'`.
> **✅ Согласовано с правками — не отменяется.**

| Поле | Тип | Nullable | Default |
|---|---|---|---|
| id | SERIAL | NOT NULL | — | PK |
| teacher_person_id | UUID | NOT NULL | — | FK → `cfr_teachers(person_id)` CASCADE |
| image | VARCHAR(500) | NOT NULL | — | |
| caption | VARCHAR(75) | YES | NULL | |
| position | INTEGER | NOT NULL | 0 | |

---

### 4.4a `cfr_media` — Универсальная медиа-таблица (все объекты)

> **Универсальная таблица медиа для всех объектов:** тренеры, тренировки, программы, типы программ, залы, люди, слайды, новости.
> **Каждый объект может иметь:** главное фото (is_main = true) + альбомы.
> У тренеров: 2 альбома — `photos` и `certificates`.
> Альбом = массив объектов cfr_media (связь по entity_id + entity_type).
> **Защита от дублирования:** при копировании фото создаётся новый объект с тем же `file_path` на диске (hard link / symlink / ссылка на существующий файл).
> **✅ Согласовано с правками — не отменяется.**

| Поле | Тип | Nullable | Default | Комментарий |
|---|---|---|---|---|
| id | BIGSERIAL | NOT NULL | — | PK |
| entity_type | VARCHAR(75) | NOT NULL | — | ENUM: teacher/hall/person/style/entity/news/slider/page/program/product |
| entity_id | UUID | NOT NULL | — | FK → соответствующей таблице |
| file_path | VARCHAR(500) | NOT NULL | — | Путь к файлу на диске |
| original_filename | VARCHAR(255) | YES | NULL | Исходное имя |
| caption | VARCHAR(255) | YES | NULL | Подпись (text/md/html) |
| position | INTEGER | NOT NULL | 0 | Позиция в альбоме / галерее |
| is_main | BOOLEAN | NOT NULL | FALSE | Главное фото (защита: не удалять, пока есть связанные объекты) |
| width | INTEGER | YES | NULL | Ширина px |
| height | INTEGER | YES | NULL | Высота px |
| file_size | BIGINT | YES | NULL | Размер в байтах |
| created_at | TIMESTAMPTZ | NOT NULL | NOW() | |
| status | cfr_record_status | NOT NULL | 'normal' | normal/removed/archived |

**FK:** `entity_id` → соответствующей таблице по `entity_type` (ON DELETE CASCADE)

**Индексы:** `idx_cfr_media_entity` ON (entity_type, entity_id), `idx_cfr_media_position` ON (entity_type, entity_id, position), `idx_cfr_media_main` ON (entity_type, entity_id, is_main)

**Функция смены позиции:**
```sql
CREATE OR REPLACE FUNCTION cfr_reorder_media(p_entity_type VARCHAR(75), p_entity_id UUID, p_item_id BIGINT, p_new_position INTEGER)
RETURNS VOID AS $$
DECLARE
    v_old_position INTEGER;
    v_direction INTEGER;
BEGIN
    SELECT position INTO v_old_position FROM cfr_media WHERE id = p_item_id;
    v_direction := CASE WHEN p_new_position > v_old_position THEN 1 ELSE -1 END;
    UPDATE cfr_media
    SET position = position - v_direction
    WHERE entity_type = p_entity_type
      AND entity_id = p_entity_id
      AND position BETWEEN LEAST(v_old_position, p_new_position) AND GREATEST(v_old_position, p_new_position)
      AND position != v_old_position;
    UPDATE cfr_media SET position = p_new_position WHERE id = p_item_id;
END;
$$ LANGUAGE plpgsql;
```

**Триггер на is_main:**
```sql
CREATE OR REPLACE FUNCTION cfr_check_main_media()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_main = TRUE THEN
        UPDATE cfr_media SET is_main = FALSE
        WHERE entity_type = NEW.entity_type
          AND entity_id = NEW.entity_id
          AND id != NEW.id
          AND is_main = TRUE;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 4.5 `cfr_admins` — Администраторы (CRM)

> Пароль bcrypt (не MD5!). Для будущей CRM.
> **✅ Согласовано с правками — не отменяется.**
> **Учёт зарплаты:** дата/время входа + дата/время выхода + список всех операций в системе (кто, когда, тип операции) + ставка почасовая.
> **Пароль:** 6 цифр. **Логин:** 3-7 символов.

| Поле | Тип | Nullable | Default |
|---|---|---|---|
| person_id | UUID | NOT NULL | — | PK + FK → `cfr_persons(id)` CASCADE |
| login | VARCHAR(7) | NOT NULL | — | 3-7 символов |
| password_hash | VARCHAR(255) | NOT NULL | — | bcrypt |
| password_md5 | VARCHAR(32) | YES | NULL | MD5 legacy |
| is_root | BOOLEAN | NOT NULL | FALSE |
| rights | JSONB | YES | NULL | Права (расширяемая структура) |
| last_login_at | TIMESTAMPTZ | YES | NULL | |
| last_computer_id | VARCHAR(255) | YES | NULL | |
| status | VARCHAR(50) | NOT NULL | 'active' | |
| status | cfr_record_status | NOT NULL | 'normal' | normal/removed/archived |

**UNIQUE:** `login`

---

## 5. Справочные таблицы

### 5.1 `cfr_branches` — Филиалы (1 запись)
> **✅ Согласовано — не отменяется.** (name = VARCHAR(255), разные сущности — не трогаем)
> **Альбом фото:** через `cfr_media` с `entity_type = 'branch'`.
| Поле | Тип | Nullable | Default |
|---|---|---|---|
| id | UUID | NOT NULL | — | PK |
| name | VARCHAR(255) | NOT NULL | — |
| status | cfr_record_status | NOT NULL | 'normal' | normal/removed/archived |
| address | TEXT | YES | NULL | Адрес филиала |
| phone | VARCHAR(50) | YES | NULL | Основной телефон |
| email | VARCHAR(255) | YES | NULL | Email филиала |
| website | VARCHAR(500) | YES | NULL | URL сайта |
| hours | VARCHAR(11)[7] | YES | NULL | График работы (7 дней, формат "HH:MM-HH:MM") |
| hall_ids | UUID[] | YES | NULL | Перечень UUID залов этого филиала |
| created_at | TIMESTAMPTZ | NOT NULL | NOW() | |

### 5.2 `cfr_halls` — Залы (2 записи)
> **✅ Согласовано с правками — не отменяется.**
> **Альбом фото:** через `cfr_media` с `entity_type = 'hall'`.
| Поле | Тип | Nullable | Default | Комментарий |
|---|---|---|---|---|
| id | UUID | NOT NULL | — | PK |
| name | VARCHAR(75) | NOT NULL | — | |
| branch_id | UUID | YES | NULL | FK → `cfr_branches(id)` — филиал + контактные данные |
| status | cfr_hall_status | NOT NULL | 'active' | |
| can_combine | BOOLEAN | NOT NULL | FALSE | Совмещение тренировок |
| floor_type | cfr_floor_type | NOT NULL | 'мат' | ENUM: резина/мат/дерево/металл/бетон/линолиум/комбинированно |
| max_capacity | INTEGER | NOT NULL | 500 | Вместимость (чел.), не более 5000 |
| area_sqm | NUMERIC(6,1) | YES | NULL | Площадь (м²) |
| status | cfr_record_status | NOT NULL | 'normal' | normal/removed/archived |

### 5.3 `cfr_styles` — Стили = Programs (123 записи)

> **Объединено с `programs`:** `programs` (сайт) и стили DanceStudio — одна сущность, две стороны.
> `programs` — маркетинговое название, `cfr_styles` — внутренняя категория.
> **✅ Согласовано с правками — не отменяется.**

| Поле | Тип | Nullable | Default |
|---|---|---|---|
| id | UUID/SERIAL | NOT NULL | — | PK |
| name | VARCHAR(75) | NOT NULL | — | Внутреннее название |
| client_name | VARCHAR(75) | YES | NULL | Клиентское/маркетинговое название |
| description | VARCHAR(155) | YES | NULL | Описание (из programs) |
| type | VARCHAR(75) | YES | NULL | Тип программы (из programs) |
| status | cfr_record_status | NOT NULL | 'normal' | normal/removed/archived |

**UNIQUE:** `name`

### 5.4 `cfr_tags` — Теги (11 записей)
> **✅ Согласовано с правками — не отменяется.**
| Поле | Тип | Nullable | Default |
|---|---|---|---|
| id | UUID | NOT NULL | — | PK |
| name | VARCHAR(75) | NOT NULL | — |
| colour | VARCHAR(8) | YES | NULL |
| position | INTEGER | NOT NULL | 0 |
| description | VARCHAR(155) | YES | NULL |
| status | cfr_record_status | NULL | 'normal' | normal/removed/archived |

### 5.5 `cfr_informers` — Источники (7 записей)
> **✅ Согласовано с правками — не отменяется.**
| Поле | Тип | Nullable | Default |
|---|---|---|---|
| id | UUID | NOT NULL | — | PK |
| name | VARCHAR(75) | NOT NULL | — |
| status | cfr_record_status | NULL | 'normal' | normal/removed/archived |

### 5.6 `cfr_reservation_statuses` — Статусы брони (53 записи)
> **✅ ENUM — не отменяется.** (убираем грязь VARCHAR)
| Поле | Тип | Nullable | Default |
|---|---|---|---|
| id | UUID | NOT NULL | — | PK |
| name | VARCHAR(75) | NOT NULL | — |
| colour | VARCHAR(8) | YES | NULL |
| position | INTEGER | NOT NULL | 0 |
| description | VARCHAR(155) | YES | NULL |
| status | cfr_record_status | NULL | 'normal' | normal/removed/archived |

### 5.7 `cfr_teacher_balance_types` — Типы баланса тренеров (5 записей)
> **✅ Оптимизировано — не отменяется.** (удалены избыточные поля, short_name = slug)
| Поле | Тип | Nullable | Default |
|---|---|---|---|
| id | UUID | NOT NULL | — | PK |
| name | VARCHAR(75) | NOT NULL | — |
| slug | VARCHAR(50) | NOT NULL | — | UNIQUE, short_name |
| factor | DECIMAL(5,2) | NOT NULL | 1 | Множитель расчёта |
| annotation | VARCHAR(155) | YES | NULL | |
| status | cfr_record_status | NULL | 'normal' | normal/removed/archived |

### 5.8 `cfr_charges` — Статьи расходов (6 записей)
> **✅ 255 — админам с запасом. Не отменяется.**
| Поле | Тип | Nullable | Default |
|---|---|---|---|
| id | UUID | NOT NULL | — | PK |
| name | VARCHAR(255) | NOT NULL | — |
| description | VARCHAR(255) | YES | NULL |
| annotation | VARCHAR(255) | YES | NULL |
| status | cfr_record_status | NULL | 'normal' | normal/removed/archived |

### 5.9 `cfr_products` — Товары (51 запись)
> **✅ Согласовано с правками — не отменяется.**
| Поле | Тип | Nullable | Default |
|---|---|---|---|
| id | UUID | NOT NULL | — | PK |
| name | VARCHAR(75) | NOT NULL | — |
| barcode | VARCHAR(100) | YES | NULL |
| measurement | VARCHAR(75) | YES | NULL |
| unit | cfr_product_unit | YES | NULL |
| status | cfr_product_status | NOT NULL | 'active' |
| purchase_cost | INTEGER | NOT NULL | 0 | коп. |
| markup | INTEGER | NOT NULL | 0 | коп. |
| markup_percent | INTEGER | NOT NULL | 0 |
| annotation | VARCHAR(155) | YES | NULL |
| status | cfr_record_status | NULL | 'normal' | normal/removed/archived |

---

## 6. Основные бизнес-таблицы

> **Единая сущность:** группы / индивидуальные тренировки / аренда / массаж / сплит → `cfr_entities` с полем `entity_type`.

### 6.1 `cfr_entities` — Единая таблица сущностей

> **Объединяет:** группы + индивидуальные тренировки + аренда + массаж + сплит
> **Источники:** Group.xml (157) + IndividualTraining.xml (2112) + Rent.xml (73)
> **✅ Согласовано с правками — не отменяется.**

| Поле | Тип | Nullable | Default | Комментарий |
|---|---|---|---|---|
| id | UUID | NOT NULL | — | PK |
| entity_type | cfr_entity_type | NOT NULL | 'group' | group/individual/massage/split/rent |
| online_type | cfr_online_type | NOT NULL | 'hybrid' | online/offline/hybrid — тип проведения |
| name | VARCHAR(75) | YES | NULL | Название |
| style_id | UUID | YES | NULL | FK → `cfr_styles(id)` |
| teacher_person_id | UUID | YES | NULL | FK → `cfr_persons(id)` — преподаватель |
| hall_id | UUID | YES | NULL | FK → `cfr_halls(id)` — зал |
| branch_id | UUID | YES | NULL | FK → `cfr_branches(id)` — филиал; NULL только если online_type = 'online' |
| status | cfr_record_status | NOT NULL | 'normal' | normal/removed/archived |
| colour | VARCHAR(8) | YES | NULL | ARGB-цвет |
| max_capacity | INTEGER | NOT NULL | 100 | group=100, individual/massage=1, split=6, rent=20, max 5000 |
| price_per_session | DECIMAL(5,2) | YES | NULL | Цена за занятие |
| created_at | TIMESTAMPTZ | NOT NULL | NOW() | |
| updated_at | TIMESTAMPTZ | NOT NULL | NOW() | |

**Индексы:** `idx_cfr_entities_type` ON (entity_type), `idx_cfr_entities_teacher` ON (teacher_person_id), `idx_cfr_entities_style` ON (style_id), `idx_cfr_entities_hall` ON (hall_id)

> **⚠️ own_salary_options / own_second_salary_options удалены из cfr_entities.**
> Это поля были унаследованы из старых таблиц. Смысл: флаг, что преподаватель имеет особые условия оплаты.
> **Если нужно — создай тикет на поиск правды.** Иначе — ок, оставим.

### 6.2 `cfr_accounts` — Абонементы

> **Источники:** Account.xml (3275) + IndividualAccount.xml (105) + RentAccount.xml (3) + user_subscriptions (сайт)
> **Привязка к сущности:** через entity_id + entity_type
> **✅ Согласовано с правками — не отменяется.**

| Поле | Тип | Nullable | Default |
|---|---|---|---|
| id | UUID | NOT NULL | — | PK |
| number | INTEGER | NOT NULL | — | Номер |
| person_id | UUID | NOT NULL | — | FK → `cfr_persons(id)` CASCADE |
| entity_id | UUID | YES | NULL | FK → `cfr_entities(id)` |
| entity_type | cfr_entity_type | YES | NULL | Тип сущности абонемента |
| account_type_name | VARCHAR(75) | YES | NULL | |
| account_type_cost | DECIMAL(5,2) | NOT NULL | 0 | |
| original_cost | DECIMAL(5,2) | NOT NULL | 0 | |
| discount | DECIMAL(5,2) | NOT NULL | 0 | |
| discount_percent | DECIMAL(2,2) | NOT NULL | 0 | |
| payment_type | cfr_payment_type | NOT NULL | 'cash' | |
| create_date | DATE | NOT NULL | — | |
| begin_date | DATE | YES | NULL | |
| days_count | INTEGER | YES | NULL | Дней |
| add_days_count | INTEGER | NOT NULL | 0 | Добавлено дней |
| training_count | INTEGER | NOT NULL | 0 | Кол-во занятий |
| free_training_count | INTEGER | NOT NULL | 0 | Бесплатных |
| is_perpetual | BOOLEAN | NOT NULL | FALSE | |
| is_unlimited | BOOLEAN | NOT NULL | FALSE | |
| annotation | VARCHAR(155) | YES | NULL | |
| account_status | VARCHAR(50) | NOT NULL | 'active' | active/expired/frozen/cancelled |
| source | VARCHAR(50) | NOT NULL | 'dancestudio' | dancestudio/site/crm |
| status | cfr_record_status | NOT NULL | 'normal' | normal/removed/archived |
| created_at | TIMESTAMPTZ | NOT NULL | NOW() | |
| updated_at | TIMESTAMPTZ | NOT NULL | NOW() | |

**FK:** `entity_id` → `cfr_entities(id)` ON DELETE SET NULL
**Индексы:** `idx_cfr_accounts_person` ON (person_id), `idx_cfr_accounts_entity` ON (entity_id, entity_type)

### 6.3 `cfr_visits` — Визиты (крупнейшая таблица, 71873+)

> **Источники:** SingleTraining.xml + 14 партиций (71873) + user_visits (сайт)
> **Привязка к сущности:** через entity_id + entity_type
> **✅ Согласовано с правками — не отменяется.**

| Поле | Тип | Nullable | Default |
|---|---|---|---|
| id | UUID | NOT NULL | — | PK |
| visit_date | DATE | NOT NULL | — | |
| person_id | UUID | NOT NULL | — | FK → `cfr_persons(id)` CASCADE |
| entity_id | UUID | YES | NULL | FK → `cfr_entities(id)` |
| entity_type | cfr_entity_type | YES | NULL | Тип сущности |
| branch_id | UUID | YES | NULL | FK → `cfr_branches(id)` — филиал; NULL только если online_type = 'online' |
| account_id | UUID | YES | NULL | FK → `cfr_accounts(id)` SET NULL |
| cost | DECIMAL(5,2) | NOT NULL | 0 | |
| payment_type | cfr_payment_type | NOT NULL | 'cash' | |
| training_type_name | VARCHAR(75) | YES | NULL | |
| training_type_cost | DECIMAL(5,2) | NOT NULL | 0 | |
| annotation | TEXT | YES | NULL | С фильтром: no script, no css |
| source | VARCHAR(50) | NOT NULL | 'dancestudio' | |
| status | cfr_record_status | NOT NULL | 'normal' | normal/removed/archived |
| created_at | TIMESTAMPTZ | NOT NULL | NOW() | |

**FK:** `entity_id` → `cfr_entities(id)` ON DELETE SET NULL
**FK:** `account_id` → `cfr_accounts(id)` ON DELETE SET NULL
**Индексы:** `idx_cfr_visits_person` ON (person_id), `idx_cfr_visits_date` ON (visit_date), `idx_cfr_visits_person_date` ON (person_id, visit_date), `idx_cfr_visits_entity` ON (entity_id, entity_type), `idx_cfr_visits_account` ON (account_id)

### 6.4 `cfr_reservations` — Бронирования (40 записей)
> **✅ Оптимизировано — не отменяется.** (ФИО сокращены для экономии места, но влезут)
| Поле | Тип | Nullable | Default |
|---|---|---|---|
| id | UUID | NOT NULL | — | PK |
| reservation_type | cfr_reservation_type | NOT NULL | 'group' |
| status_id | UUID | YES | NULL | FK → `cfr_reservation_statuses(id)` |
| person_id | UUID | YES | NULL | FK → `cfr_persons(id)` SET NULL |
| entity_id | UUID | YES | NULL | FK → `cfr_entities(id)` SET NULL |
| entity_type | cfr_entity_type | YES | NULL | |
| last_name | VARCHAR(50) | YES | NULL | Для новых (оптимизировано) |
| first_name | VARCHAR(50) | YES | NULL | |
| birth_date | DATE | YES | NULL | |
| mobile_phone | VARCHAR(20) | YES | NULL | |
| client_type | cfr_client_type | NOT NULL | 'new' | |
| reservation_time | TIMESTAMPTZ | YES | NULL | |
| parent_last_name | VARCHAR(50) | YES | NULL | |
| parent_mobile_phone | VARCHAR(20) | YES | NULL | |
| comments | VARCHAR(155) | YES | NULL | |
| branch_id | UUID | YES | NULL | FK → `cfr_branches(id)` — филиал; NULL только если online_type = 'online' |
| status | cfr_record_status | NULL | 'normal' | normal/removed/archived |

### 6.5 `cfr_schedule_changes` — Изменения расписания и замены преподавателей

> **Объединено:** ScheduleChange.xml (1751) + Substitute.xml (276) — суть одна (логика смен расписания).
> **✅ Согласовано с правками — не отменяется.**
> **Триггер/логика замен:** см. раздел 11.3.

| Поле | Тип | Nullable | Default | Комментарий |
|---|---|---|---|---|
| id | UUID | NOT NULL | — | PK |
| entity_id | UUID | YES | NULL | FK → `cfr_entities(id)` |
| entity_type | cfr_entity_type | YES | NULL | Тип сущности |
| change_time | TIMESTAMPTZ | NOT NULL | — | Время изменения |
| change_type | cfr_schedule_change_type | NOT NULL | 'cancel' | cancel=не провёл, move=перенёс, replace=заменил |
| change_date_time | TIMESTAMPTZ | YES | NULL | Дата/время тренировки (для cancel/move) |
| new_date_time | TIMESTAMPTZ | YES | NULL | Новая дата/время (для move) |
| reason | VARCHAR(155) | YES | NULL | Причина (для cancel/move/replace) |
| original_teacher_person_id | UUID | YES | NULL | FK → `cfr_persons(id)` — заменяемый тренер |
| replacement_candidates | UUID[] | YES | NULL | Массив UUID тренеров-кандидатов |
| replacement_teacher_person_id | UUID | YES | NULL | FK → `cfr_persons(id)` — конкретный заменяющий тренер |
| sum_type | cfr_sum_type | YES | NULL | Тип начисления (для замен) |
| status | cfr_record_status | NULL | 'normal' | normal/removed/archived |

**Логика замен (триггер/процедура):**
1. **cancel** — просто отменяем. Если нужно — вводим `reason`.
2. **move** — указываем `new_date_time`. Если нужно — вводим `reason`.
3. **replace** — сложнее:
   - `original_teacher_person_id` — заменяемый тренер
   - `replacement_candidates` — массив тренеров для замены (те, кто ведёт программы этого же типа ЛИБО ходит к заменяемому — триггер подберёт автоматически)
   - `replacement_teacher_person_id` — конкретный тренер, который заменит
   - Если `replacement_candidates` пуст — БД автоматически ставит `change_type = 'cancel'` и возвращает серверу сообщение об отмене (сервер оповещает администратора)
   - Если нужно — вводим `reason`

---

### 6.6 `cfr_notes` — Заметки (37 записей)
> **✅ TEXT с фильтром (заметки разной длины, но no script/css). Не отменяется.**
| Поле | Тип | Nullable | Default |
|---|---|---|---|
| id | UUID | NOT NULL | — | PK |
| text | TEXT | NOT NULL | — | С фильтром: no script, no css |
| closed | BOOLEAN | NOT NULL | FALSE |
| colour | VARCHAR(8) | YES | NULL |
| note_date | TIMESTAMPTZ | YES | NULL |
| close_date | TIMESTAMPTZ | YES | NULL |
| status | cfr_record_status | NULL | 'normal' | normal/removed/archived |

### 6.7 `cfr_tasks` — Задачи (7 записей)
> **✅ VARCHAR(255) — задачи обычно короткие, но с запасом. Не отменяется.**
| Поле | Тип | Nullable | Default |
|---|---|---|---|
| id | UUID | NOT NULL | — | PK |
| text | VARCHAR(255) | NOT NULL | — | |
| closed | BOOLEAN | NOT NULL | FALSE |
| task_type | cfr_task_type | NOT NULL | 'other' |
| creator_person_id | UUID | YES | NULL | FK → `cfr_persons(id)` |
| closer_person_id | UUID | YES | NULL | FK → `cfr_persons(id)` |
| assignee_person_id | UUID | YES | NULL | FK → `cfr_persons(id)` |
| task_time | TIMESTAMPTZ | YES | NULL |
| close_time | TIMESTAMPTZ | YES | NULL |
| status | cfr_record_status | NULL | 'normal' | normal/removed/archived |

### 6.8 `cfr_messages` — Сообщения (121 запись)
> **✅ TEXT с фильтром — оптимально: разные каналы (SMS 160, WhatsApp 4096, Telegram 4096, email — без лимита). Не отменяется.**
| Поле | Тип | Nullable | Default |
|---|---|---|---|
| id | UUID | NOT NULL | — | PK |
| person_id | UUID | YES | NULL | FK → `cfr_persons(id)` SET NULL |
| target | cfr_message_target | NOT NULL | 'sms' |
| phone | VARCHAR(20) | YES | NULL |
| text | TEXT | NOT NULL | — | С фильтром: no script, no css |
| status | cfr_message_status | NOT NULL | 'pending' |
| cost | VARCHAR(50) | YES | NULL |
| message_time | TIMESTAMPTZ | YES | NULL |
| status | cfr_record_status | NULL | 'normal' | normal/removed/archived |

---

## 7. Таблицы связей (M:N)

> **✅ 7.1-7.6 — согласовано полностью, не отменяется.**

### 7.1 `cfr_client_tags` — Клиенты ↔ Теги
**PK:** (person_id, tag_id). FK CASCADE.

### 7.2 `cfr_client_informers` — Клиенты ↔ Источники
**PK:** (person_id, informer_id). FK CASCADE.

### 7.3 `cfr_group_clients` — Состав сущностей
> Связь человек ↔ сущность (группа, индивидуальная тренировка, аренда...)

| Поле | Тип | Nullable | Default |
|---|---|---|---|
| entity_id | UUID | NOT NULL | — | FK → `cfr_entities(id)` CASCADE |
| entity_type | cfr_entity_type | NOT NULL | — | |
| person_id | UUID | NOT NULL | — | FK → `cfr_persons(id)` CASCADE |
| joined_at | TIMESTAMPTZ | YES | NULL | |
| left_at | TIMESTAMPTZ | YES | NULL | NULL = активен |

**PK:** (entity_id, entity_type, person_id)

### 7.4 `cfr_teacher_styles` — Преподаватели ↔ Стили
**PK:** (person_id, style_id). FK CASCADE.

### 7.5 `cfr_account_groups` — Абонементы ↔ Группы
**PK:** (account_id, group_id). FK CASCADE.

### 7.6 `cfr_card_uses` — Использование карт

| Поле | Тип | Nullable | Default |
|---|---|---|---|
| id | BIGSERIAL | NOT NULL | — | PK |
| person_id | UUID | YES | NULL | FK → `cfr_persons(id)` |
| card_data | VARCHAR(75) | NOT NULL | — |
| used_at | TIMESTAMPTZ | YES | NULL | |
| created_at | TIMESTAMPTZ | NOT NULL | NOW() | |
| status | cfr_record_status | NOT NULL | 'normal' | normal/removed/archived |

---

## 8. Финансовые таблицы

### 8.1 `cfr_transactions` — Транзакции (единая)

> **Источники:** Bonus/Deposit (из донора) + user_payments (сайт)
> **✅ Согласовано с правками — не отменяется.**

| Поле | Тип | Nullable | Default |
|---|---|---|---|
| id | BIGSERIAL | NOT NULL | — | PK |
| person_id | UUID | YES | NULL | FK → `cfr_persons(id)` CASCADE |
| transaction_type | cfr_transaction_type | NOT NULL | — |
| amount | DECIMAL(5,2) | NOT NULL | 0 | |
| balance_after | DECIMAL(5,2) | YES | NULL | |
| account_id | UUID | YES | NULL | FK → `cfr_accounts(id)` SET NULL |
| visit_id | UUID | YES | NULL | FK → `cfr_visits(id)` SET NULL |
| description | VARCHAR(100) | YES | NULL | |
| source | VARCHAR(50) | NOT NULL | 'dancestudio' |
| transaction_date | TIMESTAMPTZ | NOT NULL | NOW() | |
| status | cfr_record_status | NOT NULL | 'normal' | normal/removed/archived |

### 8.2 `cfr_account_stages` — Этапы абонементов
> **✅ Согласовано с правками — не отменяется.**
| Поле | Тип | Nullable | Default |
|---|---|---|---|
| id | BIGSERIAL | NOT NULL | — | PK |
| account_id | UUID | NOT NULL | — | FK → `cfr_accounts(id)` CASCADE |
| stage_name | VARCHAR(50) | YES | NULL | |
| stage_data | VARCHAR(155) | YES | NULL | |
| sort_order | INTEGER | NOT NULL | 0 | |
| status | cfr_record_status | NOT NULL | 'normal' | normal/removed/archived |

---

## 9. Контентные таблицы сайта

### 9.1 Существующие (без изменений)
```
program_photos, program_trainers, program_workouts — программы
news, sliders, schedule_items, prices, staff, sections, workouts
settings (JSONB key-value), db_meta, users (обратная совместимость)
```

### 9.2 `cfr_pages` — Ручные страницы (из data/pages.json)
> **✅ Согласовано с правками — не отменяется.**
> **⚠️ Фильтры и триггеры:** content = только md/html! NO SCRIPT! NO CSS! NO ANY inline styles or event handlers!
> Все `<script>`, `<style>`, `on*=""`, `style=""` — режутся на входе через regex/HTML-санитайзер.

| Поле | Тип | Nullable | Default |
|---|---|---|---|
| id | VARCHAR(100) | NOT NULL | — | PK |
| slug | VARCHAR(200) | NOT NULL | — | UNIQUE |
| title | VARCHAR(75) | NOT NULL | — |
| content | VARCHAR(75) | YES | NULL | Markdown/HTML (no script, no css, no style attrs) |
| media | VARCHAR(155) | YES | NULL | |
| enabled | BOOLEAN | NOT NULL | TRUE |
| sort_order | INTEGER | NOT NULL | 0 |
| status | cfr_record_status | NOT NULL | 'normal' | normal/removed/archived |

### 9.3 `cfr_contacts` — Контакты (из settings JSONB)
> **✅ Согласовано с правками — не отменяется.**
| Поле | Тип | Nullable | Default |
|---|---|---|---|
| id | SERIAL | NOT NULL | — | PK |
| type | VARCHAR(50) | NOT NULL | — | phone/email/address |
| value | VARCHAR(75) | NOT NULL | — |
| label | VARCHAR(75) | YES | NULL |
| sort_order | INTEGER | NOT NULL | 0 |
| status | cfr_record_status | NOT NULL | 'normal' | normal/removed/archived |

---

## 10. Инфраструктурные таблицы

### 10.1 `cfr_user_photos` — Фотографии (устаревшая, замещена `cfr_media`)
> **Замещена на `cfr_media` (раздел 4.4a).** Таблица оставлена для обратной совместимости.
> **✅ Согласовано — не отменяется.**

| Поле | Тип | Nullable | Default |
|---|---|---|---|
| id | BIGSERIAL | NOT NULL | — | PK |
| person_id | UUID | YES | NULL | FK → `cfr_persons(id)` SET NULL |
| original_uuid | UUID | YES | NULL | UUID фото из донора |
| image_url | VARCHAR(500) | NOT NULL | — | WebP основной |
| thumbnail_url | VARCHAR(500) | YES | NULL | 200×200 WebP |
| medium_url | VARCHAR(500) | YES | NULL | 640×640 WebP |
| original_filename | VARCHAR(255) | YES | NULL |
| width | INTEGER | YES | NULL |
| height | INTEGER | YES | NULL |
| file_size | INTEGER | YES | NULL |
| format | VARCHAR(10) | NOT NULL | 'webp' |
| user_id | INTEGER | YES | NULL | FK → `users(id)` (обратная совместимость) |
| created_at | TIMESTAMPTZ | NOT NULL | NOW() | |
| status | cfr_record_status | NOT NULL | 'normal' | normal/removed/archived |

**Хранение:** `storage/photos/{person_uuid}.webp`, `_thumb.webp`, `_medium.webp`

### 10.2 `cfr_schedule_entries` — Расписание (нормализованное)
| Поле | Тип | Nullable | Default |
|---|---|---|---|
| id | BIGSERIAL | NOT NULL | — | PK |
| entity_id | UUID | NOT NULL | — | FK → `cfr_entities(id)` |
| entity_type | cfr_entity_type | NOT NULL | — |
| day_of_week | SMALLINT | YES | NULL | 0=Mon..6=Sun |
| start_time | TIME | YES | NULL |
| end_time | TIME | YES | NULL |
| hall_id | UUID | YES | NULL | FK → `cfr_halls(id)` SET NULL |
| notes | TEXT | YES | NULL |
| branch_id | UUID | YES | NULL | FK → `cfr_branches(id)` — филиал; NULL только если online_type = 'online' |
| status | cfr_record_status | NOT NULL | 'normal' | normal/removed/archived |

### 10.3 `bridge_queue` — Очередь моста (JSONB flat key-value)
> **✅ Плоская структура: один массив пар ключ-значение. Не отменяется.**
| Поле | Тип | Nullable | Default |
|---|---|---|---|
| id | BIGSERIAL | NOT NULL | — | PK |
| packet_number | INTEGER | NOT NULL | — | |
| status | cfr_bridge_packet_status | NOT NULL | 'received' |
| source | VARCHAR(100) | NOT NULL | 'bridge_agent' |
| payload | JSONB | NOT NULL | — | Flat key-value: `{"key1":"val1","key2":"val2",...}` |
| error_message | TEXT | YES | NULL |
| retry_count | INTEGER | NOT NULL | 0 |
| received_at | TIMESTAMPTZ | NOT NULL | NOW() |
| processed_at | TIMESTAMPTZ | YES | NULL |

**Структура payload (flat key-value, один уровень):**
```json
{
  "table": "cfr_visits",
  "operation": "insert",
  "id": "uuid",
  "visit_date": "2026-08-03",
  "person_id": "uuid",
  "entity_id": "uuid",
  "entity_type": "group",
  "cost": "1200.00",
  "payment_type": "cash",
  ... все поля одной таблицы ...
}
```
> Один объект = одна строка = одна таблица-получатель. Вложенности нет.

### 10.4 `schema_migrations` — История миграций
| Поле | Тип | Nullable | Default |
|---|---|---|---|
| id | SERIAL | NOT NULL | — | PK |
| version | VARCHAR(50) | NOT NULL | — | UNIQUE |
| name | VARCHAR(255) | NOT NULL | — |
| applied_at | TIMESTAMPTZ | NOT NULL | NOW() |
| checksum | VARCHAR(64) | YES | NULL |
| success | BOOLEAN | NOT NULL | TRUE |

### 10.5 `cfr_footer` — Настройки футера (1 запись)

> **Описано по компоненту `Footer.tsx`**. Одна запись, JSONB для настроек (разрешено, footer — единственное исключение после bridge_queue/settings).
> **✅ Окончательно согласовано — не отменяется.**

| Поле | Тип | Nullable | Default | Комментарий |
|---|---|---|---|---|
| id | SERIAL | NOT NULL | — | PK, всегда 1 |
| enabled | BOOLEAN | NOT NULL | TRUE | Включить/выключить весь футер |
| show_contacts | BOOLEAN | NOT NULL | TRUE | Показывать адрес/телефон/email |
| show_social | BOOLEAN | NOT NULL | TRUE | Показывать соцсети |
| show_copyright | BOOLEAN | NOT NULL | TRUE | Показывать копирайт |
| show_dev_info | BOOLEAN | NOT NULL | FALSE | Показывать инфо о разработчике |
| copyright_text | VARCHAR(255) | YES | '© 2026 Шифу Панда. Екатеринбург. Все права защищены.' | Текст копирайта |
| settings | JSONB | YES | NULL | Дополнительные настройки (расширяемая структура) |
| updated_at | TIMESTAMPTZ | NOT NULL | NOW() | |
| status | cfr_record_status | NOT NULL | 'normal' | normal/removed/archived |

### 10.6 `cfr_footer_links` — Ссылки в футере

> **Массив ссылок** из `footerSettings.links`. Каждая ссылка = отдельная строка.
> **✅ Окончательно согласовано — не отменяется.**

| Поле | Тип | Nullable | Default | Комментарий |
|---|---|---|---|---|
| id | SERIAL | NOT NULL | — | PK |
| footer_id | INTEGER | NOT NULL | 1 | FK → cfr_footer(id), всегда 1 |
| text | VARCHAR(255) | NOT NULL | — | Текст ссылки |
| href | VARCHAR(500) | NOT NULL | — | URL |
| position | INTEGER | NOT NULL | 0 | Порядок в списке |
| status | cfr_record_status | NOT NULL | 'normal' | normal/removed/archived |

**FK:** `footer_id` → `cfr_footer(id)` ON DELETE CASCADE

### 10.7 `cfr_footer_social` — Соцсети в футере

> **Массив соцсетей** из `contacts.social`. VK и Telegram — отдельные поля в cfr_footer.
> **✅ Окончательно согласовано — не отменяется.**

| Поле | Тип | Nullable | Default | Комментарий |
|---|---|---|---|---|
| id | SERIAL | NOT NULL | — | PK |
| footer_id | INTEGER | NOT NULL | 1 | FK → cfr_footer(id), всегда 1 |
| social_id | VARCHAR(50) | NOT NULL | — | id: vk, telegram, youtube и т.д. |
| title | VARCHAR(75) | NOT NULL | — | Название: ВКонтакте, Telegram |
| url | VARCHAR(500) | NOT NULL | — | URL профиля |
| position | INTEGER | NOT NULL | 0 | Порядок в списке |
| status | cfr_record_status | NOT NULL | 'normal' | normal/removed/archived |

**FK:** `footer_id` → `cfr_footer(id)` ON DELETE CASCADE

### 10.8 `cfr_footer_menu` — Меню навигации в футере

> **Меню** из `footerSettings.menuLinks`. Главная, Программы, Тренеры, Новости + динамические страницы.
> **✅ Окончательно согласовано — не отменяется.**

| Поле | Тип | Nullable | Default | Комментарий |
|---|---|---|---|---|
| id | SERIAL | NOT NULL | — | PK |
| footer_id | INTEGER | NOT NULL | 1 | FK → cfr_footer(id), всегда 1 |
| text | VARCHAR(75) | NOT NULL | — | Текст: Главная, Программы и т.д. |
| href | VARCHAR(255) | NOT NULL | — | URL: /, /programs и т.д. |
| enabled | BOOLEAN | NOT NULL | TRUE | Включено/выключено |
| position | INTEGER | NOT NULL | 0 | Порядок в списке |
| status | cfr_record_status | NOT NULL | 'normal' | normal/removed/archived |

**FK:** `footer_id` → `cfr_footer(id)` ON DELETE CASCADE

---

## 11. DB-триггеры и функции

### 11.1 Автоперенос из bridge_queue

```sql
CREATE OR REPLACE FUNCTION process_bridge_packet()
RETURNS TRIGGER AS $$
DECLARE
    target_table TEXT;
    operation TEXT;
    packet_data JSONB;
BEGIN
    UPDATE bridge_queue SET status = 'processing' WHERE id = NEW.id;
    target_table := NEW.payload->>'table';
    operation := NEW.payload->>'operation';
    packet_data := NEW.payload->'data';
    BEGIN
        CASE target_table
            WHEN 'cfr_visits' THEN PERFORM insert_or_update_visit(packet_data, operation);
            WHEN 'cfr_persons' THEN PERFORM insert_or_update_person(packet_data, operation);
            WHEN 'cfr_clients' THEN PERFORM insert_or_update_client(packet_data, operation);
            WHEN 'cfr_accounts' THEN PERFORM insert_or_update_account(packet_data, operation);
            WHEN 'cfr_entities' THEN PERFORM insert_or_update_entity(packet_data, operation);
            WHEN 'cfr_teachers' THEN PERFORM insert_or_update_teacher(packet_data, operation);
            WHEN 'cfr_transactions' THEN PERFORM insert_transaction(packet_data);
            ELSE RAISE EXCEPTION 'Unknown table: %', target_table;
        END CASE;
        UPDATE bridge_queue SET status = 'completed', processed_at = NOW() WHERE id = NEW.id;
    EXCEPTION WHEN OTHERS THEN
        UPDATE bridge_queue SET status = 'error', error_message = SQLERRM, retry_count = retry_count + 1 WHERE id = NEW.id;
    END;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_bridge_queue_insert
    AFTER INSERT ON bridge_queue FOR EACH ROW
    EXECUTE FUNCTION process_bridge_packet();
```

### 11.2 Ручной запуск

```sql
CREATE OR REPLACE FUNCTION process_bridge_queue()
RETURNS TABLE(packet_id BIGINT, status cfr_bridge_packet_status) AS $$
DECLARE rec RECORD;
BEGIN
    FOR rec IN SELECT id, payload FROM bridge_queue
        WHERE status IN ('received', 'retry_pending', 'error') AND retry_count < 3
        ORDER BY packet_number ASC LIMIT 100
    LOOP
        UPDATE bridge_queue SET status = 'processing' WHERE id = rec.id;
        BEGIN
            PERFORM process_single_packet(rec.payload);
            UPDATE bridge_queue SET status = 'completed', processed_at = NOW() WHERE id = rec.id;
        EXCEPTION WHEN OTHERS THEN
            UPDATE bridge_queue SET status = 'error', error_message = SQLERRM, retry_count = retry_count + 1 WHERE id = rec.id;
        END;
    END LOOP;
    RETURN QUERY SELECT bq.id, bq.status FROM bridge_queue bq
        WHERE bq.status IN ('completed', 'error') AND bq.id IN (SELECT id FROM bridge_queue ORDER BY packet_number DESC LIMIT 10);
END;
$$ LANGUAGE plpgsql;
```

### 11.3 Триггеры для замен тренеров (cfr_schedule_changes)

> **⚠️ Разметка для реализации:** триггер на подбор кандидатов на замену.
> **Автор разметки:** Koda AI.

```sql
-- Подбор кандидатов на замену:
-- те, кто ведёт программы того же типа (style_id) ЛИБО ходит к заменяемому тренеру
CREATE OR REPLACE FUNCTION cfr_find_replacement_candidates(p_original_teacher UUID, p_entity_type cfr_entity_type)
RETURNS UUID[] AS $$
DECLARE
    candidates UUID[];
    v_style_ids UUID[];
BEGIN
    -- 1. Получаем стили заменяемого тренера
    SELECT ARRAY_AGG(style_id) INTO v_style_ids
    FROM cfr_teacher_styles
    WHERE person_id = p_original_teacher;

    -- 2. Ищем тренеров с теми же стилями
    SELECT ARRAY_AGG(DISTINCT person_id) INTO candidates
    FROM cfr_teacher_styles
    WHERE style_id = ANY(v_style_ids)
      AND person_id != p_original_teacher;

    -- 3. Если пусто — ищем тренеров, ходящих к тому же залу
    IF candidates IS NULL OR ARRAY_LENGTH(candidates, 1) = 0 THEN
        SELECT ARRAY_AGG(DISTINCT teacher_person_id) INTO candidates
        FROM cfr_entities
        WHERE hall_id IN (
            SELECT hall_id FROM cfr_entities WHERE teacher_person_id = p_original_teacher
        )
        AND teacher_person_id != p_original_teacher;
    END IF;

    RETURN candidates;
END;
$$ LANGUAGE plpgsql;

-- Триггер: если replacement_candidates пуст — auto-cancel
CREATE OR REPLACE FUNCTION cfr_auto_cancel_no_candidates()
RETURNS TRIGGER AS $$
DECLARE
    v_candidates UUID[];
BEGIN
    IF NEW.change_type = 'replace' AND (NEW.replacement_candidates IS NULL OR ARRAY_LENGTH(NEW.replacement_candidates, 1) = 0) THEN
        -- Подбираем кандидатов автоматически
        v_candidates := cfr_find_replacement_candidates(NEW.original_teacher_person_id, NEW.entity_type);
        IF v_candidates IS NOT NULL AND ARRAY_LENGTH(v_candidates, 1) > 0 THEN
            NEW.replacement_candidates := v_candidates;
            -- Отправляем уведомление в bridge_queue для предложений замен
            INSERT INTO bridge_queue (packet_number, status, source, payload)
            VALUES (nextval('bridge_queue_id_seq'), 'received', 'auto_replace',
                jsonb_build_object(
                    'table', 'cfr_schedule_changes',
                    'operation', 'notify_replacements',
                    'data', jsonb_build_object(
                        'entity_id', NEW.entity_id,
                        'entity_type', NEW.entity_type,
                        'original_teacher', NEW.original_teacher_person_id,
                        'candidates', v_candidates,
                        'change_time', NEW.change_time
                    )
                )
            );
        ELSE
            -- Нет кандидатов — автоотмена
            NEW.change_type := 'cancel';
            NEW.reason := 'Нет кандидатов на замену';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_schedule_changes_auto_cancel
    BEFORE INSERT OR UPDATE ON cfr_schedule_changes
    FOR EACH ROW
    EXECUTE FUNCTION cfr_auto_cancel_no_candidates();
```

---

## 12. Маппинг: донор → новая схема

| Донор (XML) | Новая таблица | Примечание |
|---|---|---|
| Client | `cfr_persons` + `cfr_clients` | Persons (ФИО/телефоны/родственники) + Clients (статус/договор) |
| Teacher | `cfr_persons` + `cfr_teachers` | Persons + Teachers (ЗП/display/short_code) |
| User (админ) | `cfr_persons` + `cfr_admins` | Persons + Admins (логин/пароль/права) |
| Group + IndividualTraining + Rent | `cfr_entities` | entity_type: group/individual/rent; online_type: online/offline/hybrid |
| Style + Programs | **Объединено** → `cfr_styles` | Одна таблица |
| Sex | `cfr_persons.sex` | ENUM |
| Tag | `cfr_tags` | + `cfr_client_tags` |
| Branch | `cfr_branches` | Контакты + hall_ids (UUID[]) |
| Hall | `cfr_halls` | + branch_id FK → cfr_branches(id) |
| Informer | `cfr_informers` | + `cfr_client_informers` |
| Account + IndividualAccount + RentAccount | `cfr_accounts` | entity_id + entity_type |
| SingleTraining | `cfr_visits` | entity_id + entity_type |
| Reservation | `cfr_reservations` | entity_id + entity_type |
| ReservationStatus | `cfr_reservation_statuses` | |
| ScheduleChange + Substitute | `cfr_schedule_changes` | Объединено |
| Charge | `cfr_charges` | |
| Product | `cfr_products` | |
| Note | `cfr_notes` | |
| Task | `cfr_tasks` | |
| Message | `cfr_messages` | |
| TeacherBalanceType | `cfr_teacher_balance_types` | |
| Bonus/Deposit | `cfr_transactions` | Сериализованные строки → транзакции |
| Stages | `cfr_account_stages` | |
| Schedule | `cfr_schedule_entries` | |
| Files (медиа) | **`cfr_media`** (было `cfr_user_photos`) | Универсальная таблица |

**Не мигрируются:** DayBalance, Param, Passport, TablesSummary, TeacherBalance (пустые)

> **Общий статус:** Все сущности: добавлен `status cfr_record_status` (`normal`/`removed`/`archived`)
> **Онлайн-формат:** `cfr_entities` имеет поле `online_type` (`online`/`offline`/`hybrid`, default `'hybrid'`)
> **Филиалы:** `cfr_entities`, `cfr_visits`, `cfr_reservations`, `cfr_schedule_entries` — поле `branch_id` (NULL только для `online_type = 'online'`)

### Маппинг: Существующие таблицы сайта

| Сущ. таблица | Действие |
|---|---|
| `users` | Остаётся (обратная совместимость) |
| `trainers` | → `cfr_teachers` |
| `trainer_photos` | → `cfr_teacher_photos` (частный случай `cfr_media`) |
| `user_subscriptions` | → `cfr_accounts` |
| `user_visits` | → `cfr_visits` |
| `user_payments` | → `cfr_transactions` |
| `staff` | Остаётся |
| `programs` | **Объединяется** с `cfr_styles` |
| `pages.json` | → `cfr_pages` |
| `footer.json` | → `cfr_footer` + `cfr_footer_links` + `cfr_footer_social` + `cfr_footer_menu` |
| `Files/` (фото) | → `cfr_media` (универсальная таблица) |

---

## 13. Итоговый список таблиц

### Существующие без изменений (12):
1. program_photos, program_trainers, program_workouts
2. news, sliders, schedule_items, prices, staff, sections, workouts
3. settings (JSONB key-value)
4. db_meta
5. users (обратная совместимость)

### Существующие с миграцией данных (6):
6. user_subscriptions → cfr_accounts
7. user_visits → cfr_visits
8. user_payments → cfr_transactions
9. trainers → cfr_teachers
10. trainer_photos → cfr_teacher_photos
11. programs → **объединяется** с cfr_styles

### Новые cfr_-таблицы (27):
12. cfr_persons (центральная)
13. cfr_client_statuses (справочник)
14. cfr_clients
15. cfr_teachers
16. cfr_teacher_photos (частный случай cfr_media)
17. cfr_admins (CRM)
18. cfr_media (универсальная медиа-таблица) **НОВАЯ**
19. cfr_branches, cfr_halls, cfr_styles (объединённая с programs)
20. cfr_tags, cfr_informers
21. cfr_reservation_statuses, cfr_teacher_balance_types, cfr_charges, cfr_products
22. cfr_entities (единая: группы/индивид/аренда/массаж/сплит)
23. cfr_accounts (единые абонементы)
24. cfr_visits (единый учёт посещений)
25. cfr_reservations
26. cfr_schedule_changes (объединённая с substitutes)
27. cfr_notes, cfr_tasks, cfr_messages
28. cfr_client_tags, cfr_client_informers, cfr_group_clients
29. cfr_teacher_styles, cfr_account_groups, cfr_card_uses
30. cfr_transactions, cfr_account_stages
31. cfr_user_photos (устаревшая, замещена cfr_media)
32. cfr_schedule_entries
33. cfr_pages, cfr_contacts

### Новые инфраструктурные (7):
34. bridge_queue (JSONB)
35. schema_migrations
36. cfr_footer — настройки футера (1 запись, JSONB)
37. cfr_footer_links — ссылки в футере
38. cfr_footer_social — соцсети в футере
39. cfr_footer_menu — меню навигации в футере

**Итого: 12 без изм. + 6 с миграцией + 27 новых cfr_ + 7 новых инфрастр. = 52 таблицы**

---

## 14. Спорные моменты (резюме)

| Вопрос | Решение |
|---|---|
| Префикс | `cfr_` ✅ |
| Persons | Без пароля, без роли. Роли = FK 1:1 ✅ |
| Родители | Ссылки на persons (2 шт) ✅ |
| Статус клиента | Справочник `cfr_client_statuses` ✅ |
| Админы с паролем | `cfr_admins`, bcrypt, не MD5 ✅ |
| Слияние с users | Обратная совместимость ✅ |
| JSONB settings | Унаследованное исключение ✅ |
| Единая cfr_entities | Группы/индивид/массаж/сплит/аренда ✅ |
| Programs = Styles | Одна таблица ✅ |
| ScheduleChanges + Substitutes | Одна таблица ✅ |
| Фото-сироты (410 шт) | Загрузить все, person_id=NULL ✅ |
| staff | Оставить пока ✅ |
| Общий статус | `cfr_record_status` (`normal`/`removed`/`archived`) ✅ |
| Онлайн-формат | `cfr_online_type` (`online`/`offline`/`hybrid`, default `'hybrid'`) ✅ |
| Филиалы тренировок | `branch_id` в `cfr_entities`, `cfr_visits`, `cfr_reservations`, `cfr_schedule_entries` (NULL только для `online_type = 'online'`) ✅ |
| Универсальная медиа-таблица | `cfr_media` с entity_type/entity_id/is_main/position ✅ |
| Фильтр контента | content = только md/html, no script/css ✅ |
| Зарплата админов | учёт через вход/выход + операции + почасовая ставка ✅ |
| Замены тренеров | автоподбор кандидатов + автоотмена при отсутствии ✅ |
| ENUM reservation_status | ✅ Создан |
| ENUM floor_type | ✅ Создан |
| ENUM schedule_change_type | cancel/move/replace (без add/reschedule) ✅ |
| Bridge queue | flat key-value, один уровень ✅ |
| Validation | валидация на уровне приложения ✅ |

---

## ✅ ОКОНЧАТЕЛЬНО СОГЛАСОВАНО (03.08.2026 — третий раунд)

> **Все ключевые архитектурные решения утверждены и зафиксированы.**

### Первый раунд (изначально):
| Решение | Статус |
|---|---|
| Префикс `cfr_` | ✅ Окончательно принято |
| Persons без пароля и роли | ✅ Окончательно принято |
| Родители — ссылки на persons (2 шт) | ✅ Окончательно принято |
| short_code в teachers | ✅ Окончательно принято |
| Объединение schedule_changes + substitutes | ✅ Окончательно принято |
| Единая cfr_entities (группы/индивид/массаж/сплит/аренда) | ✅ Окончательно принято |
| Programs = Styles (одна таблица) | ✅ Окончательно принято |
| Общий статус cfr_record_status (normal/removed/archived) | ✅ Окончательно принято |
| Онлайн-формат cfr_online_type (online/offline/hybrid) | ✅ Окончательно принято |
| Филиалы: branch_id + hall_ids (UUID[]) | ✅ Окончательно принято |

### Второй раунд:
| Решение | Статус |
|---|---|
| 4.1 cfr_client_statuses — согласовано | ✅ Окончательно принято |
| 4.2 annotation = VARCHAR(200) | ✅ Окончательно принято |
| 4.3 experience/description/specialization = VARCHAR(75), no script/css | ✅ Окончательно принято |
| 4.4 универсальная cfr_media + функция смены позиции | ✅ Окончательно принято |
| 4.5 login VARCHAR(7), пароль 6 цифр, учёт зарплаты | ✅ Окончательно принято |
| 5.1 hours = VARCHAR(11)[7], branches name VARCHAR(255) | ✅ Окончательно принято |
| 5.2 floor_type ENUM, max_capacity NOT NULL default 500 | ✅ Окончательно принято |
| 5.3 name/client_name = VARCHAR(75), description = VARCHAR(155) | ✅ Окончательно принято |
| 5.4-5.6 name = VARCHAR(75), description = VARCHAR(155) | ✅ Окончательно принято |
| 5.7 balance_types оптимизировано | ✅ Окончательно принято |
| 5.8 charges description/annotation = VARCHAR(255) | ✅ Окончательно принято |
| 6.1 max_capacity NOT NULL, price_per_session = DECIMAL(5,2) | ✅ Окончательно принято |
| 6.2 discount_percent = DECIMAL(2,2), cost = DECIMAL(5,2) | ✅ Окончательно принято |
| 6.3 annotation = TEXT с фильтром | ✅ Окончательно принято |
| 6.4 reservations ФИО = VARCHAR(50), comments = VARCHAR(155) | ✅ Окончательно принято |
| 6.5 reason = VARCHAR(155), replace candidates UUID[] | ✅ Окончательно принято |
| 6.6 notes text = TEXT с фильтром | ✅ Окончательно принято |
| 6.7 tasks text = VARCHAR(255) | ✅ Окончательно принято |
| 6.8 messages text = TEXT с фильтром | ✅ Окончательно принято |
| 6.9 bridge_queue flat key-value | ✅ Окончательно принято |
| 6.10 schedule_change_type = cancel/move/replace (без add) | ✅ Окончательно принято |
| 7.1-7.6 — согласовано полностью | ✅ Окончательно принято |
| 8.1 description = VARCHAR(100) | ✅ Окончательно принято |
| 8.2 stage_name = VARCHAR(50), stage_data = VARCHAR(155) | ✅ Окончательно принято |
| 9.2 content = только md/html, no script/css | ✅ Окончательно принято |
| ENUM cfr_reservation_status | ✅ Окончательно принято |
| ENUM cfr_floor_type | ✅ Окончательно принято |
| 11.3 триггеры для замен тренеров | ✅ Окончательно принято |

---

## ⚠️ ТРЕБУЕТ УТВЕРЖДЕНИЯ

Перед переходом к реализации (Тикет 2.1) проверьте:
1. ✅ Префикс `cfr_` — ОДОБРЕНО
2. ✅ Persons без пароля и роли — ОДОБРЕНО
3. ✅ Родители — ссылки на persons (2 шт) — ОДОБРЕНО
4. ✅ short_code в teachers — ОДОБРЕНО
5. ✅ Объединение schedule_changes + substitutes — ОДОБРЕНО
6. ✅ Единая cfr_entities — ОДОБРЕНО
7. ✅ Programs = Styles — ОДОБРЕНО
8. ✅ Слияние со всеми существующими структурами — ОДОБРЕНО
9. ✅ Универсальная cfr_media — ОДОБРЕНО
10. ✅ Фильтры контента (no script/css) — ОДОБРЕНО
11. ✅ Триггеры замен тренеров — ОДОБРЕНО
12. ✅ ENUM reservation_status — ОДОБРЕНО
13. ✅ Flat bridge_queue — ОДОБРЕНО
14. ✅ cfr_footer (по Footer.tsx) — ОДОБРЕНО

**Все ключевые решения утверждены 03.08.2026 (финальный раунд).**

**База данных полностью готова. Готовность: 100%.**

Готов переходить к Тикету 2.1 (SQL-миграция).