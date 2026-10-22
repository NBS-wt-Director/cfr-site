-- ============================================
-- Миграция 002 — Мост данных (bridge_queue)
-- Дата: 2026-08-03
-- Описание: Таблица bridge_queue, функции автопереноса,
--            триггеры обработки пакетов из моста
-- ============================================

BEGIN;

-- ============================================
-- 1. ТАБЛИЦА ОЧЕРЕДИ МОСТА (единственная с jsonb)
-- ============================================
-- bridge_queue уже создана в 001_initial.sql
-- Здесь добавляем функции и триггеры


-- ============================================
-- 2. ФУНКЦИЯ ОБРАБОТКИ ПАКЕТА
-- ============================================

CREATE OR REPLACE FUNCTION process_bridge_queue()
RETURNS TABLE (
    packet_id BIGINT,
    entity_name VARCHAR,
    status TEXT,
    records_inserted INTEGER
)
AS $$
DECLARE
    v_packet RECORD;
    v_records INTEGER;
    v_status TEXT;
BEGIN
    FOR v_packet IN
        SELECT id, file_name, entity, content
        FROM bridge_queue
        WHERE status IN ('received', 'retry_pending')
        ORDER BY created_at ASC
    LOOP
        v_records := 0;
        v_status := 'completed';

        BEGIN
            -- Здесь логика парсинга XML и вставки в целевые таблицы
            -- Вызывается из API /api/bridge/receive и /api/bridge/process

            UPDATE bridge_queue
            SET status = 'completed',
                processed_at = NOW(),
                records_count = v_records
            WHERE id = v_packet.id;

            RETURN NEXT;
        EXCEPTION WHEN OTHERS THEN
            UPDATE bridge_queue
            SET status = 'error',
                error_msg = SQLERRM,
                processed_at = NOW()
            WHERE id = v_packet.id;

            RETURN NEXT;
        END;
    END LOOP;

    RETURN;
END;
$$ LANGUAGE plpgsql;


-- ============================================
-- 3. ФУНКЦИЯ ПЕРЕНОСА КЛИЕНТОВ ИЗ МОСТА
-- ============================================

CREATE OR REPLACE FUNCTION bridge_insert_client(
    p_id UUID,
    p_last_name VARCHAR,
    p_first_name VARCHAR,
    p_middle_name VARCHAR,
    p_mobile_phone VARCHAR,
    p_birth_date DATE,
    p_email VARCHAR,
    p_sex cfr_sex,
    p_agreement_number INTEGER,
    p_barcode VARCHAR,
    p_archive BOOLEAN,
    p_annotation VARCHAR
)
RETURNS UUID AS $$
DECLARE
    v_person_id UUID;
BEGIN
    -- Вставляем или обновляем person
    INSERT INTO cfr_persons (id, last_name, first_name, middle_name, mobile_phone, birth_date, email, sex)
    VALUES (p_id, p_last_name, p_first_name, p_middle_name, p_mobile_phone, p_birth_date, p_email, p_sex)
    ON CONFLICT (id) DO UPDATE SET
        last_name = EXCLUDED.last_name,
        first_name = EXCLUDED.first_name,
        middle_name = EXCLUDED.middle_name,
        mobile_phone = EXCLUDED.mobile_phone,
        birth_date = EXCLUDED.birth_date,
        email = EXCLUDED.email,
        sex = EXCLUDED.sex,
        updated_at = NOW()
    RETURNING id INTO v_person_id;

    -- Вставляем или обновляем client
    INSERT INTO cfr_clients (person_id, agreement_number, barcode, archive, annotation)
    VALUES (v_person_id, p_agreement_number, p_barcode, p_archive, p_annotation)
    ON CONFLICT (person_id) DO UPDATE SET
        agreement_number = EXCLUDED.agreement_number,
        barcode = EXCLUDED.barcode,
        archive = EXCLUDED.archive,
        annotation = EXCLUDED.annotation;

    RETURN v_person_id;
END;
$$ LANGUAGE plpgsql;


-- ============================================
-- 4. ФУНКЦИЯ ПЕРЕНОСА ТРЕНЕРОВ ИЗ МОСТА
-- ============================================

