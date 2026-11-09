# 🔄 periodic/deploy — Деплой на сервер

> **Периодичность:** по готовности пачки изменений (команда пользователя).
> **Важно:** пользовательская часть — SSH (см. `../withLord/S101-deploy-prep.md`).

## Три запрета (обязательны при каждом деплое)

1. **Данные с сервера** — не теряются и не перезаписываются.
2. **Работоспособность сайта и админки** — не деградирует.
3. **Чужие проекты на сервере** — не затрагиваются.

## Чек-лист

### Этап 1 — локально (AI)

- [ ] `node --check` всех изменённых `.js`/`.mjs`
- [ ] `npm run static:export` без ошибок
- [ ] `npm run test-menu` + `npm run test-static` — зелёные
- [ ] HTTP-прогон страниц/ресурсов на `http://127.0.0.1:3456` — 200, битых картинок нет
- [ ] `git status` — в диффе только ожидаемые файлы; секретов в репо нет
- [ ] Коммит + push — **только по команде пользователя**

### Этап 2 — сервер (пользователь по SSH, AI готовит команду)

Боевая команда — в `AGENTS.md` → секция «🚀 Деплой».

**db.json мержится, а не возвращается целиком.** Серверная база содержит записи,
которых нет в репо (например, «Основы работы с оружием»); слепой `cp` их убьёт.

```bash
cd /home/cfr_balloo/sites/cfrsite

# 1. Бэкап серверной базы
cp db.json backups/db.json.backup.$(date +%s)
cp db.json /tmp/db.server.json

# 2. Отбросить локальные расхождения сгенерированных файлов
git checkout -- static/js/data/

# 3. Обновить код
git pull origin main

# 4. СЛИТЬ базы, а не перезаписывать
node scripts/deploy-merge-db.mjs /tmp/db.server.json            # отчёт
node scripts/deploy-merge-db.mjs /tmp/db.server.json --apply    # применить

# 5. Перегенерировать статику из слитой базы
npm ci
npm run static:export

# 6. Перезапустить (только свой процесс!)
pm2 restart cfrsite --update-env

# 7. Проверить
sleep 5 && pm2 logs cfrsite --lines 20 --nostream
curl -sk -o /dev/null -w "HTTP: %{http_code}\n" https://центр-фр.рф/
```

### Этап 3 — проверки после деплоя

```bash
pm2 logs cfrsite --lines 20 --nostream
curl -sk -o /dev/null -w "главная         -> %{http_code} (200)\n" https://центр-фр.рф/
curl -sk -o /dev/null -w "admin.html       -> %{http_code} (200)\n" https://центр-фр.рф/admin.html
curl -sk -o /dev/null -w "/api/admin/login -> %{http_code} (200/401)\n" \
  -X POST https://центр-фр.рф/api/admin/login -H 'Content-Type: application/json' -d '{"password":"__probe__"}'
curl -sk -o /dev/null -w "несущ. страница  -> %{http_code} (404)\n" https://центр-фр.рф/net-takoy-stranicy
node -e "const d=require('./db.json');console.log('программ',d.programs.length,'тренеров',d.trainers.length,'новостей',d.news.length,'альбом',d.album.length)"
```

### Откат

```bash
# Найти свежий бэкап в backups/ (не в /tmp!)
ls -lt /home/cfr_balloo/sites/cfrsite/backups/db.json.backup.* | head -5

# Восстановить и перегенерировать
cp /home/cfr_balloo/sites/cfrsite/backups/db.json.backup.<свежий_таймstamp> \
   /home/cfr_balloo/sites/cfrsite/db.json \
&& cd /home/cfr_balloo/sites/cfrsite \
&& npm run static:export \
&& pm2 restart cfrsite
```

## Никогда при деплое

- `pm2 restart all` / `pm2 delete` без имени (убьёт чужие процессы);
- трогать чужие конфиги NGINX (`sites-available/default`, `alpha.balloo.su`, `balloo-docker.conf`, `cockpit.balloo.su`);
- `sudo systemctl restart nginx` — только `reload`;
- бэкапы конфигов внутрь `sites-enabled/` (только `/root/nginx-backups/`);
- запускать `deploy.sh` без необходимости (предпочтительна ручная команда).

## Журнал выполнений

| Дата | Коммит | Результат |
|------|--------|-----------|
| 2026-10-23 | `5f4af62` | ✅ Пакет 1 замечаний администратора задеплоен |
| 2026-11-10 | `3484ae8` | ✅ Волна S140–S150: мерж баз (S101), мобильный заказ звонка (S149), карусель дней расписания (S150) |
| 2026-11-10 | `551b003` | ✅ S18: slug-якоря КИРИЛЛИЦЕЙ «как записано» + sitemap со slug + кэш ?v=39. Мерж: расхождений нет. Главная 200, sitemap: 42 slug / 0 числовых, /net-takoi.html → 404 |
