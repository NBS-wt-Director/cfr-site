interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimits = new Map<string, RateLimitEntry>();

/**
 * Базовая функция rate limiting.
 * @param key       — уникальный ключ (например `lk_auth:127.0.0.1`)
 * @param maxRequests — максимум запросов в окне
 * @param windowMs  — размер окна в миллисекундах
 * @returns true — запрос разрешён, false — лимит превышён
 */
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

/**
 * Удобная обёртка для админ-API: 30 запросов / минуту на IP.
 * Возвращает null (ОК) или Response с 429 (лимит превышён).
 */
export function adminRateLimit(ip: string): null | { status: number; body: { error: string } } {
  const key = `admin:${ip}`;
  if (!rateLimit(key, 30, 60000)) {
    return { status: 429, body: { error: 'Слишком много запросов' } };
  }
  return null;
}

/**
 * Периодическая очистка устаревших записей (раз в 5 минут).
 * Защита от утечки памяти при большом количестве уникальных IP.
 */
let lastCleanup = Date.now();
const CLEANUP_INTERVAL = 5 * 60 * 1000;

function cleanupIfNeeded(): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, entry] of rateLimits) {
    if (now > entry.resetTime) {
      rateLimits.delete(key);
    }
  }
}

// Экспортируем обёртку с автозаменой
export function rateLimitWithCleanup(key: string, maxRequests: number, windowMs: number): boolean {
  cleanupIfNeeded();
  return rateLimit(key, maxRequests, windowMs);
}
