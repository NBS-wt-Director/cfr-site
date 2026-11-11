# S158 — Полная переработка модуля слайдера главной страницы

> **Статус:** 🟢 Код готов (2026-11-10), локальная приёмка пройдена. Ждёт деплоя на прод.
> Поставлен 2026-11-10.

## Постановка (слова пользователя)

> «Слайдер-то на главной странице у нас обрезан оказался. Нет настроек размера/цвета/поля
> текста заголовка, нет настроек описания, нет самого описания, нет ссылки на страницу сайта,
> место текста — три позиции вместо 9, нельзя поменять местами слайды, нельзя индивидуально
> задать у каждого отдельно время. И всё это нужно у каждого слайда.
> Выбор фотографии — в отдельном всплывающем окне, где можно выбрать и закачать
> (зачаток отдельного модуля «менеджер фото»).»

---

## ФАКТЫ (проверены по коду 2026-11-10)

### Текущее состояние

**`db.json` → `sliders[]`** (5 активных + скрытые «СОВМЕСТНЫЕ ФОТО»):
```json
{
  "id": 1772180971691,               // timestamp
  "title": "Функциональный тренинг", // единственное текстовое поле
  "image": "/uploads/1772180971686-jq2xvbzjt.jpg",
  "interval": 5,                     // сек
  "position": "center",              // left | center | right
  "hidden": false                    // есть у слайдов «СОВМЕСТНЫЕ ФОТО»
}
```

**`db.json` → `sliderSettings`** (глобально, но нигде не применяется на сайте):
```json
{ "textPositionMode": "static", "staticPosition": "bottom-left", "marginX": 10, "marginY": 10 }
```

### ✅ Уже реализовано — НЕ ТРОГАТЬ, только расширять

| Функция | Где | Комментарий |
|---------|-----|-------------|
| Сортировка слайдов **drag&drop** | `admin.html` 2750–2773 (`onSliderDrop`) | работает, ⠿-ручка |
| **Индивидуальный интервал** у слайда | `admin.html` 2652–2655 + `main.js` 594–601 (`resetTimer`, S86) | работает и в админке, и на сайте |
| Скрыть/показать слайд | `admin.html` 2709–2712 (`toggleSliderHidden`) + фильтр в экспорте | 👁/🙈 |
| Позиция текста (**3 варианта**) | `admin.html` 2657–2663, CSS `.slider-text.pos-left/right` | расширить до 9 |
| Загрузка фото (inline `<input type=file>`) | `admin.html` 2665–2666, 2714–2725 (`uploadSliderImage`) | заменить на менеджер фото |
| API `get-slides` / `save-slides` | `admin-server.mjs` | расширить поля |
| Интервал по умолчанию | `admin.html` 2685–2688 | сохраняется в `save-slides` |

> ⚠️ Отдельного файла `js/slider.js` **нет** — рендер слайдера живёт в `main.js`
> (`renderSlider()`, строки 10–34 + навигация 564–601). `SliderManager` тоже не существует.

### ❌ Реальные пробелы (что делаеть)

| # | Проблема | Что добавить |
|---|----------|-------------|
| 1 | Нет **описания** слайда | поле `description` (textarea) + рендер |
| 2 | Нет **ссылки** на страницу сайта | поля `link` + `linkTarget` |
| 3 | Нет **цвета** текста | поле `textColor` (захардкожен `#fff` в CSS) |
| 4 | Нет **размера** заголовка | поле `textSize` (сейчас `clamp()` глобально) |
| 5 | Нет **отступов** текстового блока | поле `textMargin` (сейчас `padding: 2rem` в CSS) |
| 6 | Нет **наложения** настраиваемого | поле `overlay` (сейчас `rgba(0,0,0,0.3)` на тексте) |
| 7 | **3 позиции вместо 9** | 9 классов `.pos-*` |
| 8 | Нет **менеджера фото** | popup: сетка + поиск + фильтр used/unused + загрузка |
| 9 | Экспорт режет слайды | `export-static.mjs:599` — `.slice(0, 10)` |
| 10 | `sliderSettings` не читается сайтом | реализовать применение или убрать |


---

## ИТОГОВАЯ МОДЕЛЬ ДАННЫХ

> Конвенции сохранены: `id` остаётся timestamp (не UUID), видимость — `hidden`
> (уже фильтруется экспортёром и админкой), новые поля опциональны со значениями
> по умолчанию → старые записи в базе остаются валидны без миграции.

