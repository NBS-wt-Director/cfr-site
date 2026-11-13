> Закрыт: 2026-11-14, код готов + локальная приёмка пройдена, ждёт деплоя.
> Перенесён из activ при уборке тикетов.

# S170 — Менеджер видео в «Данных сайта»

> **Статус:** 🟢 Код готов (2026-11-14), локальная приёмка пройдена. Ждёт деплоя на прод.
> Поставлен 2026-11-14.

## Постановка (слова пользователя)

> «в мегараздел "данные сайты" добавь раздел "менеджер видео" устроеный по аналогии
> по менеджера фото»

## Что реализовано

### Сервер (`scripts/admin-server.mjs`)

1. **`VIDEO_EXTS_RE`** — `/\.(mp4|webm|mov|m4v|ogv)$/i`
2. **`walkUploads(dir, relBase, out, re = PHOTO_EXTS_RE)`** — 4-й аргумент regex,
   обратная совместимость (по умолчанию фото)
3. **`collectVideoUsage(db)`** — обход `news.video` + `events[].videos[].url`,
   только локальные `uploads/` пути → `Map<relPath, usages[]>`
4. **`GET /api/admin/get-video-manager`** — полный обзор:
   - список видео с `status` (used/hidden/unused), `usages[]`, `bytes`, `mtime`
   - фильтры: `all`/`used`/`hidden`/`unused`, поиск `q` по пути
   - пагинация (`per_page: 48`), статистика (`files/used/hidden/unused/bytes_*/missing/missing_list`)
5. **`removeVideoRefs(db, urls)`** — чистка ссылок: `news.video = ''` + `events[].videos = videos.filter(v => !urls.has(v.url))`
6. **`POST /api/admin/delete-videos`** — удаление в корзину (`trash/uploads/<ts>`):
   - защита `used` (без `force` не удаляются)
   - `backupDB()` перед удалением
   - `regenerateStatic()` после
7. **Роуты**: `POST /api/admin/get-video-manager`, `POST /api/admin/delete-videos` (после delete-photos)

### Админка (`static/admin.html`)

1. **Раздел «🎬 Менеджер видео»** в сайдбаре (группа «📦 Данные», после «Мероприятия»)
2. **Карточка-статистика**: всего видео / используются / скрыты / не используются / занято на диске / освободится / битые ссылки
3. **Список видео**: превью (`<video src=…#t=1 preload=metadata muted>` 96×64), путь, размер, дата, статус
4. **Метки статуса**: «используется» (клик → переход на страницу), «скрыт», «не используется»
5. **Кнопка «Удалить»** — для скрытых/неиспользуемых
6. **Кнопка «🧹 Удалить неиспользуемые»** — сбор unused → подтверждение → чанки по 200
7. **Кнопка «🔄 Обновить данные»** — перезагрузка с сервера
8. **Фильтры**: все / используется / скрыт / не используется
9. **Поиск** по пути файла
10. **Пагинация**: назад/вперёд, per_page=48
11. **Пояснение**: «YouTube/VK/Rutube-видео (ссылки) не являются файлами и не удаляются»

### Клиент-функции (`static/admin.html`)

- `loadVideoManagerSection()` — загрузка раздела
- `vidFetch(filter, q, page)` — запрос к серверу
- `vidReload()` — обновление данных
- `vidStatusCell(v)` — ячейка статуса с меткой
- `vidRender(d)` — рендер карточки + списка + пагинации
- `vidSetFilter(f)` / `vidSetQuery(q)` / `vidSetPage(p)` — фильтры/поиск/пагинация
- `vidDeleteOne(url)` — удаление одного видео
- `vidCollectUnused()` — сбор всех unused (все страницы)
- `vidDeleteUnused()` — удаление неиспользуемых чанками по 200

## Критерий готовности

- [x] `VIDEO_EXTS_RE` (mp4|webm|mov|m4v|ogv)
- [x] `walkUploads` — 4-й аргумент regex, обратная совместимость
- [x] `collectVideoUsage` — news.video + events.videos (только uploads/)
- [x] `get-video-manager` — список + статистика + фильтры + поиск + пагинация
- [x] `delete-videos` — корзина, защита used, backupDB, regenerateStatic
- [x] `removeVideoRefs` — чистка news.video + events.videos
- [x] Раздел «🎬 Менеджер видео» в сайдбаре
- [x] Статистика: всего/используется/скрыто/не используется/занято/освободится/битые
- [x] Превью видео (`<video>` с #t=1, 96×64)
- [x] Метки статуса + кнопки удаления
- [x] Кнопка «Удалить неиспользуемые» (чанки 200)
- [x] Кнопка «Обновить данные»
- [x] Фильтры + поиск + пагинация
- [x] Бамп ?v=50
- [x] Тесты в `test-static.mjs` (блок S170, ~18 проверок)
- [ ] Боевая приёмка на проде (после деплоя)

## ЖУРНАЛ

- 2026-11-14: задача поставлена пользователем
- 2026-11-14: сервер — VIDEO_EXTS_RE, walkUploads(regex), collectVideoUsage, handleGetVideoManager, removeVideoRefs, handleDeleteVideos, роуты
- 2026-11-14: клиент — vid{filter,q,page,per:48}, loadVideoManagerSection, vidFetch, vidRender, vidStatusCell, vidSetFilter, vidSetQuery, vidSetPage, vidDeleteOne, vidCollectUnused, vidDeleteUnused
- 2026-11-14: бамп v=49→50
- 2026-11-14: тесты: блок S170 в `test-static.mjs` ✅
- 2026-11-14: curl get-video-manager — API работает, пустой список (нет видео в dev uploads) ✅
