# ТИКЕТ F21: Мост данных (Bridge Sync) — починить синхронизацию DanceStudio → PG

> Создан после сессии 17.08.2026.
> Сайт задеплоен, PostgreSQL работает, данные из db.json перенесены.
> Мост данных в админке выдаёт: «PostgreSQL недоступен — синхронизация не работает».

---

## КОНТЕКСТ

Сайт `центр-фр.рф` работает на `db.json` (DB_MODE=json). PostgreSQL поднят (системный, не Docker), база `cfr_site` создана, данные из db.json перенесены в простые таблицы (trainers, programs, news, sliders, sections, staff, settings).

Мост данных (Bridge Sync) — механизм синхронизации XML-файлов DanceStudio (с админского ПК Win11) в PostgreSQL сайта. В админке: **Админка → 🔄 Синхронизация данных**.

---

## ПРОБЛЕМА

Кнопка «📥 Получить данные» выдаёт ошибку:
```
PostgreSQL недоступен — синхронизация не работает
```

### Причина

На сервере выполнен только `docker/init.sql` (базовые таблицы сайта: trainers, programs, news...).
**НЕ выполнены миграции `001_initial.sql` → `005_clean.sql`** из каталога `migrations/`.
Эти миграции создают:
- Схему `cfr_*` (DanceStudio: cfr_persons, cfr_clients, cfr_teachers, cfr_entities, cfr_visits, cfr_accounts...)
- Таблицу `bridge_queue` (очередь пакетов моста)
- ENUM-типы (cfr_bridge_packet_status, cfr_payment_type, cfr_sex...)
- PL/pgSQL функции (process_bridge_queue, bridge_insert_client, bridge_insert_teacher...)

Код моста (`/api/bridge/*`) подключается к PostgreSQL **напрямую** (через `pool` из `@/lib/postgres`), а не через dual-mode. При попытке запроса к `bridge_queue` — таблица не найдена → ошибка.

---

## ЧТО НУЖНО СДЕЛАТЬ

### Этап 1: База данных (на сервере по SSH)

Применить миграции к существующей базе `cfr_site`:

```bash
cd /home/cfr_balloo/sites/cfrsite

PGPASSWORD=cfr_secret_2026 psql -h 127.0.0.1 -U cfr -d cfr_site -f migrations/001_initial.sql
PGPASSWORD=cfr_secret_2026 psql -h 127.0.0.1 -U cfr -d cfr_site -f migrations/002_bridge_queue.sql
PGPASSWORD=cfr_secret_2026 psql -h 127.0.0.1 -U cfr -d cfr_site -f migrations/003_fixes.sql
PGPASSWORD=cfr_secret_2026 psql -h 127.0.0.1 -U cfr -d cfr_site -f migrations/004_optimize.sql
PGPASSWORD=cfr_secret_2026 psql -h 127.0.0.1 -U cfr -d cfr_site -f migrations/005_clean.sql
```

**Возможные проблемы:**
- `001_initial.sql` использует `CREATE TYPE ... EXCEPTION WHEN duplicate_object` — безопасно (IF NOT EXISTS)
- `002_bridge_queue.sql` ссылается на `cfr_bridge_packet_status` ENUM — должен быть создан в 001
- Миграции могут конфликтовать с уже существующими таблицами из `init.sql` (trainers, programs, news) — проверить, не падает ли на `CREATE TABLE IF NOT EXISTS`

**После миграций проверить:**
```bash
PGPASSWORD=cfr_secret_2026 psql -h 127.0.0.1 -U cfr -d cfr_site -tAc "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;"
```
Должно быть ~40+ таблиц (включая cfr_* и bridge_queue).

---

### Этап 2: Код моста — исправить несовпадения (в проекте)

#### Проблема 2.1: ENUM-тип статусов bridge_queue

`001_initial.sql` создаёт ENUM:
```sql
CREATE TYPE cfr_bridge_packet_status AS ENUM ('received','processing','completed','error','retry_pending');
```

