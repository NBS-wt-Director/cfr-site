# Сканирование XML DanceStudio (D1.1–D1.10)

> Формат: Entity / Root / Fields / Relations / Examples / Notes

---

## Тикет D1.2: Account, Charge, Product, Reservation

**Статус:** ✅ Прочитано и утверждено
**Файлы:** `Account.xml`, `Account001.xml`, `Charge.xml`, `Product.xml`, `Reservation.xml`

---

### Entity: Account (абонементы/счета)

**Файлы:** `Account.xml`, `Account001.xml` — партиционированные данные одной сущности.
- `Account.xml` — записи 2019 года
- `Account001.xml` — записи 2021 года

**Root:** `<Account>`
**Дочерние элементы:** `<Item>` (многократный)

#### Поля

| Поле | Тип | Описание |
|---|---|---|
| `ID` | string (UUID) | Уникальный идентификатор |
| `Number` | int | Порядковый номер счёта |
| `CreateDate` | string (DD.MM.YYYY) | Дата создания абонемента |
| `BeginDate` | string (DD.MM.YYYY) | Дата начала действия |
| `DaysCount` | int | Количество дней действия (28, 30, 60, 90) |
| `IsPerpetual` | bool | Бессрочный |
| `IsUnlimited` | bool | Безлимитный |
| `TrainingCount` | int | Количество занятий (может быть обновлено атрибутом) |
| `FreeTrainingCount` | int | Количество бесплатных занятий |
| `PaymentType` | string | Тип оплаты: `Cash` / `NonCash` |
| `ID_Client` | string (UUID) | Ссылка на клиента |
| `OriginalCost` | decimal | Стоимость без скидки |
| `Discount` | decimal | Сумма скидки |
| `DiscountPercent` | decimal | Процент скидки |
| `AddDaysCount` | int | Дополнительные дни |
| `AccountTypeName` | string | Название типа абонемента (напр. "1 со скидкой 5%", "Ноябрь", "Ноябрь50%") |
| `AccountTypeCost` | decimal | Стоимость типа абонемента |
| `Annotation` | string? | Примечание |
| `Groups` | `<Item ID="UUID"/>` | Связанные группы (программы) |
| `Reservations` | `<Item/>` | Связанные бронирования (обычно пусто) |
| `BurnRes` | — | Сгоревшие бронирования |
| `Stages` | — | Этапы |
| `Visits` | `<Item Date="DD.MM.YYYY" ID_Group="UUID" Created="..."/>` | Посещения (визиты) |
| `Deposit` | `<Item ItemType="Pay\|WriteOff\|Debt\|Undebt" Sum="..." Time="..." PacketID="..."/>` | Движение средств |
| `Bonus` | — | Бонусы |

#### Атрибуты `<Item>` (обновления)

- `Updated` — строка вида `"N\|UserID\|ComputerID\|DD.MM.YYYY HH:MM:SS"` (N — версия, UserID/ComputerID — UUID)
- `Created` — аналогичный формат
- `Removed` — `"true"` если запись удалена

#### Пример записи

```xml
<Item Updated="12|910267f7-b5ae-4903-87da-ffbcf2a8a19f|EAC0-33CD-71B8-C168-4564-9ACE-85DF-7823|08.12.2020 20:34:09"
      Created="1|910267f7-b5ae-4903-87da-ffbcf2a8a19f|EAC0-33CD-71B8-C168-4564-9ACE-85DF-7823|21.02.2019 10:07:26">
  <ID>1d9533e1-e5f4-4078-a192-4ff4b403e6b5</ID>
  <Number>4</Number>
  <CreateDate>01.02.2019</CreateDate>
  <ID_Client>99aa0af5-3031-461b-9b01-f2e23d1169d1</ID_Client>
  <OriginalCost>1050</OriginalCost>
  <TrainingCount>4</TrainingCount>
  <BeginDate>01.02.2019</BeginDate>
  <DaysCount>60</DaysCount>
  <PaymentType>Cash</PaymentType>
  <AccountTypeName>1 со скидкой 5%</AccountTypeName>
  <AccountTypeCost>1050</AccountTypeCost>
  <Visits>
    <Item Created="27.02.2019 09:22:05" Date="01.02.2019" ID_Group="acb7cbef-77f7-4a76-8cf4-2f15e680b850" />
    <Item Created="04.03.2019 17:16:36" Date="04.03.2019" ID_Group="acb7cbef-77f7-4a76-8cf4-2f15e680b850" />
  </Visits>
  <Deposit>
    <Item ID="fd6579e1-467a-40b3-9f66-4243d020a1d8" Time="01.02.2019 10:13:14" ItemType="Pay" Sum="1050" UserID="910267f7-b5ae-4903-87da-ffbcf2a8a19f" ComputerID="EAC0-33CD-71B8-C168-4564-9ACE-85DF-7823" PaymentType="Cash" />
    <Item ID="131fbe05-17a7-4f8f-8713-4b1733ea0634" Time="01.02.2019 10:13:14" ItemType="WriteOff" Sum="1050" UserID="910267f7-b5ae-4903-87da-ffbcf2a8a19f" ComputerID="EAC0-33CD-71B8-C168-4564-9ACE-85DF-7823" />
  </Deposit>
</Item>
```

#### Связи

| Связь | Описание |
|---|---|
| `Account.ID_Client` → `Client.ID` | Абонемент принадлежит клиенту (многие к одному) |
| `Account.Visits[].ID_Group` → `Group.ID` | Визиты по абонементу привязаны к группам |
| `Account.Groups[].ID` → `Group.ID` | Группы, привязанные к абонементу |

#### Маппинг в PostgreSQL

| DanceStudio XML | → PG таблица | Поля | Изменения в схеме |
|---|---|---|---|
| Account | `user_subscriptions` | id (UUID), number, create_date, begin_date, days_count, is_perpetual, is_unlimited, training_count, free_training_count, payment_type, client_id, original_cost, discount, discount_percent, add_days_count, account_type_name, account_type_cost, annotation, removed | client_id — FK → users.id, removed — bool (soft delete) |
| Account.Visits | `user_visits` | id, account_id, visit_date, group_id, created_at | account_id — FK → user_subscriptions.id, group_id — FK → programs.id |
| Account.Deposit | `user_payments` | id, account_id, payment_type (Pay/WriteOff/Debt/Undebt), sum, payment_time, user_id, computer_id, payment_method | account_id — FK → user_subscriptions.id, payment_method — Cash/NonCash |
| Account.Groups | `subscription_groups` (pivot) | account_id, group_id | many-to-many |

---

### Entity: Charge (расходы/затраты)

**Root:** `<Charge>`
**Дочерние элементы:** `<Item>` (многократный)

#### Поля Item (категория расходов)

| Поле | Тип | Описание |
|---|---|---|
| `ID` | string (UUID) | Уникальный идентификатор |
| `Name` | string | Название категории (напр. "Реклама", "Уборка", "Аренда помещения", "Канцтовары", "Инвентарь", "стаканчики") |
| `Description` | string | Описание категории |
| `Annotation` | string? | Примечание |
| `Items` | `<Item ID="UUID" Name="..." Description="..." />` | Подкатегории (вложенные статьи расходов) |
| `Packets` | `<Item ID="..." Time="..." ItemID="UUID" Sum="..." Count="..." Annotation="..." />` | Записи расходов (фактические траты) |

#### Пример записи

```xml
<Item Updated="3|910267f7-b5ae-4903-87da-ffbcf2a8a19f|EAC0-33CD-71B8-C168-4564-9ACE-85DF-7823|24.03.2019 14:39:59"
      Created="1|910267f7-b5ae-4903-87da-ffbcf2a8a19f|EAC0-33CD-71B8-C168-4564-9ACE-85DF-7823|24.03.2019 14:38:58">
  <ID>b3840615-5efc-4445-999b-f8b189cb4e0d</ID>
  <Name>Уборка</Name>
  <Description>Затраты на уборку помещения и прилегающей территории</Description>
  <Items>
    <Item><ID>faff5a5f-f28e-4ef9-b825-6fe509558926</ID><Name>Зар. плата дворнику</Name></Item>
    <Item><ID>4ae4f1c3-65d7-4660-808c-597439dc8517</ID><Name>Зар. плата уборщице</Name></Item>
    <Item><ID>00f5881b-a4a8-4f1e-b07c-49926135b3e9</ID><Name>Вывоз мусора</Name></Item>
  </Items>
  <Packets>
    <Item><ID>9472699d-59c8-4ca3-870d-7cbe406a1690</ID><Time>24.03.2019 14:39:41</Time>
          <ItemID>4ae4f1c3-65d7-4660-808c-597439dc8517</ItemID><Sum>7000</Sum><Count>1</Count>
          <Annotation>мерим</Annotation></Item>
  </Packets>
</Item>
```

#### Связи

| Связь | Описание |
|---|---|
| `Charge.Packets[].ItemID` → `Charge.Items[].ID` | Запись расхода привязана к подкатегории |

#### Маппинг в PostgreSQL

| DanceStudio XML | → PG таблица | Поля | Изменения в схеме |
|---|---|---|---|
| Charge (категория) | `expense_categories` | id (UUID), name, description, annotation | Новая таблица |
| Charge.Items (подкатегория) | `expense_items` | id (UUID), name, description, category_id | category_id — FK → expense_categories.id |
| Charge.Packets | `expense_records` | id (UUID), time, item_id, sum, count, annotation, created_at | item_id — FK → expense_items.id |

---

### Entity: Product (товары/услуги)

**Root:** `<Product>`
**Дочерние элементы:** `<Item>` (многократный)

#### Поля

| Поле | Тип | Описание |
|---|---|---|
| `ID` | string (UUID) | Уникальный идентификатор |
| `Name` | string | Название товара (напр. "Полотенце аренда", "Виброплатформа", "носки") |
| `Barcode` | string? | Штрихкод |
| `Measurement` | string | Единица/измерение (напр. "50*100", "10 мин") |
| `Unit` | string | Единица измерения: `Piece` |
| `Status` | string | Статус: `Active` / `Closed` |
| `PurchaseCost` | decimal | Себестоимость |
| `Markup` | decimal | Наценка |
| `MarkupPercent` | decimal | Наценка в % |
| `Annotation` | string? | Примечание |
| `PurchasePackets` | `<Item Count="..." PurchaseCost="..." RetailCost="..." Paid="..." UserID="UUID" Time="..." />` | Пакеты закупок |
| `StoragePackets` | `<Item Count="..." PurchaseCost="..." RetailCost="..." ConnectedPacketID="UUID" UserID="UUID" Time="..." ProductWriteOff="..." />` | Пакеты хранения |
| `SalePackets` | `<Item Count="..." PurchaseCost="..." RetailCost="..." Paid="..." ClientID="UUID" ConnectedPacketID="UUID" UserID="UUID" Time="..." PaymentType="..." Discount="..." DiscountPercent="..." HasRefund="bool" />` | Пакеты продаж |
| `Deposit` | `<Item ItemType="Pay\|WriteOff\|Debt\|Undebt\|WriteOffCancel" Sum="..." Time="..." PacketID="UUID" UserID="..." ComputerID="..." />` | Движение средств |
| `Bonus` | — | Бонусы |

#### Пример записи

```xml
<Item Updated="36|910267f7-b5ae-4903-87da-ffbcf2a8a19f|670B-E878-DD76-F952-3316-7A51-88E7-9917|25.03.2026 18:18:56"
      Created="1|910267f7-b5ae-4903-87da-ffbcf2a8a19f|EAC0-33CD-71B8-C168-4564-9ACE-85DF-7823|26.02.2019 17:40:45">
  <ID>6e2133f2-9626-49e0-9d39-c3a7f8dd872f</ID>
  <Name>Полотенце аренда</Name>
  <Measurement>50*100</Measurement>
  <Unit>Piece</Unit>
  <Status>Active</Status>
  <PurchaseCost>40</PurchaseCost>
  <SalePackets>
    <Item Time="21.01.2021 20:39:36" Count="1" RetailCost="40" Paid="0"
          ClientID="5b61e30b-8b00-4cb3-8ce9-138485aa6992"
          ConnectedPacketID="42d039a2-e47a-4191-9d19-134d0b4e9cbc"
          UserID="25421898-cff8-4b1b-9861-0bd753b4db32" />
  </SalePackets>
  <Deposit>
    <Item ID="ef35b1b6-9a5c-4c3c-a838-9658ddcc8434" Time="21.01.2021 20:39:36" ItemType="WriteOff" Sum="40"
          UserID="25421898-cff8-4b1b-9861-0bd753b4db32" ComputerID="EAC0-33CD-71B8-C168-4564-9ACE-85DF-7823"
          PacketID="ebbbbe01-f4a0-4a71-8398-7e2f4155253b" />
  </Deposit>
</Item>
```

#### Связи

