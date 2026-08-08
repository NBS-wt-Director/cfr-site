# Анализ сущностей тикета D1.7 (Style, Sex, Tag, Branch, Substitute)

## Полученные сущности

**Назначение:** Справочники и вспомогательные данные танцевальной студии.

**Источник:** 5 XML-файлов в `данные/_DB/`:
- `Style.xml` — ~123 записи стилей/направлений
- `Sex.xml` — 2 записи пола
- `Tag.xml` — 10 записей тегов клиентов
- `Branch.xml` — 1 запись филиала
- `Substitute.xml` — ~276 записей замен занятий

**Общий объём:** ~412 записей, 2 600 строк, ~14 КБ

---

## Структурное представление в доноре (XML)

### 1. Style (стили)

```xml
<Style>
  <Item Updated="N|UserID|ComputerID|DD.MM.YYYY HH:MM:SS"
        Created="N|UserID|ComputerID|DD.MM.YYYY HH:MM:SS"
        Removed="true?">
    <ID>UUID</ID>
    <Name Updated="N|...">string</Name>
    <Description>string?</Description>
    <ID_Foto>UUID?</ID_Foto>
  </Item>
</Style>
```

### 2. Sex (пол)

```xml
<Sex>
  <Item>
    <ID>UUID</ID>
    <Name>мужской|женский</Name>
    <Abbreviation>м|ж</Abbreviation>
  </Item>
</Sex>
```

### 3. Tag (теги)

```xml
<Tag>
  <Item Created="N|UserID|ComputerID|DD.MM.YYYY HH:MM:SS">
    <ID>UUID</ID>
    <Name>string</Name>
    <Description>string?</Description>
    <Colour>AARRGGBB</Colour>
    <Position>int?</Position>
  </Item>
</Tag>
```

### 4. Branch (филиалы)

```xml
<Branch>
  <Item>
    <ID>UUID</ID>
    <Name>Главный</Name>
  </Item>
</Branch>
```

### 5. Substitute (замены)

```xml
<Substitute>
  <Item Updated="N|UserID|ComputerID|DD.MM.YYYY HH:MM:SS"
        Created="N|UserID|ComputerID|DD.MM.YYYY HH:MM:SS"
        Removed="true?">
    <ID>UUID</ID>
    <Date Updated="N|...">DD.MM.YYYY</Date>
    <ID_Group Updated="N|...">UUID</ID_Group>
    <ID_Teacher Updated="N|...">UUID</ID_Teacher>
    <SumType Updated="N|...">Target|Source</SumType>
    <Annotation>string?</Annotation>
    <ScheduleTimeBegin>string?</ScheduleTimeBegin>
  </Item>
</Substitute>
```

### Ключевые структурные характеристики донора:

1. **Все файлы — flat XML** без вложенных записей (кроме Substitute с атрибутами Updated на дочерних элементах)
2. **Style** — единственная сущность с `Updated` на `<Name>` (вложенный атрибут)
3. **Substitute** — единственная сущность с `Updated` на дочерних элементах (`<Date>`, `<ID_Group>`, `<ID_Teacher>`, `<SumType>`)
4. **Sex, Branch** — минимальные справочники без метаданных версионирования
5. **Tag** — содержит `Colour` в формате AARRGGBB и `Position` для сортировки
6. **Нет XSD-схемы** — нет строгой валидации типов
7. **UTF-8 с BOM** — стандартная кодировка
8. **Порядок полей непредсказуем** — в Style и Substitute поля идут в разном порядке

---

## Оценка структуры донора: 4/5

### Аргументация оценки:

**Плюсы (+):**
- **Простая и плоская иерархия** — один уровень `<Item>`, без глубокой вложенности (лучше, чем SingleTraining с Deposit)
- **Чёткое разделение на справочники и данные** — Style/Sex/Tag/Branch (справочники) vs Substitute (транзакционные данные)
- **Цветовые коды в тегах** — `Colour` в AARRGGBB позволяет визуально маркировать теги в UI
- **Позиционирование тегов** — `Position` позволяет задать порядок отображения
- **Описание в Style** — `<Description>` позволяет хранить подробное описание направления
- **Замена как отдельная сущность** — `SumType` (Target/Source) чётко разделяет замены и исходные записи

**Минусы (-):**
- **Style содержит и стили, и тарифы** — названия "простой", "премиум", "полуторка" — это не стили, а типы цен. Смешение доменов в одной сущности
- **Updated на дочерних элементах в Substitute** — `<Date Updated="...">` усложняет парсинг, нужно проверять наличие атрибута
- **Removed="true" только у Style и Substitute** — Sex, Tag, Branch не имеют мягкого удаления, inconsistent approach
- **ID_Foto в Style** — UUID-ссылка на папки в `Files/` — связь с тикетом D6, но нет явной валидации существования
- **Нет связи между Tag и Style** — теги применяются к Client, но логически могли бы применяться и к Style
- **Branch пустой** — 1 запись "Главный", сущность есть, но не используется нигде

### Почему не 5:
Смешение стилей и тарифов в одной сущности `Style` — главная проблема. "Йога" и "премиум" — это разные домены, которые должны быть разделены.

### Почему не ниже 4:
Структура в целом рабочая и понятная, справочники простые и легко маппятся на таблицы.

---

## Рекомендуемое хранение у нас (PostgreSQL)

### Таблица: `styles`

```sql
CREATE TABLE styles (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                VARCHAR(200) NOT NULL,
    description         TEXT,
    id_foto             UUID,
    is_tariff           BOOLEAN DEFAULT FALSE,
    removed             BOOLEAN DEFAULT FALSE,
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_styles_name ON styles(name);
```

**Аргументация:**
- `is_tariff` — разделяет стили (Йога, УШУ) и тарифы (премиум, простой) без удаления данных
- `removed` — мягкое удаление, как в доноре
- `description` — TEXT, т.к. описания могут быть длинными

### Таблица: `sexes`

```sql
CREATE TABLE sexes (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                VARCHAR(20) NOT NULL,
    abbreviation        CHAR(1) NOT NULL
);

INSERT INTO sexes (id, name, abbreviation) VALUES
    ('55cb0aaa-86eb-4423-a4d4-b1fb14aee7fc', 'мужской', 'м'),
    ('87364c6f-a6d3-483f-931e-84b6a8b8d8d2', 'женский', 'ж');
```

**Аргументация:**
- Фиксированные данные, можно загрузить как seed
- `abbreviation` — CHAR(1) для экономии места

### Таблица: `tags`

```sql
CREATE TABLE tags (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                VARCHAR(200) NOT NULL,
    description         TEXT,
    colour              VARCHAR(7) NOT NULL,  -- AARRGGBB → #RRGGBB
    position            INTEGER,
    created_at          TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_tags_position ON tags(position NULLS LAST);
```

**Аргументация:**
- `colour` — хранить как `VARCHAR(7)` в формате `#RRGGBB` (убрать alpha-канал из AARRGGBB)
- `position` — NULLS LAST для сортировки тегов без позиции

### Таблица (many-to-many): `client_tags`

```sql
CREATE TABLE client_tags (
    client_id           UUID NOT NULL REFERENCES users(id),
    tag_id              UUID NOT NULL REFERENCES tags(id),
    PRIMARY KEY (client_id, tag_id)
);
```

**Аргументация:**
- Клиент может иметь несколько тегов → m2m связь
- Composite primary key предотвращает дублирование

### Таблица: `branches`

```sql
CREATE TABLE branches (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                VARCHAR(100) NOT NULL
);

INSERT INTO branches (id, name) VALUES
    ('00000000-0000-0000-0000-000000000000', 'Главный');
```

**Аргументация:**
- Пока 1 запись, но на будущее — масштабируемо для филиалов
- Seed-данные

### Таблица: `schedule_substitutions`

```sql
CREATE TABLE schedule_substitutions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date                DATE NOT NULL,
    group_id            UUID NOT NULL REFERENCES programs(id),
    teacher_id          UUID NOT NULL REFERENCES trainers(id),
    sum_type            VARCHAR(10) NOT NULL CHECK (sum_type IN ('Target', 'Source')),
    annotation          TEXT,
    schedule_time_begin TIMESTAMP,
    removed             BOOLEAN DEFAULT FALSE,
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_substitutions_date ON schedule_substitutions(date);
CREATE INDEX idx_substitutions_group ON schedule_substitutions(group_id);
CREATE INDEX idx_substitutions_teacher ON schedule_substitutions(teacher_id);
CREATE INDEX idx_substitutions_sum_type ON schedule_substitutions(sum_type);
```

**Аргументация:**
- `sum_type` — CHECK-ограничение для Target/Source
- `schedule_time_begin` — TIMESTAMP, хотя в XML формат "01.01.0001 18:00:00" (01.01.0001 — placeholder)
- Индексы по дате, группе и преподавателю — для частых запросов

---

## Сравнение: донор vs рекомендация

| Критерий | Донор (XML) | Рекомендация (PG) |
|---|---|---|
| Структура | Flat XML, 1 уровень | Реляционные таблицы, нормализованные |
| Типизация | Строки везде | DATE, BOOLEAN, VARCHAR, UUID, INTEGER |
| Валидация | Нет XSD | CHECK-ограничения, FK, UNIQUE |
| Цвета тегов | AARRGGBB (hex) | #RRGGBB (убран alpha-канал) |
| Стили+тарифы | В одной сущности | Разделяются флагом `is_tariff` |
| Many-to-many | Вложенный XML в Client | Отдельная таблица `client_tags` |
| Пустой Branch | 1 запись в XML | Seed-данные в миграции |
| Индексы | Нет | По дате, группе, преподавателю, имени |
| Удаление | Removed="true" (не везде) | removed BOOLEAN (uniformly) |

---

## Наблюдения по доменам

### Style — смешение доменов
Сущность `Style` содержит как реальные стили (Йога, УШУ, Тайцзи-Цюань), так и тарифы (премиум, простой, полуторка, с 5% скидкой). Это упрощение в DanceStudio, которое мы разделяем флагом `is_tariff`.

### Tag — визуальная маркировка
Теги используются для визуальной маркировки клиентов: VIP (жёлтый), конфликтный (оранжевый), привит (зелёный), негативная (оливковый). Цвета в формате AARRGGBB — это, вероятно, ARGB из WPF/.NET.

### Substitute — история замен
Замены занятий — транзакционные данные с историей. `SumType` может меняться с Target на Source при изменении. Это указывает на то, что замена может быть отменена.

### Sex и Branch — чистые справочники
Минимальные справочники без метаданных версионирования. Неизменяемые данные, загружаются как seed.

---

# Глобальные правила импорта DanceStudio (на будущее)

## Нормализация

**Все данные DanceStudio нормализуются полностью. JSONB не используется.**

Каждый вложенный XML-элемент с уникальными ID → отдельная таблица в PostgreSQL с FK-связями.

Пример: `SalaryOptions.GroupOptions` (19 полей) → таблица `trainer_salary_options` (1:1 с тренером). `SalaryOptions.RangePays` (массив) → таблица `trainer_salary_range_pays` (1:N).

JSONB допускается только для неструктурированных данных, которые не имеют уникальных ID и не участвуют в запросах.

## Мягкое удаление

**Записи, помеченные `Removed="true"`, НЕ переносятся в PostgreSQL.**

При импорте из XML — фильтрация:
```python
if item.attrib.get('Removed') == 'true':
    skip  # не импортировать
```

В таблице DanceStudio XML `Removed="true"` — мягкое удаление. В PostgreSQL удаляемые записи не попадают вообще. Если нужно восстановить — повторный импорт из XML.

## Итог для всех тикетов D1.x

| Правило | Действие |
|---|---|
| Нормализация | Полная. Каждый элемент с ID → отдельная таблица. Никакого JSONB. |
| Удалённые записи | `Removed="true"` → пропускаем при импорте. Не пишем в PG. |
| Decimal с запятой | `262,5` → конвертируем в `262.5` при парсинге. |
| Партиционированные файлы | Объединяем все партиции (Client.xml + Client001.xml) в одну таблицу PG. |
| Пустые элементы | `<Tags />`, `<Comments />` и т.д. — игнорируем при импорте. |
| Updated/Created атрибуты | Парсим строку `N\|UserID\|ComputerID\|DateTime` → сохраняем ds_updated, ds_created. |

---

# Анализ сущностей тикета D1.1 (Client, Teacher, Group, SingleTraining)

## Полученные сущности

**Назначение:** Основные бизнес-сущности танцевальной студии — клиенты, преподаватели, группы программ и отдельные посещения.

**Источник:** 5 XML-файлов в `данные/_DB/`:
- `Client.xml` — ~17 556 записей клиентов (2019-2023)
- `Client001.xml` — ~730 записей клиентов (2024-2026)
- `Teacher.xml` — ~30 записей преподавателей
- `Group.xml` — ~157 записей групп/программ
- `SingleTraining.xml` — ~12 400 записей индивидуальных посещений (основной файл)
- `SingleTraining001.xml` – `SingleTraining014.xml` — 14 партиций (суммарно ~15 000+)

**Общий объём:** ~28 500+ записей, ~178 000 строк, ~12.8 MB (только 5 файлов)

---

## Структурное представление в доноре (XML)

### 1. Client (клиенты)

```xml
<Client>
  <Item Updated="N|UserID|ComputerID|DD.MM.YYYY HH:MM:SS"
        Created="N|UserID|ComputerID|DD.MM.YYYY HH:MM:SS"
        Removed="true?">
    <ID>UUID</ID>
    <BirthDate Updated="N|...">DD.MM.YYYY</BirthDate>
    <ID_Sex>UUID</ID_Sex>
    <ID_Status>UUID</ID_Status>
    <AgreementNumber>int</AgreementNumber>
    <Barcode Updated="N|..."></Barcode>
    <Archive>True|False</Archive>
    <MobilePhone1>string</MobilePhone1>
    <MobilePhone2>string?</MobilePhone2>
    <LastName>string</LastName>
    <Name>string?</Name>
    <MiddleName>string?</MiddleName>
    <Email>string?</Email>
    <ID_Foto Updated="N|...">UUID</ID_Foto>
    <ID_Friend>UUID?</ID_Friend>
    <ParentMobilePhone1>string?</ParentMobilePhone1>
    <ParentMobilePhone2>string?</ParentMobilePhone2>
    <ParentLastName>string?</ParentLastName>
    <ParentName>string?</ParentName>
    <ParentMiddleName>string?</ParentMiddleName>
    <CardUses />
    <Informers />
    <Tags />
    <Deposit Updated="N|...">
      <Item ID="UUID" Time="DD.MM.YYYY HH:MM:SS"
            ItemType="In|Out|WriteOff|Pay|Debt|Undebt"
            Sum="decimal" UserID="UUID" ComputerID="string"
            PaymentType="Cash|NonCash" Annotation="string?" />
    </Deposit>
    <Bonus />
    <Comments />
    <Tasks />
    <StatusChanges Updated="N|...">
      <Item ID="UUID" ID_Creator="UUID" ID_Status="UUID" Created="..." />
    </StatusChanges>
    <Files />
  </Item>
</Client>
```

**Особенности Client:**
- 18 286 записей суммарно (Client.xml: 17 556 + Client001.xml: 730)
- 647 записей с `Removed="true"` (3.5%)
- `Deposit` — единственный не-пустой вложенный элемент (Comments, Tasks, StatusChanges, Tags, Informers, Files — всегда пустые)
- `BirthDate`, `ID_Foto`, `ID_Status` имеют атрибут `Updated` на дочернем элементе
- Client001.xml содержит новое поле `ParentName`
- `LastName` содержит Фамилию Имя слитно (разделение по пробелу)

### 2. Teacher (преподаватели)

```xml
<Teacher>
  <Item Updated="N|UserID|ComputerID|DD.MM.YYYY HH:MM:SS"
        Created="N|UserID|ComputerID|DD.MM.YYYY HH:MM:SS"
        Removed="true?">
    <ID>UUID</ID>
    <LastName Updated="N|...">string</LastName>
    <Name Updated="N|...">string?</Name>
    <MiddleName Updated="N|...">string?</MiddleName>
    <ID_Foto>UUID?</ID_Foto>
    <BirthDate>DD.MM.YYYY?</BirthDate>
    <MobilePhone1>string</MobilePhone1>
    <OwnSalaryOptions>True|False</OwnSalaryOptions>
    <Status>Active|Closed</Status>
    <ID_Sex>UUID</ID_Sex>
    <SalaryOptions>
      <GroupOptions>
        <Type>VisitsCountSum|Fixed|Percent|None</Type>
        <FixedPay>decimal</FixedPay>
        <AccountPercent>decimal</AccountPercent>
        <AccountSelectType>ByCreateDate</AccountSelectType>
        <AccountCostWithDiscount>true|false</AccountCostWithDiscount>
        <AccountCostDivide>true|false</AccountCostDivide>
        <AccountCostDivideDays>int</AccountCostDivideDays>
        <AccountCostDivideExtend>true|false</AccountCostDivideExtend>
        <AccountPayForUngroupVisits>true|false</AccountPayForUngroupVisits>
        <AccountPayForUngroupVisitsSum>decimal</AccountPayForUngroupVisitsSum>
        <AccountPayForSingleTrainings>true|false</AccountPayForSingleTrainings>
        <AccountPayForSingleTrainingsPercent>decimal</AccountPayForSingleTrainingsPercent>
        <AccountIncludeFreeSingles>true|false</AccountIncludeFreeSingles>
        <VisitPercent>decimal</VisitPercent>
        <VisitSinglePercent>decimal</VisitSinglePercent>
        <VisitPayByUnlimitedAccount>true|false</VisitPayByUnlimitedAccount>
        <VisitPayByUnlimitedAccountSum>decimal</VisitPayByUnlimitedAccountSum>
        <MinTeacherPay>decimal</MinTeacherPay>
        <IncludeFreeSingles>true|false</IncludeFreeSingles>
        <UseScheduleForSalary>true|false</UseScheduleForSalary>
        <RangePays>
          <Item>
            <ID>UUID</ID>
            <From>int</From>
            <To>int</To>
            <PayType>Fixed|Percent</PayType>
            <Pay>decimal</Pay>
          </Item>
        </RangePays>
      </GroupOptions>
    </SalaryOptions>
    <Styles />
  </Item>
</Teacher>
```