```json
{
  "sliders": [
    {
      "id": 1772180971691,
      "title": "Функциональный тренинг",
      "description": "Тренировка для суставов и позвоночника…",
      "image": "/uploads/1772180971686-jq2xvbzjt.jpg",
      "link": "program.html?id=Функциональный-тренинг",
      "linkTarget": "_self",
      "interval": 7,
      "position": "bottom-left",
      "textColor": "#ffffff",
      "textSize": 42,
      "textMargin": { "top": 20, "right": 20, "bottom": 20, "left": 20 },
      "overlay": { "enabled": true, "color": "#000000", "opacity": 0.4 },
      "hidden": false
    }
  ],
  "sliderSettings": { "defaultInterval": 5 }
}
```

### Поля — детальное описание

| Поле | Тип | По умолчанию | Новое? | Описание |
|------|-----|-------------|--------|----------|
| `id` | number | `Date.now()` | — | Идентификатор (timestamp) |
| `title` | string | `''` | — | Заголовок слайда |
| `description` | string | `''` | 🆕 | Описание под заголовком. `\n` → `<br>` |
| `image` | string | `''` | — | Путь к фото (`/uploads/...`) |
| `link` | string | `''` | 🆕 | Ссылка. Пуста → текст не кликабельный |
| `linkTarget` | `_self`\|`_blank` | `_self` | 🆕 | Куда открывается ссылка |
| `interval` | number | `5` | — | Время показа, сек (1–120) |
| `position` | string | `center` | 🔧 | Раскладка блока — **9 вариантов** |
| `textColor` | hex | `#ffffff` | 🆕 | Цвет заголовка и описания |
| `textSize` | number | `42` | 🆕 | Размер заголовка, px (16–96) |
| `textMargin` | object | `{20,20,20,20}` | 🆕 | Отступы блока от краёв, px |
| `overlay` | object | `{true,#000,0.4}` | 🆕 | Затемнение фото для читаемости |
| `hidden` | boolean | `false` | — | Слайд не попадает на сайт |

### 9 вариантов `position` (сетка 3×3)

```
top-left     │ top-center     │ top-right
center-left  │ center         │ center-right
bottom-left  │ bottom-center  │ bottom-right
```

Значения: `top-left`, `top-center`, `top-right`, `center-left`, `center`,
`center-right`, `bottom-left`, `bottom-center`, `bottom-right`.

**Обратная совместимость:** старые `left`/`right` → `center-left`/`center-right`
(миграция при загрузке в админке + фолбэк в CSS).


---

## АДМИН-ПАНЕЛЬ

### Структура раздела

```
┌─────────────────────────────────────────────────┐
│  🖼 Слайдеры главной страницы                    │
├─────────────────────────────────────────────────┤
│  Глобальные настройки:                          │
│  ☑ Автопрокрутка  ⏱ Скорость: 600мс            │
│  ☑ Клавиатура     ☑ Точки-навигация             │
│  ☑ Стрелки        ☑ Бесконечный цикл            │
├─────────────────────────────────────────────────┤
│  Предпросмотр:                                  │
│  [Миниатюра слайдера с реальными данными]       │
├─────────────────────────────────────────────────┤
│  Слайд 1 (5 с)  [▲] [▼] [✏️] [🗑]              │
│  Слайд 2 (7 с)  [▲] [▼] [✏️] [🗑]              │
│  Слайд 3 (5 с)  [▲] [▼] [✏️] [🗑]              │
├─────────────────────────────────────────────────┤
│  [+ Добавить слайд]                              │
└─────────────────────────────────────────────────┘
```

### Редактор слайда (модальное окно)

```
┌─────────────────────────────────────────────────┐
│  ✏️ Редактирование слайда                        │
├─────────────────────────────────────────────────┤
│  Фото:  [Выбрать из фотоархива]  [Загрузить]    │
│          [Миниатюра текущего фото]               │
├─────────────────────────────────────────────────┤
│  Заголовок: [_______________________________]    │
├─────────────────────────────────────────────────┤
│  Описание:                                      │
│  [____________________________________________]  │
│  [____________________________________________]  │
│  [____________________________________________]  │
├─────────────────────────────────────────────────┤
│  Ссылка: [_______________________________]       │
│  Целевая вкладка: [📄 Текущая ▼] [🔗 Новая]     │
├─────────────────────────────────────────────────┤
│  Время показа: [7] сек (3–60)                   │
├─────────────────────────────────────────────────┤
│  Раскладка текста: [▼] (9 вариантов)            │
│  [center] [top-left] [top-right] [left]         │
│  [top-right] [bottom-left] [bottom-right] [right]│
├─────────────────────────────────────────────────┤
│  Цвет текста: [🎨 #ffffff]                      │
│  Размер заголовка: [36] px (16–96)              │
│  Отступы: Т[20] П[20] Н[20] Л[20]              │
├─────────────────────────────────────────────────┤
│  Наложение поверх фото:                         │
│  ☑ Включено  Цвет: [🎨 #000000]  Прозрачность: │
├─────────────────────────────────────────────────┤
│  ☑ Активен на сайте                             │
├─────────────────────────────────────────────────┤
│  [Отмена]  [Сохранить]                          │
└─────────────────────────────────────────────────┘
```

