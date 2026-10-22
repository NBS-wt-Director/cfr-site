-- ============================================
-- Миграция 003 — Исправления критических проблем
-- Дата: 2026-08-03
-- Описание: XSS-защита, обновление ENUM, DECIMAL(8,2),
--            исправление типов полей
-- ============================================

BEGIN;

-- ============================================
-- 1. XSS-ЗАЩИТА НА УРОВНЕ БД
-- ============================================

-- 1.1 Функция очистки текста от HTML/скриптов
CREATE OR REPLACE FUNCTION cfr_sanitize_text(input TEXT)
RETURNS TEXT AS $$
DECLARE
    v_result TEXT;
BEGIN
    v_result := input;
    -- Удаляем script-теги и их содержимое
    v_result := regexp_replace(v_result, '<script[^>]*>[\s\S]*?</script>', '', 'gi');
    -- Удаляем style-теги
    v_result := regexp_replace(v_result, '<style[^>]*>[\s\S]*?</style>', '', 'gi');
    -- Удаляем on* атрибуты (onclick, onload, onerror, etc.)
    v_result := regexp_replace(v_result, '\s+on\w+\s*=\s*["\'][^"\']*["\']', '', 'gi');
    -- Удаляем javascript: ссылки
    v_result := regexp_replace(v_result, 'javascript\s*:', '', 'gi');
    -- Удаляем опасные HTML-теги
    v_result := regexp_replace(v_result, '</?(script|iframe|embed|object|applet|meta|link|base|form|input|button|textarea|select|option)[^>]*>', '', 'gi');
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;


-- 1.2 Триггер XSS-защиты для cfr_persons
CREATE OR REPLACE FUNCTION cfr_xss_clean_persons()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.last_name IS NOT NULL THEN
        NEW.last_name := cfr_sanitize_text(NEW.last_name);
    END IF;
    IF NEW.first_name IS NOT NULL THEN
        NEW.first_name := cfr_sanitize_text(NEW.first_name);
    END IF;
    IF NEW.middle_name IS NOT NULL THEN
        NEW.middle_name := cfr_sanitize_text(NEW.middle_name);
    END IF;
    IF NEW.notes IS NOT NULL THEN
        NEW.notes := cfr_sanitize_text(NEW.notes);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_xss_clean_persons ON cfr_persons;
CREATE TRIGGER trg_xss_clean_persons
    BEFORE INSERT OR UPDATE ON cfr_persons
    FOR EACH ROW
    EXECUTE FUNCTION cfr_xss_clean_persons();


-- 1.3 Триггер XSS-защиты для cfr_notes
CREATE OR REPLACE FUNCTION cfr_xss_clean_notes()
RETURNS TRIGGER AS $$
BEGIN
    NEW.text := cfr_sanitize_text(NEW.text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_xss_clean_notes ON cfr_notes;
CREATE TRIGGER trg_xss_clean_notes
    BEFORE INSERT OR UPDATE ON cfr_notes
    FOR EACH ROW
    EXECUTE FUNCTION cfr_xss_clean_notes();


-- 1.4 Триггер XSS-защиты для cfr_messages
CREATE OR REPLACE FUNCTION cfr_xss_clean_messages()
RETURNS TRIGGER AS $$
BEGIN
    NEW.text := cfr_sanitize_text(NEW.text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_xss_clean_messages ON cfr_messages;
CREATE TRIGGER trg_xss_clean_messages
    BEFORE INSERT OR UPDATE ON cfr_messages
    FOR EACH ROW
    EXECUTE FUNCTION cfr_xss_clean_messages();


-- 1.5 Триггер XSS-защиты для cfr_tasks
CREATE OR REPLACE FUNCTION cfr_xss_clean_tasks()
RETURNS TRIGGER AS $$
BEGIN
    NEW.text := cfr_sanitize_text(NEW.text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_xss_clean_tasks ON cfr_tasks;
CREATE TRIGGER trg_xss_clean_tasks
    BEFORE INSERT OR UPDATE ON cfr_tasks
    FOR EACH ROW
    EXECUTE FUNCTION cfr_xss_clean_tasks();


-- 1.6 Триггер XSS-защиты для cfr_reservations
CREATE OR REPLACE FUNCTION cfr_xss_clean_reservations()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.comments IS NOT NULL THEN
        NEW.comments := cfr_sanitize_text(NEW.comments);
    END IF;
    IF NEW.last_name IS NOT NULL THEN
        NEW.last_name := cfr_sanitize_text(NEW.last_name);
    END IF;
    IF NEW.first_name IS NOT NULL THEN
        NEW.first_name := cfr_sanitize_text(NEW.first_name);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_xss_clean_reservations ON cfr_reservations;
CREATE TRIGGER trg_xss_clean_reservations
    BEFORE INSERT OR UPDATE ON cfr_reservations
    FOR EACH ROW
    EXECUTE FUNCTION cfr_xss_clean_reservations();


-- ============================================
-- 2. ENUM-ИСПРАВЛЕНИЯ
-- ============================================

-- 2.1 Добавляем значение 'paid' в cfr_payment_type (если отсутствует)
ALTER TYPE cfr_payment_type ADD VALUE IF NOT EXISTS 'paid' AFTER 'mixed';

-- 2.2 Добавляем значение 'online' в cfr_entity_type (если отсутствует)
ALTER TYPE cfr_entity_type ADD VALUE IF NOT EXISTS 'online' AFTER 'massage';


-- ============================================
-- 3. DECIMAL(8,2) — УВЕЛИЧЕНИЕ ТОЧНОСТИ
-- ============================================

-- 3.1 cfr_visits — стоимость визита
ALTER TABLE cfr_visits
    ALTER COLUMN cost TYPE DECIMAL(8,2),
    ALTER COLUMN training_type_cost TYPE DECIMAL(8,2);

-- 3.2 cfr_accounts — стоимость абонемента
ALTER TABLE cfr_accounts
    ALTER COLUMN account_type_cost TYPE DECIMAL(8,2),
    ALTER COLUMN original_cost TYPE DECIMAL(8,2),
    ALTER COLUMN discount TYPE DECIMAL(8,2);

-- 3.3 cfr_entities — цена за занятие
ALTER TABLE cfr_entities
    ALTER COLUMN price_per_session TYPE DECIMAL(8,2);

-- 3.4 cfr_transactions — сумма транзакции
ALTER TABLE cfr_transactions
    ALTER COLUMN amount TYPE DECIMAL(8,2),
    ALTER COLUMN balance_after TYPE DECIMAL(8,2);


-- ============================================
-- 4. ЗАПИСЬ О МИГРАЦИИ
-- ============================================

INSERT INTO cfr_schema_migrations (version, name, success)
VALUES ('003', 'fixes_xss_and_types', TRUE)
ON CONFLICT (version) DO NOTHING;

COMMIT;