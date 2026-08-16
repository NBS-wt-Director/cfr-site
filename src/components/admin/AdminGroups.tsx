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
    title: '📋 Контент',
    icon: '📋',
    tabs: [
      { id: 'news', label: 'Новости', icon: '📰' },
      { id: 'pages', label: 'Страницы', icon: '📄' },
      { id: 'sliders', label: 'Слайдер', icon: '📸' },
      { id: 'schedulePrices', label: 'Расписание и Цены', icon: '📅💰' },
    ],
  },
  {
    id: 'people',
    title: '👥 Персонал и программы',
    icon: '👥',
      tabs: [
      { id: 'programs', label: 'Программы', icon: '🎯' },
      { id: 'programsCards', label: 'Программы на главной', icon: '🏠' },
      { id: 'trainers', label: 'Тренеры на главной', icon: '🏠' },
      { id: 'trainersCards', label: 'Тренеры на стр. тренеров', icon: '👨‍🏫' },
      { id: 'workouts', label: 'Тренировки', icon: '📋' },
      { id: 'staff', label: 'Сотрудники', icon: '👨‍🏫' },
    ],
  },
  {
    id: 'design',
    title: '🎨 Дизайн и оформление',
    icon: '🎨',
    tabs: [
      { id: 'header', label: 'Хедер', icon: '⚙️' },
      { id: 'design', label: 'Дизайн', icon: '🎨' },
      { id: 'sections', label: 'Разделы', icon: '🏗️' },
      { id: 'dividers', label: 'Разделители', icon: '🎨' },
      { id: 'footer', label: 'Футер', icon: '🦶' },
      { id: 'contacts', label: 'Контакты', icon: '📞' },
      { id: 'additionalContacts', label: 'Доп. контакты', icon: '📱' },
    ],
  },
  {
    id: 'home',
    title: '🏠 Главная страница',
    icon: '🏠',
    tabs: [
      { id: 'homeContainer', label: 'Контейнер', icon: '🏠' },
      { id: 'homePrograms', label: 'Программы', icon: '🏠' },
      { id: 'homeTrainers', label: 'Тренеры', icon: '🏠' },
    ],
  },
  {
    id: 'settings',
    title: '⚙️ Настройки',
    icon: '⚙️',
    tabs: [
      { id: 'settings', label: 'Настройки сайта', icon: '⚙️' },
      { id: 'stats', label: 'Статистика', icon: '📊' },
      { id: 'autoupload', label: 'Автозагрузка', icon: '☁️' },
      { id: 'files', label: 'Файлы и память', icon: '📁' },
    ],
  },
  {
    id: 'data',
    title: '🗄️ Данные и администрирование',
    icon: '🗄️',
    tabs: [
      { id: 'data', label: 'Данные (PG)', icon: '🗄️' },
      { id: 'lk', label: 'Пользователи ЛК', icon: '🔑' },
      { id: 'sync', label: 'Синхронизация', icon: '🔄' },
    ],
  },
];

export default function AdminGroups({ activeTab, onTabChange }: AdminGroupsProps) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    content: false,
    people: false,
    design: false,
    home: false,
    settings: false,
    data: true, // "Данные" всегда открыта
  });

  const toggleGroup = (groupId: string) => {
    setOpenGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  // Определяем группу для активной вкладки
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
