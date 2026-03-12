import { NextResponse } from 'next/server';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import path from 'path';
import fs from 'fs';

const pagesFilePath = path.join(process.cwd(), 'data', 'pages.json');

export async function GET() {
  try {
    // Читаем файл напрямую
    const fileContent = fs.readFileSync(pagesFilePath, 'utf-8');
    const pages = JSON.parse(fileContent);
    
    // Если это массив - используем как есть, если объект - берем ключ pages
    const pagesArray = Array.isArray(pages) ? pages : (pages.pages || []);
    
    // Возвращаем только включенные страницы
    const enabledPages = pagesArray.filter((p: any) => p.enabled);
    return NextResponse.json(enabledPages);
  } catch (error) {
    console.error('Error reading pages:', error);
    return NextResponse.json([]);
  }
}
