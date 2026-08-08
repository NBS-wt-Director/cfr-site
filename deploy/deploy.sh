#!/bin/bash
set -e

echo "🚀 DEPLOY cfr-site START"

# Pull latest code
git pull origin main

# Install dependencies
npm ci --production=false

# Build
npm run build

# PM2 restart
pm2 restart cfrsite --update-env

# Nginx config
sudo cp nginx.conf /etc/nginx/sites-available/default
sudo nginx -t && sudo systemctl reload nginx

# Logs
pm2 logs cfrsite --lines 20

echo "✅ DEPLOY COMPLETE!"
echo "🌐 HTTP: http://155.212.134.92"
echo "📊 PM2: pm2 monit"
echo "🔍 Logs: pm2 logs cfrsite"
