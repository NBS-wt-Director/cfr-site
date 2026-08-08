# Тикет: Security & Build Fixes (C1-C2, M2-M4, W1-W5)

## Общее
- **Репо:** cfr-site (`/home/ivan/Рабочий стол/проекты/цфр/cfr-site`)
- **Стек:** Next.js 16 + Webpack + PM2 + NGINX
- **УЖЕ ИЗВЕСТНО:** Turbopack запрещён, секреты только через env, все пути к файлам известны
- **УЖЕ ПРОЧИТАНО:** Все ключевые файлы проекта (AGENTS.md, package.json, .gitignore, deploy configs, все admin routes, postgres.ts, db.ts, next.config.js, ecosystem.config.js, nginx.conf, docker-compose.yml, init.sql, .env.example)

## Цели
1. C1: Добавить авторизацию ко ВСЕМ админ-маршрутам
2. C2: Добавить лимит размера загрузки файлов
3. M2: Добавить rate limiting
4. M3: Очистить git от db.json
5. M4: Пересобрать package-lock.json
6. W1: Добавить CORS-заголовки
7. W2: Добавить проверку Content-Type
8. W3: Защитить yandex-disk маршруты
9. W4: Оптимизировать next.config.js для продакшена
10. W5: Создать favicon.ico из logo.png

---

## T1: C1 — Авторизация всех админ-маршрутов

### Проблема
Только 2 из 20 админ-маршрутов защищены `ADMIN_API_KEY`:
- ✅ `src/app/api/admin/news/route.ts` — защищён
- ✅ `src/app/api/admin/trainers/route.ts` — защищён
- ❌ Остальные 18 маршрутов БЕЗ авторизации

### Решение
Создать middleware-функцию `authenticateAdmin` в `src/lib/auth.ts`:

```ts
// src/lib/auth.ts
import { NextRequest, NextResponse } from 'next/server';

const ADMIN_API_KEY = process.env.ADMIN_API_KEY;

export function authenticateAdmin(req: NextRequest): NextResponse | boolean {
  if (!ADMIN_API_KEY) {
    console.error('ADMIN_API_KEY не установлен');
    return NextResponse.json({ error: 'Ошибка конфигурации сервера' }, { status: 500 });
  }
  const auth = req.headers.get('authorization');
  if (!auth || auth !== `Basic ${Buffer.from(ADMIN_API_KEY).toString('base64')}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return true;
}
```

### Применить ко ВСЕМ маршрутам в `src/app/api/admin/`:
1. `src/app/api/admin/db-mode/route.ts` — GET/POST
2. `src/app/api/admin/db/route.ts` — GET/POST (критично! экспорт/импорт БД)
3. `src/app/api/admin/files/route.ts` — все route
4. `src/app/api/admin/footer/route.ts` — все route
5. `src/app/api/admin/lk/import-excel/route.ts` — POST
6. `src/app/api/admin/lk/payments/route.ts` — все route
7. `src/app/api/admin/lk/users/route.ts` — GET/POST/DELETE
8. `src/app/api/admin/lk/visits/route.ts` — все route
9. `src/app/api/admin/migrate-db/route.ts` — GET/POST (критично! миграция)
10. `src/app/api/admin/news/[id]/route.ts` — все route
11. `src/app/api/admin/pages/route.ts` — все route
12. `src/app/api/admin/save-prices/route.ts` — POST
13. `src/app/api/admin/save-schedule/route.ts` — все route
14. `src/app/api/admin/stats/export/route.ts` — GET
15. `src/app/api/admin/stats/route.ts` — GET
16. `src/app/api/admin/trainers/[id]/route.ts` — все route
17. `src/app/api/admin/yandex-disk/check-folder/route.ts` — GET
18. `src/app/api/admin/yandex-disk/sync/route.ts` — POST

### Pattern для каждого route.ts:
```ts
import { authenticateAdmin } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const auth = authenticateAdmin(req);
  if (auth !== true) return auth;
  
  // ... rest of the code
}
```

---

## T2: C2 — Лимит размера загрузки файлов

### Файл: `src/app/api/upload/route.ts`

Добавить проверку размера после чтения formData:

```ts
// После получения file
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
if (file.size > MAX_FILE_SIZE) {
  return NextResponse.json({ error: 'Файл слишком большой (макс. 10MB)' }, { status: 413 });
}
```

---

## T3: M2 — Rate Limiting

### Создать: `src/lib/rate-limit.ts`

```ts
// src/lib/rate-limit.ts
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimits = new Map<string, RateLimitEntry>();

