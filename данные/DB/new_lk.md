# ЛИЧНЫЙ КАБИНЕТ КЛИЕНТА — DanceStudio

> Тикет 3.1: Проектирование ЛК
> Данные: 2605 клиентов, 3275 абонементов, 71873 визитов, 2112 индивидуальных тренировок, 157 групп

---

## КОНЦЕПЦИЯ

ЛК — это веб-приложение на Next.js по адресу `/lk`. Клиент входит по телефону + 6-значный пароль (выдаёт администратор). После входа видит:

1. **Дашборд** — сводка: баланс, абонементы, ближайшее занятие
2. **Абонементы** — все абонементы с остатком тренировок
3. **Посещения** — история визитов
4. **Индивидуальные тренировки** — история индивидуальных занятий
5. **Бронирования** — запись на занятие
6. **Магазин** — товары студии
7. **Профиль** — контактные данные

---

## РАЗДЕЛЫ ЛК

### 1. Авторизация (`/lk`)

**Что:** Форма входа по телефону + пароль (6 цифр)
**Данные:** `users` (phone, password_hash)
**API:**
- `POST /api/lk/auth` — вход (phone + password → JWT)
- `GET /api/lk/profile?section=profile` — профиль (требуется JWT)
- `GET /api/lk/profile?section=subscriptions` — абонементы
- `GET /api/lk/profile?section=visits` — посещения
- `GET /api/lk/profile?section=individual-trainings` — индивидуальные тренировки
- `GET /api/lk/profile?section=shop` — товары магазина

**UI:**
- Логин: телефон (+7 формат)
- Пароль: 6 цифр
- Кнопка «Войти»
- Подсказка: «Нет доступа? Обратитесь к администратору»

---

### 2. Дашборд (`/lk` — после входа)

**Что:** Главная страница с обзором

**Блоки:**

| Блок | Данные | Источник |
|---|---|---|
| **Приветствие** | Фото, имя, телефон | `cfr_persons` + `cfr_media` (фото) |
| **Мои абонементы** | Активные: название, осталось тренировок, дата окончания | `cfr_accounts` WHERE account_status IN ('active', 'frozen') |
| **Ближайшее занятие** | Дата, время, группа, тренер, зал | `cfr_schedule_entries` + `cfr_entities` + `cfr_teachers` |
| **Баланс** | Депозит, бонусы | `cfr_transactions` WHERE transaction_type IN ('deposit_add', 'bonus_add') |
| **Последние визиты** | 5 последних визитов | `cfr_visits` ORDER BY visit_date DESC LIMIT 5 |
| **Бронирования** | Активные бронирования | `cfr_reservations` WHERE status = 'confirmed' |

**API:** `GET /api/lk/profile?section=dashboard` — возвращает все данные одним запросом

**UI:**
- Карточка профиля: аватар (из фото), имя, телефон
- Сетка карточек: абонементы (цвет по статусу), ближайшее занятие (выделена), баланс, визиты
- Кнопка «Выйти»

---

### 3. Абонементы (`/lk?section=accounts`)

**Что:** Все абонементы клиента с детализацией

**Поля каждого абонемента:**

| Поле | Описание | Источник |
|---|---|---|
| Название | Тип абонемента | `cfr_accounts.account_type_name` |
| Номер | Номер в системе | `cfr_accounts.number` |
| Создан | Дата покупки | `cfr_accounts.create_date` |
| Начался | Дата начала действия | `cfr_accounts.begin_date` |
| Тренировок всего | Общее количество | `cfr_accounts.training_count` |
| Использовано | Сколько посещений | `cfr_visits` WHERE account_id = X |
| Осталось | training_count - использовано | Вычисляемое |
| Бесплатных | Из донора | `cfr_accounts.free_training_count` |
| Стоимость | Цена абонемента | `cfr_accounts.original_cost` |
| Скидка | Сумма скидки | `cfr_accounts.discount` |
| Статус | active/expired/frozen/cancelled | `cfr_accounts.account_status` |
| Аннотация | Заметки | `cfr_accounts.annotation` |

**Статусы (цвет):**
- 🟢 active — активно
- 🟡 frozen — заморожен
- 🔴 expired — истёк
- ⚫ cancelled — отменён

**API:** `GET /api/lk/profile?section=accounts` — список абонементов с использованными визитами

**Формула использованных визитов:**
```sql
SELECT COUNT(*) FROM cfr_visits WHERE account_id = $1 AND record_status != 'removed'
```

**UI:**
- Таблица или карточки с абонементами
- Прогресс-бар: использовано / всего тренировок
- Цвет бейджа по статусу
- Клик на абонемент → раскрывается история визитов по этому абонементу

---

### 4. Посещения (`/lk?section=visits`)

**Что:** История всех визитов клиента

**Поля:**

