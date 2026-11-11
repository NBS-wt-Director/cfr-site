# S157 — Меню чипа расписания на program.html и trainer.html

> **Статус:** ✅ Реализовано (2026-11-10), закоммичено, задеплоено. Поставлен 2026-11-10.

## Постановка

> «В programm не работает меню плитки»

## ФАКТЫ

### Корневая причина

На `program.html` слоты рендерились из `p.scheduleStructured` (без `programId`/`programSlug`).
В `schedule-ui.js` `weekBoard(slots, selfProgram)` при отсутствии `selfProgram` и `programSlug`
в слоте рендерил чип как `<a class="week-chip" href="#">` — **без `.chip-menu`**.

Страница тренера (`trainer.html`): `trainerSlots()` собирала слоты из `p.scheduleStructured`,
но не включала `p.slug` и `p.photoAlbum` → кнопка «Посмотреть» не появлялась.

## РЕШЕНИЕ

1. **`entity.js` `scheduleView`** — принимает `selfProgram` как 4-й аргумент, прокидывает в
   `boardOrTable()` и `weekBoard()`.
2. **`entity.js` `scheduleBlock`** — принимает `selfProgram` как 3-й аргумент.
3. **`entity.js` `programBody`** — передаёт `{ id: p.id, slug: p.slug, hasAlbum: !!(p.photoAlbum && p.photoAlbum.length) }`
   в `scheduleBlock()`.
4. **`entity.js` `trainerSlots`** — добавлены `programSlug: p.slug` и `programHasAlbum: !!(p.photoAlbum && p.photoAlbum.length)`.
5. **`schedule-ui.js`** — `boardOrTable()` уже принимает `selfProgram`, `weekBoard()` уже обрабатывает его (без изменений).

## Критерий готовности

- [x] `program.html` — чипы это `<button>`, у каждого есть `.chip-menu` с кнопками «Подробнее» / «Посмотреть» / «Записаться»
- [x] `trainer.html` — чипы это `<button>`, «Подробнее» ведёт на программу (slug), «Посмотреть» появляется при альбоме
- [x] Клик по чипу открывает меню, переносит в `body` (не обрезается `overflow`)
- [x] «Записаться» вызывает `openCallModal(причина)`
- [x] Регрессия: `index.html` — меню на всех чипах (58/58)
- [x] `test-static.mjs` зелёные (14 тестов S157)
- [x] Бамп кэша `?v=44`

## Изменения файлов

- `static/js/entity.js` — `scheduleView`, `scheduleBlock`, `programBody`, `trainerSlots`
- `static/test-static.mjs` — 14 тестов S157
- `static/*.html` (13 файлов) — `?v=44`

## Коммит

`70f3dc3 S157: меню чипа расписания на program.html и trainer.html`

## Деплой

```bash
cd /home/cfr_balloo/sites/cfrsite
git checkout -- static/js/data/ static/sitemap.xml
git pull origin main
npm run static:export
pm2 restart cfrsite --update-env
```
