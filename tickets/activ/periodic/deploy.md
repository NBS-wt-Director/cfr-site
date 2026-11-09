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

```bash
cd /home/cfr_balloo/sites/cfrsite && cp db.json /tmp/db.server.json && git checkout -- static/js/data/ && git pull origin main && cp /tmp/db.server.json db.json && npm run static:export && pm2 restart cfrsite --update-env && sleep 3 && pm2 logs cfrsite --lines 15 --nostream && curl -sk -o /dev/null -w "HTTP: %{http_code}\n" https://центр-фр.рф/
```

> ⚠️ Если пачка меняет новости/данные — db.json **мержится**, а не возвращается целиком
> (см. исключение в `withLord/S101-deploy-prep.md`).

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
cp /tmp/db.server.json /home/cfr_balloo/sites/cfrsite/db.json \
  && cd /home/cfr_balloo/sites/cfrsite && npm run static:export && pm2 restart cfrsite
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