Но код в `bridge/sync/route.ts` и `bridge/receive/route.ts` использует:
- `'pending'` (нет в ENUM — должно быть `'received'`)
- `'processed'` (нет в ENUM — должно быть `'completed'`)

**Файлы для исправления:**
- `src/app/api/bridge/receive/route.ts` — строки ~67, ~86, ~179, ~194, ~206
- `src/app/api/bridge/sync/route.ts` — строки ~117, ~129, ~206, ~219, ~229
- `src/app/api/bridge/status/route.ts` — строки ~21, ~34, ~45 (фильтры по статусам)

**Решение:** Заменить во всём коде моста:
- `'pending'` → `'received'`
- `'processed'` → `'completed'`

#### Проблема 2.2: mapFileNameToEntity мапит на несуществующие таблицы

`bridge/receive/route.ts` функция `mapFileNameToEntity`:
```ts
'Client.xml': 'clients',      // но таблица: cfr_clients
'Teacher.xml': 'teachers',    // но таблица: cfr_teachers
'Group.xml': 'groups',        // но таблица: cfr_entities
'Account.xml': 'accounts',    // но таблица: cfr_accounts
```

А `upsertEntity` делает generic `INSERT INTO ${entity}` — вставка в `clients` упадёт (нет такой таблицы).

**Решение:** Переписать `mapFileNameToEntity` + `upsertEntity` для работы со схемой `cfr_*`:
- Использовать PL/pgSQL функции из `002_bridge_queue.sql` (bridge_insert_client, bridge_insert_teacher, bridge_insert_visit, bridge_insert_account)
- Или: маппить на правильные имена таблиц (`cfr_clients`, `cfr_teachers` и т.д.) с преобразованием имён колонок (LastName → last_name)

#### Проблема 2.3: parseXmlContent — простой regex-парсер

`parseXmlContent` извлекает `<Item><Field>value</Field></Item>`.
Структура XML DanceStudio: `<Root><Item><ID>...</ID><LastName>...</LastName>...</Item></Root>`.

Парсер работает, но имена полей в XML (PascalCase: LastName, FirstName) не совпадают с колонками в БД (snake_case: last_name, first_name).

**Решение:** Добавить маппинг полей для каждой сущности (Client → cfr_clients, Teacher → cfr_teachers).

---

### Этап 3: PowerShell-агент (на админском ПК Win11)

#### 3.1. Установка

```powershell
# На админском ПК:
# 1. Создать папку: C:\Users\<user>\DanceStudioSync\
# 2. Скопировать из репозитория:
#    - scripts/bridge_agent.ps1
#    - scripts/bridge_setup.ps1
# 3. Создать bridge_config.json (см. ниже)
# 4. Запустить bridge_setup.ps1 от имени администратора (создаст Task Scheduler задачу)
```

#### 3.2. Конфигурация `bridge_config.json`

```json
{
  "api_url": "https://центр-фр.рф/api/bridge/receive",
  "data_folder": "C:\\DanceStudio\\Data",
  "queue_folder": "C:\\Users\\user\\DanceStudioSync\\queue",
  "log_folder": "C:\\Users\\user\\DanceStudioSync\\logs",
  "interval_seconds": 60,
  "exclude_dirs": ["Files", "LastSave", "Options"],
  "timeout_seconds": 30
}
```

- `api_url` — URL приёмника пакетов на сайте
- `data_folder` — путь к XML-файлам DanceStudio на админском ПК
- `queue_folder` — локальная папка очереди (пакеты перед отправкой)
- `interval_seconds` — интервал автосканирования (по умолчанию 60)

#### 3.3. Автозапуск

```powershell
# От имени администратора:
.\bridge_setup.ps1 -AgentPath "C:\Users\user\DanceStudioSync\bridge_agent.ps1"
```

Создаёт задачу в Task Scheduler:
- Триггер: при входе в систему
- Действие: `powershell.exe -File "C:\Users\user\DanceStudioSync\bridge_agent.ps1"`

#### 3.4. Ручной запуск (для проверки)

