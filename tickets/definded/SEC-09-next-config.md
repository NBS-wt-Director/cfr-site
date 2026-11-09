# SEC-09: Оптимизация next.config.js (W4)

> Источник: TICKET-SECURITY-FIXES.md (T9/W4)
> Создан: 2026-11-07
> Статус: НЕ ВЫПОЛНЕНО

## Проблема
`next.config.js` не оптимизирован для продакшена: нет `poweredByHeader: false`, нет splitChunks, нет compression.

## Решение
Обновить `next.config.js`:
- `poweredByHeader: false`
- `compress: true`
- `images.formats: ['avif', 'webp']`
- `config.optimization.splitChunks`
- `config.optimization.minimize: true`

## Критерий готовности
- `npm run build` проходит
- Сборка оптимизирована (minimize, splitChunks)