**Особенности Teacher:**
- 30 записей, 4 удалённых
- `SalaryOptions` — самая сложная структура в XML: 19 полей в GroupOptions + RangePays
- RangePays — пооплатные диапазоны (от 1 до 12+ занятий с прогрессивной ставкой)
- `OwnSalaryOptions` — флаг индивидуальных настроек (если False — используются настройки из Group)
- `Styles` — всегда пустой (стили преподавания не используются)

### 3. Group (группы/программы)

```xml
<Group>
  <Item Updated="N|UserID|ComputerID|DD.MM.YYYY HH:MM:SS"
        Created="N|UserID|ComputerID|DD.MM.YYYY HH:MM:SS"
        Removed="true?">
    <ID>UUID</ID>
    <Colour>FF000080</Colour>
    <Status>Admission|Closed</Status>
    <ID_Style>UUID</ID_Style>
    <ID_Teacher>UUID</ID_Teacher>
    <OwnSalaryOptions>True|False</OwnSalaryOptions>
    <OwnSecondSalaryOptions>True|False</OwnSecondSalaryOptions>
    <SalaryOptions>
      <GroupOptions>...</GroupOptions>  <!-- Аналогично Teacher -->
    </SalaryOptions>
    <SecondSalaryOptions>
      <GroupOptions>...</GroupOptions>
    </SecondSalaryOptions>
    <Schedule>
      <Item>
        <Day>Monday|Tuesday|...</Day>
        <Time><From>HH:MM</From><To>HH:MM</To></Time>
        <ID_Hall>UUID</ID_Hall>
        <Frequency>Regular|Single</Frequency>
        <Range><From>DD.MM.YYYY</From><To>DD.MM.YYYY?</To></Range>
      </Item>
    </Schedule>
    <Clients />
  </Item>
</Group>
```

**Особенности Group:**
- 157 записей, 34 удалённых (21.6% — высокий процент удалений)
- `SecondSalaryOptions` — вторые настройки зарплаты (редко используются, OwnSecondSalaryOptions=False)
- `Schedule` — массив расписаний (одна группа может иметь несколько занятий в неделю)
- `Clients` — всегда пустой (клиенты привязаны через SingleTraining)
- `Colour` в формате AARRGGBB (ARGB из WPF/.NET)

### 4. SingleTraining (индивидуальные посещения)

```xml
<SingleTraining>
  <Item Updated="N|UserID|ComputerID|DD.MM.YYYY HH:MM:SS"
        Created="N|UserID|ComputerID|DD.MM.YYYY HH:MM:SS"
        Removed="true?">
    <ID>UUID</ID>
    <VisitDate>DD.MM.YYYY</VisitDate>
    <PaymentType>Cash|NonCash</PaymentType>
    <ID_Client>UUID</ID_Client>
    <ID_Group>UUID</ID_Group>
    <Cost>decimal</Cost>
    <SingleTrainingTypeName>string</SingleTrainingTypeName>
    <SingleTrainingTypeCost>decimal</SingleTrainingTypeCost>
    <Deposit>
      <Item ID="UUID" Time="DD.MM.YYYY HH:MM:SS"
            ItemType="Pay|WriteOff|Debt|Undebt"
            Sum="decimal" UserID="UUID" ComputerID="string"
            PaymentType="Cash|NonCash" />
    </Deposit>
    <Bonus />
  </Item>
</SingleTraining>
```

**Особенности SingleTraining:**
- 12 400 записей только в основном файле, суммарно ~15 000+
- 323 удалённых в основном файле (2.6%)
- 14 партиций (SingleTraining001–014.xml) — разбито по объёму
- `SingleTrainingTypeName` — названия типов: "1", "1/1 5%", "1,5", "2", "3" и т.д.
- `Cost` — decimal с запятой как разделителем (`262,5`)
- `Deposit` — всегда 2 записи: Pay (оплата) + WriteOff (списание)
- Нет вложенных Comments, Tasks, StatusChanges — только Deposit

### Ключевые структурные характеристики донора:

1. **Партиционирование по времени:** Client разбит на 2 файла по годам (2019-2023 и 2024-2026), SingleTraining — на 15 файлов
2. **Update tracking:** Атрибуты `Updated` на `<Item>` и на дочерних элементах (`BirthDate Updated="..."`) — механизм инкрементальной синхронизации
3. **Формат меток:** `N|UserID|ComputerID|DD.MM.YYYY HH:MM:SS` — версия|кто|откуда|когда
4. **Soft delete:** `Removed="true"` — не везде (Client, SingleTraining имеют; Teacher, Group имеют)
5. **Decimal с запятой:** `Cost>262,5</Cost>` — русский формат чисел
6. **Пустые элементы:** `<CardUses />`, `<Informers />`, `<Tags />`, `<Files />`, `<Bonus />`, `<Comments />`, `<Tasks />`, `<Styles />`, `<Clients />` — всегда пустые в текущих данных
7. **Nested Deposit:** Единственный функционально заполненный вложенный элемент — финансовые транзакции
8. **SalaryOptions — complex nested:** 19+ полей GroupOptions + массив RangePays — самая сложная вложенная структура
9. **ID_Foto — UUID ссылки:** Ссылки на папки в `Files/` для привязки фотографий
10. **ParentName — новое поле:** Только в Client001.xml, указывает на эволюцию структуры данных

---

## Оценка структуры донора: 3/5

### Аргументация оценки:

**Плюсы (+):**
- **Простая иерархия на верхнем уровне** — один уровень `<Item>`, без глубокой вложенности (кроме SalaryOptions)
- **Чёткое разделение сущностей** — Client, Teacher, Group, SingleTraining — каждая в отдельном файле
- **Update tracking** — атрибуты Updated/Created позволяют отслеживать изменения и делать инкрементальную синхронизацию
- **Soft delete** — `Removed="true"` для мягкого удаления записей
- **Deposit внутри сущности** — финансовые транзакции хранятся рядом с данными, упрощает чтение
- **Партиционирование** — разделение больших таблиц на файлы (Client, SingleTraining)
- **Цветовые коды** — `Colour` в AARRGGBB для визуализации

**Минусы (-):**
- **SalaryOptions — чрезмерная вложенность:** 19 полей в GroupOptions + RangePays — это 20+ вложенных элементов. Требует 8 таблиц для полной нормализации (Teacher × 2 + Group × 2, каждая с options + range_pays).
- **Пустые элементы:** `<CardUses />`, `<Informers />`, `<Tags />`, `<Files />`, `<Bonus />`, `<Comments />`, `<Tasks />` — всегда пустые. Это мусор в XML, который нужно игнорировать при парсинге.
- **Decimal с запятой:** `262,5` вместо `262.5` — требует специальной обработки при парсинге чисел.
- **Updated на дочерних элементах:** `BirthDate Updated="..."`, `ID_Foto Updated="..."` — нужно проверять наличие атрибута на каждом дочернем элементе, усложняет парсинг.
- **Высокий процент удалений в Group:** 34 из 157 (21.6%) — нужно тщательно фильтровать.
- **Нет валидации типов:** Всё — строки, типы определяются контекстом.
- **Разная структура между партициями:** Client001.xml содержит `ParentName`, которого нет в Client.xml — нужно объединять поля из всех партиций.
- **Cost с запятой:** `262,5` — не стандартный decimal формат.
- **14 партиций SingleTraining:** Сложно управлять, легко забыть файл при импорте.

### Почему не 4:
SalaryOptions с 19+ полями и RangePays — сложная вложенная структура. Но она полностью нормализуется в 4 таблицы (основные + вторые настройки × options + range_pays). Это не антипаттерн, а особенность DanceStudio: зарплата рассчитывается по прогрессивной шкале.

### Почему не ниже 3:
Структура в целом рабочая — основные поля (ID, внешние ключи, даты) на месте, update tracking позволяет делать инкрементальную синхронизацию.

---

## Рекомендуемое хранение у нас (PostgreSQL)

### Таблица: `users` (клиенты)

```sql
CREATE TABLE users (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone1                  VARCHAR(20) NOT NULL,
    phone2                  VARCHAR(20),
    last_name               VARCHAR(200) NOT NULL,
    first_name              VARCHAR(100),
    middle_name             VARCHAR(100),
    birth_date              DATE,
    email                   VARCHAR(200),
    sex_id                  UUID REFERENCES sexes(id),
    status_id               UUID,
    agreement_number        INTEGER,
    barcode                 VARCHAR(50),
    is_archived             BOOLEAN DEFAULT FALSE,
    id_foto                 UUID,
    id_friend               UUID REFERENCES users(id),  -- self-ref реферал
    parent_phone1           VARCHAR(20),
    parent_phone2           VARCHAR(20),
    parent_last_name        VARCHAR(200),
    parent_first_name       VARCHAR(100),
    parent_middle_name      VARCHAR(100),
    annotation              TEXT,
    ds_removed              BOOLEAN DEFAULT FALSE,
    ds_updated              TIMESTAMP,
    ds_created              TIMESTAMP,
    created_at              TIMESTAMP DEFAULT NOW(),
    updated_at              TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_phone1 ON users(phone1);
CREATE INDEX idx_users_status ON users(status_id);
CREATE INDEX idx_users_archived ON users(is_archived);
```

**Аргументация:**
- `last_name` содержит Фамилию Имя слитно — можно добавить триггер для разделения
- `id_friend` — self-referencing FK для реферальной системы
- `parent_*` — поля для родителей (детские клиенты)
- `ds_removed` — мягкое удаление из DanceStudio
- `ds_updated/ds_created` — метаданные из DanceStudio для синхронизации
- `phone1` — основной индекс, т.к. используется для входа в ЛК

### Таблица: `user_balances` (Deposit клиентов)

```sql
CREATE TABLE user_balances (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID NOT NULL REFERENCES users(id),
    operation_time          TIMESTAMP NOT NULL,
    item_type               VARCHAR(20) NOT NULL CHECK (item_type IN ('In', 'Out', 'WriteOff', 'WriteOffCancel', 'Pay', 'Debt', 'Undebt')),
    amount                  DECIMAL(12, 2) NOT NULL,
    user_id_ds              UUID,  -- кто провёл операцию
    computer_id             VARCHAR(50),
    payment_type            VARCHAR(20),  -- Cash / NonCash
    annotation              TEXT
);

CREATE INDEX idx_user_balances_user ON user_balances(user_id);
CREATE INDEX idx_user_balances_time ON user_balances(operation_time);
```

**Аргументация:**
- Выносим Deposit из Client в отдельную таблицу — нормализация
- `item_type` — CHECK-ограничение для типов операций
- `amount` — DECIMAL(12,2) для точности

### Таблица: `trainers` (преподаватели)

```sql
CREATE TABLE trainers (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    last_name               VARCHAR(200) NOT NULL,
    first_name              VARCHAR(100),
    middle_name             VARCHAR(100),
    id_foto                 UUID,
    birth_date              DATE,
    phone1                  VARCHAR(20),
    sex_id                  UUID REFERENCES sexes(id),
    own_salary_options      BOOLEAN DEFAULT FALSE,
    status                  VARCHAR(20) DEFAULT 'Active' CHECK (status IN ('Active', 'Closed')),
    ds_removed              BOOLEAN DEFAULT FALSE,
    ds_updated              TIMESTAMP,
    ds_created              TIMESTAMP,
    created_at              TIMESTAMP DEFAULT NOW(),
    updated_at              TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_trainers_status ON trainers(status);
```

### Таблица: `trainer_salary_options` (настройки зарплаты преподавателя)

```sql
CREATE TABLE trainer_salary_options (
    trainer_id                    UUID PRIMARY KEY REFERENCES trainers(id),
    group_type                    VARCHAR(30),              -- VisitsCountSum / Fixed / Percent / None
    fixed_pay                     DECIMAL(10, 2),           -- 300
    account_percent               DECIMAL(5, 2),            -- 50
    account_select_type           VARCHAR(30),              -- ByCreateDate / ...
    account_cost_with_discount    BOOLEAN DEFAULT FALSE,    -- true/false
    account_cost_divide           BOOLEAN DEFAULT FALSE,    -- true/false
    account_cost_divide_days      INTEGER,                  -- 30
    account_cost_divide_extend    BOOLEAN DEFAULT FALSE,    -- true/false
    account_pay_for_ungroup_visits BOOLEAN DEFAULT FALSE,   -- true/false
    account_pay_for_ungroup_visits_sum DECIMAL(10, 2),      -- 100
    account_pay_for_single_trainings BOOLEAN DEFAULT FALSE, -- true/false
    account_pay_for_single_trainings_percent DECIMAL(5, 2), -- 50
    account_include_free_singles  BOOLEAN DEFAULT FALSE,    -- true/false
    visit_percent                 DECIMAL(5, 2),            -- 50
    visit_single_percent          DECIMAL(5, 2),            -- 50
    visit_pay_by_unlimited_account BOOLEAN DEFAULT FALSE,   -- true/false
    visit_pay_by_unlimited_account_sum DECIMAL(10, 2),      -- 100
    min_teacher_pay               DECIMAL(10, 2),            -- 0
    include_free_singles          BOOLEAN DEFAULT FALSE,    -- true/false
    use_schedule_for_salary       BOOLEAN DEFAULT FALSE,    -- true/false
    updated_at                    TIMESTAMP
);
```

**Аргументация:**
- 1:1 связь с `trainers` — Primary Key = FK → `trainers.id`. Один тренер = одна запись настроек.
- 19 полей GroupOptions из XML → 19 колонок. Это нормальная нормализация, а не JSONB.
- `group_type` — ключевой тип расчёта зарплаты: `VisitsCountSum` (по количеству посещений и сумме), `Fixed` (фиксированная), `Percent` (процент), `None` (нет зарплаты).
- `visit_percent` / `visit_single_percent` — процент от оплаты за групповое / индивидуальное занятие.
- `account_percent` — процент от абонемента.
- `account_cost_divide_days` — если `account_cost_divide = true`, стоимость абонемента делится на это количество дней.
- `account_pay_for_ungroup_visits_sum` — фиксированная сумма за внегрупповые посещения.
- `account_pay_for_single_trainings_percent` — процент за индивидуальные занятия (отличен от visit_single_percent — это от абонемента, visit_single_percent — от разового визита).
- `account_select_type` — тип выбора абонемента для расчёта зарплаты (по дате создания и т.д.).
- `account_cost_with_discount` — учитывать ли скидку при расчёте стоимости абонемента.
- `account_cost_divide` / `account_cost_divide_extend` — делить ли стоимость абонемента по дням, продлевать ли при этом абонемент.
- `account_pay_for_ungroup_visits` / `account_pay_for_single_trainings` / `account_include_free_singles` / `include_free_singles` — включать ли в расчёт внегрупповые визиты, индивидуальные занятия, бесплатные визиты.
- `visit_pay_by_unlimited_account` / `visit_pay_by_unlimited_account_sum` — разрешить ли оплату безлимитным абонементом и какую сумму учитывать.
- `min_teacher_pay` — минимальная зарплата преподавателя.
- `use_schedule_for_salary` — использовать ли расписание при расчёте зарплаты.
- `updated_at` — время последнего обновления настроек (парсится из `Updated` атрибута XML).

### Таблица: `trainer_salary_range_pays` (пооплатные диапазоны преподавателя)

```sql
CREATE TABLE trainer_salary_range_pays (
    trainer_id        UUID NOT NULL REFERENCES trainers(id),
    range_from        INTEGER NOT NULL,     -- от скольких занятий (1, 2, 3...)
    range_to          INTEGER NOT NULL,     -- до скольких занятий
    pay_type          VARCHAR(20) NOT NULL, -- Fixed / Percent
    pay               DECIMAL(10, 2) NOT NULL, -- 200 / 50
    PRIMARY KEY (trainer_id, range_from)
);
```

**Аргументация:**
- 1:N связь с `trainers` — один тренер имеет N диапазонов.
- `range_from` / `range_to` — диапазон количества занятий (1–1, 2–2, 3–3, ... 10–10, 11–11, 12–12...). В текущих данных каждый диапазон = 1 занятие (From = To).
- `pay_type` — тип оплаты в диапазоне: `Fixed` (фиксированная сумма) или `Percent` (процент).
- `pay` — сумма или процент (зависит от pay_type).
- Пример: тренер Кравец имеет 12 диапазонов — от 1 до 12 занятий, каждый с фиксированной ставкой (200, 400, 690, 920, 1250, 1500, 1750, 2200, 2475, 3000, 3300, 3600).
- Composite PK `(trainer_id, range_from)` предотвращает дублирование диапазонов.