| Связь | Описание |
|---|---|
| `Product.SalePackets[].ClientID` → `Client.ID` | Продажи товаров клиентам (многие к одному) |
| `Product.SalePackets[].ConnectedPacketID` → `Product.StoragePackets[].ID` | Продажа связана с пакетом хранения |
| `Product.StoragePackets[].ConnectedPacketID` → `Product.PurchasePackets[].ID` | Хранение связано с пакетом закупки |

#### Маппинг в PostgreSQL

| DanceStudio XML | → PG таблица | Поля | Изменения в схеме |
|---|---|---|---|
| Product | `products` | id (UUID), name, barcode, measurement, unit, status, purchase_cost, markup, markup_percent, annotation | Новая таблица |
| Product.PurchasePackets | `product_purchase_batches` | id (UUID), time, count, purchase_cost, retail_cost, paid, user_id | product_id — FK → products.id |
| Product.StoragePackets | `product_storage_batches` | id (UUID), time, count, purchase_cost, retail_cost, connected_packet_id, user_id | product_id — FK → products.id, connected — self-ref |
| Product.SalePackets | `product_sales` | id (UUID), time, count, purchase_cost, retail_cost, paid, client_id, connected_packet_id, user_id, payment_type, discount, discount_percent, has_refund | product_id — FK → products.id, client_id — FK → users.id |
| Product.Deposit | `product_deposit` | id, product_id, item_type, sum, time, user_id, computer_id, packet_id | product_id — FK → products.id |

---

### Entity: Reservation (бронирования/записи)

**Root:** `<Reservation>`
**Дочерние элементы:** `<Item>` (многократный)

#### Поля

| Поле | Тип | Описание |
|---|---|---|
| `ID` | string (UUID) | Уникальный идентификатор |
| `ID_Status` | string (UUID) | Статус бронирования |
| `ReservationType` | string | Тип: `Group` |
| `ClientType` | string | `NewClient` / `ExistClient` |
| `ID_Client` | string (UUID)? | Ссылка на клиента (если ExistClient) |
| `LastName` | string | Фамилия |
| `Name` | string? | Имя |
| `MiddleName` | string? | Отчество |
| `BirthDate` | string (DD.MM.YYYY)? | Дата рождения |
| `ParentLastName` | string? | Фамилия родителя |
| `ParentMobilePhone1` | string? | Телефон родителя |
| `MobilePhone1` | string? | Телефон клиента |
| `Time` | string (DD.MM.YYYY HH:MM:SS) | Дата и время записи |
| `ID_Group` | string (UUID)? | Ссылка на группу |
| `Informers` | — | Источники информирования (обычно пусто) |
| `Tags` | — | Теги |
| `Schedule` | — | Расписание |
| `Comments` | — | Комментарии |
| `Tasks` | — | Задачи/миссии |
| `StatusChanges` | `<Item ID="UUID" ID_Creator="UUID" ID_Status="UUID" Created="..."/>` | История изменений статусов |

#### Пример записи

```xml
<Item Updated="6|910267f7-b5ae-4903-87da-ffbcf2a8a19f|EAC0-33CD-71B8-C168-4564-9ACE-85DF-7823|28.03.2021 16:49:39"
      Created="1|910267f7-b5ae-4903-87da-ffbcf2a8a19f|EAC0-33CD-71B8-C168-4564-9ACE-85DF-7823|26.03.2021 14:41:40">
  <ID>02be6073-eb43-4c7b-892a-f72b2e2a7070</ID>
  <ID_Status>60ce10f1-e5cd-4f5a-96fd-ca4e23974946</ID_Status>
  <ReservationType>Group</ReservationType>
  <ClientType>ExistClient</ClientType>
  <ID_Client>ca1b6c84-7d39-489a-95da-8aca55672e8b</ID_Client>
  <LastName>Кокошинская Наталья</LastName>
  <Time>28.03.2021 16:00:00</Time>
  <ID_Group>e217989a-91ec-4ab2-b951-8add5783a362</ID_Group>
  <MobilePhone1>89089117470</MobilePhone1>
  <StatusChanges>
    <Item ID="a58a3ec9-6eca-41cf-a1a5-b62a36698388" ID_Creator="910267f7-b5ae-4903-87da-ffbcf2a8a19f" ID_Status="ad0119c1-3708-486e-8994-93285fa651f9" Created="26.03.2021 14:43:38" />
    <Item ID="5f4a197b-35e2-445f-98eb-36c7ed2a5ebf" ID_Creator="00000000-0000-0000-0000-000000000000" ID_Status="60ce10f1-e5cd-4f5a-96fd-ca4e23974946" Created="28.03.2021 16:49:38" />
  </StatusChanges>
</Item>
```

#### Связи

| Связь | Описание |
|---|---|
| `Reservation.ID_Client` → `Client.ID` | Бронирование принадлежит клиенту (многие к одному) |
| `Reservation.ID_Group` → `Group.ID` | Бронирование на группу (многие к одному) |
| `Reservation.ID_Status` → `ReservationStatus.ID` | Статус бронирования |
| `Reservation.StatusChanges[].ID_Creator` → `User.ID` | Кто создал изменение статуса |
| `Reservation.StatusChanges[].ID_Status` → `ReservationStatus.ID` | Статус в момент изменения |

#### Маппинг в PostgreSQL

| DanceStudio XML | → PG таблица | Поля | Изменения в схеме |
|---|---|---|---|
| Reservation | `reservations` | id (UUID), id_status, reservation_type, client_type, id_client, last_name, name, middle_name, birth_date, parent_last_name, parent_mobile_phone1, mobile_phone1, time, id_group, comments | id_client — FK → users.id, id_group — FK → programs.id, id_status — FK → reservation_statuses.id |
| Reservation.StatusChanges | `reservation_status_history` | id (UUID), reservation_id, id_creator, id_status, created_at | reservation_id — FK → reservations.id, id_creator — FK → users.id, id_status — FK → reservation_statuses.id |

---

## Сводка связей между сущностями D1.2

| Связь | Описание |
|---|---|
| `Account.ID_Client` → `Client.ID` | Абонемент принадлежит клиенту (многие к одному) |
| `Account.Visits[].ID_Group` → `Group.ID` | Визиты по абонементу привязаны к группам |
| `Account.Groups[].ID` → `Group.ID` | Группы, привязанные к абонементу |
| `Reservation.ID_Client` → `Client.ID` | Бронирование принадлежит клиенту |
| `Reservation.ID_Group` → `Group.ID` | Бронирование на группу |
| `Reservation.ID_Status` → `ReservationStatus.ID` | Статус бронирования |
| `Reservation.StatusChanges[].ID_Creator` → `User.ID` | Кто изменил статус |
| `Reservation.StatusChanges[].ID_Status` → `ReservationStatus.ID` | Новый статус |
| `Product.SalePackets[].ClientID` → `Client.ID` | Продажи товаров клиентам |
| `Product.SalePackets[].ConnectedPacketID` → `Product.StoragePackets[].ID` | Продажа → пакет хранения |
| `Product.StoragePackets[].ConnectedPacketID` → `Product.PurchasePackets[].ID` | Хранение → пакет закупки |
| `Charge.Packets[].ItemID` → `Charge.Items[].ID` | Запись расхода → подкатегория |

## Итого новых таблиц для PG (из D1.2)

| # | PG таблица | Источник XML | Описание |
|---|---|---|---|
| 1 | `user_subscriptions` | Account | Абонементы клиентов |
| 2 | `user_visits` | Account.Visits | Посещения по абонементу |
| 3 | `user_payments` | Account.Deposit | Движение средств по абонементу |
| 4 | `subscription_groups` | Account.Groups | Many-to-many: абонемент ↔ программа |
| 5 | `expense_categories` | Charge | Категории расходов |
| 6 | `expense_items` | Charge.Items | Подкатегории расходов |
| 7 | `expense_records` | Charge.Packets | Фактические расходы |
| 8 | `products` | Product | Товары/услуги |
| 9 | `product_purchase_batches` | Product.PurchasePackets | Пакеты закупок |
| 10 | `product_storage_batches` | Product.StoragePackets | Пакеты хранения |
| 11 | `product_sales` | Product.SalePackets | Пакеты продаж |
| 12 | `product_deposit` | Product.Deposit | Движение средств по товарам |
| 13 | `reservations` | Reservation | Бронирования/записи |
| 14 | `reservation_status_history` | Reservation.StatusChanges | История статусов бронирований |

---

## Тикет D1.1: Client, Teacher, Group, SingleTraining

### Entity: Client
**Root:** `<Client>`  
**Файлы:** `Client.xml`, `Client001.xml` (партиционированные данные)  
**Записей:** 18 286 (Client.xml: 17 556 + Client001.xml: 730), удалённых: 647
**Объём:** ~5 957 KB (5.8 MB)

**Fields:**
| Поле | Тип | Описание |
|---|---|---|
| `ID` | UUID | Уникальный идентификатор |
| `BirthDate` | string (dd.mm.yyyy)? | Дата рождения (не у всех) |
| `ID_Sex` | UUID | Ссылка на Sex (Style.xml) |
| `ID_Status` | UUID? | Ссылка на статус клиента |
| `AgreementNumber` | int | Номер договора |
| `Barcode` | string? | Штрихкод (часто пустой) |
| `Archive` | boolean | Архив (True/False) |
| `MobilePhone1` | string | Телефон 1 |
| `MobilePhone2` | string? | Телефон 2 (редко) |
| `LastName` | string | Фамилия и имя (слитно) |
| `Name` | string? | Имя (редко, чаще в LastName) |
| `MiddleName` | string? | Отчество (редко) |
| `Email` | string? | Email |
| `ID_Foto` | UUID? | Ссылка на фото (Files/) |
| `ID_Friend` | UUID? | Реферал (ID другого клиента) |
| `ParentMobilePhone1` | string? | Телефон родителя (для детей) |
| `ParentMobilePhone2` | string? | Телефон родителя 2 |
| `ParentLastName` | string? | Фамилия родителя |
| `ParentName` | string? | Имя родителя (только в Client001.xml) |
| `ParentMiddleName` | string? | Отчество родителя |
| `Annotation` | string? | Аннотация |
| `Deposit` | nested array | История баланса клиента |
| `Bonus` | nested array | Бонусы |
| `Comments` | nested array | Комментарии |
| `Tasks` | nested array | Задачи |
| `StatusChanges` | nested array | История статусов |
| `Files` | nested array | Файлы |
| `Tags` | nested array | Теги (ID_Tag) |
| `Informers` | nested array | Источники (ID_Informer) |
| `CardUses` | empty | Использования карты (пусто) |
| `Updated` | attr | Метка обновления (Item attr) |
| `Created` | attr | Метка создания (Item attr) |
| `Removed` | attr | Пометка удаления (Item attr) |

**Deposit (вложенная структура):**
| Поле | Тип | Описание |
|---|---|---|
| `ID` | UUID | Уникальный ID записи |
| `Time` | string (dd.mm.yyyy HH:MM:SS) | Время операции |
| `ItemType` | enum | In / Out / WriteOff / WriteOffCancel / Pay / Debt / Undebt |
| `Sum` | decimal | Сумма |
| `UserID` | UUID | ID пользователя |
| `ComputerID` | string | ID компьютера |
| `PaymentType` | string | Cash / NonCash |
| `Annotation` | string? | Комментарий к операции |

**Relations:**
- `has many` Deposit (баланс)
- `has many` Comments
- `has many` Tasks
- `has many` Tags (m2m через Tag.xml)
- `has many` Informers (m2m)
- `has many` SingleTraining (через ID_Client)
- `has many` Account (через ID_Client)
- `has many` Product (через ID_Client)
- `has many` Reservation (через ID_Client)
- `has many` IndividualAccount (через ID_Client)
- `has many` IndividualTraining (через ID_Client)
- `has many` Rent (через ID_Client)
- `has many` RentAccount (через ID_Client)
- `belongs to` Sex (через ID_Sex)
- `belongs to` Status (через ID_Status)
- `belongs to` Client (ID_Friend — реферал, self-ref)

**Example:**
```xml
<Item Updated="28|910267f7-...|670B-E878-...|24.07.2026 18:14:45"
      Created="1|910267f7-...|EAC0-33CD-...|17.02.2019 18:12:52">
  <ID>c2e849e7-10c2-41ff-9f92-cb0fe8f61ebb</ID>
  <BirthDate>14.06.1973</BirthDate>
  <ID_Sex>87364c6f-a6d3-483f-931e-84b6a8b8d8d2</ID_Sex>
  <ID_Foto>a26ef15a-f4fb-4763-ad0b-35d8d2ef6269</ID_Foto>
  <AgreementNumber>3</AgreementNumber>
  <MobilePhone1>89530535396</MobilePhone1>
  <LastName>Абдулина Наталья</LastName>
  <Deposit>
    <Item ID="a1b50a76-26e9-42cc-83c3-832716045ac0" Time="31.03.2023 18:36:15"
          ItemType="In" Sum="1480" UserID="910267f7-..."
          ComputerID="EAC0-..." PaymentType="Cash" />
    <Item ID="40ef46d7-..." Time="21.04.2023 16:07:02" ItemType="In" Sum="1400" Annotation="%" />
    ...
  </Deposit>
</Item>
```

