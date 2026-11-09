# SEC-03: Rate Limiting (M2)

> Источник: TICKET-SECURITY-FIXES.md (T3/M2)
> Создан: 2026-11-07
> Статус: НЕ ВЫПОЛНЕНО (чек-лист мультитикета был ложным)

## Проблема
Нет rate limiting. API уязвим к brute-force и DDoS.

## Решение
1. Создать `src/lib/rate-limit.ts`:
   - `rateLimit(key, maxRequests, windowMs)` — базовая функция
   - `adminRateLimit(ip)` — обёртка для админ-API (30/мин)
   - Автоочистка устаревших записей каждые 5 минут
2. Применить в `src/middleware.ts` (создать):
   - `/api/admin/*` — 30/мин/IP
   - `/api/lk/auth` — 5/мин/IP

## Критерий готовности
- Auth-маршрут ограничен 5 запросами/мин
- Rate limiting для админ-API (30/мин/IP) через middleware
