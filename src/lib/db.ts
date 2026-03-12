import fs from 'fs';
import path from 'path';
import { Low } from 'lowdb';  // ← Low КЛАСС
import { JSONFile } from 'lowdb/node';  // ← АДАПТЕР

const dbPath = path.join(process.cwd(), 'db.json');  // ← data/db.json
const adapter = new JSONFile(dbPath);  // ← НОВЫЙ адаптер
export const db = new Low(adapter, {});  // ← Low(адаптер, дефолт)

// ✅ getDb = loadDb (алиас для совместимости)
export const getDb = (): any => {
  try {
    if (fs.existsSync(dbPath)) {
      return JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
    }
  } catch {}
  return { sliders: [], trainers: [], news: [], contacts: {} };
};

// ✅ loadDb (новое имя)
export const loadDb = getDb;

// ✅ saveDb
export const saveDb = (data: any): boolean => {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
    return true;
  } catch {
    return false;
  }
};

export default db;