**Новые поля (Client001.xml):**
- `ParentName` — имя родителя (отсутствует в Client.xml)
- `ID_Status` — ссылка на статус (обновляется через атрибут Updated)
- `Barcode Updated="..."` — штрихкод с меткой обновления на элементе

### Entity: Teacher
**Root:** `<Teacher>`  
**Файлы:** `Teacher.xml`  
**Записей:** 30, удалённых: 4
**Объём:** ~115 KB

**Fields:**
| Поле | Тип | Описание |
|---|---|---|
| `ID` | UUID | Уникальный идентификатор |
| `LastName` | string | Фамилия |
| `Name` | string? | Имя (часто пустой) |
| `MiddleName` | string? | Отчество (часто пустой) |
| `ID_Foto` | UUID? | Ссылка на фото |
| `BirthDate` | string (dd.mm.yyyy)? | Дата рождения |
| `MobilePhone1` | string | Телефон |
| `OwnSalaryOptions` | boolean | Собственные настройки зарплаты |
| `Status` | enum | Active / Closed |
| `ID_Sex` | UUID | Ссылка на Sex |
| `SalaryOptions` | nested | Настройки зарплаты (GroupOptions + RangePays) |
| `Styles` | nested array | Стили преподавания |
| `Updated` | attr | Метка обновления |
| `Created` | attr | Метка создания |
| `Removed` | attr | Пометка удаления |

**SalaryOptions.GroupOptions (вложенная структура):**
| Поле | Тип | Описание |
|---|---|---|
| `Type` | enum | VisitsCountSum / Fixed / Percent / None |
| `FixedPay` | decimal | Фиксированная оплата |
| `AccountPercent` | decimal | Процент от абонемента |
| `AccountSelectType` | enum | ByCreateDate / ... |
| `AccountCostWithDiscount` | boolean | Учитывать скидку в стоимости |
| `AccountCostDivide` | boolean | Делить стоимость по дням |
| `AccountCostDivideDays` | int | Количество дней для деления |
| `AccountCostDivideExtend` | boolean | Продлевать при делении |
| `AccountPayForUngroupVisits` | boolean | Платить за внегрупповые визиты |
| `AccountPayForUngroupVisitsSum` | decimal | Сумма за внегрупповые визиты |
| `AccountPayForSingleTrainings` | boolean | Платить за индивидуальные |
| `AccountPayForSingleTrainingsPercent` | decimal | Процент за индивидуальные |
| `AccountIncludeFreeSingles` | boolean | Включать бесплатные |
| `VisitPercent` | decimal | Процент за посещение |
| `VisitSinglePercent` | decimal | Процент за индивидуальное |
| `VisitPayByUnlimitedAccount` | boolean | Оплата по безлимитному абонементу |
| `VisitPayByUnlimitedAccountSum` | decimal | Сумма для безлимитного |
| `MinTeacherPay` | decimal | Минимальная зарплата |
| `IncludeFreeSingles` | boolean | Включать бесплатные визиты |
| `UseScheduleForSalary` | boolean | Использовать расписание для зарплаты |
| `RangePays` | nested array | Пооплатные диапазоны (From, To, PayType, Pay) |

**Relations:**
- `has many` Group (через ID_Teacher)
- `has many` SingleTraining (косвенно через Group)
- `belongs to` Sex (через ID_Sex)
- `has many` Styles (m2m)

**Example:**
```xml
<Item Updated="18|910267f7-...|670B-E878-...|04.07.2026 00:31:14"
      Created="1|910267f7-...|EAC0-33CD-...|15.02.2019 22:19:45">
  <ID>cd494897-e097-4dc4-bd9d-37bb76005c51</ID>
  <LastName>Кравец Оксана Борисовна</LastName>
  <BirthDate>19.12.1969</BirthDate>
  <MobilePhone1>89222266659</MobilePhone1>
  <Status>Active</Status>
  <ID_Sex>87364c6f-a6d3-483f-931e-84b6a8b8d8d2</ID_Sex>
  <OwnSalaryOptions>True</OwnSalaryOptions>
  <SalaryOptions>
    <GroupOptions>
      <Type>VisitsCountSum</Type>
      <FixedPay>300</FixedPay>
      <AccountPercent>50</AccountPercent>
      <VisitPercent>50</VisitPercent>
      <RangePays>
        <Item><ID>93b3e912-...</ID><From>1</From><To>1</To><PayType>Fixed</PayType><Pay>200</Pay></Item>
        <Item><ID>373031a5-...</ID><From>2</From><To>2</To><PayType>Fixed</PayType><Pay>400</Pay></Item>
        ...
      </RangePays>
    </GroupOptions>
  </SalaryOptions>
</Item>
```

**Новые поля (по сравнению с предыдущей версией):**
- `AccountSelectType` — тип выбора абонемента
- `AccountCostWithDiscount` — учитывать скидку
- `AccountCostDivide` — делить стоимость по дням
- `AccountCostDivideDays` — количество дней
- `AccountCostDivideExtend` — продлевать
- `AccountPayForUngroupVisits` — оплата за внегрупповые
- `AccountPayForSingleTrainings` — оплата за индивидуальные
- `VisitSinglePercent` — процент за индивидуальное
- `VisitPayByUnlimitedAccount` — оплата по безлимитному
- `VisitPayByUnlimitedAccountSum` — сумма для безлимитного
- `MinTeacherPay` — минимальная зарплата
- `IncludeFreeSingles` — включать бесплатные
- `UseScheduleForSalary` — использовать расписание

### Entity: Group
**Root:** `<Group>`  
**Файлы:** `Group.xml`  
**Записей:** 157, удалённых: 34
**Объём:** ~1 427 KB

**Fields:**
| Поле | Тип | Описание |
|---|---|---|
| `ID` | UUID | Уникальный идентификатор |
| `Colour` | string | Цвет (AARRGGBB, напр. FF000080) |
| `Status` | string | Admission / Closed / и т.д. |
| `ID_Style` | UUID | Ссылка на стиль |
| `ID_Teacher` | UUID | Ссылка на преподавателя |
| `OwnSalaryOptions` | boolean | Собственные настройки зарплаты |
| `OwnSecondSalaryOptions` | boolean | Вторые настройки зарплаты |
| `SalaryOptions` | nested | Основные настройки зарплаты |
| `SecondSalaryOptions` | nested | Вторые настройки зарплаты |
| `Schedule` | nested array | Расписание |
| `Clients` | nested array | Клиенты группы |
| `Updated` | attr | Метка обновления |
| `Created` | attr | Метка создания |

**SalaryOptions.GroupOptions** — аналогично Teacher, те же поля.

**Schedule (вложенная структура):**
| Поле | Тип | Описание |
|---|---|---|
| `Day` | enum | Monday/Tuesday/Wednesday/Thursday/Friday/Saturday/Sunday |
| `Time.From` | string | Время начала (HH:MM) |
| `Time.To` | string | Время окончания (HH:MM) |
| `ID_Hall` | UUID | Ссылка на зал |
| `Frequency` | enum | Regular / Single |
| `Range.From` | string | Дата начала периода |
| `Range.To` | string? | Дата окончания периода |
| `Date` | string | Базовая дата |

**Relations:**
- `belongs to` Teacher (через ID_Teacher)
- `belongs to` Style (через ID_Style)
- `belongs to` Hall (через ID_Hall в Schedule)
- `has many` SingleTraining (через ID_Group)
- `has many` Client (через Clients)
- `has many` IndividualTraining (через ID_Group)
- `has many` Substitute (через ID_Group)

**Example:**
```xml
<Item Updated="45|910267f7-...|670B-E878-...|14.05.2026 09:20:09"
      Created="1|910267f7-...|EAC0-33CD-...|17.02.2019 18:36:03">
  <ID>1b2f30ef-0a21-47c4-81cd-cc60a3c24d7f</ID>
  <Colour>FF000080</Colour>
  <Status>Admission</Status>
  <ID_Style>a71bf4fd-5fff-41f0-80b2-1b6d9d24bc58</ID_Style>
  <ID_Teacher>4f213aa3-32d5-47fd-a709-b5560e3c965a</ID_Teacher>
  <OwnSalaryOptions>True</OwnSalaryOptions>
  <OwnSecondSalaryOptions>False</OwnSecondSalaryOptions>
  <SalaryOptions>
    <GroupOptions>
      <Type>VisitsCountSum</Type>
      <FixedPay>300</FixedPay>
      <AccountPercent>50</AccountPercent>
      <RangePays>
        <Item><ID>93b3e912-...</ID><From>1</From><To>1</To><PayType>Fixed</PayType><Pay>250</Pay></Item>
        ...
      </RangePays>
    </GroupOptions>
  </SalaryOptions>
  <Schedule>
    <Item>
      <Day>Saturday</Day>
      <Time><From>16:00</From><To>17:25</To></Time>
      <ID_Hall>a3e4bd6e-0478-422d-93b0-ae554e6d3715</ID_Hall>
      <Frequency>Regular</Frequency>
      <Range><From>01.10.2022</From><To>24.12.2022</To></Range>
    </Item>
  </Schedule>
  <Clients />
</Item>
```

### Entity: SingleTraining
**Root:** `<SingleTraining>`  
**Файлы:** `SingleTraining.xml` + `SingleTraining001.xml` – `SingleTraining014.xml` (партиционированные, 15 файлов суммарно)  
**Записей:** 12 400 только в основном файле (15 файлов суммарно ~15 000+)
**Объём основного файла:** ~5 169 KB

**Fields:**
| Поле | Тип | Описание |
|---|---|---|
| `ID` | UUID | Уникальный идентификатор |
| `VisitDate` | string (dd.mm.yyyy) | Дата визита |
| `PaymentType` | enum | Cash / NonCash |
| `ID_Client` | UUID | Ссылка на клиента |
| `ID_Group` | UUID | Ссылка на группу |
| `Cost` | decimal | Стоимость визита |
| `SingleTrainingTypeName` | string | Название типа занятия (напр. "1", "1/1 5%", "1,5") |
| `SingleTrainingTypeCost` | decimal | Стоимость типа |
| `Deposit` | nested array | История оплаты визита |
| `Bonus` | nested array | Бонусы |
| `Updated` | attr | Метка обновления |
| `Created` | attr | Метка создания |
| `Removed` | attr | Пометка удаления |

**Deposit (вложенная структура):**
| Поле | Тип | Описание |
|---|---|---|
| `ID` | UUID | Уникальный ID |
| `Time` | string (dd.mm.yyyy HH:MM:SS) | Время операции |
| `ItemType` | enum | Pay / WriteOff / Debt / Undebt |
| `Sum` | decimal | Сумма |
| `UserID` | UUID | ID пользователя |
| `ComputerID` | string | ID компьютера |
| `PaymentType` | string | Cash / NonCash |

**Relations:**
- `belongs to` Client (через ID_Client)
- `belongs to` Group (через ID_Group)
- `has many` Deposit

**Example:**
```xml
<Item Updated="5|910267f7-...|EAC0-33CD-...|09.03.2019 11:16:55"
      Created="1|910267f7-...|EAC0-33CD-...|26.02.2019 14:57:31"
      Removed="true">
  <ID>36a18d35-8fef-4f76-96a3-3292b091bdd8</ID>
  <VisitDate>03.02.2019</VisitDate>
  <PaymentType>Cash</PaymentType>
  <ID_Client>b0ba485e-3ed5-4f64-8bad-011a8cede69f</ID_Client>
  <ID_Group>3dfbbe5d-99dd-4071-9ab0-79c843af11ba</ID_Group>
  <Cost>350</Cost>
  <SingleTrainingTypeName>1</SingleTrainingTypeName>
  <SingleTrainingTypeCost>350</SingleTrainingTypeCost>
  <Deposit>
    <Item ID="ed0be11a-..." Time="03.02.2019 15:17:39" ItemType="Pay" Sum="350"
          UserID="910267f7-..." ComputerID="EAC0-..." PaymentType="Cash" />
    <Item ID="0da7d609-..." Time="03.02.2019 15:17:39" ItemType="WriteOff" Sum="350" />
  </Deposit>
</Item>
```