### Таблица: `trainer_salary_options__second` (вторые настройки зарплаты преподавателя)

```sql
CREATE TABLE trainer_salary_options__second (
    trainer_id                    UUID PRIMARY KEY REFERENCES trainers(id),
    group_type                    VARCHAR(30),
    fixed_pay                     DECIMAL(10, 2),
    account_percent               DECIMAL(5, 2),
    account_select_type           VARCHAR(30),
    account_cost_with_discount    BOOLEAN DEFAULT FALSE,
    account_cost_divide           BOOLEAN DEFAULT FALSE,
    account_cost_divide_days      INTEGER,
    account_cost_divide_extend    BOOLEAN DEFAULT FALSE,
    account_pay_for_ungroup_visits BOOLEAN DEFAULT FALSE,
    account_pay_for_ungroup_visits_sum DECIMAL(10, 2),
    account_pay_for_single_trainings BOOLEAN DEFAULT FALSE,
    account_pay_for_single_trainings_percent DECIMAL(5, 2),
    account_include_free_singles  BOOLEAN DEFAULT FALSE,
    visit_percent                 DECIMAL(5, 2),
    visit_single_percent          DECIMAL(5, 2),
    visit_pay_by_unlimited_account BOOLEAN DEFAULT FALSE,
    visit_pay_by_unlimited_account_sum DECIMAL(10, 2),
    min_teacher_pay               DECIMAL(10, 2),
    include_free_singles          BOOLEAN DEFAULT FALSE,
    use_schedule_for_salary       BOOLEAN DEFAULT FALSE,
    updated_at                    TIMESTAMP
);

CREATE TABLE trainer_salary_range_pays__second (
    trainer_id        UUID NOT NULL REFERENCES trainers(id),
    range_from        INTEGER NOT NULL,
    range_to          INTEGER NOT NULL,
    pay_type          VARCHAR(20) NOT NULL,
    pay               DECIMAL(10, 2) NOT NULL,
    PRIMARY KEY (trainer_id, range_from)
);
```

**Аргументация:**
- Аналогично `trainer_salary_options` и `trainer_salary_range_pays`, но для вторых настроек зарплаты.
- `OwnSecondSalaryOptions` в `trainers` — флаг, используются ли вторые настройки (в данных всегда `False`).
- naming: `__second` суффикс отделяет вторые настройки от основных, чтобы не было конфликта имён.
- Можно использовать `salary_option_type` в одной таблице, но так как структура идентична, дублирование таблиц яснее и проще миграции.

### Таблица: `programs` (группы/программы)

```sql
CREATE TABLE programs (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    colour                  VARCHAR(8),  -- AARRGGBB
    status                  VARCHAR(20) DEFAULT 'Admission',
    style_id                UUID REFERENCES styles(id),
    trainer_id              UUID REFERENCES trainers(id),
    own_salary_options      BOOLEAN DEFAULT FALSE,
    own_second_salary       BOOLEAN DEFAULT FALSE,
    ds_removed              BOOLEAN DEFAULT FALSE,
    ds_updated              TIMESTAMP,
    ds_created              TIMESTAMP,
    created_at              TIMESTAMP DEFAULT NOW(),
    updated_at              TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_programs_trainer ON programs(trainer_id);
CREATE INDEX idx_programs_style ON programs(style_id);
```

### Таблица: `program_salary_options` (настройки зарплаты для программы)

```sql
CREATE TABLE program_salary_options (
    program_id                    UUID PRIMARY KEY REFERENCES programs(id),
    group_type                    VARCHAR(30),
    fixed_pay                     DECIMAL(10, 2),
    account_percent               DECIMAL(5, 2),
    account_select_type           VARCHAR(30),
    account_cost_with_discount    BOOLEAN DEFAULT FALSE,
    account_cost_divide           BOOLEAN DEFAULT FALSE,
    account_cost_divide_days      INTEGER,
    account_cost_divide_extend    BOOLEAN DEFAULT FALSE,
    account_pay_for_ungroup_visits BOOLEAN DEFAULT FALSE,
    account_pay_for_ungroup_visits_sum DECIMAL(10, 2),
    account_pay_for_single_trainings BOOLEAN DEFAULT FALSE,
    account_pay_for_single_trainings_percent DECIMAL(5, 2),
    account_include_free_singles  BOOLEAN DEFAULT FALSE,
    visit_percent                 DECIMAL(5, 2),
    visit_single_percent          DECIMAL(5, 2),
    visit_pay_by_unlimited_account BOOLEAN DEFAULT FALSE,
    visit_pay_by_unlimited_account_sum DECIMAL(10, 2),
    min_teacher_pay               DECIMAL(10, 2),
    include_free_singles          BOOLEAN DEFAULT FALSE,
    use_schedule_for_salary       BOOLEAN DEFAULT FALSE,
    updated_at                    TIMESTAMP
);
```

**Аргументация:**
- Аналогично `trainer_salary_options` — 19 полей GroupOptions → 19 колонок.
- 1:1 связь с `programs` — Primary Key = FK → `programs.id`.
- `own_salary_options` в `programs` — флаг: если `False`, используются настройки из `trainers.salary_options` (настройки преподавателя). Если `True` — используются индивидуальные настройки программы.
- `own_second_salary` в `programs` — флаг использования вторых настроек программы.

### Таблица: `program_salary_range_pays` (пооплатные диапазоны программы)

```sql
CREATE TABLE program_salary_range_pays (
    program_id        UUID NOT NULL REFERENCES programs(id),
    range_from        INTEGER NOT NULL,
    range_to          INTEGER NOT NULL,
    pay_type          VARCHAR(20) NOT NULL,
    pay               DECIMAL(10, 2) NOT NULL,
    PRIMARY KEY (program_id, range_from)
);
```

### Таблица: `program_salary_options__second` (вторые настройки зарплаты для программы)

```sql
CREATE TABLE program_salary_options__second (
    program_id                    UUID PRIMARY KEY REFERENCES programs(id),
    group_type                    VARCHAR(30),
    fixed_pay                     DECIMAL(10, 2),
    account_percent               DECIMAL(5, 2),
    account_select_type           VARCHAR(30),
    account_cost_with_discount    BOOLEAN DEFAULT FALSE,
    account_cost_divide           BOOLEAN DEFAULT FALSE,
    account_cost_divide_days      INTEGER,
    account_cost_divide_extend    BOOLEAN DEFAULT FALSE,
    account_pay_for_ungroup_visits BOOLEAN DEFAULT FALSE,
    account_pay_for_ungroup_visits_sum DECIMAL(10, 2),
    account_pay_for_single_trainings BOOLEAN DEFAULT FALSE,
    account_pay_for_single_trainings_percent DECIMAL(5, 2),
    account_include_free_singles  BOOLEAN DEFAULT FALSE,
    visit_percent                 DECIMAL(5, 2),
    visit_single_percent          DECIMAL(5, 2),
    visit_pay_by_unlimited_account BOOLEAN DEFAULT FALSE,
    visit_pay_by_unlimited_account_sum DECIMAL(10, 2),
    min_teacher_pay               DECIMAL(10, 2),
    include_free_singles          BOOLEAN DEFAULT FALSE,
    use_schedule_for_salary       BOOLEAN DEFAULT FALSE,
    updated_at                    TIMESTAMP
);

CREATE TABLE program_salary_range_pays__second (
    program_id        UUID NOT NULL REFERENCES programs(id),
    range_from        INTEGER NOT NULL,
    range_to          INTEGER NOT NULL,
    pay_type          VARCHAR(20) NOT NULL,
    pay               DECIMAL(10, 2) NOT NULL,
    PRIMARY KEY (program_id, range_from)
);
```

**Аргументация:**
- Аналогично `trainer_salary_options__second` — вторые настройки зарплаты программы.
- `OwnSecondSalaryOptions` в `programs` — всегда `False` в текущих данных.

### Таблица: `program_schedules` (расписание программ)

```sql
CREATE TABLE program_schedules (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id              UUID NOT NULL REFERENCES programs(id),
    day_of_week             VARCHAR(20) NOT NULL,
    time_from               TIME NOT NULL,
    time_to                 TIME NOT NULL,
    hall_id                 UUID REFERENCES halls(id),
    frequency               VARCHAR(20) DEFAULT 'Regular',
    range_from              DATE,
    range_to                DATE,
    base_date               DATE
);

CREATE INDEX idx_program_schedules_program ON program_schedules(program_id);
```

### Таблица: `user_visits` (SingleTraining)

```sql
CREATE TABLE user_visits (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_date              DATE NOT NULL,
    payment_type            VARCHAR(20) DEFAULT 'Cash',
    user_id                 UUID NOT NULL REFERENCES users(id),
    program_id              UUID NOT NULL REFERENCES programs(id),
    cost                    DECIMAL(10, 2) NOT NULL,
    training_type_name      VARCHAR(100) NOT NULL,  -- "1", "1/1 5%", "1,5"
    training_type_cost      DECIMAL(10, 2) NOT NULL,
    ds_removed              BOOLEAN DEFAULT FALSE,
    ds_updated              TIMESTAMP,
    ds_created              TIMESTAMP,
    created_at              TIMESTAMP DEFAULT NOW(),
    updated_at              TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_user_visits_user ON user_visits(user_id);
CREATE INDEX idx_user_visits_program ON user_visits(program_id);
CREATE INDEX idx_user_visits_date ON user_visits(visit_date);
```

### Таблица: `visit_payments` (Deposit SingleTraining)

```sql
CREATE TABLE visit_payments (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id                UUID NOT NULL REFERENCES user_visits(id),
    operation_time          TIMESTAMP NOT NULL,
    item_type               VARCHAR(20) NOT NULL CHECK (item_type IN ('Pay', 'WriteOff', 'Debt', 'Undebt')),
    amount                  DECIMAL(10, 2) NOT NULL,
    user_id_ds              UUID,
    computer_id             VARCHAR(50),
    payment_type            VARCHAR(20)
);

CREATE INDEX idx_visit_payments_visit ON visit_payments(visit_id);
```

---

## Сравнение: донор vs рекомендация

| Критерий | Донор (XML) | Рекомендация (PG) |
|---|---|---|
| Структура | Flat XML, 1 уровень `<Item>` | Полностью реляционные таблицы, нормализация до 3NF |
| Client | 18 286 записей в 2 файлах | 1 таблица `users` |
| Teacher Salary | 19 полей + RangePays вложенно | 4 таблицы: `trainer_salary_options` (1:1), `trainer_salary_range_pays` (1:N), `trainer_salary_options__second` (1:1), `trainer_salary_range_pays__second` (1:N) |
| Group Schedule | Массив `<Item>` внутри `<Group>` | Отдельная таблица `program_schedules` |
| SingleTraining | 15 партиций XML | 1 таблица `user_visits` |
| Deposit | Вложенный `<Deposit>` внутри сущности | Отдельная таблица `user_balances` / `visit_payments` |
| Decimal формат | Запятая (`262,5`) | Стандартный `DECIMAL(10,2)` |
| Soft delete | `Removed="true"` attr | `ds_removed BOOLEAN` |
| Update tracking | `Updated="N\|...\|..."` attr | `ds_updated TIMESTAMP` |
| Пустые элементы | `<Tags />`, `<Comments />` и т.д. | Игнорируются при импорте |
| Self-ref реферал | `ID_Friend` attr на `<Item>` | `id_friend UUID REFERENCES users(id)` |

---

## Наблюдения по доменам

### Client — основная сущность
Самая крупная сущность (18 286 записей). Содержит основную финансовую историю в `Deposit` (пополнения/списания). Поля для родителей (`Parent*`) — для детских клиентов. `Archive` — мягкая архивация, отдельная от `Removed`.

### Teacher — преподаватели с прогрессивной зарплатой
30 записей, но самая сложная структура данных. `SalaryOptions` с 19 полями + `RangePays` — прогрессивная шкала оплаты за занятия (1 посещение = 200, 2 = 400, 3 = 690 и т.д.). `OwnSalaryOptions` — флаг индивидуальных настроек.

### Group — группы/программы
157 записей, 21.6% удалённых. Содержит расписание (`Schedule`) — массив с днями недели, временем, залом. `SalaryOptions` аналогичны Teacher, но с отдельными ставками. `SecondSalaryOptions` — редко используются.
### SingleTraining — визиты

Самый объёмный источник транзакционных данных. 12 400 записей в одном файле, 15 файлов суммарно. `SingleTrainingTypeName` — типы занятий ("1", "1/1 5%", "1,5"). `Cost` с русской decimal-запятой. Каждый визит имеет 2 записи в Deposit: Pay + WriteOff.

### SingleTraining001–005 — партиционированные визиты (D1.4)

Пять файлов партиционированных данных SingleTraining (364 270 строк суммарно). Структура **идентична** основному SingleTraining.xml — это одна сущность, разбитая по объёму файлов (~72K строк на файл). Ключевые отличия от основного файла:
- `Deposit` содержит только `WriteOff` (списание), нет `Pay` (в D1.1 было Pay+WriteOff)
- Порядок полей в `<Item>` не фиксирован — `Annotation` может быть до или после `ID_Client`
- `Cost=0` в большинстве записей — реальная стоимость в `SingleTrainingTypeCost`
- Типы занятий включают "полуторка", "бесплатно", "с 5% скидкой"
- Нет `Removed="true"` в выборке 5 файлов
- Единый UserID и ComputerID во всех записях

### SalaryOptions — сложная структура, но полностью нормализуется
19 полей GroupOptions + массив RangePays — это 20+ вложенных элементов. Маппится на 4 таблицы: `trainer_salary_options` (1:1), `trainer_salary_range_pays` (1:N), `trainer_salary_options__second` (1:1), `trainer_salary_range_pays__second` (1:N). Для программ аналогично: `program_salary_options`, `program_salary_range_pays`, `program_salary_options__second`, `program_salary_range_pays__second`. Итого 8 таблиц для зарплатных настроек Teacher + Group.
---

# Анализ сущностей тикета D1.2 (Account, Charge, Product, Reservation)

## Полученные сущности

**Назначение:** Финансовые транзакции, товары/услуги, бронирования и расходы танцевальной студии.

**Источник:** 5 XML-файлов в `данные/_DB/`:
- `Account.xml` — ~50 000+ записей абонентов (2019-2023)
- `Account001.xml` — ~10 000+ записей абонентов (2024-2026)
- `Charge.xml` — ~15 записей категорий расходов
- `Product.xml` — ~100 записей товаров/услуг
- `Reservation.xml` — ~500 записей бронирований

**Общий объём:** ~62 000+ записей, 6 XML-файлы, ~9.3 MB

---

## Структурное представление в доноре (XML)

### 1. Account (абонементы/счета клиентов)

```xml
<Account>
  <Item Updated="N|UserID|ComputerID|DD.MM.YYYY HH:MM:SS"
        Created="N|UserID|ComputerID|DD.MM.YYYY HH:MM:SS"
        Removed="true?">
    <ID>UUID</ID>
    <Number>int</Number>
    <CreateDate>DD.MM.YYYY</CreateDate>
    <BeginDate>DD.MM.YYYY</BeginDate>
    <DaysCount>int</DaysCount>
    <IsPerpetual>True|False</IsPerpetual>
    <IsUnlimited>True|False</IsUnlimited>
    <TrainingCount>int</TrainingCount>
    <FreeTrainingCount>int</FreeTrainingCount>
    <PaymentType>Cash|NonCash</PaymentType>
    <ID_Client>UUID</ID_Client>
    <OriginalCost>decimal</OriginalCost>
    <Discount>decimal</Discount>
    <DiscountPercent>decimal</DiscountPercent>
    <AddDaysCount>int</AddDaysCount>
    <AccountTypeName>string</AccountTypeName>
    <AccountTypeCost>decimal</AccountTypeCost>
    <Annotation>string?</Annotation>
    <Groups>
      <Item ID="UUID" />
    </Groups>
    <Reservations />
    <BurnRes />
    <Stages />
    <Visits>
      <Item Date="DD.MM.YYYY" ID_Group="UUID" Created="..." />
    </Visits>
    <Deposit>
      <Item ID="UUID" Time="DD.MM.YYYY HH:MM:SS"
            ItemType="Pay|WriteOff|Debt|Undebt"
            Sum="decimal" UserID="UUID" ComputerID="string"
            PaymentType="Cash|NonCash" PacketID="UUID?" />
    </Deposit>
    <Bonus />
  </Item>
</Account>
```

**Особенности Account:**
- 2 файла (Account.xml, Account001.xml) — партиционированные данные
- `DaysCount` — 28, 30, 60, 90 — стандартные периоды
- `TrainingCount` + `FreeTrainingCount` — общее кол-во занятий + бонусные
- `IsPerpetual` / `IsUnlimited` — бессрочный / безлимитный абонемент
- `AccountTypeName` — названия: "1 со скидкой 5%", "Ноябрь", "Ноябрь50%" — смешение тарифа и скидки
- `Visits` — массив посещений с `Date` и `ID_Group` (ссылка на программу)
- `Deposit` — финансовые транзакции: Pay (оплата), WriteOff (списание), Debt/Undebt (долг)
- `Groups` — связанные группы/программы (многие ко многим)
- `Reservations`, `BurnRes`, `Stages`, `Bonus` — всегда пустые

### 2. Charge (категории расходов)

