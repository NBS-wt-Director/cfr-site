> Закрыт: 2026-11-14, код готов + локальная приёмка пройдена, ждёт деплоя.
> Перенесён из activ при уборке тикетов.

# S159 — Все альбомы сайта (кроме новостей) наследуют логику и рендеринг слайдера

> **Статус:** 🟢 Код готов (2026-11-12), локальная приёмка пройдена. Ждёт деплоя на прод.
> Поставлен 2026-11-11.

## Постановка (слова пользователя)

> «Давай все альбомы на сайте кроме новостей будут наследовать логику и рендеринг слайдеров.»

## Область

| Где фото-альбом | Было | Стало |
|-----------------|------|-------|
| `program.html` — «Фотоальбом» | `js/carousel.js` (своя карусель S62) | общий движок `js/slider-core.js` |
| `trainer.html` — «Фотоальбом» | `js/carousel.js` | `js/slider-core.js` |
| `album.html` — совместные фото | сетка миниатюр + lightbox | слайдер + лента миниатюр-навигации |
| `trainers.html` — слайдер совместных фото | своя логика в inline-скрипте | `js/slider-core.js` |
| `news.html` — галерея новости | сетка + lightbox | **БЕЗ ИЗМЕНЕНИЙ** (по условию тикета) |
| `directions.html` — ротатор обложек направлений | свой ротатор | **БЕЗ ИЗМЕНЕНИЙ** (это не альбом) |

## Что сделано

1. **`static/js/slider-core.js` (новый)** — единый движок слайдера. API:
   `render(items, opts)` / `renderInner` / `wire(el, opts)` / `initAll(root, opts)` / `mount(el, items, opts)`.
   Возможности: overlay, 9 позиций текста, inline-стили (цвет/размер/отступы), `data-interval`
   на слайде, ленивая загрузка (`data-src`, авто при >12 фото), счётчик `slider-counter`
   вместо точек при >12 слайдах, `onClick` (для lightbox), `autoplay:false`, пауза на hover,
   идемпотентный `wire` (флаг `data-slider-ready`).
2. **`main.js`** — `renderSlider()` сведён к `SliderCore.mount()`; локальные `showSlide`/`resetTimer`
   удалены; `window.nextSlide/prevSlide/goToSlide` — тонкие прокси (совместимость разметки главной).
3. **`entity.js`** — `albumHtml()` рендерит альбом через `SliderCore.render()` (фолбэки:
   `Carousel` → сетка), `albumSliderOpts()` берёт `sliderSettings.albumInterval`,
   `SliderCore.initAll()` + `onClick → openLightbox`.
4. **`album.html`** — `#album-slider` (слайдер) + `#album-thumbs` (миниатюры-навигация, клик листает).
5. **`trainers.html`** — `#joint-slider` на общем движке.
6. **`style.css`** — модификаторы `.slider--embed`, `.slider--album`, `.slider--joint`,
   `.slider-clickable`, `.slider-counter`, `.album-slider`, `.album-thumbs`, `.album-thumb`.
7. **`export-static.mjs` + `admin-server.mjs`** — в `sliderSettings` добавлено поле `albumInterval`
   (1–120, по умолчанию 6): санитайза на сервере, экспорт в `core.js`, применение в `entity.js`/`album.html`.
8. **Подключение** `js/slider-core.js` в index/program/trainer/album/trainers.
9. **Тесты** — блок S159 в `test-static.mjs` (движок, entity, album, trainers, CSS, экспорт,
   сервер, админ-раздел S160); тесты S62 переписаны под новый рендер (было: карусель → стало: слайдер).
10. **Бамп кэша** `?v=46 → ?v=47` во всех HTML и в тестах.

## Критерий готовности

- [x] Единый движок `js/slider-core.js` подключён на всех страницах с альбомами
- [x] program/trainer: альбом = слайдер (слайды = фото, точки, стрелки, overlay, ready-флаг)
- [x] album.html: слайдер + миниатюры-навигация + lightbox по клику
- [x] trainers.html: совместный слайдер на общем движке
- [x] news.html и directions.html не затронуты
- [x] `npm run static:export` зелёный, тесты зелёные (кроме 2 преждественных S32/S28)
- [ ] Боевая приёмка на проде (после деплоя)

## ЖУРНАЛ

- 2026-11-11: создан `js/slider-core.js`; main.js/entity.js/album.html/trainers.html переведены на движок;
  `albumInterval` добавлен в санитайзу сервера и экспорт `sliderSettings`
- 2026-11-12: `node --check` всех JS ✅; `npm run static:export` ✅;
  jsdom-прогон: program.html (4 слайда + overlay + ready), trainer.html (4 слайда),
  album.html/trainers.html (данные пустые на локальной базе — контейнеры и wire живы) ✅
- 2026-11-12: блок тестов S159 добавлен, тесты S62 переведены на слайдер-разметку;
  `node scripts/test-static.mjs` → **861/863** (те же 2 преждественных: S32 чипы, S28 обложки)
- 2026-11-12: бамп кэша `?v=47` во всех HTML + тестах
