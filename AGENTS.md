# CFR-Site — Инструкции для AI

## 🚫 КРИТИЧЕСКИЕ ПРАВИЛА БЕЗОПАСНОСТИ

### Работа с файлами вне проекта — КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО

При работе над **любым** проектом без **тройного указания** и **особого разрешения** пользователя критической и недопустимой ошибкой является:

1. **Изменение файлов/структуры файлового дерева вне проекта**, в котором запущена модель.
   — Все изменения (создание, редактирование, удаление) разрешены **ТОЛЬКО** в файлах внутри рабочей директории текущего проекта.

2. **Удаление файлов за пределами проекта напрямую**, без подтверждения.
   — Удаление происходит **только** если пользователь ознакомился со списком файлов на удаление в панели плагина.
   — Даже после ознакомления — **только перемещение в корзину**, никогда прямое удаление.

3. **Самовольное изменение падежей и прочих языковых аспектов в абсолютных путях файлов.**
   — Пути к файлам должны сохраняться в точности как есть. Никогда не изменяйте регистр, падежи, транслитерацию или любые другие языковые аспекты в путях.

**Нарушение этих правил = критическая ошибка.** Всегда уточняйте у пользователя перед любыми действиями с файлами вне текущего проекта.

---

## 📋 Общее
- **Репо:** `https://github.com/NBS-wt-Director/cfr-site`
- **Домен:** центр-фр.рф
- **Сервер:** Ubuntu 24.04, путь `/home/cfr_balloo/sites/cfrsite`
- **Стек:** Next.js 16 + Webpack + PM2 + NGINX
- **Порты:** Next.js → 3000, NGINX проксирует 80/443 → 3000
- **База:** `db.json` (lowdb)

## ⚠️ КРИТИЧЕСКИЕ ПРАВИЛА

### 1. Turbopack ЗАПРЕЩЁН навсегда

Next.js 16 по умолчанию использует Turbopack, который **ломает сборку** (Tailwind CSS генерирует стили, которые Turbopack не может распарсить).

**Всегда используйте Webpack:**
```json
"build": "next build --webpack",
"start": "next start --no-turbopack -p 3000"
```

Это зафиксировано в:
- `package.json` (scripts dev/build/start)
- `deploy/ecosystem.config.js` (args: 'start --no-turbopack -p 3000')

**Никогда не меняйте эти скрипты.** Если `next build` падает с ошибкой `Parsing CSS source code failed` — это Turbopack.

### 2. Секреты — ТОЛЬКО через переменные окружения

**НИКОГДА не хардкодите пароли, токены, ключи в коде.**

Правильно:
```ts
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET не установлен');
}
```

Неправильно:
```ts
const JWT_SECRET = process.env.JWT_SECRET || 'cfr-lk-secret-2026';
```

Обязательные переменные:
- `JWT_SECRET` — для JWT-токенов ЛК (минимум 32 символа, `openssl rand -base64 32`)
- `ADMIN_API_KEY` — для защиты админ-маршрутов (`openssl rand -base64 32`)
- `PG_PASSWORD` — пароль PostgreSQL (`openssl rand -base64 16`)
- `SMTP_PASSWORD` — пароль SMTP (если используется)

Файл `.env.production` должен быть на сервере, но НЕ в репозитории.
Шаблон: `.env.example` — в репозитории, без секретов.

### 3. API маршруты — новый синтаксис
Все файлы в `src/app/api/**/route.ts`:
- `params: { id: string }` → `params: Promise<{ id: string }>`
- `params.id` → `await params`
- `import { db }` → `import { getDb, saveDb }`
- `await db.getData()` → `getDb()`
- `await db.updateXxx()` → `saveDb(data)`

**Не используй:**
- `db.getData()`
- `db.updateNews()`, `db.updateTrainers()` и т.д.
- `import { loadDb }` → используй `getDb()`
- `loadDb()` → используй `getDb()`

### 4. Типизация
- Next.js 16 строго типизирует. Если ошибка типа — используй `as any` для быстродействия.
- `href` может быть `undefined` → добавляй `|| '#'`
- `photoAlbum` может быть `undefined` → используй `as any[]`
- Функции-обработчики должны принимать `File | null`, не просто `File`