```xml
<Charge>
  <Item Updated="N|UserID|ComputerID|DD.MM.YYYY HH:MM:SS"
        Created="N|UserID|ComputerID|DD.MM.YYYY HH:MM:SS"
        Removed="true?">
    <ID>UUID</ID>
    <Name>string</Name>
    <Description>string</Description>
    <Annotation>string?</Annotation>
    <Items>
      <Item ID="UUID">
        <Name>string</Name>
        <Description>string?</Description>
      </Item>
    </Items>
    <Packets Updated="N|...">
      <Item ID="UUID" Time="DD.MM.YYYY HH:MM:SS"
            ItemID="UUID" Sum="decimal" Count="int"
            Annotation="string?" />
    </Packets>
  </Item>
</Charge>
```

**Особенности Charge:**
- ~15 категорий расходов (Реклама, Уборка, Аренда помещения, Канцтовары, Инвентарь, стаканчики и т.д.)
- Вложенная структура: категория → подкатегория (Items) → фактический расход (Packets)
- `Packets` — только 1 запись в текущих данных (Уборка → Зар. плата уборщице → 7000 руб.)
- Остальные категории имеют пустые `Packets` — расходы ещё не записаны
- `Updated` на `<Packets>` — отслеживание изменений пакетов расходов
- Нет `Removed` атрибута на элементе — нет мягкого удаления в текущих данных

### 3. Product (товары/услуги студии)

```xml
<Product>
  <Item Updated="N|UserID|ComputerID|DD.MM.YYYY HH:MM:SS"
        Created="N|UserID|ComputerID|DD.MM.YYYY HH:MM:SS"
        Removed="true?">
    <ID>UUID</ID>
    <Name>string</Name>
    <Barcode>string?</Barcode>
    <Measurement>string</Measurement>
    <Unit>Piece</Unit>
    <Status>Active|Closed</Status>
    <PurchaseCost>decimal</PurchaseCost>
    <Markup>decimal</Markup>
    <MarkupPercent>decimal</MarkupPercent>
    <Annotation>string?</Annotation>
    <PurchasePackets>
      <Item Count="int" PurchaseCost="decimal" RetailCost="decimal"
            Paid="decimal" UserID="UUID" Time="DD.MM.YYYY HH:MM:SS" />
    </PurchasePackets>
    <StoragePackets>
      <Item Count="int" PurchaseCost="decimal" RetailCost="decimal"
            ConnectedPacketID="UUID" UserID="UUID" Time="..."
            ProductWriteOff="decimal?" />
    </StoragePackets>
    <SalePackets>
      <Item Count="int" PurchaseCost="decimal" RetailCost="decimal"
            Paid="decimal" ClientID="UUID" ConnectedPacketID="UUID"
            UserID="UUID" Time="..." PaymentType="Cash|NonCash"
            Discount="decimal" DiscountPercent="decimal"
            HasRefund="True|False" />
    </SalePackets>
    <Deposit>
      <Item ID="UUID" Time="..." ItemType="Pay|WriteOff|Debt|Undebt|WriteOffCancel"
            Sum="decimal" UserID="UUID" ComputerID="string" PacketID="UUID" />
    </Deposit>
    <Bonus />
  </Item>
</Product>
```

**Особенности Product:**
- ~100 товаров/услуг (Полотенце аренда, Виброплатформа, носки и т.д.)
- `Measurement` — единица измерения: "50*100", "10 мин" — строка, не enum
- `PurchasePackets` — пакеты закупок (история покупки)
- `StoragePackets` — пакеты хранения (остатки на складе), связаны с `ConnectedPacketID` → `PurchasePackets`
- `SalePackets` — пакеты продаж, связаны с `ConnectedPacketID` → `StoragePackets` и `ClientID` → `Client`
- `Discount` / `DiscountPercent` — скидки при продаже
- `HasRefund` — флаг возврата
- `Deposit` — движение средств по товарам (Pay, WriteOff, WriteOffCancel)
- Цепочка: PurchasePackets → StoragePackets → SalePackets (складской учёт)

### 4. Reservation (бронирования/записи)

```xml
<Reservation>
  <Item Updated="N|UserID|ComputerID|DD.MM.YYYY HH:MM:SS"
        Created="N|UserID|ComputerID|DD.MM.YYYY HH:MM:SS"
        Removed="true?">
    <ID>UUID</ID>
    <ID_Status>UUID</ID_Status>
    <ReservationType>Group</ReservationType>
    <ClientType>NewClient|ExistClient</ClientType>
    <ID_Client>UUID?</ID_Client>
    <LastName>string</LastName>
    <Name>string?</Name>
    <MiddleName>string?</MiddleName>
    <BirthDate>DD.MM.YYYY?</BirthDate>
    <ParentLastName>string?</ParentLastName>
    <ParentMobilePhone1>string?</ParentMobilePhone1>
    <MobilePhone1>string?</MobilePhone1>
    <Time>DD.MM.YYYY HH:MM:SS</Time>
    <ID_Group>UUID?</ID_Group>
    <Informers />
    <Tags />
    <Schedule />
    <Comments />
    <Tasks />
    <StatusChanges Updated="N|...">
      <Item ID="UUID" ID_Creator="UUID" ID_Status="UUID" Created="..." />
    </StatusChanges>
  </Item>
</Reservation>
```

**Особенности Reservation:**
- ~500 бронирований
- `ClientType` — `NewClient` (новая запись) / `ExistClient` (существующий клиент)
- Для `NewClient` — нет `ID_Client`, данные заполняются вручную (LastName, MobilePhone1)
- Для `ExistClient` — `ID_Client` заполнен
- `ParentLastName`, `ParentMobilePhone1` — данные родителей (для детских бронирований)
- `StatusChanges` — история изменений статусов (аналогично Client)
- `Informers`, `Tags`, `Schedule`, `Comments`, `Tasks` — всегда пустые
- `Updated` на дочерних элементах: `<ID_Status Updated="...">`, `<ID_Client Updated="...">`, `<LastName Updated="...">`, `<StatusChanges Updated="...">` — инкрементальная синхронизация
- `ReservationType` — всегда `Group` в текущих данных

### Ключевые структурные характеристики донора (D1.2):

1. **Account — самая сложная сущность:** 18+ полей + 4 вложенных массива (Visits, Deposit, Groups, Reservations)
2. **Charge — вложенная иерархия:** категория → подкатегория (Items) → фактический расход (Packets)
3. **Product — складской учёт:** 3 типа пакетов (Purchase → Storage → Sale) с цепочкой связей через `ConnectedPacketID`
4. **Reservation — данные для новых клиентов:** `NewClient` не имеет `ID_Client`, данные заполняются вручную
5. **Updated на дочерних элементах:** в Account, Charge, Product, Reservation — атрибуты `Updated` на `<ID_Client>`, `<LastName>`, `<ID_Status>`, `<StatusChanges>`, `<Packets>` — инкрементальная синхронизация
6. **Пустые элементы:** `<Reservations />`, `<BurnRes />`, `<Stages />`, `<Bonus />`, `<Informers />`, `<Tags />`, `<Schedule />`, `<Comments />`, `<Tasks />` — всегда пустые
7. **Нет XSD-схемы:** все типы — строки, определяются контекстом
8. **Decimal без запятой:** в Account/Charge/Product — числа без запятой (1050, 7000), в отличие от SingleTraining

---

## Оценка структуры донора: 4/5

### Аргументация оценки:

**Плюсы (+):**
- **Чёткое разделение финансовых сущностей:** Account (абонементы), Charge (расходы), Product (товары), Reservation (бронирования) — каждая в отдельном файле
- **Детализация Deposit:** 4 типа операций (Pay/WriteOff/Debt/Undebt) + UserID/ComputerID/PaymentType — полная финансовая история
- **Складской учёт в Product:** PurchasePackets → StoragePackets → SalePackets — цепочка отслеживания товаров
- **StatusChanges в Reservation:** история изменений статусов — полезно для аудита
- **Гибкие типы абонементов:** IsPerpetual, IsUnlimited, DaysCount, TrainingCount — разные виды подписок
- **Групповые абонементы:** `Groups` — привязка абонемента к программам (many-to-many)
- **Parent-данные в Reservation:** ParentLastName/ParentMobilePhone1 — поддержка детских бронирований

**Минусы (-):**
- **AccountTypeName смешивает тариф и скидку:** "1 со скидкой 5%", "Ноябрь50%" — это не название тарифа, а комбинированное представление. Лучше разделить на `TariffName` + `DiscountPercent`
- **Product.SalePackets — избыточные поля:** `PurchaseCost` + `RetailCost` + `Paid` + `Discount` + `DiscountPercent` — 6 полей для одной продажи. Можно вычислить `Paid = RetailCost - Discount`
- **ConnectedPacketID — длинная цепочка:** PurchasePackets → StoragePackets → SalePackets — 3 таблицы с self-referencing FK. Сложно для запросов
- **Charge.Packets — только 1 запись:** 15 категорий, но только 1 фактический расход. В основном — справочник
- **Нет Updated на Name в Charge:** категории расходов не отслеживают изменения названий
- **ReservationType всегда "Group":** поле есть, но не используется для других типов
- **ID_Status в Reservation — UUID без контекста:** неясно, какие статусы возможны без чтения ReservationStatus.xml

### Почему не 5:
`AccountTypeName` смешивает тариф и скидку — "1 со скидкой 5%" и "Ноябрь50%" — это не название тарифа, а комбинированное представление. Это усложняет фильтрацию и аналитику.

### Почему не ниже 4:
Структура финансов (Account.Deposit, Product.SalePackets) полностью покрывает потребности студии. Складской учёт Product — продуманная модель, хотя и сложная.

---

## Рекомендуемое хранение у нас (PostgreSQL)

### Таблица: `subscriptions` (абонементы)

```sql
CREATE TABLE subscriptions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    number                  INTEGER,  -- порядковый номер счёта
    create_date             DATE NOT NULL,
    begin_date              DATE NOT NULL,
    days_count              INTEGER,  -- 28, 30, 60, 90
    is_perpetual            BOOLEAN DEFAULT FALSE,
    is_unlimited            BOOLEAN DEFAULT FALSE,
    training_count          INTEGER NOT NULL,
    free_training_count     INTEGER DEFAULT 0,
    payment_type            VARCHAR(20) DEFAULT 'Cash' CHECK (payment_type IN ('Cash', 'NonCash')),
    client_id               UUID NOT NULL REFERENCES users(id),
    original_cost           DECIMAL(12, 2) NOT NULL,
    discount                DECIMAL(12, 2) DEFAULT 0,
    discount_percent        DECIMAL(5, 2) DEFAULT 0,
    add_days_count          INTEGER DEFAULT 0,
    tariff_name             VARCHAR(100) NOT NULL,  -- название тарифа ("1", "Ноябрь")
    tariff_cost             DECIMAL(12, 2) NOT NULL,
    annotation              TEXT,
    ds_removed              BOOLEAN DEFAULT FALSE,
    ds_updated              TIMESTAMP,
    ds_created              TIMESTAMP,
    created_at              TIMESTAMP DEFAULT NOW(),
    updated_at              TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_client ON subscriptions(client_id);
CREATE INDEX idx_subscriptions_begin_date ON subscriptions(begin_date);
CREATE INDEX idx_subscriptions_tariff ON subscriptions(tariff_name);
```

**Аргументация:**
- `tariff_name` — разделён от скидки. "1 со скидкой 5%" → tariff_name="1", discount_percent=5.00
- `original_cost` — стоимость без скидки (можно вычислить discounted_cost = original_cost * (1 - discount_percent/100))
- `training_count` + `free_training_count` — общее количество занятий + бесплатные
- `is_perpetual` / `is_unlimited` — отдельные флаги для разных типов абонементов
- `days_count` — период действия (28, 30, 60, 90 дней)
- `number` — порядковый номер счёта (уникален в рамках студии)

### Таблица: `subscription_visits` (визиты по абонементу)

```sql
CREATE TABLE subscription_visits (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id         UUID NOT NULL REFERENCES subscriptions(id),
    visit_date              DATE NOT NULL,
    group_id                UUID NOT NULL REFERENCES programs(id),
    ds_created              TIMESTAMP,
    created_at              TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sub_visits_subscription ON subscription_visits(subscription_id);
CREATE INDEX idx_sub_visits_date ON subscription_visits(visit_date);
CREATE INDEX idx_sub_visits_group ON subscription_visits(group_id);
```

**Аргументация:**
- Каждая запись в Account.Visits → одна строка в `subscription_visits`
- `group_id` — ссылка на программу (группу), на которую был визит
- `ds_created` — время создания записи визита (из атрибута Created)

### Таблица: `subscription_payments` (платежи по абонементам)

```sql
CREATE TABLE subscription_payments (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id         UUID NOT NULL REFERENCES subscriptions(id),
    operation_time          TIMESTAMP NOT NULL,
    item_type               VARCHAR(20) NOT NULL CHECK (item_type IN ('Pay', 'WriteOff', 'Debt', 'Undebt')),
    amount                  DECIMAL(12, 2) NOT NULL,
    user_id_ds              UUID,
    computer_id             VARCHAR(50),
    payment_type            VARCHAR(20),  -- Cash / NonCash
    packet_id               UUID  -- связка с Product.Deposit, если есть
);

CREATE INDEX idx_sub_payments_subscription ON subscription_payments(subscription_id);
CREATE INDEX idx_sub_payments_time ON subscription_payments(operation_time);
CREATE INDEX idx_sub_payments_type ON subscription_payments(item_type);
```

**Аргументация:**
- Аналогично `visit_payments`, но привязана к `subscriptions`
- `item_type` — Pay (оплата), WriteOff (списание), Debt/Undebt (долг)
- `packet_id` — опциональная связь с пакетами товаров

### Таблица: `subscription_programs` (many-to-many: абонемент ↔ программа)

```sql
CREATE TABLE subscription_programs (
    subscription_id         UUID NOT NULL REFERENCES subscriptions(id),
    program_id              UUID NOT NULL REFERENCES programs(id),
    PRIMARY KEY (subscription_id, program_id)
);
```

**Аргументация:**
- Account.Groups — many-to-many связь между абонементами и программами
- Composite PK предотвращает дублирование

### Таблица: `expense_categories` (категории расходов)

```sql
CREATE TABLE expense_categories (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                    VARCHAR(100) NOT NULL,
    description             TEXT,
    annotation              TEXT,
    ds_removed              BOOLEAN DEFAULT FALSE,
    ds_updated              TIMESTAMP,
    ds_created              TIMESTAMP,
    created_at              TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_expense_categories_name ON expense_categories(name);
```

**Аргументация:**
- Top-level категории: "Реклама", "Уборка", "Аренда помещения", "Канцтовары", "Инвентарь"
- `annotation` — примечание к категории (из XML)

### Таблица: `expense_items` (подкатегории расходов)

```sql
CREATE TABLE expense_items (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id             UUID NOT NULL REFERENCES expense_categories(id),
    name                    VARCHAR(100) NOT NULL,
    description             TEXT,
    created_at              TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_expense_items_category ON expense_items(category_id);
```

**Аргументация:**
- Вложенные статьи расходов: "Реклама" → "Листовки", "Баннер", "Объявления"
- 1:N связь с `expense_categories`

### Таблица: `expense_records` (фактические расходы)

```sql
CREATE TABLE expense_records (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expense_item_id         UUID NOT NULL REFERENCES expense_items(id),
    expense_time            TIMESTAMP NOT NULL,
    amount                  DECIMAL(12, 2) NOT NULL,
    count                   INTEGER DEFAULT 1,
    annotation              TEXT,
    ds_updated              TIMESTAMP,
    created_at              TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_expense_records_item ON expense_records(expense_item_id);
CREATE INDEX idx_expense_records_time ON expense_records(expense_time);
```

**Аргументация:**
- Charge.Packets — фактические записи расходов (в данных: 1 запись — Уборка, 7000 руб.)
- `expense_item_id` — ссылка на подкатегорию (expense_items)
- `count` — количество (всегда 1 в текущих данных)

### Таблица: `products` (товары/услуги)

```sql
CREATE TABLE products (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                    VARCHAR(200) NOT NULL,
    barcode                 VARCHAR(50),
    measurement             VARCHAR(50) NOT NULL,  -- "50*100", "10 мин"
    unit                    VARCHAR(20) DEFAULT 'Piece' CHECK (unit = 'Piece'),
    status                  VARCHAR(20) DEFAULT 'Active' CHECK (status IN ('Active', 'Closed')),
    purchase_cost           DECIMAL(12, 2) NOT NULL,
    markup                  DECIMAL(12, 2),
    markup_percent          DECIMAL(5, 2),
    annotation              TEXT,
    ds_removed              BOOLEAN DEFAULT FALSE,
    ds_updated              TIMESTAMP,
    ds_created              TIMESTAMP,
    created_at              TIMESTAMP DEFAULT NOW(),
    updated_at              TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_products_name ON products(name);
CREATE INDEX idx_products_status ON products(status);
```

**Аргументация:**
- `measurement` — строка, т.к. значения разные: "50*100", "10 мин"
- `markup` / `markup_percent` — наценка (абсолютная и процентная)
- `status` — Active/Closed, CHECK-ограничение

### Таблица: `product_purchase_batches` (пакеты закупок)