**Ключевые наблюдения D1.1 (обновлённые):**
1. **Крупный объём данных:** Client — 18 286 записей (5.8 MB), SingleTraining — 12 400 записей в одном файле (5.2 MB). Импорт потребует пакетной обработки.
2. **Партиционирование Client:** 2 файла — Client.xml (17 556 записей, 2019-2023) и Client001.xml (730 записей, 2024-2026). Новые клиенты в партиции 001.
3. **Партиционирование SingleTraining:** 15 файлов (основной + 14 партиций). Необходимо объединять при чтении.
4. **Удалённые записи:** Client — 647, Teacher — 4, Group — 34, SingleTraining — 323. Фильтровать по `Removed="true"`.
5. **Updated/Created атрибуты:** формат `N\|UserID\|ComputerID\|DD.MM.YYYY HH:MM:SS`. N — версия. Нужны для синхронизации (LastSave).
6. **Updated на дочерних элементах:** `BirthDate Updated="..."`, `ID_Foto Updated="..."` — обновление конкретных полей, важно для инкрементальной синхронизации.
7. **ID_Foto:** UUID-ссылки на папки в `Files/` — привязка к тикету D6 (440 папок с фото).
8. **Deposit:** встроенные финансовые транзакции — In (пополнение), Out (списание), WriteOff (списание), Debt/Undebt (долг).
9. **SalaryOptions:** сложная вложенная структура GroupOptions + RangePays для расчёта зарплаты преподавателей. GroupOptions содержит 19+ полей. RangePays — пооплатные диапазоны (от 1 до 12+ занятий).
10. **ParentName:** новое поле в Client001.xml для родителей детей.
11. **ID_Status:** статус клиента, обновляется через атрибут Updated.
12. **Cost с запятой:** `Cost>262,5</Cost>` — decimal с запятой вместо точки (русский формат).
13. **Empty элементы:** `<CardUses />`, `<Informers />`, `<Tags />`, `<Files />` — всегда пустые в текущих данных.

---

## Тикет D1.3: IndividualAccount, IndividualTraining, Hall, Rent, RentAccount, DayBalance

**Статус:** ✅ Прочитано и утверждено
**Файлы:** `IndividualAccount.xml`, `IndividualTraining.xml`, `Hall.xml`, `Rent.xml`, `RentAccount.xml`, `DayBalance.xml`

---

### Entity: IndividualAccount (индивидуальные абонементы)

**Файл:** `IndividualAccount.xml` — ~28 записей
**Root:** `<IndividualAccount>`
**Дочерние элементы:** `<Item>` (многократный)

#### Поля

| Поле | Тип | Описание |
|---|---|---|
| `ID` | string (UUID) | Уникальный идентификатор абонемента |
| `Number` | int | Порядковый номер абонемента |
| `CreateDate` | string (DD.MM.YYYY) | Дата создания абонемента |
| `ID_Style` | string (UUID)? | Ссылка на стиль (Style.xml) |
| `ID_Teacher` | string (UUID)? | Ссылка на преподавателя (Teacher.xml) |
| `ID_Client` | string (UUID) | Ссылка на клиента (Client.xml) |
| `OriginalCost` | decimal | Исходная стоимость абонемента |
| `Discount` | decimal | Сумма скидки |
| `DiscountPercent` | decimal | Процент скидки |
| `TrainingCount` | int | Общее количество занятий в абонементе |
| `FreeTrainingCount` | int | Количество бесплатных занятий |
| `BeginDate` | string (DD.MM.YYYY)? | Дата начала действия |
| `DaysCount` | int? | Количество дней действия |
| `AddDaysCount` | int | Дополнительные дни |
| `IsPerpetual` | bool | Бессрочный абонемент |
| `IsUnlimited` | bool | Неограниченный абонемент |
| `PaymentType` | string | Тип оплаты: `Cash` / `NonCash` |
| `AccountTypeName` | string | Название типа абонемента (напр. «Стандарт») |
| `AccountTypeCost` | decimal | Стоимость типа абонемента |
| `Colour` | string (hex)? | Цвет для визуализации |
| `Schedule` | empty | Расписание (не используется для IndividualAccount) |
| `Stages` | empty | Этапы |
| `Visits` | `<Item Date="DD.MM.YYYY" ID_Teacher="UUID" Created="..."/>` | Посещения (визиты) |
| `Deposit` | `<Item ItemType="Pay\|WriteOff\|Debt\|Undebt" Sum="..." Time="..." UserID="..." ComputerID="..." PaymentType="..." VisitID="..."/>` | Движение средств |
| `Bonus` | empty | Бонусы |

#### Атрибуты `<Item>` (обновления)

- `Updated` — строка вида `"N\|UserID\|ComputerID\|DD.MM.YYYY HH:MM:SS"` (N — версия, UserID/ComputerID — UUID)
- `Created` — аналогичный формат
- `Removed` — `"true"` если запись удалена

#### Пример записи

```xml
<Item Updated="23|910267f7-b5ae-4903-87da-ffbcf2a8a19f|EAC0-33CD-71B8-C168-4564-9ACE-85DF-7823|24.10.2020 20:04:24"
      Created="1|910267f7-b5ae-4903-87da-ffbcf2a8a19f|EAC0-33CD-71B8-C168-4564-9ACE-85DF-7823|19.02.2019 22:06:29">
  <ID>389af946-9188-4c80-8de3-84ea2fb86e4d</ID>
  <Number>1</Number>
  <CreateDate>14.02.2019</CreateDate>
  <ID_Style>010f2246-4942-49d4-8844-226a88a5a33d</ID_Style>
  <ID_Teacher>4f213aa3-32d5-47fd-a709-b5560e3c965a</ID_Teacher>
  <ID_Client>2e093c4f-64a8-4e8a-a8e5-5f3630d565ae</ID_Client>
  <OriginalCost>18000</OriginalCost>
  <Discount>0</Discount>
  <DiscountPercent>0</DiscountPercent>
  <TrainingCount>10</TrainingCount>
  <FreeTrainingCount>1</FreeTrainingCount>
  <BeginDate>14.02.2019</BeginDate>
  <DaysCount>60</DaysCount>
  <AddDaysCount>0</AddDaysCount>
  <IsPerpetual>False</IsPerpetual>
  <IsUnlimited>False</IsUnlimited>
  <PaymentType>Cash</PaymentType>
  <AccountTypeName>Стандарт</AccountTypeName>
  <AccountTypeCost>18000</AccountTypeCost>
  <Colour>FF000080</Colour>
  <Visits>
    <Item Created="26.02.2019 14:43:53" Date="14.02.2019" ID_Teacher="4f213aa3-32d5-47fd-a709-b5560e3c965a" />
    <Item Created="26.02.2019 14:43:53" Date="19.02.2019" ID_Teacher="4f213aa3-32d5-47fd-a709-b5560e3c965a" />
    <Item Created="26.02.2019 14:43:53" Date="21.02.2019" ID_Teacher="4f213aa3-32d5-47fd-a709-b5560e3c965a" />
    ...
  </Visits>
  <Deposit>
    <Item ID="bc350517-1467-4bdf-a6ae-a71e73921d67" Time="14.02.2019 22:08:38" ItemType="Pay" Sum="18000" 
          UserID="910267f7-b5ae-4903-87da-ffbcf2a8a19f" ComputerID="EAC0-33CD-71B8-C168-4564-9ACE-85DF-7823" PaymentType="Cash" />
    <Item ID="1873341f-6944-48e8-8ae4-ba34a05db6c3" Time="14.02.2019 22:08:38" ItemType="WriteOff" Sum="18000" ... />
  </Deposit>
</Item>
```

#### Связи

| Связь | Описание |
|---|---|
| `IndividualAccount.ID_Client` → `Client.ID` | Абонемент принадлежит клиенту (многие к одному) |
| `IndividualAccount.ID_Teacher` → `Teacher.ID` | Абонемент привязан к преподавателю |
| `IndividualAccount.ID_Style` → `Style.ID` | Абонемент привязан к стилю |
| `IndividualAccount.Visits[].ID_Teacher` → `Teacher.ID` | Визит привязан к преподавателю |

#### Маппинг в PostgreSQL

| DanceStudio XML | → PG таблица | Поля | Изменения в схеме |
|---|---|---|---|
| IndividualAccount | `user_subscriptions` | id (UUID), number, create_date, begin_date, days_count, is_perpetual, is_unlimited, training_count, free_training_count, payment_type, client_id, original_cost, discount, discount_percent, add_days_count, account_type_name, account_type_cost, colour, style_id, removed | client_id — FK → users.id, style_id — FK → styles.id, removed — bool (soft delete) |
| IndividualAccount.Visits | `user_visits` | id, subscription_id, visit_date, teacher_id, created_at | subscription_id — FK → user_subscriptions.id, teacher_id — FK → trainers.id |
| IndividualAccount.Deposit | `user_payments` | id, subscription_id, payment_type (Pay/WriteOff/Debt/Undebt), sum, payment_time, user_id, computer_id, payment_method, visit_id | subscription_id — FK → user_subscriptions.id, visit_id — FK → user_visits.id |

---

### Entity: IndividualTraining (индивидуальные занятия)

**Файл:** `IndividualTraining.xml` — ~30+ записей
**Root:** `<IndividualTraining>`
**Дочерние элементы:** `<Item>` (многократный)

#### Поля

| Поле | Тип | Описание |
|---|---|---|
| `ID` | string (UUID) | Уникальный идентификатор |
| `ID_Client` | string (UUID) | Ссылка на клиента |
| `ID_Style` | string (UUID)? | Ссылка на стиль |
| `ID_Teacher` | string (UUID) | Ссылка на преподавателя |
| `Prepayment` | decimal | Предоплата/стоимость занятия |
| `PaymentType` | string | Тип оплаты (Cash) |
| `IndividualTrainingTypeName` | string | Тип (напр. «Стандарт») |
| `IndividualTrainingTypeCost` | decimal | Стоимость типа |
| `Colour` | string (hex)? | Цвет |
| `Schedule` | `<Item Day="Mon\|Tue\|..." Time.From="HH:MM" Time.To="HH:MM" ID_Hall="UUID" Frequency="Regular\|Single" Range.From="DD.MM.YYYY" Range.To="DD.MM.YYYY"? Date="DD.MM.YYYY"/>`? | Расписание |
| `Visits` | `<Item ID="UUID" Created="..." Date="DD.MM.YYYY" Name="..." Cost="..." TeacherPay="..."/>` | Посещения |
| `Deposit` | `<Item ItemType="Pay\|WriteOff\|Debt\|Undebt" Sum="..." Time="..." UserID="..." ComputerID="..." VisitID="UUID"/>` | Движение средств |
| `Bonus` | empty | Бонусы |

#### Связи

| Связь | Описание |
|---|---|
| `IndividualTraining.ID_Client` → `Client.ID` | Занятие принадлежит клиенту |
| `IndividualTraining.ID_Teacher` → `Teacher.ID` | Занятие с преподавателем |
| `IndividualTraining.ID_Style` → `Style.ID` | Занятие по стилю |
| `IndividualTraining.Schedule[].ID_Hall` → `Hall.ID` | Расписание привязано к залу |

#### Маппинг в PostgreSQL

| DanceStudio XML | → PG таблица | Поля | Изменения в схеме |
|---|---|---|---|
| IndividualTraining | `individual_sessions` | id (UUID), client_id, style_id, teacher_id, prepayment, payment_type, training_type_name, training_type_cost, colour, removed | client_id — FK → users.id, teacher_id — FK → trainers.id, style_id — FK → styles.id |
| IndividualTraining.Schedule | `individual_session_schedules` | id, session_id, day, time_from, time_to, hall_id, frequency, range_from, range_to, base_date | session_id — FK → individual_sessions.id, hall_id — FK → halls.id |
| IndividualTraining.Visits | `individual_session_visits` | id (UUID), session_id, visit_date, name, cost, teacher_pay, created_at | session_id — FK → individual_sessions.id |
| IndividualTraining.Deposit | `individual_session_payments` | id, session_id, payment_type (Pay/WriteOff/Debt/Undebt), sum, payment_time, user_id, computer_id, visit_id | session_id — FK → individual_sessions.id, visit_id — FK → individual_session_visits.id |

---

### Entity: Hall (залы)

**Файл:** `Hall.xml` — 2 записи
**Root:** `<Hall>`
**Дочерние элементы:** `<Item>` (многократный)

#### Поля

| Поле | Тип | Описание |
|---|---|---|
| `ID` | string (UUID) | Уникальный идентификатор зала |
| `Name` | string | Название зала («БОЛЬШОЙ ЗАЛ», «МАЛЫЙ ЗАЛ») |
| `Status` | string? | Статус: `Active` или отсутствует (= неактивен) |

#### Пример

```xml
<Item ID="a3e4bd6e-0478-422d-93b0-ae554e6d3715" Name="БОЛЬШОЙ ЗАЛ" Status="Active"/>
<Item ID="427ce918-0289-4317-81fd-909c64200f77" Name="МАЛЫЙ ЗАЛ"/>
```

#### Маппинг в PostgreSQL

| DanceStudio XML | → PG таблица | Поля | Изменения в схеме |
|---|---|---|---|
| Hall | `halls` | id (UUID), name, status | Новая таблица, status — default 'Active' |

---

### Entity: Rent (аренда залов)

**Файл:** `Rent.xml` — ~30+ записей
**Root:** `<Rent>`
**Дочерние элементы:** `<Item>` (многократный)

#### Поля

