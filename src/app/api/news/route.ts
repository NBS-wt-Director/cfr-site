import { NextResponse } from 'next/server';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import path from 'path';

const filePath = path.join(process.cwd(), 'db.json');
const defaultData = { news: [] };

async function getDb() {
  const db = new Low<any>(new JSONFile(filePath), defaultData);
  await db.read();
  return db;
}

export async function GET() {
  try {
    const db = await getDb();
    return NextResponse.json(db.data?.news || []);
  } catch (error) {
    console.error('Error reading news:', error);
    return NextResponse.json([]);
  }
}