| Поле | Описание | Источник |
|---|---|---|
| Дата | Дата визита | `cfr_visits.visit_date` |
| Группа/Сущность | Название группы | `cfr_entities.name` |
| Тренер | ФИО тренера | `cfr_persons` JOIN `cfr_teachers` |
| Зал | Название зала | `cfr_halls.name` |
| Филиал | Название филиала | `cfr_branches.name` |
| Стоимость | Стоимость визита | `cfr_visits.cost` |
| Тип оплаты | Наличные/карта/абонемент | `cfr_visits.payment_type` |
| Абонемент | Номер абонемента | `cfr_accounts.number` |

**Фильтры:**
- По дате (месяц, год)
- По группе
- По тренеру

**API:** `GET /api/lk/profile?section=visits&month=2026-08&entity_id=xxx`

**Группировка:**
- По умолчанию: последние 50 визитов
- Клик на «Показать все» → подгрузка всех

**UI:**
- Таблица с визитами
- Фильтры сверху (месяц, год, группа)
- Итого: всего визитов, суммарная стоимость
- Цвет визита по типу оплаты

---

### 5. Индивидуальные тренировки (`/lk?section=individual-trainings`)

**Что:** История индивидуальных занятий

**Данные из донора:** IndividualTraining (2112 записей)

**Поля:**

| Поле | Описание | Источник |
|---|---|---|
| Дата | Дата тренировки | `cfr_individual_trainings.training_date` |
| Тренер | ФИО тренера | `cfr_persons` + `cfr_teachers` |
| Зал | Название зала | `cfr_halls.name` |
| Длительность | Минуты | `cfr_individual_trainings.duration` |
| Стоимость | Цена | `cfr_individual_trainings.cost` |
| Статус | Проведена/отменена | Вычисляемое |

**API:** `GET /api/lk/profile?section=individual-trainings`

**UI:**
- Список карточек
- Каждая: дата, тренер, зал, длительность, стоимость
- Итого: всего индивидуальных, суммарная стоимость

---

### 6. Бронирования (`/lk?section=bookings`)

**Что:** Запись на занятие + история бронирований

**Данные из донора:** Reservations (40 записей)

**Функционал:**

1. **Создать бронирование:**
   - Выбор группы из списка
   - Выбор даты
   - ФИО, телефон (автоподстановка из профиля)
   - Комментарий
   - Кнопка «Забронировать»

2. **Мои бронирования:**
   - Список активных (confirmed, pending)
   - История (cancelled, no_show, checked_in)
   - Кнопка «Отменить» для pending/confirmed

**Поля бронирования:**

| Поле | Описание |
|---|---|
| Группа | Название группы |
| Дата и время | Расписание |
| Тренер | ФИО |
| Статус | confirmed/pending/cancelled/no_show |
| Комментарий | Заметка клиента |

**API:**
- `GET /api/lk/profile?section=bookings` — мои бронирования
- `GET /api/lk/profile?section=groups` — доступные группы
- `POST /api/lk/bookings` — создать бронирование
- `PUT /api/lk/bookings/:id` — отменить бронирование

**UI:**
- Вкладка «Мои» — список бронирований
- Вкладка «Записаться» — форма выбора группы и даты
- Цвет статуса: 🟢 confirmed, 🟡 pending, 🔴 cancelled

---

### 7. Магазин (`/lk?section=shop`)

**Что:** Каталог товаров студии

**Данные из донора:** Products (51 товар)

**Поля товара:**

| Поле | Описание | Источник |
|---|---|---|
| Название | Название товара | `cfr_products.name` |
| Артикул | Штрихкод | `cfr_products.barcode` |
| Цена | Цена продажи | `cfr_products.purchase_cost + markup` |
| Единица | Шт/час/мин | `cfr_products.unit` |
| Описание | Описание | `cfr_products.description` |
| Статус | active/inactive/discontinued | `cfr_products.product_status` |

**API:**
- `GET /api/lk/profile?section=shop` — каталог товаров
- `POST /api/lk/shop/order` — заказать товар

**UI:**
- Сетка карточек товаров
- Фильтр по категориям (если есть)
- Кнопка «Заказать» на каждом товаре

---

### 8. Профиль (`/lk?section=profile`)

**Что:** Просмотр и редактирование контактных данных

**Поля:**

| Поле | Описание | Источник |
|---|---|---|
| ФИО | Фамилия, имя, отчество | `cfr_persons` |
| Телефон | Основной | `cfr_persons.mobile_phone` |
| Доп. телефон | Дополнительный | `cfr_persons.additional_phone` |
| Email | Почта | `cfr_persons.email` |
| Дата рождения | | `cfr_persons.birth_date` |
| Адрес | | `cfr_persons.address` |
| Фото | | `cfr_media` (entity_type='client') |
| Теги | Метки клиента | `cfr_tags` через `cfr_client_tags` |
| Источник | Откуда узнал о студии | `cfr_informers` через `cfr_client_informers` |
| Аннотация | Заметка админа | `cfr_clients.annotation` |
| Договор | Номер договора | `cfr_clients.agreement_number` |

**API:**
- `GET /api/lk/profile?section=profile` — профиль с полной информацией
- `PUT /api/lk/profile` — обновление контактов

**UI:**
- Карточка с фото (слева)
- Форма с полями (справа)
- Кнопка «Сохранить»
- Раздел «Информация»: теги, источник, аннотация

