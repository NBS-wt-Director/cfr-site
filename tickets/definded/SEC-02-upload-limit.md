# SEC-02: Лимит размера загрузки файлов (C2)

> Источник: TICKET-SECURITY-FIXES.md (T2/C2)
> Создан: 2026-11-07

## Проблема
`src/app/api/upload/route.ts` — нет проверки размера файла. Можно загрузить файл любого размера.

## Решение
```ts
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
if (file.size > MAX_FILE_SIZE) {
  return NextResponse.json({ error: 'Файл слишком большой (макс. 10MB)' }, { status: 413 });
}
```

## Критерий готовности
- Загрузка файлов > 10MB возвращает 413
