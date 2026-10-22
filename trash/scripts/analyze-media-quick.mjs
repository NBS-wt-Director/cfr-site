#!/usr/bin/env node

/**
 * analyze-media-quick.mjs — Быстрый анализ медиа-файлов DanceStudio
 * 
 * Использует только stat() для скорости. Извлекает JPEG размеры из первых байт.
 */

import { readdirSync, statSync, readFileSync, writeFileSync } from 'fs';
import { join, basename, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILES_DIR = join(__dirname, '..', 'данные', '_DB', 'Files');
const OUT_DIR = join(__dirname, '..', 'данные', 'DB');

function loadClientUuids() {
  const data = JSON.parse(readFileSync(join(OUT_DIR, 'client_uuids.json'), 'utf-8'));
  return new Set(data);
}

function extractJpegSize(filePath) {
  try {
    const fd = readFileSync(filePath, { length: 1024 });
    if (fd[0] !== 0xFF || fd[1] !== 0xD8 || fd[2] !== 0xFF) return null;
    
    let i = 3;
    while (i < fd.length - 5) {
      if (fd[i] !== 0xFF) { i++; continue; }
      const marker = fd[i + 1];
      if ((marker >= 0xC0 && marker <= 0xC3) ||
          (marker >= 0xC5 && marker <= 0xC7) ||
          (marker >= 0xC9 && marker <= 0xCB) ||
          (marker >= 0xCD && marker <= 0xCF)) {
        const h = fd[i + 5] * 256 + fd[i + 6];
        const w = fd[i + 7] * 256 + fd[i + 8];
        return { width: w, height: h };
      }
      if (i + 3 >= fd.length) break;
      const segLen = fd[i + 2] * 256 + fd[i + 3];
      i += 2 + segLen;
    }
    return null;
  } catch { return null; }
}

function main() {
  console.log('🔍 Quick Media Analysis...\n');
  
  const clientUuids = loadClientUuids();
  console.log(`UUID клиентов: ${clientUuids.size}`);
  
  // Пробуем statSync на первом файле для проверки
  const firstEntry = readdirSync(FILES_DIR, { withFileTypes: true })[0];
  console.log(`Первый entry: ${firstEntry.name}, isFile: ${firstEntry.isFile()}, isDir: ${firstEntry.isDirectory()}`);
  
  let total = 0, dirs = 0, files = 0;
  for (const entry of readdirSync(FILES_DIR, { withFileTypes: true })) {
    if (entry.isDirectory()) dirs++;
    else if (entry.isFile()) files++;
    total++;
  }
  console.log(`Всего: ${total}, папок: ${dirs}, файлов: ${files}\n`);
  
  const matchedUuids = new Set();
  const orphanUuids = [];
  const formats = {};
  const sizes = [];
  let totalSize = 0;
  const resolutions = [];
  let processed = 0;
  
  const entries = readdirSync(FILES_DIR, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = join(FILES_DIR, entry.name);
    let st;
    try { st = statSync(fullPath); } catch { continue; }
    
    if (entry.isDirectory()) {
      // Папка
      const subFiles = readdirSync(fullPath);
      for (const sf of subFiles) {
        const sfPath = join(fullPath, sf);
        let ss;
        try { ss = statSync(sfPath); } catch { continue; }
        sizes.push(ss.size);
        totalSize += ss.size;
        
        const fmt = sf.split('.').pop()?.toLowerCase() || 'unknown';
        formats[fmt] = (formats[fmt] || 0) + 1;
        
        const dim = extractJpegSize(sfPath);
        if (dim) resolutions.push(dim);
      }
      if (clientUuids.has(entry.name)) { matchedUuids.add(entry.name); }
      else { orphanUuids.push(entry.name); }
    } else {
      // Файл
      sizes.push(st.size);
      totalSize += st.size;
      
      const ext = entry.name.split('.').pop()?.toLowerCase() || 'unknown';
      formats[ext] = (formats[ext] || 0) + 1;
      
      const dim = extractJpegSize(fullPath);
      if (dim) resolutions.push(dim);
      
      if (clientUuids.has(entry.name)) { matchedUuids.add(entry.name); }
      else { orphanUuids.push(entry.name); }
    }
    
    processed++;
    if (processed % 100 === 0) {
      console.log(`  Обработано: ${processed}/${entries.length}`);
    }
  }
  
  const clientsWith = matchedUuids.size;
  const clientsWithout = clientUuids.size - clientsWith;
  
  const avgW = resolutions.length ? Math.round(resolutions.reduce((s,r) => s + r.width, 0) / resolutions.length) : 0;
  const avgH = resolutions.length ? Math.round(resolutions.reduce((s,r) => s + r.height, 0) / resolutions.length) : 0;
  const minW = resolutions.length ? Math.min(...resolutions.map(r => r.width)) : 0;
  const maxW = resolutions.length ? Math.max(...resolutions.map(r => r.width)) : 0;
  const minH = resolutions.length ? Math.min(...resolutions.map(r => r.height)) : 0;
  const maxH = resolutions.length ? Math.max(...resolutions.map(r => r.height)) : 0;
  const minS = sizes.length ? Math.min(...sizes) : 0;
  const maxS = sizes.length ? Math.max(...sizes) : 0;
  const avgS = sizes.length ? Math.round(sizes.reduce((s,v) => s+v, 0) / sizes.length) : 0;
  
  const buckets = { '<10KB': 0, '10-50KB': 0, '50-100KB': 0, '100-500KB': 0, '500KB-1MB': 0, '>1MB': 0 };
  for (const s of sizes) {
    if (s < 10240) buckets['<10KB']++;
    else if (s < 51200) buckets['10-50KB']++;
    else if (s < 102400) buckets['50-100KB']++;
    else if (s < 512000) buckets['100-500KB']++;
    else if (s < 1048576) buckets['500KB-1MB']++;
    else buckets['>1MB']++;
  }
  
  const result = {
    scan_date: new Date().toISOString(),
    total_files: entries.length,
    clients_total: clientUuids.size,
    clients_with_photos: clientsWith,
    clients_without_photos: clientsWithout,
    orphan_folders: orphanUuids.length,
    formats: formats,
    resolution_stats: {
      count: resolutions.length,
      avg_width: avgW,
      avg_height: avgH,
      min_width: minW,
      max_width: maxW,
      min_height: minH,
      max_height: maxH,
    },
    size_stats: {
      total_bytes: totalSize,
      total_human: formatSize(totalSize),
      min_bytes: minS,
      min_human: formatSize(minS),
      max_bytes: maxS,
      max_human: formatSize(maxS),
      avg_bytes: avgS,
      avg_human: formatSize(avgS),
      buckets: buckets,
    },
    client_uuids_without_photos: orphanUuids.slice(0, 50),
  };
  
  console.log(`\n📊 РЕЗУЛЬТАТЫ:`);
  console.log(`   Всего файлов/папок: ${result.total_files}`);
  console.log(`   С фото:             ${clientsWith}`);
  console.log(`   Без фото:           ${clientsWithout}`);
  console.log(`   Потерянных:         ${orphanUuids.length}`);
  console.log(`   Форматы:            ${JSON.stringify(formats)}`);
  console.log(`   Разрешения:         ${avgW}x${avgH} (${minW}-${maxW} x ${minH}-${maxH})`);
  console.log(`   Размер:             ${formatSize(totalSize)} (avg ${formatSize(avgS)})`);
  
  const outputPath = join(OUT_DIR, 'media_analysis.json');
  writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf-8');
  console.log(`\n✅ media_analysis.json — ${(statSync(outputPath).size / 1024).toFixed(1)} КБ`);
}

function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i];
}

try { main(); } catch (err) { console.error('❌', err.message); console.error(err.stack); process.exit(1); }
