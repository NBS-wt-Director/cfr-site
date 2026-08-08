# Тикет: Перегруппировка вкладок админки (исправление)

## Проблема
Раньше я自作自作но придумал группировку вместо того чтобы спросить у тебя. Это критическая ошибка. Нужно откатить моё решение и применить твои группы.

---

## Шаг 1: Откатить моё решение

```bash
cd "/home/ivan/Рабочий стол/проекты/цфр/cfr-site"

# Удалить мои группы
rm -f src/components/admin/AdminGroups.tsx src/components/admin/AdminGroups.module.css

# Вернуть AdminTabs.tsx к плоскому виду
cat > src/components/admin/AdminTabs.tsx << 'EOF'
'use client';
import styles from './AdminTabs.module.css';

interface AdminTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function AdminTabs({ activeTab, onTabChange }: AdminTabsProps) {
  const tabs = [
    { id: 'header', label: 'Хедер' },
    { id: 'homeContainer', label: 'Контейнер главной' },
    { id: 'homePrograms', label: 'Программы на главной' },
    { id: 'homeTrainers', label: 'Тренеры на главной' },
    { id: 'programs', label: 'Программы' },
    { id: 'programsCards', label: 'Карточки программ' },
    { id: 'trainers', label: 'Тренеры' },
    { id: 'trainersCards', label: 'Карточки тренеров' },
    { id: 'sliders', label: 'Слайдер' },
    { id: 'schedulePrices', label: 'Расписание и цены' },
    { id: 'workouts', label: 'Тренировки' },
    { id: 'staff', label: 'Сотрудники' },
    { id: 'news', label: 'Новости' },
    { id: 'pages', label: 'Страницы' },
    { id: 'footer', label: 'Футер' },
    { id: 'contacts', label: 'Контакты' },
    { id: 'additionalContacts', label: 'Доп. контакты' },
    { id: 'sections', label: 'Разделы' },
    { id: 'dividers', label: 'Разделители' },
    { id: 'settings', label: 'Настройки' },
    { id: 'stats', label: 'Статистика' },
    { id: 'autoupload', label: 'Автозагрузка' },
    { id: 'files', label: 'Файлы' },
    { id: 'design', label: 'Дизайн' },
    { id: 'data', label: 'Данные (PG)' },
    { id: 'lk', label: 'Пользователи ЛК' },
    { id: 'sync', label: 'Синхронизация' },
  ];

  return (
    <div className={styles.tabs}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`${styles.tabButton} ${activeTab === tab.id ? styles.active : ''}`}
          onClick={() => onTabChange(tab.id)}
        >
          <span className={styles.tabLabel}>{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
EOF

# Откатить стили
cat > src/components/admin/AdminTabs.module.css << 'EOF'
.tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 2rem;
  padding: 1rem;
  background: linear-gradient(135deg, rgb(248, 250, 252) 0%, rgb(241, 245, 249) 100%);
  border-radius: 1.5rem;
  border: 1px solid rgb(229, 231, 235);
}

.tabButton {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  border-radius: 1rem;
  font-weight: 600;
  height: auto;
  white-space: nowrap;
  transition: all 0.3s ease;
  background: transparent;
  border: none;
  cursor: pointer;
  color: rgb(55, 65, 81);
}

.tabButton:hover {
  background: rgba(251, 191, 36, 0.1);
}

.tabButton.active {
  background: linear-gradient(135deg, rgb(59, 130, 246) 0%, rgb(37, 99, 235) 100%);
  color: white;
  box-shadow: 0 4px 15px rgba(59, 130, 246, 0.4);
}

.tabLabel {
  font-size: 0.9rem;
}
EOF

# Собрать и проверить
npm run build
```

---

## Шаг 2: Создать компонент группировки

Создать `src/components/admin/AdminGroups.tsx`:

