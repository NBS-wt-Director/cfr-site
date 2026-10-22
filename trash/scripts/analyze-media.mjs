#!/usr/bin/env node

/**
 * analyze-media.mjs — Анализ медиа-файлов DanceStudio
 * 
 * Проходит по всем UUID-папкам в Files/, определяет формат, размер, разрешение
 * Сопоставляет UUID папок с UUID клиентов
 * Сохраняет результат в данные/DB/media_analysis.json
 */

import { readdirSync, statSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILES_DIR = join(__dirname, '..', 'данные', '_DB', 'Files');
const OUT_DIR = join(__dirname, '..', 'данные', 'DB');

// ==================== Утилиты ====================

/**
 * Читает UUID из client_uuids.json
 */
function loadClientUuids() {
  const uuidsPath = join(OUT_DIR, 'client_uuids.json');
  if (!existsSync(uuidsPath)) {
    console.error('❌ client_uuids.json не найден');
    process.exit(1);
  }
  const data = JSON.parse(readFileSync(uuidsPath, 'utf-8'));
  return new Set(data);
}

/**
 * Извлекает разрешение JPEG из бинарных данных
 * JPEG хранит размер в SOF маркере (0xFFC0, 0xFFC2, etc.)
 */
function extractJpegDimensions(buffer) {
  try {
    let i = 0;
    // Пропускаем все маркеры, ищем SOF (Start of Frame)
    while (i < buffer.length - 9) {
      if (buffer[i] !== 0xFF) { i++; continue; }
      const marker = buffer[i + 1];
      // SOF маркеры: 0xC0..0xC3, 0xC5..0xC7, 0xC9..0xCB, 0xCD..0xCF
      if ((marker >= 0xC0 && marker <= 0xC3) ||
          (marker >= 0xC5 && marker <= 0xC7) ||
          (marker >= 0xC9 && marker <= 0xCB) ||
          (marker >= 0xCD && marker <= 0xCF)) {
        // SOF маркер найден
        // bytes 4-5: height, bytes 6-7: width
        const height = buffer.readInt16BE(i + 5);
        const width = buffer.readInt16BE(i + 7);
        return { width, height };
      }
      // Пропускаем маркер + длина
      if (i + 3 >= buffer.length) break;
      const segLen = buffer.readInt16BE(i + 2);
      i += 2 + segLen;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Определяет формат файла по сигнатуре (magic bytes)
 * Читает только первые 1024 байта для скорости
 */
function detectFormat(filepath) {
  try {
    const stat = statSync(filepath);
    if (!stat.isFile()) return { format: 'dir', size: stat.size };
    
    const size = stat.size;
    const buf = readFileSync(filepath, { offset: 0, length: 1024 });
    
    // JPEG: FF D8 FF
    if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) {
      const dim = extractJpegDimensions(buf);
      return { format: 'JPEG', size, width: dim?.width || null, height: dim?.height || null };
    }
    
    // PNG: 89 50 4E 47
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) {
      return { format: 'PNG', size };
    }
    
    // GIF: GIF8
    if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) {
      return { format: 'GIF', size };
    }
    
    // WebP: RIFF....WEBP
    if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[7] === 0x57 && buf[8] === 0x45 && buf[9] === 0x42 && buf[10] === 0x50) {
      return { format: 'WebP', size };
    }
    
    // BMP: BM
    if (buf[0] === 0x42 && buf[1] === 0x4D) {
      return { format: 'BMP', size };
    }
    
    // По расширению
    const ext = basename(filepath).split('.').pop()?.toLowerCase();
    const extMap = {
      'jpg': 'JPEG', 'jpeg': 'JPEG', 'png': 'PNG', 'gif': 'GIF',
      'webp': 'WebP', 'bmp': 'BMP', 'svg': 'SVG', 'tiff': 'TIFF'
    };
    return { format: extMap[ext] || 'unknown', size };
  } catch {
    return { format: 'error', size: 0 };
  }
}