---

## API-ЭНДПОИНТЫ ЛК

### Auth

| Метод | URL | Описание |
|---|---|---|
| POST | `/api/lk/auth` | Вход (phone + password → JWT) |
| — | `/api/lk/logout` | Выход (клиент удаляет токен) |

### Profile

| Метод | URL | Описание |
|---|---|---|
| GET | `/api/lk/profile?section=profile` | Профиль пользователя |
| GET | `/api/lk/profile?section=dashboard` | Сводка для дашборда |
| GET | `/api/lk/profile?section=accounts` | Абонементы с использованными визитами |
| GET | `/api/lk/profile?section=visits` | История визитов |
| GET | `/api/lk/profile?section=individual-trainings` | Индивидуальные тренировки |
| GET | `/api/lk/profile?section=bookings` | Мои бронирования |
| GET | `/api/lk/profile?section=groups` | Доступные группы |
| GET | `/api/lk/profile?section=shop` | Каталог товаров |
| GET | `/api/lk/profile?section=notifications` | Уведомления |
| PUT | `/api/lk/profile` | Обновление контактов |

### Bookings

| Метод | URL | Описание |
|---|---|---|
| POST | `/api/lk/bookings` | Создать бронирование |
| PUT | `/api/lk/bookings/:id` | Отменить/изменить бронирование |

### Shop

| Метод | URL | Описание |
|---|---|---|
| POST | `/api/lk/shop/order` | Заказать товар |

---

## СТРУКТУРА БАЗЫ ДАННЫХ ДЛЯ ЛК

### Связи для дашборда:

```
cfr_persons (id)
  ├── cfr_users (site_user_id → id)  ← логин
  ├── cfr_clients (person_id → id)   ← абонементы, аннотации
  │     └── cfr_accounts (person_id → person_id)  ← абонементы
  │           └── cfr_visits (account_id → id)    ← использованные визиты
  │
  ├── cfr_visits (person_id → id)    ← история визитов
  │     ├── cfr_entities (entity_id → id)  ← название группы
  │     │     └── cfr_styles (style_id → id) ← стиль
  │     └── cfr_accounts (id → account_id)  ← номер абонемента
  │
  ├── cfr_reservations (person_id → id)  ← бронирования
  │     └── cfr_entities (entity_id → id)  ← группа
  │
  ├── cfr_media (entity_id → id, entity_type='client')  ← фото
  │
  ├── cfr_client_tags (person_id → person_id)
  │     └── cfr_tags (id → tag_id)  ← теги
  │
  ├── cfr_client_informers (person_id → person_id)
  │     └── cfr_informers (id → informer_id)  ← источник
  │
  └── cfr_transactions (person_id → id)  ← баланс (депозит, бонусы)
```

---

## UI КОМПОНЕНТЫ

### Для каждого раздела:

| Компонент | Описание |
|---|---|
| `LkHeader` | Логотип, имя пользователя, кнопка выхода |
| `LkSidebar` | Навигация: дашборд, абонементы, визиты, индивидуальные, бронирования, магазин, профиль |
| `LkCard` | Карточка с заголовком, иконкой, контентом |
| `LkTable` | Таблица с пагинацией |
| `LkProgressBar` | Прогресс: использовано/всего тренировок |
| `LkStatusBadge` | Цветной бейдж статуса |
| `LkEmptyState` | Пустое состояние с подсказкой |
| `LkLoading` | Спиннер загрузки |
| `LkError` | Сообщение об ошибке |

---

## ДИЗАЙН

### Цветовая схема (как на сайте):
- Основной: синий (#2563EB)
- Фон: светло-серый (#F9FAFB)
- Карточки: белые
- Акценты: зелёный (active), жёлтый (pending), красный (expired)

### Типографика:
- Заголовки: жирный, крупный
- Текст: regular, читаемый
- Мелкие подписи: серым

### Адаптивность:
- Desktop: sidebar слева, контент справа
- Mobile: sidebar превращается в bottom-nav

---

## ВАЛИДАЦИЯ И ОГРАНИЧЕНИЯ

### Авторизация:
- Телефон обязателен
- Пароль: ровно 6 цифр
- JWT токен: 30 дней
- Неавторизованный → редирект на login

### Профиль:
- Телефон: формат +7
- Email: валидный email
- ФИО: не более 255 символов

### Бронирования:
- Нельзя бронировать на прошедшую дату
- Один человек — одно активное бронирование на группу
- Отмена за 2 часа до начала

---

## ЧТО НЕ ВХОДИТ В ЭТУ ВЕРСИЮ

- Онлайн-трансляции (в разработке)
- Оплата онлайн (только админ)
- Push-уведомления
- Интеграция с Telegram/WhatsApp ботами
- CRM-функционал (только админка)

---

## СЛЕДУЮЩИЙ ШАГ

**Тикет 3.2: Реализация ЛК** — создаём компоненты UI, API-эндпоинты, подключаем данные из `cfr_*` таблиц.

> ⚠️ **НУЖНО УТВЕРЖДЕНИЕ** — без «всё верно» не переходим к реализации.
