#!/bin/bash
sudo mkdir -p /etc/nginx/ssl
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/nginx/ssl/selfsigned.key \
  -out /etc/nginx/ssl/selfsigned.crt \
  -subj "/C=RU/ST=Moscow/L=Moscow/O=ShifuPanda/CN=центр-фр.рф"

sudo cp ssl-nginx.conf /etc/nginx/sites-available/default
sudo nginx -t && sudo systemctl restart nginx

echo "✅ Self-signed HTTPS: https://155.212.134.92"
echo "🌐 curl -k -I https://центр-фр.рф"
