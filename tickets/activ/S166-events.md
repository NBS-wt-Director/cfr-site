# S166 — Мероприятия (events)

> **Статус:** 🟢 Код готов (2026-11-12), локальная приёмка пройдена. Ждёт деплоя на прод.
> Поставлен 2026-11-12.

## Постановка (слова пользователя)

> «добавь раздел Мероприятия в ДАННЫЕ админки — список, создание, редактирование,
> фотогалерея, видео, как у программ но с датами и типами мероприятий»

## Что реализовано

### Модель данных (`db.json`)

1. **`data.events[]`** — новый раздел в `db.data`
   - `id` (timestamp), `name`, `type` (семинар/открытое_мероприятие/тренировка/соревнование/праздник/консультация)
   - `dateStart`, `dateEnd` (ISO), `image` (обложка), `shortDescription`, `description` (md)
   - `reviews[]`, `photoAlbum[]` (до 15 фото, поля как у слайдера), `videos[]` (до 15, url/title)
   - `hidden`, `newsId` (ссылка на авто-новость)
2. **`seed-events.mjs`** — предзаполнение: 2 будущих (12.06, 12.20) + 2 прошедших (с photoAlbum+videos)

### Экспорт (`scripts/export-static.mjs`)

1. **`events.js`** — экспорт всех событий (photoAlbum через `exportAlbumSlides`, videos)
2. **`navEvents`** — навигация в `core.js` (если events в sections)
3. **`sitemap.xml`** — `<url>` для events.html и каждого event.html
4. **`sections`** — events в секциях с `id:'events'`

### Сайт (клиент)

1. **`events.html`** — список мероприятий: слайдер (будущие) + плитка (все), видео-превью
2. **`event.html`** — страница события: обложка, описание, фотогалерея (SliderCore), видео-плеер
3. **`events.js`** — рендер плитки (`eventTile`), слайдера (`eventSlider`), видео-плеера
   - YouTube/VK/Rutube/файл (mp4/webm) — разные режимы проигрывания
   - Статус-чип: «Скоро» / «Прошло»
   - Кнопка «Записаться» → форма заявки (название события в теме)
4. **CSS**: `.event-tile`, `.event-status-chip`, `.event-videos` (grid auto-fit),
   `.event-video-frame` (16:9 рамка), `.event-gallery`, `.event-gallery-item`
5. **Меню**: events в `footerLinks` + мобильном меню

### Админка (`admin.html`)

1. **Раздел «Мероприятия»** в сайдбаре (группа «📦 Данные», после «Программы»)
2. **Список мероприятий**: название, дата, тип, обложка, статус, скрыто, фото/видео счётчики
3. **Редактор (модалка)**: все поля (имя, тип, даты, обложка, описание, отзывы, photoAlbum, videos, скрыто)
4. **Загрузка видео**: drag&drop, до 15, превью, удаление
5. **Кнопка «🌱 Заполнить примерами»** (seed-events)
6. **`saveEventForm`**: авто-создание/удаление новости при переходе через дату
7. **`renderEventsSection`**: dispatch, фильтры, пагинация, поиск

### Сервер (`admin-server.mjs`)

1. **`GET /api/admin/get-events`** — список + статистика + пагинация
2. **`POST /api/admin/save-event`** — создание/обновление события
3. **`POST /api/admin/delete-event`** — удаление + чистка auto-news
4. **`handleSeedEvents`** — предзаполнение (пропускает, если уже есть)
5. **`auto-news`**: при сохранении события с `dateStart > now` → создаёт новость;
   при переходе `dateStart < now` → скрывает новость, сохраняет медиа в событие

### Статус сервера (`admin-server.mjs` — site-status)

1. **Авто-новости**: счётчик, список newsId → eventId
2. **Фото-ссылки**: broken links в events[].photoAlbum[].image
3. **Прошедшие события**: медиа (photoAlbum/videos) доступны только в событии, скрыты из новостей

## Критерий готовности

- [x] Модель `data.events[]` в `db.json`
- [x] `seed-events.mjs` — 4 события (2 будущих + 2 прошедших)
- [x] `export-static.mjs` — events.js + navEvents + sitemap + sections
- [x] `events.html` + `event.html` — рендер плитки, слайдера, галереи, видео-плеера
- [x] `events.js` — eventTile, eventSlider, galleryBlock, videoBlock
- [x] CSS — event-tile, status-chip, videos grid, gallery
- [x] Админка — раздел «Мероприятия» в «Данные»
- [x] Модалка редактора — все поля (включая photoAlbum + videos)
- [x] Сервер — get/save/delete events, seed
- [x] Auto-news: создание/скрытие по дате
- [x] Site-status: авто-новости, фото-ссылки, прошедшие события
- [x] Бамп ?v=46
- [x] Тесты в `test-static.mjs` (блок S166)
- [ ] Боевая приёмка на проде (после деплоя)

## ЖУРНАЛ

- 2026-11-12: задача поставлена пользователем
- 2026-11-12: модель данных events[], seed-events.mjs, export-static (events.js, navEvents, sitemap)
- 2026-11-12: сайт — events.html/event.html, events.js (плитка/слайдер/галерея/видео), CSS
- 2026-11-12: админка — раздел «Мероприятия», модалка, seed, auto-news
- 2026-11-12: сервер — get/save/delete events, seed-events, auto-news, site-status
- 2026-11-12: тесты: блок S166 в `test-static.mjs`, `node --check` ✅
- 2026-11-12: коммит `83efffc` (S166+S167 вместе)
