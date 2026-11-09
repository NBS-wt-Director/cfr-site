# SEC-08: Защита yandex-disk маршрутов (W3)

> Источник: TICKET-SECURITY-FIXES.md (T8/W3)
> Создан: 2026-11-07
> Статус: НЕ ВЫПОЛНЕНО

## Проблема
`src/app/api/admin/yandex-disk/check-folder/route.ts` и `src/app/api/admin/yandex-disk/sync/route.ts` используют OAuth-токен без проверки на пустое значение.

## Решение
Добавить проверку:
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

## Критерий готовности
- Оба маршрута проверяют токен (OAuth prefix + length >= 10)
