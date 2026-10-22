#!/usr/bin/env node

// ✅ ПРАВИЛЬНЫЙ импорт - ОТДЕЛЬНО promises и sync
const fsPromises = require('fs').promises;
const fs = require('fs');
const path = require('path');
const { glob } = require('glob');

async function main() {
  const projectRoot = process.cwd();
  const outputFile = path.join(projectRoot, 'project-analysis.md');
  
  console.log('🔍 Сканируем ВСЕ файлы...');
  
  const allFiles = await glob('**/*', {
    cwd: projectRoot,
    ignore: ['node_modules/**', '.next/**', '.git/**'],
    dot: true
  });
  
  console.log(`📁 Всего файлов: ${allFiles.length}`);
  
  const textFiles = allFiles.filter(f => /\.(js|jsx|ts|tsx|css|scss|html|md|json|yaml|yml)$/i.test(f));
  const mediaFiles = allFiles.filter(f => /\.(png|jpg|jpeg|gif|svg|mp4|mp3|webp)$/i.test(f));
  
  console.log(`📄 Текст: ${textFiles.length}, 🖼️ Медиа: ${mediaFiles.length}`);
  
  // ✅ АНАЛИЗ со СТАТИСТИКОЙ ПРОПУЩЕННЫХ
  const fileStats = [];
  const skippedFiles = [];
  const imports = new Map();
  const components = new Set();
  let totalLines = 0;
  
  for (const filePath of textFiles) {
    try {
      const fullPath = path.join(projectRoot, filePath);
      
      // ✅ ПРАВИЛЬНЫЙ fs.statSync
      const stats = fs.statSync(fullPath);
      
      if (stats.size > 200 * 1024) {
        skippedFiles.push(`${filePath} (${(stats.size/1024).toFixed(1)}KB)`);
        continue;
      }
      
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n').length;
      totalLines += lines;
      
      fileStats.push({ 
        path: filePath, 
        lines, 
        size: stats.size,
        type: getFileType(filePath)
      });
      
      // Анализ импортов
      if (/\.(jsx?|tsx?)$/.test(filePath)) {
        const importMatches = [...content.matchAll(/from\s+['"`]([^'"`]+)['"`]/g)];
        const importList = importMatches.map(m => m[1]).filter(p => p.includes('.'));
        
        if (importList.length) imports.set(filePath, importList);
        
        if (!isConfigOrPage(filePath) && 
            (content.includes('export default') || /export\s+(const|function)\s+\w+/.test(content))) {
          components.add(filePath);
        }
      }
    } catch (e) {
      skippedFiles.push(`${filePath} [${e.message.slice(0,50)}]`);
    }
  }
  
  // Одинокие компоненты
  const lonelyComponents = Array.from(components).filter(comp => {
    const compName = path.basename(comp, path.extname(comp));
    return !Array.from(imports.values()).flat().some(imp => imp.includes(compName));
  });
  
  // ✅ БЕЗОПАСНОЕ ДЕРЕВО
  const treeText = generateTreeTextSafe(allFiles);
  
  // Markdown отчет
  let md = `# 🎯 Полный анализ проекта\n\n`;
  md += `**Дата:** ${new Date().toLocaleString('ru-RU')}\n\n`;
  md += `**Статистика:**\n`;
  md += `| Тип | Количество |\n|----|------------|\n`;
  md += `| 📁 Все файлы | **${allFiles.length}** |\n`;
  md += `| 📄 Текстовые | **${textFiles.length}** |\n`;
  md += `| 🖼️ Медиа | **${mediaFiles.length}** |\n`;
  md += `| 📏 Строк кода | **${totalLines.toLocaleString()}** |\n`;
  md += `| 🎨 UI компонентов | **${components.size}** |\n`;
  md += `| 🚨 Одиноких UI | **${lonelyComponents.length}** |\n\n`;
  
  // Пропущенные
  if (skippedFiles.length > 0) {
    md += `## ⚠️ Пропущенные файлы (${skippedFiles.length})\n\n\`\`\`\n${skippedFiles.slice(0,15).join('\n')}\n\`\`\`\n\n`;
  }
  
  // Дерево
  md += `## 🗂️ Структура проекта\n\n\`\`\`plaintext\n${treeText}\n\`\`\`\n\n`;
  
  // Топ файлов
  md += `## 🏆 Топ-10 файлов\n\n| # | Файл | Строк | KB |\n|----|------|-------|----|\n`;
  fileStats.sort((a,b) => b.lines - a.lines).slice(0,10).forEach((f,i) => {
    md += `| ${i+1} | \`${f.path}\` | ${f.lines} | ${(f.size/1024).toFixed(1)} |\n`;
  });
  
  // Одинокие
  if (lonelyComponents.length > 0) {
    md += `\n## 🚨 Одинокие UI компоненты (${lonelyComponents.length})\n\n`;
    lonelyComponents.slice(0,10).forEach(c => md += `- \`${c}\`\n`);
  }
  
  await fsPromises.writeFile(outputFile, md, 'utf8');
  
  console.log(`✅ Готово: ${outputFile}`);
  console.log(`📊 ${totalLines.toLocaleString()} строк, ${components.size} компонентов`);
  console.log(`🚨 Одиноких UI: ${lonelyComponents.length}`);
  
  if (skippedFiles.length > 0) {
    console.log(`⚠️ Пропущено: ${skippedFiles.length} файлов`);
    console.log('Примеры:', skippedFiles.slice(0,3));
  }
}

function getFileType(filePath) {
  if (/\.(jsx?|tsx?)$/.test(filePath)) return 'React/TSX';
  if (/\.(css|scss)$/.test(filePath)) return 'CSS';
  if (/\.json$/.test(filePath)) return 'JSON';
  if (/\.page|\.layout/.test(filePath)) return 'Page';
  return 'Code';
}

function isConfigOrPage(filePath) {
  const exclude = ['config.', 'tailwind.', 'tsconfig.', 'next.', 'package.',
                   'page.', 'layout.', 'error.', 'not-found.', 'db.',
                   'globals.css'];
  return exclude.some(p => path.basename(filePath).includes(p));
}

function generateTreeTextSafe(files) {
  const dirMap = {};
  
  files.forEach(file => {
    const parts = file.split(path.sep).filter(Boolean);
    const dirPath = parts.slice(0, -1).join(path.sep) || '.';
    const fileName = parts[parts.length - 1];
    
    if (!dirMap[dirPath]) dirMap[dirPath] = [];
    dirMap[dirPath].push(fileName);
  });
  
  const sortedDirs = Object.keys(dirMap).sort();
  let result = '';
  
  sortedDirs.forEach(dir => {
    const filesInDir = dirMap[dir].sort();
    const indent = '  '.repeat(dir.split(path.sep).filter(Boolean).length);
    
    result += `${indent}${path.basename(dir)}/\n`;
    filesInDir.forEach(file => {
      const icon = /\.(png|jpg|jpeg|gif|svg|mp4|mp3|webp)$/i.test(file) ? '🖼️ ' : '📄 ';
      result += `${indent}  ${icon}${file}\n`;
    });
  });
  
  return result;
}

main().catch(e => {
  console.error('❌ Ошибка:', e.message);
  process.exit(1)})
