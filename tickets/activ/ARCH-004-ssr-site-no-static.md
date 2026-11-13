# ARCH-004 — SSR-сайт: 15 роутов + шаблоны + SITE_DATA (концепция «никакой статики»)

> **Статус:** 📋 Запланирован (2026-11-14). Блокируется ARCH-003.
> Поставлен 2026-11-14. **Дизайн не меняется — ни на пиксель.**

## Постановка (слова пользователя)

> «концепции пересматриваем. никакой статики.»

Страницы сайта рендерятся на сервере из PostgreSQL. `export-static.mjs`,
`static/js/data/*.js`, `?v=`-бамп кэша, перегенерация статики из админки — **упраздняются**.

## ФАКТЫ (опора приёма «дизайн не трогаем»)

- Клиентский JS (`main.js`, `entity.js`, `slider-core.js`, `events.js`, `schedule-ui.js`,
  `modal.js`, `visit-tracker.js`) рендерит DOM из **`window.SITE_DATA`** (сейчас — из
  генерируемых `js/data/*.js`). Если сервер внедрит те же данные инлайном — весь клиент
  и CSS (`style.css`) работают без изменений.
- Страниц: index, programs, program, trainers, trainer, directions, news, event, events,
  album, page, lk, crm, 404 (+admin — уже в ARCH-003). URL вида `program.html?id=…` —
  публичные, менять нельзя (SEO, внешние ссылки, QR).
- S18: кириллические slug-якоря — резолв точный+нестрогий, всё лишнее → 404 (32 теста,
  логика в клиентском JS → переносится в серверный резолвер 1:1).
- meta/OG — сейчас почти статичные; sitemap/robots — файлы из экспорта.
- Кэш: `?v=50` + NGINX `expires 30d` на ассеты.

## РЕШЕНИЕ

### Шаблоны
- **Eta** (EJS-подобный, быстрый): скелеты 14 страниц конвертируются механически
  (HTML-каркас остаётся, `<script src="js/data/*.js">` → инлайн `<script>window.SITE_DATA=…</script>`).
- Общий layout (шапка/подвал/модалка) — partials; `headerSettings/footerLinks/sectionNames`
  из pg-таблицы settings.

### Роуты (URL-структура НЕ меняется)
| Путь | Источник данных |
|------|----------------|
| `/` `/index.html` | sliders+sliderSettings+homeSections+programs+trainers+news+schedule+prices+sections |
| `/programs.html` `/program.html?id=…` | programs (+schedule, +photoAlbum) |
| `/trainers.html` `/trainer.html?id=…` | trainers (+slots из schedule/programs) |
| `/directions.html` | directions |
| `/news.html` | news |
| `/events.html` `/event.html?id=…` | events (S166) |
| `/album.html` | album |
| `/page.html?id=…` | pages |
| `/lk.html` `/crm.html` | staff/ЛК (как сейчас) |
| `/*` | 404.html-шаблон + log-404 + email (S141) |

- Разрешение `?id=` (slug/числовой id) — серверный резолвер по правилам S18; 404 — честный HTTP 404.
- Ассеты (`/js`, `/css`, `/uploads`, шрифты) — `@fastify/static` с_ETag + Cache-Control:
  HTML — `no-cache` (или max-age=60), ассеты — `immutable, max-age=30d`. **`?v=` бамп умирает**;
  версионность ассетов — ETag (риск «залипших» версий закрыт short-TTL HTML).

### SEO
- `GET /sitemap.xml`, `/robots.txt` — живые роуты из pg (baseUrl динамический — логика S134).
- meta/title/OG/JSON-LD — сервером для каждой сущности (улучшение против текущего).
- canonical + редиректы `www→корень`, `/index.html→/` — на Caddy (ARCH-001).

### Контент-кэш
In-memory кэш страниц (TTL 60 с + инвалидация на saveDb) — страница из pg ~2–5 мс, кэш снимает
и это. Ключ: путь+query+сегмент видимости (hidden-режим админа не кэшируется).

### Упраздняется (в этом тикете, файлы — в trash/)
`scripts/export-static.mjs`, `static/js/data/`, перегенерация из админки (`spawn npm run static:export`),
`inject-tracker.mjs` (пиксель — в layout), тесты формата `js/data/*` (перенос — ARCH-006).

## ШАГИ

1. Eta + layout (index-скелет) + инлайн SITE_DATA — главная рендерится из pg, попиксельно = прод.
2. Резолвер slug/id (S18) + 404-контур (log-404, email).
3. Остальные 13 страниц пачками: programs/program → trainers/trainer → directions → news/events/event
   → album/page/lk/crm. После каждой — визуальная сверка с продом.
4. meta/OG/JSON-LD + sitemap/robots роуты.
5. Контент-кэш + инвалидация.
6. Отключение генерации: админка перестаёт spawn'ить static:export (патч ARCH-003), export-static → trash/.

## КРИТЕРИИ ГОТОВОСТИ

- [ ] Все 14 страниц отдаются из app-контейнера; скриншоты «прод vs новый» — 0 отличий (десктоп+мобила)
- [ ] URL-структура идентична (включая `?id=`, кириллические slug; лишнее → HTTP 404)
- [ ] sitemap.xml/robots.txt живые, совпадают по составу URL с текущими файлами
- [ ] Ни одного файла в `static/js/data/`, ни одного `?v=` в HTML
- [ ] HTML no-cache + ETag; ассеты 30d immutable (проверка заголовков curl)
- [ ] Контент-кэш: save в админке → изменение видно на сайте ≤ 2 с (инвалидация)
- [ ] Lighthouse: SEO/Performance не хуже текущих значений прода (замер до/после)

## ЖУРНАЛ

- 2026-11-14: тикет создан (волна ARCH).