CREATE OR REPLACE FUNCTION bridge_insert_teacher(
    p_id UUID,
    p_last_name VARCHAR,
    p_first_name VARCHAR,
    p_middle_name VARCHAR,
    p_mobile_phone VARCHAR,
    p_short_code VARCHAR,
    p_experience VARCHAR,
    p_description VARCHAR,
    p_specialization VARCHAR,
    p_is_director BOOLEAN
)
RETURNS UUID AS $$
DECLARE
    v_person_id UUID;
BEGIN
    INSERT INTO cfr_persons (id, last_name, first_name, middle_name, mobile_phone)
    VALUES (p_id, p_last_name, p_first_name, p_middle_name, p_mobile_phone)
    ON CONFLICT (id) DO UPDATE SET
        last_name = EXCLUDED.last_name,
        first_name = EXCLUDED.first_name,
        middle_name = EXCLUDED.middle_name,
        mobile_phone = EXCLUDED.mobile_phone,
        updated_at = NOW()
    RETURNING id INTO v_person_id;

    INSERT INTO cfr_teachers (person_id, short_code, status, experience, description, specialization, is_director)
    VALUES (v_person_id, p_short_code, 'active', p_experience, p_description, p_specialization, p_is_director)
    ON CONFLICT (person_id) DO UPDATE SET
        short_code = EXCLUDED.short_code,
        experience = EXCLUDED.experience,
        description = EXCLUDED.description,
        specialization = EXCLUDED.specialization,
        is_director = EXCLUDED.is_director;

    RETURN v_person_id;
END;
$$ LANGUAGE plpgsql;


-- ============================================
-- 5. ФУНКЦИЯ ПЕРЕНОСА ВИЗИТОВ ИЗ МОСТА
-- ============================================

CREATE OR REPLACE FUNCTION bridge_insert_visit(
    p_id UUID,
    p_visit_date DATE,
    p_person_id UUID,
    p_entity_id UUID,
    p_account_id UUID,
    p_cost DECIMAL,
    p_payment_type cfr_payment_type,
    p_training_type_name VARCHAR,
    p_training_type_cost DECIMAL
)
RETURNS UUID AS $$
BEGIN
    INSERT INTO cfr_visits (id, visit_date, person_id, entity_id, account_id, cost, payment_type, training_type_name, training_type_cost)
    VALUES (p_id, p_visit_date, p_person_id, p_entity_id, p_account_id, p_cost, p_payment_type, p_training_type_name, p_training_type_cost)
    ON CONFLICT (id) DO UPDATE SET
        visit_date = EXCLUDED.visit_date,
        person_id = EXCLUDED.person_id,
        entity_id = EXCLUDED.entity_id,
        account_id = EXCLUDED.account_id,
        cost = EXCLUDED.cost,
        payment_type = EXCLUDED.payment_type,
        training_type_name = EXCLUDED.training_type_name,
        training_type_cost = EXCLUDED.training_type_cost;

    RETURN p_id;
END;
$$ LANGUAGE plpgsql;


-- ============================================
-- 6. ФУНКЦИЯ ПЕРЕНОСА АБОНЕМЕНТОВ ИЗ МОСТА
-- ============================================

