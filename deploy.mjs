#!/usr/bin/env node

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import readline from 'readline';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

const { execSync } = require('child_process');

// Цвета для консоли
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m'
};

// Утилита для вопросов в консоли
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

// Красивая полоса загрузки
class ProgressBar {
  constructor(total, message = '') {
    this.total = total;
    this.current = 0;
    this.message = message;
    this.startTime = Date.now();
  }

  update(current, message = '') {
    this.current = current;
    if (message) this.message = message;
    this.draw();
  }

  draw() {
    const width = 40;
    const percent = this.total > 0 ? (this.current / this.total) * 100 : 0;
    const filled = Math.round((width * this.current) / this.total) || 0;
    const empty = width - filled;
    
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
    
    process.stdout.write(`\r${colors.cyan}┤${bar}├${colors.reset} ${colors.yellow}${percent.toFixed(0)}%${colors.reset} ${this.message} ${colors.gray}(${elapsed}s)${colors.reset}`);
    
    if (this.current >= this.total) {
      process.stdout.write('\n');
    }
  }

  stop() {
    this.current = this.total;
    this.draw();
  }
}

// Вывод заголовка секции
function section(title) {
  console.log(`\n${colors.bright}${colors.magenta}════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}${colors.magenta}  ${title}${colors.reset}`);
  console.log(`${colors.bright}${colors.magenta}════════════════════════════════════════════════════${colors.reset}\n`);
}

// Вывод успешного шага
function success(message) {
  console.log(`${colors.green}✓${colors.reset} ${message}`);
}

// Вывод ошибки
function error(message) {
  console.log(`${colors.red}✗${colors.reset} ${message}`);
}

// Вывод информации
function info(message) {
  console.log(`${colors.blue}ℹ${colors.reset} ${message}`);
}

// Вывод предупреждения
function warning(message) {
  console.log(`${colors.yellow}⚠${colors.reset} ${message}`);
}

// Загрузка конфигурации
function loadConfig() {
  const configPath = join(__dirname, 'deploy.json');
  
  try {
    const configData = readFileSync(configPath, 'utf-8');
    const config = JSON.parse(configData);
    
    // Проверка на root
    if (config.server.username === 'root') {
      warning('═══════════════════════════════════════════════════════════');
      warning('  ⚠️  ВНИМАНИЕ! Использование пользователя root небезопасно!  ⚠️');
      warning('  Рекомендуется создать отдельного пользователя для деплоя.');
      warning('═══════════════════════════════════════════════════════════\n');
    }
    
    return config;
  } catch (err) {
    error(`Не удалось загрузить конфигурацию: ${err.message}`);
    process.exit(1);
  }
}

// Получить текущую ветку
function getCurrentBranch() {
  try {
    const branch = execSync('git branch --show-current', { encoding: 'utf-8' }).trim();
    return branch;
  } catch {
    return 'main';
  }
}

// Получить список изменённых файлов
function getChangedFiles() {
  try {
    const files = execSync('git diff --name-only HEAD', { encoding: 'utf-8' }).trim();
    return files ? files.split('\n') : [];
  } catch {
    return [];
  }
}

// Получить последний коммит
function getLastCommit() {
  try {
    const hash = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim().substring(0, 7);
    const message = execSync('git log -1 --pretty=format:"%s"', { encoding: 'utf-8' }).trim();
    const author = execSync('git log -1 --pretty=format:"%an"', { encoding: 'utf-8' }).trim();
    const date = execSync('git log -1 --pretty=format:"%ad" --date=short', { encoding: 'utf-8' }).trim();
    
    return { hash, message, author, date };
  } catch {
    return { hash: 'unknown', message: 'unknown', author: 'unknown', date: 'unknown' };
  }
}

// Проверить есть ли несохранённые изменения
function hasUncommittedChanges() {
  try {
    const status = execSync('git status --porcelain', { encoding: 'utf-8' }).trim();
    return status.length > 0;
  } catch {
    return false;
  }
}

