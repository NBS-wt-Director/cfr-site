-- ============================================
-- Тикет 2.1: Создание базы данных PostgreSQL
-- Миграция 001 — Основная схема БД
-- Дата: 2026-08-03
-- Описание: Все ENUM-типы, таблицы cfr_ ( Persons, роли, справочники,
--            бизнес-таблицы, связи, финансы, контент, медиа, инфраструктура)
--            + обратная совместимость с существующими таблицами сайта
-- ============================================

BEGIN;

-- ============================================
-- 1. ENUM-ТИПЫ (22 штуки)
-- ============================================

DO $$ BEGIN
    CREATE TYPE cfr_payment_type AS ENUM (
        'cash','card','deposit','bonus','free','mixed','prepayment','transfer'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

DO $$ BEGIN
    CREATE TYPE cfr_group_status AS ENUM ('admission','active','closed','paused');
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

DO $$ BEGIN
    CREATE TYPE cfr_hall_status AS ENUM ('active','inactive');
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

DO $$ BEGIN
    CREATE TYPE cfr_teacher_status AS ENUM ('active','inactive','fired');
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

DO $$ BEGIN
    CREATE TYPE cfr_product_status AS ENUM ('active','inactive','discontinued');
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

DO $$ BEGIN
    CREATE TYPE cfr_product_unit AS ENUM ('piece','hour','minute','day','session','month');
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

DO $$ BEGIN
    CREATE TYPE cfr_reservation_type AS ENUM ('group','individual','rent');
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

DO $$ BEGIN
    CREATE TYPE cfr_client_type AS ENUM ('new','existing');
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

DO $$ BEGIN
    CREATE TYPE cfr_tenant_type AS ENUM ('client','external');
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

DO $$ BEGIN
    CREATE TYPE cfr_reservation_status AS ENUM ('confirmed','cancelled','pending','checked_in','no_show','waitlist');
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

DO $$ BEGIN
    CREATE TYPE cfr_schedule_change_type AS ENUM ('cancel','move','replace');
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

DO $$ BEGIN
    CREATE TYPE cfr_sum_type AS ENUM ('target','replacement','bonus','penalty');
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

DO $$ BEGIN
    CREATE TYPE cfr_task_type AS ENUM ('call','meeting','other','payment','notification');
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

DO $$ BEGIN
    CREATE TYPE cfr_message_status AS ENUM ('pending','sent','delivered','failed','auth_failed');
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

DO $$ BEGIN
    CREATE TYPE cfr_message_target AS ENUM ('sms','viber','whatsapp','telegram','email');
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

DO $$ BEGIN
    CREATE TYPE cfr_transaction_type AS ENUM (
        'deposit_add','deposit_use','deposit_refund',
        'bonus_add','bonus_use','bonus_expire',
        'payment','charge','refund','adjustment'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

DO $$ BEGIN
    CREATE TYPE cfr_entity_type AS ENUM ('group','individual','massage','split','rent');
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

DO $$ BEGIN
    CREATE TYPE cfr_online_type AS ENUM ('online','offline','hybrid');
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

DO $$ BEGIN
    CREATE TYPE cfr_bridge_packet_status AS ENUM (
        'received','processing','completed','error','retry_pending'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

DO $$ BEGIN
    CREATE TYPE cfr_sex AS ENUM ('male','female','other');
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

DO $$ BEGIN
    CREATE TYPE cfr_record_status AS ENUM ('normal','removed','archived');
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

DO $$ BEGIN
    CREATE TYPE cfr_floor_type AS ENUM (
        'резина','мат','дерево','металл','бетон','линолиум','комбинированно'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

DO $$ BEGIN
    CREATE TYPE cfr_account_status AS ENUM ('active','expired','frozen','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

DO $$ BEGIN
    CREATE TYPE cfr_media_entity_type AS ENUM (
        'teacher','hall','person','style','entity','news','slider',
        'page','program','product','branch','client','reservation'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;


-- ============================================
-- 2. PERSONS — Все люди
-- ============================================

CREATE TABLE IF NOT EXISTS cfr_persons (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_user_id      INTEGER,
    last_name         VARCHAR(255),
    first_name        VARCHAR(255),
    middle_name       VARCHAR(255),
    sex               cfr_sex,
    birth_date        DATE,
    mobile_phone      VARCHAR(20),
    additional_phone  VARCHAR(20),
    email             VARCHAR(255),
    avatar_url        VARCHAR(500),
    parent_person_id_1 UUID,
    parent_person_id_2 UUID,
    address           TEXT,
    notes             TEXT,
    status            cfr_record_status NOT NULL DEFAULT 'normal',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_persons_site_user FOREIGN KEY (site_user_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_persons_parent_1 FOREIGN KEY (parent_person_id_1) REFERENCES cfr_persons(id) ON DELETE SET NULL,
    CONSTRAINT fk_persons_parent_2 FOREIGN KEY (parent_person_id_2) REFERENCES cfr_persons(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_persons_phone ON cfr_persons(mobile_phone);
CREATE INDEX IF NOT EXISTS idx_persons_email ON cfr_persons(email);
CREATE INDEX IF NOT EXISTS idx_persons_site_user ON cfr_persons(site_user_id);
CREATE INDEX IF NOT EXISTS idx_persons_name ON cfr_persons(last_name, first_name);


-- ============================================
-- 3. РОЛЕВЫЕ ТАБЛИЦЫ
-- ============================================

-- 3.1 Статусы клиентов (справочник)
CREATE TABLE IF NOT EXISTS cfr_client_statuses (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    slug        VARCHAR(50) NOT NULL UNIQUE,
    colour      VARCHAR(7),
    description TEXT,
    sort_order  INTEGER NOT NULL DEFAULT 0
);

-- 3.2 Клиенты (1:1 → persons)
CREATE TABLE IF NOT EXISTS cfr_clients (
    person_id       UUID PRIMARY KEY REFERENCES cfr_persons(id) ON DELETE CASCADE,
    agreement_number INTEGER,
    barcode         VARCHAR(100),
    archive         BOOLEAN NOT NULL DEFAULT FALSE,
    status_id       INTEGER REFERENCES cfr_client_statuses(id) ON DELETE SET NULL,
    friend_person_id UUID REFERENCES cfr_persons(id),
    id_foto         UUID,
    annotation      VARCHAR(200),
    status          cfr_record_status NOT NULL DEFAULT 'normal'
);

-- 3.3 Преподаватели (1:1 → persons)
CREATE TABLE IF NOT EXISTS cfr_teachers (
    person_id                      UUID PRIMARY KEY REFERENCES cfr_persons(id) ON DELETE CASCADE,
    short_code                     VARCHAR(10),
    status                         cfr_teacher_status NOT NULL DEFAULT 'active',
    own_salary_options             BOOLEAN NOT NULL DEFAULT FALSE,
    own_second_salary_options      BOOLEAN NOT NULL DEFAULT FALSE,
    id_foto                        UUID,
    image                          VARCHAR(500),
    experience                     VARCHAR(75),
    description                    VARCHAR(75),
    specialization                 VARCHAR(75),
    is_director                    BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order                     INTEGER NOT NULL DEFAULT 0,
    record_status                  cfr_record_status NOT NULL DEFAULT 'normal'
);

-- 3.4 Фото преподавателей (частный случай cfr_media)
CREATE TABLE IF NOT EXISTS cfr_teacher_photos (
    id                SERIAL PRIMARY KEY,
    teacher_person_id UUID NOT NULL REFERENCES cfr_teachers(person_id) ON DELETE CASCADE,
    image             VARCHAR(500) NOT NULL,
    caption           VARCHAR(75),
    position          INTEGER NOT NULL DEFAULT 0
);

-- 3.5 Универсальная медиа-таблица
CREATE TABLE IF NOT EXISTS cfr_media (
    id                 BIGSERIAL PRIMARY KEY,
    entity_type        cfr_media_entity_type NOT NULL,
    entity_id          UUID NOT NULL,
    file_path          VARCHAR(500) NOT NULL,
    original_filename  VARCHAR(255),
    caption            VARCHAR(255),
    position           INTEGER NOT NULL DEFAULT 0,
    is_main            BOOLEAN NOT NULL DEFAULT FALSE,
    width              INTEGER,
    height             INTEGER,
    file_size          BIGINT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    record_status      cfr_record_status NOT NULL DEFAULT 'normal'
);

CREATE INDEX IF NOT EXISTS idx_media_entity ON cfr_media(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_media_position ON cfr_media(entity_type, entity_id, position);
CREATE INDEX IF NOT EXISTS idx_media_main ON cfr_media(entity_type, entity_id, is_main);

-- Триггер: защита is_main
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

DROP TRIGGER IF EXISTS trg_check_main_media ON cfr_media;
CREATE TRIGGER trg_check_main_media
    BEFORE INSERT OR UPDATE ON cfr_media
    FOR EACH ROW
    EXECUTE FUNCTION cfr_check_main_media();

-- Функция смены позиции медиа
CREATE OR REPLACE FUNCTION cfr_reorder_media(
    p_entity_type VARCHAR(75),
    p_entity_id UUID,
    p_item_id BIGINT,
    p_new_position INTEGER
)
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

-- 3.6 Администраторы (CRM)
CREATE TABLE IF NOT EXISTS cfr_admins (
    person_id         UUID PRIMARY KEY REFERENCES cfr_persons(id) ON DELETE CASCADE,
    login             VARCHAR(7) NOT NULL UNIQUE,
    password_hash     VARCHAR(255) NOT NULL,
    password_md5      VARCHAR(32),
    is_root           BOOLEAN NOT NULL DEFAULT FALSE,
    rights            JSONB,
    last_login_at     TIMESTAMPTZ,
    last_computer_id  VARCHAR(255),
    admin_status      VARCHAR(50) NOT NULL DEFAULT 'active',
    record_status     cfr_record_status NOT NULL DEFAULT 'normal'
);


-- ============================================
-- 4. СПРАВОЧНЫЕ ТАБЛИЦЫ
-- ============================================

-- 4.1 Филиалы (1 запись)
CREATE TABLE IF NOT EXISTS cfr_branches (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(255) NOT NULL,
    record_status cfr_record_status NOT NULL DEFAULT 'normal',
    address    TEXT,
    phone      VARCHAR(50),
    email      VARCHAR(255),
    website    VARCHAR(500),
    hours      VARCHAR(11)[7],
    hall_ids   UUID[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4.2 Залы
CREATE TABLE IF NOT EXISTS cfr_halls (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name         VARCHAR(75) NOT NULL,
    branch_id    UUID REFERENCES cfr_branches(id),
    hall_status  cfr_hall_status NOT NULL DEFAULT 'active',
    can_combine  BOOLEAN NOT NULL DEFAULT FALSE,
    floor_type   cfr_floor_type NOT NULL DEFAULT 'мат',
    max_capacity INTEGER NOT NULL DEFAULT 500 CHECK (max_capacity <= 5000),
    area_sqm     NUMERIC(6,1),
    record_status cfr_record_status NOT NULL DEFAULT 'normal'
);

-- 4.3 Стили = Programs (объединено)
CREATE TABLE IF NOT EXISTS cfr_styles (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(75) NOT NULL UNIQUE,
    client_name   VARCHAR(75),
    description   VARCHAR(155),
    type          VARCHAR(75),
    record_status cfr_record_status NOT NULL DEFAULT 'normal'
);

-- 4.4 Теги
CREATE TABLE IF NOT EXISTS cfr_tags (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(75) NOT NULL,
    colour      VARCHAR(8),
    position    INTEGER NOT NULL DEFAULT 0,
    description VARCHAR(155),
    record_status cfr_record_status
);

-- 4.5 Источники
CREATE TABLE IF NOT EXISTS cfr_informers (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(75) NOT NULL,
    record_status cfr_record_status
);

-- 4.6 Статусы бронирования
CREATE TABLE IF NOT EXISTS cfr_reservation_statuses (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(75) NOT NULL,
    colour      VARCHAR(8),
    position    INTEGER NOT NULL DEFAULT 0,
    description VARCHAR(155),
    record_status cfr_record_status
);

-- 4.7 Типы баланса тренеров
CREATE TABLE IF NOT EXISTS cfr_teacher_balance_types (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name         VARCHAR(75) NOT NULL,
    slug         VARCHAR(50) NOT NULL UNIQUE,
    factor       DECIMAL(5,2) NOT NULL DEFAULT 1,
    annotation   VARCHAR(155),
    record_status cfr_record_status
);

-- 4.8 Статьи расходов
CREATE TABLE IF NOT EXISTS cfr_charges (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(255) NOT NULL,
    description VARCHAR(255),
    annotation  VARCHAR(255),
    record_status cfr_record_status
);

-- 4.9 Товары
CREATE TABLE IF NOT EXISTS cfr_products (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(75) NOT NULL,
    barcode       VARCHAR(100),
    measurement   VARCHAR(75),
    unit          cfr_product_unit,
    product_status cfr_product_status NOT NULL DEFAULT 'active',
    purchase_cost INTEGER NOT NULL DEFAULT 0,
    markup        INTEGER NOT NULL DEFAULT 0,
    markup_percent INTEGER NOT NULL DEFAULT 0,
    annotation    VARCHAR(155),
    record_status cfr_record_status
);


-- ============================================
-- 5. ОСНОВНЫЕ БИЗНЕС-ТАБЛИЦЫ
-- ============================================

-- 5.1 Единая таблица сущностей (группы, индивид, аренда, массаж, сплит)
CREATE TABLE IF NOT EXISTS cfr_entities (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type         cfr_entity_type NOT NULL DEFAULT 'group',
    online_type         cfr_online_type NOT NULL DEFAULT 'hybrid',
    name                VARCHAR(75),
    style_id            INTEGER REFERENCES cfr_styles(id),
    teacher_person_id   UUID REFERENCES cfr_persons(id),
    hall_id             UUID REFERENCES cfr_halls(id),
    branch_id           UUID REFERENCES cfr_branches(id),
    record_status       cfr_record_status NOT NULL DEFAULT 'normal',
    colour              VARCHAR(8),
    max_capacity        INTEGER NOT NULL DEFAULT 100 CHECK (max_capacity <= 5000),
    price_per_session   DECIMAL(5,2),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_entities_type ON cfr_entities(entity_type);
CREATE INDEX IF NOT EXISTS idx_entities_teacher ON cfr_entities(teacher_person_id);
CREATE INDEX IF NOT EXISTS idx_entities_style ON cfr_entities(style_id);
CREATE INDEX IF NOT EXISTS idx_entities_hall ON cfr_entities(hall_id);

-- 5.2 Абонементы
CREATE TABLE IF NOT EXISTS cfr_accounts (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    number               INTEGER NOT NULL,
    person_id            UUID NOT NULL REFERENCES cfr_persons(id) ON DELETE CASCADE,
    entity_id            UUID REFERENCES cfr_entities(id) ON DELETE SET NULL,
    entity_type          cfr_entity_type,
    account_type_name    VARCHAR(75),
    account_type_cost    DECIMAL(5,2) NOT NULL DEFAULT 0,
    original_cost        DECIMAL(5,2) NOT NULL DEFAULT 0,
    discount             DECIMAL(5,2) NOT NULL DEFAULT 0,
    discount_percent     DECIMAL(2,2) NOT NULL DEFAULT 0,
    payment_type         cfr_payment_type NOT NULL DEFAULT 'cash',
    create_date          DATE NOT NULL,
    begin_date           DATE,
    days_count           INTEGER,
    add_days_count       INTEGER NOT NULL DEFAULT 0,
    training_count       INTEGER NOT NULL DEFAULT 0,
    free_training_count  INTEGER NOT NULL DEFAULT 0,
    is_perpetual         BOOLEAN NOT NULL DEFAULT FALSE,
    is_unlimited         BOOLEAN NOT NULL DEFAULT FALSE,
    annotation           VARCHAR(155),
    account_status       cfr_account_status NOT NULL DEFAULT 'active',
    source               VARCHAR(50) NOT NULL DEFAULT 'dancestudio',
    record_status        cfr_record_status NOT NULL DEFAULT 'normal',
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accounts_person ON cfr_accounts(person_id);
CREATE INDEX IF NOT EXISTS idx_accounts_entity ON cfr_accounts(entity_id, entity_type);

-- 5.3 Визиты (крупнейшая таблица, 71873+)
CREATE TABLE IF NOT EXISTS cfr_visits (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_date          DATE NOT NULL,
    person_id           UUID NOT NULL REFERENCES cfr_persons(id) ON DELETE CASCADE,
    entity_id           UUID REFERENCES cfr_entities(id) ON DELETE SET NULL,
    entity_type         cfr_entity_type,
    branch_id           UUID REFERENCES cfr_branches(id),
    account_id          UUID REFERENCES cfr_accounts(id) ON DELETE SET NULL,
    cost                DECIMAL(8,2) NOT NULL DEFAULT 0,
    payment_type        cfr_payment_type NOT NULL DEFAULT 'cash',
    training_type_name  VARCHAR(75),
    training_type_cost  DECIMAL(8,2) NOT NULL DEFAULT 0,
    annotation          TEXT,
    source              VARCHAR(50) NOT NULL DEFAULT 'dancestudio',
    record_status       cfr_record_status NOT NULL DEFAULT 'normal',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visits_person ON cfr_visits(person_id);
CREATE INDEX IF NOT EXISTS idx_visits_date ON cfr_visits(visit_date);
CREATE INDEX IF NOT EXISTS idx_visits_person_date ON cfr_visits(person_id, visit_date);
CREATE INDEX IF NOT EXISTS idx_visits_entity ON cfr_visits(entity_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_visits_account ON cfr_visits(account_id);

-- 5.4 Бронирования
CREATE TABLE IF NOT EXISTS cfr_reservations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_type    cfr_reservation_type NOT NULL,
    status_id           UUID REFERENCES cfr_reservation_statuses(id),
    person_id           UUID REFERENCES cfr_persons(id) ON DELETE SET NULL,
    entity_id           UUID REFERENCES cfr_entities(id) ON DELETE SET NULL,
    entity_type         cfr_entity_type,
    last_name           VARCHAR(50),
    first_name          VARCHAR(50),
    birth_date          DATE,
    mobile_phone        VARCHAR(20),
    client_type         cfr_client_type NOT NULL DEFAULT 'new',
    reservation_time    TIMESTAMPTZ,
    parent_last_name    VARCHAR(50),
    parent_mobile_phone VARCHAR(20),
    comments            VARCHAR(155),
    branch_id           UUID REFERENCES cfr_branches(id),
    record_status       cfr_record_status
);

-- 5.5 Изменения расписания и замены тренеров (объединено)
CREATE TABLE IF NOT EXISTS cfr_schedule_changes (
    id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id                      UUID REFERENCES cfr_entities(id),
    entity_type                    cfr_entity_type,
    change_time                    TIMESTAMPTZ NOT NULL,
    change_type                    cfr_schedule_change_type NOT NULL,
    change_date_time               TIMESTAMPTZ,
    new_date_time                  TIMESTAMPTZ,
    reason                         VARCHAR(155),
    original_teacher_person_id     UUID REFERENCES cfr_persons(id),
    replacement_candidates         UUID[],
    replacement_teacher_person_id  UUID REFERENCES cfr_persons(id),
    sum_type                       cfr_sum_type,
    record_status                  cfr_record_status
);

-- 5.6 Заметки
CREATE TABLE IF NOT EXISTS cfr_notes (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    text          TEXT NOT NULL,
    closed        BOOLEAN NOT NULL DEFAULT FALSE,
    colour        VARCHAR(8),
    note_date     TIMESTAMPTZ,
    close_date    TIMESTAMPTZ,
    record_status cfr_record_status
);

-- 5.7 Задачи
CREATE TABLE IF NOT EXISTS cfr_tasks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    text            VARCHAR(255) NOT NULL,
    closed          BOOLEAN NOT NULL DEFAULT FALSE,
    task_type       cfr_task_type NOT NULL DEFAULT 'other',
    creator_person_id  UUID REFERENCES cfr_persons(id),
    closer_person_id   UUID REFERENCES cfr_persons(id),
    assignee_person_id UUID REFERENCES cfr_persons(id),
    task_time       TIMESTAMPTZ,
    close_time      TIMESTAMPTZ,
    record_status   cfr_record_status
);

-- 5.8 Сообщения
CREATE TABLE IF NOT EXISTS cfr_messages (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id     UUID REFERENCES cfr_persons(id) ON DELETE SET NULL,
    target        cfr_message_target NOT NULL DEFAULT 'sms',
    phone         VARCHAR(20),
    text          TEXT NOT NULL,
    msg_status    cfr_message_status NOT NULL DEFAULT 'pending',
    cost          VARCHAR(50),
    message_time  TIMESTAMPTZ,
    record_status cfr_record_status
);


-- ============================================
-- 6. ТАБЛИЦЫ СВЯЗЕЙ (M:N)
-- ============================================

-- 6.1 Клиенты ↔ Теги
CREATE TABLE IF NOT EXISTS cfr_client_tags (
    person_id UUID NOT NULL REFERENCES cfr_persons(id) ON DELETE CASCADE,
    tag_id    UUID NOT NULL REFERENCES cfr_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (person_id, tag_id)
);

-- 6.2 Клиенты ↔ Источники
CREATE TABLE IF NOT EXISTS cfr_client_informers (
    person_id    UUID NOT NULL REFERENCES cfr_persons(id) ON DELETE CASCADE,
    informer_id  UUID NOT NULL REFERENCES cfr_informers(id) ON DELETE CASCADE,
    PRIMARY KEY (person_id, informer_id)
);

-- 6.3 Состав сущностей (человек ↔ сущность)
CREATE TABLE IF NOT EXISTS cfr_group_clients (
    entity_id   UUID NOT NULL REFERENCES cfr_entities(id) ON DELETE CASCADE,
    entity_type cfr_entity_type NOT NULL,
    person_id   UUID NOT NULL REFERENCES cfr_persons(id) ON DELETE CASCADE,
    joined_at   TIMESTAMPTZ,
    left_at     TIMESTAMPTZ,
    PRIMARY KEY (entity_id, entity_type, person_id)
);

-- 6.4 Преподаватели ↔ Стили
CREATE TABLE IF NOT EXISTS cfr_teacher_styles (
    person_id UUID NOT NULL REFERENCES cfr_teachers(person_id) ON DELETE CASCADE,
    style_id  INTEGER NOT NULL REFERENCES cfr_styles(id) ON DELETE CASCADE,
    PRIMARY KEY (person_id, style_id)
);

-- 6.5 Абонементы ↔ Группы
CREATE TABLE IF NOT EXISTS cfr_account_groups (
    account_id UUID NOT NULL REFERENCES cfr_accounts(id) ON DELETE CASCADE,
    group_id   UUID NOT NULL REFERENCES cfr_entities(id) ON DELETE CASCADE,
    PRIMARY KEY (account_id, group_id)
);

-- 6.6 Использование карт
CREATE TABLE IF NOT EXISTS cfr_card_uses (
    id          BIGSERIAL PRIMARY KEY,
    person_id   UUID REFERENCES cfr_persons(id),
    card_data   VARCHAR(75) NOT NULL,
    used_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    record_status cfr_record_status NOT NULL DEFAULT 'normal'
);


-- ============================================
-- 7. ФИНАНСОВЫЕ ТАБЛИЦЫ
-- ============================================

-- 7.1 Транзакции
CREATE TABLE IF NOT EXISTS cfr_transactions (
    id               BIGSERIAL PRIMARY KEY,
    person_id        UUID REFERENCES cfr_persons(id) ON DELETE CASCADE,
    transaction_type cfr_transaction_type NOT NULL,
    amount           DECIMAL(5,2) NOT NULL DEFAULT 0,
    balance_after    DECIMAL(5,2),
    account_id       UUID REFERENCES cfr_accounts(id) ON DELETE SET NULL,
    visit_id         UUID REFERENCES cfr_visits(id) ON DELETE SET NULL,
    description      VARCHAR(100),
    source           VARCHAR(50) NOT NULL DEFAULT 'dancestudio',
    transaction_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    record_status    cfr_record_status NOT NULL DEFAULT 'normal'
);

-- 7.2 Этапы абонементов
CREATE TABLE IF NOT EXISTS cfr_account_stages (
    id           BIGSERIAL PRIMARY KEY,
    account_id   UUID NOT NULL REFERENCES cfr_accounts(id) ON DELETE CASCADE,
    stage_name   VARCHAR(50),
    stage_data   VARCHAR(155),
    sort_order   INTEGER NOT NULL DEFAULT 0,
    record_status cfr_record_status NOT NULL DEFAULT 'normal'
);


-- ============================================
-- 8. КОНТЕНТНЫЕ ТАБЛИЦЫ САЙТА
-- ============================================

-- 8.1 Ручные страницы
CREATE TABLE IF NOT EXISTS cfr_pages (
    id          VARCHAR(100) PRIMARY KEY,
    slug        VARCHAR(200) NOT NULL UNIQUE,
    title       VARCHAR(75) NOT NULL,
    content     VARCHAR(75),
    media       VARCHAR(155),
    enabled     BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    record_status cfr_record_status NOT NULL DEFAULT 'normal'
);

-- 8.2 Контакты
CREATE TABLE IF NOT EXISTS cfr_contacts (
    id         SERIAL PRIMARY KEY,
    type       VARCHAR(50) NOT NULL,
    value      VARCHAR(75) NOT NULL,
    label      VARCHAR(75),
    sort_order INTEGER NOT NULL DEFAULT 0,
    record_status cfr_record_status NOT NULL DEFAULT 'normal'
);


-- ============================================
-- 9. ИНФРАСТРУКТУРНЫЕ ТАБЛИЦЫ
-- ============================================

-- 9.1 Фотографии пользователей (устаревшая, замещена cfr_media)
CREATE TABLE IF NOT EXISTS cfr_user_photos (
    id                BIGSERIAL PRIMARY KEY,
    person_id         UUID REFERENCES cfr_persons(id) ON DELETE SET NULL,
    original_uuid     UUID,
    image_url         VARCHAR(500) NOT NULL,
    thumbnail_url     VARCHAR(500),
    medium_url        VARCHAR(500),
    original_filename VARCHAR(255),
    width             INTEGER,
    height            INTEGER,
    file_size         INTEGER,
    format            VARCHAR(10) NOT NULL DEFAULT 'webp',
    user_id           INTEGER REFERENCES users(id),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    record_status     cfr_record_status NOT NULL DEFAULT 'normal'
);

-- 9.2 Расписание (нормализованное)
CREATE TABLE IF NOT EXISTS cfr_schedule_entries (
    id           BIGSERIAL PRIMARY KEY,
    entity_id    UUID NOT NULL REFERENCES cfr_entities(id),
    entity_type  cfr_entity_type NOT NULL,
    day_of_week  SMALLINT,
    start_time   TIME,
    end_time     TIME,
    hall_id      UUID REFERENCES cfr_halls(id) ON DELETE SET NULL,
    notes        TEXT,
    branch_id    UUID REFERENCES cfr_branches(id),
    record_status cfr_record_status NOT NULL DEFAULT 'normal'
);

-- 9.3 Настройки футера
CREATE TABLE IF NOT EXISTS cfr_footer (
    id                SERIAL PRIMARY KEY,
    enabled           BOOLEAN NOT NULL DEFAULT TRUE,
    show_contacts     BOOLEAN NOT NULL DEFAULT TRUE,
    show_social       BOOLEAN NOT NULL DEFAULT TRUE,
    show_copyright    BOOLEAN NOT NULL DEFAULT TRUE,
    show_dev_info     BOOLEAN NOT NULL DEFAULT FALSE,
    copyright_text    VARCHAR(255) DEFAULT '© 2026 Шифу Панда. Екатеринбург. Все права защищены.',
    settings          JSONB,
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    record_status     cfr_record_status NOT NULL DEFAULT 'normal'
);

-- 9.4 Ссылки в футере
CREATE TABLE IF NOT EXISTS cfr_footer_links (
    id         SERIAL PRIMARY KEY,
    footer_id  INTEGER NOT NULL DEFAULT 1 REFERENCES cfr_footer(id) ON DELETE CASCADE,
    text       VARCHAR(255) NOT NULL,
    href       VARCHAR(500) NOT NULL,
    position   INTEGER NOT NULL DEFAULT 0,
    record_status cfr_record_status NOT NULL DEFAULT 'normal'
);

-- 9.5 Соцсети в футере
CREATE TABLE IF NOT EXISTS cfr_footer_social (
    id         SERIAL PRIMARY KEY,
    footer_id  INTEGER NOT NULL DEFAULT 1 REFERENCES cfr_footer(id) ON DELETE CASCADE,
    social_id  VARCHAR(50) NOT NULL,
    title      VARCHAR(75) NOT NULL,
    url        VARCHAR(500) NOT NULL,
    position   INTEGER NOT NULL DEFAULT 0,
    record_status cfr_record_status NOT NULL DEFAULT 'normal'
);

-- 9.6 Меню навигации в футере
CREATE TABLE IF NOT EXISTS cfr_footer_menu (
    id         SERIAL PRIMARY KEY,
    footer_id  INTEGER NOT NULL DEFAULT 1 REFERENCES cfr_footer(id) ON DELETE CASCADE,
    text       VARCHAR(75) NOT NULL,
    href       VARCHAR(255) NOT NULL,
    enabled    BOOLEAN NOT NULL DEFAULT TRUE,
    position   INTEGER NOT NULL DEFAULT 0,
    record_status cfr_record_status NOT NULL DEFAULT 'normal'
);


-- ============================================
-- 10. ОБРАТНАЯ СОВМЕСТИМОСТЬ — Существующие таблицы сайта и ЛК
-- ============================================
-- Все таблицы создаём здесь для полного деплоя на сервер.
-- Таблицы: trainers, programs, news, sliders, schedule_items, prices,
--          staff, sections, workouts, settings, db_meta,
--          users, user_visits, user_payments, user_subscriptions

-- 10.1 Тренеры (старая схема, совместимость)
CREATE TABLE IF NOT EXISTS trainers (
    id            SERIAL PRIMARY KEY,
    image         VARCHAR(500),
    name          VARCHAR(255) NOT NULL,
    experience    VARCHAR(75),
    type          VARCHAR(50) NOT NULL DEFAULT 'trainer',
    description   TEXT,
    specialization VARCHAR(75),
    is_director   BOOLEAN NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trainer_photos (
    id            SERIAL PRIMARY KEY,
    trainer_id    INTEGER NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
    image         VARCHAR(500) NOT NULL,
    caption       VARCHAR(255),
    position      INTEGER NOT NULL DEFAULT 0
);

-- 10.2 Программы (старая схема)
CREATE TABLE IF NOT EXISTS programs (
    id            SERIAL PRIMARY KEY,
    image         VARCHAR(500),
    name          VARCHAR(255) NOT NULL,
    type          VARCHAR(50),
    description   TEXT
);

CREATE TABLE IF NOT EXISTS program_photos (
    id            SERIAL PRIMARY KEY,
    program_id    INTEGER NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    image         VARCHAR(500) NOT NULL,
    caption       VARCHAR(255),
    position      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS program_trainers (
    id            SERIAL PRIMARY KEY,
    program_id    INTEGER NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    trainer_id    INTEGER NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
    UNIQUE(program_id, trainer_id)
);

CREATE TABLE IF NOT EXISTS program_workouts (
    id            SERIAL PRIMARY KEY,
    program_id    INTEGER NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    day           VARCHAR(50),
    time          VARCHAR(50),
    params        JSONB
);

-- 10.3 Новости
CREATE TABLE IF NOT EXISTS news (
    id            SERIAL PRIMARY KEY,
    image         VARCHAR(500),
    title         VARCHAR(255) NOT NULL,
    text          TEXT,
    description   VARCHAR(500)
);

-- 10.4 Слайдеры
CREATE TABLE IF NOT EXISTS sliders (
    id            SERIAL PRIMARY KEY,
    title         VARCHAR(255),
    image         VARCHAR(500),
    interval      INTEGER NOT NULL DEFAULT 5,
    position      VARCHAR(20) NOT NULL DEFAULT 'center'
);

-- 10.5 Расписание (изображения)
CREATE TABLE IF NOT EXISTS schedule_items (
    id            SERIAL PRIMARY KEY,
    image         VARCHAR(500)
);

-- 10.6 Цены
CREATE TABLE IF NOT EXISTS prices (
    id            SERIAL PRIMARY KEY,
    image         VARCHAR(500)
);

-- 10.7 Сотрудники
CREATE TABLE IF NOT EXISTS staff (
    id            VARCHAR(50) PRIMARY KEY,
    name          VARCHAR(255) NOT NULL,
    image         VARCHAR(500),
    role          VARCHAR(100) NOT NULL DEFAULT ''
);

-- 10.8 Разделы
CREATE TABLE IF NOT EXISTS sections (
    id            VARCHAR(50) PRIMARY KEY,
    title         VARCHAR(255) NOT NULL,
    background    VARCHAR(255),
    cols          INTEGER NOT NULL DEFAULT 1
);

-- 10.9 Тренировки
CREATE TABLE IF NOT EXISTS workouts (
    id            SERIAL PRIMARY KEY,
    day           VARCHAR(50) NOT NULL DEFAULT '',
    time          VARCHAR(50) NOT NULL DEFAULT '',
    program_id    INTEGER,
    program_name  VARCHAR(255),
    params        JSONB,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10.10 Настройки (key-value)
CREATE TABLE IF NOT EXISTS settings (
    id            SERIAL PRIMARY KEY,
    key           VARCHAR(255) PRIMARY KEY,
    value         JSONB,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10.11 Мета-информация о миграциях
CREATE TABLE IF NOT EXISTS db_meta (
    id            SERIAL PRIMARY KEY,
    source        VARCHAR(255) NOT NULL,
    records       INTEGER NOT NULL DEFAULT 0,
    migrated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 11. ТАБЛИЦЫ ЛИЧНОГО КАБИНЕТА (ЛК)
-- ============================================

-- 11.1 Пользователи
CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    phone         VARCHAR(20) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name          VARCHAR(255),
    email         VARCHAR(255),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

-- 11.2 Посещения пользователей
CREATE TABLE IF NOT EXISTS user_visits (
    id            SERIAL PRIMARY KEY,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    program_id    INTEGER,
    visit_date    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_visits_user ON user_visits(user_id);
CREATE INDEX IF NOT EXISTS idx_user_visits_date ON user_visits(visit_date);

-- 11.3 Подписки пользователей
CREATE TABLE IF NOT EXISTS user_subscriptions (
    id            SERIAL PRIMARY KEY,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    program_id    INTEGER,
    status        VARCHAR(50) NOT NULL DEFAULT 'active',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_subs_user ON user_subscriptions(user_id);

-- 11.4 Оплаты пользователей
CREATE TABLE IF NOT EXISTS user_payments (
    id            SERIAL PRIMARY KEY,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount        DECIMAL(10,2) NOT NULL DEFAULT 0,
    description   VARCHAR(500),
    program_id    INTEGER,
    source        VARCHAR(50) NOT NULL DEFAULT 'manual',
    payment_date  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_payments_user ON user_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_payments_date ON user_payments(payment_date);


-- ============================================
-- 12. ТАБЛИЦЫ СТАТИСТИКИ И МОСТА
-- ============================================

-- 12.1 Просмотры страниц
CREATE TABLE IF NOT EXISTS cfr_page_views (
    id            BIGSERIAL PRIMARY KEY,
    page          VARCHAR(500) NOT NULL,
    viewed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_page_views_page ON cfr_page_views(page);

-- 12.2 Отправки форм
CREATE TABLE IF NOT EXISTS cfr_form_submissions (
    id            BIGSERIAL PRIMARY KEY,
    form_type     VARCHAR(255) NOT NULL,
    submitted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_form_submissions_type ON cfr_form_submissions(form_type);

-- 12.3 Очередь моста данных
CREATE TABLE IF NOT EXISTS bridge_queue (
    id              BIGSERIAL PRIMARY KEY,
    file_name       VARCHAR(255) NOT NULL,
    file_hash       VARCHAR(64),
    file_size       BIGINT,
    file_path       VARCHAR(500),
    entity          VARCHAR(100) NOT NULL,
    content         TEXT NOT NULL,
    status          cfr_bridge_packet_status NOT NULL DEFAULT 'pending',
    records_count   INTEGER NOT NULL DEFAULT 0,
    error_msg       TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_bridge_queue_status ON bridge_queue(status);
CREATE INDEX IF NOT EXISTS idx_bridge_queue_created ON bridge_queue(created_at);

-- ============================================
-- 13. ЗАПИСЬ О МИГРАЦИИ
-- ============================================

CREATE TABLE IF NOT EXISTS cfr_schema_migrations (
    id            SERIAL PRIMARY KEY,
    version       VARCHAR(20) NOT NULL UNIQUE,
    name          VARCHAR(255) NOT NULL,
    success       BOOLEAN NOT NULL DEFAULT TRUE,
    applied_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO cfr_schema_migrations (version, name, success)
VALUES ('001', 'initial_schema', TRUE)
ON CONFLICT (version) DO NOTHING;

COMMIT;