export function rateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimits.get(key);
  
  if (!entry || now > entry.resetTime) {
    rateLimits.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }
  
  if (entry.count >= maxRequests) {
    return false;
  }
  
  entry.count++;
  return true;
}
```

### Применить к:
1. `src/app/api/lk/auth/route.ts` — 5 запросов / 1 минуту
2. `src/app/api/admin/*/route.ts` — 30 запросов / 1 минуту

Pattern:
```ts
import { rateLimit } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const key = `auth:${ip}`;
  if (!rateLimit(key, 5, 60000)) {
    return NextResponse.json({ error: 'Слишком много запросов' }, { status: 429 });
  }
  // ... rest
}
```

---

## T4: M3 — Очистить git от db.json

```bash
cd /home/ivan/Рабочий стол/проекты/цфр/cfr-site
git rm --cached db.json _db.json
git status --short
```

Проверить что файлы НЕ закоммичены:
```bash
git ls-files db.json _db.json
# должно быть пусто
```

---

## T5: M4 — Пересобрать package-lock.json

```bash
cd /home/ivan/Рабочий стол/проекты/цфр/cfr-site
npm install --package-lock-only
```

---

## T6: W1 — CORS-заголовки

### Создать: `src/middleware.ts`

```ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  
  // CORS headers
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Cache control for API
  if (request.nextUrl.pathname.startsWith('/api/')) {
    response.headers.set('Cache-Control', 'no-store, max-age=0');
  }
  
  return response;
}

export const config = {
  matcher: '/api/:path*',
};
```

---

## T7: W2 — Проверка Content-Type

Для каждого POST route добавить проверку:

```ts
const contentType = req.headers.get('content-type');
if (!contentType?.includes('application/json') && !contentType?.includes('multipart/form-data')) {
  return NextResponse.json({ error: 'Неверный Content-Type' }, { status: 415 });
}
```

Применить ко всем POST маршрутам в `src/app/api/admin/`.

---

## T8: W3 — Защита yandex-disk маршрутов

### Файлы:
- `src/app/api/admin/yandex-disk/check-folder/route.ts`
- `src/app/api/admin/yandex-disk/sync/route.ts`

Оба используют token из заголовка. Нужно добавить проверку на пустой токен:

```ts
const authHeader = request.headers.get('Authorization');
if (!authHeader || !authHeader.startsWith('OAuth ')) {
  return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 });
}
const token = authHeader.replace('OAuth ', '').trim();
if (!token || token.length < 10) {
  return NextResponse.json({ error: 'Невалидный токен' }, { status: 401 });
}
```

---

## T9: W4 — Оптимизация next.config.js

### Файл: `next.config.js`

Заменить содержимое на:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
    formats: ['image/avif', 'image/webp'],
  },
  webpack: (config) => {
    config.optimization = {
      ...config.optimization,
      minimize: true,
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          default: false,
          vendors: false,
          commons: {
            name: 'commons',
            chunks: 'all',
            minChunks: 2,
          },
        },
      },
    };
    return config;
  },
};

module.exports = nextConfig;
```

---

## T10: W5 — Favicon из logo.png

### Команда:
```bash
cd /home/ivan/Рабочий стол/проекты/цфр/cfr-site/public
convert logo.png -resize 32x32 favicon.ico
```

Если `convert` не установлен:
```bash
apt-get install -y imagemagick
convert logo.png -resize 32x32 favicon.ico
```

Или Python:
```bash
python3 -c "
from PIL import Image
img = Image.open('logo.png')
img = img.resize((32, 32))
img.save('favicon.ico', format='ICO')
"
```

### Проверить что favicon используется в layout.tsx:
```tsx
// src/app/layout.tsx — проверить наличие:
<Head>
  <link rel="icon" href="/favicon.ico" />
</Head>
```

Если нет — добавить.

---

## Порядок выполнения
1. T1 (C1 — middleware авторизации) — самый объёмный
2. T2 (C2 — лимит загрузки)
3. T3 (M2 — rate limiting)
4. T4 (M3 — git cleanup)
5. T5 (M4 — npm install)
6. T6 (W1 — middleware CORS)
7. T7 (W2 — content-type)
8. T8 (W3 — yandex-disk)
9. T9 (W4 — next.config.js)
10. T10 (W5 — favicon)

После всех исправлений:
```bash
npm run build
```

---

## Чек-лист после выполнения
- [ ] Все 20 админ-маршрутов возвращают 401 без AUTH
- [ ] Загрузка файлов > 10MB возвращает 413
- [ ] Auth-маршрут ограничен 5 запросами/мин
- [ ] db.json НЕ в git-индексе
- [ ] package-lock.json пересобран
- [ ] CORS-заголовки в ответах API
- [ ] POST без правильного Content-Type → 415
- [ ] Yandex-disk маршруты проверяют токен
- [ ] next.config.js оптимизирован
- [ ] favicon.ico существует и используется
- [ ] npm run build проходит без ошибок
