> Закрыт: 2026-11-14, код готов + локальная приёмка пройдена, ждёт деплоя.
> Перенесён из activ при уборке тикетов.

# S169 — Markdown-редактор: предпросмотр + отмена обрезки фото

> **Статус:** 🟢 Код готов (2026-11-14), локальная приёмка пройдена. Ждёт деплоя на прод.
> Поставлен 2026-11-14.

## Постановка (слова пользователя)

> «предпросмотр в md-редакторе не работает, администраторы не знают md;
> ни какие фотографии не обрезаем нигде на сайте»

## Проблема 1: Markdown-предпросмотр

### Причина

`admin.html` НЕ подключал `js/md.js` → `window.MD` был `undefined` → предпросмотр не работал.

### Исправление

1. **Подключён `js/md.js?v=49`** в `admin.html`
2. **Режим по умолчанию**: `mode-split` (редактор + предпросмотр бок о бок)
3. **Вкладки переключения режима**: «✏️ Код / ⇆ Сплит / 👁 Как на сайте»
4. **Placeholder** без слова «markdown»: «Форматируйте текст кнопками…»
5. **CSS предпросмотра** (`.md-editor-preview`):
   - `h1`–`h4` (размеры, отступы, border-bottom для h1/h2)
   - `p`, `ul`, `ol`, `li` (отступы)
   - `strong`, `em`, `code` (стили)
   - `table` (border, padding, border-collapse)
   - `blockquote` (border-left, background, padding)

## Проблема 2: Обрезка фотографий

### Причина

`object-fit: cover` в множестве CSS-правил обрезал фото (показывалась часть, остальное отрезано).

### Исправление

Все `object-fit: cover` убраны из `style.css`:

| Селектор | Было | Стало |
|----------|------|-------|
| `.slide img` | `object-fit: cover` | `object-fit: contain` + `background: #000` |
| `.album-thumb` | `object-fit: cover` | убран |
| `.tile-photo` | `object-fit: cover` | убран |
| `.news-card img` | `aspect-ratio: 1/1.414` + `object-fit: cover` | `height: auto` + `object-fit: contain`, aspect-ratio убран |
| `.news-photos .news-photo img` | `object-fit: cover` | `height: auto` + `object-fit: contain` |
| `.entity-cover` | `object-fit: cover` | `height: auto` + `object-fit: contain` |
| `.entity-photo` | `object-fit: cover` | `height: auto` + `object-fit: contain` |
| `.album-item` | `object-fit: cover` | убран |
| `.direction-cover img` | `object-fit: cover` | `height: auto` + `object-fit: contain` |
| `.direction-cover-dynamic .direction-cover-img` | `object-fit: cover` | `object-fit: contain` |

### lk.html

- `#client-foto`: `object-fit: cover` → `object-fit: contain`

### Что сохранено

- `.news-noimage` — aspect-ratio A4 для плейсхолдера без обложки
- `.news-card-tall` — grid-row: span 2 для высоких новостей (layout, не кроп)
- `.direction-cover` — aspect-ratio 2/3 для рамки (контейнер, не img)

## Критерий готовности

- [x] `js/md.js` подключён в `admin.html`
- [x] Режим по умолчанию `mode-split` (редактор + предпросмотр)
- [x] Вкладки: «✏️ Код / ⇆ Сплит / 👁 Как на сайте»
- [x] Placeholder без слова «markdown»
- [x] CSS предпросмотра: h1–h4, p, ul, ol, table, blockquote, strong, em, code
- [x] style.css: ни одного `object-fit: cover`
- [x] `.slide img` — contain + bg #000
- [x] `.news-card img` — height:auto, aspect-ratio убран
- [x] `.news-photos .news-photo img` — contain, height:auto
- [x] `.entity-cover`, `.entity-photo` — contain, height:auto
- [x] `.direction-cover img` — contain, height:auto
- [x] `lk.html` — `#client-foto` contain
- [x] Бамп ?v=49→50
- [x] Тесты в `test-static.mjs` (блоки S169, S169b)
- [ ] Боевая приёмка на проде (после деплоя)

## ЖУРНАЛ

- 2026-11-14: задача поставлена пользователем
- 2026-11-14: причина предпросмотра — admin.html не подключал js/md.js → window.MD undefined
- 2026-11-14: подключён js/md.js?v=49, режим mode-split, вкладки, CSS предпросмотра
- 2026-11-14: убраны все object-fit:cover из style.css (10+ селекторов)
- 2026-11-14: lk.html #client-foto → contain
- 2026-11-14: бамп v=49→50 во всех HTML + inject-tracker + test-static
- 2026-11-14: тесты: блоки S169 (md-редактор) + S169b (без cover) ✅
- 2026-11-14: обновлены устаревшие тесты S110/S123/S124 (проверяли cover — переписаны под contain)