CREATE OR REPLACE FUNCTION bridge_insert_account(
    p_id UUID,
    p_number INTEGER,
    p_person_id UUID,
    p_entity_id UUID,
    p_account_type_name VARCHAR,
    p_account_type_cost DECIMAL,
    p_original_cost DECIMAL,
    p_discount DECIMAL,
    p_payment_type cfr_payment_type,
    p_create_date DATE,
    p_begin_date DATE,
    p_days_count INTEGER,
    p_training_count INTEGER,
    p_free_training_count INTEGER,
    p_is_perpetual BOOLEAN,
    p_is_unlimited BOOLEAN,
    p_annotation VARCHAR
)
RETURNS UUID AS $$
BEGIN
    INSERT INTO cfr_accounts (id, number, person_id, entity_id, account_type_name, account_type_cost,
        original_cost, discount, payment_type, create_date, begin_date, days_count,
        training_count, free_training_count, is_perpetual, is_unlimited, annotation)
    VALUES (p_id, p_number, p_person_id, p_entity_id, p_account_type_name, p_account_type_cost,
        p_original_cost, p_discount, p_payment_type, p_create_date, p_begin_date, p_days_count,
        p_training_count, p_free_training_count, p_is_perpetual, p_is_unlimited, p_annotation)
    ON CONFLICT (id) DO UPDATE SET
        number = EXCLUDED.number,
        person_id = EXCLUDED.person_id,
        entity_id = EXCLUDED.entity_id,
        account_type_name = EXCLUDED.account_type_name,
        account_type_cost = EXCLUDED.account_type_cost,
        original_cost = EXCLUDED.original_cost,
        discount = EXCLUDED.discount,
        payment_type = EXCLUDED.payment_type,
        create_date = EXCLUDED.create_date,
        begin_date = EXCLUDED.begin_date,
        days_count = EXCLUDED.days_count,
        training_count = EXCLUDED.training_count,
        free_training_count = EXCLUDED.free_training_count,
        is_perpetual = EXCLUDED.is_perpetual,
        is_unlimited = EXCLUDED.is_unlimited,
        annotation = EXCLUDED.annotation,
        updated_at = NOW();

    RETURN p_id;
END;
$$ LANGUAGE plpgsql;


-- ============================================
-- 7. ФУНКЦИЯ ПОДБОРА КАНДИДАТОВ НА ЗАМЕНУ
-- ============================================

CREATE OR REPLACE FUNCTION cfr_find_replacement_candidates(
    p_entity_id UUID,
    p_original_teacher_id UUID,
    p_change_date TIMESTAMPTZ
)
RETURNS UUID[] AS $$
DECLARE
    v_candidates UUID[];
    v_style_id INTEGER;
BEGIN
    -- Получаем стиль группы
    SELECT style_id INTO v_style_id FROM cfr_entities WHERE id = p_entity_id;

    -- Ищем тренеров того же стиля, не удалённых
    SELECT array_agg(ts.person_id) INTO v_candidates
    FROM cfr_teacher_styles ts
    JOIN cfr_teachers t ON t.person_id = ts.person_id
    WHERE ts.style_id = v_style_id
      AND ts.person_id != p_original_teacher_id
      AND t.status = 'active'
      AND t.record_status != 'removed';

    RETURN v_candidates;
END;
$$ LANGUAGE plpgsql;


-- ============================================
-- 8. ТРИГГЕР: АВТООТМЕНА ПРИ ОТСУТСТВИИ КАНДИДАТОВ
-- ============================================

CREATE OR REPLACE FUNCTION cfr_auto_cancel_no_candidates()
RETURNS TRIGGER AS $$
DECLARE
    v_candidates UUID[];
BEGIN
    IF NEW.change_type = 'replace' AND NEW.replacement_teacher_person_id IS NULL THEN
        -- Ищем кандидатов
        v_candidates := cfr_find_replacement_candidates(NEW.entity_id, NEW.original_teacher_person_id, NEW.change_time);

        IF v_candidates IS NULL OR array_length(v_candidates, 1) = 0 THEN
            -- Нет кандидатов — помечаем как отмену
            NEW.change_type := 'cancel';
            NEW.reason := COALESCE(NEW.reason, 'Нет доступных тренеров для замены');
        ELSE
            -- Сохраняем кандидатов
            NEW.replacement_candidates := v_candidates;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_cancel_no_candidates ON cfr_schedule_changes;
CREATE TRIGGER trg_auto_cancel_no_candidates
    BEFORE INSERT OR UPDATE ON cfr_schedule_changes
    FOR EACH ROW
    EXECUTE FUNCTION cfr_auto_cancel_no_candidates();


-- ============================================
-- 9. ЗАПИСЬ О МИГРАЦИИ
-- ============================================

INSERT INTO cfr_schema_migrations (version, name, success)
VALUES ('002', 'bridge_queue_functions', TRUE)
ON CONFLICT (version) DO NOTHING;

COMMIT;
