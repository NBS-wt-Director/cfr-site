# SEC-01: Авторизация ВСЕХ админ-маршрутов (C1)

> Источник: TICKET-SECURITY-FIXES.md (T1/C1)
> Создан: 2026-11-07

## Проблема
Только 2 из ~20 админ-маршрутов защищены `ADMIN_API_KEY`. Остальные открыты.

## Решение
1. Создать `src/lib/auth.ts` с `authenticateAdmin()` (Basic auth на основе `ADMIN_API_KEY`)
2. Применить ко всем маршрутам в `src/app/api/admin/`:
   - `admin/db-mode/route.ts` — GET/POST
   - `admin/db/route.ts` — GET/POST (критично! экспорт/импорт БД)
   - `admin/files/route.ts` — все
   - `admin/footer/route.ts` — все
   - `admin/lk/import-excel/route.ts` — POST
   - `admin/lk/payments/route.ts` — все
   - `admin/lk/users/route.ts` — GET/POST/DELETE
   - `admin/lk/visits/route.ts` — все
   - `admin/migrate-db/route.ts` — GET/POST (критично!)
   - `admin/news/[id]/route.ts` — все
   - `admin/pages/route.ts` — все
   - `admin/save-prices/route.ts` — POST
   - `admin/save-schedule/route.ts` — все
   - `admin/stats/export/route.ts` — GET
   - `admin/stats/route.ts` — GET
   - `admin/trainers/[id]/route.ts` — все
   - `admin/yandex-disk/check-folder/route.ts` — GET
   - `admin/yandex-disk/sync/route.ts` — POST

## Pattern
```ts
import { authenticateAdmin } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const auth = authenticateAdmin(req);
  if (auth !== true) return auth;
  // ... rest of the code
}
```

## Критерий готовности
- Все ~20 админ-маршрутов возвращают 401 без AUTH
- `npm run build` проходит без ошибок