| Поле | Тип | Описание |
|---|---|---|
| `ID` | string (UUID) | Уникальный идентификатор |
| `PaymentType` | string | Тип оплаты (Cash) |
| `ID_Client` | string (UUID)? | Ссылка на клиента (если TenantType=Client) |
| `Prepayment` | decimal | Предоплата |
| `RentTypeName` | string | Название типа аренды (напр. «БОЛЬШОЙ ЗАЛ») |
| `RentTypeCost` | decimal | Стоимость аренды |
| `TenantType` | string | Тип арендатора: `Client` / `NonClient` |
| `LastName` | string? | Фамилия (для NonClient) |
| `Name` | string? | Имя (для NonClient) |
| `MobilePhone` | string? | Телефон (для NonClient) |
| `Colour` | string (hex)? | Цвет |
| `Schedule` | `<Item Day="..." Time.From="..." Time.To="..." ID_Hall="UUID" Frequency="Regular\|Single" Range.From="..." Range.To="..."? Date="..."/>`? | Расписание |
| `Visits` | `<Item ID="UUID" Created="..." Date="DD.MM.YYYY" Name="..." Cost="..." TotalCost="..."/>` | Посещения |
| `Deposit` | `<Item ItemType="Pay\|WriteOff\|Debt\|Undebt\|PayDebt\|In" Sum="..." Time="..." UserID="..." ComputerID="..." PaymentType="..." VisitID="..."/>` | Движение средств |
| `Bonus` | empty | Бонусы |

#### Пример

```xml
<Item ID="6d9e7923-36ec-4f40-9f2b-e65488535462"
      ID_Client="54d91785-0984-471b-bbd0-cecadba7e675"
      Prepayment="1300" RentTypeName="БОЛЬШОЙ ЗАЛ" RentTypeCost="1300"
      TenantType="Client" PaymentType="Cash">
  <Visits>
    <Item ID="a145a113-e97c-4122-b76f-430a147a669c" Date="03.03.2019" Name="БОЛЬШОЙ ЗАЛ" Cost="1300" TotalCost="1300"/>
    <Item ID="ff77362c-aa19-4dbe-a473-110f02a689aa" Date="10.03.2019" Name="БОЛЬШОЙ ЗАЛ" Cost="1300" TotalCost="1300"/>
    ...
  </Visits>
  <Deposit>
    <Item ID="a8809eaf-c6a0-4e93-bd59-6462d603c57a" Time="04.03.2019 20:37:04" ItemType="Pay" Sum="1300" PaymentType="Cash"/>
    <Item ID="5070d305-0ee2-4287-8bff-48a34ae5161c" Time="04.03.2019 20:37:04" ItemType="WriteOff" Sum="1300" VisitID="a145a113-..."/>
    <Item ID="0ecfac6a-804a-46a6-8b9c-98946e0c09ab" Time="10.03.2019 12:43:18" ItemType="Debt" Sum="1300" VisitID="ff77362c-..."/>
    <Item ID="ff95e88c-da46-4da9-bd0f-0234ec96f545" Time="10.03.2019 12:43:27" ItemType="PayDebt" Sum="1300" PaymentType="Cash"/>
    ...
  </Deposit>
</Item>
```

#### Связи

| Связь | Описание |
|---|---|
| `Rent.ID_Client` → `Client.ID` | Аренда принадлежит клиенту (если TenantType=Client) |
| `Rent.Schedule[].ID_Hall` → `Hall.ID` | Расписание привязано к залу |

#### Маппинг в PostgreSQL

| DanceStudio XML | → PG таблица | Поля | Изменения в схеме |
|---|---|---|---|
| Rent | `hall_rentals` | id (UUID), payment_type, client_id, prepayment, rent_type_name, rent_type_cost, tenant_type, last_name, name, mobile_phone, colour, removed | client_id — FK → users.id (nullable), removed — bool |
| Rent.Schedule | `hall_rent_schedules` | id, rental_id, day, time_from, time_to, hall_id, frequency, range_from, range_to, base_date | rental_id — FK → hall_rentals.id, hall_id — FK → halls.id |
| Rent.Visits | `hall_rent_visits` | id (UUID), rental_id, visit_date, name, cost, total_cost, created_at | rental_id — FK → hall_rentals.id |
| Rent.Deposit | `hall_rent_payments` | id, rental_id, payment_type (Pay/WriteOff/Debt/Undebt/PayDebt/In), sum, payment_time, user_id, computer_id, visit_id | rental_id — FK → hall_rentals.id |

---

### Entity: RentAccount (арендные абонементы)

**Файл:** `RentAccount.xml` — 3 записи
**Root:** `<RentAccount>`
**Дочерние элементы:** `<Item>` (многократный)

#### Поля

| Поле | Тип | Описание |
|---|---|---|
| `ID` | string (UUID) | Уникальный идентификатор |
| `Number` | int | Порядковый номер |
| `CreateDate` | string (DD.MM.YYYY) | Дата создания |
| `OriginalCost` | decimal | Исходная стоимость |
| `ID_Client` | string (UUID) | Ссылка на клиента |
| `TenantType` | string | Тип арендатора: `Client` |
| `AccountTypeCost` | decimal | Стоимость типа абонемента |
| `Discount` | string/decimal? | Скидка (напр. "450,00") |
| `DiscountPercent` | int? | Скидка в процентах |
| `BeginDate` | string (DD.MM.YYYY)? | Дата начала |
| `DaysCount` | int? | Количество дней действия |
| `TrainingCount` | int | Количество посещений |
| `FreeTrainingCount` | int | Бесплатные посещения |
| `AddDaysCount` | int | Добавленные дни |
| `IsPerpetual` | bool | Бессрочный |
| `IsUnlimited` | bool | Неограниченный |
| `PaymentType` | string | Тип оплаты (Cash, NonCash) |
| `AccountTypeName` | string | Тип абонемента (напр. «Единый») |
| `AccountTypeTime` | `<From>HH:MM</From><To>HH:MM</To>` | Время действия абонемента |
| `Colour` | string (hex) | Цвет |
| `Schedule` | empty | Расписание |
| `Stages` | `<Item ID="UUID" TypeName="..." TypeCost="..." Begin="DD.MM.YYYY" Days="..." Freeze="true"/>`? | Этапы |
| `Visits` | `<Item Created="..." Date="DD.MM.YYYY" ID_Hall="UUID"/>` | Посещения |
| `Deposit` | `<Item ItemType="Pay\|WriteOff\|..." Sum="..." Time="..." UserID="..." ComputerID="..."/>` | Движение средств |
| `Bonus` | empty | Бонусы |

#### Пример

```xml
<Item ID="4a90e6d4-531e-40be-b914-cbcd6718e933" Number="2"
      OriginalCost="9000" Discount="450,00" DiscountPercent="5"
      ID_Client="64cf114b-d9f6-4b9b-8612-0bee853f1a2d"
      AccountTypeName="Единый" PaymentType="Cash" IsPerpetual="True">
  <AccountTypeTime><From>12:00</From><To>14:00</To></AccountTypeTime>
  <Visits>
    <Item Created="21.02.2026 17:21:16" Date="21.02.2026" ID_Hall="a3e4bd6e-0478-422d-93b0-ae554e6d3715"/>
    <Item Created="28.02.2026 11:53:44" Date="28.02.2026" ID_Hall="a3e4bd6e-0478-422d-93b0-ae554e6d3715"/>
  </Visits>
  <Deposit>
    <Item ID="0bb536e1-f7e7-4c16-b967-84f8fa272d97" Time="14.02.2026 13:12:30" ItemType="Pay" Sum="9000"/>
    <Item ID="f8f8d6b8-8fb4-46ed-b265-c6241db67a36" Time="14.02.2026 13:12:30" ItemType="WriteOff" Sum="8550.00"/>
  </Deposit>
</Item>
```

#### Связи

| Связь | Описание |
|---|---|
| `RentAccount.ID_Client` → `Client.ID` | Абонемент принадлежит клиенту |
| `RentAccount.Visits[].ID_Hall` → `Hall.ID` | Визит привязан к залу |

#### Маппинг в PostgreSQL

| DanceStudio XML | → PG таблица | Поля | Изменения в схеме |
|---|---|---|---|
| RentAccount | `hall_rent_subscriptions` | id (UUID), number, create_date, original_cost, client_id, tenant_type, account_type_cost, discount, discount_percent, begin_date, days_count, training_count, free_training_count, add_days_count, is_perpetual, is_unlimited, payment_type, account_type_name, time_from, time_to, colour, removed | client_id — FK → users.id, removed — bool |
| RentAccount.Visits | `hall_rent_subscription_visits` | id, subscription_id, visit_date, hall_id, created_at | subscription_id — FK → hall_rent_subscriptions.id, hall_id — FK → halls.id |
| RentAccount.Deposit | `hall_rent_subscription_payments` | id, subscription_id, payment_type, sum, payment_time, user_id, computer_id | subscription_id — FK → hall_rent_subscriptions.id |

---

### Entity: DayBalance

**Файл:** `DayBalance.xml` — пустой (2 строки)
**Root:** `<DayBalance />`
**Статус:** файл пустой, сущность не содержит записей

---

## Сводка связей между сущностями D1.3

| Связь | Описание |
|---|---|
| `IndividualAccount.ID_Client` → `Client.ID` | Абонемент принадлежит клиенту |
| `IndividualAccount.ID_Teacher` → `Teacher.ID` | Абонемент привязан к преподавателю |
| `IndividualAccount.ID_Style` → `Style.ID` | Абонемент привязан к стилю |
| `IndividualAccount.Visits[].ID_Teacher` → `Teacher.ID` | Визит привязан к преподавателю |
| `IndividualTraining.ID_Client` → `Client.ID` | Занятие принадлежит клиенту |
| `IndividualTraining.ID_Teacher` → `Teacher.ID` | Занятие с преподавателем |
| `IndividualTraining.Schedule[].ID_Hall` → `Hall.ID` | Расписание привязано к залу |
| `Rent.ID_Client` → `Client.ID` | Аренда принадлежит клиенту (если TenantType=Client) |
| `Rent.Schedule[].ID_Hall` → `Hall.ID` | Расписание привязано к залу |
| `RentAccount.ID_Client` → `Client.ID` | Арендный абонемент принадлежит клиенту |
| `RentAccount.Visits[].ID_Hall` → `Hall.ID` | Визит привязан к залу |
| `Hall` | Справочник залов, ссылается через ID_Hall |

## Итого новых таблиц для PG (из D1.3)

| # | PG таблица | Источник XML | Описание |
|---|---|---|---|
| 1 | `user_subscriptions` | IndividualAccount | Индивидуальные абонементы клиентов |
| 2 | `user_visits` | IndividualAccount.Visits | Посещения по индивидуальному абонементу |
| 3 | `user_payments` | IndividualAccount.Deposit | Движение средств по индивидуальному абонементу |
| 4 | `individual_sessions` | IndividualTraining | Индивидуальные занятия |
| 5 | `individual_session_schedules` | IndividualTraining.Schedule | Расписание индивидуальных занятий |
| 6 | `individual_session_visits` | IndividualTraining.Visits | Посещения индивидуальных занятий |
| 7 | `individual_session_payments` | IndividualTraining.Deposit | Движение средств по индивидуальным занятиям |
| 8 | `halls` | Hall | Залы танцевальной студии |
| 9 | `hall_rentals` | Rent | Аренда залов |
| 10 | `hall_rent_schedules` | Rent.Schedule | Расписание аренды |
| 11 | `hall_rent_visits` | Rent.Visits | Посещения аренды |
| 12 | `hall_rent_payments` | Rent.Deposit | Движение средств по аренде |
| 13 | `hall_rent_subscriptions` | RentAccount | Арендные абонементы |
| 14 | `hall_rent_subscription_visits` | RentAccount.Visits | Посещения по арендному абонементу |
| 15 | `hall_rent_subscription_payments` | RentAccount.Deposit | Движение средств по арендному абонементу |

---

## Тикет D1.4: SingleTraining001–005

**Статус:** ✅ Прочитано и утверждено
**Файлы:** `SingleTraining001.xml` – `SingleTraining005.xml` (партиционированные данные SingleTraining)

---

### Entity: SingleTraining (партиции 001–005)

Это партиционированные данные той же сущности SingleTraining, что описана в D1.1. Структура полностью идентична.

**Root:** `<SingleTraining>`
**Дочерние элементы:** `<Item>` (многократный)

#### Партиции

| Файл | Строк | Записей | Диапазон дат |
|---|---|---|---|
| `SingleTraining001.xml` | 71 716 | ~12 629 | 11.01.2020 – 30.11.2020 |
| `SingleTraining002.xml` | 72 458 | ~12 585 | — |
| `SingleTraining003.xml` | 73 428 | ~12 458 | — |
| `SingleTraining004.xml` | 73 813 | ~12 381 | — |
| `SingleTraining005.xml` | 72 857 | ~12 697 | 01.04.2022 – 19.10.2022 |
| **Итого** | **364 272** | **~62 750** | **2020–2022** |

#### Поля (идентичны D1.1 SingleTraining)

