# ARCH-001 — Инфраструктура Docker: compose + PostgreSQL + Caddy (TLS)

> **Статус:** 📋 Запланирован (2026-11-14). Первый тикет архитектуры «без статики».
> Поставлен 2026-11-14 по решению пользователя: всё в контейнерах, данные в PostgreSQL.

## Постановка (слова пользователя)

> «учти ещё одно требование - перенос всех данных на pgsql вместе с переносом на докер.
> статик весь переносим на саббиблиотеку node.js сервер тоже. всё в контейнерах.
> ...концепции пересматриваем. никакой статики.»

## ФАКТЫ (проверено по коду/серверу 2026-11-14)

- `admin-server.mjs` (5449 строк) — голый `node:http`, слушает `127.0.0.1:3456`, PM2 `cfrsite`.
- Зависимости: `nodemailer`, `mammoth`, `fast-xml-parser` (+`jsdom` dev) — все pure JS, alpine-совместимы. Node на сервере v22.
- Статика раздаётся хостовым NGINX (`deploy/nginx-site.conf`, certbot-сертификаты, punycode `xn----itbymbjqk.xn--p1ai`).
- Данные — файлы: `db.json`, `visits.json`, `leads.json`, `.admin-sessions.json`, `.admin-password.json`, `static/uploads/`, `backups/`, `trash/uploads/`, `logs/`.
- Правило монорепо (2026-10-26): **все PostgreSQL — в Docker**.
- Прод-база (скачана 2026-11-14): data.news=1, events=1, programs=33, trainers=13, sliders=29, album=982 + 15 ключей settings.

## РЕШЕНИЕ

`docker-compose.yml` в корне проекта (3 сервиса):

```yaml
services:
  db:      postgres:17-alpine   # том ./volumes/pg, PGDATA на томе, pg_isready healthcheck,
                                # пароль — secrets/ENV (никогда не в compose-файле)
  app:     node:22-alpine       # будущее приложение (ARCH-003/004); на время перехода
                                # крутит текущий admin-server.mjs, том ./:/app
  proxy:   caddy:2-alpine       # TLS Let's Encrypt (auto), 80/443, www→корневой редирект,
                                # volumes ./volumes/caddy/{data,config} — сертификаты переживают пересборку
```

Правила:
1. Наружу смотрит только proxy (80/443). `db` и `app` — только внутри сети compose.
2. Хостовые NGINX/certbot/PM2 НЕ трогать до ARCH-007 (переключение). До него compose поднимается
   на тестовых портах и не мешает проду.
3. `pid: "host"` для app — чтобы S161/S164 «Статус» видел хост (df/uptime).
4. Секреты: `.env.production` (в .gitignore) + `POSTGRES_PASSWORD_FILE`.
5. Файлы `uploads/`, `trash/`, `backups/` — тома, фото в БД не кладём.

## ШАГИ

1. `docker-compose.yml` + `.docker/` (если нужны кастомные образы) + `.env.production.example` с новыми ключами (`PG_*`).
2. Поднять `db` — проверить `pg_isready`, том, перезапуск контейнера (данные живы).
3. Поднять `proxy` на тестовом порту/поддомене — проверить авто-сертификат, редиректы.
4. Поднять `app` с текущим admin-server (бинд правка: `ADMIN_HOST` env, по умолчанию `127.0.0.1`, в контейнере — `0.0.0.0`) — проверить логин/сохранение через proxy.
5. Замер: старт compose с нуля, reconnect к pg, битые ссылки в статусах S161 (ожидаемая деградация pm2/nginx — фиксируется).

## КРИТЕРИИ ГОТОВОСТИ

- [ ] `docker compose up -d` в чистом клоне поднимает db+app+proxy без правок вручную
- [ ] PostgreSQL 17 в Docker, данные переживают `docker compose down/up`
- [ ] Caddy получает Let's Encrypt сертификат и держит его в volume
- [ ] admin-server в контейнере доступен через proxy (логин, save-slides, upload)
- [ ] Хостовые NGINX/PM2/прод не затронуты (проверка `curl https://центр-фр.рф/` = 200)
- [ ] Секретов в git нет (проверка `.env.production.example` + grep)

## ЖУРНАЛ

- 2026-11-14: тикет создан (волна ARCH).