```sql
CREATE TABLE product_purchase_batches (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id              UUID NOT NULL REFERENCES products(id),
    batch_time              TIMESTAMP NOT NULL,
    count                   INTEGER NOT NULL,
    purchase_cost           DECIMAL(12, 2) NOT NULL,
    retail_cost             DECIMAL(12, 2) NOT NULL,
    paid                    DECIMAL(12, 2) NOT NULL,
    user_id_ds              UUID
);

CREATE INDEX idx_product_purchases_product ON product_purchase_batches(product_id);
CREATE INDEX idx_product_purchases_time ON product_purchase_batches(batch_time);
```

**Аргументация:**
- Product.PurchasePackets — история закупок товаров
- `retail_cost` — розничная стоимость (цена продажи)
- `paid` — оплаченная сумма

### Таблица: `product_storage_batches` (пакеты хранения)

```sql
CREATE TABLE product_storage_batches (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id              UUID NOT NULL REFERENCES products(id),
    batch_time              TIMESTAMP NOT NULL,
    count                   INTEGER NOT NULL,
    purchase_cost           DECIMAL(12, 2) NOT NULL,
    retail_cost             DECIMAL(12, 2) NOT NULL,
    connected_purchase_id   UUID REFERENCES product_purchase_batches(id),
    user_id_ds              UUID,
    product_write_off       DECIMAL(12, 2)  -- списание, если есть
);

CREATE INDEX idx_product_storage_product ON product_storage_batches(product_id);
CREATE INDEX idx_product_storage_purchase ON product_storage_batches(connected_purchase_id);
```

**Аргументация:**
- Product.StoragePackets — остатки на складе
- `connected_purchase_id` — FK к purchase_batches (связь через ConnectedPacketID)
- `product_write_off` — сумма списания (если товар испорчен/потерян)

### Таблица: `product_sales` (пакеты продаж)

```sql
CREATE TABLE product_sales (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id              UUID NOT NULL REFERENCES products(id),
    sale_time               TIMESTAMP NOT NULL,
    count                   INTEGER NOT NULL,
    purchase_cost           DECIMAL(12, 2) NOT NULL,
    retail_cost             DECIMAL(12, 2) NOT NULL,
    paid                    DECIMAL(12, 2) NOT NULL,
    client_id               UUID REFERENCES users(id),
    connected_storage_id    UUID REFERENCES product_storage_batches(id),
    user_id_ds              UUID,
    payment_type            VARCHAR(20) DEFAULT 'Cash' CHECK (payment_type IN ('Cash', 'NonCash')),
    discount                DECIMAL(12, 2) DEFAULT 0,
    discount_percent        DECIMAL(5, 2) DEFAULT 0,
    has_refund              BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_product_sales_product ON product_sales(product_id);
CREATE INDEX idx_product_sales_client ON product_sales(client_id);
CREATE INDEX idx_product_sales_time ON product_sales(sale_time);
CREATE INDEX idx_product_sales_storage ON product_sales(connected_storage_id);
```

**Аргументация:**
- Product.SalePackets — история продаж
- `client_id` — клиент, купивший товар (если зарегистрирован)
- `connected_storage_id` — FK к storage_batches (связь через ConnectedPacketID)
- `discount` / `discount_percent` — скидки при продаже
- `has_refund` — флаг возврата товара

### Таблица: `product_deposit` (движение средств по товарам)

```sql
CREATE TABLE product_deposit (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id              UUID NOT NULL REFERENCES products(id),
    operation_time          TIMESTAMP NOT NULL,
    item_type               VARCHAR(20) NOT NULL CHECK (item_type IN ('Pay', 'WriteOff', 'Debt', 'Undebt', 'WriteOffCancel')),
    amount                  DECIMAL(12, 2) NOT NULL,
    user_id_ds              UUID,
    computer_id             VARCHAR(50),
    packet_id               UUID  -- связка с packet
);

CREATE INDEX idx_product_deposit_product ON product_deposit(product_id);
CREATE INDEX idx_product_deposit_time ON product_deposit(operation_time);
```

**Аргументация:**
- Product.Deposit — движение средств по товарам
- `WriteOffCancel` — отмена списания (уникальный тип для товаров)

### Таблица: `reservations` (бронирования)

```sql
CREATE TABLE reservations (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status_id               UUID NOT NULL,  -- FK к reservation_statuses
    reservation_type        VARCHAR(20) DEFAULT 'Group' CHECK (reservation_type = 'Group'),
    client_type             VARCHAR(20) NOT NULL CHECK (client_type IN ('NewClient', 'ExistClient')),
    client_id               UUID REFERENCES users(id),
    last_name               VARCHAR(200) NOT NULL,
    first_name              VARCHAR(100),
    middle_name             VARCHAR(100),
    birth_date              DATE,
    parent_last_name        VARCHAR(200),
    parent_mobile_phone1    VARCHAR(20),
    mobile_phone1           VARCHAR(20),
    reservation_time        TIMESTAMP NOT NULL,
    group_id                UUID REFERENCES programs(id),
    comments                TEXT,
    ds_removed              BOOLEAN DEFAULT FALSE,
    ds_updated              TIMESTAMP,
    ds_created              TIMESTAMP,
    created_at              TIMESTAMP DEFAULT NOW(),
    updated_at              TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_reservations_client ON reservations(client_id);
CREATE INDEX idx_reservations_group ON reservations(group_id);
CREATE INDEX idx_reservations_time ON reservations(reservation_time);
CREATE INDEX idx_reservations_status ON reservations(status_id);
```

**Аргументация:**
- `client_type` — NewClient/ExistClient, CHECK-ограничение
- Для `NewClient`: `client_id` = NULL, данные заполнены (LastName, MobilePhone1)
- Для `ExistClient`: `client_id` заполнен, личные данные могут быть пустыми
- `parent_*` — данные родителей (для детских бронирований)
- `reservation_type` — всегда 'Group' в текущих данных, но оставлено как CHECK
- `status_id` — FK к `reservation_statuses` (из тикета D1.8)

### Таблица: `reservation_status_history` (история статусов бронирований)

```sql
CREATE TABLE reservation_status_history (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_id          UUID NOT NULL REFERENCES reservations(id),
    creator_id              UUID REFERENCES users(id),
    status_id               UUID NOT NULL,  -- FK к reservation_statuses
    status_change_time      TIMESTAMP NOT NULL,
    ds_updated              TIMESTAMP
);

CREATE INDEX idx_res_status_history_reservation ON reservation_status_history(reservation_id);
CREATE INDEX idx_res_status_history_status ON reservation_status_history(status_id);
```

**Аргументация:**
- Reservation.StatusChanges — история изменений статусов
- `creator_id` — кто создал изменение (из ID_Creator)
- `status_change_time` — время изменения (из Created)
- `ds_updated` — время обновления записи (из атрибута Updated на StatusChanges)

---

## Сравнение: донор vs рекомендация

| Критерий | Донор (XML) | Рекомендация (PG) |
|---|---|---|
| Account структура | 18+ полей + 4 вложенных массива | 4 таблицы: `subscriptions`, `subscription_visits`, `subscription_payments`, `subscription_programs` |
| Charge иерархия | Категория → Items → Packets (3 уровня) | 3 таблицы: `expense_categories` → `expense_items` → `expense_records` |
| Product склад | 3 типа пакетов в одном файле | 4 таблицы: `products`, `product_purchase_batches`, `product_storage_batches`, `product_sales` |
| Product цепочка | ConnectedPacketID (Purchase → Storage → Sale) | FK между таблицами: `connected_purchase_id`, `connected_storage_id` |
| Product.Deposit | Вложенный `<Deposit>` | Отдельная таблица `product_deposit` |
| Reservation | Данные для NewClient встроены в XML | `client_id` NULL для NewClient, `client_type` CHECK |
| StatusChanges | Вложенный массив в Reservation | Отдельная таблица `reservation_status_history` |
| Пустые элементы | `<Informers />`, `<Tags />`, `<Schedule />` | Игнорируются при импорте |
| AccountTypeName | "1 со скидкой 5%" (тариф + скидка) | `tariff_name` + `discount_percent` (раздельно) |
| Decimal формат | Без запятой (1050, 7000) | Стандартный `DECIMAL(12,2)` |
| Update tracking | `Updated` на `<Item>` и дочерних элементах | `ds_updated TIMESTAMP` |

---

## Наблюдения по доменам

### Account — финансовые абонементы
Абонементы — основная финансовая сущность. 2 файла (Account.xml, Account001.xml) — партиционирование по времени. `DaysCount` (28/30/60/90) — стандартные периоды. `TrainingCount` — количество занятий. `IsUnlimited` / `IsPerpetual` — безлимитные/бессрочные. `Deposit` — полная финансовая история.

### Charge — управленческий учёт расходов
Категории расходов — справочник для учёта. В текущих данных только 1 фактический расход (Уборка, 7000 руб.). Остальные категории пустые — расходы не ведутся регулярно. Это больше справочник, чем транзакционная таблица.

### Product — товароведение
Товары/услуги студии с полным складским учётом. PurchasePackets → StoragePackets → SalePackets — цепочка от закупки до продажи. `Measurement` — строковые единицы измерения. `Discount` и `HasRefund` — поддержка возвратов.

### Reservation — бронирования
Бронирования групповых занятий. `ClientType` разделяет новых и существующих клиентов. `Parent*` поля — детские бронирования. `StatusChanges` — история статусов. `NewClient` записи — данные заполняются вручную (без привязки к клиенту).

---

# Анализ сущностей тикета D1.3 (IndividualAccount, IndividualTraining, Hall, Rent, RentAccount, DayBalance)

## Полученные сущности

**Назначение:** Индивидуальные абонементы и занятия, залы, аренда помещений — данные, связанные с индивидуальными услугами и инфраструктурой студии.

**Источник:** 6 XML-файлов в `cfr-site/данные/_DB/`:
- `IndividualAccount.xml` — ~28 записей индивидуальных абонентов
- `IndividualTraining.xml` — ~30+ записей индивидуальных занятий
- `Hall.xml` — 2 записи залов (БОЛЬШОЙ ЗАЛ, МАЛЫЙ ЗАЛ)
- `Rent.xml` — ~30+ записей аренды залов
- `RentAccount.xml` — 3 записи арендных абонементов
- `DayBalance.xml` — пустой (2 строки, сущность не содержит записей)

**Общий объём:** ~93 записи, 4 XML-файла с данными, ~10 КБ

---

## Структурное представление в доноре (XML)

### 1. IndividualAccount (индивидуальные абонементы)

```xml
<IndividualAccount>
  <Item Updated="N|UserID|ComputerID|DD.MM.YYYY HH:MM:SS"
        Created="N|UserID|ComputerID|DD.MM.YYYY HH:MM:SS"
        Removed="true?">
    <ID>UUID</ID>
    <Number>int</Number>
    <CreateDate>DD.MM.YYYY</CreateDate>
    <ID_Style>UUID?</ID_Style>
    <ID_Teacher>UUID</ID_Teacher>
    <ID_Client>UUID</ID_Client>
    <OriginalCost>decimal</OriginalCost>
    <Discount>decimal</Discount>
    <DiscountPercent>decimal</DiscountPercent>
    <TrainingCount>int</TrainingCount>
    <FreeTrainingCount>int</FreeTrainingCount>
    <BeginDate>DD.MM.YYYY?</BeginDate>
    <DaysCount>int?</DaysCount>
    <AddDaysCount>int</AddDaysCount>
    <IsPerpetual>True|False</IsPerpetual>
    <IsUnlimited>True|False</IsUnlimited>
    <PaymentType>Cash|NonCash</PaymentType>
    <AccountTypeName>string</AccountTypeName>
    <AccountTypeCost>decimal</AccountTypeCost>
    <Colour>hex?</Colour>
    <Schedule />
    <Stages />
    <Visits>
      <Item Date="DD.MM.YYYY" ID_Teacher="UUID" Created="..." />
    </Visits>
    <Deposit>
      <Item ID="UUID" Time="DD.MM.YYYY HH:MM:SS"
            ItemType="Pay|WriteOff|Debt|Undebt"
            Sum="decimal" UserID="UUID" ComputerID="string"
            PaymentType="Cash|NonCash" VisitID="UUID?" />
    </Deposit>
    <Bonus />
  </Item>
</IndividualAccount>
```

**Особенности IndividualAccount:**
- ~28 записей — мало по сравнению с групповыми абонементами (Account.xml — ~50 000+)
- `ID_Style` — опционален (индивидуальные занятия могут быть по любому стилю)
- `ID_Teacher` — обязательно заполнен (индивидуальный абонемент всегда привязан к преподавателю)
- `AccountTypeName` — "Стандарт" и подобные
- `Visits` — содержит `ID_Teacher` (вместо `ID_Group`, как в групповых абонементах)
- `Schedule`, `Stages`, `Bonus` — всегда пустые
- `Colour` — цвет для визуализации в UI

### 2. IndividualTraining (индивидуальные занятия)

```xml
<IndividualTraining>
  <Item Updated="N|UserID|ComputerID|DD.MM.YYYY HH:MM:SS"
        Created="N|UserID|ComputerID|DD.MM.YYYY HH:MM:SS"
        Removed="true?">
    <ID>UUID</ID>
    <ID_Client>UUID</ID_Client>
    <ID_Style>UUID?</ID_Style>
    <ID_Teacher>UUID</ID_Teacher>
    <Prepayment>decimal</Prepayment>
    <PaymentType>Cash|NonCash</PaymentType>
    <IndividualTrainingTypeName>string</IndividualTrainingTypeName>
    <IndividualTrainingTypeCost>decimal</IndividualTrainingTypeCost>
    <Colour>hex?</Colour>
    <Schedule>
      <Item>
        <Day>Monday|Tuesday|...</Day>
        <Time><From>HH:MM</From><To>HH:MM</To></Time>
        <ID_Hall>UUID</ID_Hall>
        <Frequency>Regular|Single</Frequency>
        <Range><From>DD.MM.YYYY</From><To>DD.MM.YYYY?</To></Range>
      </Item>
    </Schedule>
    <Visits>
      <Item ID="UUID" Created="..." Date="DD.MM.YYYY"
            Name="string" Cost="decimal" TeacherPay="decimal" />
    </Visits>
    <Deposit>
      <Item ID="UUID" Time="DD.MM.YYYY HH:MM:SS"
            ItemType="Pay|WriteOff|Debt|Undebt"
            Sum="decimal" UserID="UUID" ComputerID="string"
            VisitID="UUID?" />
    </Deposit>
    <Bonus />
  </Item>
</IndividualTraining>
```

**Особенности IndividualTraining:**
- ~30+ записей — индивидуальные занятия (не абонементы)
- `Prepayment` — предоплата/стоимость занятия
- `IndividualTrainingTypeName` — тип занятия (напр. "Стандарт")
- `IndividualTrainingTypeCost` — стоимость типа занятия
- `Schedule` — расписание индивидуальных занятий (с залом, временем, днём недели)
- `Visits` — посещённые занятия с `Cost` и `TeacherPay` (зарплата преподавателя за визит)
- `Deposit` — финансовые транзакции по занятию

### 3. Hall (залы)

```xml
<Hall>
  <Item ID="UUID" Name="string" Status="Active?"/>
</Hall>
```

**Особенности Hall:**
- 2 записи: "БОЛЬШОЙ ЗАЛ" (ID: a3e4bd6e-..., Status: Active) и "МАЛЫЙ ЗАЛ" (ID: 427ce918-..., Status отсутствует)
- Минимальная структура — только ID, Name, Status
- `Status` — только у БОЛЬШОГО ЗАЛА (Active), у МАЛОГО ЗАЛА статус не указан (= по умолчанию неактивен?)
- Ссылки на залы: `IndividualTraining.Schedule[].ID_Hall`, `Rent.Schedule[].ID_Hall`

### 4. Rent (аренда залов)

```xml
<Rent>
  <Item Updated="N|UserID|ComputerID|DD.MM.YYYY HH:MM:SS"
        Created="N|UserID|ComputerID|DD.MM.YYYY HH:MM:SS"
        Removed="true?">
    <ID>UUID</ID>
    <PaymentType>Cash|NonCash</PaymentType>
    <ID_Client>UUID?</ID_Client>
    <Prepayment>decimal</Prepayment>
    <RentTypeName>string</RentTypeName>
    <RentTypeCost>decimal</RentTypeCost>
    <TenantType>Client|NonClient</TenantType>
    <LastName>string?</LastName>
    <Name>string?</Name>
    <MobilePhone>string?</MobilePhone>
    <Colour>hex?</Colour>
    <Schedule>
      <Item>
        <Day>...</Day>
        <Time><From>HH:MM</From><To>HH:MM</To></Time>
        <ID_Hall>UUID</ID_Hall>
        <Frequency>Regular|Single</Frequency>
        <Range><From>DD.MM.YYYY</From><To>DD.MM.YYYY?</To></Range>
      </Item>
    </Schedule>
    <Visits>
      <Item ID="UUID" Created="..." Date="DD.MM.YYYY"
            Name="string" Cost="decimal" TotalCost="decimal" />
    </Visits>
    <Deposit>
      <Item ID="UUID" Time="DD.MM.YYYY HH:MM:SS"
            ItemType="Pay|WriteOff|Debt|Undebt|PayDebt|In"
            Sum="decimal" UserID="UUID" ComputerID="string"
            PaymentType="Cash|NonCash" VisitID="UUID?" />
    </Deposit>
    <Bonus />
  </Item>
</Rent>
```

