# CFR-Site — Команды для сервера

> Сервер: Ubuntu 24.04 | Путь: `/home/cfr_balloo/sites/cfrsite` | Порт: 3000

---

## 🖥 Проверка окружения и статуса

```bash
# Статус сервера
uptime
free -h
df -h

# Проверка дискового пространства (по папкам)
du -sh /home/cfr_balloo/sites/cfrsite/* | sort -rh | head -10
du -sh /home/cfr_balloo/sites/cfrsite/static/uploads/  # вес загрузок
du -sh /home/cfr_balloo/sites/cfrsite/static/data/      # вес исходных данных

# Процесс Node/PM2
pm2 list
pm2 status cfrsite
pm2 logs cfrsite --lines 30 --nostream

# Проверка порта
ss -tlnp | grep 3000
ss -tlnp | grep 80
ss -tlnp | grep 443

# Проверка NGINX
systemctl status nginx
nginx -t

# Проверка PostgreSQL
systemctl status postgresql
docker ps | grep postgres  # если в Docker

# Проверка сайта
curl -s -o /dev/null -w "HTTP: %{http_code}\n" http://localhost:3000
curl -s -o /dev/null -w "HTTP: %{http_code}\n" https://центр-фр.рф
curl -s -o /dev/null -w "HTTP: %{http_code}\n" http://localhost:3000/admin.html
```

---

## 📦 Деплой (полный)

```bash
cd /home/cfr_balloo/sites/cfrsite

# 1. Бэкап базы и данных
cp db.json db.json.backup.$(date +%s)
cp -r static/uploads static/uploads.backup.$(date +%s)

# 2. Остановить приложение
pm2 stop cfrsite

# 3. Обновить код
git pull origin main

# 4. Пересобрать Next.js
rm -rf .next node_modules/.cache
npm install
npm run build

# 5. Перегенерировать статику
npm run static:export

# 6. Запустить
pm2 start ecosystem.config.js --update-env

# 7. Проверить
sleep 5
pm2 logs cfrsite --lines 20 --nostream
curl -s -o /dev/null -w "HTTP: %{http_code}\n" http://localhost:3000
```

---

## 🔄 Быстрый перезапуск

```bash
# Перезапустить приложение (без перезагрузки NGINX)
pm2 restart cfrsite

# Перезапустить + перегенерировать статику
pm2 restart cfrsite && npm run static:export

# Пересобрать Next.js и перезапустить
npm run build && pm2 restart cfrsite
```

---

## ⚙️ Настройка PM2

### Установка и автозапуск

```bash
# Установить PM2 глобально
npm install -g pm2

# Запустить приложение
pm2 start ecosystem.config.js

# Сохранить список процессов
pm2 save

# Автозапуск при перезагрузке сервера
pm2 startup
# Скопировать и выполнить выведенную команду (например:
# sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u cfr_balloo --hp /home/cfr_balloo)

# Проверить автозапуск
pm2 show cfrsite
```

### Конфиг `ecosystem.config.js`

```js
module.exports = {
  apps: [{
    name: 'cfrsite',
    script: './node_modules/next/dist/bin/next',
    args: 'start -p 3000',
    cwd: '/home/cfr_balloo/sites/cfrsite',
    instances: 1,
    exec_mode: 'fork',
    env: { NODE_ENV: 'production', PORT: 3000 },
    env_file: '.env.production',
    wait_ready: true,
    kill_timeout: 5000,
    max_memory_restart: '1G'
  }]
};
```

---

## 🌐 Загрузка сайта

```bash
# Проверить Next.js на порту 3000
curl -s http://localhost:3000 | head -5

# Проверить NGINX проксирование
curl -s -H "Host: центр-фр.рф" http://localhost:80 | head -5

# Проверить SSL
curl -sk https://центр-фр.рф | head -5

# Проверить статику
curl -s http://localhost:3000/static/index.html | head -5

# Проверить API
curl -s http://localhost:3000/api/admin/get-news | head -5
```

---

## 🗄 Управление данными

```bash
# Бэкап db.json
cp /home/cfr_balloo/sites/cfrsite/db.json /home/cfr_balloo/sites/cfrsite/db.json.backup

# Восстановить из бэкапа
cp /home/cfr_balloo/sites/cfrsite/db.json.backup.1234567890 /home/cfr_balloo/sites/cfrsite/db.json
pm2 restart cfrsite

# Проверить структуру БД
cd /home/cfr_balloo/sites/cfrsite && node -e "const d=require('./db.json'); console.log('programs:', d.programs.length, 'trainers:', d.trainers.length, 'news:', d.news.length)"

# Перегенерировать статику после изменения db.json
cd /home/cfr_balloo/sites/cfrsite && npm run static:export
```

---

## 📊 Логи и мониторинг

```bash
# Логи PM2
pm2 logs cfrsite --lines 100 --nostream
pm2 logs cfrsite --err --lines 50 --nostream

# Логи NGINX
tail -50 /var/log/nginx/error.log
tail -50 /var/log/nginx/access.log

# Логи PostgreSQL (если Docker)
docker logs cfr-postgres 2>&1 | tail -20

# Мониторинг в реальном времени
pm2 monit

# Дисковое пространство по часам (cron)
df -h | grep -E 'Filesystem|/dev/'
```

---

## 🔧 NGINX

```bash
# Проверить конфиг
nginx -t

# Перезагрузить NGINX
systemctl reload nginx

# Полная перезагрузка
systemctl restart nginx

# Конфиг (основной)
cat /etc/nginx/sites-enabled/cfrsite

# SSL сертификат (Let's Encrypt)
certbot certificates
certbot renew --dry-run
```

---

## 🚨 Частые проблемы

| Проблема | Решение |
|----------|---------|
| `502 Bad Gateway` | `pm2 logs cfrsite --lines 30` → проверить, запущен ли Next.js |
| `Turbopack build failed` | Убедиться: `npm run build` (с `--webpack`, без Turbopack) |
| Статика не обновляется | `npm run static:export` + `systemctl reload nginx` |
| NGINX не видит сайт | `nginx -t` → исправить конфиг → `systemctl reload nginx` |
| Порт 3000 занят | `lsof -i :3000` → убить старый процесс → `pm2 restart cfrsite` |
| `db.json` не читается | Проверить JSON: `node -e "JSON.parse(require('fs').readFileSync('db.json'))"` |
| `ENOENT: no such file` | Проверить права: `ls -la /home/cfr_balloo/sites/cfrsite/` |
| PM2 не стартует | `pm2 describe cfrsite` → проверить `cwd` и `env_file` |

---

## 🔐 Секреты

```bash
# .env.production на сервере (НЕ в репозитории!)
cat /home/cfr_balloo/sites/cfrsite/.env.production

# Обязательные переменные:
# JWT_SECRET (минимум 32 символа)
# ADMIN_API_KEY (минимум 32 символа)
# PG_PASSWORD
# SMTP_PASSWORD
# ADMIN_PASSWORD (для admin-server.mjs)
```
