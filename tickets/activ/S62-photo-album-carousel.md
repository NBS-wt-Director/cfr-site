# S62 — Фотоальбом программы/тренера: карусель из необрезанных фото

> **Статус:** ⚠️ Спорный — закрытие не подтверждено ЖУРНАЛОМ


## Цель

На страницах программы и тренера блок «Фотоальбом» — **горизонтальная карусель**, в которой каждое фото показано **целиком** (без crop/обрезки).

## Проблема сейчас

`entity.js` → `albumHtml()` рендерит `.album-grid` (CSS-grid с `minmax(200px, 1fr)`), а `.album-item img` имеет `height: 150px; object-fit: cover` → фото **обрезаются** сверху/снизу или по бокам, и это сетка, а не карусель.

## Решение

1. **Новый модуль `static/js/carousel.js`** (`window.Carousel`):
   - `Carousel.render(items, altBase)` → HTML карусели
   - Разметка: `.entity-carousel` > `.carousel-track` (flex, `overflow-x: auto`, `scroll-snap-type: x mandatory`) > `.carousel-item` (`scroll-snap-align: center`) > `img` + подпись
   - Кнопки ‹ › (`.carousel-prev` / `.carousel-next`) — прокрутка на ширину видимой области
   - Счётчик `.carousel-counter` в формате `3 / 8` — обновляется при прокрутке
   - `img`: `max-height: 420px; width: auto; object-fit: contain` — **без обрезки**, натуральный aspect ratio
   - Клик по фото → `window.openLightbox(src, alt)` (lightbox уже показывает фото целиком)
   - Свайп работает «из коробки» через нативный скролл + scroll-snap
   - Деградация без JS: если модуль не загружен — сетка `.album-grid` (старое поведение)
2. **`entity.js`**: `albumHtml()` вызывает `window.Carousel.render(...)`, обёртка `.entity-album`; `<h2>Фотоальбом</h2>` остаётся
3. **CSS**: блок `.entity-carousel`/`.carousel-*` в `style.css`; скрытие кнопок, когда фото одно; `scrollbar-width: none` + `::-webkit-scrollbar { display: none }` (стрелки вместо полосы); мобильный `max-height: 280px`
4. **Не трогать `album.html`** — там остаётся сетка `.album-grid-page` (это отдельная страница-сетка, не фотоальбом сущности)
5. **`program.html` и `trainer.html`** — подключить `js/carousel.js`
6. **Тесты `test-static.mjs`**: на странице сущности с `photoAlbum` есть `.entity-carousel`, `.carousel-track`, `img` с `object-fit: contain` в CSS, **нет** `.album-grid` внутри блока «Фотоальбом», карусель подключена на обеих страницах

## Критерий готовности

- «Фотоальбом» — горизонтальная карусель, фото целиком (не обрезаны)
- Прокрутка кнопками ‹ ›, свайпом, snap по центру; счётчик «N / M»
- Клик по фото открывает lightbox на весь экран
- Страница «Альбом» (`album.html`) не сломана — осталась сеткой
- Тесты зелёные, `?v=` bumped
