import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Простой in-memory rate limiter для middleware (edge-compatible)
interface RateLimitEntry {
  count: number;
  resetTime: number;
}
const rateLimits = new Map<string, RateLimitEntry>();

function isRateLimited(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimits.get(key);

  if (!entry || now > entry.resetTime) {
    rateLimits.set(key, { count: 1, resetTime: now + windowMs });
    return false;
  }

  if (entry.count >= maxRequests) {
    return true;
  }

  entry.count++;
  return false;
}

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // --- Rate limiting для критичных маршрутов ---
  const path = request.nextUrl.pathname;

  // Админ-API: 30 запросов/мин на IP
  if (path.startsWith('/api/admin/')) {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || 'unknown';
    const key = `admin:${ip}:${path}`;
    if (isRateLimited(key, 30, 60000)) {
      return NextResponse.json(
        { error: 'Слишком много запросов. Попробуйте позже' },
        { status: 429 }
      );
    }
  }

  // Авторизация ЛК: 5 запросов/мин на IP (дополнительная защита к rate-limit в route)
  if (path === '/api/lk/auth') {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || 'unknown';
    const key = `lk_auth:${ip}`;
    if (isRateLimited(key, 5, 60000)) {
      return NextResponse.json(
        { error: 'Слишком много запросов. Попробуйте позже' },
        { status: 429 }
      );
    }
  }

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
