-- ============================================
-- Миграция 005 — Чистка дубликатов + бережное хранение уникальных данных
-- Дата: 2026-08-03
--
-- ПРАВИЛО: JSONB запрещён везде, кроме bridge_queue (как и было)
--
-- Что делаем:
-- 1. Добавляем legacy_data TEXT в 3 таблицы для уникальных сериализованных данных
-- 2. Удаляем дубликаты (BurnRes, Visits, Reservations, CardUses, Files, Comments, Tasks, StatusChanges)
-- ============================================

BEGIN;


-- ============================================
-- 1. LEGACY_DATA: уникальные данные → TEXT (НЕ JSONB!)
-- ============================================

-- 1.1 cfr_accounts — уникальные поля из Account.xml, IndividualAccount.xml, RentAccount.xml
-- Поля: Groups, Reservations, Stages, Visits, BurnRes, Bonus, Schedule, TenantType
ALTER TABLE cfr_accounts ADD COLUMN IF NOT EXISTS legacy_data TEXT;
COMMENT ON COLUMN cfr_accounts.legacy_data IS 'Бережно перенесённые сериализованные данные из DanceStudio (Groups, Reservations, Stages, Visits, BurnRes, Bonus, Schedule, TenantType). НЕ ПАРСИТЬ — для CRM позже. НЕ ПОКАЗЫВАТЬ в ЛК. JSONB запрещён.';

-- 1.2 cfr_clients — уникальные поля из Client.xml
-- Поля: CardUses, Deposit, Bonus, Comments, Tasks, StatusChanges, Files
ALTER TABLE cfr_clients ADD COLUMN IF NOT EXISTS legacy_data TEXT;
COMMENT ON COLUMN cfr_clients.legacy_data IS 'Бережно перенесённые сериализованные данные из DanceStudio (CardUses, Deposit, Bonus, Comments, Tasks, StatusChanges, Files). НЕ ПАРСИТЬ — для CRM позже. НЕ ПОКАЗЫВАТЬ в ЛК. JSONB запрещён.';

-- 1.3 cfr_visits — уникальные поля из SingleTraining.xml
-- Поля: Visits, Bonus, Deposit
ALTER TABLE cfr_visits ADD COLUMN IF NOT EXISTS legacy_data TEXT;
COMMENT ON COLUMN cfr_visits.legacy_data IS 'Бережно перенесённые сериализованные данные из DanceStudio (Visits, Bonus, Deposit). НЕ ПАРСИТЬ — для CRM позже. НЕ ПОКАЗЫВАТЬ в ЛК. JSONB запрещён.';


-- ============================================
-- 2. УДАЛЯЕМ ДУБЛИКАТЫ
-- ============================================

-- 2.1 BurnRes — дублируется в cfr_reservations (удалено в 004)
-- 2.2 Visits — дублируется в cfr_visits (удалено в 004)
-- 2.3 Reservations — дублируется в cfr_reservations (удалено в 004)
-- 2.4 CardUses — уже в cfr_transactions (таблица удалена в 004)
-- 2.5 Files — уже в cfr_media (таблица cfr_user_photos удалена в 004)
-- 2.6 Comments — можно в cfr_persons.notes (удалено в 004)
-- 2.7 Tasks — уже в cfr_tasks (удалено в 004)
-- 2.8 StatusChanges — не нужно для ЛК (удалено в 004)

-- Все дубликаты уже удалены в 004_optimize.sql.
-- Эта миграция только подтверждает решение.


-- ============================================
-- 3. СОХРАНЯЕМ: Rent (LastName, Name, MobilePhone)
-- ============================================

-- Rent (73 записи): LastName, Name, MobilePhone — НЕ дубликат!
-- Арендатор может не быть клиентом → данные потеряются.
-- Оставляем как есть в cfr_entities.
COMMENT ON TABLE cfr_entities IS 'Единая таблица сущностей: группы, индивид. тренировки, аренда, массаж, сплит. rent: сохраняем LastName, Name, MobilePhone — арендатор может не быть клиентом';


-- ============================================
-- 4. ОБНОВЛЕНИЕ ЗАМЕТОК НА ТАБЛИЦАХ
-- ============================================

COMMENT ON TABLE cfr_accounts IS 'Абонементы. legacy_data: сериализованные данные из DanceStudio (НЕ ПАРСИТЬ, для CRM позже)';
COMMENT ON TABLE cfr_clients IS 'Клиенты (1:1 → cfr_persons). legacy_data: сериализованные данные из DanceStudio (НЕ ПАРСИТЬ, для CRM позже)';
COMMENT ON TABLE cfr_visits IS 'Визиты клиентов (крупнейшая таблица, 71873+ записей). legacy_data: сериализованные данные из DanceStudio (НЕ ПАРСИТЬ, для CRM позже).';


-- ============================================
-- 5. ЗАПИСЬ О МИГРАЦИИ
-- ============================================

INSERT INTO cfr_schema_migrations (version, name, success)
VALUES ('005', 'clean_duplicates_and_legacy', TRUE)
ON CONFLICT (version) DO NOTHING;


COMMIT;