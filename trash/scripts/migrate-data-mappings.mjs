#!/usr/bin/env node
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.PG_HOST || 'localhost',
  port: parseInt(process.env.PG_PORT || '5432', 10),
  database: process.env.PG_DATABASE || 'cfr_site',
  user: process.env.PG_USER || 'cfr',
  password: process.env.PG_PASSWORD,
});

async function migrate() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Создание таблицы data_mappings...');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS data_mappings (
        id SERIAL PRIMARY KEY,
        entity_type VARCHAR(50) NOT NULL,
        json_id INTEGER,
        pg_id INTEGER,
        json_name VARCHAR(255),
        pg_name VARCHAR(255),
        status VARCHAR(20) DEFAULT 'mapped',
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    
    console.log('✅ Таблица data_mappings создана');
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_data_mappings_entity ON data_mappings(entity_type);
      CREATE INDEX IF NOT EXISTS idx_data_mappings_json_id ON data_mappings(json_id);
      CREATE INDEX IF NOT EXISTS idx_data_mappings_pg_id ON data_mappings(pg_id);
      CREATE INDEX IF NOT EXISTS idx_data_mappings_status ON data_mappings(status);
    `);
    
    console.log('✅ Индексы созданы');
    console.log('\n✅ Миграция завершена успешно!');
  } catch (error) {
    console.error('❌ Ошибка миграции:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