### Менеджер фото (всплывающее окно)

```
┌─────────────────────────────────────────────────┐
│  📸 Выбор фотографии                            │
├─────────────────────────────────────────────────┤
│  Поиск: [_____________________] [🔍]           │
├─────────────────────────────────────────────────┤
│  [Загрузить новое фото]                         │
├─────────────────────────────────────────────────┤
│  Все (47)  Неиспользованные (12)  Превью (4)    │
├─────────────────────────────────────────────────┤
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐           │
│  │ 🖼🖼 │ │ 🖼🖼 │ │ 🖼🖼 │ │ 🖼🖼 │  ← сетка  │
│  └──────┘ └──────┘ └──────┘ └──────┘    превью │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐           │
│  │ 🖼🖼 │ │ 🖼🖼 │ │ 🖼🖼 │ │ 🖼🖼 │           │
│  └──────┘ └──────┘ └──────┘ └──────┘           │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐           │
│  │ 🖼🖼 │ │ 🖼🖼 │ │ 🖼🖼 │ │ 🖼🖼 │           │
│  └──────┘ └──────┘ └──────┘ └──────┘           │
│  ┌──────┐ ┌──────┐                              │
│  │ 🖼🖼 │ │ 🖼🖼 │  ← пагинация  ← [1] [2] [3] │
│  └──────┘ └──────┘                              │
├─────────────────────────────────────────────────┤
│  Всего: 47  Выбрано: 0                           │
│  [Отмена]  [Выбрать]                             │
└─────────────────────────────────────────────────┘
```

---

## ПУБЛИЧНАЯ ЧАСТЬ

### Структура HTML-слайда

```html
<div class="slider-slide" data-interval="7">
  <!-- Фон: фото с overlay -->
  <img src="/uploads/..." alt="Функциональный тренинг" class="slider-image">
  <div class="slider-overlay" style="background:#000;opacity:0.4"></div>

  <!-- Контент: текстовый блок -->
  <div class="slider-content slider-position-center">
    <h2 class="slider-title" style="color:#fff;font-size:36px">
      <a href="programs.html?id=...">Функциональный тренинг</a>
    </h2>
    <p class="slider-description" style="color:#fff;margin:20px">
      Краткое описание...
    </p>
  </div>
</div>
```

### CSS-классы раскладки

```css
.slider-content { /* базовые стили текстового блока */ }

/* Позиции */
.slider-position-center { text-align:center; ... }
.slider-position-top-left { text-align:left; ... }
.slider-position-top-right { text-align:right; ... }
.slider-position-left { text-align:left; ... }
.slider-position-right { text-align:right; ... }
.slider-position-bottom-left { text-align:left; ... }
.slider-position-bottom-right { text-align:right; ... }
.slider-position-top-right { text-align:right; ... }
```

### Навигация

```html
<div class="slider-container">
  <div class="slider-track">
    <!-- слайды -->
  </div>
  <!-- Стрелки -->
  <button class="slider-arrow slider-arrow-prev">‹</button>
  <button class="slider-arrow slider-arrow-next">›</button>
  <!-- Точки -->
  <div class="slider-dots">
    <button class="slider-dot active" data-slide="0"></button>
    <button class="slider-dot" data-slide="1"></button>
    <!-- ... -->
  </div>
</div>
```

---

## API АДМИНКИ

> Существующие эндпоинты `get-slides` / `save-slides` **расширяются** новыми полями.
> Новый — `get-photo-album` (менеджер фото).

| Маршрут | Метод | Описание |
|---------|-------|----------|
| `/api/admin/get-slides` | POST | Получить слайды + `defaultInterval` |
| `/api/admin/save-slides` | POST | Сохранить слайды (вкл. drag&drop порядок) + `defaultInterval` |
| `/api/admin/upload-slider-image` | POST | Загрузка фото → путь в ответе (уже есть, переиспользовать) |
| `/api/admin/get-photo-album` | POST | 🆕 Менеджер фото: поиск, пагинация, фильтр used/unused |