| Поле | Тип | Описание |
|---|---|---|
| `ID` | UUID | Уникальный идентификатор |
| `VisitDate` | string (dd.mm.yyyy) | Дата визита |
| `PaymentType` | enum | Cash / NonCash |
| `ID_Client` | UUID | Ссылка на клиента |
| `ID_Group` | UUID | Ссылка на группу |
| `Cost` | decimal | Стоимость визита (всегда 0 в этих партициях) |
| `SingleTrainingTypeName` | string | Название типа занятия |
| `SingleTrainingTypeCost` | decimal | Стоимость типа |
| `Annotation` | string? | Примечание (напр. "12=13") |
| `Deposit` | nested array | История оплаты визита |
| `Bonus` | empty | Бонусы |

#### Атрибуты `<Item>` (обновления)

- `Updated` — строка вида `"N\|UserID\|ComputerID\|DD.MM.YYYY HH:MM:SS"`
- `Created` — аналогичный формат
- `Removed` — `"true"` если запись удалена

#### Типы занятий (из примеров)

- `премиум 50%` — 165
- `премиум тренировка` — 313.5 / 350 / 370
- `тренировка` — 285 / 315
- `тренировка 50%` — 165
- `полуторка` — 425
- `разовая` — 600
- `бесплатно` — 0
- `с 5% скидкой` — 350

#### Особенности (из анализа 001 и 005)

1. **Cost=0 во всех записях** — реальная стоимость хранится в `SingleTrainingTypeCost`
2. **Debt/Undebt в Deposit** — часть записей содержит историю задолженностей: WriteOff → Debt → Undebt → WriteOff
3. **Removed="true"** — мягкое удаление встречается (записи с 3 версиями Updated)
4. **Annotation="12=13"** — примечания к некоторым бесплатным занятиям
5. **Deposit Updated** — вложенный `<Deposit>` тоже имеет атрибут Updated для изменения истории

#### Пример записи (из 005)

```xml
<Item Updated="2|910267f7-b5ae-4903-87da-ffbcf2a8a19f|EAC0-33CD-71B8-C168-4564-9ACE-85DF-7823|01.04.2022 17:14:38"
      Created="1|910267f7-b5ae-4903-87da-ffbcf2a8a19f|EAC0-33CD-71B8-C168-4564-9ACE-85DF-7823|01.04.2022 17:14:31">
  <ID>3913694f-cd4c-4f19-8ada-d386a09163b7</ID>
  <VisitDate>01.04.2022</VisitDate>
  <PaymentType>Cash</PaymentType>
  <ID_Client>42adc8c0-c4e7-44dd-9143-d82d7fa4e732</ID_Client>
  <ID_Group>106110c1-7398-4778-810a-2be9d8b68853</ID_Group>
  <Cost>0</Cost>
  <SingleTrainingTypeName>полуторка</SingleTrainingTypeName>
  <SingleTrainingTypeCost>425</SingleTrainingTypeCost>
  <Deposit>
    <Item ID="f0a055a2-b722-4d67-963b-2d2466c640c0" Time="01.04.2022 22:14:39"
          ItemType="WriteOff" Sum="425"
          UserID="910267f7-b5ae-4903-87da-ffbcf2a8a19f"
          ComputerID="EAC0-33CD-71B8-C168-4564-9ACE-85DF-7823" />
  </Deposit>
  <Bonus />
</Item>
```

#### Пример с Debt (из 005)

```xml
<Item Updated="3|910267f7-b5ae-4903-87da-ffbcf2a8a19f|...|02.04.2022 07:12:57"
      Created="1|910267f7-b5ae-4903-87da-ffbcf2a8a19f|...|02.04.2022 05:56:29">
  <ID>bfe0d1b8-2cbb-45db-90e1-5cc71abbce29</ID>
  <VisitDate>02.04.2022</VisitDate>
  <SingleTrainingTypeName>премиум тренировка</SingleTrainingTypeName>
  <SingleTrainingTypeCost>313,5</SingleTrainingTypeCost>
  <Deposit Updated="2|910267f7-b5ae-4903-87da-ffbcf2a8a19f|...|02.04.2022 07:12:57">
    <Item ID="518e7a0f-..." Time="02.04.2022 10:56:36" ItemType="WriteOff" Sum="27.5" />
    <Item ID="c83ce7ff-..." Time="02.04.2022 10:56:36" ItemType="Debt" Sum="286.0" />
    <Item ID="1721a73a-..." Time="02.04.2022 12:12:59" ItemType="Undebt" Sum="286.0" />
    <Item ID="ff5b87d4-..." Time="02.04.2022 12:12:59" ItemType="WriteOff" Sum="286.0" />
  </Deposit>
</Item>
```

#### Ключевые наблюдения D1.4

1. **Партиционирование:** 5 файлов × ~12 500 записей = ~62 750 записей (общий объём 364K строк) - забираем все. какой объём будет?
2. **Структура идентична D1.1:** те же поля, те же связи, те же атрибуты Updated/Created/Removed - данные то же те же?
3. **Debt-цикл:** многие записи имеют полную историю задолженностей (WriteOff → Debt → Undebt → WriteOff)
4. **Cost=0:** поле Cost всегда 0 — реальная стоимость в SingleTrainingTypeCost
5. **Удаления:** ~5-10% записей имеют Removed="true"

---

## Тикет D1.5: SingleTraining006–010

**Статус:** ✅ Прочитано и утверждено
**Файлы:** `SingleTraining006.xml`, `SingleTraining007.xml`, `SingleTraining008.xml`, `SingleTraining009.xml`, `SingleTraining010.xml`

---

### Entity: SingleTraining (партиция 006–010)

**Файлы:** `SingleTraining006.xml` – `SingleTraining010.xml` — партиционированные данные сущности SingleTraining (продолжение D1.4).  
**Записей:** ~200–300 записей (по ~40–60 на файл).  
**Root:** `<SingleTraining>`  
**Дочерние элементы:** `<Item>` (многократный).

#### Поля

| Поле | Тип | Описание |
|---|---|---|
| `ID` | string (UUID) | Уникальный идентификатор |
| `VisitDate` | string (dd.mm.yyyy) | Дата визита |
| `PaymentType` | enum | `Cash` / `NonCash` |
| `ID_Client` | string (UUID) | Ссылка на клиента |
| `ID_Group` | string (UUID) | Ссылка на группу |
| `Cost` | decimal | Стоимость визита (обычно 0 — списывается из абонемента) |
| `SingleTrainingTypeName` | string | Название типа занятия |
| `SingleTrainingTypeCost` | decimal | Стоимость типа |
| `Annotation` | string? | Примечание (напр. «первый раз») |
| `Deposit` | nested array | История оплаты визита |
| `Bonus` | empty | Бонусы (пусто во всех записях) |
| `Updated` | attr | Метка обновления (`N\|UserID\|ComputerID\|DateTime`) |
| `Created` | attr | Метка создания |
| `Removed` | attr | `"true"` — пометка удаления |

**Deposit (вложенная структура):**

| Поле | Тип | Описание |
|---|---|---|
| `ID` | UUID | Уникальный ID |
| `Time` | datetime | Время операции |
| `ItemType` | enum | `Pay` / `WriteOff` / `Debt` / `Undebt` |
| `Sum` | decimal | Сумма |
| `UserID` | UUID | ID пользователя |
| `ComputerID` | string | ID компьютера |
| `PaymentType` | string | `Cash` / `NonCash` |

#### Типы SingleTrainingTypeName (из D1.5)

| Название | Стоимость | Описание |
|---|---|---|
| `без скидки` | 475 | Полная стоимость |
| `с 5% скидкой` | 455 | Скидка 5% |
| `5%, если 12 трен` | 425 | Скидка 10% при 12+ тренировках |
| `если 12 трен` | 450 | Промежуточный вариант |
| `бесплатно` | 0 | Пробное занятие |

#### Пример записи

```xml
<Item Updated="2|910267f7-b5ae-4903-87da-ffbcf2a8a19f|670B-E878-DD76-F952-3316-7A51-88E7-9917|05.10.2024 18:49:02"
      Created="1|910267f7-b5ae-4903-87da-ffbcf2a8a19f|670B-E878-DD76-F952-3316-7A51-88E7-9917|05.10.2024 18:48:59">
  <ID>6b6ecccf-b317-425a-a3e0-81f1a0040c8d</ID>
  <Cost>0</Cost>
  <ID_Client>95bdc704-9d9f-4d3e-953e-6ee3aeff5f41</ID_Client>
  <SingleTrainingTypeCost>475</SingleTrainingTypeCost>
  <VisitDate>05.10.2024</VisitDate>
  <PaymentType>Cash</PaymentType>
  <ID_Group>f41b1c45-cae2-483c-b68b-ce54d73e2f36</ID_Group>
  <SingleTrainingTypeName>без скидки</SingleTrainingTypeName>
  <Deposit>
    <Item ID="8b89a0fe-c790-4fa9-832f-b622a7802c01" Time="05.10.2024 18:49:02"
          ItemType="WriteOff" Sum="475"
          UserID="910267f7-b5ae-4903-87da-ffbcf2a8a19f"
          ComputerID="670B-E878-DD76-F952-3316-7A51-88E7-9917" />
  </Deposit>
  <Bonus />
</Item>
```

#### Пример записи с Debt → Undebt → WriteOff

```xml
<Item Updated="3|910267f7-b5ae-4903-87da-ffbcf2a8a19f|670B-E878-DD76-F952-3316-7A51-88E7-9917|05.10.2024 18:06:23"
      Created="1|910267f7-b5ae-4903-87da-ffbcf2a8a19f|670B-E878-DD76-F952-3316-7A51-88E7-9917|05.10.2024 15:05:48">
  <ID>fd2fe3fb-74e2-4c95-a339-f4ec9a20894d</ID>
  <Cost>0</Cost>
  <ID_Client>4f455bca-1fd3-4e9f-a0b6-c002dc7709f1</ID_Client>
  <SingleTrainingTypeCost>450</SingleTrainingTypeCost>
  <VisitDate>05.10.2024</VisitDate>
  <PaymentType>Cash</PaymentType>
  <ID_Group>18436299-4b3c-4ec6-8505-39b1fcea1776</ID_Group>
  <SingleTrainingTypeName>без скидки</SingleTrainingTypeName>
  <Deposit Updated="2|910267f7-b5ae-4903-87da-ffbcf2a8a19f|670B-E878-DD76-F952-3316-7A51-88E7-9917|05.10.2024 18:06:23">
    <Item ID="c6ccaacd-5599-4784-b6a8-fbd81997a758" Time="05.10.2024 15:06:09"
          ItemType="Debt" Sum="450"
          UserID="910267f7-b5ae-4903-87da-ffbcf2a8a19f" />
    <Item ID="a829658a-620e-45d1-9159-80b2ad64609d" Time="05.10.2024 18:06:23"
          ItemType="Undebt" Sum="450" ... />
    <Item ID="aaef95aa-3787-4f7a-9e65-07dafc56f2c5" Time="05.10.2024 18:06:23"
          ItemType="WriteOff" Sum="450" ... />
  </Deposit>
  <Bonus />
</Item>
```

#### Пример записи с Removed="true"

```xml
<Item Updated="3|910267f7-b5ae-4903-87da-ffbcf2a8a19f|670B-E878-DD76-F952-3316-7A51-88E7-9917|16.10.2024 13:28:25"
      Created="1|910267f7-b5ae-4903-87da-ffbcf2a8a19f|670B-E878-DD76-F952-3316-7A51-88E7-9917|05.10.2024 18:46:59"
      Removed="true">
  <ID>d476bfa3-6bc0-4558-808c-b8e26bbabc26</ID>
  <ID_Client>3615107d-9dd5-45c3-b054-b772c44330cb</ID_Client>
  <ID_Group>f41b1c45-cae2-483c-b68b-ce54d73e2f36</ID_Group>
  <VisitDate>05.10.2024</VisitDate>
  <Cost>0</Cost>
  <PaymentType>Cash</PaymentType>
  <SingleTrainingTypeName>без скидки</SingleTrainingTypeName>
  <SingleTrainingTypeCost>475</SingleTrainingTypeCost>
  <Deposit>
    <Item ID="2182eace-85d4-45aa-9d0a-2132359cafb1" Time="05.10.2024 18:47:03"
          ItemType="WriteOff" Sum="475" ... />
  </Deposit>
  <Bonus />
</Item>
```

#### Пример записи с Annotation

```xml
<Item Updated="2|910267f7-b5ae-4903-87da-ffbcf2a8a19f|670B-E878-DD76-F952-3316-7A51-88E7-9917|07.10.2024 18:17:15"
      Created="1|910267f7-b5ae-4903-87da-ffbcf2a8a19f|670B-E878-DD76-F952-3316-7A51-88E7-9917|07.10.2024 18:17:07">
  <ID>d0dcd67f-0101-4e62-a395-ee99d402c172</ID>
  <ID_Client>4d0acf67-7589-4bc3-bda0-20df9aa659f4</ID_Client>
  <ID_Group>d3e34fab-55da-4e6f-851c-b68becb9a560</ID_Group>
  <VisitDate>07.10.2024</VisitDate>
  <Cost>0</Cost>
  <PaymentType>Cash</PaymentType>
  <SingleTrainingTypeName>бесплатно</SingleTrainingTypeName>
  <SingleTrainingTypeCost>0</SingleTrainingTypeCost>
  <Annotation>первый раз</Annotation>
  <Deposit />
  <Bonus />
</Item>
```

