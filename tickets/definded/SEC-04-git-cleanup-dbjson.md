# SEC-04: Очистить git от db.json (M3)

> Источник: TICKET-SECURITY-FIXES.md (T4/M3)
> Создан: 2026-11-07
> Статус: НЕ ВЫПОЛНЕНО

## Проблема
`db.json` находится в git-индексе (`git ls-files db.json` → `db.json`). Данные сайта в репозитории.

## Решение
```bash
cd /home/ivan/Рабочий стол/проекты/цфр/cfr-site
git rm --cached db.json _db.json
git status --short
```

Проверить:
```bash
git ls-files db.json _db.json
# должно быть пусто
```

## Критерий готовности
- db.json НЕ в git-индексе