### `/api/admin/get-photo-album` — запрос

```json
{
  "query": "тренировка",      // поиск по имени (опционально)
  "filter": "unused",         // "all" \| "unused" \| "used" (опционально)
  "page": 1,
  "per_page": 24
}
```

### `/api/admin/get-photo-album` — ответ

```json
{
  "photos": [
    {
      "path": "/uploads/1772180971686-photo.jpg",
      "name": "1772180971686-photo.jpg",
      "size": 245000,
      "usedBy": [1772180971691]
    }
  ],
  "total": 47,
  "page": 1,
  "per_page": 24
}
```


---

## ЭКСПОРТ (`export-static.mjs`, строки 591–600)

Ключ в `core.js` — **`slider`** (не `sliders`). Сейчас:

```js
slider: (db.sliders || []).filter(s => !s.hidden).map(s => ({
  id: s.id,
  title: s.title || '',
  image: fixPath(s.image),
  interval: Number(s.interval) > 0 ? Number(s.interval) : 5,
  position: ['left', 'center', 'right'].includes(s.position) ? s.position : 'center'
})).slice(0, 10),
```

Стало (новые поля + 9 позиций + снять лимит):

```js
const SLIDER_POS = ['top-left','top-center','top-right','center-left','center',
                    'center-right','bottom-left','bottom-center','bottom-right'];
const POS_MIGRATE = { left: 'center-left', right: 'center-right' };

slider: (db.sliders || []).filter(s => !s.hidden).map(s => {
  const pos = POS_MIGRATE[s.position] || s.position;
  return {
    id: s.id,
    title: s.title || '',
    description: s.description || '',
    image: fixPath(s.image),
    link: s.link || '',
    linkTarget: s.linkTarget === '_blank' ? '_blank' : '_self',
    interval: Number(s.interval) > 0 ? Number(s.interval) : 5,
    position: SLIDER_POS.includes(pos) ? pos : 'center',
    textColor: /^#[0-9a-fA-F]{6}$/.test(s.textColor) ? s.textColor : '#ffffff',
    textSize: clamp(Number(s.textSize) || 42, 16, 96),
    textMargin: {
      top: clamp(Number(s.textMargin?.top) ?? 20, 0, 200),
      right: clamp(Number(s.textMargin?.right) ?? 20, 0, 200),
      bottom: clamp(Number(s.textMargin?.bottom) ?? 20, 0, 200),
      left: clamp(Number(s.textMargin?.left) ?? 20, 0, 200)
    },
    overlay: {
      enabled: s.overlay ? s.overlay.enabled !== false : true,
      color: /^#[0-9a-fA-F]{6}$/.test(s.overlay?.color) ? s.overlay.color : '#000000',
      opacity: clamp(Number(s.overlay?.opacity ?? 0.4), 0, 0.9)
    }
  };
}),
```

> `.slice(0, 10)` снимается — количество слайдов ограничивает только админка.

---

## ПУБЛИЧНАЯ ЧАСТЬ (`main.js` `renderSlider()`)

```html
<div class="slide ${i === 0 ? 'active' : ''}">
  <img src="${image}" alt="${title}">
  <!-- наложение — управляется данными -->
  <div class="slide-overlay" style="background:${overlay.color};opacity:${overlay.opacity}"></div>
  <!-- текстовый блок: позиция + цвет + размер + отступы из данных -->
  <div class="slider-text pos-${position}" style="color:${textColor};margin:${margin}">
    <h1 class="slider-title" style="font-size:${textSize}px">
      ${link ? `<a href="${link}" target="${linkTarget}">${title}</a>` : title}
    </h1>
    ${description ? `<p class="slider-desc">${description}</p>` : ''}
  </div>
</div>
```

### CSS — сетка 3×3 вместо `translate(-50%,-50%)`

Текущий `.slider-text` привязан к центру через `top/left: 50% + transform`.
Для 9 позиций переходим на flex-выравнивание контейнера:

