#!/bin/bash
set -e

echo "🚀 DEPLOY cfr-site (static) START"

# Determine project root (directory containing this script's parent)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Pull latest code
git pull origin main

# Install dependencies (only static: mammoth, nodemailer, jsdom)
npm ci --production=false

# Перегенерировать JS-модули из db.json
npm run static:export

# PM2 restart (admin-server на :3456)
pm2 restart cfrsite --update-env

# Nginx config (static site as entry point; certs managed by Certbot)
sudo cp /etc/nginx/sites-enabled/центр-фр.рф /etc/nginx/sites-enabled/центр-фр.рф.bak.$(date +%s) 2>/dev/null || true
sudo cp "${SCRIPT_DIR}/nginx-site.conf" /etc/nginx/sites-enabled/центр-фр.рф
sudo nginx -t && sudo systemctl reload nginx

# ── Night scripts cron (S60) ────────────────────────────────────────────────
CRON_TAG="# CFR-NIGHT"
CRON_SCHEDULE="0 3 * * *"
CRON_CMD="cd ${PROJECT_DIR} && node scripts/parse-docs.mjs >> static/data/.parse-docs.log 2>&1 && node scripts/check-covers.mjs >> static/data/.check-covers.log 2>&1"
CRON_LINE="${CRON_SCHEDULE} ${CRON_CMD}  ${CRON_TAG}"
(crontab -l 2>/dev/null | grep -v "$CRON_TAG"; echo "$CRON_LINE") | crontab -
echo "✅ Cron (night scripts) updated: $CRON_SCHEDULE"
# ─────────────────────────────────────────────────────────────────────────────

# Logs
pm2 logs cfrsite --lines 20

echo "✅ DEPLOY COMPLETE!"
echo "🌐 Static site: https://центр-фр.рф"
echo "📊 PM2: pm2 monit"
echo "🔍 Logs: pm2 logs cfrsite"
echo "🌙 Night cron: $(crontab -l | grep CFR-NIGHT)"
