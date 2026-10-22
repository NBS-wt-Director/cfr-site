-- ============================================
-- Миграция 004 — Оптимизация избыточности
-- Дата: 2026-08-03
-- Описание: Удаление дублирующих таблиц и полей,
--            объединение футера, чистка справочников
-- ============================================

BEGIN;

-- ============================================
-- 1. УДАЛЕНИЕ ДУБЛИРУЮЩИХ ТАБЛИЦ
-- ============================================

-- 1.1 cfr_user_photos → замещена cfr_media
DROP TABLE IF EXISTS cfr_user_photos CASCADE;

-- 1.2 cfr_teacher_photos → замещена cfr_media
DROP TABLE IF EXISTS cfr_teacher_photos CASCADE;

-- 1.3 cfr_card_uses → данные уже в cfr_transactions
DROP TABLE IF EXISTS cfr_card_uses CASCADE;


-- ============================================
-- 2. УДАЛЕНИЕ ДУБЛИРУЮЩИХ ПОЛЕЙ
-- ============================================

-- 2.1 Удаляем ФИО из cfr_reservations (хранятся в cfr_persons)
ALTER TABLE cfr_reservations
    DROP COLUMN IF EXISTS last_name,
    DROP COLUMN IF EXISTS first_name,
    DROP COLUMN IF EXISTS birth_date,
    DROP COLUMN IF EXISTS mobile_phone,
    DROP COLUMN IF EXISTS parent_last_name,
    DROP COLUMN IF EXISTS parent_mobile_phone;

-- 2.2 Удаляем training_type_name из cfr_visits (используется cfr_entities.name)
ALTER TABLE cfr_visits
    DROP COLUMN IF EXISTS training_type_name,
    DROP COLUMN IF EXISTS training_type_cost;


-- ============================================
-- 3. ОБЪЕДИНЕНИЕ ФУТЕРА (4 → 2 таблицы)
-- ============================================

-- 3.1 Данные из cfr_footer_social → cfr_footer_links
INSERT INTO cfr_footer_links (footer_id, text, href, position)
SELECT 1, CONCAT('Соцсеть: ', social_id), url, position
FROM cfr_footer_social
WHERE record_status != 'removed' OR record_status IS NULL
ON CONFLICT DO NOTHING;

-- 3.2 Данные из cfr_footer_menu → cfr_footer_links
INSERT INTO cfr_footer_links (footer_id, text, href, position)
SELECT 1, text, href, position + 100
FROM cfr_footer_menu
WHERE enabled = true AND (record_status != 'removed' OR record_status IS NULL)
ON CONFLICT DO NOTHING;

-- 3.3 Удаляем старые таблицы
DROP TABLE IF EXISTS cfr_footer_social CASCADE;
DROP TABLE IF EXISTS cfr_footer_menu CASCADE;


-- ============================================
-- 4. УДАЛЕНИЕ record_status ИЗ СПРАВОЧНИКОВ
-- ============================================

ALTER TABLE cfr_tags DROP COLUMN IF EXISTS record_status;
ALTER TABLE cfr_informers DROP COLUMN IF EXISTS record_status;
ALTER TABLE cfr_reservation_statuses DROP COLUMN IF EXISTS record_status;
ALTER TABLE cfr_teacher_balance_types DROP COLUMN IF EXISTS record_status;
ALTER TABLE cfr_charges DROP COLUMN IF EXISTS record_status;
ALTER TABLE cfr_products DROP COLUMN IF EXISTS record_status;
ALTER TABLE cfr_schedule_changes DROP COLUMN IF EXISTS record_status;


-- ============================================
-- 5. ЗАПИСЬ О МИГРАЦИИ
-- ============================================

INSERT INTO cfr_schema_migrations (version, name, success)
VALUES ('004', 'optimize_redundancy', TRUE)
ON CONFLICT (version) DO NOTHING;

COMMIT;