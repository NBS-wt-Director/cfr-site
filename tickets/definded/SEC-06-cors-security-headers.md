# SEC-06: CORS + Security Headers (W1)

> Источник: TICKET-SECURITY-FIXES.md (T6/W1)
> Создан: 2026-11-07
> Статус: НЕ ВЫПОЛНЕНО (файл src/middleware.ts отсутствует)

## Проблема
Нет CORS-заголовков, security-хедеров, cache-control на API.

## Решение
Создать `src/middleware.ts`:
```ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  if (request.nextUrl.pathname.startsWith('/api/')) {
    response.headers.set('Cache-Control', 'no-store, max-age=0');
  }
  
  return response;
}

export const config = {
  matcher: '/api/:path*',
};
```

## Критерий готовности
- CORS-заголовки в ответах API
- Security headers (nosniff, DENY, XSS)
- Cache-Control на /api/*
