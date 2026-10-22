async function addPathComment() {
  const rootDir = process.cwd();
  
  console.log('🔍 Сканируем ВСЕ файлы проекта...');
  
  // Рекурсивный поиск файлов (замена glob)
  async function findCodeFiles(dir) {
    const files = [];
    const items = await fs.readdir(dir, { withFileTypes: true });
    
    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      
      // Исключаем папки
      if (item.isDirectory()) {
        if (['node_modules', 'dist', 'build', '.git', 'coverage', '.next'].includes(item.name)) {
          continue;
        }
        files.push(...await findCodeFiles(fullPath));
      } else if (item.isFile()) {
        const ext = path.extname(item.name).toLowerCase();
        const filename = item.name.toLowerCase();
        
        // Файлы кода (добавил БОЛЬШЕ расширений)
        const codeExts = ['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs', '.vue', '.svelte', 
                          '.coffee', '.lit', '.astro', '.solid', '.pcss'];
        
        // Исключаем конфиги и JSON
        if (codeExts.includes(ext) && 
            !filename.includes('.config') && 
            !filename.includes('.json') &&
            ext !== '.json') {
          files.push(fullPath);
        }
      }
    }
    return files;
  }
  
  const files = await findCodeFiles(rootDir);
  console.log(`📁 Найдено файлов кода: ${files.length}`);
  
  let modifiedCount = 0;
  let skippedCount = 0;
  
  for (const filePath of files) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const lines = content.split(/\r?\n/);
      
      // Ищем первую НЕПУСТУЮ строку
      let firstNonEmptyLine = '';
      let firstNonEmptyIndex = 0;
      
      for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        if (trimmed !== '') {
          firstNonEmptyLine = lines[i];
          firstNonEmptyIndex = i;
          break;
        }
      }
      
      // ПРОВЕРЯЕМ ТОЧНО наличие комментария с путем
      const fullPathComment = `// File: ${filePath}`;
      const hasPathComment = firstNonEmptyLine.includes('// File: ') || 
                           firstNonEmptyLine.includes(fullPathComment) ||
                           firstNonEmptyLine.match(/\/\/\s*File:\s*\/.+/) ||
                           content.includes(fullPathComment);
      
      if (hasPathComment) {
        console.log(`⏭️  Уже есть: ${path.relative(rootDir, filePath)}`);
        skippedCount++;
        continue;
      }
      
      // Добавляем комментарий
      const comment = `// File: ${filePath}`;
      
      let newContent;
      if (firstNonEmptyIndex === 0 && lines[0].trim() !== '') {
        newContent = comment + '\n' + content;
      } else {
        // Вставляем после пустых строк
        newContent = lines.slice(0, firstNonEmptyIndex).join('\n') + '\n' + 
                     comment + '\n' + lines.slice(firstNonEmptyIndex).join('\n');
      }
      
      await fs.writeFile(filePath, newContent, 'utf8');
      console.log(`✅ Обработан: ${path.relative(rootDir, filePath)}`);
      modifiedCount++;
      
    } catch (error) {
      if (error.code !== 'EACCES') {
        console.error(`❌ Ошибка ${path.relative(rootDir, filePath)}:`, error.message);
      }
    }
  }
  
  console.log(`\n🎉 Готово! Изменено: ${modifiedCount}, пропущено: ${skippedCount}`);
  console.log(`📊 Всего файлов найдено: ${files.length}`);
}

addPathComment().catch(console.error);