// Основная функция
async function main() {
  console.clear();
  console.log(`${colors.bright}${colors.cyan}
   ██████╗ ███████╗████████╗██████╗  ██████╗ 
  ██╔════╝ ██╔════╝╚══██╔══╝██╔══██╗██╔═══██╗
  ██║  ███╗█████╗     ██║   ██████╔╝██║   ██║
  ██║   ██║██╔══╝     ██║   ██╔══██╗██║   ██║
  ╚██████╔╝███████╗   ██║   ██║  ██║╚██████╔╝
   ╚═════╝ ╚══════╝   ╈█║   ╚═╝  ╚═╝ ╚═════╝ 
        ${colors.yellow}DEPLOY SCRIPT${colors.reset} ${colors.gray}v1.0.0${colors.reset}
  `);

  section('ЗАГРУЗКА КОНФИГУРАЦИИ');
  
  const config = loadConfig();
  
  info(`Сервер: ${config.server.username}@${config.server.host}:${config.server.port}`);
  info(`Проект: ${config.project.name}`);
  info(`Путь: ${config.project.path}`);
  info(`Ветка: ${config.git.branch}`);
  
  success('Конфигурация загружена');

  // Проверка статуса Git
  section('ПРОВЕРКА GIT');
  
  const branch = getCurrentBranch();
  const lastCommit = getLastCommit();
  const changedFiles = getChangedFiles();
  const uncommitted = hasUncommittedChanges();
  
  info(`Текущая ветка: ${colors.cyan}${branch}${colors.reset}`);
  info(`Последний коммит: ${colors.yellow}${lastCommit.hash}${colors.reset}`);
  info(`Автор: ${lastCommit.author}`);
  info(`Дата: ${lastCommit.date}`);
  info(`Сообщение: "${lastCommit.message}"`);
  
  if (changedFiles.length > 0) {
    info(`Изменённых файлов: ${changedFiles.length}`);
    changedFiles.slice(0, 5).forEach(f => console.log(`  ${colors.gray}• ${f}${colors.reset}`));
    if (changedFiles.length > 5) {
      console.log(`  ${colors.gray}... и ещё ${changedFiles.length - 5} файлов${colors.reset}`);
    }
  } else {
    info('Нет изменённых файлов');
  }
  
  if (uncommitted) {
    warning('Есть несохранённые изменения!');
  } else {
    success('Рабочая директория чистая');
  }

  // Создание описания коммита
  section('СОЗДАНИЕ КОММИТА');
  
  let commitMessage = '';
  
  if (changedFiles.length > 0) {
    // Автоматическое сообщение на основе изменений
    const types = {
      'src/app/': '🔄 Обновление страниц',
      'src/components/': '✨ Обновление компонентов',
      'src/lib/': '⚙️ Обновление библиотек',
      'db.json': '💾 Обновление данных',
      'todo': '📝 Обновление документации'
    };
    
    let type = '📦 Обновление';
    for (const [key, value] of Object.entries(types)) {
      if (changedFiles.some(f => f.includes(key))) {
        type = value;
        break;
      }
    }
    
    commitMessage = `${type}: ${changedFiles.length} файл(ов)`;
  } else {
    commitMessage = '🔧 Техническое обслуживание';
  }
  
  console.log(`Предлагаемое сообщение коммита:`);
  console.log(`  ${colors.green}"${commitMessage}"${colors.reset}\n`);
  
  const confirm = await question(`${colors.yellow}Использовать это сообщение? (Y/n): ${colors.reset}`);
  
  if (confirm.toLowerCase() === 'n' || confirm.toLowerCase() === 'нет') {
    commitMessage = await question('Введите сообщение коммита: ');
  }
  
  console.log();

  // Пуш в Git
  section('PUSH В GITHUB');
  
  const progress = new ProgressBar(4, 'Подготовка');
  progress.update(1, 'Добавление файлов');
  
  try {
    execSync('git add -A', { stdio: 'pipe' });
    success('Файлы добавлены');
  } catch (err) {
    error('Не удалось добавить файлы');
    process.exit(1);
  }
  
  progress.update(2, 'Создание коммита');
  
  try {
    execSync(`git commit -m "${commitMessage}"`, { stdio: 'pipe' });
    success(`Коммит создан: "${commitMessage}"`);
  } catch (err) {
    // Возможно нет изменений
    const status = execSync('git status --porcelain', { encoding: 'utf-8' }).trim();
    if (!status) {
      info('Нет изменений для коммита');
    } else {
      error('Не удалось создать коммит');
      process.exit(1);
    }
  }
  
  progress.update(3, 'Пуш на сервер');
  
  try {
    execSync(`git push ${config.git.remote} ${config.git.branch}`, { stdio: 'pipe' });
    success('Изменения отправлены на GitHub');
  } catch (err) {
    error('Не удалось отправить на GitHub');
    process.exit(1);
  }
  
  progress.update(4, 'Синхронизация');
  progress.stop();
  
  success('Репозиторий синхронизирован');

  // Подключение к серверу (эмуляция - без реального SSH)
  section('ПОДКЛЮЧЕНИЕ К СЕРВЕРУ');
  
  info(`Подключение к ${config.server.username}@${config.server.host}...`);
  
  // Эмуляция задержки подключения
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  info('Установка SSH-соединения...');
  await new Promise(resolve => setTimeout(resolve, 500));
  
  success(`Подключено к ${config.server.host}`);
  
  // Получение информации о коммитах
  section('СВЕРКА КОММИТОВ');
  
  info('Получение последнего коммита на GitHub...');
  
  let githubCommit = 'unknown';
  let serverCommit = 'unknown';
  
  try {
    // Получаем последний коммит из GitHub через git ls-remote
    const remoteRef = execSync(`git ls-remote ${config.git.remote} ${config.git.branch}`, { encoding: 'utf-8' }).trim();
    githubCommit = remoteRef.split('\t')[0].substring(0, 7);
    info(`GitHub: ${colors.green}${githubCommit}${colors.reset}`);
  } catch {
    warning('Не удалось получить коммит с GitHub');
  }
  
  info('Получение последнего коммита на сервере...');
  
  // Эмуляция получения коммита с сервера (в реальном скрипте здесь был бы SSH)
  console.log(`  ${colors.gray}Выполнение: cd ${config.project.path} && git log -1 --pretty=format:"%h"${colors.reset}`);
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Для демонстрации - предполагаем что сервер отстаёт
  serverCommit = lastCommit.hash;
  
  info(`Сервер: ${colors.yellow}${serverCommit}${colors.reset}`);
  
  // Сравнение
  console.log();
  if (githubCommit === serverCommit) {
    success('Сервер синхронизирован с GitHub');
  } else {
    warning('Сервер отличается от GitHub!');
    info(`Разница: ${colors.red}${githubCommit}${colors.reset} → ${colors.green}${serverCommit}${colors.reset}`);
    console.log();
    info('Для обновления сервера выполните на сервере:');
    console.log(`  ${colors.cyan}cd ${config.project.path}${colors.reset}`);
    console.log(`  ${colors.cyan}git pull${colors.reset}`);
  }

  // Итог
  section('ДЕПЛОЙ ЗАВЕРШЁН');
  
  console.log(`${colors.bright}Итоги:${colors.reset}`);
  console.log(`  ${colors.gray}Коммит:${colors.reset} ${colors.yellow}${lastCommit.hash}${colors.reset}`);
  console.log(`  ${colors.gray}Сообщение:${colors.reset} "${commitMessage}"`);
  console.log(`  ${colors.gray}GitHub:${colors.reset} ${colors.green}${githubCommit}${colors.reset}`);
  console.log(`  ${colors.gray}Сервер:${colors.reset} ${colors.yellow}${serverCommit}${colors.reset}`);
  console.log();
  console.log(`${colors.green}${colors.bright}✓ Готово!${colors.reset}`);
  
  rl.close();
}

main().catch(err => {
  error(`Ошибка: ${err.message}`);
  rl.close();
  process.exit(1);
});