#### Связи

| Связь | Описание |
|---|---|
| `SingleTraining.ID_Client` → `Client.ID` | Визит принадлежит клиенту (многие к одному) |
| `SingleTraining.ID_Group` → `Group.ID` | Визит привязан к группе (многие к одному) |
| `SingleTraining.Deposit[].UserID` → `User.ID` | Кто произвёл операцию |

#### Маппинг в PostgreSQL

| DanceStudio XML | → PG таблица | Поля | Изменения в схеме |
|---|---|---|---|
| SingleTraining | `user_visits` | id (UUID), visit_date, payment_type, client_id, group_id, cost, single_training_type_name, single_training_type_cost, annotation, removed | client_id — FK → users.id, group_id — FK → programs.id, removed — bool |
| SingleTraining.Deposit | `user_payments` | id, visit_id, item_type, sum, payment_time, user_id, computer_id, payment_method | visit_id — FK → user_visits.id |

**Примечание:** Данные из D1.5 — это продолжение партиционированных записей SingleTraining из D1.1 и D1.4. Структура идентична, записи просто разделены на 14 файлов для удобства хранения. Маппинг в PG тот же — все партиции объединяются в одну таблицу `user_visits`.

#### Ключевые наблюдения D1.5

1. **Cost=0:** Во всех записях `Cost` равен 0 — стоимость списывается через `Deposit` (WriteOff) из абонемента
2. **Debt → Undebt → WriteOff:** Частый сценарий — сначала создание долга (Debt), потом его погашение (Undebt), потом списание (WriteOff)
3. **Removed="true":** Несколько записей помечены как удалённые — нужно фильтровать при импорте
4. **Annotation:** Иногда заполняется (напр. «первый раз» для бесплатных пробных занятий)
5. **ID_Group с атрибутом Updated:** Встречается `<ID_Group Updated="...">UUID</ID_Group>` — дополнительная метаданная
6. **Bonus:** Всегда пустой (`<Bonus />`) во всех записях D1.5

---

*Продолжение следует (D1.7–D1.10)*

## Тикет D1.6: SingleTraining011–014

**Статус:** ✅ Прочитано и утверждено
**Файлы:** `SingleTraining011.xml` – `SingleTraining014.xml` (партиционированные данные SingleTraining)

---

### Entity: SingleTraining (партиции 011–014)

Это партиционированные данные той же сущности SingleTraining, что описана в D1.1. Структура полностью идентична.

**Root:** `<SingleTraining>`
**Дочерние элементы:** `<Item>` (многократный)

#### Партиции

| Файл | Строк | Записей | Диапазон дат |
|---|---|---|---|
| `SingleTraining011.xml` | 73 452 | ~12 995 | 22.02.2025 – 09.08.2025 |
| `SingleTraining012.xml` | 73 361 | ~12 890 | 09.08.2025 – 07.02.2026 |
| `SingleTraining013.xml` | 75 057 | ~12 643 | 07.02.2026 – 15.07.2026 |
| `SingleTraining014.xml` | 8 819 | ~1 401 | 15.07.2026 – 31.07.2026 |
| **Итого** | **230 689** | **~39 929** | **02.2025 – 07.2026** |

#### Поля (идентичны D1.1, D1.4, D1.5 SingleTraining)

| Поле | Тип | Описание |
|---|---|---|
| `ID` | UUID | Уникальный идентификатор |
| `VisitDate` | string (dd.mm.yyyy) | Дата визита |
| `PaymentType` | enum | Cash / NonCash |
| `ID_Client` | UUID | Ссылка на клиента |
| `ID_Group` | UUID | Ссылка на группу |
| `Cost` | decimal | Стоимость визита (всегда 0 в этих партициях) |
| `SingleTrainingTypeName` | string | Название типа занятия |
| `SingleTrainingTypeCost` | decimal | Стоимость типа |
| `Annotation` | string? | Примечание |
| `Deposit` | nested array | История оплаты визита |
| `Bonus` | empty | Бонусы |

#### Атрибуты `<Item>` (обновления)

- `Updated` — строка вида `"N\|UserID\|ComputerID\|DD.MM.YYYY HH:MM:SS"`
- `Created` — аналогичный формат
- `Removed` — `"true"` если запись удалена

#### Типы занятий (из примеров)

- `Бесплатно` — 0
- `без %, пм` — 720
- `12, пм` — 650
- `12, пс` — 650
- `50%, пм` — 360
- `50%, пс` — 360
- `5%, пм` — 684
- `5%, пс` — 617.5
- `12, 1,5` — 650
- `8дг` — 650
- `ИЗО` — разовое
- `Семинар` — разовое / семинар без %
- `Ёлка дет` / `Елка взр` — новогодние занятия
- `Трен.зал` / `трен.зал` — тренировочный зал
- `Разовое` / `разовое` — разовое занятие
- `10%, 8 зан ДГ` — скидка 10%, 8 занятий ДГ
- `НОВ` / `НОВ.` — новое занятие

#### Особенности (из анализа 011–014)

1. **Cost=0 во всех записях** — реальная стоимость хранится в `SingleTrainingTypeCost`, списание через `Deposit`
2. **Deposit WriteOff** — все записи с оплатой содержат `Deposit` с `ItemType="WriteOff"`
3. **Нет Debt/Undebt** — в отличие от D1.5, здесь нет сложных сценариев задолженностей (только прямое списание WriteOff)
4. **Нет Removed** — записей с `Removed="true"` не обнаружено (меньше истории версий)
5. **Bonus всегда пустой** — `<Bonus />` везде
6. **Новые типы занятий** — появились `без %, пм`, `12, пм`, `Семинар`, `Ёлка дет/взр`, `ИЗО` — это отражает актуальный ассортимент студии
7. **Актуальные данные** — последние партиции (013–014) содержат данные по июль 2026, это самые свежие данные
8. **Компактная версия** — SingleTraining014.xml значительно меньше (8 819 строк vs ~73 000 у остальных), т.к. охватывает лишь 16 дней

---

## Тикет D1.7: Style, Sex, Tag, Branch, Substitute

**Статус:** ✅ Прочитано и утверждено
**Файлы:** `Style.xml`, `Sex.xml`, `Tag.xml`, `Branch.xml`, `Substitute.xml`

---

### Entity: Style (стили/направления тренировок)

**Файл:** `Style.xml` — ~123 записи
**Root:** `<Style>`
**Дочерние элементы:** `<Item>` (многократный)

#### Поля

| Поле | Тип | Описание |
|---|---|---|
| `ID` | string (UUID) | Уникальный идентификатор |
| `Name` | string | Название стиля/направления (напр. "ОФП меч", "Йога", "Тайцзи-Цюань", "Саньда Ушу", "Бразильское Джиу-Джитсу", "ЛФК") |
| `Description` | string? | Описание (редко заполнено) |
| `ID_Foto` | UUID? | Ссылка на фото |
| `Updated` | attr | Метка обновления (`N\|UserID\|ComputerID\|DateTime`) |
| `Created` | attr | Метка создания |
| `Removed` | attr | `"true"` — пометка удаления (2 записи удалены) |

#### Пример записи

```xml
<Item Updated="4|910267f7-b5ae-4903-87da-ffbcf2a8a19f|670B-E878-DD76-F952-3316-7A51-88E7-9917|27.11.2024 17:58:07"
      Created="1|910267f7-b5ae-4903-87da-ffbcf2a8a19f|EAC0-33CD-71B8-C168-4564-9ACE-85DF-7823|01.10.2021 19:55:31">
  <ID>4fb52061-9d47-4763-a336-622de975e658</ID>
  <Name Updated="4|...|26.03.2024 15:30:13">простой, старая цена</Name>
</Item>
<Item Created="1|910267f7-b5ae-4903-87da-ffbcf2a8a19f|EAC0-33CD-71B8-C168-4564-9ACE-85DF-7823|17.02.2019 19:51:58">
  <ID>9df9e796-aec5-4a49-8855-50b9dc661972</ID>
  <Name>Йога</Name>
</Item>
<Item Created="1|910267f7-b5ae-4903-87da-ffbcf2a8a19f|670B-E878-DD76-F952-3316-7A51-88E7-9917|26.02.2024 18:16:20">
  <ID>eed9fd97-57ab-468a-a6fb-1eb882aac3be</ID>
  <Name>Упражнения для внутренних органов</Name>
  <Description>Как и мышцы каждый внутренний орган требует тренировки...</Description>
</Item>
```

#### Ключевые наблюдения

1. **Названия стилей** — отражают разнообразие студии: УШУ (все виды), Тайцзи-Цюань, Цигун, ЛФК, йога, борьба, функциональный тренинг, гимнастика, массаж, семинары
2. **Названия могут быть изменены** — атрибут `Updated` на элементе `<Name>` (не только на `<Item>`)
3. **Удалённые записи** — 2 записи имеют `Removed="true"` ("с 5 %", "Новый прайс")
4. **Некоторые названия — это типы цен** — "простой", "премиум", "полуторка", "с 5 % скидкой" — это не стили, а тарифы
5. **ID_Foto** — встречается у некоторых записей (напр. "премиум" — `4b732dc4-...`)
6. **Описания** — редко заполнены, но есть подробные (напр. "Упражнения для внутренних органов")

#### Связи

| Связь | Описание |
|---|---|
| `Group.ID_Style` → `Style.ID` | Группа привязана к стилю (многие к одному) |
| `Account.ID_Style` → `Style.ID` | Абонемент привязан к стилю |
| `IndividualAccount.ID_Style` → `Style.ID` | Индивидуальный абонемент привязан к стилю |
| `IndividualTraining.ID_Style` → `Style.ID` | Индивидуальное занятие привязано к стилю |

---

### Entity: Sex (пол)

**Файл:** `Sex.xml` — 2 записи
**Root:** `<Sex>`
**Дочерние элементы:** `<Item>` (многократный)

#### Поля

| Поле | Тип | Описание |
|---|---|---|
| `ID` | string (UUID) | Уникальный идентификатор |
| `Name` | string | Название пола: `мужской` / `женский` |
| `Abbreviation` | string | Сокращение: `м` / `ж` |

#### Пример

```xml
<Item>
  <ID>55cb0aaa-86eb-4423-a4d4-b1fb14aee7fc</ID>
  <Name>мужской</Name>
  <Abbreviation>м</Abbreviation>
</Item>
<Item>
  <ID>87364c6f-a6d3-483f-931e-84b6a8b8d8d2</ID>
  <Name>женский</Name>
  <Abbreviation>ж</Abbreviation>
</Item>
```

#### Связи

| Связь | Описание |
|---|---|
| `Client.ID_Sex` → `Sex.ID` | Клиент привязан к полу |
| `Teacher.ID_Sex` → `Sex.ID` | Преподаватель привязан к полу |

---

### Entity: Tag (теги клиентов)

**Файл:** `Tag.xml` — 10 записей
**Root:** `<Tag>`
**Дочерние элементы:** `<Item>` (многократный)

#### Поля

| Поле | Тип | Описание |
|---|---|---|
| `ID` | string (UUID) | Уникальный идентификатор |
| `Name` | string | Название тега |
| `Description` | string? | Описание тега (редко заполнено) |
| `Colour` | string (hex) | Цвет тега в формате `AARRGGBB` (напр. `FFFFC300` = жёлтый) |
| `Position` | int? | Порядок сортировки |
| `Created` | attr | Метка создания |

#### Пример записи

```xml
<Item Created="1|910267f7-b5ae-4903-87da-ffbcf2a8a19f|591C-9A1A-431F-1DF1-2E40-D8E5-80B7-D2E7|01.12.2020 15:06:05">
  <ID>afca937a-6988-49aa-a2f3-4f18115cdfcc</ID>
  <Name>VIP</Name>
  <Position>1</Position>
  <Colour>FFFFC300</Colour>
</Item>
<Item Created="1|910267f7-b5ae-4903-87da-ffbcf2a8a19f|EAC0-33CD-71B8-C168-4564-9ACE-85DF-7823|04.02.2021 18:21:00">
  <ID>f4486d5c-00aa-4897-a6d4-e8816afc12ad</ID>
  <Name>есть действующий сертификат</Name>
  <Description>дала 04.02.21 сертификат (есть еще 2 занятия)</Description>
  <Colour>FFFF69B4</Colour>
</Item>
```

#### Теги (все 10)

