# 🚀 Инструкция по деплою на сервер

## Путь проекта: `/home/cfr_balloo/sites/cfrsite`

---

## Быстрый деплой (через терминал на сервере)

```bash
# 1. Подключись к серверу
ssh cfr_balloo@твой-сервер-ip

# 2. Перейди в папку проекта
cd /home/cfr_balloo/sites/cfrsite

# 3. БЭКАП БАЗЫ (ОБЯЗАТЕЛЬНО!)
cp db.json db.json.backup.$(date +%s)

# 4. Останови сайт
pm2 stop cfrsite

# 5. Скачай новую версию
git pull origin main

# 6. Установи зависимости
npm install

# 7. Собери продакшен-билд
npm run build

# 8. Запусти сайт
pm2 start ecosystem.config.js

# 9. Проверь логи
pm2 logs cfrsite --lines 50

# 10. Проверь что сайт работает
curl -s -o /dev/null -w "HTTP %{http_code}" http://localhost:3000
# Должно вывести: 200
```

---

## Откат на случай ошибки

```bash
# Восстановить базу из бэкапа
cp db.json.backup.1234567890 db.json

# Пересобрать предыдущую версию
git checkout HEAD~1 -- .
npm run build

# Перезапустить
pm2 restart cfrsite
```

---

## Мониторинг

```bash
# Статус процессов
pm2 status

# Логи в реальном времени
pm2 logs cfrsite

# Проверить порт
lsof -i :3000

# Проверить NGINX
sudo nginx -t
sudo systemctl status nginx
```

---

## Что изменится после этого деплоя:

✅ **Админка**: шапка с кнопкой сохранения 💾  
✅ **Новости**: картинка + заголовок + текст (многострочное)  
✅ **Расписание/Цены**: загрузка по картинке  
✅ **Фикс**: синтаксическая ошибка в page.tsx  
✅ **HomePrices.tsx**: создан компонент для цен  

---

## Troubleshooting

### Если npm run build упал:
```bash
rm -rf .next node_modules/.cache
npm run build
```

### Если сайт не запускается:
```bash
pm2 delete cfrsite
pm2 start ecosystem.config.js
pm2 logs cfrsite --lines 100
```

### Если ошибка с NGINX:
```bash
sudo systemctl restart nginx
sudo journalctl -u nginx -n 50
```
