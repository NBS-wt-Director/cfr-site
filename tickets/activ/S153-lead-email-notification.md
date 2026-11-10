# S153 — Заявки не уходят в почту + пустой smtpPass

> **Статус:** 🔴 Активен (поставлен 2026-11-10, пользовательский запрос)

## Постановка

Заявка с формы «Заказать обратный звонок» дошла в базу (`leads.json`), но письмо на adminEmail не ушло.
Последнее письмо ушло 5 октября — с тех пор отправка не работала.

## ФАКТЫ

### База заявок
- `leads.json` в корне проекта: `{ leads: [...] }`
- Форма отправляет POST `/api/admin/lead-create` (публичный, без токена)
- Эндпоинт `handleCreateLead` (admin-server.mjs) — **только пишет в leads.json**, **не шлёт почту**

### SMTP-конфигурация (db.json)
```json
{
  "emailConfig": {
    "smtpHost": "smtp.yandex.ru",
    "smtpPort": 465,
    "smtpSecure": true,
    "smtpUser": "centr-fr@yandex.ru",
    "smtpPass": "",
    "fromName": "Шифу Панда",
    "adminEmail": "centr-fr@yandex.ru",
    "errorEmail": ["i@o8eryuhtin.ru"]
  }
}
```
⚠️ **smtpPass пустой!** — это причина, по которой все автоматические письма (sendReminder, sendEmail404) падают на проверке `if (!smtpUser || !smtpPass)`.

### Существующие пути отправки писем (admin-server.mjs)

1. **`handleSendReminder`** (строка ~1008) — ручная отправка «missing photos»
   - Использует `nodemailer`, конфиг из `db.emailConfig`
   - Поля: `smtpHost/smtpPort/smtpSecure/smtpUser/smtpPass`
   - **Важно:** требует nodemailer в package.json (проверить!)

2. **`handleSendTestEmail`** (строка ~1791) — тест SMTP из админки
   - Тот же конфиг, тот же путь через nodemailer
   - Работает, если smtpPass заполнен

3. **`sendEmail404`** (строка ~2926) — автоматические 404-уведомления
   - **БАГ:** использует `ec.host/ec.user/ec.password/ec.techEmail` — **не те ключи!**
   - Конфиг хранится как `smtpHost/smtpUser/smtpPass` — письма 404 никогда не шли

### nodemailer в package.json
Нужно проверить: есть ли `nodemailer` в `dependencies` проекта.

### S152 (параллельная задача) — текущее состояние
- T152a: текст успеха модалки из `siteSettings.callSuccessText` — **частично сделано**:
  - modal.js: `<p id="callSuccessText">` вместо хардкода
  - export-static.mjs: добавлено чтение `callSuccessText`
  - **Осталось:** сохранить поле в админке («Главные данные»), применить в showSuccess()
- T152b: сабраздел Dance в Интеграциях — **не начато**

## Решение

### 1. Добавить отправку письма при создании заявки (lead-create)
- Добавить `handleCreateLead` отправку письма на `emailConfig.adminEmail`
- Использовать тот же паттерн, что `handleSendReminder` / `handleSendTestEmail`
- Тело письма: имя, телефон, email, сообщение, причина, страница, UA
- Если SMTP не настроен (пустой smtpPass) — не блокировать создание заявки, только логировать
- Анти-спам: один IP → 1 письмо за 30 секунд (уже есть в handleCreateLead)

### 2. Исправить sendEmail404
- Заменить `ec.host` → `ec.smtpHost`, `ec.user` → `ec.smtpUser`, `ec.password` → `ec.smtpPass`
- `ec.techEmail` → `ec.adminEmail`

### 3. Восстановить smtpPass
- На сервере проверить, установлен ли пароль в .env.production
- Или задать новый пароль в админке через «Настройки электронной почты»

### 4. Доделать T152a (текст успеха из админки)
- Добавить поле `callSuccessText` в форму «Главные данные» admin.html
- Сохранять через `handleSaveSiteSettings`
- Применить в modal.js `showSuccess()`

## Шаги реализации
1. Проверить nodemailer в package.json
2. Добавить email-уведомление в handleCreateLead (admin-server.mjs)
3. Исправить sendEmail404 (admin-server.mjs)
4. Добавить callSuccessText в админку «Главные данные» (admin.html)
5. Применить callSuccessText в showSuccess (modal.js)
6. Бамп ?v=41
7. Тесты
8. static:export + push
