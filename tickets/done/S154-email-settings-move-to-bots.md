# S154 — Перенос настроек почты в «Боты» + разделы-заглушки ботов

> **Статус:** ✅ Выполнен (2026-11-10)
> Закрыт: 2026-11-10 — почта перенесена в БОТЫ (`#bots-email`), добавлено 8 заглушек,
> таблица почтовых маршрутов + кнопка напоминаний о фото, миграция id в справке.

## Постановка (слова пользователя)

1. **Настройки электронной почты перенести из «⚙️ НАСТРОЙКИ САЙТА» в «🤖 БОТЫ».**
2. **Всё, что связано с электронной почтой, собрать в один раздел.**
3. **В «🤖 БОТЫ» добавить разделы-заглушки:**
   - СМС-рассылки
   - вк-рассылки
   - max-бот
   - tg-бот
   - wapp-бот
   - вк-группа
   - балу-бот
   - задачи для ботов

## ФАКТЫ (собраны 2026-11-10)

### Сайдбар (`static/admin.html`)
- Группа «⚙️ НАСТРОЙКИ САЙТА» — строки 541–557, в ней `#email` («✉️ Настройки электронной почты», строка 545)
- Группа «🤖 БОТЫ» — строки 568–574, сейчас один пункт-заглушка `#bots`
- Группа «📖 СПРАВКА» — образец подгруппы с `sidebar-wip`

### Реестр разделов (`sections`, ~строки 970–1010)
```js
{ id: 'email', title: '✉️ Настройки электронной почты', status: 'done', group: 'settings' },
{ id: 'bots', title: '🤖 Боты', status: 'wip', group: 'stubs' },
```
- Паттерн заглушек с чек-листом: `group: 'help-stub'` → `renderHelpStubSection()`,
  `group: 'templates-stub'` → `renderTemplatesStubSection()` + справочник `*_STUB_SECTIONS`
  (~строка 7270: `'templates-masks-email': { ... todo: [...] }`)

### Функции email (останутся на месте, переедет только пункт меню)
- `loadEmailSettings()` — строка ~3935 (SMTP host/port/user/pass, fromName, adminEmail, errorEmail, тест письма)
- `saveEmailConfig()`, `sendTestEmail()`
- `renderSection`: `if (sectionId === 'email') loadEmailSettings();` — строка ~1131
- `getSectionDescription('email')`, `getSectionFields.email`

### Что ещё связано с почтой (собрать в один раздел)
- `handleSendReminder` — письмо «дозаполнить объекты» (admin-server.mjs) — кнопка в разделе «Email-уведомления»
- `handleSendTestEmail`, `handleGetEmailConfig`, `handleSaveEmailConfig`
- `sendLeadNotification` (S153) — уведомления о заявках, использует `emailConfig`
- `sendEmail404` (S141/S153) — письма о 404, использует `emailConfig`
- **Идея:** в разделе «✉️ Почта» показать все почтовые маршруты + их текущие получатели
  (заявки → adminEmail; 404 → adminEmail; напоминания → adminEmail + errorEmail)

## План реализации
1. Из сайдбара убрать `#email` из «НАСТРОЙКИ САЙТА», добавить в «🤖 БОТЫ»:
   - `#bots-email` «✉️ Почта (SMTP, рассылки, уведомления)» — перенос существующего функционала
   - 8 заглушек: `#bots-sms`, `#bots-vk-mail`, `#bots-max`, `#bots-tg`, `#bots-wapp`,
     `#bots-vk-group`, `#bots-baloo`, `#bots-tasks`
2. В `sections` поменять `group` у email-раздела, добавить 9 записей
3. `renderSection`: `if (sectionId === 'bots-email') loadEmailSettings();`
4. Заглушки — новый `group: 'bots-stub'` + реестр `BOTS_STUB_SECTIONS` (цель + todo-чеклист),
   рендер по образцу `renderTemplatesStubSection`
5. Справка в `DEFAULT_HELP_SECTIONS` для новых разделов
6. Бамп `?v=42 → ?v=43`, тесты, push

## Критерий готовности
- В «БОТАХ» — 1 рабочий раздел почты + 8 заглушек, в «НАСТРОЙКАХ САЙТА» почты нет
- Все почтовые функции работают под новым id без регрессий (тесты)
