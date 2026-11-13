> Закрыт: 2026-11-14, код готов + локальная приёмка пройдена, ждёт деплоя.
> Перенесён из activ при уборке тикетов.

# S168 — Разделы-заглушки в админке (Информация, Данные, Настройки, CRM, Интеграции)

> **Статус:** 🟢 Код готов (2026-11-14), локальная приёмка пройдена. Ждёт деплоя на прод.
> Поставлен 2026-11-14.

## Постановка (слова пользователя)

> «в мегараздел "Данные сайта" добавь разделы товары, доп. услуги, инвентарь, поля дневников;
> в "Настройки сайта" — места/виды/типы/группы/сущности инвентаря + карта помещений, красная зона;
> в "Информация" — журнал админки, журнал CRM, отчёты по сайту;
> CRM-группа — пользователи, права, модули, экспериментальные, отчёты, ЛК клиента/тренера;
> Интеграции — 1С, соцсети, СМС; убрать сабразделы-заглушки CRM и Интеграции»

## Что реализовано

### Админка (`admin.html`)

#### Категория «ℹ️ Информация»
1. **`info-admin-log`** — журнал админки (заглушка, категория: info)
2. **`info-crm-log`** — журнал CRM (заглушка, категория: info)
3. **`info-reports`** — отчёты по сайту (заглушка, категория: info)

#### Категория «📦 Данные»
4. **`goods`** — товары (заглушка, категория: data)
5. **`services`** — дополнительные услуги (заглушка, категория: data)
6. **`inventory`** — инвентарь (заглушка, категория: data)
7. **`diary-fields`** — поля дневников (заглушка, категория: data)

#### Категория «⚙️ Настройки сайта»
8. **`inv-places`** — места инвентаря (заглушка, категория: settings)
9. **`inv-kinds`** — виды инвентаря (заглушка, категория: settings)
10. **`inv-types`** — типы инвентаря (заглушка, категория: settings)
11. **`inv-groups`** — группы инвентаря (заглушка, категория: settings)
12. **`inv-entities`** — сущности инвентаря (заглушка, категория: settings)
13. **`room-map`** — карта помещений / SVG-план (заглушка, категория: settings)
14. **`danger-zone`** — красная зона (заглушка, категория: settings)

#### CRM-группа (8 разделов, сабраздел-заглушка «CRM» удалён)
15. **`crm-users`** — пользователи CRM (заглушка, категория: crm)
16. **`crm-perms`** — права доступа (заглушка, категория: crm)
17. **`crm-modules`** — модули CRM (заглушка, категория: crm)
18. **`crm-experimental`** — экспериментальные функции (заглушка, категория: crm)
19. **`crm-reports-owner`** — отчёты владельца (заглушка, категория: crm)
20. **`crm-reports-accountant`** — отчёты бухгалтера (заглушка, категория: crm)
21. **`crm-lk-client`** — ЛК клиента (заглушка, категория: crm)
22. **`crm-lk-trainer`** — ЛК тренера (заглушка, категория: crm)

#### Интеграции (3 раздела, сабраздел-заглушка «Интеграции» удалён)
23. **`integrations-1c`** — интеграция с 1С (заглушка, категория: integrations)
24. **`integrations-social`** — соцсети (заглушка, категория: integrations)
25. **`integrations-sms`** — СМС-рассылки (заглушка, категория: integrations)

### Механизм

1. **`STUB_PAGES`** — единый объект `{ id: { title, lead, todo[] } }` (25 записей)
2. **`renderStubPageSection(el, id)`** — универсальный рендер: заголовок, lead, todo-чеклист,
   перекрёстные ссылки на смежные разделы
3. **`renderSection`** — диспетчер: `info-stub`/`data-stub`/`settings-stub`/`crm-stub`/`integrations-stub` → `renderStubPageSection`
4. **Sidebar**: все 25 ссылок в соответствующих группах, удалены сабразделы-заглушки «CRM» и «Интеграции»
5. **Hash-redirect**: `#crm` → `crm-leads`, `#integrations` → `integrations-dance`

### Справка (`admin.html`, help)

- Категории расширены: `crm`, `integrations`, `templates`, `bots`, `info`
- Для каждого заглушечного раздела — краткое описание в справке

## Критерий готовности

- [x] «Информация»: info-admin-log, info-crm-log, info-reports
- [x] «Данные»: goods, services, inventory, diary-fields
- [x] «Настройки сайта»: inv-places, inv-kinds, inv-types, inv-groups, inv-entities, room-map, danger-zone
- [x] «CRM»: crm-users, crm-perms, crm-modules, crm-experimental, crm-reports-owner, crm-reports-accountant, crm-lk-client, crm-lk-trainer
- [x] «Интеграции»: integrations-1c, integrations-social, integrations-sms
- [x] Сабразделы-заглушки «CRM» и «Интеграции» удалены
- [x] `STUB_PAGES` (25 записей с lead + todo[])
- [x] `renderStubPageSection` — универсальный рендер с перекрёстными ссылками
- [x] Hash-redirect `#crm`→`crm-leads`, `#integrations`→`integrations-dance`
- [x] Справка — категории crm/integrations/templates/bots/info
- [x] Тесты в `test-static.mjs` (блок S168, ~25 проверок)
- [ ] Боевая приёмка на проде (после деплоя)

## ЖУРНАЛ

- 2026-11-14: задача поставлена пользователем
- 2026-11-14: сайдбар — 25 новых ссылок, удалены сабразделы-заглушки CRM/Интеграции
- 2026-11-14: sections — 25 skeleton-записей + STUB_PAGES + renderStubPageSection
- 2026-11-14: renderSection — 5 stub-групп → renderStubPageSection
- 2026-11-14: hash-redirect #crm→crm-leads, #integrations→integrations-dance
- 2026-11-14: справка — категории crm/integrations/templates/bots/info
- 2026-11-14: тесты: блок S168 в `test-static.mjs` (25+ проверок) ✅