**Особенности Rent:**
- ~30+ записей — аренда залов внешними арендаторами
- `TenantType` — "Client" (свой клиент) или "NonClient" (внешний арендатор)
- Для NonClient заполняются `LastName`, `Name`, `MobilePhone`
- `RentTypeName` — название арендуемого зала (напр. "БОЛЬШОЙ ЗАЛ")
- `RentTypeCost` — стоимость аренды
- `Visits` — посещённые аренды с `TotalCost` (накопленная стоимость)
- `Deposit` — типы: Pay, WriteOff, Debt, Undebt, PayDebt, In (6 типов, больше чем в Account)
- `Schedule` — расписание аренды (с залом, временем, днём недели)

### 5. RentAccount (арендные абонементы)

```xml
<RentAccount>
  <Item Updated="N|UserID|ComputerID|DD.MM.YYYY HH:MM:SS"
        Created="N|UserID|ComputerID|DD.MM.YYYY HH:MM:SS"
        Removed="true?">
    <ID>UUID</ID>
    <Number>int</Number>
    <CreateDate>DD.MM.YYYY</CreateDate>
    <OriginalCost>decimal</OriginalCost>
    <ID_Client>UUID</ID_Client>
    <TenantType>Client</TenantType>
    <AccountTypeCost>decimal</AccountTypeCost>
    <Discount>string/decimal?</Discount>
    <DiscountPercent>int?</DiscountPercent>
    <BeginDate>DD.MM.YYYY?</BeginDate>
    <DaysCount>int?</DaysCount>
    <TrainingCount>int</TrainingCount>
    <FreeTrainingCount>int</FreeTrainingCount>
    <AddDaysCount>int</AddDaysCount>
    <IsPerpetual>True|False</IsPerpetual>
    <IsUnlimited>True|False</IsUnlimited>
    <PaymentType>Cash|NonCash</PaymentType>
    <AccountTypeName>string</AccountTypeName>
    <AccountTypeTime>
      <From>HH:MM</From><To>HH:MM</To>
    </AccountTypeTime>
    <Colour>hex</Colour>
    <Schedule />
    <Stages>
      <Item ID="UUID" TypeName="string" TypeCost="decimal"
            Begin="DD.MM.YYYY" Days="int" Freeze="true?" />
    </Stages>
    <Visits>
      <Item Created="..." Date="DD.MM.YYYY" ID_Hall="UUID" />
    </Visits>
    <Deposit>
      <Item ID="UUID" Time="DD.MM.YYYY HH:MM:SS"
            ItemType="Pay|WriteOff|..." Sum="decimal"
            UserID="UUID" ComputerID="string" />
    </Deposit>
    <Bonus />
  </Item>
</RentAccount>
```

**Особенности RentAccount:**
- 3 записи — арендные абонементы (связка аренды + абонемента)
- `TenantType` — всегда "Client" (в отличие от Rent, где может быть NonClient)
- `AccountTypeTime` — время действия абонемента (From/To, напр. "12:00"–"14:00")
- `Stages` — этапы абонемента (уникальная структура, отличается от Account)
- `Visits` — содержат `ID_Hall` (вместо `ID_Group` или `ID_Teacher`)
- `OriginalCost` + `Discount` — цена со скидкой (напр. 9000 со скидкой 450 = 5%)
- `IsPerpetual="True"` — бессрочный арендный абонемент

### 6. DayBalance (баланс дня)

```xml
<DayBalance />
```

**Особенности DayBalance:**
- Пустой файл (2 строки XML)
- Сущность существует, но данных нет
- Предположительно — планировалась для ежедневного отчёта по балансу, но не реализована

### Ключевые структурные характеристики донора (D1.3):

1. **Малый объём данных:** Всего ~93 записи — значительно меньше, чем D1.1/D1.2 (62 000+ записей). Это нишевые данные студии.
2. **IndividualAccount vs Account:** Индивидуальные абонементы — аналог групповых, но с `ID_Teacher` вместо `ID_Group`. Структура идентична Account, но меньше полей.
3. **IndividualTraining — отдельная сущность:** В отличие от SingleTraining (разовые посещения групп), IndividualTraining — это индивидуальные занятия с расписанием и зарплатой преподавателя (`TeacherPay`).
4. **Rent vs RentAccount:** Rent — разовая аренда, RentAccount — аренда с абонементом. Similar pattern к SingleTraining vs IndividualAccount.
5. **Stages в RentAccount:** Уникальная структура — этапы абонемента с `TypeName`, `TypeCost`, `Begin`, `Days`, `Freeze`. Не встречается в других сущностях.
6. **AccountTypeTime:** Время действия (From/To) — уникально для RentAccount. Абонемент действует в определённые часы дня.
7. **Deposit типы в Rent:** 6 типов (Pay, WriteOff, Debt, Undebt, PayDebt, In) — больше чем в других сущностях (обычно 4).
8. **DayBalance пустой:** Сущность существует, но данные не заполнены.

---

## Оценка структуры донора: 4/5

### Аргументация оценки:

**Плюсы (+):**
- **Чёткое разделение аренды и абонементов:** Rent (разовая аренда) и RentAccount (аренда с абонементом) — логичное разделение
- **IndividualAccount как аналог Account:** Структура повторяет групповые абонементы, но с `ID_Teacher` вместо `ID_Group` — это упрощает маппинг
- **Stages в RentAccount:** Этапы абонемента — полезная структура для поэтапной оплаты
- **AccountTypeTime:** Время действия абонемента (From/To) — удобно для аренды залов по часам
- **Hall — минимальный справочник:** 2 записи, простые поля — легко маппится на таблицу
- **TeacherPay в IndividualTraining.Visits:** Прямая ссылка на зарплату преподавателя за визит — полезно для отчётов
- **TenantType в Rent:** Разделение Client/NonClient — важно для аналитики выручки

**Минусы (-):**
- **Stages в RentAccount — уникальная структура:** Не повторяется нигде больше. Требует отдельной таблицы с нестандартными полями (`Freeze`, `TypeName`, `TypeCost`)
- **Deposit типы в Rent (6 штук):** PayDebt и In — дополнительные типы, которые не встречаются в других сущностях. Нужно расширять CHECK-ограничение
- **Discount в RentAccount — string/decimal?** Поле `Discount` имеет строковое значение "450,00" — inconsistent с другими decimal-полями
- **DayBalance пустой:** Сущность существует, но не используется. Нужно решить: удалять таблицу или оставить пустой на будущее
- **AccountTypeTime — вложенная структура:** `<From>12:00</From><To>14:00</To>` в RentAccount — требует парсинга вложенных элементов
- **Schedule в IndividualTraining и Rent:** Аналогичная структура (Day, Time.From, Time.To, ID_Hall, Frequency, Range) — можно объединить в одну таблицу `rental_schedules` для Rent и IndividualTraining
- **Нет Removed у DayBalance:** Файл пустой, сущность не имеет метаданных

### Почему не 5:
`Discount` в RentAccount хранится как строка `"450,00"` вместо decimal — inconsistent с другими decimal-полями. Это требует специальной обработки при парсинге.

### Почему не ниже 4:
Структура в целом логичная и последовательная. IndividualAccount как аналог Account — хорошее дизайнерское решение. Аренда с абонементом (RentAccount) — отдельная интересная сущность.

---

## Рекомендуемое хранение у нас (PostgreSQL)

### Таблица: `individual_subscriptions` (индивидуальные абонементы)

```sql
CREATE TABLE individual_subscriptions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    number                  INTEGER,  -- порядковый номер абонемента
    create_date             DATE NOT NULL,
    style_id                UUID REFERENCES styles(id),  -- опционально
    teacher_id              UUID NOT NULL REFERENCES trainers(id),
    client_id               UUID NOT NULL REFERENCES users(id),
    original_cost           DECIMAL(12, 2) NOT NULL,
    discount                DECIMAL(12, 2) DEFAULT 0,
    discount_percent        DECIMAL(5, 2) DEFAULT 0,
    training_count          INTEGER NOT NULL,
    free_training_count     INTEGER DEFAULT 0,
    begin_date              DATE,
    days_count              INTEGER,
    add_days_count          INTEGER DEFAULT 0,
    is_perpetual            BOOLEAN DEFAULT FALSE,
    is_unlimited            BOOLEAN DEFAULT FALSE,
    payment_type            VARCHAR(20) DEFAULT 'Cash' CHECK (payment_type IN ('Cash', 'NonCash')),
    account_type_name       VARCHAR(100) NOT NULL,
    account_type_cost       DECIMAL(12, 2) NOT NULL,
    colour                  VARCHAR(8),  -- AARRGGBB
    ds_removed              BOOLEAN DEFAULT FALSE,
    ds_updated              TIMESTAMP,
    ds_created              TIMESTAMP,
    created_at              TIMESTAMP DEFAULT NOW(),
    updated_at              TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_ind_sub_client ON individual_subscriptions(client_id);
CREATE INDEX idx_ind_sub_teacher ON individual_subscriptions(teacher_id);
CREATE INDEX idx_ind_sub_style ON individual_subscriptions(style_id);
```

**Подробное описание полей:**
- `id` — UUID, первичный ключ, генерируется автоматически
- `number` — порядковый номер абонемента (аналог Account.Number). Уникален в рамках студии.
- `create_date` — дата создания абонемента в DanceStudio. Формат DD.MM.YYYY → DATE.
- `style_id` — ссылка на стиль (Style.xml). Опционально: индивидуальные занятия могут быть по любому стилю или без привязки к стилю.
- `teacher_id` — преподаватель, который ведёт индивидуальные занятия. Обязательно заполнен, т.к. индивидуальный абонемент всегда привязан к конкретному тренеру. FK → trainers.id.
- `client_id` — клиент, купивший абонемент. Обязательно заполнен. FK → users.id.
- `original_cost` — исходная стоимость абонемента без скидки. DECIMAL(12,2) для точности.
- `discount` — абсолютная сумма скидки (напр. 0, 450). DECIMAL(12,2).
- `discount_percent` — процент скидки (напр. 0, 5). DECIMAL(5,2).
- `training_count` — общее количество занятий в абонементе. INTEGER.
- `free_training_count` — количество бесплатных занятий (бонусных). INTEGER по умолчанию 0.
- `begin_date` — дата начала действия абонемента. DATE, опционально (может быть пустым).
- `days_count` — количество дней действия абонемента (напр. 60). INTEGER, опционально.
- `add_days_count` — дополнительные дни (бонусные дни). INTEGER по умолчанию 0.
- `is_perpetual` — бессрочный абонемент. BOOLEAN по умолчанию FALSE.
- `is_unlimited` — безлимитный абонемент (неограниченное количество занятий). BOOLEAN по умолчанию FALSE.
- `payment_type` — тип оплаты: Cash (наличные) или NonCash (безналичные). VARCHAR(20) с CHECK-ограничением.
- `account_type_name` — название типа абонемента (напр. "Стандарт"). VARCHAR(100).
- `account_type_cost` — стоимость типа абонемента (цена за один абонемент этого типа). DECIMAL(12,2).
- `colour` — цвет для визуализации в UI. Формат AARRGGBB (hex), VARCHAR(8).
- `ds_removed` — мягкое удаление из DanceStudio (аналог Removed="true"). BOOLEAN по умолчанию FALSE.
- `ds_updated` — время последнего обновления из DanceStudio (парсится из атрибута Updated). TIMESTAMP.
- `ds_created` — время создания записи в DanceStudio (парсится из атрибута Created). TIMESTAMP.
- `created_at` / `updated_at` — стандартные временные метки PostgreSQL.

### Таблица: `individual_subscription_visits` (посещения индивидуальных абонентов)

```sql
CREATE TABLE individual_subscription_visits (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id         UUID NOT NULL REFERENCES individual_subscriptions(id),
    visit_date              DATE NOT NULL,
    teacher_id              UUID NOT NULL REFERENCES trainers(id),
    ds_created              TIMESTAMP,
    created_at              TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_ind_sub_visits_sub ON individual_subscription_visits(subscription_id);
CREATE INDEX idx_ind_sub_visits_date ON individual_subscription_visits(visit_date);
CREATE INDEX idx_ind_sub_visits_teacher ON individual_subscription_visits(teacher_id);
```

**Подробное описание полей:**
- `id` — UUID, первичный ключ.
- `subscription_id` — FK → individual_subscriptions.id. Абонемент, к которому привязан визит.
- `visit_date` — дата посещения (DD.MM.YYYY → DATE).
- `teacher_id` — преподаватель, проведший занятие. В индивидуальных абонементах визит привязан к учителю, а не к группе. FK → trainers.id.
- `ds_created` — время создания записи визита в DanceStudio (из атрибута Created на элементе Visits). TIMESTAMP.
- `created_at` — стандартная временная метка PostgreSQL.

### Таблица: `individual_subscription_payments` (платежи по индивидуальным абонементам)

```sql
CREATE TABLE individual_subscription_payments (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id         UUID NOT NULL REFERENCES individual_subscriptions(id),
    operation_time          TIMESTAMP NOT NULL,
    item_type               VARCHAR(20) NOT NULL CHECK (item_type IN ('Pay', 'WriteOff', 'Debt', 'Undebt')),
    amount                  DECIMAL(12, 2) NOT NULL,
    user_id_ds              UUID,
    computer_id             VARCHAR(50),
    payment_type            VARCHAR(20),
    visit_id                UUID REFERENCES individual_subscription_visits(id)
);

CREATE INDEX idx_ind_sub_payments_sub ON individual_subscription_payments(subscription_id);
CREATE INDEX idx_ind_sub_payments_time ON individual_subscription_payments(operation_time);
```

**Подробное описание полей:**
- `id` — UUID, первичный ключ.
- `subscription_id` — FK → individual_subscriptions.id. Абонемент, к которому относится платёж.
- `operation_time` — время финансовой операции (DD.MM.YYYY HH:MM:SS → TIMESTAMP).
- `item_type` — тип операции: Pay (оплата), WriteOff (списание), Debt (долг), Undebt (погашение долга). CHECK-ограничение.
- `amount` — сумма операции. DECIMAL(12,2).
- `user_id_ds` — ID пользователя в DanceStudio, который провёл операцию (из UserID). UUID.
- `computer_id` — ID компьютера в DanceStudio (из ComputerID). VARCHAR(50).
- `payment_type` — тип оплаты операции: Cash / NonCash. VARCHAR(20).
- `visit_id` — опциональная ссылка на визит, к которому относится платёж. FK → individual_subscription_visits.id.

### Таблица: `individual_sessions` (индивидуальные занятия)

```sql
CREATE TABLE individual_sessions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id               UUID NOT NULL REFERENCES users(id),
    style_id                UUID REFERENCES styles(id),  -- опционально
    teacher_id              UUID NOT NULL REFERENCES trainers(id),
    prepayment              DECIMAL(12, 2) NOT NULL,
    payment_type            VARCHAR(20) DEFAULT 'Cash' CHECK (payment_type IN ('Cash', 'NonCash')),
    training_type_name      VARCHAR(100) NOT NULL,
    training_type_cost      DECIMAL(12, 2) NOT NULL,
    colour                  VARCHAR(8),  -- AARRGGBB
    ds_removed              BOOLEAN DEFAULT FALSE,
    ds_updated              TIMESTAMP,
    ds_created              TIMESTAMP,
    created_at              TIMESTAMP DEFAULT NOW(),
    updated_at              TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_ind_sessions_client ON individual_sessions(client_id);
CREATE INDEX idx_ind_sessions_teacher ON individual_sessions(teacher_id);
CREATE INDEX idx_ind_sessions_style ON individual_sessions(style_id);
```

**Подробное описание полей:**
- `id` — UUID, первичный ключ.
- `client_id` — клиент, которому принадлежит занятие. FK → users.id.
- `style_id` — стиль занятия. Опционально, FK → styles.id.
- `teacher_id` — преподаватель, ведущий занятие. FK → trainers.id.
- `prepayment` — предоплата / стоимость занятия. DECIMAL(12,2). Это сумма, которую клиент заплатил за занятие.
- `payment_type` — тип оплаты: Cash / NonCash. CHECK-ограничение.
- `training_type_name` — название типа занятия (напр. "Стандарт"). VARCHAR(100).
- `training_type_cost` — стоимость типа занятия. DECIMAL(12,2).
- `colour` — цвет для визуализации в UI. AARRGGBB, VARCHAR(8).
- `ds_removed` — мягкое удаление из DanceStudio. BOOLEAN по умолчанию FALSE.
- `ds_updated` / `ds_created` — временные метки из DanceStudio. TIMESTAMP.
- `created_at` / `updated_at` — стандартные метки PostgreSQL.

### Таблица: `individual_session_schedules` (расписание индивидуальных занятий)

```sql
CREATE TABLE individual_session_schedules (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id              UUID NOT NULL REFERENCES individual_sessions(id),
    day_of_week             VARCHAR(20) NOT NULL,
    time_from               TIME NOT NULL,
    time_to                 TIME NOT NULL,
    hall_id                 UUID REFERENCES halls(id),
    frequency               VARCHAR(20) DEFAULT 'Regular' CHECK (frequency IN ('Regular', 'Single')),
    range_from              DATE,
    range_to                DATE,
    created_at              TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_ind_sess_sched_session ON individual_session_schedules(session_id);
CREATE INDEX idx_ind_sess_sched_hall ON individual_session_schedules(hall_id);
```

