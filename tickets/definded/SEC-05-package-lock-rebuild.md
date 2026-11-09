# SEC-05: Пересобрать package-lock.json (M4)

> Источник: TICKET-SECURITY-FIXES.md (T5/M4)
> Создан: 2026-11-07
> Статус: НЕ ВЫПОЛНЕНО

## Решение
```bash
cd /home/ivan/Рабочий стол/проекты/цфр/cfr-site
npm install --package-lock-only
```

## Критерий готовности
- `npm run build` проходит без ошибок
- package-lock.json актуален