```css
.slide { position: relative; overflow: hidden; }
.slide-overlay { position: absolute; inset: 0; pointer-events: none; }

.slider-text {
  position: absolute; inset: 0;
  display: flex; flex-direction: column;
  max-width: 90%;
  /* цвет/размер/отступы — inline из данных */
}
.slider-text.pos-top-left     { align-items: flex-start; justify-content: flex-start; text-align: left; }
.slider-text.pos-top-center   { align-items: center;     justify-content: flex-start; text-align: center; }
.slider-text.pos-top-right    { align-items: flex-end;   justify-content: flex-start; text-align: right; }
.slider-text.pos-center-left  { align-items: flex-start; justify-content: center;     text-align: left; }
.slider-text.pos-center       { align-items: center;     justify-content: center;     text-align: center; }
.slider-text.pos-center-right { align-items: flex-end;   justify-content: center;     text-align: right; }
.slider-text.pos-bottom-left  { align-items: flex-start; justify-content: flex-end;   text-align: left; }
.slider-text.pos-bottom-center{ align-items: center;     justify-content: flex-end;   text-align: center; }
.slider-text.pos-bottom-right { align-items: flex-end;   justify-content: flex-end;   text-align: right; }

/* обратная совместимость старых значений */
.slider-text.pos-left  { align-items: flex-start; justify-content: center; text-align: left; }
.slider-text.pos-right { align-items: flex-end;   justify-content: center; text-align: right; }
```

> С `flex` отпадают `transform: translate()` — отступы работают через `margin` из данных.
> `backdrop-filter: blur()` + `background: rgba()` с текущего `.slider-text` убираются:
> роль затемнения берёт на себя `.slide-overlay` из данных.

---

## ПУТЬ РАЗРАБОТКИ

### Фаза 1: Экспорт + публичная часть
1. `export-static.mjs` — расширить поля слайдов (description, link, textColor, textSize, textMargin, overlay), снять `.slice(0, 10)`, миграция `left/right` → `center-left/right`
2. `main.js` `renderSlider()` — рендерить description, link, inline-стили
3. `style.css` — 9 позиций через flex, `.slide-overlay`, убрать `backdrop-filter` с текста

### Фаза 2: Админ-панель
1. `admin.html` — расширить редактор слайда: description, link, textColor, textSize, textMargin, overlay, 9 позиций
2. Менеджер фото (popup) — grid превью, поиск, фильтр used/unused, загрузка
3. Расширить `uploadSliderImage` — вместо `<input type=file>` использовать менеджер

### Фаза 3: Бэкенд
1. `admin-server.mjs` — `get-photo-album` API (поиск, пагинация, used/unused)
2. Валидация новых полей в `save-slides`

### Фаза 4: Тесты + деплой
1. Тесты в `test-static.mjs`
2. Бамп кэша
3. Деплой на прод

---

## КРИТЕРИИ ГОТОВОСТИ

- [x] У каждого слайда в админке: заголовок, описание, фото, ссылка, время показа, раскладка (9 позиций), цвет текста, размер заголовка, отступы, наложение
- [x] Слайды сортируются drag&drop (уже было)
- [x] Слайды скрываются (уже было)
- [x] Менеджер фото: popup с поиском, пагинацией, фильтром used/unused, загрузкой
- [x] На главной: слайды рендерятся с индивидуальными настройками
- [x] 9 CSS-классов `.pos-*` (flex-выравнивание вместо transform)
- [x] `.slide-overlay` управляется данными (color/opacity/enabled)
- [x] `export-static.mjs` не режет слайды лимитом `.slice(0,10)`
- [x] Тесты S158 в `test-static.mjs` зелёные (48 новых проверок)
- [x] `npm run static:export` проходит
- [ ] README.md обновлён (после деплоя)

## ЖУРНАЛ

- 2026-11-10: ТЗ построено, проверено по коду (drag&drop и интервал уже были).
- 2026-11-10: реализовано:
  - `export-static.mjs` — новые поля (description, link, textColor, textSize, textMargin, overlay), 9 позиций, миграция left/right, снят `.slice(0,10)`
  - `main.js` — `renderSlider()` рендерит overlay, description, link, inline-стили
  - `style.css` — 9 классов `.pos-*` через flex, `.slide-overlay`, `.slider-desc`, `.slider-link`; убраны `backdrop-filter` и `transform: translate`
  - `admin.html` — редактор слайда расширен (textarea description, link+target, color/size/margin inputs, overlay controls, 9 позиций); менеджер фото (`openPhotoManager`, popup grid, поиск, фильтр, пагинация, загрузка)
  - `admin-server.mjs` — `sanitizeSlides` расширен валидацией новых полей; `handleGetPhotoAlbum` (сканирование uploads/ + album/full/, used/unused по db.json, пагинация)
  - Тесты: 48 проверок S158, бамп ?v=45
- 2026-11-10: `node --check` (admin-server, export, main) ✅; JS-блок admin.html ✅; `npm run static:export` ✅; jsdom-рендер: 5 slides + 5 overlays + inline-styles ✅
- 2026-11-10: `node scripts/test-static.mjs` → **811/813** (2 преждественных: S32 чипы, S28 обложки)