**Подробное описание полей:**
- `id` — UUID, первичный ключ.
- `session_id` — FK → individual_sessions.id. Индивидуальное занятие, к которому относится расписание.
- `day_of_week` — день недели (Monday/Tuesday/...). VARCHAR(20).
- `time_from` — время начала занятия (HH:MM → TIME).
- `time_to` — время окончания занятия (HH:MM → TIME).
- `hall_id` — зал, в котором проходит занятие. FK → halls.id.
- `frequency` — частота: Regular (регулярное) или Single (разовое). CHECK-ограничение.
- `range_from` — дата начала периода расписания (DD.MM.YYYY → DATE).
- `range_to` — дата окончания периода расписания (опционально, DATE).
- `created_at` — стандартная временная метка PostgreSQL.

### Таблица: `individual_session_visits` (посещения индивидуальных занятий)

```sql
CREATE TABLE individual_session_visits (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id              UUID NOT NULL REFERENCES individual_sessions(id),
    visit_date              DATE NOT NULL,
    visit_name              VARCHAR(200),  -- название визита (напр. "Стандарт")
    cost                    DECIMAL(12, 2),  -- стоимость визита
    teacher_pay             DECIMAL(12, 2),  -- зарплата преподавателя за этот визит
    ds_created              TIMESTAMP,
    created_at              TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_ind_sess_visits_session ON individual_session_visits(session_id);
CREATE INDEX idx_ind_sess_visits_date ON individual_session_visits(visit_date);
```

**Подробное описание полей:**
- `id` — UUID, первичный ключ.
- `session_id` — FK → individual_sessions.id. Индивидуальное занятие, к которому относится визит.
- `visit_date` — дата посещения (DD.MM.YYYY → DATE).
- `visit_name` — название визита (из поля Name в XML). VARCHAR(200), опционально.
- `cost` — стоимость визита (из поля Cost в XML). DECIMAL(12,2), опционально.
- `teacher_pay` — зарплата преподавателя за этот визит (из поля TeacherPay в XML). DECIMAL(12,2). Уникальное поле для индивидуальных занятий — позволяет считать зарплату тренеров.
- `ds_created` — время создания записи визита в DanceStudio. TIMESTAMP.
- `created_at` — стандартная временная метка PostgreSQL.

### Таблица: `individual_session_payments` (платежи по индивидуальным занятиям)

```sql
CREATE TABLE individual_session_payments (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id              UUID NOT NULL REFERENCES individual_sessions(id),
    operation_time          TIMESTAMP NOT NULL,
    item_type               VARCHAR(20) NOT NULL CHECK (item_type IN ('Pay', 'WriteOff', 'Debt', 'Undebt')),
    amount                  DECIMAL(12, 2) NOT NULL,
    user_id_ds              UUID,
    computer_id             VARCHAR(50),
    visit_id                UUID REFERENCES individual_session_visits(id)
);

CREATE INDEX idx_ind_sess_payments_session ON individual_session_payments(session_id);
CREATE INDEX idx_ind_sess_payments_time ON individual_session_payments(operation_time);
```

### Таблица: `halls` (залы танцевальной студии)

```sql
CREATE TABLE halls (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                    VARCHAR(100) NOT NULL,
    status                  VARCHAR(20) DEFAULT 'Active' CHECK (status IN ('Active', 'Closed')),
    ds_removed              BOOLEAN DEFAULT FALSE,
    ds_updated              TIMESTAMP,
    ds_created              TIMESTAMP,
    created_at              TIMESTAMP DEFAULT NOW(),
    updated_at              TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_halls_name ON halls(name);
```

**Подробное описание полей:**
- `id` — UUID, первичный ключ.
- `name` — название зала ("БОЛЬШОЙ ЗАЛ", "МАЛЫЙ ЗАЛ"). VARCHAR(100), NOT NULL.
- `status` — статус зала: Active (активен) или Closed (закрыт). VARCHAR(20) с CHECK-ограничением. По умолчанию 'Active'. Если статус не указан в XML (= пустой элемент), по умолчанию Active.
- `ds_removed` — мягкое удаление из DanceStudio. BOOLEAN по умолчанию FALSE.
- `ds_updated` / `ds_created` — временные метки из DanceStudio. TIMESTAMP.
- `created_at` / `updated_at` — стандартные метки PostgreSQL.

### Таблица: `hall_rentals` (аренда залов)

```sql
CREATE TABLE hall_rentals (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_type            VARCHAR(20) DEFAULT 'Cash' CHECK (payment_type IN ('Cash', 'NonCash')),
    client_id               UUID REFERENCES users(id),  -- опционально (для NonClient — NULL)
    prepayment              DECIMAL(12, 2) NOT NULL,
    rent_type_name          VARCHAR(100) NOT NULL,  -- название арендуемого зала (напр. "БОЛЬШОЙ ЗАЛ")
    rent_type_cost          DECIMAL(12, 2) NOT NULL,
    tenant_type             VARCHAR(20) NOT NULL CHECK (tenant_type IN ('Client', 'NonClient')),
    last_name               VARCHAR(200),  -- для NonClient
    first_name              VARCHAR(100),  -- для NonClient
    mobile_phone            VARCHAR(20),   -- для NonClient
    colour                  VARCHAR(8),  -- AARRGGBB
    ds_removed              BOOLEAN DEFAULT FALSE,
    ds_updated              TIMESTAMP,
    ds_created              TIMESTAMP,
    created_at              TIMESTAMP DEFAULT NOW(),
    updated_at              TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_hall_rentals_tenant ON hall_rentals(tenant_type);
CREATE INDEX idx_hall_rentals_client ON hall_rentals(client_id);
```

**Подробное описание полей:**
- `id` — UUID, первичный ключ.
- `payment_type` — тип оплаты: Cash / NonCash. CHECK-ограничение.
- `client_id` — FK → users.id. Ссылка на клиента студии. Опционально: если `tenant_type = 'NonClient'`, то NULL.
- `prepayment` — предоплата за аренду. DECIMAL(12,2).
- `rent_type_name` — название арендуемого зала (напр. "БОЛЬШОЙ ЗАЛ"). VARCHAR(100). Это текстовое поле, а не FK к halls — т.к. в DanceStudio название зала хранится как строка, а не UUID.
- `rent_type_cost` — стоимость аренды. DECIMAL(12,2).
- `tenant_type` — тип арендатора: Client (свой клиент студии) или NonClient (внешний арендатор). CHECK-ограничение.
- `last_name` — фамилия арендатора. Заполняется только для NonClient. VARCHAR(200).
- `first_name` — имя арендатора. Заполняется только для NonClient. VARCHAR(100).
- `mobile_phone` — телефон арендатора. Заполняется только для NonClient. VARCHAR(20).
- `colour` — цвет для визуализации. AARRGGBB, VARCHAR(8).
- `ds_removed` — мягкое удаление. BOOLEAN по умолчанию FALSE.
- `ds_updated` / `ds_created` — временные метки из DanceStudio. TIMESTAMP.

### Таблица: `hall_rent_schedules` (расписание аренды)

```sql
CREATE TABLE hall_rent_schedules (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rental_id               UUID NOT NULL REFERENCES hall_rentals(id),
    day_of_week             VARCHAR(20) NOT NULL,
    time_from               TIME NOT NULL,
    time_to                 TIME NOT NULL,
    hall_id                 UUID REFERENCES halls(id),
    frequency               VARCHAR(20) DEFAULT 'Regular' CHECK (frequency IN ('Regular', 'Single')),
    range_from              DATE,
    range_to                DATE,
    created_at              TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_hall_rent_sched_rental ON hall_rent_schedules(rental_id);
CREATE INDEX idx_hall_rent_sched_hall ON hall_rent_schedules(hall_id);
```

**Подробное описание полей:**
- `id` — UUID, первичный ключ.
- `rental_id` — FK → hall_rentals.id. Аренда, к которой относится расписание.
- `day_of_week` — день недели занятия. VARCHAR(20).
- `time_from` — время начала (HH:MM → TIME).
- `time_to` — время окончания (HH:MM → TIME).
- `hall_id` — FK → halls.id. Зал, в котором проходит аренда.
- `frequency` — Regular / Single. CHECK-ограничение.
- `range_from` / `range_to` — даты периода действия расписания. DATE.
- `created_at` — стандартная временная метка PostgreSQL.

### Таблица: `hall_rent_visits` (посещения аренды)

```sql
CREATE TABLE hall_rent_visits (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rental_id               UUID NOT NULL REFERENCES hall_rentals(id),
    visit_date              DATE NOT NULL,
    visit_name              VARCHAR(200),  -- название визита (напр. "БОЛЬШОЙ ЗАЛ")
    cost                    DECIMAL(12, 2),  -- стоимость визита
    total_cost              DECIMAL(12, 2),  -- накопленная стоимость
    ds_created              TIMESTAMP,
    created_at              TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_hall_rent_visits_rental ON hall_rent_visits(rental_id);
CREATE INDEX idx_hall_rent_visits_date ON hall_rent_visits(visit_date);
```

**Подробное описание полей:**
- `id` — UUID, первичный ключ.
- `rental_id` — FK → hall_rentals.id. Аренда, к которой относится визит.
- `visit_date` — дата посещения. DATE.
- `visit_name` — название визита (напр. "БОЛЬШОЙ ЗАЛ"). VARCHAR(200).
- `cost` — стоимость одного визита. DECIMAL(12,2).
- `total_cost` — накопленная стоимость всех визитов по этой аренде. DECIMAL(12,2). Уникальное поле для аренды — показывает общую сумму, которую арендатор потратил.
- `ds_created` — время создания записи визита в DanceStudio. TIMESTAMP.
- `created_at` — стандартная временная метка PostgreSQL.

### Таблица: `hall_rent_payments` (платежи по аренде)

```sql
CREATE TABLE hall_rent_payments (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rental_id               UUID NOT NULL REFERENCES hall_rentals(id),
    operation_time          TIMESTAMP NOT NULL,
    item_type               VARCHAR(30) NOT NULL CHECK (item_type IN ('Pay', 'WriteOff', 'Debt', 'Undebt', 'PayDebt', 'In')),
    amount                  DECIMAL(12, 2) NOT NULL,
    user_id_ds              UUID,
    computer_id             VARCHAR(50),
    payment_type            VARCHAR(20),
    visit_id                UUID REFERENCES hall_rent_visits(id)
);

CREATE INDEX idx_hall_rent_payments_rental ON hall_rent_payments(rental_id);
CREATE INDEX idx_hall_rent_payments_time ON hall_rent_payments(operation_time);
```

**Подробное описание полей:**
- `id` — UUID, первичный ключ.
- `rental_id` — FK → hall_rentals.id. Аренда, к которой относится платёж.
- `operation_time` — время финансовой операции. TIMESTAMP.
- `item_type` — тип операции: Pay, WriteOff, Debt, Undebt, PayDebt (оплата долга), In (пополнение). 6 типов — больше, чем в других сущностях. VARCHAR(30).
- `amount` — сумма операции. DECIMAL(12,2).
- `user_id_ds` — ID пользователя DanceStudio. UUID.
- `computer_id` — ID компьютера DanceStudio. VARCHAR(50).
- `payment_type` — тип оплаты: Cash / NonCash. VARCHAR(20).
- `visit_id` — опциональная ссылка на визит. FK → hall_rent_visits.id.

### Таблица: `hall_rent_subscriptions` (арендные абонементы)

```sql
CREATE TABLE hall_rent_subscriptions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    number                  INTEGER,  -- порядковый номер абонемента
    create_date             DATE NOT NULL,
    original_cost           DECIMAL(12, 2) NOT NULL,
    client_id               UUID NOT NULL REFERENCES users(id),
    tenant_type             VARCHAR(20) DEFAULT 'Client' CHECK (tenant_type IN ('Client', 'NonClient')),
    account_type_cost       DECIMAL(12, 2) NOT NULL,
    discount                DECIMAL(12, 2) DEFAULT 0,
    discount_percent        DECIMAL(5, 2) DEFAULT 0,
    begin_date              DATE,
    days_count              INTEGER,
    training_count          INTEGER NOT NULL,
    free_training_count     INTEGER DEFAULT 0,
    add_days_count          INTEGER DEFAULT 0,
    is_perpetual            BOOLEAN DEFAULT FALSE,
    is_unlimited            BOOLEAN DEFAULT FALSE,
    payment_type            VARCHAR(20) DEFAULT 'Cash' CHECK (payment_type IN ('Cash', 'NonCash')),
    account_type_name       VARCHAR(100) NOT NULL,
    time_from               TIME,  -- из AccountTypeTime.From
    time_to                 TIME,  -- из AccountTypeTime.To
    colour                  VARCHAR(8),  -- AARRGGBB
    ds_removed              BOOLEAN DEFAULT FALSE,
    ds_updated              TIMESTAMP,
    ds_created              TIMESTAMP,
    created_at              TIMESTAMP DEFAULT NOW(),
    updated_at              TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_hall_rent_subs_client ON hall_rent_subscriptions(client_id);
```

**Подробное описание полей:**
- `id` — UUID, первичный ключ.
- `number` — порядковый номер арендного абонемента. INTEGER.
- `create_date` — дата создания абонемента. DATE.
- `original_cost` — исходная стоимость абонемента без скидки. DECIMAL(12,2).
- `client_id` — FK → users.id. Клиент, купивший арендный абонемент. Обязательно заполнен (в RentAccount TenantType всегда 'Client').
- `tenant_type` — тип арендатора: Client / NonClient. CHECK-ограничение. По умолчанию 'Client'.
- `account_type_cost` — стоимость типа абонемента. DECIMAL(12,2).
- `discount` — сумма скидки (из поля Discount в XML). DECIMAL(12,2). Примечание: в XML поле может быть строкой ("450,00") — требуется парсинг.
- `discount_percent` — процент скидки. DECIMAL(5,2).
- `begin_date` — дата начала действия. DATE, опционально.
- `days_count` — количество дней действия абонемента. INTEGER, опционально.
- `training_count` — количество посещений в абонементе. INTEGER.
- `free_training_count` — бесплатные посещения. INTEGER по умолчанию 0.
- `add_days_count` — дополнительные дни. INTEGER по умолчанию 0.
- `is_perpetual` — бессрочный абонемент. BOOLEAN по умолчанию FALSE.
- `is_unlimited` — безлимитный абонемент. BOOLEAN по умолчанию FALSE.
- `payment_type` — тип оплаты: Cash / NonCash. CHECK-ограничение.
- `account_type_name` — название типа абонемента (напр. "Единый"). VARCHAR(100).
- `time_from` — время начала действия абонемента (из AccountTypeTime.From). TIME. Напр. "12:00".
- `time_to` — время окончания действия абонемента (из AccountTypeTime.To). TIME. Напр. "14:00".
- `colour` — цвет для визуализации. AARRGGBB, VARCHAR(8).
- `ds_removed` — мягкое удаление. BOOLEAN по умолчанию FALSE.
- `ds_updated` / `ds_created` — временные метки из DanceStudio. TIMESTAMP.

### Таблица: `hall_rent_subscription_visits` (посещения арендных абонементов)

```sql
CREATE TABLE hall_rent_subscription_visits (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id         UUID NOT NULL REFERENCES hall_rent_subscriptions(id),
    visit_date              DATE NOT NULL,
    hall_id                 UUID REFERENCES halls(id),
    ds_created              TIMESTAMP,
    created_at              TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_hall_rent_sub_visits_sub ON hall_rent_subscription_visits(subscription_id);
CREATE INDEX idx_hall_rent_sub_visits_date ON hall_rent_subscription_visits(visit_date);
CREATE INDEX idx_hall_rent_sub_visits_hall ON hall_rent_subscription_visits(hall_id);
```

**Подробное описание полей:**
- `id` — UUID, первичный ключ.
- `subscription_id` — FK → hall_rent_subscriptions.id. Арендный абонемент.
- `visit_date` — дата посещения. DATE.
- `hall_id` — FK → halls.id. Зал, в котором было посещение. В арендных абонементах визиты привязаны к залу, а не к группе или учителю.
- `ds_created` — время создания записи визита. TIMESTAMP.
- `created_at` — стандартная временная метка PostgreSQL.

### Таблица: `hall_rent_subscription_payments` (платежи по арендным абонементам)

```sql
CREATE TABLE hall_rent_subscription_payments (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id         UUID NOT NULL REFERENCES hall_rent_subscriptions(id),
    operation_time          TIMESTAMP NOT NULL,
    item_type               VARCHAR(20) NOT NULL CHECK (item_type IN ('Pay', 'WriteOff', 'Debt', 'Undebt')),
    amount                  DECIMAL(12, 2) NOT NULL,
    user_id_ds              UUID,
    computer_id             VARCHAR(50)
);

CREATE INDEX idx_hall_rent_sub_payments_sub ON hall_rent_subscription_payments(subscription_id);
CREATE INDEX idx_hall_rent_sub_payments_time ON hall_rent_subscription_payments(operation_time);
```

### Таблица: `rent_subscription_stages` (этапы арендных абонементов)

```sql
CREATE TABLE rent_subscription_stages (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id         UUID NOT NULL REFERENCES hall_rent_subscriptions(id),
    stage_type_name         VARCHAR(100),  -- название этапа (TypeName)
    stage_type_cost         DECIMAL(12, 2),  -- стоимость этапа (TypeCost)
    stage_begin             DATE,  -- дата начала этапа (Begin)
    stage_days              INTEGER,  -- количество дней этапа (Days)
    is_frozen               BOOLEAN DEFAULT FALSE,  -- заморожен (Freeze)
    created_at              TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_rent_stages_sub ON rent_subscription_stages(subscription_id);
```

