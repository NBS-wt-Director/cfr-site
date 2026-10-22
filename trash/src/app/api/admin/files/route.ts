import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/postgres';
import { readdir, stat, unlink } from 'fs/promises';
import { join } from 'path';
import { authenticateAdmin } from '@/lib/auth';

async function getAllFiles(dirPath: string, baseDir: string = ''): Promise<{ path: string; size: number; relativePath: string }[]> {
  const files: { path: string; size: number; relativePath: string }[] = [];
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);
      const relativePath = baseDir ? `${baseDir}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        const subFiles = await getAllFiles(fullPath, relativePath);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        const fileStat = await stat(fullPath);
        files.push({ path: fullPath, size: fileStat.size, relativePath });
      }
    }
  } catch (error) {
    console.error('Error reading directory:', error);
  }
  return files;
}

async function getUsedFilesFromPg(): Promise<Set<string>> {
  const references = new Set<string>();
  try {
    const client = await pool.connect();
    try {
      const result = await client.query(
        "SELECT file_path FROM cfr_media WHERE record_status != 'removed'"
      );
      for (const row of result.rows) references.add(row.file_path);
    } finally { client.release(); }
  } catch (error) {
    console.error('Error reading PG media:', error);
  }
  return references;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} ГБ`;
}

export async function GET(request: NextRequest) {
  const auth = authenticateAdmin(request);
  if (auth !== true) return auth;
  try {
    const uploadsDir = join(process.cwd(), 'public', 'uploads');
    const files = await getAllFiles(uploadsDir);
    const references = await getUsedFilesFromPg();
    
    const usedFiles: typeof files = [];
    const garbageFiles: typeof files = [];
    
    for (const file of files) {
      const isUsed = [...references].some(ref => file.relativePath.includes(ref) || ref.includes(file.relativePath));
      if (isUsed) usedFiles.push(file);
      else garbageFiles.push(file);
    }
    
    const usedSize = usedFiles.reduce((s, f) => s + f.size, 0);
    const garbageSize = garbageFiles.reduce((s, f) => s + f.size, 0);
    
    let pgSize = 0;
    try {
      const client = await pool.connect();
      try {
        const r = await client.query('SELECT pg_database_size(current_database()) as size');
        pgSize = parseInt(r.rows[0].size, 10);
      } finally { client.release(); }
    } catch {}
    
    const publicFiles = await getAllFiles(join(process.cwd(), 'public'));
    const srcFiles = await getAllFiles(join(process.cwd(), 'src'));
    const publicSize = publicFiles.reduce((s, f) => s + f.size, 0);
    const srcSize = srcFiles.reduce((s, f) => s + f.size, 0);
    
    return NextResponse.json({
      uploads: { totalFiles: files.length, totalSize: usedSize + garbageSize, usedFiles: usedFiles.length, usedSize, garbageFiles: garbageFiles.length, garbageSize },
      site: { totalSize: publicSize + srcSize + pgSize, publicSize, srcSize, pgSize, memoryUsage: 0 }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = authenticateAdmin(request);
  if (auth !== true) return auth;
  try {
    const uploadsDir = join(process.cwd(), 'public', 'uploads');
    const references = await getUsedFilesFromPg();
    const files = await getAllFiles(uploadsDir);
    
    const garbageFiles: string[] = [];
    for (const file of files) {
      const isUsed = [...references].some(ref => file.relativePath.includes(ref) || ref.includes(file.relativePath));
      if (!isUsed) garbageFiles.push(file.path);
    }
    
    let deletedCount = 0;
    let deletedSize = 0;
    for (const filePath of garbageFiles) {
      try {
        const fileStat = await stat(filePath);
        await unlink(filePath);
        deletedCount++;
        deletedSize += fileStat.size;
      } catch (e) {
        console.error('Error deleting file:', filePath, e);
      }
    }
    
    return NextResponse.json({ success: true, deletedCount, deletedSize, message: `Удалено ${deletedCount} файлов (${formatSize(deletedSize)})` });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