| Название | Цвет | Описание |
|---|---|---|
| VIP | FFFF C300 (жёлтый) | — |
| конфликтный | FFFF 8561 (оранжевый) | — |
| часто опаздывает | FFFF B8FE (розовый) | — |
| есть действующий сертификат | FFFF 69B4 (розовый) | "дала 04.02.21 сертификат" |
| привита | FF00 FF00 (зелёный) | "показала серт 30.10.21" |
| привит | FF7C FC00 (лайм) | — |
| переболела | FFA5 2A2A (тёмно-красный) | — |
| не привита | FFDB 7093 (розовый) | — |
| переболел | FF8B 4513 (коричневый) | — |
| негативная | FF55 6B2F (оливковый) | — |
| допытная | FFDA A520 (тёмно-золотой) | — |

#### Связи

| Связь | Описание |
|---|---|
| `Client.Tags` → `Tag.ID` | Клиент может иметь несколько тегов (many-to-many через вложенный XML) |

---

### Entity: Branch (филиалы/отделения)

**Файл:** `Branch.xml` — 1 запись
**Root:** `<Branch>`
**Дочерние элементы:** `<Item>`

#### Поля

| Поле | Тип | Описание |
|---|---|---|
| `ID` | string (UUID) | Уникальный идентификатор |
| `Name` | string | Название филиала |

#### Пример

```xml
<Item>
  <ID>00000000-0000-0000-0000-000000000000</ID>
  <Name>Главный</Name>
</Item>
```

#### Связи

| Связь | Описание |
|---|---|
| Пока не используется ни в одной из прочитанных сущностей | — |

---

### Entity: Substitute (замены занятий — substitution)

**Файл:** `Substitute.xml` — ~276 записей
**Root:** `<Substitute>`
**Дочерние элементы:** `<Item>` (многократный)

#### Поля

| Поле | Тип | Описание |
|---|---|---|
| `ID` | string (UUID) | Уникальный идентификатор |
| `Date` | string (DD.MM.YYYY) | Дата замены |
| `ID_Group` | string (UUID) | Ссылка на группу |
| `ID_Teacher` | string (UUID) | Ссылка на преподавателя (замещающий) |
| `SumType` | enum | `Target` (замена) / `Source` (исходная запись) |
| `Annotation` | string? | Примечание (напр. "285") |
| `ScheduleTimeBegin` | string? | Время начала по расписанию (напр. "01.01.0001 18:00:00") |
| `Updated` | attr | Метка обновления |
| `Created` | attr | Метка создания |
| `Removed` | attr | `"true"` — пометка удаления |

#### Пример записи

```xml
<Item Updated="2|910267f7-b5ae-4903-87da-ffbcf2a8a19f|EAC0-33CD-71B8-C168-4564-9ACE-85DF-7823|14.01.2021 14:19:46"
      Created="1|910267f7-b5ae-4903-87da-ffbcf2a8a19f|EAC0-33CD-71B8-C168-4564-9ACE-85DF-7823|14.01.2021 14:19:20">
  <ID>be970fd7-f756-4f31-9911-240d16858355</ID>
  <Date>15.01.2021</Date>
  <ID_Group>106110c1-7398-4778-810a-2be9d8b68853</ID_Group>
  <ID_Teacher>a966c98d-7243-4516-885a-18766f6137b6</ID_Teacher>
  <SumType>Target</SumType>
</Item>
<Item Updated="6|910267f7-b5ae-4903-87da-ffbcf2a8a19f|EAC0-33CD-71B8-C168-4564-9ACE-85DF-7823|29.10.2021 21:39:47"
      Created="1|910267f7-b5ae-4903-87da-ffbcf2a8a19f|EAC0-33CD-71B8-C168-4564-9ACE-85DF-7823|22.10.2021 18:41:25">
  <ID>e3539f44-c46f-43e9-a017-f32cd283c5ed</ID>
  <Date>22.10.2021</Date>
  <ID_Group>c7b479ac-92ad-4b88-bc0c-8b147b1ddb15</ID_Group>
  <ID_Teacher>90d62d29-0e76-48ed-8979-b7a9f21190e6</ID_Teacher>
  <SumType Updated="3|...|29.10.2021 21:39:46">Source</SumType>
</Item>
```

#### Ключевые наблюдения

1. **SumType** — два значения: `Target` (замена) и `Source` (исходная отменённая запись). Замечено, что после изменения `SumType` меняется с Target на Source
2. **Период данных** — с 15.01.2021 по 13.05.2024 (3+ года замен)
3. **Annotation** — иногда содержит число (напр. "285") — возможно номер группы или комнаты
4. **ScheduleTimeBegin** — время начала занятия по оригинальному расписанию (напр. "01.01.0001 18:00:00")
5. **Удалённые записи** — несколько записей имеют `Removed="true"`
6. **Date на элементе** — у некоторых записей `<Date>` тоже имеет атрибут `Updated`
7. **ID_Group на элементе** — аналогично, `<ID_Group>` может иметь атрибут `Updated`
8. **Много разных групп** — замены затрагивают множество групп (ID_Group уникальны для каждой записи)
9. **Много разных преподавателей** — несколько преподавателей участвуют в заменамх

#### Связи

| Связь | Описание |
|---|---|
| `Substitute.ID_Group` → `Group.ID` | Замена привязана к группе |
| `Substitute.ID_Teacher` → `Teacher.ID` | Замена привязана к преподавателю |

---

## Сводка связей между сущностями D1.7

| Связь | Описание |
|---|---|
| `Group.ID_Style` → `Style.ID` | Группа привязана к стилю |
| `Account.ID_Style` → `Style.ID` | Абонемент привязан к стилю |
| `IndividualAccount.ID_Style` → `Style.ID` | Индивидуальный абонемент привязан к стилю |
| `IndividualTraining.ID_Style` → `Style.ID` | Индивидуальное занятие привязано к стилю |
| `Client.ID_Sex` → `Sex.ID` | Клиент привязан к полу |
| `Teacher.ID_Sex` → `Sex.ID` | Преподаватель привязан к полу |
| `Client.Tags` → `Tag.ID` | Клиент может иметь несколько тегов |
| `Substitute.ID_Group` → `Group.ID` | Замена привязана к группе |
| `Substitute.ID_Teacher` → `Teacher.ID` | Замена привязана к преподавателю |

## Итого новых таблиц для PG (из D1.7)

| # | PG таблица | Источник XML | Описание |
|---|---|---|---|
| 1 | `styles` | Style | Стили/направления тренировок (~123 записи) |
| 2 | `sexes` | Sex | Пол (2 записи) |
| 3 | `tags` | Tag | Теги клиентов (10 записей) |
| 5 | `branches` | Branch | Филиалы (1 запись) |
| 6 | `schedule_substitutions` | Substitute | Замены занятий (~276 записей) |

---

## Тикет D1.4: SingleTraining001–005

**Статус:** ✅ Прочитано и утверждено
**Файлы:** `SingleTraining001.xml`, `SingleTraining002.xml`, `SingleTraining003.xml`, `SingleTraining004.xml`, `SingleTraining005.xml`

### Entity: SingleTraining (партиции 001–005)

**Файлы:** 5 партиционированных файлов — продолжение SingleTraining из D1.1, разбитых по объёму.

| Файл | Строк | Ориентировочный период |
|---|---|---|
| `SingleTraining001.xml` | 71 715 | начало данных |
| `SingleTraining002.xml` | 72 458 | — |
| `SingleTraining003.xml` | 73 428 | — |
| `SingleTraining004.xml` | 73 813 | — |
| `SingleTraining005.xml` | 72 856 | октябрь 2022 |

**Итого строк:** 364 270
**Root:** `<SingleTraining>`
**Дочерние элементы:** `<Item>` (многократный)

> **Важно:** Структура ИДЕНТИЧНА основному `SingleTraining.xml` из D1.1. Это партиционированные данные одной сущности, разбитые по объёму файлов для удобства хранения.

#### Поля

| Поле | Тип | Описание |
|---|---|---|
| `ID` | string (UUID) | Уникальный идентификатор визита |
| `VisitDate` | string (DD.MM.YYYY) | Дата посещения |
| `PaymentType` | string | Тип оплаты: `Cash` / `NonCash` |
| `ID_Client` | string (UUID) | Ссылка на клиента |
| `ID_Group` | string (UUID) | Ссылка на группу/программу |
| `Cost` | decimal | Стоимость визита (0 если бесплатно) |
| `SingleTrainingTypeName` | string | Название типа: "1", "1/1 5%", "полуторка", "2", "3", "бесплатно", "с 5% скидкой" |
| `SingleTrainingTypeCost` | decimal | Стоимость типа занятия |
| `Annotation` | string? | Примечание (напр. "12=13") |
| `Deposit` | `<Item ItemType="WriteOff\|Pay\|Debt\|Undebt" Sum="..." Time="..." .../>` | Финансовая транзакция |
| `Bonus` | — | Бонусы (всегда пустой: `<Bonus />`) |

#### Update/Created метаданные (на `<Item>`)

```
Updated="2|910267f7-b5ae-4903-87da-ffbcf2a8a19f|EAC0-33CD-71B8-C168-4564-9ACE-85DF-7823|01.04.2022 17:14:38"
Created="1|910267f7-b5ae-4903-87da-ffbcf2a8a19f|EAC0-33CD-71B8-C168-4564-9ACE-85DF-7823|01.04.2022 17:14:31"
```
Формат: `Версия|UserID|ComputerID|DD.MM.YYYY HH:MM:SS`

#### Примеры записей

**Оплаченный визит:**
```xml
<Item Updated="2|...|01.04.2022 17:14:38" Created="1|...|01.04.2022 17:14:31">
  <ID>3913694f-...</ID>
  <VisitDate>01.04.2022</VisitDate>
  <PaymentType>Cash</PaymentType>
  <ID_Client>42adc8c0-...</ID_Client>
  <ID_Group>106110c1-...</ID_Group>
  <Cost>0</Cost>
  <SingleTrainingTypeName>полуторка</SingleTrainingTypeName>
  <SingleTrainingTypeCost>425</SingleTrainingTypeCost>
  <Deposit>
    <Item ID="f0a055a2-..." Time="01.04.2022 22:14:39"
          ItemType="WriteOff" Sum="425"
          UserID="910267f7-..." ComputerID="EAC0-33CD-..." />
  </Deposit>
  <Bonus />
</Item>
```

**Бесплатный визит:**
```xml
<Item Updated="2|...|01.04.2022 17:14:52" Created="1|...|01.04.2022 17:14:48">
  <ID>c1b380ef-...</ID>
  <VisitDate>01.04.2022</VisitDate>
  <PaymentType>Cash</PaymentType>
  <Annotation>12=13</Annotation>
  <ID_Client>95ca36a7-...</ID_Client>
  <ID_Group>106110c1-...</ID_Group>
  <Cost>0</Cost>
  <SingleTrainingTypeName>бесплатно</SingleTrainingTypeName>
  <SingleTrainingTypeCost>0</SingleTrainingTypeCost>
  <Deposit />
  <Bonus />
</Item>
```

#### Ключевые наблюдения

1. **Структура идентична** основному SingleTraining.xml из D1.1 — это одна сущность, партиционированная по файлам
2. **Порядок полей варьируется:** в некоторых записях `Annotation` стоит перед `ID_Client`, в других — после `PaymentType`. Поля не идут в строгом порядке.
3. **Cost=0** в большинстве записей — реальная стоимость в `SingleTrainingTypeCost`
4. **Deposit** — в партициях 001–005 только `WriteOff` (списание), нет `Pay` (в отличие от основного файла D1.1, где было Pay+WriteOff)
5. **Типы занятий:** "1", "1/1 5%", "полуторка", "2", "3", "бесплатно", "с 5% скидкой"
6. **Партиционирование по объёму**, а не по времени — каждый файл ~72K строк
7. **Нет Removed="true"** — в выборке 5 файлов мягкое удаление не обнаружено (возможно, в других партициях)
8. **Единый UserID:** `910267f7-b5ae-4903-87da-ffbcf2a8a19f` — записи сделаны одним пользователем
9. **Единый ComputerID:** `EAC0-33CD-71B8-C168-4564-9ACE-85DF-7823` — одна машина

---

## Сводная таблица: все партиции SingleTraining (D1.1 + D1.4 + D1.5 + D1.6)

| Партиция | Строк | Период |
|---|---|---|
| `SingleTraining.xml` (D1.1) | ~12 400 записей | основной файл |
| `SingleTraining001.xml` (D1.4) | 71 715 строк | — |
| `SingleTraining002.xml` (D1.4) | 72 458 строк | — |
| `SingleTraining003.xml` (D1.4) | 73 428 строк | — |
| `SingleTraining004.xml` (D1.4) | 73 813 строк | — |
| `SingleTraining005.xml` (D1.4) | 72 856 строк | до окт. 2022 |
| `SingleTraining006–010.xml` (D1.5) | — | — |
| `SingleTraining011–014.xml` (D1.6) | — | — |

> **Итого:** 15 файлов SingleTraining (1 основной + 14 партиций), суммарно ~15 000+ записей визитов.
