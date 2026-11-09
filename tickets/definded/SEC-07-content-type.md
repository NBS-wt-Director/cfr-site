# SEC-07: Проверка Content-Type (W2)

> Источник: TICKET-SECURITY-FIXES.md (T7/W2)
> Создан: 2026-11-07
> Статус: НЕ ВЫПОЛНЕНО

## Проблема
POST-маршруты не проверяют Content-Type.

## Решение
Для каждого POST route в `src/app/api/admin/`:
```ts
const contentType = req.headers.get('content-type');
if (!contentType?.includes('application/json') && !contentType?.includes('multipart/form-data')) {
  return NextResponse.json({ error: 'Неверный Content-Type' }, { status: 415 });
}
```

## Критерий готовности
- POST без application/json или multipart/form-data → 415