### 5. pm2
```js
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'cfrsite',
    script: './node_modules/next/dist/bin/next',
    args: 'start --no-turbopack -p 3000',
    cwd: '/home/cfr_balloo/sites/cfrsite',
    instances: 1,
    exec_mode: 'fork',
    env: { NODE_ENV: 'production', PORT: 3000 },
    env_file: '.env.production',
    wait_ready: true,
    kill_timeout: 5000
  }]
};
```

## 🚀 Деплой

```bash
cd /home/cfr_balloo/sites/cfrsite

# 1. Бэкап
cp db.json db.json.backup.$(date +%s)

# 2. Остановить
pm2 stop cfrsite

# 3. Обновить код
git pull origin main

# 4. Пересобрать
rm -rf .next node_modules/.cache
npm install
npm run build

# 5. Запустить
pm2 start ecosystem.config.js --update-env

# 6. Проверить
sleep 5 && pm2 logs cfrsite --lines 20 --nostream
curl -s -o /dev/null -w "HTTP: %{http_code}\n" http://localhost:3000
```

**Откат:**
```bash
cp db.json.backup.* db.json
pm2 restart cfrsite
```

## 🔧 Частые проблемы

| Проблема | Решение |
|----------|---------|
| `Turbopack build failed` | `next build --webpack` |
| `Property 'getData' does not exist` | Заменить на `getDb()` |
| `Property 'xxx' does not exist on type` | Добавить в `DbData` или использовать `as any` |
| `Type 'string \| undefined' is not assignable to type 'Url'` | Добавить `\|\| '#'` к href |
| `Your local changes would be overwritten` | `git checkout -- .` перед `git pull` |
| `502 Bad Gateway` | Пересобрать с webpack, проверить логи pm2 |

## 📁 Структура проекта
```
cfr-site/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── admin/       # Админ API (news, trainers, pages, etc.)
│   │   ├── programs/        # Программы тренировок
│   │   ├── schedule/        # Расписание
│   │   ├── trainers/        # Тренеры
│   │   └── layout.tsx       # Глобальный layout
│   ├── components/
│   │   ├── admin/           # Админ компоненты
│   │   ├── home/            # Домашние компоненты
│   │   └── ui/              # UI компоненты
│   └── lib/
│       └── db.ts            # getDb(), saveDb()
├── public/                  # Статические файлы
├── deploy/
│   └── ecosystem.config.js  # PM2 конфиг
├── next.config.js
├── package.json
└── tailwind.config.ts
```

## 💾 База данных
Файл `db.json` хранит все данные сайта. Структура:
```json
{
  "sliders": [],
  "trainers": [],
  "news": [],
  "programs": [],
  "schedule": [],
  "contacts": {},
  "sections": [],
  "prices": [],
  "globalDivider": {},
  "sliderSettings": {},
  "emailConfig": {}
}
```

## 🎨 Дизайн
- Tailwind CSS v3
- Кастомные CSS-переменные в `globals.css`
- Все размеры шрифтов фиксируются на 16px через глобальные стили
- Секции имеют фиксированные id: `#schedule`, `#prices`, `#programs`, `#trainers`, `#news`, `#contacts`

---

## 📋 МУЛЬТИТИКЕТЫ — ФОРМАТ КОМАНД

### Формат

**Три строки. Больше ничего:**

```
Прочитай документ <путь к MULTITICKET.md>
и выполни тикет <N>
```

**Пример:**

```
Прочитай документ cfr-site/MULTITICKET-DANCESTUDIO.md
и выполни тикет D1
```

### Что делает AI

1. Читает указанный файл мультитикета
2. Находит указанный тикет по номеру
3. Читает тикет полностью
4. Выполняет код задания

### Почему минимум слов

- Лишние слова путают — AI может проигнорировать контекст
- Чёткая структура "прочитай документ + выполни тикет" — надёжнее длинных инструкций
- Номер тикета = точка входа. AI сам найдёт и прочитает весь контекст

### Исключения

Это правило касается только команд на выполнение тикетов мультитикетов.
Обычные вопросы и задачи выполняются без этого формата.