// ==================== Главный анализ ====================

function analyzeMedia() {
  console.log('📂 Сканирование Files/...');
  
  const clientUuids = loadClientUuids();
  console.log(`👥 UUID клиентов: ${clientUuids.size}`);
  
  const entries = readdirSync(FILES_DIR).sort();
  console.log(`📁 Файлов в Files/: ${entries.length}`);
  
  const folderStats = [];
  const matchedUuids = new Set();
  const orphanUuids = [];
  const formatCounts = {};
  const sizeBuckets = { '<10KB': 0, '10-50KB': 0, '50-100KB': 0, '100-500KB': 0, '500KB-1MB': 0, '>1MB': 0 };
  let totalSize = 0;
  let resolutions = [];
  
  for (const entry of entries) {
    const entryPath = join(FILES_DIR, entry);
    let entryStat;
    try { entryStat = statSync(entryPath); } catch { continue; }
    
    const isDir = entryStat.isDirectory();
    let matched = false;
    
    if (isDir) {
      // Поддержка папок (на случай если структура изменилась)
      const files = readdirSync(entryPath);
      for (const file of files) {
        const filePath = join(entryPath, file);
        const info = detectFormat(filePath);
        
        formatCounts[info.format] = (formatCounts[info.format] || 0) + 1;
        
        const s = info.size;
        totalSize += s;
        if (s < 10240) sizeBuckets['<10KB']++;
        else if (s < 51200) sizeBuckets['10-50KB']++;
        else if (s < 102400) sizeBuckets['50-100KB']++;
        else if (s < 512000) sizeBuckets['100-500KB']++;
        else if (s < 1048576) sizeBuckets['500KB-1MB']++;
        else sizeBuckets['>1MB']++;
        
        if (info.width && info.height) {
          resolutions.push({ width: info.width, height: info.height });
        }
        
        if (clientUuids.has(entry)) {
          matched = true;
          matchedUuids.add(entry);
        } else {
          orphanUuids.push(entry);
        }
        
        folderStats.push({
          folder: entry,
          fileName: file,
          format: info.format,
          size: info.size,
          width: info.width || null,
          height: info.height || null,
          sizeHuman: formatSize(info.size),
          matched: clientUuids.has(entry),
        });
      }
      
      if (!matched && files.length === 0) {
        orphanUuids.push(entry);
      }
    } else {
      // Прямой файл (UUID как имя файла)
      const info = detectFormat(entryPath);
      
      formatCounts[info.format] = (formatCounts[info.format] || 0) + 1;
      
      const s = info.size;
      totalSize += s;
      if (s < 10240) sizeBuckets['<10KB']++;
      else if (s < 51200) sizeBuckets['10-50KB']++;
      else if (s < 102400) sizeBuckets['50-100KB']++;
      else if (s < 512000) sizeBuckets['100-500KB']++;
      else if (s < 1048576) sizeBuckets['500KB-1MB']++;
      else sizeBuckets['>1MB']++;
      
      if (info.width && info.height) {
        resolutions.push({ width: info.width, height: info.height });
      }
      
      if (clientUuids.has(entry)) {
        matched = true;
        matchedUuids.add(entry);
      } else {
        orphanUuids.push(entry);
      }
      
      folderStats.push({
        folder: entry,
        fileName: basename(entryPath),
        format: info.format,
        size: info.size,
        width: info.width || null,
        height: info.height || null,
        sizeHuman: formatSize(info.size),
        matched: clientUuids.has(entry),
      });
    }
  }
  
  // Статистика
  const clientsWithPhotos = matchedUuids.size;
  const clientsWithoutPhotos = clientUuids.size - clientsWithPhotos;
  
  // Статистика разрешений
  const avgWidth = resolutions.length > 0 
    ? Math.round(resolutions.reduce((s, r) => s + r.width, 0) / resolutions.length) : 0;
  const avgHeight = resolutions.length > 0 
    ? Math.round(resolutions.reduce((s, r) => s + r.height, 0) / resolutions.length) : 0;
  const minWidth = resolutions.length > 0 ? Math.min(...resolutions.map(r => r.width)) : 0;
  const maxWidth = resolutions.length > 0 ? Math.max(...resolutions.map(r => r.width)) : 0;
  const minHeight = resolutions.length > 0 ? Math.min(...resolutions.map(r => r.height)) : 0;
  const maxHeight = resolutions.length > 0 ? Math.max(...resolutions.map(r => r.height)) : 0;
  
  // Статистика размеров файлов
  const sizes = folderStats.filter(f => f.size > 0).map(f => f.size);
  const minSize = sizes.length > 0 ? Math.min(...sizes) : 0;
  const maxSize = sizes.length > 0 ? Math.max(...sizes) : 0;
  const avgSize = sizes.length > 0 ? Math.round(sizes.reduce((s, v) => s + v, 0) / sizes.length) : 0;
  
  const result = {
    scan_date: new Date().toISOString(),
    total_folders: folders.length,
    clients_total: clientUuids.size,
    clients_with_photos: clientsWithPhotos,
    clients_without_photos: clientsWithoutPhotos,
    orphan_folders: orphanUuids.length,
    formats: formatCounts,
    resolution_stats: {
      count: resolutions.length,
      avg_width: avgWidth,
      avg_height: avgHeight,
      min_width: minWidth,
      max_width: maxWidth,
      min_height: minHeight,
      max_height: maxHeight,
    },
    size_stats: {
      total_bytes: totalSize,
      total_human: formatSize(totalSize),
      min_bytes: minSize,
      min_human: formatSize(minSize),
      max_bytes: maxSize,
      max_human: formatSize(maxSize),
      avg_bytes: avgSize,
      avg_human: formatSize(avgSize),
      buckets: sizeBuckets,
    },
    client_uuids_without_photos: orphanUuids.slice(0, 100),
    total_orphans_shown: orphanUuids.length,
    sample_folders: folderStats.slice(0, 20),
  };
  
  console.log(`\n📊 РЕЗУЛЬТАТЫ АНАЛИЗА МЕДИА:`);
  console.log(`   Всего папок:        ${result.total_folders}`);
  console.log(`   Клиентов всего:     ${result.clients_total}`);
  console.log(`   С фото:             ${result.clients_with_photos}`);
  console.log(`   Без фото:           ${result.clients_without_photos}`);
  console.log(`   Потерянных фото:    ${result.orphan_folders}`);
  console.log(`   Форматы:            ${JSON.stringify(formatCounts)}`);
  console.log(`   Среднее разрешение: ${avgWidth}x${avgHeight}`);
  console.log(`   Диапазон ширин:     ${minWidth} — ${maxWidth}`);
  console.log(`   Диапазон высот:     ${minHeight} — ${maxHeight}`);
  console.log(`   Общий размер:       ${result.size_stats.total_human}`);
  console.log(`   Средний размер:     ${result.size_stats.avg_human}`);
  
  return result;
}

function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i];
}

// ==================== Главная ====================

function main() {
  console.log('🔍 Media Analysis — DanceStudio\n');
  
  if (!existsSync(FILES_DIR)) {
    console.error(`❌ Директория не найдена: ${FILES_DIR}`);
    process.exit(1);
  }
  
  const result = analyzeMedia();
  
  const outputPath = join(OUT_DIR, 'media_analysis.json');
  writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf-8');
  console.log(`\n✅ media_analysis.json — ${(statSync(outputPath).size / 1024).toFixed(1)} КБ`);
  console.log('✅ Готово!');
}

try {
  main();
} catch (err) {
  console.error('❌ Ошибка:', err.message);
  console.error(err.stack);
  process.exit(1);
}