**Подробное описание полей:**
- `id` — UUID, первичный ключ.
- `subscription_id` — FK → hall_rent_subscriptions.id. Арендный абонемент, к которому относится этап.
- `stage_type_name` — название этапа (из поля TypeName в XML). VARCHAR(100), опционально.
- `stage_type_cost` — стоимость этапа (из поля TypeCost в XML). DECIMAL(12,2), опционально.
- `stage_begin` — дата начала этапа (из поля Begin в XML). DATE, опционально.
- `stage_days` — количество дней этапа (из поля Days в XML). INTEGER, опционально.
- `is_frozen` — заморожен ли этап (из поля Freeze в XML). BOOLEAN по умолчанию FALSE. Замороженный этап не учитывается при расчёте посещения.
- `created_at` — стандартная временная метка PostgreSQL.

---

## Сравнение: донор vs рекомендация

| Критерий | Донор (XML) | Рекомендация (PG) |
|---|---|---|
| IndividualAccount | ~28 записей с вложенными Visits/Deposit | 3 таблицы: `individual_subscriptions`, `individual_subscription_visits`, `individual_subscription_payments` |
| IndividualTraining | ~30+ записей с Schedule/Visits/Deposit | 5 таблиц: `individual_sessions`, `individual_session_schedules`, `individual_session_visits`, `individual_session_payments` |
| Hall | 2 записи, flat XML | 1 таблица `halls` |
| Rent | ~30+ записей с Schedule/Visits/Deposit | 4 таблицы: `hall_rentals`, `hall_rent_schedules`, `hall_rent_visits`, `hall_rent_payments` |
| RentAccount | 3 записи с уникальной структурой Stages и AccountTypeTime | 4 таблицы: `hall_rent_subscriptions`, `hall_rent_subscription_visits`, `hall_rent_subscription_payments`, `rent_subscription_stages` |
| DayBalance | пустой файл | таблица не создаётся (данных нет, сущность не используется) |
| Deposit типы | 4 типа (Pay/WriteOff/Debt/Undebt) | CHECK-ограничение с типами из XML |
| Deposit типы в Rent | 6 типов (добавлены PayDebt, In) | Расширенное CHECK-ограничение VARCHAR(30) |
| AccountTypeTime | Вложенная структура `<From><To>` | 2 отдельных поля TIME: `time_from`, `time_to` |
| Stages | Вложенная структура с 5 полями | Отдельная таблица `rent_subscription_stages` |
| TenantType | Client/NonClient в XML | CHECK-ограничение VARCHAR(20) |
| Discount в RentAccount | Строка "450,00" | DECIMAL(12,2) — требуется парсинг |

---

## Наблюдения по доменам

### IndividualAccount — индивидуальные абонементы
Мало записей (~28) по сравнению с групповыми абонементами (~50 000+). Это нишевый продукт студии. Структура идентична Account, но с `ID_Teacher` вместо `ID_Group`. `AccountTypeName` — "Стандарт" и подобные. `Colour` — для визуализации.

### IndividualTraining — индивидуальные занятия
~30+ записей — это разовые индивидуальные занятия (не абонементы). Содержат `Prepayment` (предоплата), `IndividualTrainingTypeName` (тип занятия), `TeacherPay` (зарплата преподавателя за визит). `Schedule` — расписание с залом и временем. Уникальное поле `TeacherPay` в `Visits` — позволяет точно считать зарплату тренеров за индивидуальные занятия.

### Hall — залы студии
Минимальный справочник: 2 записи ("БОЛЬШОЙ ЗАЛ" и "МАЛЫЙ ЗАЛ"). Используется как FK в IndividualTraining.Schedule, Rent.Schedule, RentAccount.Visits. `Status` — только у БОЛЬШОГО ЗАЛА (Active), у МАЛОГО ЗАЛА статус не указан.

### Rent — аренда залов
~30+ записей — аренда залов внешними арендаторами. `TenantType` — Client (свой клиент) или NonClient (внешний). Для NonClient заполняются контактные данные (`LastName`, `Name`, `MobilePhone`). `RentTypeName` — название арендуемого зала (текстовое поле, не FK). 6 типов операций в Deposit (включая PayDebt и In).

### RentAccount — арендные абонементы
3 записи — гибридная сущность: аренда + абонемент. `AccountTypeTime` — время действия (From/To, напр. 12:00–14:00). `Stages` — уникальная структура этапов абонемента с `Freeze`. `IsPerpetual="True"` — бессрочный арендный абонемент. `Discount` — строковый формат ("450,00").

### DayBalance — пустая сущность
Файл существует, но данных нет. Предположительно планировалась для ежедневного отчёта по балансу, но не реализована. Таблицу в PostgreSQL создавать не нужно — можно оставить на будущее.

---

## Сводка новых таблиц для PG (из D1.3)

| # | PG таблица | Источник XML | Описание | Записей |
|---|---|---|---|---|
| 1 | `individual_subscriptions` | IndividualAccount | Индивидуальные абонементы клиентов | ~28 |
| 2 | `individual_subscription_visits` | IndividualAccount.Visits | Посещения по индивидуальному абонементу | ~28×N |
| 3 | `individual_subscription_payments` | IndividualAccount.Deposit | Платежи по индивидуальному абонементу | ~28×N |
| 4 | `individual_sessions` | IndividualTraining | Индивидуальные занятия | ~30+ |
| 5 | `individual_session_schedules` | IndividualTraining.Schedule | Расписание индивидуальных занятий | ~30+×N |
| 6 | `individual_session_visits` | IndividualTraining.Visits | Посещения индивидуальных занятий | ~30+×N |
| 7 | `individual_session_payments` | IndividualTraining.Deposit | Платежи по индивидуальным занятиям | ~30+×N |
| 8 | `halls` | Hall | Залы студии | 2 |
| 9 | `hall_rentals` | Rent | Аренда залов | ~30+ |
| 10 | `hall_rent_schedules` | Rent.Schedule | Расписание аренды | ~30+×N |
| 11 | `hall_rent_visits` | Rent.Visits | Посещения аренды | ~30+×N |
| 12 | `hall_rent_payments` | Rent.Deposit | Платежи по аренде | ~30+×N |
| 13 | `hall_rent_subscriptions` | RentAccount | Арендные абонементы | 3 |
| 14 | `hall_rent_subscription_visits` | RentAccount.Visits | Посещения арендных абонементов | 3×N |
| 15 | `hall_rent_subscription_payments` | RentAccount.Deposit | Платежи по арендным абонементам | 3×N |
| 16 | `rent_subscription_stages` | RentAccount.Stages | Этапы арендных абонементов | 3×N |

---

# Анализ сущностей тикета D1.4 (SingleTraining001–005)

## Полученные сущности

**Назначение:** Партиционированные данные индивидуальных посещений (SingleTraining). Это разбивка основной сущности SingleTraining на 14 файлов для удобства хранения.

**Источник:** 5 XML-файлов в `cfr-site/данные/_DB/`:
- `SingleTraining001.xml` — ~71 716 строк
- `SingleTraining002.xml` — ~72 458 строк
- `SingleTraining003.xml` — ~73 428 строк
- `SingleTraining004.xml` — ~73 813 строк
- `SingleTraining005.xml` — ~72 857 строк
- **Итого:** 364 272 строки, суммарно ~5–6 ГБ (оценка по размеру основного файла SingleTraining.xml)

**Общий объём:** ~60 000–65 000 записей (оценка: ~6 строк на запись), 5 файлов, ~364K строк

---

## Структурное представление в доноре (XML)

### SingleTraining (партиции 001–005)

```xml
<SingleTraining>
  <Item Updated="N|UserID|ComputerID|DD.MM.YYYY HH:MM:SS"
        Created="N|UserID|ComputerID|DD.MM.YYYY HH:MM:SS"
        Removed="true?">
    <ID>UUID</ID>
    <VisitDate>DD.MM.YYYY</VisitDate>
    <PaymentType>Cash|NonCash</PaymentType>
    <ID_Client>UUID</ID_Client>
    <ID_Group>UUID</ID_Group>
    <Cost>decimal</Cost>
    <SingleTrainingTypeName>string</SingleTrainingTypeName>
    <SingleTrainingTypeCost>decimal</SingleTrainingTypeCost>
    <Annotation>string?</Annotation>
    <Deposit>
      <Item ID="UUID" Time="DD.MM.YYYY HH:MM:SS"
            ItemType="Pay|WriteOff|Debt|Undebt"
            Sum="decimal" UserID="UUID" ComputerID="string"
            PaymentType="Cash|NonCash" />
    </Deposit>
    <Bonus />
  </Item>
</SingleTraining>
```

**Особенности SingleTraining001–005:**

1. **Структура идентична основному SingleTraining.xml** (из D1.1) — те же поля, те же типы, те же связи
2. **Cost=0 во всех партициях 001–005** — реальная стоимость хранится в `SingleTrainingTypeCost`, списание происходит через `Deposit` (WriteOff) из абонемента
3. **Deposit с Debt/Undebt** — часть записей содержит полную историю задолженностей: `WriteOff` → `Debt` → `Undebt` → `WriteOff` (списание → создание долга → погашение долга → повторное списание)
4. **Removed="true"** — мягкое удаление встречается (записи с 3+ версиями Updated)
5. **Annotation** — иногда заполняется (напр. "12=13" для бесплатных занятий)
6. **Deposit Updated** — вложенный `<Deposit>` тоже имеет атрибут `Updated` для отслеживания изменений истории
7. **Bonus** — всегда пустой (`<Bonus />`) во всех партициях
8. **ID_Group и ID_Client** — имеют атрибут `Updated` на некоторых записях (инкрементальная синхронизация)

---

## Типы занятий (SingleTrainingTypeName) из партиций 001–005

| Название | SingleTrainingTypeCost | Описание |
|---|---|---|
| `премиум 50%` | 165 | Скидка 50% на премиум |
| `премиум тренировка` | 313.5 / 350 / 370 | Премиум-занятие |
| `тренировка` | 285 / 315 | Обычная тренировка |
| `тренировка 50%` | 165 | Скидка 50% |
| `полуторка` | 425 | Занятие 1.5 часа |
| `разовая` | 600 | Разовое занятие |
| `бесплатно` | 0 | Пробное занятие |
| `с 5% скидкой` | 350 | Скидка 5% |
| `без скидки` | 475 | Полная стоимость |
| `5%, если 12 трен` | 425 | Скидка 10% при 12+ тренировках |
| `если 12 трен` | 450 | Промежуточный вариант |

---

## Примеры записей

### Запись с WriteOff (обычная оплата)

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

### Запись с Debt → Undebt → WriteOff (сложная история оплаты)

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
  <Bonus />
</Item>
```

### Запись с Removed="true" (мягкое удаление)

```xml
<Item Updated="3|910267f7-b5ae-4903-87da-ffbcf2a8a19f|...|16.10.2024 13:28:25"
      Created="1|910267f7-b5ae-4903-87da-ffbcf2a8a19f|...|05.10.2024 18:46:59"
      Removed="true">
  <ID>d476bfa3-6bc0-4558-808c-b8e26bbabc26</ID>
  <ID_Client>3615107d-9dd5-45c3-b054-b772c44330cb</ID_Client>
  <VisitDate>05.10.2024</VisitDate>
  <SingleTrainingTypeName>без скидки</SingleTrainingTypeName>
  <SingleTrainingTypeCost>475</SingleTrainingTypeCost>
  <Deposit>
    <Item ID="2182eace-85d4-45aa-9d0a-2132359cafb1" Time="05.10.2024 18:47:03"
          ItemType="WriteOff" Sum="475" />
  </Deposit>
  <Bonus />
</Item>
```

### Запись с Annotation (бесплатное занятие)

```xml
<Item Updated="2|910267f7-b5ae-4903-87da-ffbcf2a8a19f|670B-E878-DD76-F952-3316-7A51-88E7-9917|07.10.2024 18:17:15"
      Created="1|910267f7-b5ae-4903-87da-ffbcf2a8a19f|670B-E878-DD76-F952-3316-7A51-88E7-9917|07.10.2024 18:17:07">
  <ID>d0dcd67f-0101-4e62-a395-ee99d402c172</ID>
  <ID_Client>4d0acf67-7589-4bc3-bda0-20df9aa659f4</ID_Client>
  <ID_Group>d3e34fab-55da-4e6f-851c-b68becb9a560</ID_Group>
  <VisitDate>07.10.2024</VisitDate>
  <SingleTrainingTypeName>бесплатно</SingleTrainingTypeName>
  <Annotation>первый раз</Annotation>
  <Deposit />
  <Bonus />
</Item>
```

---

## Оценка структуры донора: 4/5

### Аргументация оценки:

**Плюсы (+):**
- **Структура идентична основному SingleTraining** — упрощает разработку парсера, не нужно писать отдельную логику для партиций
- **Партиционирование логичное** — файлы разбиты по объёму (~72K строк каждый), что упрощает управление
- **Deposit с Debt/Undebt** — полная финансовая история визита: списание → долг → погашение → повторное списание
- **Updated на вложенном Deposit** — позволяет отслеживать изменения в истории оплаты
- **Removed="true"** — мягкое удаление для корректной фильтрации при импорте

**Минусы (-):**
- **Cost=0 всегда** — поле Cost бесполезно, вся стоимость в `SingleTrainingTypeCost`. Это избыточное поле, которое можно игнорировать
- **Удалённые записи с Deposit** — записи с `Removed="true"` всё ещё содержат полную историю `Deposit`. Это дублирование данных, которое нужно обрабатывать при импорте (фильтровать по Removed)
- **Decimal с запятой** — `313,5` в `SingleTrainingTypeCost` — требует конвертации при импорте
- **364K строк в 5 файлах** — очень объёмные файлы, парсинг может занимать время

### Почему не 5:
`Cost=0` во всех партициях — избыточное поле, которое вводит в заблуждение. Также удалённые записи содержат полные Deposit-истории, что создаёт дублирование.

### Почему не ниже 4:
Структура полностью рабочая и предсказуемая. Партиционирование упрощает управление большими объёмами данных.

---

## Рекомендуемое хранение у нас (PostgreSQL)

### Данные из D1.4 маппятся на те же таблицы, что и из D1.1:

| DanceStudio XML | → PG таблица | Поля | Изменения в схеме |
|---|---|---|---|
| SingleTraining (все партиции) | `user_visits` | id (UUID), visit_date, payment_type, client_id, group_id, cost, single_training_type_name, single_training_type_cost, annotation, ds_removed, ds_updated, ds_created | client_id — FK → users.id, group_id — FK → programs.id, removed — bool |
| SingleTraining.Deposit | `visit_payments` | id, visit_id, item_type, sum, payment_time, user_id_ds, computer_id, payment_type | visit_id — FK → user_visits.id |

**Важно:** Все 14 партиций (SingleTraining.xml + 001–014) объединяются в одну таблицу `user_visits`. Партиции не требуют отдельных таблиц — это просто способ разделения больших XML-файлов.

### Специфика D1.4 для импорта:

1. **Фильтр Removed** — записи с `Removed="true"` пропускаем (мягкое удаление)
2. **Конвертация Cost** — `Cost=0` игнорируем, используем `SingleTrainingTypeCost` для расчётов
3. **Decimal конвертация** — `313,5` → `313.5` (запятая → точка)
4. **Deposit с Debt** — сохраняем полную историю (Pay, WriteOff, Debt, Undebt) в `visit_payments`
5. **Объединение партиций** — все 5 файлов читаем как единый набор записей

---

## Сравнение: партиции D1.4 vs основной файл D1.1

| Критерий | SingleTraining.xml (D1.1) | SingleTraining001–005 (D1.4) |
|---|---|---|
| Размер | ~5 169 KB, 12 400 записей | ~500+ MB суммарно, ~60 000+ записей |
| Cost | Содержит реальные значения (350, 262,5) | Всегда 0 |
| Deposit | Pay + WriteOff | WriteOff, Debt, Undebt (расширенная история) |
| Удаления | ~323 удалённых | ~5–10% удалённых |
| Структура | Полная | Полная (идентична) |
| Annotation | Редко | Иногда ("12=13", "первый раз") |

---

## Наблюдения по доменам

### SingleTraining — визиты клиентов
Самая объёмная транзакционная сущность. 14 партиций суммарно содержат ~60 000–73 000+ записей посещений. Каждая запись — это факт посещения клиентом группового занятия. `SingleTrainingTypeName` — типы занятий с разными ценами (от бесплатных до премиум). `Deposit` — полная финансовая история визита, включая сценарии задолженностей.

### Debt-цикл — особенность системы
Записи с Debt → Undebt → WriteOff показывают, что DanceStudio поддерживает сценарий: клиент пришёл без абонемента → ему создали долг (Debt) → он погасил долг (Undebt) → списали из абонемента (WriteOff). Это важная бизнес-логика, которую нужно сохранить в `visit_payments`.

### Партиционирование — способ управления объёмом
14 файлов по ~72K строк — это способ DanceStudio управлять большими XML. Структура данных идентична, партиции не несут семантической нагрузки (не разбиты по годам или клиентам). При импорте все партиции объединяются в одну таблицу `user_visits`.

---