```tsx
'use client';
import { useState } from 'react';
import styles from './AdminTabs.module.css';

interface AdminGroupsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

interface TabItem {
  id: string;
  label: string;
  icon: string;
}

interface TabGroup {
  id: string;
  title: string;
  icon: string;
  tabs: TabItem[];
}

const GROUPS: TabGroup[] = [
  {
    id: 'content',
    title: '📝 Контент',
    icon: '📝',
    tabs: [
      { id: 'pages', label: 'Страницы', icon: '📄' },
      { id: 'sections', label: 'Разделы', icon: '🏗️' },
      { id: 'dividers', label: 'Разделители', icon: '🎨' },
    ],
  },
  {
    id: 'structure',
    title: '🏗️ Структура сайта',
    icon: '🏗️',
    tabs: [
      { id: 'header', label: 'Хедер', icon: '⚙️' },
      { id: 'footer', label: 'Футер', icon: '🦶' },
    ],
  },
  {
    id: 'blocks',
    title: '🧱 Блоки и материалы',
    icon: '🧱',
    tabs: [
      { id: 'homeContainer', label: 'Контейнер главной', icon: '🏠' },
      { id: 'sliders', label: 'Слайдер', icon: '📸' },
      { id: 'news', label: 'Новости', icon: '📰' },
      { id: 'homePrograms', label: 'Программы на главной', icon: '🏠' },
      { id: 'homeTrainers', label: 'Тренеры на главной', icon: '🏠' },
    ],
  },
  {
    id: 'services',
    title: '🏃 Услуги и расписание',
    icon: '🏃',
    tabs: [
      { id: 'programs', label: 'Программы', icon: '🎯' },
      { id: 'programsCards', label: 'Карточки программ', icon: '🎯' },
      { id: 'schedulePrices', label: 'Расписание и цены', icon: '📅💰' },
      { id: 'workouts', label: 'Тренировки', icon: '📋' },
    ],
  },
  {
    id: 'people',
    title: '👥 Люди',
    icon: '👥',
    tabs: [
      { id: 'trainers', label: 'Тренеры', icon: '👨‍🏫' },
      { id: 'trainersCards', label: 'Карточки тренеров', icon: '👨‍🏫' },
      { id: 'staff', label: 'Сотрудники', icon: '👨‍🏫' },
    ],
  },
  {
    id: 'crm',
    title: '🔑 Пользователи ЛК',
    icon: '🔑',
    tabs: [
      { id: 'lk', label: 'Пользователи', icon: '🔑' },
    ],
  },
  {
    id: 'contacts',
    title: '📞 Контакты',
    icon: '📞',
    tabs: [
      { id: 'contacts', label: 'Основные', icon: '📞' },
      { id: 'additionalContacts', label: 'Дополнительные', icon: '📱' },
    ],
  },
  {
    id: 'admin',
    title: '⚙️ Администрирование и данные',
    icon: '⚙️',
    tabs: [
      { id: 'settings', label: 'Настройки сайта', icon: '⚙️' },
      { id: 'design', label: 'Дизайн', icon: '🎨' },
      { id: 'files', label: 'Файлы и память', icon: '📁' },
      { id: 'autoupload', label: 'Автозагрузка', icon: '☁️' },
      { id: 'sync', label: 'Синхронизация', icon: '🔄' },
      { id: 'data', label: 'Данные PostgreSQL', icon: '🗄️' },
    ],
  },
  {
    id: 'analytics',
    title: '📊 Аналитика',
    icon: '📊',
    tabs: [
      { id: 'stats', label: 'Статистика', icon: '📊' },
    ],
  },
];

export default function AdminGroups({ activeTab, onTabChange }: AdminGroupsProps) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    content: false,
    structure: false,
    blocks: false,
    services: false,
    people: false,
    crm: false,
    contacts: false,
    admin: true,
    analytics: false,
  });

  const toggleGroup = (groupId: string) => {
    setOpenGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  const getActiveGroup = (): string | null => {
    for (const group of GROUPS) {
      if (group.tabs.some((tab) => tab.id === activeTab)) {
        return group.id;
      }
    }
    return null;
  };

  const activeGroup = getActiveGroup();

  return (
    <div className={styles.groupsContainer}>
      {GROUPS.map((group) => {
        const isOpen = openGroups[group.id];
        const isActiveGroup = activeGroup === group.id;

        return (
          <div
            key={group.id}
            className={`${styles.group} ${isOpen ? styles.groupOpen : ''} ${isActiveGroup ? styles.groupActive : ''}`}
          >
            <button
              className={styles.groupHeader}
              onClick={() => toggleGroup(group.id)}
              style={isActiveGroup ? { background: 'rgba(59, 130, 246, 0.1)' } : {}}
            >
              <span className={styles.groupTitle}>
                <span className={styles.groupIcon}>{group.icon}</span>
                {group.title}
              </span>
              <span className={styles.groupArrow}>{isOpen ? '▼' : '▶'}</span>
            </button>

            {isOpen && (
              <div className={styles.groupTabs}>
                {group.tabs.map((tab) => (
                  <button
                    key={tab.id}
                    className={`${styles.groupTabButton} ${activeTab === tab.id ? styles.groupTabActive : ''}`}
                    onClick={() => onTabChange(tab.id)}
                  >
                    <span className={styles.groupTabIcon}>{tab.icon}</span>
                    <span className={styles.groupTabLabel}>{tab.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

---

## Шаг 3: Обновить AdminTabs.tsx

Заменить содержимое `src/components/admin/AdminTabs.tsx`:

```tsx
'use client';
import AdminGroups from './AdminGroups';

