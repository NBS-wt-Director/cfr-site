#!/bin/bash
set -e

echo "🚀 DEPLOY cfr-site (static) START"

# Determine project root (directory containing this script's parent)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

# ── 0. ЗАЩИТА СЕРВЕРНЫХ ДАННЫХ (обязательно до pull!) ───────────────────────
# db.json на сервере — источник истины (новости/фото редактируются из админки).
# git pull НЕ должен его перезаписывать версией из репозитория.
cp db.json /tmp/db.server.$(date +%s).json
DB_BACKUP="$(ls -t /tmp/db.server.*.json | head -1)"
echo "💾 db.json сохранён: $DB_BACKUP"

# js/data/*.js — артефакты генератора. На сервере они перегенерированы и
# блокируют pull («local changes would be overwritten»). Скидываем к репозиторию:
# следующий шаг static:export пересоберёт их из СЕРВЕРНОГО db.json.
git checkout -- static/js/data/ 2>/dev/null || true

# Pull latest code
git pull origin main

# Восстановить серверную базу поверх pull
cp "$DB_BACKUP" db.json
echo "💾 db.json восстановлен из $DB_BACKUP"

# Install dependencies (only static: mammoth, nodemailer, jsdom)
npm ci --production=false

# Перегенерировать JS-модули из db.json
npm run static:export

# PM2 restart (admin-server на :3456)
pm2 restart cfrsite --update-env

# Nginx config (static site as entry point; certs managed by Certbot)
# Бэкап — ВНЕ sites-enabled (иначе include /etc/nginx/sites-enabled/* подхватит его как дубль сервера)
sudo mkdir -p /root/nginx-backups
sudo cp /etc/nginx/sites-enabled/центр-фр.рф /root/nginx-backups/центр-фр.рф.bak.$(date +%s) 2>/dev/null || true

# Guard: репозиторный конфиг ОБЯЗАН проксировать админку. Иначе не ставить.
if ! grep -Eq '^\s*location /api/admin/' "${SCRIPT_DIR}/nginx-site.conf"; then
  echo "⚠️  nginx-site.conf: блок /api/admin/ закомментирован или отсутствует."
  echo "   NGINX НЕ обновляем — иначе админка отвалится. Проверьте конфиг вручную."
else
  sudo cp "${SCRIPT_DIR}/nginx-site.conf" /etc/nginx/sites-enabled/центр-фр.рф
  sudo nginx -t && sudo systemctl reload nginx
  echo "✅ NGINX обновлён (админка проксирована)"
fi

# ── Night scripts cron (S60) ────────────────────────────────────────────────
# ВАЖНО: ставим ТОЛЬКО если строки CFR-NIGHT ещё нет. Иначе затираем
# боевой ночной сканер (night-sync.mjs = закачка фото с диска + парсинг),
# который на сервере уже настроен вручную.
CRON_TAG="# CFR-NIGHT"
CRON_SCHEDULE="0 3 * * *"
CRON_CMD="cd ${PROJECT_DIR} && node scripts/night-sync.mjs >> static/data/.night-sync.log 2>&1"
CRON_LINE="${CRON_SCHEDULE} ${CRON_CMD}  ${CRON_TAG}"
if crontab -l 2>/dev/null | grep -q "$CRON_TAG"; then
  echo "✅ Cron ($CRON_TAG) уже настроен — НЕ трогаем:"
  crontab -l | grep "$CRON_TAG"
else
  (crontab -l 2>/dev/null | grep -v "$CRON_TAG"; echo "$CRON_LINE") | crontab -
  echo "✅ Cron (night-sync) установлен: $CRON_SCHEDULE"
fi
# ─────────────────────────────────────────────────────────────────────────────

# Проверки после деплоя
sleep 3
echo "── ПРОВЕРКИ ──"
curl -sk -o /dev/null -w "главная        -> %{http_code} (200)\n" https://центр-фр.рф/
curl -sk -o /dev/null -w "admin.html      -> %{http_code} (200)\n" https://центр-фр.рф/admin.html
curl -sk -o /dev/null -w "/api/admin/login-> %{http_code} (200/401 — не 404/405)\n" \
  -X POST https://центр-фр.рф/api/admin/login -H 'Content-Type: application/json' -d '{"password":"__probe__"}'
curl -sk -o /dev/null -w "несуществ. стр -> %{http_code} (404)\n" https://центр-фр.рф/net-takoy-stranicy

pm2 logs cfrsite --lines 20 --nostream

echo "✅ DEPLOY COMPLETE!"
echo "🌐 Static site: https://центр-фр.рф"
echo "📊 PM2: pm2 monit"
echo "🔍 Logs: pm2 logs cfrsite"
echo "🌙 Night cron: $(crontab -l | grep "$CRON_TAG")"