```powershell
cd C:\Users\user\DanceStudioSync
.\bridge_agent.ps1 -Manual
```

---

## ФАЙЛЫ В ПРОЕКТЕ

### Для изменения:
| Файл | Что сделать |
|------|-------------|
| `src/app/api/bridge/receive/route.ts` | Исправить статусы (pending→received, processed→completed), переписать mapFileNameToEntity + upsertEntity для cfr_* |
| `src/app/api/bridge/sync/route.ts` | Исправить статусы, переписать upsertEntity |
| `src/app/api/bridge/status/route.ts` | Исправить фильтры статусов |
| `src/components/admin/AdminSync.tsx` | Проверить, что тексты статусов совпадают с новыми значениями |

### Для справки (не менять):
| Файл | Назначение |
|------|-------------|
| `migrations/001_initial.sql` | Полная схема cfr_* + bridge_queue |
| `migrations/002_bridge_queue.sql` | PL/pgSQL функции моста |
| `scripts/bridge_agent.ps1` | PowerShell-агент (готов, 576 строк) |
| `scripts/bridge_setup.ps1` | Установщик Task Scheduler |

---

## КРИТЕРИИ ГОТОВНОСТИ

- [ ] Миграции 001–005 применены на сервере (таблица bridge_queue существует)
- [ ] В админке «Синхронизация данных» не выдаёт ошибку «PostgreSQL недоступен»
- [ ] Кнопка «Получить данные» возвращает `{ success: true }` (даже если очередь пуста)
- [ ] Код моста использует правильные имена таблиц (cfr_*) и статусы (received/completed)
- [ ] PowerShell-агент установлен на админском ПК и отправляет пакеты
- [ ] Пакеты из XML появляются в bridge_queue и обрабатываются (статус → completed)
- [ ] Данные из XML попадают в таблицы cfr_clients, cfr_teachers, cfr_entities и т.д.

---

## ПОРЯДОК ВЫПОЛНЕНИЯ

```
1. Этап 1: Миграции на сервере (SSH)
   ↓
2. Этап 2: Исправить код моста (локально → commit → push → pull на сервере → build → restart)
   ↓
3. Проверить в админке: «Получить данные» → { success: true }
   ↓
4. Этап 3: Установка PowerShell-агента на админском ПК
   ↓
5. Ручной запуск bridge_agent.ps1 -Manual
   ↓
6. Проверить: пакеты в bridge_queue, данные в cfr_*
```

---

## ВАЖНЫЕ ПРАВИЛА

1. **Turbopack ЗАПРЕЩЁН** — `next build --webpack`, `next start -p 3000` (без `--no-turbopack`)
2. **db.json — ИСТОЧНИК ИСТИНЫ** — не удалять, не очищать
3. **Двухрежимность** — сайт на db.json, мост работает с PG напрямую (это нормально)
4. **Миграции применять по одной** — если одна падает, разобрать ошибку, исправить, продолжить
5. **SSH-команды группировать в одно окно**

---

## ФОРМАТ КОМАНДЫ ДЛЯ НОВОЙ СЕССИИ

```
Прочитай документ cfr-site/TICKET-F21-BRIDGE.md
и выполни тикет F21
```

---

## СТАТУС СЕРВЕРА (на момент создания тикета)

- ✅ Сайт работает: `https://центр-фр.рф` (HTTP 200)
- ✅ PM2: cfrsite online, `args: 'start -p 3000'`
- ✅ PostgreSQL: системный (apt), порт 5432, база `cfr_site`, пользователь `cfr`
- ✅ `.env.production` создан (DB_MODE=json, JWT_SECRET, ADMIN_API_KEY)
- ✅ Данные из db.json перенесены в простые таблицы PG
- ❌ Миграции cfr_* НЕ применены
- ❌ Мост данных не работает (нет таблицы bridge_queue)
- ❌ PowerShell-агент не установлен на админском ПК

---

**Создан: 17.08.2026 после сессии деплоя F17–F20 + T3.**