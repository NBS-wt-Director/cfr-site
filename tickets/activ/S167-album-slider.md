# S167 — Универсальный альбом-слайдер (все поля главного слайдера)

> **Статус:** 🟢 Код готов (2026-11-12), локальная приёмка пройдена. Ждёт деплоя на прод.
> Поставлен 2026-11-12.

## Постановка (слова пользователя)

> «альбомы должны использовать движок главного слайдера, все поля редактирования
> должны быть доступны для каждого слайда (title, description, position, overlay, и т.д.)»

## Что реализовано

### Сервер (`admin-server.mjs`)

1. **`sanitizeAlbumSlides(list)`** — нормализация album-слайдов (12 полей):
   - `image` (путь/URL), `caption` (до 120), `title` (до 80), `description` (до 300)
   - `link`, `linkTarget`, `interval`, `position` (9 позиций + миграция left→center-left)
   - `textColor`, `textSize`, `textMargin` (объект), `overlay` (объект {enabled, color, opacity})
   - `hidden` (флаг), срез 60 слайдов
2. **`handleGetEvents` / `handleSaveEvent`** — photoAlbum через `sanitizeAlbumSlides`

### Экспорт (`export-static.mjs`)

1. **`exportAlbumSlides(list)`** — экспорт всех полей (title, position, overlay и т.д.),
   скрытые (`hidden:true`) исключаются из выдачи
2. **`hasGallery`** — `exportAlbumSlides(p.photoAlbum).length > 0` для программ/тренеров/событий

### Клиент (`entity.js`)

1. **`albumSlides(album, fallback)`** — нормализация photoAlbum в слайды SliderCore,
   `hidden===true` пропускается, fallback — если album пуст
2. Все страницы (program.html, trainer.html, album.html, events.html) рендерят галерею через SliderCore

### События (`events.js`)

1. **`albumSliderOpts(album, fallback)`** — конфиг SliderCore для галереи события
2. **`galleryBlock(event)`** — SliderCore.render для photoAlbum
3. **`videoBlock(videos)`** — рендер видео (YouTube/VK/Rutube/файл)

### Админка (`admin.html`)

1. **Универсальный редактор слайдов** — единые функции для main/trainer/event:
   - `slideArr(key)` — получение массива слайдов по ключу раздела
   - `renderSlideRow(key, idx, slide, isHidden)` — строка редактора (миниатюра + все поля)
   - `slideField(key, idx, field, value)` — обновление поля
   - `slideToggleHidden(key, idx)` — переключение скрытия
   - `normalizeAlbumSlides(album)` — нормализация при загрузке
   - `renderAlbumSlideEditor(key, slides)` — полный блок редактора
   - `albumRecords(key)` — извлечение records для сохранения
   - `pmTarget {key, idx}` — менеджер фото привязан к конкретному слайду
   - `SLIDE_POSITIONS` — 9 позиций текста
   - `slideStates` — состояния для main/trainer/event
   - Drag-n-drop: `onSlideDragStart`, `onSlideDragOver`, `onSlideDrop`
2. **Тренер/программа** — редактор album на универсальном блоке (вместо старого)
3. **События** — `saveEventForm` → `albumRecords('event')` для photoAlbum
4. **Менеджер фото** — popup grid + поиск + фильтр + `pmTarget` вместо `pmSlideIdx`

### CSS

1. **`.slide img`** — `object-fit: contain` (вместо cover, S169b)
2. **`.album-thumb`**, **`.tile-photo`**, **`.entity-cover`**, **`.entity-photo`** — без cover

## Критерий готовности

- [x] `sanitizeAlbumSlides` — 12 полей, position миграция, overlay, textColor/textSize/textMargin, hidden
- [x] `exportAlbumSlides` — экспорт всех полей, скрытые исключены
- [x] `albumSlides` в entity.js — SliderCore для всех галерей
- [x] `albumSliderOpts` + `galleryBlock` в events.js — SliderCore для событий
- [x] Универсальный редактор слайдов в админке (slideArr, renderSlideRow, slideField, slideToggleHidden, normalizeAlbumSlides, renderAlbumSlideEditor, albumRecords, pmTarget, SLIDE_POSITIONS, slideStates, drag-n-drop)
- [x] Тренер/программа — редактор album на универсальном блоке
- [x] Событие — saveEventForm → albumRecords
- [x] Бамп ?v=47
- [x] Тесты в `test-static.mjs` (блок S167, ~35 проверок)
- [ ] Боевая приёмка на проде (после деплоя)

## ЖУРНАЛ

- 2026-11-12: задача поставлена пользователем
- 2026-11-12: сервер — sanitizeAlbumSlides, handleGet/SaveEvents
- 2026-11-12: экспорт — exportAlbumSlides (все поля, hidden исключены)
- 2026-11-12: клиент — albumSlides (entity.js), albumSliderOpts + galleryBlock (events.js)
- 2026-11-12: админка — универсальный редактор (slideArr, renderSlideRow, slideField, slideToggleHidden, normalizeAlbumSlides, renderAlbumSlideEditor, albumRecords, pmTarget, SLIDE_POSITIONS, slideStates, drag-n-drop)
- 2026-11-12: seed-events — поля photoAlbum (title, description, position, overlay)
- 2026-11-12: коммит `83efffc` (S166+S167 вместе)
- 2026-11-14: тесты S167 export overlay — окно regex расширено 800→1200
