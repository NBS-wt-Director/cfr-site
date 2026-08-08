-- ============================================
-- Схема БД для сайта "Шифу Панда" (ЦФР)
-- Табличная структура (не key-value)
-- ============================================

-- ============================================
-- 1. КОНТЕНТ: Тренеры
-- ============================================
CREATE TABLE IF NOT EXISTS trainers (
  id              BIGINT PRIMARY KEY,
  image           TEXT,
  name            TEXT,
  experience      TEXT,
  type            TEXT DEFAULT 'trainer',
  description     TEXT,
  specialization  TEXT,
  is_director     BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trainer_photos (
  id          SERIAL PRIMARY KEY,
  trainer_id  BIGINT REFERENCES trainers(id) ON DELETE CASCADE,
  image       TEXT,
  caption     TEXT,
  position    INT DEFAULT 0
);

-- ============================================
-- 2. КОНТЕНТ: Программы
-- ============================================
CREATE TABLE IF NOT EXISTS programs (
  id          BIGINT PRIMARY KEY,
  image       TEXT,
  name        TEXT,
  type        TEXT,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS program_photos (
  id         SERIAL PRIMARY KEY,
  program_id BIGINT REFERENCES programs(id) ON DELETE CASCADE,
  image      TEXT,
  caption    TEXT,
  position   INT DEFAULT 0
);

-- Связь программ и тренеров (many-to-many)
CREATE TABLE IF NOT EXISTS program_trainers (
  program_id BIGINT REFERENCES programs(id) ON DELETE CASCADE,
  trainer_id BIGINT REFERENCES trainers(id) ON DELETE CASCADE,
  PRIMARY KEY (program_id, trainer_id)
);

-- Тренировки внутри программ
CREATE TABLE IF NOT EXISTS program_workouts (
  id         SERIAL PRIMARY KEY,
  program_id BIGINT REFERENCES programs(id) ON DELETE CASCADE,
  day        TEXT,
  time       TEXT,
  params     JSONB DEFAULT '[]'
);

-- ============================================
-- 3. КОНТЕНТ: Новости
-- ============================================
CREATE TABLE IF NOT EXISTS news (
  id          BIGINT PRIMARY KEY,
  image       TEXT,
  title       TEXT,
  text        TEXT,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. КОНТЕНТ: Слайдер
-- ============================================
CREATE TABLE IF NOT EXISTS sliders (
  id        BIGINT PRIMARY KEY,
  title     TEXT,
  image     TEXT,
  interval  INT DEFAULT 5,
  position  TEXT DEFAULT 'center'
);

-- ============================================
-- 5. КОНТЕНТ: Расписание / Цены
-- ============================================
CREATE TABLE IF NOT EXISTS schedule_items (
  id    INT PRIMARY KEY,
  image TEXT
);

CREATE TABLE IF NOT EXISTS prices (
  id    INT PRIMARY KEY,
  image TEXT
);

-- ============================================
-- 6. КОНТЕНТ: Сотрудники
-- ============================================
CREATE TABLE IF NOT EXISTS staff (
  id    TEXT PRIMARY KEY,
  name  TEXT,
  image TEXT,
  role  TEXT
);

-- ============================================
-- 7. КОНТЕНТ: Разделы главной страницы
-- ============================================
CREATE TABLE IF NOT EXISTS sections (
  id         TEXT PRIMARY KEY,
  title      TEXT,
  background TEXT,
  cols       INT
);

-- ============================================
-- 8. КОНТЕНТ: Отдельные тренировки
-- ============================================
CREATE TABLE IF NOT EXISTS workouts (
  id           BIGINT PRIMARY KEY,
  day          TEXT,
  time         TEXT,
  program_id   BIGINT,
  program_name TEXT,
  params       JSONB DEFAULT '[]',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 9. НАСТРОЙКИ (key-value для объектов настроек)
-- ============================================
CREATE TABLE IF NOT EXISTS settings (
  key         VARCHAR(255) PRIMARY KEY,
  value       JSONB NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 10. ЛИЧНЫЙ КАБИНЕТ: Пользователи
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  phone         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name          TEXT,
  email         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_subscriptions (
  id         SERIAL PRIMARY KEY,
  user_id    INT REFERENCES users(id) ON DELETE CASCADE,
  program_id BIGINT REFERENCES programs(id) ON DELETE SET NULL,
  status     TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_visits (
  id         SERIAL PRIMARY KEY,
  user_id    INT REFERENCES users(id) ON DELETE CASCADE,
  program_id BIGINT,
  visit_date TIMESTAMPTZ DEFAULT NOW()
);

-- Оплаты (импорт из CRM)
CREATE TABLE IF NOT EXISTS user_payments (
  id          SERIAL PRIMARY KEY,
  user_id     INT REFERENCES users(id) ON DELETE CASCADE,
  amount      NUMERIC(10, 2),
  payment_date TIMESTAMPTZ DEFAULT NOW(),
  description TEXT,
  source      TEXT DEFAULT 'manual',        -- 'manual' | 'crm_import'
  program_id  BIGINT
);

-- ============================================
-- 11. МЕТА МИГРАЦИИ
-- ============================================
CREATE TABLE IF NOT EXISTS db_meta (
  id          SERIAL PRIMARY KEY,
  migrated_at TIMESTAMPTZ DEFAULT NOW(),
  source      TEXT NOT NULL DEFAULT 'db.json',
  records     INTEGER DEFAULT 0
);

-- ============================================
-- ИНДЕКСЫ
-- ============================================
CREATE INDEX IF NOT EXISTS idx_trainer_photos_trainer ON trainer_photos(trainer_id);
CREATE INDEX IF NOT EXISTS idx_program_photos_program ON program_photos(program_id);
CREATE INDEX IF NOT EXISTS idx_program_workouts_program ON program_workouts(program_id);
CREATE INDEX IF NOT EXISTS idx_user_subs_user ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_visits_user ON user_visits(user_id);
CREATE INDEX IF NOT EXISTS idx_user_payments_user ON user_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_settings_updated ON settings(updated_at);