interface AdminTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function AdminTabs({ activeTab, onTabChange }: AdminTabsProps) {
  return (
    <div className={styles.tabs}>
      <AdminGroups activeTab={activeTab} onTabChange={onTabChange} />
    </div>
  );
}
```

---

## Шаг 4: Добавить стили в AdminTabs.module.css

Добавить в конец файла:

```css
/* ============================================
   СТИЛИ ДЛЯ ГРУППИРОВКИ ВКЛАДОК
   ============================================ */

.groupsContainer {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.group {
  border: 1px solid rgb(229, 231, 235);
  border-radius: 1rem;
  overflow: hidden;
  background: white;
  transition: all 0.3s ease;
}

.groupOpen {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.groupActive {
  border-color: rgb(59, 130, 246);
  box-shadow: 0 2px 12px rgba(59, 130, 246, 0.15);
}

.groupHeader {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: 1rem 1.5rem;
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 600;
  color: rgb(31, 41, 55);
  transition: background 0.2s ease;
}

.groupHeader:hover {
  background: rgba(241, 245, 249, 0.5);
}

.groupTitle {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.groupIcon {
  font-size: 1.25rem;
}

.groupArrow {
  font-size: 0.75rem;
  color: rgb(107, 114, 128);
  transition: transform 0.3s ease;
}

.groupOpen .groupArrow {
  transform: rotate(180deg);
}

.groupTabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 1rem 1.5rem;
  background: rgba(248, 250, 252, 0.5);
  border-top: 1px solid rgb(241, 245, 249);
}

.groupTabButton {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 1rem;
  border-radius: 0.75rem;
  font-weight: 500;
  font-size: 0.875rem;
  white-space: nowrap;
  transition: all 0.2s ease;
  background: white;
  border: 1px solid rgb(229, 231, 235);
  cursor: pointer;
  color: rgb(55, 65, 81);
}

.groupTabButton:hover {
  background: rgba(251, 191, 36, 0.1);
  border-color: rgb(251, 191, 36);
}

.groupTabActive {
  background: linear-gradient(135deg, rgb(59, 130, 246) 0%, rgb(37, 99, 235) 100%);
  color: white;
  border-color: transparent;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
}

.groupTabActive:hover {
  background: linear-gradient(135deg, rgb(37, 99, 235) 0%, rgb(29, 78, 216) 100%);
}

.groupTabIcon {
  font-size: 1rem;
}

.groupTabLabel {
  font-size: 0.875rem;
}
```

---

## Шаг 5: Собрать и проверить

```bash
cd "/home/ivan/Рабочий стол/проекты/цфр/cfr-site"
npm run build
```

---

## Группы (твои, окончательные):

| Группа | Вкладки |
|--------|---------|
| 📝 Контент | pages, sections, dividers |
| 🏗️ Структура сайта | header, footer, pages, sections, dividers |
| 🧱 Блоки и материалы | homeContainer, sliders, news, homePrograms, homeTrainers |
| 🏃 Услуги и расписание | programs, programsCards, schedulePrices, workouts |
| 👥 Люди | trainers, trainersCards, staff |
| 🔑 Пользователи ЛК | lk |
| 📞 Контакты | contacts, additionalContacts |
| ⚙️ Администрирование и данные | settings, design, files, autoupload, sync, data |
| 📊 Аналитика | stats |

---

## Чек-лист

- [ ] Откатить AdminGroups.tsx и вернуть плоские вкладки
- [ ] Создать AdminGroups.tsx с твоими группами
- [ ] Обновить AdminTabs.tsx
- [ ] Добавить стили в AdminTabs.module.css
- [ ] npm run build проходит без ошибок
- [ ] Вкладки сгруппированы по твоим категориям
- [ ] Активная группа подсвечивается
- [ ] Можно раскрывать/сворачивать группы
