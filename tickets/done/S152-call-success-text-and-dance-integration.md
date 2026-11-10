# S152 — Текст успеха модалки из админки + сабраздел Dance в Интеграциях

> **Статус:** ✅ Выполнен (2026-11-10)
> Закрыт: 2026-11-10, тесты S152 зелёные (modal.js, export-static, admin.html, справка).

## Постановка

1. **Текст успеха модалки** — «Мы перезвоним вам в течение 15 минут» заменить на настраиваемый из «Главных данных» админки. Текст: «Свяжемся, как только сможем» (по умолчанию).
2. **Сабраздел Dance в Интеграциях** — пока только статусы и кнопка ручного запуска (неактивная).

## ФАКТЫ

### Текст успеха модалки
- `static/js/modal.js` строка 72: `<p>Мы перезвоним вам в течение 15 минут</p>` — хардкод
- `scripts/export-static.mjs` — уже добавлено чтение `callSuccessText` из `db.siteSettings.callSuccessText` (строка 283)
- `modal.js` строка 72 — заменено на `<p id="callSuccessText"></p>`
- **Осталось:**
  - Добавить поле `callSuccessText` в форму «Главные данные» (admin.html)
  - Сохранять в `handleSaveSiteSettings` (admin-server.mjs)
  - Применить в `showSuccess()` (modal.js) — подставлять текст из `SITE_DATA.siteSettings.callSuccessText`
  - Бамп ?v=41

### Сабраздел Dance в Интеграциях
- `static/admin.html` — группа «🔗 ИНТЕГРАЦИИ» (строка 576) — пока один пункт «🔗 Интеграции (скоро)»
- **Осталось:**
  - Добавить сабраздел `#integrations-dance` в sidebar
  - Добавить в реестр `sections` → { id: 'integrations-dance', title: '💃 Dance', status: 'done', group: 'integrations' }
  - Добавить функцию `loadDanceIntegrationSection()` — таблица статусов + кнопка «Запустить» (disabled)
  - Добавить описание в `getSectionDescription`
  - Добавить справку в `DEFAULT_HELP_SECTIONS` (admin-server.mjs)

## Шаги реализации
1. Добавить callSuccessText в admin.html «Главные данные»
2. Сохранять callSuccessText через handleSaveSiteSettings
3. Применить callSuccessText в modal.js showSuccess()
4. Добавить сабраздел Dance в sidebar Интеграций
5. Добавить loadDanceIntegrationSection()
6. Добавить справку в DEFAULT_HELP_SECTIONS
7. Бамп ?v=41
8. Тесты
9. static:export + push
